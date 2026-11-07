# v0.10.0 — Music Arenas & Hall of Fame

- Added six Music Duels arena presets with distinct, testable entry criteria. Pop vs Rock is balanced and uses verified genre metadata; 2000s Throwback requires genuine release-year metadata. No genre/year guessing.
- Added mystery tournament presentation: hidden artwork and artist/title in contender cards, bracket, and status until the tournament ends. Older brackets remain readable.
- Added a derived Hall of Fame with gold/silver/bronze podium tallies, Champions Cup victories, sortable deterministic points, all-time and UTC-quarterly leaderboards.
- Added Hall of Fame leaderboard CSV export and explicit Save Champions to Collection action, preserving the existing podium exports.
- Reused the existing `aftertone:duels:v1` local storage key and compatible snapshots; old completed tournaments remain available. No new accounts, APIs, or third-party packages.
- Added targeted tests for theme selection, missing metadata, mystery concealment, full tournament completion, derived rankings, season filtering, exports, and prior archive compatibility.
- Maintained the licensing caveat: short Deezer previews are a technical prototype, not a public music-game license. Real audio and the full browser interaction require device testing.

# v0.9.4 — Comfortable Listening

- Added shared, persistent 0–100% volume slider on the music card and tournament previews; new installs and legacy saved sessions start at a safe 35% when no volume is stored.
- Muting preserves the chosen level; zero-to-unmute restores the safe default; volume adjusts immediately without restarting the current preview.
- Prevented slider dragging from being interpreted as Pass or Keep. Included keyboard and accessible label/output controls.
- Added `src/volume.mjs` pure logic and seven regression tests; retained all v1 storage fields, songs, favorites, themes, playlist imports and Duels history.
- 201 automated tests pass, Node syntax verification succeeds; streaming/browser interaction still requires user-device testing. Public licensing is not established.

# v0.9.3 — Responsive artist search and distinct first impressions

- **Fixed:** switching discovery paths immediately playing songs from a shared queue before fetching the selected path's own music.
- **Fixed:** active manual searches remaining in effect when choosing Comfort Zone, New Territory or Wild Card.
- **Improved:** Deezer artist searches now resolve an exact artist via `/search/artist` and load `/artist/{id}/top` instead of unreliable `artist:"..."` text filters. Exact artist identity is checked and covers remain excluded.
- **Improved:** sparse or unavailable artist top pages gracefully retry with ranked plain search (with exact artist checks for seeded requests). Song-title searches remain supported.
- **Improved:** active path requests take precedence; shared results are a transparent last resort after a route is primed. A loading state prevents misleading "instant" duplication.
- **Fixed:** stale requests from an inactive feed cannot replace the current card; search queries are captured at request time.
- **Verified:** 194 Node tests, syntax check, server static/API smoke check. Actual Deezer connectivity and audio are not verified by these mocks.
- **Compatibility:** no saved data migration; favorites, playlists, theme and tournament history unchanged.

# v0.9.2 — No More Empty Discovery Paths

- **Fixed:** Comfort Zone, New Territory, and Wild Card can present already
  fetched, still-unheard Deezer tracks while their ideal artist lanes load.
  Fallback reasons are honest and visible; manual searches stay isolated.
- **Fixed:** the already-heard song check now runs before the strict artist
  path filter, preventing an apparently full but unplayable queue.
- **Fixed:** genuine multi-page Deezer artist searches no longer repeat page
  zero on subsequent requests.
- **Fixed:** exhausted chart pages do not strand viable liked/related artist
  lanes; temporary provider errors retry with a cooldown.
- **Added:** related-artist lookup from previously Kept artists after reload;
  no need to keep a new track to restart personalization.
- **Added:** compact invitation to search new artists beside discovery intro;
  button focuses the actual sidebar search field.
- **Removed:** oversized Music Duels trophy emblem; normal sidebar crown,
  bracket, podium, Champions Cup and tournament exports remain.
- **Validation:** 180 passing automated tests (including 10 new regression
  checks), Node syntax validation, archive validation. Browser and live Deezer
  playback not verified; Chromium local navigation was denied by test runtime.

# v0.9.1 — Distinct Discovery Paths

- Replaced the previous ratio-only behavior with a dedicated pure path engine: separate request policies, on-screen performer filters, and per-path explanations.
- **Comfort Zone:** explicit Keeps and related artists. **New Territory:** alternates Deezer-related performers with broad picks while excluding saved and five onboarding artists. **Wild Card:** rotates genre-specific Deezer searches, excluding familiar and related performers.
- Changed artist fetches to use Deezer's artist-specific API search rather than loose text queries, reducing unrelated matches.
- Extended Keep-triggered related-artist discovery to fresh sessions as well as seeded ones; searches alone remain temporary.
- Made the three-second auto-refill and queue counts respect the path's eligible song pool, rather than counting songs that path would never show.
- Changed Music Duels to use the same monochrome icon form as the other navigation links.
- Added `test/discovery-paths.test.mjs` with twelve path and UI regression tests, updated architecture and handoff documentation. Saved favorites, imported playlists, bracket history and themes are untouched.
- Live Deezer / browser playback and provider game licensing remain external release gates.

