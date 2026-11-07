# AFTERTONE architecture

**Release:** 0.9.3 · **Stack:** vanilla browser JavaScript, Node.js 20+ HTTP server, no database, no runtime dependencies.

The app is deliberately split into four concerns: *the music catalog*, *recommendation policy*, *playback*, and *local listener state*. Fetching a song is not the same as recommending it. Searching an artist is not the same as liking them.

## Active module map

```text
aftertone/
├── public/
│   ├── index.html            Browser shell and shared audio element
│   ├── main.js               UI event handlers, session orchestration
│   ├── views.js              Pure-ish HTML template functions
│   ├── styles.css            Layout and responsive rules
│   └── themes.css            20 theme palettes
├── src/
│   ├── deezer.mjs            Deezer metadata, preview resolution, pages
│   ├── discovery/
│   │   ├── related-deezer.mjs  Artist graph lookup + bounded TTL cache
│   │   ├── graph.mjs           Deduplication and balanced parent branches
│   │   ├── rotation.mjs        Artist-key helpers and legacy rotation rules
│   │   └── mode-engine.mjs     Current path scheduler, hard pool policy and explanations
│   ├── discovery-personalization.mjs  Five artist inputs + search boundary
│   ├── playlist-import.mjs   Optional CSV, JSON, pasted-song parsing
│   ├── taste.mjs             Song choice ranking and taste scoring
│   ├── persistence.mjs       Versioned browser storage sanitization
│   └── related-artists.mjs   Compatible server adapter to artist graph
├── server.mjs                HTTP endpoints, safe static serving
├── test/                     Automated regression and contract checks
├── scripts/check-syntax.mjs  Validates all JS files (dependency-free)
└── docs/                     Design, attribution, implementation notes
```

Earlier experiments with YouTube, Audius, Wikimedia Commons, Jamendo and Jellyfin remain in the repository for saved-track compatibility and historical regression tests, but **only Deezer is offered as a normal discovery provider**. This is not a claim that those services are active fallbacks. Avoid removing their saved-source ID parsing without a formal data migration.

## What happens when you choose five artists

1. `parseFavoriteArtists` validates and deduplicates the selected names. The five names are saved in browser storage, *not* treated as liked songs.
2. Fresh chart music is available immediately. Meanwhile `/api/related-artists?artist=...` asks Deezer to resolve the exact artist and fetch `/artist/{id}/related`. At most two seed lookups are concurrent.
3. `graph.mjs` excludes seed artists from their own related graph, deduplicates neighbors, and interleaves suggestions from every source artist rather than exhausting one person's connections first.
4. `rotation.mjs` controls **catalog requests**. The balanced ten-slot mix targets five related-artist requests, five broad chart requests and zero original-seed requests. This is a target for source selection, not a claim about the percentage of actual audible tracks.
5. `taste.mjs` independently controls **which loaded song comes next**. It prefers different artists, reserves new-artist slots, accounts for Keep/Pass history, and lightly considers Deezer popularity. This separation prevents the most prolific artist from winning every time.
6. Explicitly Keeping a new artist can extend the graph a second hop, subject to a 12-artist lookup/session cap. A temporary search alone never changes the graph.
7. If Deezer cannot provide related artists, the app uses broader Deezer chart discovery instead of repeating only the five seed artists. It shows the provider's status rather than inventing a connection.

**Mix settings**: Balanced (5 related / 5 broad / 0 seed), Adventurous (3 related / 7 broad / 0 seed), Closer to favorites (2 seeds / 4 related / 4 broad). The slot ratios apply only when each lane is available. They are not guaranteed ratios of genre, language, or popularity. Nothing bypasses Deezer's actual search results.

## Feedback rules

- Search: a temporary discovery lane; typing an artist is not a long-term preference.
- Keep: saves a favorite, influences the taste score, and can extend related-artist discovery.
- Pass: records a negative preference. Two passes of an artist with no Keep discourage more songs by that artist, when alternatives are available.
- Preview timer: does **not** automatically count as a Pass.
- Blind mode / Tune Lab: quiz accuracy is independent from whether you like the song.
- Browser restart: user favorites and the optional five artists persist, but the active personalization session starts fresh as before.

## Resilience and privacy

