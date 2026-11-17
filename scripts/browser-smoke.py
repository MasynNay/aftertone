#!/usr/bin/env python3
"""Browser-level smoke checks for the actual generated AFTERTONE Pages site.

Third-party Deezer requests are mocked with fictional track data. This checks
our deployed UI, not provider availability or media playback permissions.
"""
import json
import os
import base64
import re
import sys
import threading
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARTIFACTS = ROOT / "browser-smoke-artifacts"
TIMEOUT = 20000

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

@contextmanager
def serve_build():
    if not (DIST / "index.html").is_file() or not (DIST / "demo/index.html").is_file():
        raise RuntimeError("Build dist/ using npm run check before browser smoke testing")
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(DIST)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

def demo_tracks():
    """Test metadata only; no commercial recordings or reproduced catalog."""
    return [
        {"id": 9100000 + n, "title": f"Fixture Melody {n:02d}",
         "duration": 208, "readable": True, "rank": 900 - n,
         "artist": {"id": 9200000 + n, "name": f"Fixture Artist {n:02d}"},
         "album": {"id": 9300000 + n, "title": "Test Library"},
         "preview": f"https://cdn-preview.dzcdn.net/stream/fixture-{n:02d}"}
        for n in range(1, 26)
    ]

def mock_deezer(route):
    parsed = urlsplit(route.request.url)
    callback = parse_qs(parsed.query).get("callback", [""])[0]
    if not re.fullmatch(r"__aftertoneDeezer_\d+", callback):
        route.abort()
        return
    if parsed.path.startswith("/track/"):
        payload = demo_tracks()[0]
    elif parsed.path.startswith("/search/artist"):
        payload = {"data": [], "total": 0}
    else:
        payload = {"data": demo_tracks(), "total": 25, "next": None}
    route.fulfill(status=200, content_type="application/javascript",
                  body=f"window[{json.dumps(callback)}]({json.dumps(payload)});")

def screenshot(page, name):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    try:
        page.screenshot(path=str(ARTIFACTS / f"{name}.png"), full_page=True, timeout=5000)
    except Exception as error:
        print(f"Screenshot unavailable: {error}", file=sys.stderr)

def require(value, message):
    if not value:
        raise AssertionError(message)

