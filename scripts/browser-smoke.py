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
        requested=parsed.path.rsplit("/",1)[-1]
        payload=next((track for track in demo_tracks()
                      if str(track["id"])==requested),
                     {"error":{"code":800,"message":"Unavailable recording"}})
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
        # Retry once while the provider is still unavailable. Keyboard focus
        # must come back to the new enabled Retry button after the card rerenders.
        retry.focus()
        page.keyboard.press("Enter")
        page.wait_for_function("""() => (
            document.querySelector('#main-content .discovery-empty-state') &&
            document.activeElement?.dataset?.action === 'load-more' &&
            !document.activeElement.disabled
        )""",timeout=TIMEOUT)
        require(page.locator("#listening-card").count()==0,
                "An unsuccessful retry must not manufacture a playable track")
        state["online"] = True
        page.keyboard.press("Enter")
        page.locator("#listening-card").wait_for(state="visible", timeout=TIMEOUT)
        page.wait_for_function("() => document.activeElement?.id === 'stage-play'",
                               timeout=TIMEOUT)
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



def check_safe_music_shortcuts(browser, base):
    """Modified/repeated key presses must never create a Keep/Pass or start audio."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    requests={"track":0}
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    def counted_deezer(route):
        if urlsplit(route.request.url).path.startswith("/track/"):
            requests["track"]+=1
        return mock_deezer(route)
    context.route("https://api.deezer.com/**",counted_deezer)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"safe-shortcuts-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.locator("#main-content").focus()
        initial=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            return {blind:s.blind,history:s.history,favorites:s.favorites};
        }""")
        # Use real DOM keyboard events so this checks AFTERTONE's window
        # handler, not whether a browser/OS happens to intercept Ctrl+B.
        page.evaluate("""() => {
            const guarded=[
                {key:'b',code:'KeyB',ctrlKey:true},
                {key:'b',code:'KeyB',metaKey:true},
                {key:'b',code:'KeyB',altKey:true},
                {key:'B',code:'KeyB',shiftKey:true},
                {key:'b',code:'KeyB',repeat:true},
                {key:'ArrowLeft',code:'ArrowLeft',shiftKey:true},
                {key:'ArrowRight',code:'ArrowRight',ctrlKey:true},
                {key:'ArrowRight',code:'ArrowRight',repeat:true},
                {key:' ',code:'Space',repeat:true},
                {key:' ',code:'Space',ctrlKey:true},
                {key:'b',code:'KeyB',isComposing:true}
            ];
            for (const item of guarded)
                window.dispatchEvent(new KeyboardEvent('keydown',
                    {bubbles:true,cancelable:true,...item}));
            const prevented=new KeyboardEvent('keydown',
                {key:'b',code:'KeyB',bubbles:true,cancelable:true});
            prevented.preventDefault();
            window.dispatchEvent(prevented);
        }""")
        page.wait_for_timeout(150)
        after=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            return {blind:s.blind,history:s.history,favorites:s.favorites};
        }""")
        require(after==initial,"Modified/repeated shortcuts changed listening history or blind mode")
        require(requests["track"]==0,
                "A held/modified Space shortcut unexpectedly requested preview playback")

        # Ordinary unmodified shortcuts must still behave normally.
        page.keyboard.press("b")
        require(page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).blind""")!=initial["blind"],
            "Plain B no longer toggles blind mode")
        page.keyboard.press("b")
        require(page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).blind""")==initial["blind"],
            "Plain B did not toggle blind mode back")
        page.keyboard.press("ArrowLeft")
        page.wait_for_function("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).history.length === 1""",
            timeout=TIMEOUT)
        require(page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).history[0].action""")=="pass",
            "Plain left arrow no longer Passes a track")
        page.locator("#main-content").focus()
        page.evaluate("""() => window.dispatchEvent(new KeyboardEvent(
            'keydown',{key:'ArrowLeft',code:'ArrowLeft',repeat:true,
                      bubbles:true,cancelable:true}))""")
        page.wait_for_timeout(260)
        require(page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).history.length""")==1,
            "Holding an arrow rated a second song without another deliberate press")
        require(not errors,"Browser exceptions during shortcut test: "+"; ".join(errors))
        print(f"PASS {label}: modified and held keys ignored, normal B/Pass still work")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_search_draft_survives_rerenders(browser, base):
    """Keep an unfinished search, input focus and caret through app rerenders."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"search-draft-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        field=page.locator("#music-search")
        require(field.is_visible(),"Music search was not available")
        original=page.locator("#listening-card").get_attribute("aria-label")
        draft='An & "Unsubmitted" Artist'
        field.fill(draft)
        field.evaluate("(el) => el.setSelectionRange(3,9,'forward')")
        # A user is still editing search when a separate app event rerenders
        # the listening room. Programmatic click deliberately leaves the input
        # focused, just as a background catalog refresh does.
        page.evaluate("""() => document.querySelector(
            '#main-content [data-action="toggle-blind"]').click()""")
        result=page.evaluate("""() => {
            const el=document.querySelector('#music-search');
            return {value:el?.value,focused:document.activeElement===el,
                    start:el?.selectionStart,end:el?.selectionEnd,
                    direction:el?.selectionDirection,
                    path:document.querySelector('.path-explainer')?.textContent};
        }""")
        require(result["value"]==draft,
                "An app rerender erased an unsubmitted artist search")
        require(result["focused"] and result["start"]==3 and result["end"]==9 and
                result["direction"]=="forward",
                "Rerender lost focused search's caret/selection")
        require("You are searching manually" not in result["path"],
                "The unsubmitted draft unexpectedly changed the active discovery query")
        require(page.locator("#listening-card").get_attribute("aria-label")==original or
                page.locator("#listening-card").get_attribute("aria-label").startswith("Blind listening."),
                "Typing into search unexpectedly changed the discovery card")

        # Navigation may intentionally move focus, but must retain the draft.
        page.locator('#main-nav button[data-view="collection"]').click()
        page.locator('#main-nav button[data-view="discover"]').click()
        field=page.locator("#music-search")
        require(field.input_value()==draft,
                "Switching away and back erased an unsubmitted search")
        field.press("Enter")
        page.wait_for_function("""() =>
            document.querySelector('.path-explainer')?.textContent
                .includes('You are searching manually')""",timeout=TIMEOUT)
        require(field.input_value()==draft,
                "Submitting the preserved search discarded its query")
        require(not errors,"Search draft browser exception: "+"; ".join(errors))
        print(f"PASS {label}: draft, caret, focus, navigation and submit")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()


def check_collection_search_recovery(browser, base):
    """Collection filters must give keyboard users a direct and safe way back."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"collection-search-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.locator('#listening-card [data-action="like"]').click()
        page.wait_for_function("""() => {
            const data=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return data.favorites?.length===1;
        }""",timeout=TIMEOUT)
        page.evaluate("window.__collectionFilterProbe='same-document'")
        page.locator('#main-nav button[data-view="collection"]').click()
        field=page.locator("#collection-search")
        field.wait_for(state="visible",timeout=TIMEOUT)
        field.fill("NoSuchSavedArtistXYZ")
        page.get_by_role("heading",name="No Matches.").wait_for(state="visible",timeout=TIMEOUT)
        require("Showing 0 of 1 saved song" in page.locator(".collection-match-count").inner_text(),
                "Empty collection filtering did not show an accurate match count")
        clear=page.get_by_role("button",name="Show All Saved Songs",exact=True)
        clear.focus()
        page.keyboard.press("Enter")
        require(page.evaluate("document.activeElement?.id === 'collection-search'"),
                "Clearing an empty collection filter failed to return focus to search")
        require(page.locator("#collection-search").input_value()=="",
                "Clear Search did not reset the saved-music filter")
        require(page.locator(".collection-grid .track-tile").count()==1,
                "Clearing an empty filter did not restore the saved song")

        field=page.locator("#collection-search")
        field.fill("Fixture")
        require("Showing 1 of 1 saved song" in page.locator(".collection-match-count").inner_text(),
                "Filtered collection count was incorrect")
        sort=page.locator("#sort-select")
        sort.focus()
        sort.select_option("artist")
        require(page.evaluate("document.activeElement?.id === 'sort-select'"),
                "Changing Collection sort stranded keyboard focus on the old dropdown")
        require(page.locator("#sort-select").input_value()=="artist",
                "Collection sort choice was not preserved after rerender")
        require(page.locator(".collection-grid .track-tile").count()==1,
                "Sorting unexpectedly removed a saved song")
        require(page.evaluate("window.__collectionFilterProbe")=="same-document",
                "Collection search or sorting triggered an unexpected page reload")
        require(page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).favorites.length""")==1,
            "Collection search changed the user's saved favorites")
        require(not errors,"Collection filter browser exception: "+"; ".join(errors))
        print(f"PASS {label}: empty search recovery, counts, sort focus, no lost favorites")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_collection_undo_remove(browser, base):
    """Removing the last favorite can be undone without creating a listening vote."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"collection-undo-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.locator('#listening-card [data-action="like"]').click()
        page.wait_for_function("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')||'{}').favorites?.length===1""",
            timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="collection"]').click()
        first=page.locator('.collection-grid [data-action="remove-favorite"]').first
        first.wait_for(state="visible",timeout=TIMEOUT)
        original=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            return {favorites:s.favorites,history:s.history,savedTracks:s.savedTracks};
        }""")
        page.evaluate("window.__collectionUndoDocument='same-document'")
        first.focus()
        page.keyboard.press("Enter")
        undo=page.get_by_role("button",name="Undo Remove",exact=True)
        undo.wait_for(state="visible",timeout=TIMEOUT)
        require(page.locator(".collection-removal-notice [role='status']").count()==1,
                "Removing a favorite did not present lasting, announced recovery guidance")
        require(page.evaluate("""() =>
            document.activeElement?.dataset?.action==='undo-remove-favorite'"""),
            "Removing a focused song stranded keyboard users on a detached control")
        require(page.get_by_role("heading",name="Nothing Saved Yet.").count()==1,
                "The removed final favorite remained in Collection")
        removed=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            return {favorites:s.favorites,history:s.history,savedTracks:s.savedTracks};
        }""")
        require(removed["favorites"]==[],"Removing a favorite did not persist")
        require(removed["history"]==original["history"] and
                removed["savedTracks"]==original["savedTracks"],
                "Remove deleted listening choices or metadata needed for an undo")

        page.keyboard.press("Enter")
        require(page.locator("#collection-search").count()==1 and
                page.evaluate("document.activeElement?.id === 'collection-search'"),
                "Undo did not return focus to a safe Collection input")
        require(page.locator('.collection-grid .track-tile').count()==1,
                "Undo did not restore the saved song to Collection")
        require(undo.count()==0,"Undo did not clear the pending removal")
        recovered=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            return {favorites:s.favorites,history:s.history,savedTracks:s.savedTracks};
        }""")
        require(recovered==original,
                "Undo changed listening decisions or restored an incomplete favorite")
        require(page.evaluate("window.__collectionUndoDocument")=="same-document",
                "Removing or restoring a saved song reloaded the page")
        page.reload(wait_until="load",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="collection"]').click()
        require(page.locator('.collection-grid .track-tile').count()==1,
                "Restored favorite was lost after a browser reload")
        require(page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).favorites.length""")==1,
            "Restored favorite did not persist in local storage")
        require(not errors,"Collection Undo browser exception: "+"; ".join(errors))
        print(f"PASS {label}: remove final favorite, Undo, focus, history, reload")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_cancel_stale_discovery(browser, base):
    """Changing a search invalidates the old JSONP script and its callback."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    delayed=[]
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())

    def hold_obsolete_artist_lookup(route):
        url=urlsplit(route.request.url)
        query=parse_qs(url.query)
        if url.path=="/search/artist" and query.get("q")==["Canceled Artist"]:
            # Deliberately leave the provider request unresolved. The browser
            # must remove its JSONP script without needing a provider response.
            delayed.append(route)
            return
        mock_deezer(route)

    context.route("https://api.deezer.com/**",hold_obsolete_artist_lookup)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"stale-discovery-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.evaluate("window.__staleDiscoveryDocument='same-document'")
        field=page.locator("#music-search")
        field.fill("Canceled Artist")
        field.press("Enter")
        page.wait_for_function("""() => [...document.querySelectorAll('script[src]')]
            .some(script=>script.src.includes('/search/artist') &&
                          script.src.includes('Canceled'))""",timeout=TIMEOUT)
        for _ in range(30):
            if delayed:
                break
            page.wait_for_timeout(30)
        require(len(delayed)==1,"The first artist query did not remain pending")
        callback=parse_qs(urlsplit(delayed[0].request.url).query).get("callback",[""])[0]
        require(re.fullmatch(r"__aftertoneDeezer_\d+",callback),
                "Provider callback was not the generated JSONP name")
        require(page.evaluate("(cb) => typeof window[cb]==='function'",callback),
                "The first request was not waiting on an active callback")

        # Submit another query while the old provider is still unresponsive.
        # The latest query should finish and remain the only active discovery.
        field=page.locator("#music-search")
        field.fill("Fixture Melody")
        field.press("Enter")
        page.locator("#stage-play").wait_for(state="visible",timeout=TIMEOUT)
        require(page.evaluate("(cb) => typeof window[cb]==='function'",callback),
                "Canceled JSONP must retain a short-lived inert callback for late scripts")
        page.evaluate("(cb) => window[cb]({data:[{id:99999999,title:'Late stale result'}]})",callback)
        require(page.locator("#music-search").input_value()=="Fixture Melody",
                "Late JSONP unexpectedly replaced the current search")
        require(page.evaluate("""(cb) => ![...document.querySelectorAll('script[src]')]
            .some(script=>script.src.includes(cb))""",callback),
                "Obsolete JSONP script remained in the document after cancellation")
        require(page.locator("#music-search").input_value()=="Fixture Melody",
                "A stale artist request replaced the listener's newer search")
        require(page.evaluate("""() => document.querySelector('.path-explainer')
            ?.textContent.includes('You are searching manually')"""),
                "The new search lost its committed query")
        require(page.evaluate("""() => {
            const data=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return (data.history||[]).length===0 && (data.favorites||[]).length===0;
        }"""),"An obsolete search created listening votes or favorites")

        page.locator('.discovery-paths [data-path="explore"]').click()
        require(page.locator('.discovery-paths [data-path="explore"]').get_attribute("aria-pressed")=="true",
                "Switching away from the search did not select Wild Card")
        require(page.locator("#music-search").input_value()=="",
                "A new listening path failed to close the temporary artist search")
        require(page.evaluate("(cb) => typeof window[cb]==='function'",callback),
                "Canceled JSONP tombstone expired before late script protection was checked")
        require(page.evaluate("window.__staleDiscoveryDocument")=="same-document",
                "Switching searches or listening paths unexpectedly reloaded the page")
        require(not errors,"Stale discovery browser exception: "+"; ".join(errors))
        print(f"PASS {label}: old provider request canceled, new search and path intact")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_artist_outage_without_fallback(browser, base):
    """A broken artist index must not trigger a second provider search."""
    context=browser.new_context(viewport={"width":1024,"height":800},
                                service_workers="block")
    origin=urlsplit(base).netloc
    state={"online":False,"failed_lookup":0,"ranked_fallback":0}
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())

    def artist_index_outage(route):
        url=urlsplit(route.request.url)
        query=parse_qs(url.query)
        if not state["online"] and query.get("q")==["Unavailable Artist"]:
            if url.path=="/search/artist":
                callback=query.get("callback",[""])[0]
                require(re.fullmatch(r"__aftertoneDeezer_\d+",callback),
                        "The failing lookup did not use safe generated JSONP")
                state["failed_lookup"]+=1
                body={"error":{"code":503,"message":"Catalog fixture temporarily unavailable"}}
                return route.fulfill(status=200,content_type="application/javascript",
                    body=f"window[{json.dumps(callback)}]({json.dumps(body)});")
            if url.path=="/search":
                state["ranked_fallback"]+=1
        mock_deezer(route)

    context.route("https://api.deezer.com/**",artist_index_outage)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"artist-outage-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.evaluate("window.__artistOutageDocument='same-document'")
        field=page.locator("#music-search")
        field.fill("Unavailable Artist")
        field.press("Enter")
        page.get_by_role("heading",name="Music Is Temporarily Unavailable").wait_for(
            state="visible",timeout=TIMEOUT)
        empty=page.locator(".discovery-empty-state")
        require("Catalog fixture temporarily unavailable" in empty.inner_text(),
                "A provider error was obscured by a fallback response")
        require(state["failed_lookup"]==1 and state["ranked_fallback"]==0,
                "Artist lookup outage incorrectly launched a second ranked search")
        require(page.locator("#listening-card").count()==0,
                "Failed lookup fabricated a playable recommendation")
        before=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:s.favorites||[],history:s.history||[]};
        }""")
        state["online"]=True
        retry=page.get_by_role("button",name="Retry Discovery",exact=True)
        retry.focus()
        page.keyboard.press("Enter")
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        require("Fixture Melody" in page.locator("#listening-card").inner_text(),
                "Retry after provider recovery did not present fixture songs")
        require(page.evaluate("window.__artistOutageDocument")=="same-document",
                "Retrying after artist index outage reloaded the entire app")
        after=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {favorites:s.favorites||[],history:s.history||[]};
        }""")
        require(after==before,"Artist outage/recovery modified favorites or listening votes")
        require(not errors,"Artist outage browser exceptions: "+"; ".join(errors))
        print(f"PASS {label}: no amplified lookup, honest retry, no lost user progress")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_mobile_filters_keyboard(browser, base, width):
    """The mobile filter drawer is closable, focus-safe, and never hides results."""
    context=browser.new_context(viewport={"width":width,"height":740},
                                service_workers="block")
    origin=urlsplit(base).netloc
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"mobile-filters-{browser.browser_type.name}-{width}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.evaluate("window.__mobileFiltersDocument='same-document'")
        toggle=page.locator("#mobile-refine-toggle")
        require(toggle.get_attribute("aria-controls")=="sidebar-preferences",
                "Mobile Filters toggle does not name its controlled region")
        toggle.focus()
        page.keyboard.press("Enter")
        panel=page.locator("#sidebar-preferences")
        close_filters=page.get_by_role("button",name="Close discovery filters")
        require(panel.is_visible() and toggle.get_attribute("aria-expanded")=="true",
                "Mobile Filters button did not open the visible settings region")
        require(page.evaluate("""() => document.activeElement?.dataset?.action ===
            'close-mobile-filters'"""),
                "Opening Filters did not focus a visible keyboard-safe close action")
        rect=close_filters.bounding_box()
        require(rect is not None and rect["width"]>=43.5 and rect["height"]>=43.5,
                "Phone Filters close control is not a 44px touch target")

        page.keyboard.press("Escape")
        require(not panel.is_visible() and toggle.get_attribute("aria-expanded")=="false",
                "Escape failed to close mobile Filters or reset aria-expanded")
        require(page.evaluate("document.activeElement?.id==='mobile-refine-toggle'"),
                "Escape failed to restore focus to the Filters opener")

        toggle.click()
        selected=page.locator("#genre-select")
        selected.focus()
        selected.select_option("pop")
        require(page.evaluate("document.activeElement?.id==='genre-select'"),
                "Rerendering a mobile filter stranded focus on a removed select")
        require(page.locator("#genre-select").input_value()=="pop",
                "Changing the mobile genre was not retained after rerender")
        # The fictional chart and search fixtures reuse song IDs. Reset to
        # All genres before searching so an already cached chart track's
        # original unknown genre isn't incorrectly treated as a pop result.
        page.locator("#genre-select").select_option("all")
        require(page.evaluate("document.activeElement?.id==='genre-select'"),
                "Restoring All genres lost focus on the selected filter")

        close_filters=page.get_by_role("button",name="Close discovery filters")
        close_filters.click()
        require(not panel.is_visible() and toggle.get_attribute("aria-expanded")=="false",
                "Done failed to close the Filters panel")
        require(page.evaluate("document.activeElement?.id==='mobile-refine-toggle'"),
                "Done did not return keyboard focus to Filters opener")

        toggle.click()
        field=page.locator("#music-search")
        field.fill("Fixture Melody")
        field.press("Enter")
        require(not panel.is_visible() and toggle.get_attribute("aria-expanded")=="false",
                "Search submission left mobile Filters covering the results")
        require(page.evaluate("document.activeElement?.id==='main-content'"),
                "Submitting a mobile search failed to dismiss keyboard focus from the drawer")
        page.locator("#stage-play").wait_for(state="visible",timeout=TIMEOUT)
        require("Fixture Melody" in page.locator("#listening-card").inner_text(),
                "After closing Filters the new music search was not displayed")
        require(page.locator("#music-search").input_value()=="Fixture Melody",
                "Search submission lost its committed text")

        toggle.click()
        page.locator('#main-nav button[data-view="collection"]').click()
        require(not panel.is_visible() and toggle.get_attribute("aria-expanded")=="false",
                "Navigation away left a hidden Filters drawer marked expanded")
        require(page.evaluate("document.activeElement?.id==='main-content'"),
                "Navigation away from the mobile drawer lost main section focus")
        require(page.evaluate("window.__mobileFiltersDocument")=="same-document",
                "Mobile filter actions unexpectedly reloaded the page")
        require(page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return (s.favorites||[]).length===0 && (s.history||[]).length===0;
        }"""),"Mobile filter interactions fabricated listening votes or favorites")
        require(page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),
                "Mobile Filters caused horizontal document overflow")
        require(not errors,"Mobile Filters JavaScript exception: "+"; ".join(errors))
        print(f"PASS {label}: open, Escape, Done, filter focus, search, navigation")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_swipe_pointer_safety(browser, base, width):
    """Primary swipes count once; vertical, canceled and secondary drags never vote."""
    context=browser.new_context(viewport={"width":width,"height":740},
                                service_workers="block")
    origin=urlsplit(base).netloc
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"swipe-pointer-{browser.browser_type.name}-{width}"

    def progress():
        return page.evaluate("""() => {
            const state=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {history:state.history||[],favorites:state.favorites||[]};
        }""")

    def anchor(from_right=False):
        card=page.locator("#listening-card")
        card.scroll_into_view_if_needed(timeout=TIMEOUT)
        # After a neutral drag, CSS briefly animates the card back to rest.
        # Probe the actual element under several well-inset points instead of
        # blindly clicking a stale box edge during that transition.
        found=page.evaluate("""(fromRight) => {
          const card=document.querySelector('#listening-card');
          const r=card.getBoundingClientRect();
          const xs=fromRight?[r.right-45,r.right-65,r.right-30]:
                              [r.left+45,r.left+65,r.left+30];
          const ys=[r.top+85,r.top+115,r.top+180,r.top+240,r.top+45];
          for(const y of ys) {
            if(y<35 || y>innerHeight-95)continue;
            for(const x of xs) {
              if(x<5 || x>innerWidth-5)continue;
              const hit=document.elementFromPoint(x,y);
              if(card.contains(hit) &&
                 !hit?.closest('button,input,select,textarea,a,label,img,[draggable]'))
                return {x,y,box:{x:r.left,y:r.top,width:r.width,height:r.height}};
            }
          }
          return null;
        }""",from_right)
        require(found is not None,
                "Could not locate an unobstructed card swipe origin at phone width")
        return found["x"],found["y"],found["box"]

    def drag(dx,dy,button="left",release_outside=False):
        x,y,box=anchor(from_right=dx<0)
        page.mouse.move(x,y)
        page.mouse.down(button=button)
        if release_outside:
            endx=box["x"]+box["width"]+6
            require(endx<width,"The pointer release target is outside the phone viewport")
            page.mouse.move(endx,y,steps=8)
        else:
            page.mouse.move(x+dx,y+dy,steps=8)
        page.mouse.up(button=button)

    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():
            close.first.click(timeout=TIMEOUT)
        page.evaluate("window.__swipePointerDocument='same-document'")
        before=progress()
        require(not before["history"] and not before["favorites"],
                "New swipe test profile must not contain saved votes")

        drag(135,0,button="right")
        page.keyboard.press("Escape")
        require(progress()==before,"Right-button drag recorded a listening vote")
        require(not page.locator("#listening-card").evaluate(
            "(card)=>card.classList.contains('dragging')"),
            "Right-button drag left the listening card in a drag state")

        page.evaluate("""() => {
            const target=document.querySelector('#listening-card .record-visual');
            for(const [type,x] of [['pointerdown',100],['pointermove',280],['pointerup',280]]) {
              target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:86,
                pointerType:'touch',button:0,isPrimary:false,clientX:x,clientY:185}));
            }
        }""")
        require(progress()==before,"Secondary touch pointer recorded a vote")

        # A second finger outside the card must invalidate a drag already
        # captured by the first pointer, even if the first pointer later lifts.
        x,y,_=anchor()
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(x+105,y,steps=6)
        require(page.locator("#listening-card").evaluate(
            "(card)=>card.classList.contains('dragging')"),
            "Primary swipe was not active before a second touch")
        page.evaluate("""() => {
            document.body.dispatchEvent(new PointerEvent('pointerdown',{
              bubbles:true,pointerId:87,pointerType:'touch',button:0,
              isPrimary:false,clientX:8,clientY:8
            }));
        }""")
        require(page.locator("#listening-card").evaluate(
            "(card)=>!card.classList.contains('dragging') && !card.style.transform"),
            "Second contact failed to cancel the active swipe")
        page.mouse.up()
        require(progress()==before,"Original pointer voted after a second finger arrived")

        drag(44,162)
        require(progress()==before,"Mostly vertical motion was counted as a swipe")
        require(not page.locator("#listening-card").evaluate(
            "(card)=>card.classList.contains('dragging') || Boolean(card.style.transform)"),
            "Vertical scroll gesture left stale swipe animation")
        drag(59,0)
        require(progress()==before,"Below-threshold horizontal drag rated a song")

        # Cancel a genuine, primary mouse drag by simulating a browser pointer
        # cancellation (as happens when the OS takes over touch scrolling).
        x,y,_=anchor()
        page.evaluate("""() => {
            document.addEventListener('pointerdown',event=>{
              window.__swipePointerId=event.pointerId;
            },{capture:true,once:true});
        }""")
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(x+105,y,steps=6)
        require(page.locator("#listening-card").evaluate(
            "(card)=>card.classList.contains('dragging')"),
            "A deliberate horizontal drag did not show feedback")
        page.evaluate("""() => {
            const card=document.querySelector('#listening-card');
            card.dispatchEvent(new PointerEvent('pointercancel',{
                bubbles:true,pointerId:window.__swipePointerId,isPrimary:true,button:0}));
        }""")
        page.mouse.up()
        require(progress()==before,"Canceled drag recorded a listening vote")
        require(page.locator("#listening-card").evaluate(
            "(card)=>!card.classList.contains('dragging') && !card.style.transform"),
            "Pointer cancellation left a transformed card")

        # Pointer capture keeps the release reliable even just outside the
        # card's right edge, while still counting exactly one intentional Keep.
        drag(0,0,release_outside=True)
        page.wait_for_function("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return (s.history||[]).length===1;
        }""",timeout=TIMEOUT)
        liked=progress()
        require(liked["history"][0]["action"]=="like" and len(liked["favorites"])==1,
                "A deliberate right swipe did not keep exactly one song")
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)

        drag(-140,0)
        page.wait_for_function("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return (s.history||[]).length===2;
        }""",timeout=TIMEOUT)
        passed=progress()
        require(passed["history"][-1]["action"]=="pass" and
                passed["favorites"]==liked["favorites"],
                "Left swipe did not Pass exactly once without deleting a favorite")

        # A view transition during an active drag removes its original card.
        # The later pointerup must not vote for the now-current/previous track.
        x,y,_=anchor()
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(x+120,y,steps=6)
        page.evaluate("""() => document.querySelector(
            '#main-nav button[data-view="collection"]').click()""")
        page.mouse.up()
        require(progress()==passed,"Replaced card's delayed pointerup recorded a vote")
        require(page.locator("#main-content").get_attribute("aria-label")=="Collection section",
                "Navigation during drag failed to show Collection")
        require(page.evaluate("window.__swipePointerDocument")=="same-document",
                "Swipe gesture or view change reloaded the document")
        require(not errors,"Swipe browser exception: "+"; ".join(errors))
        print(f"PASS {label}: primary pointer capture, neutral cancels and exact Keep/Pass")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()


