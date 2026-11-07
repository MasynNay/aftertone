# AFTERTONE portfolio release journal (append-only)

## 2026-11-07 · Static portfolio architecture chosen

- Located the actual v0.10.0 Music Arenas project archive, with 211 passing automated tests in its source history.
- Checked accessible GitHub repositories. No AFTERTONE repository currently exists; multiple different portfolio repositories exist, so no remote repository was overwritten.
- Chose to keep the provider-dependent local application separate from the publicly hosted portfolio showcase, to reduce reliance on copyrighted music, third-party APIs and provider game authorization.

## 2026-11-07 · Standalone showcase built

- Created a responsive case-study website with original CSS artwork, product-story sections and architecture explanation.
- Implemented a static interactive demo with twelve fictional tracks, eight-second original Web Audio synth motifs, volume slider, three discovery modes, Keep/Pass/Undo, Blind, Collection and Music Duels.
- Extracted the demo's path selection and tournament state machine into pure, documented, dependency-free functions.
- Added the GitHub Pages workflow, static build script, browser preview server, privacy notes and clear deployment instructions.

## 2026-11-07 · Verification

- Ran 15 standalone demo unit tests: all passing.
- Built the restricted `dist/` static payload; confirmed it contains no local app server, music provider adapters, API secrets or lyrics files.
- Chromium direct navigation to the local test server returned ERR_BLOCKED_BY_ADMINISTRATOR in this sandbox. The site itself served HTTP 200.
- Reconstructed the same HTML/CSS/scripts in an isolated Chromium page and tested desktop 1440px and mobile 390px layouts: no horizontal overflow or JavaScript page errors.
- Interactively verified Wild Card mode switching, Play/Pause, Keep, Undo, and a full four-match tournament through podium in both viewports.

## Release and next milestone

- To publish, create/select a new GitHub repository, upload source root to `main`, enable GitHub Pages using Actions, and test the actual public Pages URL.
- Do not claim that public deployment has already occurred: the GitHub repository and Pages action require the account owner's chosen destination and normal GitHub setup.
- Keep the local provider-based application separate from the static demo unless music and lyrics display rights are explicitly cleared.

## 2026-11-07 — v1.0.1 continuity and publishing package

- A user requirement clarified the publishing gate: **preserve autoplay and do not discard full-app functionality**.
- Kept the original v0.10.0 full Mac app archive unchanged. Confirmed that its 211 Node checks pass.
- The static portfolio now exposes autoplay On/Off (default On), auto-advances after audio finishes, continues across Keep/Pass/Skip and a discovery-route change while listening, and retains persisted preview volume. Added manual Skip without counting a decision, JSON/CSV collection downloads and Web Audio async-start cancellation.
- Added `test/audio.test.mjs`: verifies timer/oscillator cleanup, end callback and another play, and racing pause versus delayed `AudioContext.resume()`.
- `npm run check`: **18/18 passing**, clean static build. HTML/CSS/JS are dependency-free; live site has no network calls or provider keys.
- Isolated Chromium `page.set_content` smoke test (injected local module assets because normal navigation is blocked in this build sandbox) verified track autoplay after >8 seconds, Skip count unchanged, working persisted option state during the session, Keep, collection JSON/CSV downloads, completed 4-match tournament and visible mobile controls. No page errors were observed. This test did **not** validate public GitHub Pages hosting or cross-page localStorage persistence in a real HTTP origin.
- Repo creation/deployment not yet performed: the connected GitHub tools cannot create a repository and `MasynNay/aftertone-showcase` is not available. User should create an empty repository, push prepared source, and select Pages/Actions; then deployed-site verification is required.
- IMPORTANT: static public demo is **not** the server-backed full app. Do not merge unlicensed music integrations, run them as a public hosted service or claim every local v0.10.0 feature runs in static Pages. Full local archive remains available intact as the companion delivery.

## 2026-11-07 — Canonical repository and domain decision

- User selected `MasynNay/aftertone` as the GitHub repository and `aftertone.masynnay.com` as the recommended project URL. Old `aftertone-showcase` references in active setup documents were replaced; historical entries above remain unchanged as an audit trail.
- GitHub connector confirmed the desired repository is currently absent and does not expose a create-repository action, nor does it expose GitHub Pages settings or Cloudflare DNS management. Do not claim a live deployment.
- Created `docs/CUSTOM_DOMAIN.md` with GitHub Pages + Cloudflare DNS-only CNAME directions and verification steps. Full local v0.10.0 archive remains untouched.