- External calls run on the local server using timeouts. Related-artist responses have a six-hour in-memory TTL and a bounded cache.
- User content isn't sent to an analytics backend. Artist names are sent to Deezer when you request suggestions; metadata and temporary preview URLs are fetched on demand.
- Saved-data version remains `1`; the new `discoveryMix` is an optional whitelisted field, preserving older sessions.
- Deezer previews remain remote URLs. No media is downloaded, redistributed, or bundled.
- External music and artwork rights are independent of this project's MIT source-code license. Permission for public game use remains outstanding.

## Test commands

`npm test` runs Node's built-in unit and integration suite with mocked provider responses. `npm run check` also checks syntax across all JS modules. Browser visual tests and live Deezer audio are **not** verified in this environment; make them a release gate before calling playback production-ready.

**Playlist URLs (v0.6.1)**: `src/playlist-links.mjs` accepts only known Deezer/Spotify URL patterns. The server fetches constructed `api.deezer.com/playlist/{numericId}` pages (never a user-controlled URL). Spotify links intentionally return an explanatory 422 response; they are not silently imported. All successfully imported songs pass through the same `parsePlaylist` normalization and deduplication code.

## v0.7 discovery journey and lyrics

`src/discovery/auto-refill.mjs` provides a 3-second eligibility check and bounded queue target. The single interval lives in `public/main.js`; it is not recreated per render. When a background fetch finishes, the listener's playing card DOM is left intact.

The three route buttons map to `discoveryMix`: `familiar`, `balanced`, `explore`. They affect artist-vs-broad provider requests and share the existing taste model; they are not cosmetic theme buttons.

The Deezer API does not expose a trustworthy per-song genre for generic charts. `unknown` is preserved rather than mapping every such track to `pop`. This prevents artificial genre bias.

`src/lyrics.mjs` implements optional on-demand, exact-artist/title LRCLIB lookups and timestamp parsing. No lyrics are bundled; the in-memory cache is bounded; 429 responses respect Retry-After. Deezer audio previews are not associated with an absolute song start time, so per-track manual offset calibration is essential. The client only shows the current timed line, not a lyrics transcript. Obtain proper musical-composition/lyrics display rights and music-game approval before public release.

## Discovery Passport (v0.8.0)

`src/discovery/passport.mjs` is a pure projection of state.history and Tune Lab answer counts. It doesn't store artificial points, use daily streaks, or write to localStorage. The four quest goals intentionally rely on reliable fields only. `recordChoice` captures the selected discovery `route` on each new decision; `sanitizeState` preserves that route for modern saved histories and leaves it null in older sessions. This supports retroactive Undo and keeps autoplay-skipped tracks out of quest progress. UI rendering belongs in `public/views.js`, navigation in `public/main.js`.

The theme gallery is a nonmodal popover in the `public/index.html` topbar; `public/main.js` renders the menu from `src/themes.mjs` exactly once and toggles its accessibility state. It has its own focus management so it doesn't interfere with the listening player.

## Music Duels (v0.9.0)

`src/duels.mjs` is a dependency-free bracket state machine; `public/duels-view.js` formats a read-only tournament view, and `public/main.js` handles delegated clicks and the existing shared 22-second audio player. A separate `aftertone:duels:v1` localStorage key stores tournament snapshots, winners, and bronze playoff. Duels do not change the taste model until users explicitly add podium tracks to their Collection. See [`MUSIC_DUELS.md`](MUSIC_DUELS.md).

## v0.9.1 — Different requests, different results

`src/discovery/mode-engine.mjs` is the **authoritative current path policy**. It is pure and dependency-free; tests compare path results using a fixed song catalog. The older `rotation.mjs` retains shared artist normalization and compatibility functions, but the client no longer relies on its shared mix schedules to decide what to recommend.

1. **Plan the request.** `planDiscoveryRequest` chooses a saved/related artist lane, wider Deezer charts, or a rotating genre lane depending on selected path. Explicit genre and manual searches take precedence. Artist requests send `seed_artist`, *not* a broad text search.
2. **Isolate the feed.** The browser keys feed cursors, accepted IDs, and track explanations by selected path, filters, and search. Old artist searches are not recycled when the search is cleared.
3. **Filter the presentation pool.** `filterPoolForPath` excludes known/saved/related performers according to path. An empty pool asks for more tracks, instead of letting a scoring bonus defeat the route choice. The queue counter reflects the same path eligibility rules.
4. **Rank within eligible songs.** `src/taste.mjs` still handles genuine Keeps/Passes and artist-repeat penalties, but cannot reintroduce a track excluded by the path filter.
5. **Expand when someone Keeps.** Artist relationship lookups can run in fresh listening as well as optional seeded sessions. Transient typed searches do not expand the relationship graph.