def check_playlist_dialog_cancellation(browser, base):
    """An abandoned import must not affect a later reopened playlist dialog."""
    context=browser.new_context(viewport={"width":1440,"height":900},service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error: errors.append(str(error)))
    origin=urlsplit(base).netloc
    pending=[]
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())

    def fixture(route):
        parsed=urlsplit(route.request.url)
        path=parsed.path
        cb=parse_qs(parsed.query).get("callback",[""])[0]
        if path=="/playlist/54321":
            # Leave this request unanswered. Closing its dialog must abort the
            # corresponding JSONP callback and remove the script tag.
            pending.append(route)
            return
        if path=="/playlist/67890":
            payload={"title":"New fixture playlist","nb_tracks":1}
        elif path=="/playlist/67890/tracks":
            payload={"data":[{"title":"Fixture Quiet Song",
                               "artist":{"name":"Fixture New Artist"}}]}
        else:
            return mock_deezer(route)
        route.fulfill(status=200,content_type="application/javascript",
                      body=f"window[{json.dumps(cb)}]({json.dumps(payload)});")

    context.route("https://api.deezer.com/**",fixture)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        intro=page.locator('#modal-root button[data-modal="close"]')
        if intro.count(): intro.first.click()
        page.locator('[data-action="import-playlist"]').click()
        page.locator('#playlist-link').fill('https://www.deezer.com/playlist/54321')
        page.locator('[data-modal="playlist-link-import"]').click()
        page.wait_for_function("""() => [...document.scripts].some(script =>
            script.src.includes('/playlist/54321?'))""",timeout=TIMEOUT)
        old_callback=page.evaluate("""() => {
            const script=[...document.scripts].find(s=>s.src.includes('/playlist/54321?'));
            return new URL(script.src).searchParams.get('callback');
        }""")
        require(len(pending)==1,"First metadata request did not reach the fixture")
        page.keyboard.press("Escape")
        page.locator('#modal-root [role="dialog"]').wait_for(state="hidden",timeout=TIMEOUT)
        require(page.evaluate("""() => ![...document.scripts].some(
            script=>script.src.includes('/playlist/54321?'))"""),
            "Closing the playlist dialog did not remove its pending JSONP script")
        require(page.evaluate("(cb) => typeof window[cb] === 'function'",old_callback),
                "Canceled JSONP callback lost its bounded late-response tombstone")
        page.evaluate("""(cb) => window[cb]({
            title:'Old fixture playlist',nb_tracks:1
        })""",old_callback)
        require(page.evaluate("""() => !localStorage.getItem(
            'aftertone:optional-playlist:v1')"""),
            "Abandoned playlist unexpectedly wrote saved songs")

        # Opening the same *kind* of dialog is not permission for the earlier
        # async request to update or close this new instance.
        page.locator('[data-action="import-playlist"]').click()
        page.locator('#playlist-link').fill('https://www.deezer.com/playlist/67890')
        page.locator('[data-modal="playlist-link-import"]').click()
        page.wait_for_function("""() => {
            const p=JSON.parse(localStorage.getItem('aftertone:optional-playlist:v1')||'null');
            return (p?.tracks||[]).some(t=>t.title==='Fixture Quiet Song');
        }""",timeout=TIMEOUT)
        saved=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:optional-playlist:v1')||'null')""")
        require(len(saved["tracks"])==1 and
                saved["tracks"][0]["artist"]=="Fixture New Artist",
                "Fresh playlist was overwritten or mixed with stale metadata")
        require(page.locator('#modal-root [role="dialog"]').count()==0,
                "Successful import should close its own dialog")
        require(not errors,"Playlist cancellation caused browser errors: "+"; ".join(errors))
        print("PASS playlist dialog cancellation, stale JSONP isolation and reimport")
    except Exception:
        screenshot(page,"FAILED-playlist-dialog-cancellation")
        raise
    finally:
        context.close()


