# AFTERTONE development checkpoint — 2026-11-07

## Why this recovery exists

The first GitHub Pages version called "v1.0.1" was an independent, 12-track fictional static showcase. It **did not** retain the original app or Deezer features. The user explicitly rejected this replacement. Do not ever re-label that showcase as the complete app.

## Restored / built

- Source: genuine AFTERTONE v0.10.0 from preserved `AFTERTONE_FULL_LOCAL_v0.10.0_MAC.tar.gz`.
- Version set to 0.10.1. Preserved original server, user state keys, CSS/themes, player, autoplay, Duels, Collections and discovery modules.
- Added `src/static-adapter.mjs` and `public/api-browser.js`, which mirror the server's important `/api/*` endpoints in the browser using Deezer's public JSONP API. Browser code directly uses signed Deezer preview CDN URLs on demand.
- Original main UI now uses `apiFetch` for its seven API routes. In the local server on port 4173, this delegates to original Node routes; on public static hosting, it uses the browser adapter.
- Static build publishes original UI and shared modules, rewrites absolute module paths to relative paths for GitHub Pages and installs a CNAME.
- Browser adapter contract tests use mocked Deezer JSONP. `npm run check` should pass **217 automated tests**. E2E Chromium and external Deezer were not possible in current sandbox (browser navigation blocked by administrator, outbound DNS unavailable). DO NOT claim real live Deezer playback is verified.

## Deployment plan

1. Replace the *repository source files* with this recovery package (not the `dist/` output only). Keep `.github/workflows/pages.yml` GitHub Pages Actions workflow.
2. Run checks and deploy. Verify Actions success and check `https://aftertone.masynnay.com` with browser developer tools.
3. Confirm actual Deezer tracks, artwork, preview play, autoplay, search and at least one Duels matchup on the deployed domain.
4. Obtain provider approval for long-term public discovery-game use.

## Known boundaries

- GitHub Pages has no backend; this adapter uses trusted-domain JSONP so it can query Deezer without an open public CORS proxy. Deezer could remove JSONP in the future.
- Live Deezer availability and audio playback have **not** been network verified in this sandbox. Do not misrepresent simulated tests as live validation.
- Optional lyrics may require an authorized lyrics integration and a CORS-permitting endpoint.
- User should not need to redo Cloudflare CNAME (`aftertone` → `masynnay.github.io`), since this preserves the existing GitHub Pages domain.

## VERIFIED PUBLISHED MILESTONE — 2026-11-07

- Restoration commit `38a6d4660f542d6661cb5085151f00c136ef812a` was pushed to `main`, with GitHub Pages workflow run `42407689597` completed **successfully**.
- This replaces the 12-song fictional site with the original v0.10 UI and the browser-side Deezer adapter.
- Local `npm run check` reported **235/235 passing** on Node.js v22.16.0.
- Static dependency scan: **41 JavaScript modules, 0 missing static imports, 0 Node-only module imports**.
- Local Node `/api/health` and `/` smoke checks passed. Version labels updated to v0.10.1.
- The sandbox blocks all Chromium navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR` and cannot DNS-resolve `api.deezer.com`; therefore **LIVE Deezer playback is not yet browser-verified**. The provider's JSONP pattern was supported in external testing as of October 2026, but this does not replace a direct verification of this site.
- Next manual validation on a normal device: open `https://aftertone.masynnay.com`, hard-refresh, search an artist, play a real Deezer preview, change volume, let autoplay advance, Keep a track, and open Music Duels. Check browser console/network for errors.
- Deezer API accessibility does NOT grant legal permission for public music games. Consult provider terms and obtain approval where required. The local Node app is preserved.

## Portfolio landing and embedded original demo — November 7, 2026

- `site/` contains the restored informational landing page adapted from the previous portfolio experience, a once-per-session disclaimer dialog, and an iframe of the **original** `/demo/` application. No mock music demo or commercial media has been copied into the page.
- `scripts/build-static.mjs` now publishes `site/index.html` at the domain root and the untouched `public/` app with `src/` modules under `/demo/`. The original Node server continues to serve its existing `public/` paths locally.
- `site/splash.js` stores dismissal only under `sessionStorage` key `aftertone:portfolio-intro:v1`; original app state is untouched in localStorage. The `allow="autoplay"` iframe attribute supports playback after a user gesture, not unprompted audio.
- The portfolio disclaimer makes the site's independent, experimental nature and third-party media limitations clear; a disclaimer does not grant music usage rights. Deezer live browser access cannot be tested from the restricted browser sandbox.
- Browser rendering of the marketing shell and modal was checked with Playwright `set_content` (network navigation was blocked by administrator); DOM + static build checks run locally.
- Next check after deployment: browse the root, dismiss splash, scroll to live demo, confirm real Deezer search, artwork and preview, and click Open full screen; verify both views use the same saved collection.

## Portfolio splash and repository cleanup checkpoint — 2026-11-07

- Added first-visit modal disclaimer and product/engineering portfolio landing, with the real application embedded at `/demo/` and a full-screen link.
- Consolidated original app files under `app/` and moved launchers under `scripts/launch/`; moved this checkpoint under `docs/development/`.
- Preserved local `npm start`, build, GitHub Pages workflow, and original app behavior.
- Before publishing: `npm run check` and browser smoke-test landing, modal, iframe, Deezer-shaped data, and direct app route.
- Do not confuse GitHub Pages build success with real Deezer preview approval or live provider playback.

## Live-site CSS and app boot repair — November 7, 2026

