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
        require(page.locator('link[rel="stylesheet"]').first.evaluate("(el) => Boolean(el.sheet)"),
                "App stylesheet failed to load")
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
            with page.expect_download(timeout=TIMEOUT) as hall_download:
                page.locator('[data-duel-action="export-hall"]').click()
            hall = Path(hall_download.value.path()).read_text(encoding="utf-8")
            require("Track Name" in hall and "Fixture Melody" in hall,
                    "Hall of Fame export must contain podium metadata")
            screenshot(page,f"music-duels-complete-{label}")
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

def main():
    with serve_build() as base, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            browser_case(browser, base, 1440, 900)
            browser_case(browser, base, 390, 844)
        finally:
            browser.close()
    print("PASS all browser checks. Live provider playback was not tested.")

if __name__ == "__main__":
    main()