def check_stale_related_profile_cancellation(browser, base):
    """Changing artist personalization must abort old related-graph JSONP."""
    context=browser.new_context(viewport={"width":1440,"height":900},service_workers="block")
    page=context.new_page()
    errors=[]
    pending=[]
    artist="Fixture Stale Seed Artist"
    page.on("pageerror",lambda error: errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())

    def provider(route):
        parsed=urlsplit(route.request.url)
        if parsed.path=="/search/artist" and parse_qs(parsed.query).get("q",[""])[0]==artist:
            pending.append(route)
            return
        return mock_deezer(route)

    context.route("https://api.deezer.com/**",provider)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        page.locator('#intro-artist-0').fill(artist)
        page.locator('#modal-root [data-modal="onboarding-artists"]').click()
        page.wait_for_function("""(artist) => [...document.scripts].some(script => {
            const url=new URL(script.src);
            return url.pathname==='/search/artist' &&
                url.searchParams.get('q')===artist;
        })""",arg=artist,timeout=TIMEOUT)
        callbacks=page.evaluate("""(artist) => [...document.scripts].filter(script => {
            const url=new URL(script.src);
            return url.pathname==='/search/artist' &&
                url.searchParams.get('q')===artist;
        }).map(script=>new URL(script.src).searchParams.get('callback'))""",artist)
        require(callbacks,"Seeded lookup was not pending before exiting personalization")
        page.locator('[data-action="fresh-discovery"]').first.click()
        page.wait_for_function("""(artist) => ![...document.scripts].some(script=>{
            const url=new URL(script.src);
            return url.pathname==='/search/artist' &&
                url.searchParams.get('q')===artist;
        })""",arg=artist,timeout=TIMEOUT)
        for callback in callbacks:
            require(page.evaluate("(name) => typeof window[name] === 'function'",callback),
                    "Canceled related lookup lost its bounded inert callback")
            page.evaluate("""(name) => window[name]({
                data:[{id:99999,name:'Obsolete Fixture Neighbor'}]
            })""",callback)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        require(page.locator('[data-action="fresh-discovery"]').count()==0,
                "A stale seed was still active after returning to fresh discovery")
        state=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')||'{}')""")
        require(not state.get("history") and not state.get("favorites"),
                "Canceled background artist lookup recorded a listening decision")
        require(not errors,"Related-profile cancellation caused JS errors: "+"; ".join(errors))
        print("PASS related graph seed switch aborts old lookups without votes")
    except Exception:
        screenshot(page,"FAILED-related-profile-cancellation")
        raise
    finally:
        context.close()


def check_theme_dialog_focus(browser, base):
    """Theme changes must preserve modal focus, unlike the header palette."""
    context=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error: errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        first=page.locator('#modal-root button[data-modal="close"]')
        if first.count(): first.first.click()

        # This dialog is opened from Help, not from the header palette. The
        # original Help button should regain focus only when the dialog closes.
        page.locator("#help-button").click()
        page.locator('#modal-root button[data-modal="themes"]').click()
        dialog=page.locator('#modal-root [role="dialog"]')
        dialog.wait_for(state="visible",timeout=TIMEOUT)
        for theme in ["aurora","plum"]:
            tile=page.locator(f'#modal-root [data-set-theme="{theme}"]')
            tile.focus()
            page.keyboard.press("Enter")
            require(page.evaluate("""(name) => {
                const active=document.activeElement;
                const dialog=document.querySelector('#modal-root [role="dialog"]');
                return dialog?.contains(active) &&
                    active?.dataset.setTheme===name &&
                    active.getAttribute('aria-pressed')==='true' &&
                    document.body.dataset.theme===name;
            }""",theme),
                f"Choosing {theme} moved focus outside the appearance dialog")
            require(dialog.is_visible(),"Changing a theme unexpectedly closed its dialog")
        page.keyboard.press("Tab")
        require(page.evaluate("""() => document.querySelector(
            '#modal-root [role="dialog"]')?.contains(document.activeElement)"""),
            "Tab escaped the still-open theme dialog after changing colors")
        page.keyboard.press("Escape")
        dialog.wait_for(state="hidden",timeout=TIMEOUT)
        require(page.evaluate("document.activeElement?.id==='help-button'"),
                "Closing appearance dialog failed to restore its Help opener")

        # The header palette is not modal: choosing its swatch should close it
        # and put focus back on the header toggle, preserving old behavior.
        page.locator("#theme-menu-toggle").click()
        page.locator('#theme-menu [data-set-theme="forest"]').click()
        require(page.locator("#theme-menu-toggle").get_attribute("aria-expanded")=="false",
                "Header palette did not collapse after selecting its color")
        require(page.evaluate("document.activeElement?.id==='theme-menu-toggle'"),
                "Header palette did not restore focus after changing its color")
        require(page.evaluate("document.body.dataset.theme==='forest'"),
                "Header palette theme choice was not applied")
        require(not errors,"Theme focus browser exceptions: "+"; ".join(errors))
        print("PASS theme-dialog focus, Escape restoration and header palette behavior")
    except Exception:
        screenshot(page,"FAILED-theme-dialog-focus")
        raise
    finally:
        context.close()


def check_optional_lyrics_request_cancellation(browser, base):
    """Canceled LRCLIB lookups must stop without poisoning fresh fixture results."""
    context=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error: errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        onboarding=page.locator('#modal-root button[data-modal="close"]')
        if onboarding.count(): onboarding.first.click()
        # Fixture intercepts only the optional external lyric lookup; no real
        # third-party words, recordings, or provider calls are requested.
        page.evaluate("""() => {
            window.__fixtureLyricFetches=[];
            const actual=window.fetch.bind(window);
            window.fetch=(input,options={})=>{
                const href=typeof input==='string'?input:input.url;
                if(!String(href).startsWith('https://lrclib.net/api/get'))
                    return actual(input,options);
                const request={href,aborted:false};
                window.__fixtureLyricFetches.push(request);
                return new Promise((resolve,reject)=>{
                    const onAbort=()=>{
                        request.aborted=true;
                        reject(new DOMException('Fixture request aborted','AbortError'));
                    };
                    request.complete=()=>{
                        options.signal?.removeEventListener('abort',onAbort);
                        const url=new URL(href);
                        resolve(new Response(JSON.stringify({
                            artistName:url.searchParams.get('artist_name'),
                            trackName:url.searchParams.get('track_name'),
                            duration:205,
                            syncedLyrics:'[00:01.00] Entirely fictional test words'
                        }),{status:200,headers:{'content-type':'application/json'}}));
                    };
                    if(options.signal?.aborted) onAbort();
                    else options.signal?.addEventListener('abort',onAbort,{once:true});
                });
            };
        }""")
        page.locator('[data-action="lyrics-toggle"]').click()
        page.wait_for_function("() => window.__fixtureLyricFetches.length>=1",timeout=TIMEOUT)
        page.locator('#listening-card [data-action="pass"]').click()
        page.wait_for_function("() => window.__fixtureLyricFetches.length>=2",timeout=TIMEOUT)
        require(page.evaluate("() => window.__fixtureLyricFetches[0].aborted"),
                "Changing tracks left the old external lyrics fetch running")
        # Lyrics Off must stop the second request without publishing its error.
        page.locator('[data-action="lyrics-toggle"]').click()
        require(page.evaluate("() => window.__fixtureLyricFetches[1].aborted"),
                "Disabling lyrics failed to abort the current lookup")
        require(page.locator('#live-lyrics').is_hidden(),
                "Turning off optional lyrics left the panel visible")
        page.locator('[data-action="lyrics-toggle"]').click()
        page.wait_for_function("() => window.__fixtureLyricFetches.length>=3",timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="collection"]').click()
        require(page.evaluate("() => window.__fixtureLyricFetches[2].aborted"),
                "Leaving Discover left a lyrics fetch active")
        page.locator('#main-nav button[data-view="discover"]').click()
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        page.wait_for_function("() => window.__fixtureLyricFetches.length>=4",timeout=TIMEOUT)
        page.evaluate("() => window.__fixtureLyricFetches[3].complete()")
        page.wait_for_function("""() =>
            document.querySelector('#lyric-align')?.hidden===false &&
            document.querySelector('#live-lyrics')?.hidden===false
        """,timeout=TIMEOUT)
        require(page.evaluate("() => window.__fixtureLyricFetches.length===4"),
                "Fresh lyric recovery started unexpected extra requests")
        state=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')||'{}')""")
        require(len(state.get("history",[]))==1 and
                state["history"][0]["action"]=="pass",
                "Background lyrics created a false listening vote")
        require(not errors,"Lyrics cancellation browser exceptions: "+"; ".join(errors))
        print("PASS timed lyrics cancellation on song, toggle and view changes")
    except Exception:
        screenshot(page,"FAILED-lyrics-cancellation")
        raise
    finally:
        context.close()


