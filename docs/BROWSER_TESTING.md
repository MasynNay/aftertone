# Browser Smoke Testing

The published AFTERTONE site has two entry points: the portfolio homepage at / and the original interactive music application at /demo/. In an earlier deployment, missing CSS and JavaScript imports produced a blank or unstyled screen even though static unit tests succeeded.

## Automated deployment gate

The GitHub Pages workflow builds the site with `npm run check`, installs Playwright, Chromium and Firefox, then runs both `python scripts/browser-smoke.py` and `python scripts/browser-smoke.py --firefox` before uploading the Pages artifact. To avoid re-downloading the two large browser binaries on every run, the workflow caches `~/.cache/ms-playwright` with a key tied to the GitHub runner OS/architecture, Ubuntu 24.04 and the pinned `playwright==1.56.0` version. A cache miss downloads both browsers normally, and system dependencies are installed on every fresh runner. The cache is a performance optimization only: **all Node checks, Chromium tests, Firefox tests and the Pages deploy gate still run**.

The backup regression suite also transfers a real downloaded progress file into an entirely **new browser context** in Chromium and Firefox separately, with independent localStorage. It verifies the import confirmation and all backed-up data after reload. This is stronger than clearing the same session, but it does not simulate two physical devices or a transfer between browser engines.

The app's build validation also checks local CSS `url()` references inside `dist/` using `scripts/check-css-assets.mjs`. The existing styles currently have no local asset URL references, so focused fixture tests ensure missing assets and traversal are rejected when encountered. This check never downloads remote resources.

The script serves the actual generated dist/ directory through a localhost HTTP server. In desktop Chromium (1440×900) and mobile Chromium (390×844 and 320×740) it checks homepage styling and the direct listening link, navigates into the real app, verifies the listening card and three discovery paths, and checks Collection and Music Duels navigation on desktop. It also checks keyboard dialog focus cycling/return, narrow-phone overflow, and 44px hit rectangles for the Filters/theme/sound/help controls and all six navigation buttons on 390px and 320px screens. Missing local assets, HTTP errors and uncaught JavaScript exceptions cause a failure.

A separate Firefox smoke pass checks desktop 1440×900 and phone 390×844 / 320×740: real homepage to app launch, first-run dialog Tab wrapping and Escape focus restoration, native Space navigation, all six app sections and their accessible labels/titles, mobile overflow/touch targets and browser JavaScript errors. It is a browser regression gate, **not** a manual cross-browser accessibility audit.

The static browser adapter now forwards route cancellation into Deezer's JSONP lookups, including the provider's nested artist resolution requests, while retaining each lookup's timeout. Node regressions ensure an aborted request removes its script and callback, does not launch a fallback search, and is not reported as a new provider outage. Chromium and Firefox also hold an old artist lookup unanswered, submit a new successful query, and assert the old script/callback is gone without a reload, false vote or overwritten search. Fixture metadata is fictional; this is not a live-provider availability or rights audit.

The Chromium and Firefox smoke suites also simulate an HTTP-200 JSONP provider error, verify the user sees a nonblank **Music Is Temporarily Unavailable** state and usable Retry Discovery control, then restore fixture responses and retry without reloading or changing favorites/history. These deterministic simulations cannot establish actual provider uptime or availability by region.

The Chromium and Firefox suites also verify **artist-index outage traffic**: a fictional Deezer JSONP 503 response must surface a recoverable provider error with no extra ranked search request, then permit a manual Retry Discovery after the service recovers without losing favorites or voting. Node tests separately exercise timeout, 5xx and HTTP 400/404 fallback behavior. These tests do not connect to the real Deezer service.

The Chromium and Firefox smoke suites now also exercise a **real JSON file download and file-input restore**. Each test creates fictional favorites and one listening choice, exports a version-2 backup including favorite artists, Tune Lab results, imported-playlist metadata and lyric timing adjustments, rejects an unsupported version without modifying storage, deliberately clears local progress, imports the saved file through the app’s destructive confirmation dialog, and verifies the restored favorite appears in Collection after reload. This tests both browser engines independently without an account or external music calls. It does not simulate a second physical device or guarantee future backup schema compatibility.

