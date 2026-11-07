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