def check_listening_control_focus_on_rerender(browser, base):
    """Keep keyboard focus on the same recording, never on a changed page."""
    context=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error: errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    def fake_lyrics(route):
        cors={"Access-Control-Allow-Origin":"*",
              "Access-Control-Allow-Methods":"GET, OPTIONS",
              "Access-Control-Allow-Headers":"Accept, Lrclib-Client"}
        if route.request.method=="OPTIONS":
            route.fulfill(status=204,headers=cors)
            return
        params=parse_qs(urlsplit(route.request.url).query)
        route.fulfill(status=200,content_type="application/json",headers=cors,
                      body=json.dumps({
            "artistName":params.get("artist_name",[""])[0],
            "trackName":params.get("track_name",[""])[0],
            "duration":208,
            "syncedLyrics":"[00:01.00] Entirely fictional words for a browser test"
        }))
    context.route("https://lrclib.net/**",fake_lyrics)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        card=page.locator("#listening-card")
        # Only inspect already-visible, non-blind metadata. Never add the
        # current recording ID to DOM attributes: it may expose the answer.
        original_title=card.locator(".track-identity h2").inner_text()
        require(original_title,"No visible song title for focus test")
        require(card.get_attribute("data-track-id") is None,
                "Private song identity leaked into the HTML")
        page.evaluate("window.__focusProbe='same-document'")
        def redraw():
            # Programmatic selection triggers a normal render without moving
            # browser focus, like a background catalog-refresh callback.
            page.evaluate("""() => document.querySelector(
                '#listening-card [data-action="toggle-blind"]').click()""")
        volume=page.locator("#preview-volume")
        volume.focus()
        initial=int(volume.input_value())
        redraw()
        require(page.evaluate("document.activeElement?.id==='preview-volume'"),
                "A same-track refresh stranded focus on the volume slider")
        require(card.get_attribute("data-track-id") is None,
                "Blind-mode rerender exposed the current recording ID")
        page.keyboard.press("ArrowUp")
        after=int(page.locator("#preview-volume").input_value())
        require(after==initial+1,
                "Slider ArrowUp stopped adjusting volume after a card refresh")
        require(page.evaluate("() => JSON.parse(localStorage.getItem('aftertone:session:v1')).volume")==after,
                "Rerendered volume did not persist to the listener's preferences")

        page.locator("#stage-play").focus()
        redraw()
        require(page.evaluate("document.activeElement?.id==='stage-play'"),
                "Play lost its focused control during a same-track refresh")
        require(card.locator(".track-identity h2").inner_text()==original_title,
                "A same-track redraw unexpectedly changed the visible song")

        page.locator('#listening-card [data-action="lyrics-toggle"]').focus()
        redraw()
        require(page.evaluate("document.activeElement?.dataset.action==='lyrics-toggle'"),
                "Lyrics toggle lost focus on a same-track refresh")
        page.locator('#listening-card [data-action="lyrics-toggle"]').click()
        page.locator("#lyrics-offset").wait_for(state="visible",timeout=TIMEOUT)
        offset=page.locator("#lyrics-offset")
        offset.focus()
        page.keyboard.press("ArrowRight")
        new_offset=int(offset.input_value())
        redraw()
        require(page.evaluate("document.activeElement?.id==='lyrics-offset'"),
                "Visible lyric offset slider lost focus during a refresh")
        require(int(page.locator("#lyrics-offset").input_value())==new_offset,
                "A same-track refresh reset the preview's calibrated timing")

        page.locator('#main-nav button[data-view="collection"]').click()
        require(page.evaluate("document.activeElement?.id==='main-content'"),
                "Deliberate navigation failed to focus the new named main area")
        require(page.evaluate("window.__focusProbe")=="same-document",
                "Control refresh triggered a page navigation/reload")
        state=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')||'{}')""")
        require(not state.get("history") and not state.get("favorites"),
                "Keyboard arrows on sliders accidentally recorded a listening vote")
        require(not errors,"Listening focus browser errors: "+"; ".join(errors))
        print("PASS listening card same-track focus and slider keyboard continuity")
    except Exception:
        screenshot(page,"FAILED-listening-control-focus")
        raise
    finally:
        context.close()


def check_collection_csv_formula_safety(browser, base):
    """Real Collection downloads must render untrusted metadata as inert CSV text."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                accept_downloads=True,service_workers="block")
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        first=page.locator('#modal-root button[data-modal="close"]')
        if first.count():first.first.click(timeout=TIMEOUT)
        # Insert hostile-looking *fictional* metadata through normal browser
        # persistence. These strings are never evaluated or opened by a sheet.
        title='=HYPERLINK("https://fixture.invalid","Listen")'
        artist='\t+Pretend Artist'
        page.evaluate("""(unsafe) => {
            const current=JSON.parse(localStorage.getItem('aftertone:session:v1'));
            current.favorites=['deezer:91239991'];
            current.savedTracks=[{
                id:'deezer:91239991',title:unsafe.title,artist:unsafe.artist,
                genre:'jazz',mood:'Fresh',source:'deezer',link:'https://fixture.invalid/song'
            }];
            current.history=[];
            localStorage.setItem('aftertone:session:v1',JSON.stringify(current));
        }""",{"title":title,"artist":artist})
        page.reload(wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="collection"]').click()
        page.locator(".collection-grid .track-tile").wait_for(state="visible",timeout=TIMEOUT)
        require(title in page.locator(".collection-grid").inner_text(),
                "Collection changed the original untrusted song metadata")
        page.evaluate("window.__csvExportProbe='same-document'")
        with page.expect_download(timeout=TIMEOUT) as exported:
            page.locator('[data-action="export-csv"]').click()
        download=exported.value
        require(download.suggested_filename=="aftertone-collection.csv",
                "Collection CSV filename changed unexpectedly")
        csv=Path(download.path()).read_text(encoding="utf-8")
        require("\"'=HYPERLINK(\"\"https://fixture.invalid\"\",\"\"Listen\"\")\"" in csv,
                "Exported song title was not neutralized as spreadsheet text")
        require("\"\u0027\t+Pretend Artist\"" in csv,
                "Tab-prefixed formula-like artist was not neutralized")
        require('"Title","Artist","Genre","Mood","Source URL"' in csv,
                "Collection CSV headers were lost or malformatted")
        require(page.evaluate("window.__csvExportProbe")=="same-document",
                "Export navigation unexpectedly reloaded the app")
        saved=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')).savedTracks[0]""")
        require(saved["title"]==title and saved["artist"]==artist,
                "CSV hardening changed the user's saved metadata")
        with page.expect_download(timeout=TIMEOUT) as json_exported:
            page.locator('[data-action="export-json"]').click()
        json_copy=json.loads(Path(json_exported.value.path()).read_text(encoding="utf-8"))
        require(json_copy["tracks"][0]["title"]==title and
                json_copy["tracks"][0]["artist"]==artist,
                "JSON library export must retain the exact metadata")
        require(not errors,"Collection CSV browser errors: "+"; ".join(errors))
        print("PASS inert Collection CSV download and unmodified JSON metadata")
    except Exception:
        screenshot(page,"FAILED-collection-csv-safety")
        raise
    finally:
        context.close()


def check_abandoned_preview_metadata_cancellation(browser, base):
    """Stop and navigation must abort old on-demand Deezer JSONP immediately."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        first=page.locator('#modal-root button[data-modal="close"]')
        if first.count():first.first.click(timeout=TIMEOUT)
        # Hold a fictional /track/ JSONP by not attaching its script to the
        # document. The script's remove() instrumentation verifies the real
        # browser adapter's AbortSignal cleanup, without requesting media.
        page.evaluate("""() => {
            const oldAppend=document.head.append.bind(document.head);
            window.__heldPreviewFlights=[];
            document.head.append=(...nodes)=>{
                for(const node of nodes) {
                    const url=node?.src ? new URL(node.src,location.href) : null;
                    if(url?.hostname==='api.deezer.com' &&
                       url.pathname.startsWith('/track/')) {
                        const flight={
                            callback:url.searchParams.get('callback'),
                            path:url.pathname,removed:false
                        };
                        const remove=node.remove.bind(node);
                        node.remove=()=>{
                            flight.removed=true;
                            return remove();
                        };
                        window.__heldPreviewFlights.push(flight);
                    } else oldAppend(node);
                }
            };
        }""")
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__heldPreviewFlights.length===1",
                               timeout=TIMEOUT)
        require(page.evaluate("""() => !window.__heldPreviewFlights[0].removed"""),
                "The mocked Play metadata lookup was unexpectedly finished")
        page.locator("#stop-session").click()
        page.wait_for_function("() => window.__heldPreviewFlights[0].removed",
                               timeout=TIMEOUT)
        # Late JSONP must be an inert tombstone; never accidentally wake up
        # playback, set a false provider error or count a listening vote.
        page.evaluate("""() => {
            const cb=window.__heldPreviewFlights[0].callback;
            window[cb]?.({id:9100001,preview:'https://fixture.invalid/obsolete.mp3'});
        }""")
        require(page.locator("#preview-recovery").is_hidden(),
                "An intentionally stopped metadata request showed an error")
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__heldPreviewFlights.length===2",
                               timeout=TIMEOUT)
        require(page.evaluate("""() =>
            window.__heldPreviewFlights[1].callback!==
            window.__heldPreviewFlights[0].callback"""),
            "A new Play joined the canceled provider callback")
        page.locator('#main-nav button[data-view="collection"]').click()
        page.wait_for_function("() => window.__heldPreviewFlights[1].removed",
                               timeout=TIMEOUT)
        state=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')||'{}')""")
        require(not state.get("history") and not state.get("favorites"),
                "Stopping or leaving a pending preview recorded a false vote")
        page.locator('#main-nav button[data-view="discover"]').click()
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__heldPreviewFlights.length===3",
                               timeout=TIMEOUT)
        require(not page.evaluate("() => window.__heldPreviewFlights[2].removed"),
                "Fresh preview retry inherited an aborted request")
        page.locator("#stop-session").click()
        page.wait_for_function("() => window.__heldPreviewFlights[2].removed",
                               timeout=TIMEOUT)
        require(not errors,"Canceled preview metadata browser errors: "+"; ".join(errors))
        print("PASS preview JSONP cancellation on Stop/navigation and fresh Play retry")
    except Exception:
        screenshot(page,"FAILED-preview-metadata-cancellation")
        raise
    finally:
        context.close()


def check_discovery_path_keyboard_continuity(browser, base):
    """Changing a discovery path must not jump focus to Play or the main landmark."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        require(page.locator('.discovery-paths .path-option').count()==3,
                "Three discovery paths must be keyboard accessible")
        page.evaluate("window.__pathFocusProbe='same-document'")
        # Starting on a different mode ensures these are real setting changes.
        for mode in ('explore','familiar','balanced'):
            button=page.locator(f'.discovery-paths .path-option[data-path="{mode}"]')
            button.focus()
            page.keyboard.press('Enter')
            page.wait_for_function("""(name) => {
                const active=document.activeElement;
                const chosen=document.querySelector(
                    '.discovery-paths .path-option[aria-pressed="true"]');
                return active?.dataset.path===name &&
                    chosen?.dataset.path===name &&
                    active.getAttribute('aria-pressed')==='true';
            }""",arg=mode,timeout=TIMEOUT)
            require(page.locator('.discovery-paths .path-option[aria-pressed="true"]').count()==1,
                    "Exactly one discovery path should be selected")
            # Network completion may replace the placeholder card after mode
            # selection; the focused option must survive that later redraw.
            page.wait_for_timeout(350)
            require(page.evaluate("document.activeElement?.dataset.path") == mode,
                    f"Delayed {mode} loading discarded keyboard focus")
        # Another path can still be selected with ordinary Tab and Enter.
        chosen=page.locator('.discovery-paths .path-option[data-path="balanced"]')
        chosen.focus()
        page.keyboard.press("Shift+Tab")
        require(page.evaluate("document.activeElement?.dataset.path")=="familiar",
                "Path focus could not move between adjacent buttons")
        page.keyboard.press("Enter")
        require(page.evaluate("""() =>
            document.activeElement?.dataset.path==='familiar' &&
            document.activeElement?.getAttribute('aria-pressed')==='true'"""),
            "Selecting the adjacent path jumped focus away")
        state=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')||'{}')""")
        require(not state.get('history') and not state.get('favorites'),
                "Changing path settings unexpectedly recorded a listening choice")
        page.locator('#main-nav button[data-view="collection"]').click()
        require(page.evaluate("document.activeElement?.id==='main-content'"),
                "Deliberate navigation should focus the new main landmark")
        require(page.evaluate("window.__pathFocusProbe")=="same-document",
                "Changing discovery paths unexpectedly reloaded the page")
        require(not errors,"Discovery path browser errors: "+"; ".join(errors))
        print("PASS discovery paths retain keyboard focus across mode and provider redraws")
    except Exception:
        screenshot(page,"FAILED-discovery-path-focus")
        raise
    finally:
        context.close()