# v0.9.0 — Music Duels

- Added four-, eight-, and sixteen-song knockout tournaments, with two-contender preview cards, third-place playoff, and a final deciding the champion and runner-up.
- Added saved independent tournaments and complete archive, Hall of Fame podium cards, explicit Add Podium to Collection and podium playlist CSV export.
- Added a Champions Cup seeded with distinct winners from earlier completed regular tournaments, supporting a two-champion showdown and larger brackets as the winner pool grows.
- Preserved all older listening/favorites data in its original storage key. Tournament brackets use a separate validated local key with bounded archive size and metadata snapshots.
- Added tournament navigation, responsive desktop/mobile styling, shared preview timing, keyboard 1/2 voting, and comprehensive regression tests.
- No new provider accounts, API keys, or dependencies. Live Deezer preview behavior and public game licensing remain unverified.

# v0.8.0 — A Discovery Passport

- Moved Blind Mode into the music card beside Undo and added `B` keyboard toggle. Removed the redundant sidebar control.
- Moved all 20 themes to an accessible crescent-moon navbar popover; changing colors does not pause audio.
- Added four optional Passport quests derived from saved Keep/Pass history and Tune Lab answers. Completing quests awards stamps without interrupting a song.
- Recorded the active discovery path for new decisions; existing stored history remains compatible, with missing path data uncounted rather than guessed.
- Kept Deezer player, continuous previews, auto refill, discovery paths, Tune Lab, saved collection and playlist imports intact.
- Added regression coverage for theme menu, Blind button placement, quest progress, search isolation, and Undo.

# v0.7.0 — The Discovery Journey

- Three selectable, functional listening paths and more informative progression.
- Bounded automatic catalog refill every 3 seconds (only when necessary); no player DOM re-render during background fetch.
- X / Undo / Heart consolidated inside card; repetitive technical copy removed.
- Synchronized lyrics lookup (optional experimental LRCLIB), manual preview offset calibration, no bundled lyrics.
- Corrected Deezer all-genre tracks falsely labeled Pop; hidden unknown metadata from taste counts.
- 20 existing themes, Keep/Pass history, Tune Lab and playlist imports remain intact.

# AFTERTONE release history

## v0.6.1 — Open Discovery
- Moved the Keep (heart) and Pass (X) buttons into the listening card with accessible labels and tooltips.
- Balanced requests 50% related / 50% broader tracks and no repeats explicitly sourced from the five onboarding artists; Adventurous favors broader tracks 70% of requests. Closer to favorites preserves a 20% seed option.
- Removed the scoring bonus for onboarding artists, preserving learned preferences from actual Keep/Pass actions.
- Added zero-credential public Deezer playlist links, safe server-side pagination, and explicit Spotify link limitations.
- Kept playlist file/paste imports, favorites, continuous listening, and startup-fresh behavior.

# AFTERTONE changelog

## 0.6.0 — Outside Your Orbit

- **Deezer artist graph:** Discover genuinely related artists through exact-match artist lookup and Deezer's `artist/{id}/related` endpoint. No new API keys or accounts.
- **Three discovery lanes:** Balanced mixes related artists, broad catalog picks and the original five seeds (6:3:1 request target). Choose a more adventurous or more familiar mix in the sidebar.
- **Artist rotation:** The next-song selector prioritizes variety of performers; recent tracks and artist exposure counts are considered before the traditional taste scores.
- **Growing taste graph:** Keeping a new artist can expand discovery into that artist's network. Temporary searching never triggers such expansion.
- **Negative feedback:** Two Passes of an artist without any Keeps discourage more songs by that performer when alternatives exist.
- **Faster delivery of recommendations:** Related artists are fetched concurrently (bounded), interleaved across each of the five seeds, and injected into the session even when older chart tracks are already queued.
- **Resilience and cleanup:** Bounded artist lookup cache, bounded graph size, protected browser storage compatibility, small focused pure modules, architecture documentation, and a dependency-free full-source syntax check.
- **Preserved:** Five-artist introduction, fresh default on launch, playlist import, short Deezer previews, saved favorites, Blind Mode, Tune Lab, 20 themes, swipe controls.

## 0.5.4 — Five-artist introduction

- Five artist slots, optional playlist import and skip-to-fresh onboarding.
- Search pool isolation and basic novelty/repetition scoring.

## 0.5.3 — Continuous preview experiment

- Native audio control using short-lived Deezer preview links; no bundled audio.
- Removed the discontinued original-recordings checkbox and associated saved preference.

## 0.5.2 — Streamlined listening

- Immediate Keep/Pass and separate optional Tune Lab.
- Discovery filters moved to the sidebar.

## 0.1–0.5.1 — Prototypes

- Evolved from a small Commons catalog through independent sources and a visible YouTube player to Deezer metadata/short previews. Legacy adapters are retained for older saved data and regression tests, but not presented in the current discovery UI.
