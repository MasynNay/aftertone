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

## Verified published milestone — November 7, 2026

- Restored original app was published in GitHub Pages run 42407689597, completed successfully.
- Local tests: 235 passing; static module imports: 41 checked, zero missing; local server smoke check: passed.
- Deezer browser playback remains unverified in this restricted sandbox (Chromium navigation blocked, outbound DNS unavailable). Do not claim it is live-tested.
- Next external smoke test: hard-refresh aftertone.masynnay.com, search artist, play real preview, volume, autoplay, Keep, Music Duels.
- Public use of Deezer previews for a music game may require Deezer's authorization.