def check_modal_interrupts_pending_preview(browser, base):
    """Opening Help while Play is resolving must cancel metadata and end autoplay."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        onboarding=page.locator('#modal-root button[data-modal="close"]')
        if onboarding.count():onboarding.first.click(timeout=TIMEOUT)
        # The callback is registered by the production JSONP adapter, but
        # never deliver metadata. Record removal as AbortSignal evidence.
        page.evaluate("""() => {
            const append=document.head.append.bind(document.head);
            window.__dialogPreviewFlights=[];
            document.head.append=(...nodes)=>{
                for(const node of nodes){
                    const url=node?.src ? new URL(node.src,location.href) : null;
                    if(url?.hostname==='api.deezer.com' &&
                       url.pathname.startsWith('/track/')){
                        const pending={
                            callback:url.searchParams.get('callback'),
                            path:url.pathname,removed:false
                        };
                        const remove=node.remove.bind(node);
                        node.remove=()=>{pending.removed=true;return remove();};
                        window.__dialogPreviewFlights.push(pending);
                    } else append(node);
                }
            };
        }""")
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__dialogPreviewFlights.length===1",
                               timeout=TIMEOUT)
        require(not page.evaluate("window.__dialogPreviewFlights[0].removed"),
                "Preview metadata finished before opening Help")
        page.locator("#help-button").click()
        page.locator('#modal-root [role="dialog"]').wait_for(
            state="visible",timeout=TIMEOUT)
        page.wait_for_function("() => window.__dialogPreviewFlights[0].removed",
                               timeout=TIMEOUT)
        require(page.evaluate("""() => {
            const player=document.querySelector('#player');
            return player.paused && !player.getAttribute('src');
        }"""),"Help dialog left pending audio loaded or playing behind its overlay")
        page.evaluate("""() => {
            const cb=window.__dialogPreviewFlights[0].callback;
            window[cb]?.({id:9100001,
                preview:'https://fixture.invalid/too-late-preview.mp3'});
        }""")
        page.keyboard.press("Escape")
        page.locator('#modal-root [role="dialog"]').wait_for(
            state="hidden",timeout=TIMEOUT)
        require(page.evaluate("document.activeElement?.id==='help-button'"),
                "Closing Help did not restore focus to its button")
        require(page.locator("#stop-session").is_hidden(),
                "Opening Help did not end automatic playback")
        require(page.locator("#preview-recovery").is_hidden(),
                "Canceled preview metadata created a false preview error")
        require(page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return !s.history?.length && !s.favorites?.length &&
                document.querySelector('#player').paused;
        }"""),"Dialog interruption played audio or changed Keep/Pass history")
        # A later explicit Play must request fresh metadata, not share the
        # abandoned request or instantly start audio from its stale callback.
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__dialogPreviewFlights.length===2",
                               timeout=TIMEOUT)
        require(page.evaluate("""() =>
            window.__dialogPreviewFlights[0].callback !==
            window.__dialogPreviewFlights[1].callback &&
            !window.__dialogPreviewFlights[1].removed"""),
            "Fresh Play reused the canceled metadata request")
        page.locator("#stop-session").click()
        page.wait_for_function("() => window.__dialogPreviewFlights[1].removed",
                               timeout=TIMEOUT)
        require(not errors,"Dialog interruption browser errors: "+"; ".join(errors))
        print("PASS modal cancels pending preview, prevents hidden autoplay, and permits retry")
    except Exception:
        screenshot(page,"FAILED-modal-preview-interruption")
        raise
    finally:
        context.close()


def check_play_cancels_pending_preview(browser, base):
    """Second manual Play must abort a held lookup without voting or a false error."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        before=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {history:s.history||[],favorites:s.favorites||[]};
        }""")
        page.evaluate("""() => {
            const append=document.head.append.bind(document.head);
            window.__heldCancelPreview=[];
            document.head.append=(...nodes)=>{
                for(const node of nodes){
                    const url=node?.src ? new URL(node.src,location.href) : null;
                    if(url?.hostname==='api.deezer.com' &&
                       url.pathname.startsWith('/track/')){
                        const flight={
                            callback:url.searchParams.get('callback'),
                            removed:false
                        };
                        const remove=node.remove.bind(node);
                        node.remove=()=>{flight.removed=true;return remove();};
                        window.__heldCancelPreview.push(flight);
                    } else append(node);
                }
            };
        }""")
        play=page.locator("#stage-play")
        play.click()
        page.wait_for_function("() => window.__heldCancelPreview.length===1",
                               timeout=TIMEOUT)
        page.wait_for_function("""() => document.querySelector('#stage-play')
            ?.getAttribute('aria-label')==='Cancel loading preview'""",
            timeout=TIMEOUT)
        require(play.get_attribute('title')=="Cancel loading preview",
                "Loading button has no visible cancellation tooltip")
        require("Cancel loading preview" in page.locator("#audio-status").inner_text(),
                "Loading status does not explain the cancel action")
        require(not page.evaluate("window.__heldCancelPreview[0].removed"),
                "Provider callback completed before cancellation")
        play.click()
        page.wait_for_function("() => window.__heldCancelPreview[0].removed",
                               timeout=TIMEOUT)
        require(play.get_attribute("aria-label")=="Play preview",
                "Cancel did not return the button to Play")
        require(page.evaluate("document.activeElement?.id==='stage-play'"),
                "Cancel moved focus away from the Play control")
        require(page.locator("#stop-session").is_hidden(),
                "Cancel did not end the automatic listening session")
        page.evaluate("""() => {
            const cb=window.__heldCancelPreview[0].callback;
            window[cb]?.({id:9100001,
                preview:'https://fixture.invalid/late-preview.mp3'});
        }""")
        require(page.locator("#preview-recovery").is_hidden(),
                "Canceled metadata produced a false failure or retry state")
        require(page.evaluate("""() => {
            const player=document.querySelector('#player');
            return player.paused && !player.getAttribute('src');
        }"""),"Canceled preview kept a live media source")
        play.click()
        page.wait_for_function("() => window.__heldCancelPreview.length===2",
                               timeout=TIMEOUT)
        require(page.evaluate("""() =>
            window.__heldCancelPreview[1].callback!==
            window.__heldCancelPreview[0].callback"""),
            "Fresh Play reused the aborted provider callback")
        # Cancel again with the keyboard to cover the native focused control.
        play.focus()
        page.keyboard.press("Space")
        page.wait_for_function("() => window.__heldCancelPreview[1].removed",
                               timeout=TIMEOUT)
        after=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {history:s.history||[],favorites:s.favorites||[]};
        }""")
        require(before==after,"Canceling a preview changed Keeps or Passes")
        require(not errors,"Cancel loading browser errors: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: loading Play cancels without voting; fresh retry works")
    except Exception:
        screenshot(page,"FAILED-loading-preview-cancel")
        raise
    finally:
        context.close()


def check_media_error_refresh_cancellation(browser, base):
    """A recoverable media error must expose Cancel and abort an obsolete retry."""
    import io
    import wave
    sample=io.BytesIO()
    with wave.open(sample,"wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(1)
        writer.setframerate(8000)
        writer.writeframes(bytes([128])*8000*30)
    silence=sample.getvalue()
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    context.route("https://cdn-preview.dzcdn.net/**",lambda route:
        route.fulfill(status=200,content_type="audio/wav",body=silence,
                      headers={"access-control-allow-origin":"*"}))
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        before=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {history:s.history||[],favorites:s.favorites||[]};
        }""")
        page.locator("#stage-play").click()
        page.wait_for_function("""() => document.querySelector('#stage-play')
            ?.getAttribute('aria-label')==='Pause preview'""",timeout=TIMEOUT)
        # Only the recovery request is held. The initial Play used a playable
        # 30-second original silence fixture, no third-party audio.
        page.evaluate("""() => {
            const append=document.head.append.bind(document.head);
            window.__mediaErrorFlights=[];
            document.head.append=(...nodes)=>{
                for(const node of nodes){
                    const url=node?.src ? new URL(node.src,location.href) : null;
                    if(url?.hostname==='api.deezer.com' &&
                       url.pathname.startsWith('/track/')){
                        const flight={
                            callback:url.searchParams.get('callback'),
                            removed:false
                        };
                        const remove=node.remove.bind(node);
                        node.remove=()=>{flight.removed=true;return remove();};
                        window.__mediaErrorFlights.push(flight);
                    } else append(node);
                }
            };
            document.querySelector('#player').dispatchEvent(new Event('error'));
        }""")
        page.wait_for_function("() => window.__mediaErrorFlights.length===1",
                               timeout=TIMEOUT)
        require(page.locator("#stage-play").get_attribute("aria-label")==
                "Cancel loading preview",
                "Media-error recovery was left looking idle instead of cancelable")
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__mediaErrorFlights[0].removed",
                               timeout=TIMEOUT)
        require(page.locator("#stage-play").get_attribute("aria-label")=="Play preview",
                "Canceling an error recovery did not restore Play")
        require(page.locator("#stop-session").is_hidden(),
                "Canceling an error recovery kept continuous playback active")
        page.evaluate("""() => {
            const cb=window.__mediaErrorFlights[0].callback;
            window[cb]?.({id:9100001,
                preview:'https://fixture.invalid/stale-recovery.mp3'});
        }""")
        require(page.locator("#preview-recovery").is_hidden(),
                "Canceled media error recovery showed a stale failure")
        require(page.evaluate("""() => {
            const audio=document.querySelector('#player');
            return audio.paused && !audio.getAttribute('src');
        }"""),"An obsolete error recovery retained or restarted audio")
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__mediaErrorFlights.length===2",
                               timeout=TIMEOUT)
        require(page.evaluate("""() =>
            window.__mediaErrorFlights[1].callback !==
            window.__mediaErrorFlights[0].callback"""),
            "Fresh Play reused the canceled recovery callback")
        page.locator("#stage-play").click()
        page.wait_for_function("() => window.__mediaErrorFlights[1].removed",
                               timeout=TIMEOUT)
        after=page.evaluate("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return {history:s.history||[],favorites:s.favorites||[]};
        }""")
        require(after==before,"Retry/cancel changed Keep/Pass history")
        require(not errors,"Media error recovery page errors: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: canceled media error refresh cannot restart sound")
    except Exception:
        screenshot(page,"FAILED-media-error-refresh-cancel")
        raise
    finally:
        context.close()


def check_tune_lab_keyboard_continuity(browser, base):
    """Start, answer, mood and Next must preserve a usable keyboard position."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        page.locator('#listening-card [data-action="like"]').click()
        page.wait_for_function("""() => {
            const state=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return state.favorites?.length===1 && state.history?.length===1;
        }""",timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="quiz"]').click()
        start=page.locator('[data-action="quiz-start"]')
        start.focus()
        page.keyboard.press("Enter")
        page.locator('[data-quiz-answer]').first.wait_for(state="visible",timeout=TIMEOUT)
        require(page.evaluate("""() => document.activeElement?.hasAttribute(
            'data-quiz-answer')"""),"Tune Lab Start abandoned keyboard focus")
        page.keyboard.press("Enter")
        feedback=page.locator("#quiz-feedback")
        feedback.wait_for(state="visible",timeout=TIMEOUT)
        require(page.evaluate("document.activeElement?.id==='quiz-feedback'"),
                "Disabled answer button stranded focus instead of announcing feedback")
        require(feedback.get_attribute("role")=="status",
                "Answer feedback has no concise accessible status")
        require(page.locator("[data-quiz-answer]:not([disabled])").count()==0,
                "A completed quiz retained active answer buttons")
        require(page.locator(".quiz-moods [data-quiz-mood]").count()==6,
                "Tune Lab moods disappeared after answer")
        page.keyboard.press("Tab")
        require(page.evaluate("document.activeElement?.dataset.quizMood==='Bright'"),
                "Tab from answer feedback did not enter the mood group")
        page.keyboard.press("Enter")
        require(page.evaluate("""() =>
            document.activeElement?.dataset.quizMood==='Bright' &&
            document.activeElement?.getAttribute('aria-pressed')==='true'"""),
            "Selecting a mood failed to retain focus and pressed state")
        page.keyboard.press("Tab")
        require(page.evaluate("document.activeElement?.dataset.quizMood==='Warm'"),
                "Keyboard navigation could not move to a neighboring mood")
        page.keyboard.press("Enter")
        require(page.evaluate("""() => {
            const selected=[...document.querySelectorAll('.quiz-moods [aria-pressed="true"]')];
            return selected.length===1 && selected[0].dataset.quizMood==='Warm' &&
                document.activeElement===selected[0];
        }"""),"Switching moods did not update pressed state or retain focus")
        stats=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:tune-lab:v1')||'{}')""")
        require(stats.get("answered")==1,
                "Changing moods recorded duplicate quiz answers")
        next_button=page.locator('[data-action="quiz-next"]')
        next_button.focus()
        page.keyboard.press("Enter")
        page.locator('[data-quiz-answer]').first.wait_for(state="visible",timeout=TIMEOUT)
        require(page.evaluate("""() =>
            document.activeElement?.hasAttribute('data-quiz-answer')"""),
            "Next question removed the focused button without moving into new answers")
        require(page.locator("#quiz-feedback").count()==0,
                "Next question retained the previous answer's feedback")
        final=page.evaluate("""() => JSON.parse(
            localStorage.getItem('aftertone:session:v1')||'{}')""")
        require(len(final.get("history",[]))==1 and
                len(final.get("favorites",[]))==1,
                "Tune Lab keyboard interactions created an extra Keep/Pass")
        require(not errors,"Tune Lab browser errors: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: Tune Lab keyboard question, feedback, moods and next")
    except Exception:
        screenshot(page,"FAILED-tune-lab-focus")
        raise
    finally:
        context.close()