def browser_case(browser, base, width, height):
    context = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
    page = context.new_page()
    origin = urlsplit(base).netloc
    errors = []
    page.on("pageerror", lambda error: errors.append(f"Uncaught JavaScript exception: {error}"))
    page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}")
            if urlsplit(response.url).netloc == origin and response.status >= 400 else None)
    # Last registered matching route wins in Playwright.
    context.route("**/*", lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc == origin else route.abort())
    context.route("https://api.deezer.com/**", mock_deezer)
    label = f"{width}x{height}"
    try:
        page.goto(base + "/", wait_until="load", timeout=TIMEOUT)
        require(page.locator("#explore-experience").count() == 1, "Launch CTA missing")
        require(page.locator("dialog, iframe").count() == 0, "Unexpected popup or app iframe")
        require(page.locator('link[rel="stylesheet"]').first.evaluate("(el) => Boolean(el.sheet)"),
                "Portfolio stylesheet failed to load")
        require(page.evaluate("getComputedStyle(document.body).backgroundColor")
                not in ("rgb(255, 255, 255)", "rgba(0, 0, 0, 0)"),
                "Homepage appears to be unstyled")
        if width < 600:
            require(page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"),
                    "Mobile homepage overflow detected")
        screenshot(page, f"portfolio-{label}")
        if os.environ.get("AFTERTONE_VISUAL_REVIEW") == "1":
            preview = page.screenshot(type="jpeg", quality=63, full_page=False)
            print("AFTERTONE_VISUAL_" + str(width) + "=" + base64.b64encode(preview).decode(), flush=True)
            print("AFTERTONE_LAYOUT_" + str(width) + "=" + json.dumps(page.evaluate(
                "() => ({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,heading:document.querySelector('h1')?.innerText})"
            )), flush=True)

        page.locator("#explore-experience").click()
        page.wait_for_url("**/demo/", timeout=TIMEOUT)
        page.locator("#main-content .discovery-paths").wait_for(state="attached", timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="attached", timeout=TIMEOUT)
        require(page.locator("#player").count() == 1, "Original audio element missing")
        require(page.locator("#main-content [data-path]").count() >= 3,
                "Discovery path controls did not render")
        # First-time listeners get inline guidance, not an additional blocking modal.
        require(page.locator(".first-listen-guide ol li").count() == 3,
                "First-session listening steps are missing")
        require(page.locator(".first-listen-guide").is_visible(),
                "First-session guidance is not visible")
        require(page.locator(".skip-to-content").count() == 1,
                "Accessible skip-to-content link missing")
        if width < 600:
            # Check actual rendered hit areas, not just matching CSS declarations.
            targets = ["#mobile-refine-toggle", "#theme-menu-toggle",
                       "#sound-toggle", "#help-button"]
            targets += ['#main-nav button[data-view="' + mode + '"]'
                        for mode in ("discover", "collection", "taste",
                                     "quiz", "duels", "challenges")]
            for selector in targets:
                rect = page.locator(selector).bounding_box()
                require(rect and rect["width"] >= 43.5 and rect["height"] >= 43.5,
                        f"Phone tap target is smaller than 44px: {selector}: {rect}")
            require(page.locator("#main-nav button[data-view]").count() == 6,
                    "All six mobile navigation destinations must remain visible")
            app_layout = page.evaluate("""() => ({
                viewport: innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                offenders: [...document.querySelectorAll('body *')].map(el => {
                    const box = el.getBoundingClientRect();
                    return {tag:el.tagName.toLowerCase(), id:el.id,
                        className:typeof el.className === 'string' ? el.className.slice(0,70) : '',
                        left:Math.floor(box.left), right:Math.ceil(box.right),
                        width:Math.ceil(box.width)};
                }).filter(item => item.right > innerWidth+2 || item.left < -2)
                  .slice(0,24)
            })""")
            if app_layout["scrollWidth"] > width + 2:
                print("AFTERTONE_MOBILE_APP_OVERFLOW=" + json.dumps(app_layout),flush=True)
            require(app_layout["scrollWidth"] <= width + 2,
                    "Music app overflows the small mobile viewport")
        # Initial onboarding must trap Tab within its dialog, allow Escape, and
        # restore focus to the previous content (rather than the browser body).
        intro=page.locator('#modal-root [role="dialog"]')
        intro.wait_for(state="visible",timeout=TIMEOUT)
        require(page.evaluate("document.querySelector('.shell').inert"),
                "Page background was not made inert while modal is open")
        require(page.locator('#modal-root [data-modal="close"]').evaluate(
                    "(el) => document.activeElement === el"),
                "Onboarding did not initially focus its close button")
        page.keyboard.press("Shift+Tab")
        require(page.locator('#modal-root [data-modal="onboarding-playlist"]').evaluate(
                    "(el) => document.activeElement === el"),
                "Shift+Tab escaped the initial dialog instead of wrapping")
        page.keyboard.press("Tab")
        require(page.locator('#modal-root [data-modal="close"]').evaluate(
                    "(el) => document.activeElement === el"),
                "Tab did not cycle back to the dialog's first control")
        page.keyboard.press("Escape")
        intro.wait_for(state="hidden",timeout=TIMEOUT)
        require(page.evaluate("!document.querySelector('.shell').inert"),
                "Background remained inert after dialog close")
        require(page.evaluate("document.activeElement?.id === 'main-content'"),
                "Closing first-run onboarding lost keyboard focus")
        # Opening help from a real button should restore that same button.
        page.locator("#help-button").click()
        page.locator('#modal-root [role="dialog"]').wait_for(state="visible",timeout=TIMEOUT)
        page.keyboard.press("Escape")
        require(page.evaluate("document.activeElement?.id === 'help-button'"),
                "Closing help did not return focus to its opener")
        # Escape should also close the keyboard-operated palette.
        page.locator("#theme-menu-toggle").click()
        require(page.locator("#theme-menu-toggle").get_attribute("aria-expanded") == "true",
                "Palette did not open")
        page.keyboard.press("Escape")
        require(page.locator("#theme-menu-toggle").get_attribute("aria-expanded") == "false",
                "Escape did not close palette")
        require(page.evaluate("document.activeElement?.id === 'theme-menu-toggle'"),
                "Palette did not restore keyboard focus")
        # A focused navigation button must activate normally on Space.
        page.locator('#main-nav button[data-view="collection"]').focus()
        page.keyboard.press("Space")
        page.locator("#main-content .page-head h1").wait_for(state="visible",timeout=TIMEOUT)
        require("collection" in page.locator("#main-content .page-head h1").inner_text().lower(),
                "Space key was stolen from the native navigation button")
        require(page.evaluate("document.activeElement?.id === 'main-content'"),
                "Single-page navigation did not move focus to new content")
        require(page.locator('#main-nav button[data-view="collection"]').get_attribute("aria-current") == "page",
                "Active navigation section not announced to assistive technology")
        require(page.locator("#main-content").get_attribute("aria-label") == "Collection section",
                "Focused main landmark should announce the collection name")
        require(page.title() == "Collection — AFTERTONE",
                "Browser title should identify the current app section")
        require(page.locator("#main-content").get_attribute("aria-live") is None,
                "Whole-screen rerenders must not use an aria-live region")
        page.locator('#main-nav button[data-view="discover"]').click()
        page.locator("#listening-card").wait_for(state="attached",timeout=TIMEOUT)
        require(page.locator('link[rel="stylesheet"]').first.evaluate("(el) => Boolean(el.sheet)"),
                "App stylesheet failed to load")
        require(page.locator("#audio-status").get_attribute("role") == "status",
                "Preview playback state should be a screen-reader status")
        require(page.locator("#audio-status").get_attribute("aria-live") == "polite",
                "Preview state must announce changes without interrupting the listener")
        # A timeupdate fires several times per second. It must not rewrite and
        # re-announce identical statuses during every playback tick.
        status_stable = page.evaluate("""async () => {
            const player=document.querySelector('#player');
            const status=document.querySelector('#audio-status');
            player.dispatchEvent(new Event('timeupdate')); // establish baseline
            const before=status.textContent;
            let writes=0;
            const observer=new MutationObserver(records => { writes += records.length; });
            observer.observe(status,{childList:true,characterData:true,subtree:true});
            player.dispatchEvent(new Event('timeupdate'));
            player.dispatchEvent(new Event('timeupdate'));
            await Promise.resolve();
            observer.disconnect();
            return {before,after:status.textContent,writes};
        }""")
        require(status_stable["before"] == status_stable["after"] and status_stable["writes"] == 0,
                f"Preview status changed on an ordinary timeupdate: {status_stable}")
        screenshot(page, f"discover-{label}")
        if width > 600:
            # First-run onboarding is a real modal. Dismiss it like a visitor
            # before exercising playback; never force-click through overlays.
            first_run = page.locator('#modal-root button[data-modal="close"]')
            if first_run.count():
                first_run.first.click(timeout=TIMEOUT)
                page.locator('#modal-root [role="dialog"]').wait_for(state="hidden", timeout=TIMEOUT)
            # No external CDN is contacted: a blocked fixture preview must
            # expose Retry and Skip instead of trapping the listener.
            page.locator("#stage-play").click()
            page.locator("#preview-recovery").wait_for(state="visible", timeout=TIMEOUT)
            require("Deezer preview is unavailable" in page.locator("#preview-recovery p").inner_text(),
                    "Blocked Deezer audio should explain the affected provider")
            before = page.locator(".journey-metrics div:first-child strong").inner_text()
            page.locator('[data-action="skip-unavailable"]').click()
            page.locator("#listening-card").wait_for(state="attached", timeout=TIMEOUT)
            after = page.locator(".journey-metrics div:first-child strong").inner_text()
            require(before == after, "Skipping unavailable audio changed listening history")
            close = page.locator('#modal-root button[data-modal="close"]')
            if close.count():
                close.first.click(timeout=TIMEOUT)
            page.locator('#main-nav button[data-view="collection"]').click()
            heading = page.locator("#main-content .page-head h1")
            heading.wait_for(state="visible", timeout=TIMEOUT)
            require("collection" in heading.inner_text().lower(), "Collection failed to render")
            # Add an imported-playlist seed and manual lyric timing preference.
            # These previously lived outside the exported session state.
            page.evaluate("""() => {
                localStorage.setItem('aftertone:optional-playlist:v1',
                    JSON.stringify({tracks:[{artist:'Fixture Artist 01', title:'Fixture Melody 01'}]}));
                localStorage.setItem('aftertone:lyric-offsets:v1',
                    JSON.stringify({'deezer:9100001':45}));
            }""")
            # A backup must be downloadable even when no tracks are saved.
            page.locator('[data-action="backup-progress"]').wait_for(state="visible", timeout=TIMEOUT)
            with page.expect_download(timeout=TIMEOUT) as download_event:
                page.locator('[data-action="backup-progress"]').click()
            backup = download_event.value
            require(backup.suggested_filename.startswith("aftertone-progress-"), "Backup filename missing")
            payload = json.loads(Path(backup.path()).read_text(encoding="utf-8"))
            require(payload.get("format") == "aftertone-progress", "Backup file schema missing")
            require("tournaments" in payload and "session" in payload, "Backup omitted saved state")
            require(payload.get("version") == 2, "Expected current backup format version 2")
            require(payload.get("playlist", {}).get("tracks", [{}])[0].get("title")
                    == "Fixture Melody 01", "Backup omitted imported playlist")
            require(payload.get("lyricOffsets", {}).get("deezer:9100001") == 45,
                    "Backup omitted lyric timing adjustment")
            require(page.locator('[data-action="restore-progress"]').count() == 1,
                    "Restore backup control missing")
            # End-to-end restore: corrupt the existing session *after* exporting,
            # then import the good backup through the actual file input.
            page.evaluate("""() => {
                localStorage.setItem('aftertone:session:v1', 'broken-test-session');
                localStorage.setItem('aftertone:optional-playlist:v1', 'broken-test-playlist');
                localStorage.setItem('aftertone:lyric-offsets:v1', 'broken-test-offsets');
            }""")
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator("#progress-backup-file").set_input_files({
                "name": backup.suggested_filename,
                "mimeType": "application/json",
                "buffer": Path(backup.path()).read_bytes(),
            })
            page.wait_for_function(
                "() => localStorage.getItem('aftertone:session:v1') !== 'broken-test-session'",
                timeout=TIMEOUT,
            )
            restored = json.loads(page.evaluate("localStorage.getItem('aftertone:session:v1')"))
            require(restored.get("version") == 1, "Restored state is not valid")
            require(restored.get("favorites") == payload["session"]["favorites"],
                    "Restore did not recover saved favorites")
            stored_playlist = json.loads(page.evaluate(
                "localStorage.getItem('aftertone:optional-playlist:v1')"))
            stored_offsets = json.loads(page.evaluate(
                "localStorage.getItem('aftertone:lyric-offsets:v1')"))
            require(stored_playlist == payload["playlist"], "Restore lost imported playlist")
            require(stored_offsets == payload["lyricOffsets"], "Restore lost lyric timing offsets")
            page.locator("#main-content .discovery-paths").wait_for(state="attached",timeout=TIMEOUT)
            page.locator('#main-nav button[data-view="duels"]').click()
            page.locator("#main-content .duels-page .duel-arena-picker").wait_for(
                state="attached", timeout=TIMEOUT)
            screenshot(page, f"duels-{label}")
            # Six cards must reflect the *chosen* size and song pool.
            require(page.locator("[data-duel-status]").count() == 6,
                    "Missing one or more tournament arena readiness labels")
            page.locator("#duel-size").select_option("16")
            page.locator("#duel-pool").select_option("favorites")
            require(page.locator('[data-duel-action="create"]').is_disabled(),
                    "Insufficient favorites must not create a bracket")
            require("0/16 eligible" in page.locator('[data-duel-theme="open"] [data-duel-status]').inner_text(),
                    "Arena badge must count favorites for selected bracket size")
            require(page.locator('[data-duel-action="discover-more"]').is_visible(),
                    "Sparse song pools need an actionable recovery path")
            page.locator("#duel-pool").select_option("all")
            page.locator("#duel-size").select_option("4")
            page.locator('[data-duel-theme="open"]').click()
            page.locator('[data-duel-action="create"]').wait_for(state="visible",timeout=TIMEOUT)
            require(page.locator('[data-duel-action="create"]').is_enabled(),
                    "Fixture catalog should support a four-song Open Stage bracket")
            page.locator('[data-duel-action="create"]').click()
            page.locator('#duel-active-event [data-duel-vote]').first.wait_for(
                state="visible",timeout=TIMEOUT)
            # Preserve genuine browser evidence of a live, in-progress bracket,
            # not just the tournament picker or a hand-composed marketing mockup.
            screenshot(page, f"music-duels-bracket-{label}")
            selected = page.evaluate("localStorage.getItem('aftertone:duels:selection:v1')")
            require(selected and selected.startswith("duel_"),"Opened bracket was not saved")
            page.locator('#duel-active-event [data-duel-vote]').first.click()
            require("1 of 4" in page.locator("#duel-active-event").inner_text(),
                    "First match vote was not recorded")
            page.reload(wait_until="load",timeout=TIMEOUT)
            close_modal = page.locator('#modal-root button[data-modal="close"]')
            if close_modal.count():
                close_modal.first.click(timeout=TIMEOUT)
            page.locator('#main-nav button[data-view="duels"]').click()
            page.locator("#duel-active-event").wait_for(state="visible",timeout=TIMEOUT)
            require("1 of 4" in page.locator("#duel-active-event").inner_text(),
                    "Partly completed bracket was not resumed after reload")
            require(page.evaluate("localStorage.getItem('aftertone:duels:selection:v1')") == selected,
                    "Selected tournament changed after reload")
            # Finish the semifinals, bronze match, and grand final in the real UI.
            for number in range(3):
                page.locator('#duel-active-event [data-duel-vote]').first.click()
            page.locator("#duel-active-event .duel-podium").wait_for(
                state="visible",timeout=TIMEOUT)
            require(page.locator("#duel-active-event .duel-podium-tile").count() == 3,
                    "Finished cup must display gold, silver and bronze")
            require("4 of 4" in page.locator("#duel-active-event").inner_text(),
                    "Match count did not reflect the completed tournament")
            require(page.locator(".duel-hall-leader").count() >= 1,
                    "Completed cup did not enter Hall of Fame")
            # Capture the verified podium BEFORE requesting the CSV: Export
            # intentionally shows a toast, which is not part of the podium UI.
            page.evaluate("""() => {
                document.activeElement?.blur?.();
                // The app intentionally uses smooth scrolling. Disable it only
                // for the evidence capture so screenshots are deterministic.
                document.documentElement.style.setProperty('scroll-behavior','auto','important');
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                window.scrollTo(0, 0);
            }""")
            page.wait_for_function("() => Math.abs(window.scrollY) <= 2",timeout=TIMEOUT)
            # Winning the final also shows a toast. Wait for its CSS fade to
            # finish, rather than merely waiting for the 'show' class to clear.
            page.wait_for_function("""() => {
                const toast=document.querySelector('#toast');
                return !toast || (!toast.classList.contains('show') &&
                    Number.parseFloat(getComputedStyle(toast).opacity) <= 0.01);
            }""",timeout=TIMEOUT)
            screenshot(page,f"music-duels-complete-{label}")
            with page.expect_download(timeout=TIMEOUT) as hall_download:
                page.locator('[data-duel-action="export-hall"]').click()
            hall = Path(hall_download.value.path()).read_text(encoding="utf-8")
            require("Track Name" in hall and "Fixture Melody" in hall,
                    "Hall of Fame export must contain podium metadata")
            # Close stays closed on reload, and History can reopen the podium.
            page.locator('[data-duel-action="dismiss"]').click()
            page.reload(wait_until="load",timeout=TIMEOUT)
            close_modal = page.locator('#modal-root button[data-modal="close"]')
            if close_modal.count():
                close_modal.first.click(timeout=TIMEOUT)
            page.locator('#main-nav button[data-view="duels"]').click()
            require(page.locator("#duel-active-event").count() == 0,
                    "Explicit Close Bracket was not respected after reload")
            page.locator('[data-duel-action="open"]').first.click()
            page.locator("#duel-active-event .duel-podium").wait_for(
                state="visible",timeout=TIMEOUT)

        require(not errors, "Browser errors:\n" + "\n".join(errors))
        print(f"PASS {label}: homepage, styling, real app boot, discovery, navigation")
    except Exception:
        screenshot(page, f"FAILED-{label}")
        if errors:
            print("\n".join(errors), file=sys.stderr)
        raise
    finally:
        context.close()