Root cause identified from user screenshots:
1. `site/index.html` referenced `./assets/styles.css`, but the build publishes `site/styles.css` to `dist/styles.css`. Portfolio landing and welcome modal therefore rendered as unstyled HTML.
2. The static build moved `app/public` into `dist/demo/`, but only adjusted root imports in `main.js` and `api-browser.js`. `views.js` and `duels-view.js` continued importing `../src/...`, which resolves outside `/demo/` and breaks the browser module graph, leaving an empty app content area.

Repair:
- Update portfolio stylesheet to `./styles.css`.
- Rewrite browser module imports from both `/src/...` and `../src/...` to `./src/...` in every published public module.
- Make the introductory portfolio disclaimer a genuine edge-to-edge full-screen modal with a clear primary **Enter AFTERTONE** link to the real `/demo/` app, and a secondary portfolio-info option.
- Upgrade `scripts/check-site.mjs` to validate emitted CSS/HTML paths and **every locally imported ES module** (including indirect imports), not just string snippets.
- Local Node checks after repair: 217/217 pass; static build passes; import graph validates 40 modules and 67 local imports. Chromium `page.set_content()` visual rendering verifies 1440x900 full-screen modal and styled landing; complete live navigation and Deezer playback are blocked from sandbox network access and must not be represented as verified.

Upon committing, confirm GitHub Actions succeeds and have user hard-refresh `https://aftertone.masynnay.com/` and `https://aftertone.masynnay.com/demo/`. The real provider's Deezer access still depends on Deezer JSONP/CDN availability.


## Keystoria-style portfolio homepage redesign — November 7, 2026

- User requested no mandatory portfolio disclaimer popup and an introductory showcase like `keystoria.masynnay.com`, with **Explore the Experience** directly launching the original app.
- Rebuilt `site/index.html` and `site/styles.css` as a standalone portfolio experience: Keystoria-inspired hero, four experience cards, listening-interaction spotlight, engineering cards, inline third-party rights notice and direct-launch CTA. AFTERTONE's original lime/charcoal visual identity retained.
- The homepage's illustrative UI preview is labeled as an illustration, not a real screenshot or live player. The actual unchanged application remains at `/demo/`.
- Removed the obsolete `site/splash.js` and build copy; no HTML dialog, iframe, or JavaScript remains on the portfolio homepage.
- Added `test/portfolio-navigation.test.mjs` and updated `scripts/check-site.mjs` to check direct routes, published CSS, no dialog/iframe, app ESM imports and Deezer adapter.
- **Do not roll back to a modal or embedded player**. User prefers the direct-launch portfolio flow used by Keystoria.
- Verify `npm run check` and GitHub Actions deploy. Live Deezer playback still needs verification in a real browser and rights review; do not overclaim.

## README application gallery — November 7, 2026

- Rendered the actual `dist/demo/` application UI in Chromium using the published ES module graph, with a **screenshot-only mocked provider** because local/live page navigation was restricted in this environment.
- Captured actual views for Discover, Collection (five Keep actions), and Music Duels arena selection, with synthetic sample titles and locally authored placeholder album art. Screenshot captures do **not** imply successful Deezer playback or media permission.
- Gallery assets: `docs/screenshots/app-discover.webp`, `app-collection.webp`, and `app-music-duels.webp`. README now displays the app gallery ahead of the portfolio screenshot and includes a clear fixture disclosure.
- Verified `npm run check`: **221/221 tests passing**, build and 67-import ESM graph checks passing. No files in `app/` changed.
- Follow-up: when permitted, manually capture genuine Deezer music screens with authorization and replace sample-data screenshots. Keep rights and provenance honest.


## Editorial consistency pass — November 7, 2026

- Revised visible presentation copy: navigation, title case for discovery paths and section headings, capitalization of tournament actions, Runners-up pluralization, punctuation, and app metadata.
- Updated three existing snapshot-like text assertions, and added three focused editorial consistency tests. Full local `npm run check` passed **224/224 tests**, with static build and **67/67 local ESM import links** validated.
- Scope is intentionally copy-only; preserve routes, controls, source IDs, data keys, Deezer adapter and business logic. README section casing and changelog aligned.
- Check GitHub Pages build after publishing. Live provider playback is not exercised by CI and must never be described as verified merely because CI passes.

## JSONP concurrent abort isolation — November 9, 2026 (PR pending)

- Found a request-lifecycle defect in `app/src/static-adapter.mjs`: identical in-flight JSONP requests shared one Promise but only the first caller's abort signal was wired. Canceling one listener could cancel another, while canceling a later listener had no effect. This can disrupt simultaneous discovery actions.
- Branch `fix/jsonp-request-isolation` removes shared in-flight Promise reuse so every caller owns its script, callback, timeout and abort handler. Added `test/jsonp-isolation.test.mjs` to assert concurrent identical requests are isolated and cleaned up.
- GitHub Actions `pages.yml` now runs `npm run check` on PRs, with deployment disabled for PR events. Main branch deployment behavior remains unchanged.
- Validation status: code and test committed; GitHub PR checks must run before merging. No live Deezer playback, browser navigation or music permissions have been verified by this change. Issue #2 remains open for broader recovery behavior.

## JSONP failure recovery regression — November 11, 2026 (PR #9)

- Added `test/jsonp-failure-recovery.test.mjs` on PR #9 to cover simulated script network failures, callback/script cleanup, successful subsequent requests, timeout cleanup and harmless late error events. These tests exercise the browser adapter's failure path without contacting Deezer.
- Commit `b0d3394a3ef5c0d8fbb64ba10f37945bc6d9d95b`. Run `npm run check` in GitHub Actions and inspect the PR checks before merging. Neither mock tests nor CI establish live preview playback or media rights.
- Issue #2 remains open: user-visible retry/skip/autoplay behavior and real browser verification are not yet covered.