The suite also checks both engines under **reduced motion** at narrow 720px and 360px CSS viewport widths, inspecting all six views for horizontal document overflow and clipped primary controls. These viewports are reflow/zoom-equivalent proxies, **not literal browser zoom tests**; a manual 200% zoom test is still required.

Both engines now additionally simulate a Deezer preview-metadata rate limit (429 inside HTTP 200 JSONP). The browser tests require a visible **wait-before-retrying** explanation, then switch metadata responses back to success, exercise **Retry Preview**, and confirm the message returns to ordinary CDN-failure guidance if audio remains blocked. No fake Keep/Pass votes are created. This is entirely fixture-backed and does not establish actual Deezer service availability or music-use permissions.

Real Chromium and Firefox tests now also assert **on-demand Deezer preview metadata**: opening Discover and navigating to Collection or Music Duels must issue **zero** `/track/` metadata lookups before the listener presses Play. Clicking Play must make the first preview lookup, with blocked media and no false listening votes. Catalog/artist metadata may still be loaded for discovery. This reduces unnecessary calls; it does not prove provider playback or media-use permission.

Both browser engines also simulate a blocked audio CDN and use **real keyboard activation** of Retry Preview and Skip Without Voting. The checks require a fresh provider-resolution request, keyboard focus returned to a visible Play button (or the main landmark on an exhausted feed), and **no accidental Keep/Pass vote**. Provider metadata remains fictional and media requests remain blocked.

The current public app is Deezer-only. The dormant local mixed-source planner has independent Node tests for temporary provider failures: outages exclude a provider from the **current request batch** without permanently marking its catalog exhausted, so a subsequent request may retry. This is a unit/source-wiring regression test, **not** a browser test of live Audius/Jamendo/Commons/Jellyfin providers or proof of usage permissions.

The Deezer outage recovery tests now explicitly simulate a provider rate-limit (429) inside HTTP 200 JSONP and require the visible error to advise a short wait before Retry Discovery. Node tests independently cover direct HTTP 429, search/artist throttling and artist-top throttling without issuing redundant fallback requests. These are fictional fixtures and **do not** establish provider uptime or permission.

Both browser passes intercept Deezer JSONP calls with deterministic fictional fixture metadata and block all other external requests. This tests our own routing and interface behavior; **it does not prove real Deezer availability, playback, usage permission, or media licensing**.

**Successful pull-request builds** now attach a seven-day `aftertone-ui-evidence` artifact with browser-generated desktop captures of the marketing page, Discover, Music Duels setup, an **in-progress four-song bracket**, and the completed podium. These use fictional fixture tracks, real rendered application markup and blocked external requests. This makes feature screenshots reviewable before they are copied into permanent README assets. The existing failure artifact is separate. Images do not demonstrate live music provider playback, content permissions or a human accessibility audit.

Pull requests run the same checks but **never deploy**. Main-branch pushes deploy only after the test job succeeds. Failure screenshots are uploaded to the aftertone-browser-debug workflow artifact for seven days.

## Local verification

1. Install Node.js 22+ and Python 3.12+.
2. Run npm run check to generate dist/.
3. Install Playwright: python -m pip install playwright==1.56.0
4. Install browsers: `python -m playwright install chromium firefox` (and operating-system dependencies as required).
5. Run Chromium checks: `python scripts/browser-smoke.py`
6. Run Firefox checks: `python scripts/browser-smoke.py --firefox`

If an environment blocks Chromium network navigation, report that limitation instead of asserting the browser test passed. Consult the GitHub Actions logs.

## Real-provider smoke check (still manual)

After a release, open the deployed /demo/ application in Firefox and Chrome. Search an artist, play a real preview when authorized and available, adjust volume, confirm autoplay after a user gesture, Keep and Pass a track, reopen Collection, and complete a Music Duels matchup. Note any third-party failures or regional restrictions and check that the app does not go blank.

These checks must be performed on the real website to validate providers. No automated fixture grants permission for public use of third-party media.