def check_duels_keyboard_continuity(browser, base):
    """A real keyboard can start, finish, close and reopen a Music Duels bracket."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="duels"]').click()
        page.locator("#duel-size").select_option("4")
        page.wait_for_function("""() => {
            const button=document.querySelector('[data-duel-action="create"]');
            return button && !button.disabled;
        }""",timeout=TIMEOUT)
        page.locator('[data-duel-action="create"]').focus()
        page.keyboard.press("Enter")
        page.locator("#duel-active-event [data-duel-vote]").first.wait_for(
            state="visible",timeout=TIMEOUT)
        require(page.evaluate("""() => document.activeElement ===
            document.querySelector('#duel-active-event [data-duel-play]')"""),
            "Starting a bracket left focus on the removed Start button")
        for round_index in range(4):
            vote=page.locator("#duel-active-event [data-duel-vote]").first
            vote.focus()
            page.keyboard.press("Enter")
            if round_index<3:
                require(page.evaluate("""() => document.activeElement ===
                    document.querySelector('#duel-active-event [data-duel-play]')"""),
                    "Voting did not focus the next playable contender")
            else:
                page.locator("#duel-podium-heading").wait_for(state="visible",
                                                              timeout=TIMEOUT)
                require(page.evaluate("""() => document.activeElement?.id ===
                    'duel-podium-heading'"""),
                    "Final vote left focus behind instead of announcing the podium")
        period=page.locator("#duel-season")
        period.focus()
        page.evaluate("""() => document.querySelector('#duel-season')
            .dispatchEvent(new Event('change',{bubbles:true}))""")
        require(page.evaluate("document.activeElement?.id==='duel-season'"),
                "Hall of Fame rerender discarded the focused period selector")
        page.locator('[data-duel-action="dismiss"]').focus()
        page.keyboard.press("Enter")
        require(page.locator("#duel-active-event").count()==0,
                "Close Bracket failed to close the current bracket")
        require(page.evaluate("""() => document.activeElement?.dataset.duelAction
            === 'open'"""),"Closing a bracket stranded focus")
        page.keyboard.press("Enter")
        require(page.evaluate("document.activeElement?.id==='duel-podium-heading'"),
                "Reopening the finished bracket did not focus the podium")
        require(not errors,"Duels keyboard browser errors: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: Duels bracket, votes, podium, archive and period focus")
    except Exception:
        screenshot(page,"FAILED-duels-keyboard-focus")
        raise
    finally:
        context.close()


def check_shared_deezer_challenge(browser, base):
    """An actual shared link resolves the same song in a fresh browser profile."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    origin=urlsplit(base).netloc
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    try:
        page.add_init_script("""(() => {
          window.__aftertoneSharedCopy='';
          Object.defineProperty(navigator,'clipboard',{configurable:true,
            value:{writeText:async value=>{window.__aftertoneSharedCopy=value;}}});
        })();""")
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        page.locator('#listening-card [data-action="like"]').click()
        page.wait_for_function("""() => {
            const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
            return s.favorites?.length===1 && s.savedTracks?.length===1;
        }""",timeout=TIMEOUT)
        page.locator('#main-nav button[data-view="challenges"]').click()
        share=page.locator('[data-action="share-challenge"]')
        require(share.is_enabled(),"Saved public Deezer favorites cannot be shared")
        share.click()
        page.wait_for_function("() => Boolean(window.__aftertoneSharedCopy)",
                               timeout=TIMEOUT)
        link=page.evaluate("window.__aftertoneSharedCopy")
        encoded=parse_qs(urlsplit(link).query).get("challenge",[""])[0]
        require(encoded.startswith("v1.deezer:9100"),
                "Share Challenge created an invalid or empty provider ID link")
        require("jellyfin" not in link and "aftertone:session" not in link,
                "A shared link must contain public track IDs only")
        # Opening that URL in a new profile cannot rely on the sender's catalog.
        fresh=browser.new_context(viewport={"width":390,"height":844},
                                  service_workers="block")
        fresh.route("**/*",lambda route:route.continue_()
                    if urlsplit(route.request.url).netloc==origin else route.abort())
        fresh.route("https://api.deezer.com/**",mock_deezer)
        other=fresh.new_page()
        other.on("pageerror",lambda error:errors.append(str(error)))
        try:
            other.goto(link,wait_until="load",timeout=TIMEOUT)
            card=other.locator("#listening-card")
            card.wait_for(state="visible",timeout=TIMEOUT)
            require("CHALLENGE 01 / 1" in card.inner_text(),
                    "Fresh visitor didn't load the exact shared recording")
            require("BLIND CHALLENGE" in card.inner_text(),
                    "Shared challenge didn't hide the recording identity")
            require(other.locator('#modal-root [role="dialog"]').count()==0,
                    "Shared visitor must not be blocked by first-run modal")
            state=other.evaluate("""() => JSON.parse(
                localStorage.getItem('aftertone:session:v1')||'{}')""")
            require(not state.get('favorites') and not state.get('history'),
                    "Shared link secretly transferred the sender's personal choices")
            other.locator('#listening-card [data-action="pass"]').click()
            other.locator(".discovery-empty-state").wait_for(state="visible",
                                                              timeout=TIMEOUT)
            require("Challenge Complete" in other.locator(".discovery-empty-state").inner_text(),
                    "Voting on the shared recording didn't complete challenge")
        finally:
            fresh.close()
        page.locator('[data-action="try-challenge"]').click()
        require("challenge=" in page.url and
                parse_qs(urlsplit(page.url).query).get("challenge",[""])[0].startswith("v1.deezer:"),
                "Sample challenge created an invalid shared link")
        require(page.locator("#listening-card").count()==1,
                "Sample challenge must open actual blind discovery")
        require(not errors,"Shared challenge browser exceptions: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: Deezer share, new profile, vote, sample")
    except Exception:
        screenshot(page,"FAILED-shared-challenge")
        raise
    finally:
        context.close()


def check_shared_challenge_outage_recovery(browser, base):
    """Recover shared clips in a new profile: retry, shorten, or exit honestly."""
    origin=urlsplit(base).netloc
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    attempts={"9100001":0}
    def flaky_deezer(route):
        parsed=urlsplit(route.request.url)
        if parsed.path=="/track/9100001":
            attempts["9100001"]+=1
            if attempts["9100001"]==1:
                callback=parse_qs(parsed.query).get("callback",[""])[0]
                route.fulfill(status=200,content_type="application/javascript",
                    body=f'window[{json.dumps(callback)}]({json.dumps({"error":{"code":800,"message":"Temporarily unavailable"}})});')
                return
        if parsed.path in ("/track/9100003","/track/9100004"):
            callback=parse_qs(parsed.query).get("callback",[""])[0]
            route.fulfill(status=200,content_type="application/javascript",
                body=f'window[{json.dumps(callback)}]({json.dumps({"error":{"code":800,"message":"Not currently playable"}})});')
            return
        mock_deezer(route)
    context.route("https://api.deezer.com/**",flaky_deezer)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    try:
        # No saved catalog: the first attempt fails, and retry restores the
        # exact shared track without recording a vote or changing the link.
        url=base+"/demo/?challenge=v1.deezer%3A9100001"
        page.goto(url,wait_until="load",timeout=TIMEOUT)
        recovery=page.locator(".challenge-recovery")
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        require("Shared Challenge Unavailable" in recovery.inner_text(),
                "Total provider outage silently became unrelated discovery")
        require(page.locator("#listening-card").count()==0,
                "A missing shared track was replaced by a general discovery card")
        require(page.locator(".discovery-paths").is_hidden(),
                "Recovery must not offer unrelated discovery paths")
        require(page.locator("#modal-root [role='dialog']").count()==0,
                "First-run modal must not cover a failed shared link")
        retry=page.locator('[data-action="retry-shared-challenge"]')
        retry.focus()
        page.keyboard.press("Enter")
        card=page.locator("#listening-card")
        card.wait_for(state="visible",timeout=TIMEOUT)
        require("CHALLENGE 01 / 1" in card.inner_text() and
                "BLIND CHALLENGE" in card.inner_text(),
                "Retry did not resume the exact blind challenge")
        require(attempts["9100001"]==2,
                "Retry was not limited to one missing shared recording")
        require(page.evaluate("document.activeElement?.id")=="stage-play",
                "Keyboard focus was lost after successful retry")
        require("challenge=" in page.url,
                "Retry must preserve the original share URL")
        state=page.evaluate("""() => JSON.parse(
          localStorage.getItem('aftertone:session:v1')||'{}')""")
        require(not state.get("history") and not state.get("favorites"),
                "A retry must not record a listening choice")

        # A permanently missing recording must keep a visible exit, without
        # starting normal music discovery until the visitor chooses to leave.
        page.goto(base+"/demo/?challenge=v1.deezer%3A9100003",
                  wait_until="load",timeout=TIMEOUT)
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        require("None of the 1 shared song" in recovery.inner_text(),
                "Missing share does not explain provider availability")
        page.locator('[data-action="exit-challenge"]').click()
        page.wait_for_url(base+"/demo/",timeout=TIMEOUT)
        card.wait_for(state="visible",timeout=TIMEOUT)
        require("NOW DISCOVERING" in card.inner_text(),
                "Exiting an unavailable challenge did not refill discovery")

        # A partially unavailable link must NOT silently shrink. The visitor
        # explicitly chooses the available songs, then sees honest progress.
        page.goto(base+"/demo/?challenge=v1.deezer%3A9100004~deezer%3A9100005",
                  wait_until="load",timeout=TIMEOUT)
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        require("1 of 2 shared songs available" in recovery.inner_text(),
                "Partial shared outage was not disclosed")
        require(page.locator('#listening-card').count()==0,
                "Partially available challenge started without consent")
        play=page.locator('[data-action="continue-shared-challenge"]')
        play.focus()
        page.keyboard.press("Enter")
        card.wait_for(state="visible",timeout=TIMEOUT)
        require("CHALLENGE 01 / 1" in card.inner_text(),
                "The shorter challenge did not have the true match count")
        require(page.evaluate("document.activeElement?.id")=="stage-play",
                "Keyboard focus lost after choosing available song")
        require("1 unavailable in the original shared link" in page.locator(
                ".challenge-short-notice").inner_text(),
                "Shortened challenge did not disclose the missing track")
        require("9100004" in page.url and "9100005" in page.url,
                "Choosing shorter playback must not silently rewrite the link")
        card.locator('[data-action="pass"]').click()
        finish=page.locator(".discovery-empty-state")
        finish.wait_for(state="visible",timeout=TIMEOUT)
        require("Challenge Complete" in finish.inner_text() and
                "1 shared song was unavailable" in finish.inner_text(),
                "Completed challenge did not disclose omitted shared songs")
        require(not errors,"Shared outage browser exceptions: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: shared retry, all-missing exit, partial explicit playback")
    except Exception:
        screenshot(page,"FAILED-shared-outage-recovery")
        raise
    finally:
        context.close()


