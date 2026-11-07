# External music and image rights

The MIT license in this repository applies to **AFTERTONE's source code**, not to music or cover art provided by external services.

## Current listening provider: Deezer

Deezer provides catalog track, artist and artwork metadata, artist-to-artist relations, and short preview URLs through its public API. The application requests those URLs when needed; **no audio is bundled, cached on disk, or proxied**. The player stops after approximately 22 seconds.

**Important:** Access to an API endpoint does not itself grant permission to build a commercial or public music game. This application is a local technical prototype and does **not** have a game-use license from Deezer. Seek written authorization and any required publisher or master rights before public launch. Advertisements, API response availability and playback permissions remain under the provider's control. Automatic audio playback can additionally be blocked by browsers.

Deezer's artist graph is only a similarity suggestion, not proof that each recommendation will appeal to a listener. Some artists have zero neighbors, and some tracks have no playable preview. The app must handle both cases.

## Historical/legacy adapters

The codebase retains previous experimental adapters for Audius, Wikimedia Commons, Jamendo, YouTube and personal Jellyfin libraries to read older saved-track identities and run regression tests. They do **not** appear in the current 0.6 discovery-source UI. Their presence doesn't imply currently licensed or playable catalog access.

## Metadata sources and documentation

- Deezer API artist operations: https://developers.deezer.com/api/artist
- Deezer search API: https://developers.deezer.com/api/search
- MusicBrainz and ListenBrainz references remain historical in `src/chart-hits.mjs` and some legacy modules, but the active artist-related flow uses Deezer's related-artist endpoint.

### Timed lyrics (v0.7.0)

Optional lookups use the publicly documented LRCLIB API: https://lrclib.net/docs . We do not ship lyric text in the archive, do not persist fetched lyric lines to the listener's profile, and do not assert ownership. LRCLIB's no-key API access is **not evidence of lyric-display licensing**. For public deployment obtain rights and validate permitted lyrics attribution, word/line rendering and caching rules with rights holders or a licensed provider. Deezer gives no reliable full-song timestamp for its excerpt, so timing requires manual calibration.
