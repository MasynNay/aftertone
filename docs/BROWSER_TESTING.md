# Browser Smoke Testing

The published AFTERTONE site has two entry points: the portfolio homepage at / and the original interactive music application at /demo/. In an earlier deployment, missing CSS and JavaScript imports produced a blank or unstyled screen even though static unit tests succeeded.

## Automated deployment gate

The GitHub Pages workflow builds the site with npm run check, installs Playwright and Chromium, and then runs python scripts/browser-smoke.py before uploading the Pages artifact.

The script serves the actual generated dist/ directory through a localhost HTTP server. In desktop and mobile Chromium it checks homepage styling and the direct Explore the Experience link, navigates into the real app, verifies the listening card and three discovery paths, and checks Collection and Music Duels navigation on desktop. Missing local assets, HTTP errors and uncaught JavaScript exceptions cause a failure.

The script intercepts Deezer JSONP calls with deterministic fictional fixture metadata and blocks all other external requests. This tests our own routing and interface behavior; **it does not prove real Deezer availability, playback, usage permission, or media licensing**.

Pull requests run the same checks but **never deploy**. Main-branch pushes deploy only after the test job succeeds. Failure screenshots are uploaded to the aftertone-browser-debug workflow artifact for seven days.

## Local verification

1. Install Node.js 22+ and Python 3.12+.
2. Run npm run check to generate dist/.
3. Install Playwright: python -m pip install playwright==1.56.0
4. Install Chromium: python -m playwright install chromium
5. Run python scripts/browser-smoke.py

If an environment blocks Chromium network navigation, report that limitation instead of asserting the browser test passed. Consult the GitHub Actions logs.

## Real-provider smoke check (still manual)

After a release, open the deployed /demo/ application in Firefox and Chrome. Search an artist, play a real preview when authorized and available, adjust volume, confirm autoplay after a user gesture, Keep and Pass a track, reopen Collection, and complete a Music Duels matchup. Note any third-party failures or regional restrictions and check that the app does not go blank.

These checks must be performed on the real website to validate providers. No automated fixture grants permission for public use of third-party media.