def check_product_deep_links(browser, base):
    """Marketing stations must open the requested real listening mode, not just a generic app."""
    context = browser.new_context(viewport={"width": 1024, "height": 800}, service_workers="block")
    origin = urlsplit(base).netloc
    context.route("**/*", lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc == origin else route.abort())
    context.route("https://api.deezer.com/**", mock_deezer)
    try:
        for mode in ("familiar", "balanced", "explore"):
            page = context.new_page()
            page.goto(base + "/demo/?path=" + mode, wait_until="load", timeout=TIMEOUT)
            option = page.locator('.path-option[data-path="' + mode + '"]')
            option.wait_for(state="attached", timeout=TIMEOUT)
            require(option.get_attribute("aria-pressed") == "true",
                    "Station preset failed to select " + mode)
            page.close()
        page = context.new_page()
        page.goto(base + "/demo/?view=duels", wait_until="load", timeout=TIMEOUT)
        page.locator("#main-content .duels-page").wait_for(state="attached", timeout=TIMEOUT)
        require(page.locator('#modal-root [role="dialog"]').count() == 0,
                "Direct Music Duels entry should not be blocked by discovery onboarding")
        page.close()
    finally:
        context.close()
    print("PASS product station deep links and Music Duels direct entry")


def firefox_case(browser, base, width, height):
    """Real Firefox navigation/keyboard/layout checks; never contacts live providers."""
    context = browser.new_context(viewport={"width": width, "height": height},
                                  service_workers="block")
    origin = urlsplit(base).netloc
    context.route("**/*", lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc == origin else route.abort())
    context.route("https://api.deezer.com/**", mock_deezer)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(f"JavaScript exception: {error}"))
    page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}")
            if urlsplit(response.url).netloc == origin and response.status >= 400 else None)
    label = f"firefox-{width}x{height}"
    try:
        page.goto(base + "/", wait_until="load", timeout=TIMEOUT)
        require(page.locator("#explore-experience").is_visible(),
                "Firefox marketing page has no visible launch control")
        require(page.locator('link[rel="stylesheet"]').first.evaluate(
            "(el) => Boolean(el.sheet)"), "Firefox marketing stylesheet failed")
        page.locator("#explore-experience").click()
        page.wait_for_url("**/demo/", timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible", timeout=TIMEOUT)
        require(page.locator('.skip-to-content').get_attribute('href') == '#main-content',
                "Firefox skip link is missing")
        require(page.locator("#main-content").get_attribute("aria-live") is None,
                "The whole listening room should not be a live region")
        require(page.locator("#audio-status").get_attribute("role") == "status",
                "Firefox preview status is not accessible")

        # Dialog focus and Escape restoration need to work in real Firefox.
        dialog = page.locator('#modal-root [role="dialog"]')
        dialog.wait_for(state="visible", timeout=TIMEOUT)
        page.keyboard.press("Shift+Tab")
        require(page.locator('#modal-root [data-modal="onboarding-playlist"]').evaluate(
            "(el) => document.activeElement === el"),
            "Firefox Shift+Tab escaped the onboarding dialog")
        page.keyboard.press("Tab")
        require(page.locator('#modal-root [data-modal="close"]').evaluate(
            "(el) => document.activeElement === el"),
            "Firefox Tab failed to wrap to the dialog's first button")
        page.keyboard.press("Escape")
        dialog.wait_for(state="hidden", timeout=TIMEOUT)
        require(page.evaluate("document.activeElement?.id === 'main-content'"),
                "Firefox closing the dialog did not restore focus")

        # Native Space activation and the app's current-page landmarks.
        collection = page.locator('#main-nav button[data-view="collection"]')
        collection.focus()
        page.keyboard.press("Space")
        require(page.locator("#main-content").get_attribute("aria-label")
                == "Collection section", "Firefox native Space navigation failed")
        require(page.evaluate("document.activeElement?.id === 'main-content'"),
                "Firefox navigation did not move focus to the main landmark")

        for mode, name in (("discover", "Discover"), ("taste", "Taste Map"),
                           ("quiz", "Tune Lab"), ("duels", "Music Duels"),
                           ("challenges", "Challenges"), ("collection", "Collection")):
            nav = page.locator(f'#main-nav button[data-view="{mode}"]')
            nav.click()
            require(nav.get_attribute("aria-current") == "page",
                    f"Firefox navigation did not select {mode}")
            require(page.locator("#main-content").get_attribute("aria-label")
                    == f"{name} section", f"Firefox landmark label missing for {mode}")
            require(page.title() == f"{name} — AFTERTONE",
                    f"Firefox browser title did not update for {mode}")
            require(page.locator("#main-content").inner_text().strip(),
                    f"Firefox rendered an empty {mode} view")

        page.locator("#help-button").click()
        page.locator('#modal-root [role="dialog"]').wait_for(state="visible",timeout=TIMEOUT)
        page.keyboard.press("Escape")
        require(page.evaluate("document.activeElement?.id === 'help-button'"),
                "Firefox closing Help lost opener focus")
        if width <= 390:
            width_info = page.evaluate("""() => ({
                viewport:innerWidth,
                page:document.documentElement.scrollWidth,
                navigation:[...document.querySelectorAll('#main-nav button[data-view]')]
                    .map(el=>({width:el.getBoundingClientRect().width,
                               height:el.getBoundingClientRect().height}))
            })""")
            require(width_info["page"] <= width_info["viewport"] + 2,
                    f"Firefox phone layout overflows: {width_info}")
            require(len(width_info["navigation"]) == 6,
                    "Firefox phone layout hides a navigation destination")
            require(all(box["height"] >= 43.5 and box["width"] >= 43.5
                        for box in width_info["navigation"]),
                    "Firefox phone navigation has a touch target below 44px")

        require(not errors, "Firefox browser errors:\\n" + "\\n".join(errors))
        print(f"PASS {label}: marketing, app, dialogs, keyboard, six views, mobile fit")
    except Exception:
        screenshot(page, f"FAILED-{label}")
        if errors:
            print("\\n".join(errors), file=sys.stderr)
        raise
    finally:
        context.close()



def check_catalog_outage_recovery(browser, base):
    """Simulate a Deezer error envelope, then retry in-place after recovery."""
    context = browser.new_context(viewport={"width": 1024, "height": 800},
                                  service_workers="block")
    origin = urlsplit(base).netloc
    state = {"online": False, "failed": 0}
    errors = []
    context.route("**/*", lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc == origin else route.abort())

    def flaky_deezer(route):
        if state["online"]:
            return mock_deezer(route)
        parsed = urlsplit(route.request.url)
        callback = parse_qs(parsed.query).get("callback", [""])[0]
        if not re.fullmatch(r"__aftertoneDeezer_\d+", callback):
            route.abort()
            return
        state["failed"] += 1
        body = {"error": {"code": 429, "message": "Temporary provider outage (fictional fixture)"}}
        route.fulfill(status=200, content_type="application/javascript",
                      body=f"window[{json.dumps(callback)}]({json.dumps(body)});")

    context.route("https://api.deezer.com/**", flaky_deezer)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        page.goto(base + "/demo/", wait_until="load", timeout=TIMEOUT)
        close = page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        empty = page.locator("#main-content .discovery-empty-state")
        empty.wait_for(state="visible", timeout=TIMEOUT)
        require("Music Is Temporarily Unavailable" in empty.inner_text(),
                "A failed Deezer request must show a recoverable error, not a blank app")
        require("Requests are temporarily limited" in empty.inner_text() and
                "Wait a moment, then retry" in empty.inner_text(),
                "Quota failures must explain backoff and recovery, not a generic error")
        # Both the retry banner and the empty-state help can use load-more;
        # exercise the specifically labelled outage recovery action.
        retry = page.get_by_role("button", name="Retry Discovery", exact=True)
        require(retry.is_visible() and retry.is_enabled(),
                "Deezer outage should provide an enabled in-app retry control")
        require(state["failed"] >= 1, "The test must actually exercise a provider rejection")
        require(page.locator("#listening-card").count() == 0,
                "An unavailable provider must not invent a playable song")
        saved_before = page.evaluate("""() => {
            const state = JSON.parse(localStorage.getItem('aftertone:session:v1') || '{}');
            return {favorites: state.favorites || [], history: state.history || []};
        }""")
        page.evaluate("window.__aftertoneRecoveryProbe = 'same-document'")
        state["online"] = True
        retry.click()
        page.locator("#listening-card").wait_for(state="visible", timeout=TIMEOUT)
        require("Fixture Melody" in page.locator("#listening-card").inner_text(),
                "Retry should restore fixture discovery after provider recovery")
        require(page.evaluate("window.__aftertoneRecoveryProbe") == "same-document",
                "Recovering from Deezer outage unexpectedly reloaded the whole app")
        saved_after = page.evaluate("""() => {
            const state = JSON.parse(localStorage.getItem('aftertone:session:v1') || '{}');
            return {favorites: state.favorites || [], history: state.history || []};
        }""")
        require(saved_after == saved_before,
                "Provider outage/retry must not count as a listening vote or modify favorites")
        require(not errors, "Browser exceptions during outage/retry: " + "; ".join(errors))
        print(f"PASS {browser.browser_type.name} Deezer outage -> Retry Discovery -> recovered, no reload or votes")
    except Exception:
        screenshot(page, f"FAILED-provider-recovery-{browser.browser_type.name}")
        raise
    finally:
        context.close()



def check_backup_restore_cross_browser(browser, base):
    """Real export / rejected import / restore / refresh in both browser engines."""
    context = browser.new_context(
        viewport={"width": 1024, "height": 800}, accept_downloads=True,
        service_workers="block")
    origin = urlsplit(base).netloc
    context.route("**/*", lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc == origin else route.abort())
    context.route("https://api.deezer.com/**", mock_deezer)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    label = f"backup-restore-{browser.browser_type.name}"
    try:
        page.goto(base + "/demo/", wait_until="load", timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible", timeout=TIMEOUT)
        close = page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="collection"]').click()
        page.locator('[data-action="backup-progress"]').wait_for(
            state="visible", timeout=TIMEOUT)

        # Seed nonempty, realistic saved progress: unlike the original Chromium
        # smoke, these checks prove a favorite and listening decision survive.
        page.evaluate("""() => {
            const key='aftertone:session:v1';
            const session=JSON.parse(localStorage.getItem(key));
            const id='deezer:9100001';
            session.favorites=[id];
            session.savedTracks=[{
                id,source:'deezer',title:'Fixture Melody 01',
                artist:'Fixture Artist 01',genre:'unknown',mood:'Fresh'
            }];
            session.history=[{
                id,action:'like',artist:'Fixture Artist 01',
                genre:'unknown',context:'discovery',route:'balanced',
                recognized:true,correct:null,mood:'Fresh',at:1730000000000
            }];
            session.volume=62;
            localStorage.setItem(key,JSON.stringify(session));
            localStorage.setItem('aftertone:tune-lab:v1',
                JSON.stringify({answered:2,correct:1}));
            localStorage.setItem('aftertone:favorite-artists:v1',
                JSON.stringify(['Fixture Artist 01']));
            localStorage.setItem('aftertone:optional-playlist:v1',
                JSON.stringify({tracks:[{artist:'Fixture Artist 01',title:'Fixture Melody 01'}]}));
            localStorage.setItem('aftertone:lyric-offsets:v1',
                JSON.stringify({'deezer:9100001':37}));
        }""")
        with page.expect_download(timeout=TIMEOUT) as exported:
            page.locator('[data-action="backup-progress"]').click()
        download=exported.value
        require(download.suggested_filename.startswith("aftertone-progress-"),
                "Backup download filename is missing")
        backup=json.loads(Path(download.path()).read_text(encoding="utf-8"))
        require(backup["format"]=="aftertone-progress" and backup["version"]==2,
                "Backup has wrong format or version")
        require(backup["session"]["favorites"]==["deezer:9100001"] and
                len(backup["session"]["history"])==1 and
                backup["session"]["volume"]==62,
                "Saved song, decision or volume missing from real browser export")
        require(backup["quiz"]["correct"]==1 and
                backup["artists"]==["Fixture Artist 01"],
                "Tune Lab or favorite artists missing from backup")
        require(backup["playlist"]["tracks"][0]["title"]=="Fixture Melody 01" and
                backup["lyricOffsets"]["deezer:9100001"]==37,
                "Imported playlist or lyric timing missing from backup")
        keys=[
            'aftertone:session:v1','aftertone:duels:v1',
            'aftertone:tune-lab:v1','aftertone:favorite-artists:v1',
            'aftertone:optional-playlist:v1','aftertone:lyric-offsets:v1',
        ]
        before=page.evaluate("(keys) => keys.map(k => localStorage.getItem(k))", keys)
        malformed=dict(backup)
        malformed["version"]=999
        page.locator("#progress-backup-file").set_input_files({
            "name":"invalid-aftertone-progress.json",
            "mimeType":"application/json",
            "buffer":json.dumps(malformed).encode("utf-8"),
        })
        page.wait_for_function("""() => document.querySelector('#progress-backup-status')?.textContent?.includes(
            'not a supported AFTERTONE progress backup')""",
            timeout=TIMEOUT)
        require(page.locator("#progress-backup-status").is_visible(),
                "Invalid restore feedback was not persistently visible")
        require(page.evaluate("document.activeElement?.dataset?.action === 'restore-progress'"),
                "Invalid restore left keyboard focus on a hidden file input")
        after_invalid=page.evaluate(
            "(keys) => keys.map(k => localStorage.getItem(k))", keys)
        require(after_invalid==before,
                "Invalid backup changed saved data before user confirmation")
        # Replace the storage with valid but empty data. Then restore through
        # the actual HTML file input and its destructive confirmation dialog.
        page.evaluate("""() => {
            const key='aftertone:session:v1';
            const session=JSON.parse(localStorage.getItem(key));
            session.favorites=[];
            session.savedTracks=[];
            session.history=[];
            localStorage.setItem(key,JSON.stringify(session));
            localStorage.removeItem('aftertone:optional-playlist:v1');
            localStorage.setItem('aftertone:lyric-offsets:v1','{}');
            localStorage.setItem('aftertone:tune-lab:v1',
                JSON.stringify({answered:0,correct:0}));
            localStorage.setItem('aftertone:favorite-artists:v1','[]');
        }""")
        # Canceling a valid restore must leave all current data unchanged
        # and return focus to the visible Restore Backup action.
        before_cancel=page.evaluate(
            "(keys) => keys.map(k => localStorage.getItem(k))", keys)
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.locator("#progress-backup-file").set_input_files({
            "name":download.suggested_filename,
            "mimeType":"application/json",
            "buffer":json.dumps(backup).encode("utf-8"),
        })
        page.wait_for_function("""() => document.querySelector('#progress-backup-status')?.textContent?.includes(
            'Restore canceled. Your existing progress was not changed.')""",
            timeout=TIMEOUT)
        require(page.evaluate(
            "document.activeElement?.dataset?.action === 'restore-progress'"),
            "Canceled restore did not return focus to the restore button")
        require(page.evaluate(
            "(keys) => keys.map(k => localStorage.getItem(k))", keys)==before_cancel,
            "Canceling restore unexpectedly modified saved progress")
        # Repeat the same file after dismissal; the file input must be reset.
        page.once("dialog", lambda dialog: dialog.accept())
        page.locator("#progress-backup-file").set_input_files({
            "name":download.suggested_filename,
            "mimeType":"application/json",
            "buffer":json.dumps(backup).encode("utf-8"),
        })
        page.wait_for_function("""() => {
            try {
                const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
                return s?.favorites?.includes('deezer:9100001') &&
                       s?.history?.length===1;
            } catch {return false;}
        }""",timeout=TIMEOUT)
        page.locator("#main-content .discovery-paths").wait_for(
            state="attached",timeout=TIMEOUT)
        restored=page.evaluate("""() => ({
            session:JSON.parse(localStorage.getItem('aftertone:session:v1')),
            playlist:JSON.parse(localStorage.getItem('aftertone:optional-playlist:v1')),
            offsets:JSON.parse(localStorage.getItem('aftertone:lyric-offsets:v1')),
            quiz:JSON.parse(localStorage.getItem('aftertone:tune-lab:v1')),
            artists:JSON.parse(localStorage.getItem('aftertone:favorite-artists:v1'))
        })""")
        require(restored["session"]["favorites"]==backup["session"]["favorites"] and
                restored["session"]["history"]==backup["session"]["history"] and
                restored["session"]["savedTracks"]==backup["session"]["savedTracks"],
                "Restore did not preserve the user's favorite, track and history")
        require(restored["playlist"]==backup["playlist"] and
                restored["offsets"]==backup["lyricOffsets"] and
                restored["quiz"]==backup["quiz"] and
                restored["artists"]==backup["artists"],
                "Restore lost optional progress, playlist, quiz or lyric data")
        page.locator('#main-nav button[data-view="collection"]').click()
        require("Fixture Melody 01" in page.locator("#main-content").inner_text(),
                "Restored favorite is missing from the visible Collection")
        require(not errors, "Browser exceptions during backup/restore: "+"; ".join(errors))
        print(f"PASS {label}: export, reject invalid, restore favorites/history, display collection")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()




def check_backup_transfer_new_profile(browser, base):
    """Download a real backup, close the source profile, import into a fresh one.

    This simulates separate browser storage profiles, not physical devices or a
    transfer between different engines. No external provider/media is contacted.
    """
    origin=urlsplit(base).netloc
    def context_fixture(context):
        context.route("**/*",lambda route:route.continue_()
                      if urlsplit(route.request.url).netloc==origin else route.abort())
        context.route("https://api.deezer.com/**",mock_deezer)

    source=browser.new_context(viewport={"width":1024,"height":800},
                               accept_downloads=True,service_workers="block")
    context_fixture(source)
    exported_bytes=None
    source_errors=[]
    label=f"new-profile-backup-{browser.browser_type.name}"
    try:
        first=source.new_page()
        first.on("pageerror",lambda error:source_errors.append(str(error)))
        first.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        first.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=first.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        # Make an authentic Keep decision through the application, not by
        # fabricating a stored session or copying its storage to the target.
        first.locator('#listening-card [data-action="like"]').click()
        first.wait_for_function("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return s.history?.length===1 && s.favorites?.length===1 &&
                   s.savedTracks?.length===1;
        }""",timeout=TIMEOUT)
        first.evaluate("""() => {
            localStorage.setItem('aftertone:tune-lab:v1',
                JSON.stringify({answered:7,correct:5}));
            localStorage.setItem('aftertone:favorite-artists:v1',
                JSON.stringify(['Fixture Transfer Artist']));
            localStorage.setItem('aftertone:optional-playlist:v1',
                JSON.stringify({tracks:[
                    {artist:'Fixture Transfer Artist',title:'Transfer Song'}
                ]}));
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            localStorage.setItem('aftertone:lyric-offsets:v1',
                JSON.stringify({[s.favorites[0]]:42}));
        }""")
        first.locator('#main-nav button[data-view="collection"]').click()
        note=first.locator('#collection-backup-note').inner_text()
        require("Version 2 backups include saved tracks, listening choices" in note
                and "imported playlist song names and manual lyric timing offsets" in note,
                "Collection must describe the actual v2 backup contents")
        with first.expect_download(timeout=TIMEOUT) as result:
            first.locator('[data-action="backup-progress"]').click()
        download=result.value
        require(download.suggested_filename.startswith('aftertone-progress-'),
                "Actual backup download did not have the expected filename")
        exported_bytes=Path(download.path()).read_bytes()
        backup=json.loads(exported_bytes.decode("utf-8"))
        require(backup["version"]==2 and backup["format"]=="aftertone-progress",
                "Export format must be the supported portable v2 JSON")
        require(len(backup["session"]["favorites"])==1 and
                len(backup["session"]["history"])==1 and
                len(backup["session"]["savedTracks"])==1,
                "Real Keep decision was missing from exported transfer file")
        require(backup["quiz"]=={"answered":7,"correct":5} and
                backup["artists"]==["Fixture Transfer Artist"],
                "Tune Lab or selected artist data missing from export")
        require(backup["playlist"]["tracks"][0]["title"]=="Transfer Song" and
                list(backup["lyricOffsets"].values())==[42],
                "Imported playlist or lyric offset missing from export")
        require(not source_errors,"Source browser failed: "+"; ".join(source_errors))
    finally:
        source.close()  # Source is gone BEFORE the destination is created.

    # This browser context shares no localStorage, cookies, or session state
    # with the source. The only transfer is the downloaded JSON file bytes.
    target=browser.new_context(viewport={"width":1024,"height":800},
                               service_workers="block")
    context_fixture(target)
    destination_errors=[]
    try:
        page=target.new_page()
        page.on("pageerror",lambda error:destination_errors.append(str(error)))
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        fresh=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {
                favorites:s.favorites||[],history:s.history||[],
                quiz:localStorage.getItem('aftertone:tune-lab:v1'),
                playlist:localStorage.getItem('aftertone:optional-playlist:v1')
            };
        }""")
        require(not fresh["favorites"] and not fresh["history"] and
                fresh["playlist"] is None,
                "Fresh browser context inherited the source's collection or playlist")
        page.locator('#main-nav button[data-view="collection"]').click()
        confirmation=[]
        def accept_import(dialog):
            confirmation.append(dialog.message)
            dialog.accept()
        page.once("dialog",accept_import)
        page.locator("#progress-backup-file").set_input_files({
            "name":"aftertone-transfer.json",
            "mimeType":"application/json",
            "buffer":exported_bytes,
        })
        page.wait_for_function("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return s.favorites?.length===1 && s.history?.length===1 &&
                   document.querySelector('#main-nav button[data-view="collection"]');
        }""",timeout=TIMEOUT)
        require(len(confirmation)==1 and
                "1 favorite artist and Tune Lab 5/7 correct" in confirmation[0],
                f"Restore confirmation did not disclose Tune Lab and favorite artists: {confirmation}")
        # Storage writes happen before window.location.reload(). A quick
        # localStorage assertion alone can complete on the old document.
        # Wait for the rehydrated Discover page before inspecting Collection.
        page.locator("#main-content .discovery-paths").wait_for(
            state="attached",timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="collection"]').click()
        saved=backup["session"]["savedTracks"][0]
        require(saved["title"] in page.locator("#main-content").inner_text(),
                "Restored song missing from new browser profile Collection")
        # Reload again, independent of the restore-triggered refresh, and
        # verify every main backup section survived source context destruction.
        page.reload(wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        restored=page.evaluate("""() => ({
            session:JSON.parse(localStorage.getItem('aftertone:session:v1')),
            quiz:JSON.parse(localStorage.getItem('aftertone:tune-lab:v1')),
            artists:JSON.parse(localStorage.getItem('aftertone:favorite-artists:v1')),
            playlist:JSON.parse(localStorage.getItem('aftertone:optional-playlist:v1')),
            offsets:JSON.parse(localStorage.getItem('aftertone:lyric-offsets:v1'))
        })""")
        require(restored["session"]["favorites"]==backup["session"]["favorites"] and
                restored["session"]["history"]==backup["session"]["history"] and
                restored["session"]["savedTracks"]==backup["session"]["savedTracks"],
                "Isolated destination lost history, savedTracks or favorites after reload")
        require(restored["quiz"]==backup["quiz"] and
                restored["artists"]==backup["artists"] and
                restored["playlist"]==backup["playlist"] and
                restored["offsets"]==backup["lyricOffsets"],
                "Isolated destination lost Tune Lab, artist, playlist or lyric settings")
        require(not destination_errors,
                "New browser profile JS errors: "+"; ".join(destination_errors))
        print(f"PASS {label}: real download to independent profile, confirmation, full restore after reload")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        target.close()


def check_reflow_reduced_motion(browser, base, width, height):
    """Audit CSS reflow at zoom-equivalent widths with reduced motion enabled.

    Narrow CSS viewports approximate 200% zoom at a larger browser window;
    they do NOT prove literal browser zoom or assistive-technology support.
    """
    context = browser.new_context(
        viewport={"width":width,"height":height},
        reduced_motion="reduce", service_workers="block")
    origin = urlsplit(base).netloc
    context.route("**/*", lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc == origin else route.abort())
    context.route("https://api.deezer.com/**", mock_deezer)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    label = f"reflow-{browser.browser_type.name}-{width}x{height}"
    try:
        require(page.evaluate("true"), "Browser failed to initialize")
        page.goto(base + "/", wait_until="load", timeout=TIMEOUT)
        require(page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),
                "Browser context did not enable reduced-motion preference")
        require(page.evaluate("getComputedStyle(document.documentElement).scrollBehavior === 'auto'"),
                "Marketing page still smooth-scrolls with reduced motion")
        require(page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"),
                f"Marketing page overflows at equivalent zoom width {width}")
        page.locator("#explore-experience").click()
        page.wait_for_url("**/demo/", timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible", timeout=TIMEOUT)
        first_dialog = page.locator('#modal-root [role="dialog"]')
        if first_dialog.count() and first_dialog.is_visible():
            page.keyboard.press("Escape")
            first_dialog.wait_for(state="hidden", timeout=TIMEOUT)
        require(page.evaluate("getComputedStyle(document.documentElement).scrollBehavior === 'auto'"),
                "App still smooth-scrolls with reduced motion")
        require(page.evaluate("""() => {
            const el=document.querySelector('#listening-card');
            const style=getComputedStyle(el);
            const durations=[...style.animationDuration.split(','),
                             ...style.transitionDuration.split(',')];
            return durations.every(value=>{
                value=value.trim();
                const amount=parseFloat(value);
                return !Number.isFinite(amount) ||
                       amount <= (value.endsWith('ms') ? 0.1 : 0.0001);
            });
        }"""),"Listening card animations still run despite reduced-motion preference")
        # CSS scroll rules do not override an explicit JS 'smooth' option.
        # Exercise the real Search for an Artist action with motion reduction.
        page.evaluate("""() => {
            window.__aftertoneScrollLog=[];
            const original=Element.prototype.scrollIntoView;
            Element.prototype.scrollIntoView=function(options) {
                window.__aftertoneScrollLog.push({
                    id:this.id, behavior:options?.behavior
                });
                return original.call(this,options);
            };
        }""")
        page.locator('[data-action="focus-music-search"]').first.click()
        scroll_requests=page.evaluate("window.__aftertoneScrollLog")
        require(any(item["id"]=="music-search" and item["behavior"]=="auto"
                    for item in scroll_requests),
                f"Search jump requested smooth scrolling despite reduced motion: {scroll_requests}")
        for mode, name in (("discover","Discover"),("collection","Collection"),
                           ("taste","Taste Map"),("quiz","Tune Lab"),
                           ("duels","Music Duels"),("challenges","Challenges")):
            nav=page.locator(f'#main-nav button[data-view="{mode}"]')
            nav.click()
            require(page.locator("#main-content").get_attribute("aria-label") == f"{name} section",
                    f"Accessible {mode} landmark missing at {width}px")
            dimensions=page.evaluate("""() => {
                const root=document.documentElement;
                const selectors=['#main-nav', '#theme-menu-toggle',
                                 '#sound-toggle','#help-button'];
                const clipped=selectors.map(selector=>{
                    const el=document.querySelector(selector);
                    if (!el || !el.getClientRects().length) return null;
                    const box=el.getBoundingClientRect();
                    return {selector,left:box.left,right:box.right};
                }).filter(v=>v && (v.left < -2 || v.right > innerWidth+2));
                return {viewport:innerWidth, page:root.scrollWidth, clipped};
            }""")
            require(dimensions["page"] <= dimensions["viewport"] + 2,
                    f"Horizontal document overflow in {mode} at {width}px: {dimensions}")
            require(not dimensions["clipped"],
                    f"Navigation/control clipped at {width}px in {mode}: {dimensions}")
            require(page.locator("#main-content").inner_text().strip(),
                    f"No content in {mode} view at {width}px")
        require(not errors, "JS exceptions in reduced-motion reflow: "+"; ".join(errors))
        print(f"PASS {label}: landing, reduced motion, six-view reflow and accessible navigation")
    except Exception:
        screenshot(page, f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_preview_recovery_keyboard(browser, base):
    """A blocked fixture preview must not strand focus or count a vote."""
    context = browser.new_context(viewport={"width":1024,"height":800},
                                  service_workers="block")
    origin=urlsplit(base).netloc
    requests={"preview":0}
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    def fixture_provider(route):
        if urlsplit(route.request.url).path.startswith("/track/"):
            requests["preview"]+=1
        return mock_deezer(route)
    context.route("https://api.deezer.com/**",fixture_provider)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"preview-focus-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        original=page.locator("#listening-card").get_attribute("aria-label")
        initial=page.evaluate("""() => {
            const state=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:state.favorites||[],history:state.history||[]};
        }""")
        # CDN is intentionally blocked by the route above. Use a real browser
        # media element to exercise the actual recovery state.
        page.locator("#stage-play").click()
        recovery=page.locator("#preview-recovery")
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        first_requests=requests["preview"]
        require(first_requests>0,"Initial preview did not resolve through provider fixture")
        retry=page.get_by_role("button",name="Retry Preview",exact=True)
        retry.focus()
        page.keyboard.press("Enter")
        require(page.evaluate("document.activeElement?.id === 'stage-play'"),
                "Retry hid the focused recovery button without moving focus to Play")
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        require(requests["preview"]>first_requests,
                "Retry reused a stale preview instead of resolving a fresh provider URL")
        require(page.locator("#listening-card").get_attribute("aria-label")==original,
                "Retry unexpectedly changed the listener's current song")
        skip=page.get_by_role("button",name="Skip Without Voting",exact=True)
        skip.focus()
        page.keyboard.press("Enter")
        require(page.evaluate("""() => {
            const focused=document.activeElement;
            return focused?.id==='stage-play' || focused?.id==='main-content';
        }"""),"Neutral skip removed the focused control without restoring focus")
        after=page.evaluate("""() => {
            const state=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:state.favorites||[],history:state.history||[]};
        }""")
        require(after==initial,
                "Failed preview retry/skip created an implicit Keep or Pass")
        require(not errors,"Browser JS exceptions during preview recovery: "+"; ".join(errors))
        print(f"PASS {label}: blocked CDN, fresh retry, focus, neutral skip, no votes")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_choice_keyboard_focus(browser, base):
    """Keep/Pass/Undo must not strand focus on a replaced listening card."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"choice-focus-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        old_id=page.locator("#listening-card").get_attribute("aria-label")
        history_len=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).history.length""")
        require(history_len==0,"Fixture browser did not start with a clean listening history")
        page.evaluate("window.__choiceFocusDocument='no-reload'")

        pass_button=page.locator('#listening-card [data-action="pass"]')
        pass_button.focus()
        page.keyboard.press("Enter")
        page.wait_for_function("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).history.length === 1""",
            timeout=TIMEOUT)
        page.wait_for_function("""() => document.activeElement?.dataset?.action === 'pass'""",
            timeout=TIMEOUT)
        require(page.locator("#listening-card").get_attribute("aria-label")!=old_id,
                "Passing did not advance to the next discovery")
        require(page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).favorites.length""")==0,
            "Pass must not add a favorite")

        undo=page.locator('#listening-card [data-action="undo"]')
        require(undo.is_enabled(),"Undo must become available after a choice")
        undo.focus()
        page.keyboard.press("Enter")
        page.wait_for_function("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).history.length === 0""",
            timeout=TIMEOUT)
        require(page.locator("#listening-card").get_attribute("aria-label")==old_id,
                "Undo did not restore the previous listening card")
        require(page.evaluate("document.activeElement?.id === 'main-content'"),
                "Undo returned focus to a now-disabled decision instead of named main area")

        keep=page.locator('#listening-card [data-action="like"]')
        keep.focus()
        page.keyboard.press("Enter")
        page.wait_for_function("""() => {
            const session=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            return session?.history?.length===1 && session?.favorites?.length===1;
        }""",timeout=TIMEOUT)
        page.wait_for_function("""() => document.activeElement?.dataset?.action === 'like'""",
            timeout=TIMEOUT)
        require(page.evaluate("window.__choiceFocusDocument")=="no-reload",
                "Choice actions unexpectedly reloaded the application")
        require(not errors, "Browser exception during keyboard decision flow: "+"; ".join(errors))
        print(f"PASS {label}: Pass/Undo/Keep preserve keyboard context without reload")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_deezer_preview_quota_recovery(browser, base):
    """A 429 metadata error needs a useful, reversible player message."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    state={"limited":True,"metadata":0}
    errors=[]

    def preview_quota_fixture(route):
        parsed=urlsplit(route.request.url)
        if parsed.path.startswith("/track/"):
            state["metadata"]+=1
            if state["limited"]:
                callback=parse_qs(parsed.query).get("callback",[""])[0]
                require(re.fullmatch(r"__aftertoneDeezer_\d+",callback),
                        "Blocked unexpected provider JSONP callback")
                body={"error":{"code":429,"message":"Synthetic preview quota reached"}}
                route.fulfill(status=200,content_type="application/javascript",
                              body=f"window[{json.dumps(callback)}]({json.dumps(body)});")
                return
        return mock_deezer(route)

    context.route("https://api.deezer.com/**",preview_quota_fixture)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"preview-quota-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        before=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:s.favorites||[],history:s.history||[]};
        }""")
        original=page.locator("#listening-card").get_attribute("aria-label")
        page.locator("#stage-play").click()
        recovery=page.locator("#preview-recovery")
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        require("temporarily limiting requests" in recovery.inner_text() and
                "Wait a moment before Retry Preview" in recovery.inner_text(),
                "Rate-limited Deezer preview lost its actionable recovery explanation")
        require("Deezer requests limited" in page.locator("#audio-status").inner_text(),
                "The playback status must distinguish quota errors from broken audio")
        require(state["metadata"]>=1,"Provider was never asked for preview metadata")

        state["limited"]=False
        prev=state["metadata"]
        page.get_by_role("button",name="Retry Preview",exact=True).click()
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        require(state["metadata"]>prev,
                "Retry did not request a fresh preview link after provider recovery")
        require("temporarily limiting requests" not in recovery.inner_text(),
                "An older rate limit warning persisted after the retry failed for a CDN issue")
        require("This Deezer preview is unavailable" in recovery.inner_text(),
                "Ordinary CDN failure did not restore normal recovery help")
        require(page.locator("#listening-card").get_attribute("aria-label")==original,
                "Retry unexpectedly advanced the listening card")
        after=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:s.favorites||[],history:s.history||[]};
        }""")
        require(before==after,"Quota/retry silently added a favorite or listening vote")
        require(not errors,"Browser exceptions during preview quota recovery: "+"; ".join(errors))
        print(f"PASS {label}: quota help, retry, ordinary CDN error, no false votes")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_deezer_preview_on_demand(browser, base):
    """Viewing tracks or browsing sections must not spend short-lived Deezer links."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    counts={"preview":0}
    errors=[]
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    def track_metadata(route):
        if urlsplit(route.request.url).path.startswith("/track/"):
            counts["preview"]+=1
        return mock_deezer(route)
    context.route("https://api.deezer.com/**",track_metadata)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"on-demand-preview-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        require(counts["preview"]==0,
                "Merely loading the discovery card fetched Deezer preview metadata")
        for section in ("collection","duels","discover"):
            page.locator(f'#main-nav button[data-view="{section}"]').click()
            require(counts["preview"]==0,
                    f"Navigating to {section} triggered unrequested Deezer preview metadata")
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        saved_before=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:s.favorites||[],history:s.history||[]};
        }""")
        page.locator("#stage-play").click()
        page.locator("#preview-recovery").wait_for(state="visible",timeout=TIMEOUT)
        require(counts["preview"]>=1,
                "Explicit Play did not request the current track's Deezer preview metadata")
        saved_after=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:s.favorites||[],history:s.history||[]};
        }""")
        require(saved_after==saved_before,
                "Playing a blocked preview must not alter favorites or choice history")
        require(not errors,"Browser exceptions during on-demand preview: "+"; ".join(errors))
        print(f"PASS {label}: no speculative metadata, Play resolves on demand, no votes")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()