**Provider limitations:** Deezer catalog genre labels are inferred from artist discovery lanes when a specific genre was requested; they are not verified audio classifications. Related artists may be unavailable or slow to resolve. A route with no eligible songs may need to fetch again; no provider can guarantee perfect novelty, genre, or preview availability. The app does not make those claims.

**Testing:** `test/discovery-paths.test.mjs` asserts request-source diversity, genre rotation, source filters, search isolation, and sidebar consistency. Keep the local browser playback check and Deezer game-use authorization as release gates before public deployment.

## v0.9.2 — Recover from empty path queues

`src/discovery/queue.mjs` provides the shared, pure `selectAvailablePath` and
`belongsToDiscoveryFeed` helpers. Recommendation selection now removes already
heard songs **before** the strict route filter, then applies that filter to the
remaining playable catalog. If no route-specific results are ready, a candid
fallback supplies available, unplayed Deezer tracks instead of an empty player.
The `seedReason` tells listeners the fallback is provisional, not a verified
artist recommendation.

`public/main.js` tracks provider songs fetched during *normal discovery* in a
bounded shared-ID set. These may be reused immediately after switching paths,
so they don't have to be downloaded again. Explicit search results are never
inserted into the shared set. On startup/path changes the app can look up
related performers for previously Kept artists (with bounded concurrency and
request deduplication), even if the five-artist seed session is not active.

`src/discovery/mode-engine.mjs` schedules future lanes past an exhausted broad
chart cursor; its `none` outcome cleanly ends truly depleted searches. The
Deezer adapter correctly starts *seed artist* page indexes at zero (independent
of the first three chart pages) and stops after two nonrepeating pages.
Temporary provider failures use cooldowns rather than permanent exhaustion.
`src/discovery/auto-refill.mjs` remains responsible for the single 3-second
queue check. All state changes remain local and retain storage version 1.

## v0.9.3 — Path-first queues and verified artist lookups

- `src/discovery/route-session.mjs` defines the pure, testable queue boundary.
  Mode-specific `feed.ids` take precedence. A new route's first selection is
  deferred until it has loaded its own results; a shared pool is considered
  **only after** that route has attempted its initial fetch. Manual searches
  use only their own IDs and never fall back to shared discoveries.
- `public/main.js` captures the query before starting a request, tracks each
  mode's first successful batch through `feed.primed`, and uses feed identity
  when late background results arrive. Switching modes exits any temporary
  search, which was a major cause of identical-looking results.
- `src/deezer.mjs` looks up an exact artist ID using `/search/artist`, then
  requests `/artist/{id}/top`. This is less prone to empty results than the old
  advanced artist text filter. A failed/unpreviewable top list falls back to
  ordinary ranked search, but seeded artist tracks still require a matching
  artist credit. The exact-artist lookup cache is bounded to 128 entries and
  applies only to the real fetcher; isolated mock tests are never cached.
- Three-second background replenishment still uses `src/discovery/auto-refill.mjs`
  with the 160-upcoming-song threshold and session-bound limits. Loading is not
  an unconditional request every three seconds.

What this does **not** guarantee: each Deezer genre/artist page can contain
unavailable previews; two paths may converge on the same popular song when
there are no alternatives. The app must show a fallback reason, not invent a
perfectly personalized catalog. A public, commercial game would still need
appropriate provider rights.


## Themed tournament architecture (v0.10.0)

`src/tournament-themes.mjs` owns all pure arena eligibility and selection rules. Browser UI (`public/duels-view.js`) renders an escaped, responsive read-only snapshot; `public/main.js` delegates theme selection, creation, voting, exports, and season filtering. `src/duels.mjs` remains the version-1 bracket state machine and computes Hall of Fame standings from historical podiums instead of storing a second mutable ranking.

The Pop vs Rock / 2000s presets deliberately reject unknown metadata. These metadata limitations are visible in the UI. A single HTMLAudioElement is shared across Discover, Collection and Duels, and short Deezer previews are resolved on demand. No extra player, database, or server secret was introduced.
