# Browser Smoke Testing

The published AFTERTONE site has two entry points: the portfolio homepage at / and the original interactive music application at /demo/. In an earlier deployment, missing CSS and JavaScript imports produced a blank or unstyled screen even though static unit tests succeeded.

## Automated deployment gate

The GitHub Pages workflow builds the site with `npm run check`, installs Playwright, Chromium and Firefox, then runs both `python scripts/browser-smoke.py` and `python scripts/browser-smoke.py --firefox` before uploading the Pages artifact.

The app's build validation also checks local CSS `url()` references inside `dist/` using `scripts/check-css-assets.mjs`. The existing styles currently have no local asset URL references, so focused fixture tests ensure missing assets and traversal are rejected when encountered. This check never downloads remote resources.

The script serves the actual generated dist/ directory through a localhost HTTP server. In desktop Chromium (1440×900) and mobile Chromium (390×844 and 320×740) it checks homepage styling and the direct listening link, navigates into the real app, verifies the listening card and three discovery paths, and checks Collection and Music Duels navigation on desktop. It also checks keyboard dialog focus cycling/return, narrow-phone overflow, and 44px hit rectangles for the Filters/theme/sound/help controls and all six navigation buttons on 390px and 320px screens. Missing local assets, HTTP errors and uncaught JavaScript exceptions cause a failure.

A separate Firefox smoke pass checks desktop 1440×900 and phone 390×844 / 320×740: real homepage to app launch, first-run dialog Tab wrapping and Escape focus restoration, native Space navigation, all six app sections and their accessible labels/titles, mobile overflow/touch targets and browser JavaScript errors. It is a browser regression gate, **not** a manual cross-browser accessibility audit.

Both browser passes intercept Deezer JSONP calls with deterministic fictional fixture metadata and block all other external requests. This tests our own routing and interface behavior; **it does not prove real Deezer availability, playback, usage permission, or media licensing**.

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
