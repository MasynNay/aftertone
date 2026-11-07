# AFTERTONE development journal (append-only)

## 2026-11-07 — v0.9.1 distinct discovery paths

**Starting point:** extracted the previously delivered v0.9.0 Music Duels archive, with 158 baseline automated tests. No user data or external configuration was included in the source archive.

**Problem:** Comfort / New Territory / Wild Card adjusted frequencies from overlapping catalog queues; an artist request mistakenly sent both a general text query and a seed artist, allowing irrelevant matches. The Music Duels sidebar icon did not visually match its peers.

**Implemented:** pure mode request scheduler, genre-rotating Wild Card requests, strict new-artist presentation filters, alternation between related and broad choices, mode-scoped queue counts and provenance, fresh-session artist graph expansion on explicit Keeps, precise Deezer artist search, matching monochrome sidebar glyph. See `src/discovery/mode-engine.mjs`, `public/main.js`, `public/views.js`, `public/index.html` and `test/discovery-paths.test.mjs`.

**Verification:** `npm run check` completed with 170 passing Node tests and JS syntax verification. No live Deezer audio validation or interactive browser visual check; full release readiness and music game-use licensing are outstanding.

**Checkpoint:** packaged complete versioned source and Mac TAR.GZ with existing launchers. To resume: consult `docs/development/CONTINUE_HERE.md`, run `npm run check`, then check live Deezer behavior on a Mac and compare 10–20 tracks per discovery path.

## 2026-11-07 — v0.9.2 empty path recovery and UI cleanup

**Resumed from:** `/mnt/data/aftertone_v091_work/aftertone` (v0.9.1 tree; 170 tests passing), copied to a separate release worktree. Existing user data was not included or modified.

**Reproduced:** the path filter could identify a pool containing already-heard
favorites before `selectNext` removed them. When a mode changed, the new
path-scoped feed could be empty even when previous normal discovery had
playable songs; a missing/deferred Deezer artist graph left the filter with no
matches. Deezer seeded searches were also repeating the zero offset when
chart pagination was used in the same session.

**Implemented:** shared discovery-only IDs; no manual search leakage;
strict-first selection with an explicit, honest fallback; heard-track removal
before path selection; background related-artist warmup from saved Keeps;
correct Deezer artist-page offsets and bounded pagination; broad/artist cursor
exhaustion separation; network-error cooldowns; a search encouragement shortcut;
removal of decorative Duels trophy.

**Verified:** `npm run check` with 180 passing automated tests and syntax
verification. A Chromium navigation test returned `ERR_BLOCKED_BY_ADMINISTRATOR`
for localhost; this is a test-runner limitation, not a proven user-browser
failure. Provider playback, lyrics synchronization and the full on-device
experience remain unverified. No new provider licenses are granted.

**Checkpoint:** source ZIP and Mac TAR.GZ. The handoff file lists all changed
files, verification commands, and known limitations.

## 2026-11-07 — v0.9.3 started
- Resumed from v0.9.2 validated source; inspected `public/main.js` discovery queue and Deezer metadata adapter.
- Diagnosed route switches immediately selecting from globally shared `discoveryIds` before new route fetch. Deezer artist queries using advanced `artist:"..."` may return zero even for legitimate artists.
- Verified a subtler root cause: changing paths while an artist search was active left `searchQuery` set, forcing all paths to reuse the same temporary query. Mode switches now clear it.
- Added `src/discovery/route-session.mjs` to prefer newly fetched path IDs over globally shared history, with loading-first semantics and explicit fallback.
- Replaced Deezer advanced artist text queries with exact artist-ID lookup and top tracks. Retained song-title search and safe fallback for sparse or unavailable top pages.
- Captured query at request start; stale request completion cannot choose a new card after mode changes. Initial fetch yields as soon as a playable route queue exists; background replenishment remains bounded.
- `npm run check`: 194 tests pass; no local saved-data format changes.

## 2026-11-07 — v0.9.4: safe volume
- Started from verified v0.9.3 worktree, copied to a separate release directory; kept a portable source archive/checkpoint.
- Added `src/volume.mjs` with pure clamping, saved-state, zero-level, and mute toggle rules. Persisted `volume` in existing v1 state without schema reset.
- Added in-card range control and matching Duels control; both use the existing singleton HTMLAudioElement, avoiding duplicate players.
- Applied saved audio level before each play and on chrome initialization. Prevented pointer swipe gestures on the new slider.
- Added `test/volume-control.test.mjs` with seven regression cases. Full `npm run check`: 201 passing tests.
- Known limits: no measured loudness normalization, no verified live Deezer browser playback; public use requires music rights and provider permission.


## 2026-11-07 — v0.10.0 themed arenas / Hall of Fame
- Resumed from `/mnt/data/aftertone_v094_work` (v0.9.4, 201 passing tests). Copied into an independent worktree to preserve previous checkpoints.
- Kept the existing bracket storage key and format. Added `src/tournament-themes.mjs` pure selectors: Open Stage, Favorites Face-Off, Fresh Faces, Mystery Matchups, Pop vs Rock, and 2000s Throwback. Genre-specific events require explicitly verified genres; era-specific events require explicit release-year data.
- Added passive tournament template cards, explicit eligibility messages, mystery-mode identity masking (including player status), all-time and quarterly rankings, champion collection saves and CSV export. Added unit and render tests for eligibility, old-store compatibility, full tournaments, ranking totals and safety.
- No music rights were added: Deezer game-use permission and actual browser playback remain outstanding before public release.


### November 7, 2026 — Direct-launch portfolio experience
Replaced mandatory disclaimer dialog and embedded-iframe homepage with an original AFTERTONE portfolio introduction inspired by the Keystoria direct-launch flow. The primary **Explore the Experience** action now navigates straight to the preserved `/demo/` app. The portfolio notice is visible inline; no popup script is loaded. Added homepage regression tests and updated static artifact validation.