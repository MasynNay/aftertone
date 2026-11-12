#!/usr/bin/env python3
"""Browser-level smoke checks for the actual generated AFTERTONE Pages site.

Third-party Deezer requests are mocked with fictional track data. This checks
our deployed UI, not provider availability or media playback permissions.
"""
import json
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

        page.locator("#explore-experience").click()
        page.wait_for_url("**/demo/", timeout=TIMEOUT)
        page.locator("#main-content .discovery-paths").wait_for(state="attached", timeout=TIMEOUT)
        page.locator("#listening-card").wait_for(state="attached", timeout=TIMEOUT)
        require(page.locator("#player").count() == 1, "Original audio element missing")
        require(page.locator("#main-content [data-path]").count() >= 3,
                "Discovery path controls did not render")
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
            page.locator('#main-nav button[data-view="duels"]').click()
            page.locator("#main-content .duels-page .duel-arena-picker").wait_for(
                state="attached", timeout=TIMEOUT)
            screenshot(page, f"duels-{label}")
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