def check_shared_preview_failure_skip(browser, base):
    """An audio failure inside a live shared round is NOT a Pass."""
    origin=urlsplit(base).netloc
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    url=base+"/demo/?challenge=v1.deezer%3A9100001~deezer%3A9100002"
    try:
        page.goto(url,wait_until="load",timeout=TIMEOUT)
        card=page.locator("#listening-card")
        card.wait_for(state="visible",timeout=TIMEOUT)
        require("CHALLENGE 01 / 2" in card.inner_text(),
                "Shared challenge didn't start on the first track")
        require(not page.locator('#stop-session').is_visible(),
                "Shared clips must wait for a vote, not autoplay another song")
        require(page.locator('[data-action="exit-challenge"]').is_visible(),
                "An active shared challenge has no explicit exit")
        # All external CDN audio is blocked; the Deezer metadata fixture still
        # resolves so the challenge only fails once the listener tries Play.
        page.locator("#stage-play").click()
        recovery=page.locator("#preview-recovery")
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        require("without counting a Pass" in recovery.inner_text(),
                "Shared playback failure lacks neutral recovery guidance")
        skip=page.locator("#preview-skip")
        require(skip.is_visible() and skip.is_enabled(),
                "Shared challenge trapped a listener on a failed preview")
        skip.focus()
        page.keyboard.press("Enter")
        card.wait_for(state="visible",timeout=TIMEOUT)
        require("CHALLENGE 02 / 2" in card.inner_text(),
                "Neutral skipping an unplayable clip didn't advance the round")
        require(page.evaluate("document.activeElement?.id")=="stage-play",
                "Keyboard focus didn't return to the next challenge's Play button")
        require(page.url==url,"Neutral skip rewrote the original share link")
        scores=page.evaluate("""() => {
          const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
          return {history:s.history||[],favorites:s.favorites||[]};
        }""")
        require(not scores["history"] and not scores["favorites"],
                "Neutral skipped recording was miscounted as a Keep or Pass")

        page.locator("#stage-play").click()
        recovery.wait_for(state="visible",timeout=TIMEOUT)
        page.locator("#preview-skip").click()
        finished=page.locator(".discovery-empty-state")
        finished.wait_for(state="visible",timeout=TIMEOUT)
        require("Challenge Finished" in finished.inner_text() and
                "No songs were rated" in finished.inner_text() and
                "2 previews were unplayable and not counted as Passes"
                   in finished.inner_text(),
                "All-failed challenge fabricated ratings or had no honest summary")
        require(page.url==url,"Finishing without votes rewrote the shared link")
        page.locator('[data-action="exit-challenge"]').click()
        page.wait_for_url(base+"/demo/",timeout=TIMEOUT)
        card.wait_for(state="visible",timeout=TIMEOUT)
        require("NOW DISCOVERING" in card.inner_text(),
                "Exiting an all-unplayable challenge failed to refill discovery")
        # A failed song and a real Pass must have separate totals.
        page.goto(url,wait_until="load",timeout=TIMEOUT)
        card.wait_for(state="visible",timeout=TIMEOUT)
        page.locator("#stage-play").click()
        page.locator("#preview-recovery").wait_for(state="visible",timeout=TIMEOUT)
        page.locator("#preview-skip").click()
        require("CHALLENGE 02 / 2" in card.inner_text(),
                "Second challenge did not advance after preview skip")
        card.locator('[data-action="pass"]').click()
        finished.wait_for(state="visible",timeout=TIMEOUT)
        require("Challenge Finished" in finished.inner_text() and
                "You kept 0 of 1 rated songs" in finished.inner_text() and
                "1 preview was unplayable and not counted as a Pass"
                  in finished.inner_text(),
                "Mixed voted/skipped summary is not truthful")
        summary=page.evaluate("""() => {
          const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
          return {history:s.history||[],favorites:s.favorites||[]};
        }""")
        require(len(summary["history"])==1 and
                summary["history"][0]["action"]=="pass" and
                not summary["favorites"],
                "Exactly one explicit Pass should be saved, not an audio failure")
        require(not errors,"JS errors during shared audio recovery: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: shared audio fail, neutral skip, correct results")
    except Exception:
        screenshot(page,"FAILED-shared-preview-skip")
        raise
    finally:
        context.close()


def check_curated_shared_challenge(browser, base):
    """Choose and reorder favorites, then play the exact link in a clean browser."""
    origin=urlsplit(base).netloc
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    try:
        page.add_init_script("""(() => {
          window.__aftertoneCuratedCopy='';
          Object.defineProperty(navigator,'clipboard',{configurable:true,
            value:{writeText:async value=>{window.__aftertoneCuratedCopy=value;}}});
        })();""")
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        card=page.locator("#listening-card")
        card.wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        for count in range(1,4):
            card.locator('[data-action="like"]').click(timeout=TIMEOUT)
            page.wait_for_function("""n => {
              const s=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
              return s.favorites?.length===n && s.savedTracks?.length>=n;
            }""",arg=count,timeout=TIMEOUT)
        saved=page.evaluate("""() => {
          const s=JSON.parse(localStorage.getItem('aftertone:session:v1'));
          return {ids:s.favorites,titles:Object.fromEntries(
            s.savedTracks.map(t=>[t.id,t.title]))};
        }""")
        require(len(set(saved["ids"]))==3,
                "Could not save three distinct songs for challenge curation")
        page.locator('#main-nav button[data-view="challenges"]').click()
        chosen=page.locator('.challenge-draft-item').evaluate_all(
            "els=>els.map(el=>el.dataset.chosenId)")
        require(chosen==list(reversed(saved["ids"])),
                f"Latest favorites not selected by default: {chosen}")
        require("3 of 5 tracks selected" in page.locator(".challenge-builder").inner_text(),
                "Curated challenge builder lacks live selection count")
        require(page.locator('[data-action="share-challenge"]').is_enabled(),
                "Default quick-share was accidentally disabled")

        # Unselect the latest song. Find it again with the search and add it;
        # a narrow phone screen and keyboard caret must remain functional.
        newest=saved["ids"][-1]
        page.locator('[data-action="remove-challenge-track"][data-id="'+newest+'"]').click()
        chosen=page.locator('.challenge-draft-item').evaluate_all(
            "els=>els.map(el=>el.dataset.chosenId)")
        require(chosen==list(reversed(saved["ids"][:-1])),
                f"Removing one song unexpectedly changed draft order: {chosen}")
        page.locator('#challenge-track-search').fill(saved["titles"][newest])
        require(page.evaluate("document.activeElement?.id")=="challenge-track-search",
                "Filtering saved favorites lost the keyboard search focus")
        found=page.locator('[data-action="add-challenge-track"][data-id="'+newest+'"]')
        require(found.is_visible() and found.is_enabled(),
                "An unselected older favorite could not be found and added")
        for selector in ['[data-action="remove-challenge-track"]',
                         '[data-action="move-challenge-down"]',
                         '[data-action="add-challenge-track"]']:
            b=page.locator(selector).first.bounding_box()
            require(b and b["height"]>=43.5,
                    "Challenge controls are too small for phone touch: "+selector)
        found.click()
        require(page.locator('.challenge-draft-item').count()==3,
                "Adding a saved recording did not update selection")
        page.locator('[data-action="remove-challenge-track"][data-id="'+newest+'"]').click()
        require(page.locator('.challenge-draft-item').count()==2,
                "Removing a re-added song lost the draft")
        remaining=page.locator('.challenge-draft-item').evaluate_all(
            "els=>els.map(el=>el.dataset.chosenId)")
        first=remaining[0]
        page.locator('[data-action="move-challenge-down"][data-id="'+first+'"]').focus()
        page.keyboard.press("Enter")
        ordered=page.locator('.challenge-draft-item').evaluate_all(
            "els=>els.map(el=>el.dataset.chosenId)")
        require(ordered==list(reversed(remaining)),
                f"Keyboard reorder did not preserve selected recordings: {ordered}")

        page.locator('[data-action="share-challenge"]').click()
        page.wait_for_function("() => Boolean(window.__aftertoneCuratedCopy)",
                               timeout=TIMEOUT)
        link=page.evaluate("window.__aftertoneCuratedCopy")
        encoded=parse_qs(urlsplit(link).query).get("challenge",[""])[0]
        require(encoded=="v1."+"~".join(ordered),
                f"Shared challenge ignored the selected custom order: {encoded}")
        require(newest not in link and
                "jellyfin" not in link and "preview" not in link and
                "aftertone:session" not in link,
                "Shared link leaked an excluded song or personal metadata")

        fresh=browser.new_context(viewport={"width":320,"height":740},
                                  service_workers="block")
        fresh.route("**/*",lambda route:route.continue_()
                    if urlsplit(route.request.url).netloc==origin else route.abort())
        fresh.route("https://api.deezer.com/**",mock_deezer)
        other=fresh.new_page()
        other.on("pageerror",lambda error:errors.append(str(error)))
        try:
            other.goto(link,wait_until="load",timeout=TIMEOUT)
            listening=other.locator("#listening-card")
            listening.wait_for(state="visible",timeout=TIMEOUT)
            require("CHALLENGE 01 / 2" in listening.inner_text(),
                    "Customized link did not load its first blind recording")
            other.locator('#listening-card [data-action="pass"]').click()
            other.wait_for_function("""() =>
              document.querySelector('#listening-card')?.textContent?.includes('CHALLENGE 02 / 2')""",
              timeout=TIMEOUT)
            require("BLIND CHALLENGE" in listening.inner_text(),
                    "Second customized recording was not blind")
            other.locator('#listening-card [data-action="pass"]').click()
            other.locator(".discovery-empty-state").wait_for(state="visible",
                                                                timeout=TIMEOUT)
            require("Challenge Complete" in other.locator(".discovery-empty-state").inner_text(),
                    "Customized two-song challenge did not finish")
            require(other.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),
                    "Custom shared link overflows a 320px phone viewport")
        finally:
            fresh.close()
        require(not errors,"Curated challenge JS errors: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: selected order, search, keyboard, ID-only fresh link")
    except Exception:
        screenshot(page,"FAILED-curated-challenge")
        raise
    finally:
        context.close()