def firefox_main():
    with serve_build() as base, sync_playwright() as playwright:
        browser = playwright.firefox.launch(headless=True)
        try:
            firefox_case(browser, base, 1440, 900)
            firefox_case(browser, base, 390, 844)
            firefox_case(browser, base, 320, 740)
            check_catalog_outage_recovery(browser, base)
            check_backup_restore_cross_browser(browser, base)
            check_backup_transfer_new_profile(browser, base)
            check_reflow_reduced_motion(browser, base, 720, 900)
            check_reflow_reduced_motion(browser, base, 360, 740)
            check_preview_recovery_keyboard(browser, base)
            check_deezer_preview_quota_recovery(browser, base)
            check_deezer_preview_on_demand(browser, base)
            check_choice_keyboard_focus(browser, base)
        finally:
            browser.close()
    print("PASS Firefox compatibility smoke. Live provider playback was not tested.")


def main():
    with serve_build() as base, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            browser_case(browser, base, 1440, 900)
            browser_case(browser, base, 390, 844)
            browser_case(browser, base, 320, 740)
            check_product_deep_links(browser, base)
            check_catalog_outage_recovery(browser, base)
            check_backup_restore_cross_browser(browser, base)
            check_backup_transfer_new_profile(browser, base)
            check_reflow_reduced_motion(browser, base, 720, 900)
            check_reflow_reduced_motion(browser, base, 360, 740)
            check_preview_recovery_keyboard(browser, base)
            check_deezer_preview_quota_recovery(browser, base)
            check_deezer_preview_on_demand(browser, base)
            check_choice_keyboard_focus(browser, base)
        finally:
            browser.close()
    print("PASS all browser checks. Live provider playback was not tested.")

if __name__ == "__main__":
    if "--firefox" in sys.argv:
        firefox_main()
    else:
        main()