def check_resumable_shared_challenge_draft(browser, base):
    """Custom song order survives same-tab reload without leaking personal data."""
    origin=urlsplit(base).netloc
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    context.route("**/*",lambda route: route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    context.route("https://api.deezer.com/**",mock_deezer)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    key="aftertone:shared-challenge-draft:v1"
    def selection():
        return page.locator(".challenge-draft-item").evaluate_all(
            "items=>items.map(item=>item.dataset.chosenId)")
    def navigate_challenges():
        page.locator('#main-nav button[data-view="challenges"]').click()
        page.locator("#challenge-builder-heading").wait_for(state="visible",timeout=TIMEOUT)
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        card=page.locator("#listening-card")
        card.wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        for n in range(1,4):
            card.locator('[data-action="like"]').click(timeout=TIMEOUT)
            page.wait_for_function("""n=>{
              const state=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
              return state.favorites?.length===n && state.savedTracks?.length>=n;
            }""",arg=n,timeout=TIMEOUT)
        saved=page.evaluate("""() =>
          JSON.parse(localStorage.getItem('aftertone:session:v1')).favorites""")
        navigate_challenges()
        require(selection()==list(reversed(saved)),
                "The latest favorites are not selected on first opening")
        latest=saved[-1]
        page.locator('[data-action="remove-challenge-track"][data-id="'+latest+'"]').click()
        remaining=selection()
        first=remaining[0]
        page.locator('[data-action="move-challenge-down"][data-id="'+first+'"]').click()
        expected=selection()
        require(expected==list(reversed(remaining)),
                "Could not customize the challenge before saving")
        stored=page.evaluate("""key=>JSON.parse(sessionStorage.getItem(key))""",key)
        require(stored=={"version":1,"ids":expected},
                f"Draft stored unexpected data instead of public ordered IDs: {stored}")
        require("custom selection is saved for reloads in this tab only" in
                page.locator(".challenge-builder-privacy").inner_text(),
                "Draft editor did not report its saved status")
        page.reload(wait_until="load",timeout=TIMEOUT)
        card.wait_for(state="visible",timeout=TIMEOUT)
        navigate_challenges()
        require(selection()==expected,
                "A page reload lost the chosen songs or order")
        require(page.locator('[data-action="share-challenge"]').is_enabled(),
                "A valid restored draft cannot be shared")

        # Empty is an intentional, recoverable selection, not missing storage.
        for selected_id in list(expected):
            page.locator('[data-action="remove-challenge-track"][data-id="'+selected_id+'"]').click()
        require(selection()==[] and
                not page.locator('[data-action="share-challenge"]').is_enabled(),
                "An empty edited draft could still be shared")
        stored_empty=page.evaluate("""key=>JSON.parse(sessionStorage.getItem(key))""",key)
        require(stored_empty=={"version":1,"ids":[]},
                "The explicitly empty draft was discarded")
        page.reload(wait_until="load",timeout=TIMEOUT)
        card.wait_for(state="visible",timeout=TIMEOUT)
        navigate_challenges()
        require(selection()==[] and
                not page.locator('[data-action="share-challenge"]').is_enabled(),
                "Refreshing reselected songs over an intentionally empty draft")

        # Reset releases the draft and correctly restores latest-five behavior.
        page.locator('[data-action="reset-challenge-draft"]').click()
        require(selection()==list(reversed(saved)),
                "Use Latest Five did not restore default saved favorites")
        require(page.evaluate("""key=>sessionStorage.getItem(key)===null""",key),
                "Reset left stale personalized draft IDs in sessionStorage")
        page.reload(wait_until="load",timeout=TIMEOUT)
        card.wait_for(state="visible",timeout=TIMEOUT)
        navigate_challenges()
        require(selection()==list(reversed(saved)),
                "Defaults were not restored after a reset and reload")

        # The user can have corrupt/private source data in old session state:
        # invalid saved drafts must be ignored, never turned into public links.
        page.evaluate("""key=>sessionStorage.setItem(key,
          JSON.stringify({version:1,ids:['jellyfin:secret']}))""",key)
        page.reload(wait_until="load",timeout=TIMEOUT)
        card.wait_for(state="visible",timeout=TIMEOUT)
        navigate_challenges()
        require(selection()==list(reversed(saved)),
                "A private-source ID poisoned the restored challenge")

        # A browser that blocks writing drafts must keep editing functional
        # but show an honest status instead of claiming persistence.
        page.evaluate("""() => {
          const original=Storage.prototype.setItem;
          Storage.prototype.setItem=function(key,value){
            if(key==='aftertone:shared-challenge-draft:v1')
              throw new DOMException('Blocked by test','SecurityError');
            return original.call(this,key,value);
          };
        }""")
        page.locator('[data-action="remove-challenge-track"][data-id="'+latest+'"]').click()
        require(len(selection())==2,
                "Blocked sessionStorage also prevented local challenge editing")
        require("did not save it" in page.locator(".challenge-builder-privacy").inner_text(),
                "Blocked storage claimed that the draft was saved")
        require(not errors,"Draft reload browser errors: "+"; ".join(errors))
        print(f"PASS {browser.browser_type.name}: curated draft refresh, empty, reset, private-ID and blocked-storage recovery")
    except Exception:
        screenshot(page,"FAILED-resumable-challenge-draft")
        raise
    finally:
        context.close()


def check_progressive_discovery_backoff(browser, base):
    """Repeated fictional 429s must not trigger a tight polling loop."""
    context=browser.new_context(viewport={"width":390,"height":844},
                                service_workers="block")
    origin=urlsplit(base).netloc
    state={"online":False,"failures":0,"successes":0}
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    def provider(route):
        if state["online"]:
            state["successes"]+=1
            return mock_deezer(route)
        parsed=urlsplit(route.request.url)
        callback=parse_qs(parsed.query).get("callback",[""])[0]
        if not re.fullmatch(r"__aftertoneDeezer_\d+",callback):
            route.abort()
            return
        state["failures"]+=1
        body={"error":{"code":429,"message":"Requests are temporarily limited. Wait a moment, then retry."}}
        route.fulfill(status=200,content_type="application/javascript",
                      body=f"window[{json.dumps(callback)}]({json.dumps(body)});")
    context.route("https://api.deezer.com/**",provider)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"progressive-backoff-{browser.browser_type.name}"
    try:
        # Accelerate only the 3-second automatic refill CHECK, not provider
        # network calls. Advance an isolated clock without waiting real minutes.
        page.add_init_script("""(() => {
          const originalNow=Date.now.bind(Date);
          window.__aftertoneClockOffset=0;
          Date.now=()=>originalNow()+window.__aftertoneClockOffset;
          const originalInterval=window.setInterval.bind(window);
          window.setInterval=(fn,delay,...args)=>
            originalInterval(fn,delay===3000?125:delay,...args);
        })();""")
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        empty=page.locator(".discovery-empty-state")
        empty.wait_for(state="visible",timeout=TIMEOUT)
        require("Music Is Temporarily Unavailable" in empty.inner_text(),
                "Expected a real recoverable outage state")
        require("Automatic discovery retries slow down" in empty.inner_text(),
                "Repeated provider failures should be explained in the UI")
        require(page.get_by_role("button",name="Retry Discovery",exact=True).is_enabled(),
                "Progressive backoff must never disable manual retry")
        initial=state["failures"]
        require(initial>=1,"First simulated provider failure not reached")
        page.wait_for_timeout(400)
        require(state["failures"]==initial,
                "Automatic retry fired during the initial 20-second cooldown")
        page.evaluate("window.__aftertoneClockOffset=22000")
        page.wait_for_timeout(600)
        after_second=state["failures"]
        require(after_second>initial,"The first automatic retry never fired")
        page.evaluate("window.__aftertoneClockOffset=45000")
        page.wait_for_timeout(400)
        require(state["failures"]==after_second,
                "A repeated failure retried after only ~20 seconds instead of 40")
        state["online"]=True
        page.evaluate("window.__aftertoneClockOffset=66000")
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        require(state["successes"]>0,"No automatic recovery after the 40-second cooldown")
        before=page.evaluate("""() => {
          const state=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
          return {history:state.history||[],favorites:state.favorites||[]};
        }""")
        require(not before["history"] and not before["favorites"],
                "Provider cooldown incorrectly counted a listening decision")
        require(not errors,"Browser exceptions during provider cooldown: "+"; ".join(errors))
        print(f"PASS {label}: 20s then 40s cooldown, automatic recovery, no votes")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()



def check_first_listen_guided_play(browser, base):
    """The first-listen tutorial should invoke real Play, preserve focus and never vote."""
    origin=urlsplit(base).netloc
    context=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    requests={"preview":0}
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    def mock_provider(route):
        if urlsplit(route.request.url).path.startswith("/track/"):
            requests["preview"]+=1
        return mock_deezer(route)
    context.route("https://api.deezer.com/**",mock_provider)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"first-listen-guide-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="visible",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        guide=page.locator(".first-listen-guide")
        guide.wait_for(state="visible",timeout=TIMEOUT)
        action=guide.locator('[data-action="first-listen-play"]')
        require(action.is_visible() and action.is_enabled(),
                "A first-time listener cannot start a recording from the guide")
        require(requests["preview"]==0,
                "The first-listen guide preloaded third-party audio before listener consent")
        bounds=action.bounding_box()
        require(bounds is not None and bounds["height"]>=43.5,
                "First-listen CTA is below the 44px mobile target")
        action.focus()
        page.keyboard.press("Enter")
        page.wait_for_function("() => document.activeElement?.id==='stage-play'",
                               timeout=TIMEOUT)
        page.locator("#preview-recovery").wait_for(state="visible",timeout=TIMEOUT)
        require(requests["preview"]>=1,
                "Guide did not call the actual Deezer on-demand preview flow")
        saved=page.evaluate("""() => {
          const data=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
          return {history:data.history||[],favorites:data.favorites||[]};
        }""")
        require(not saved["history"] and not saved["favorites"],
                "Opening a first preview accidentally created a rating")
        require(page.locator(".first-listen-guide").is_visible(),
                "Guide disappeared before any Keep/Pass choice")
        page.locator("#listening-card [data-action='pass']").click()
        page.wait_for_function("""() =>
          JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}')
             .history?.length===1""",timeout=TIMEOUT)
        require(page.locator(".first-listen-guide").count()==0,
                "First-listen guide was not dismissed after an actual choice")
        require(not errors,"First-listen browser errors: "+"; ".join(errors))
        print(f"PASS {label}: direct Play, real on-demand request, keyboard focus, no false rating")
    except Exception:
        screenshot(page,f"FAILED-{label}")
        raise
    finally:
        context.close()


def check_first_listen_provider_retry(browser, base):
    """No first recording: show actionable retry without losing saved choices."""
    origin=urlsplit(base).netloc
    context=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    counts={"failures":0}
    errors=[]
    context.route("**/*",lambda route:route.continue_()
                  if urlsplit(route.request.url).netloc==origin else route.abort())
    def offline_provider(route):
        parsed=urlsplit(route.request.url)
        callback=parse_qs(parsed.query).get("callback",[""])[0]
        if not re.fullmatch(r"__aftertoneDeezer_\d+",callback):
            route.abort()
            return
        counts["failures"]+=1
        body={"error":{"code":429,"message":"Temporary fictional provider outage"}}
        route.fulfill(status=200,content_type="application/javascript",
                      body=f"window[{json.dumps(callback)}]({json.dumps(body)});")
    context.route("https://api.deezer.com/**",offline_provider)
    page=context.new_page()
    page.on("pageerror",lambda error:errors.append(str(error)))
    label=f"first-listen-retry-{browser.browser_type.name}"
    try:
        page.goto(base+"/demo/",wait_until="load",timeout=TIMEOUT)
        empty=page.locator(".discovery-empty-state")
        empty.wait_for(state="visible",timeout=TIMEOUT)
        page.wait_for_function("""() =>
          document.querySelector(".first-listen-actions [data-action='load-more']")
            ?.textContent?.includes('Retry Finding Music')""",timeout=TIMEOUT)
        close=page.locator('#modal-root button[data-modal="close"]')
        if close.count():close.first.click(timeout=TIMEOUT)
        action=page.locator(".first-listen-actions [data-action='load-more']")
        require(action.is_enabled(),"Outage made the guided Retry button unavailable")
        initial=counts["failures"]
        require(initial>0,"First-run provider outage was not simulated")
        action.click()
        page.wait_for_function("""() => !document.querySelector(".first-listen-actions button")?.disabled""",
                               timeout=TIMEOUT)
        require(counts["failures"]>initial,
                "First-run Retry did not explicitly bypass automatic provider cooldown")
        saved=page.evaluate("""() => {
          const data=JSON.parse(localStorage.getItem('aftertone:session:v1')||'{}');
          return {history:data.history||[],favorites:data.favorites||[]};
        }""")
        require(not saved["history"] and not saved["favorites"],
                "Retrying the first song invented preferences or rated songs")
        require(not errors,"First-listen outage errors: "+"; ".join(errors))
        print(f"PASS {label}: recoverable empty state and manual retry without phantom votes")
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
            check_progressive_discovery_backoff(browser, base)
            check_backup_restore_cross_browser(browser, base)
            check_backup_transfer_new_profile(browser, base)
            check_reflow_reduced_motion(browser, base, 720, 900)
            check_reflow_reduced_motion(browser, base, 360, 740)
            check_preview_recovery_keyboard(browser, base)
            check_deezer_preview_quota_recovery(browser, base)
            check_deezer_preview_on_demand(browser, base)
            check_first_listen_guided_play(browser, base)
            check_first_listen_provider_retry(browser, base)
            check_abandoned_preview_metadata_cancellation(browser, base)
            check_play_cancels_pending_preview(browser, base)
            check_media_error_refresh_cancellation(browser, base)
            check_modal_interrupts_pending_preview(browser, base)
            check_choice_keyboard_focus(browser, base)
            check_tune_lab_keyboard_continuity(browser, base)
            check_duels_keyboard_continuity(browser, base)
            check_shared_deezer_challenge(browser, base)
            check_curated_shared_challenge(browser, base)
            check_resumable_shared_challenge_draft(browser, base)
            check_shared_challenge_outage_recovery(browser, base)
            check_shared_preview_failure_skip(browser, base)
            check_theme_dialog_focus(browser, base)
            check_optional_lyrics_request_cancellation(browser, base)
            check_listening_control_focus_on_rerender(browser, base)
            check_discovery_path_keyboard_continuity(browser, base)
            check_safe_music_shortcuts(browser, base)
            check_search_draft_survives_rerenders(browser, base)
            check_collection_search_recovery(browser, base)
            check_collection_csv_formula_safety(browser, base)
            check_collection_undo_remove(browser, base)
            check_cancel_stale_discovery(browser, base)
            check_artist_outage_without_fallback(browser, base)
            check_mobile_filters_keyboard(browser, base, 390)
            check_mobile_filters_keyboard(browser, base, 320)
            check_swipe_pointer_safety(browser, base, 390)
            check_swipe_pointer_safety(browser, base, 320)
            check_playlist_dialog_cancellation(browser, base)
            check_stale_related_profile_cancellation(browser, base)
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
            check_progressive_discovery_backoff(browser, base)
            check_backup_restore_cross_browser(browser, base)
            check_backup_transfer_new_profile(browser, base)
            check_reflow_reduced_motion(browser, base, 720, 900)
            check_reflow_reduced_motion(browser, base, 360, 740)
            check_preview_recovery_keyboard(browser, base)
            check_deezer_preview_quota_recovery(browser, base)
            check_deezer_preview_on_demand(browser, base)
            check_first_listen_guided_play(browser, base)
            check_first_listen_provider_retry(browser, base)
            check_abandoned_preview_metadata_cancellation(browser, base)
            check_play_cancels_pending_preview(browser, base)
            check_media_error_refresh_cancellation(browser, base)
            check_modal_interrupts_pending_preview(browser, base)
            check_choice_keyboard_focus(browser, base)
            check_tune_lab_keyboard_continuity(browser, base)
            check_duels_keyboard_continuity(browser, base)
            check_shared_deezer_challenge(browser, base)
            check_curated_shared_challenge(browser, base)
            check_resumable_shared_challenge_draft(browser, base)
            check_shared_challenge_outage_recovery(browser, base)
            check_shared_preview_failure_skip(browser, base)
            check_theme_dialog_focus(browser, base)
            check_optional_lyrics_request_cancellation(browser, base)
            check_listening_control_focus_on_rerender(browser, base)
            check_discovery_path_keyboard_continuity(browser, base)
            check_safe_music_shortcuts(browser, base)
            check_search_draft_survives_rerenders(browser, base)
            check_collection_search_recovery(browser, base)
            check_collection_csv_formula_safety(browser, base)
            check_collection_undo_remove(browser, base)
            check_cancel_stale_discovery(browser, base)
            check_artist_outage_without_fallback(browser, base)
            check_mobile_filters_keyboard(browser, base, 390)
            check_mobile_filters_keyboard(browser, base, 320)
            check_swipe_pointer_safety(browser, base, 390)
            check_swipe_pointer_safety(browser, base, 320)
            check_playlist_dialog_cancellation(browser, base)
            check_stale_related_profile_cancellation(browser, base)
        finally:
            browser.close()
    print("PASS all browser checks. Live provider playback was not tested.")

if __name__ == "__main__":
    if "--firefox" in sys.argv:
        firefox_main()
    else:
        main()
