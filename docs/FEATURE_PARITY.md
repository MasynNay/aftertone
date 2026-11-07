# AFTERTONE publishing feature parity

This release has **two deliverables** so a static showcase does not silently replace the complete local application.

| Feature | Portfolio (static) | Full local v0.10.0 |
| --- | --- | --- |
| Autoplay next track | Yes, enabled by default after first user-initiated Play | Yes |
| Manual skip / keep / pass / undo | Yes | Yes |
| Volume control | Yes, persisted | Yes, persisted |
| Comfort / Territory / Wild Card | Yes, different selection policies on 12 original motifs | Yes, with provider-backed catalog |
| Blind discovery | Yes | Yes |
| Favorite collection | Yes, persists, JSON/CSV export | Yes, larger library and import/export |
| Music duels, podiums, Hall of Fame | Yes, 4-song bracket + Champions Cup | Yes, 4/8/16 songs and six thematic arenas |
| 20 full UI themes | Shown/described in case study | Yes |
| Real metadata, live music search and previews | Not in static showcase (no public music rights assumed) | Yes, for the user's separately run local integration |
| Playlist imports, lyrics tools, Deezer and other adapters | Not on static Pages | Preserved intact in local application |

**Deployment rule:** No features are removed from the original local build. The portfolio demonstration reimplements selected interactions in original audio and makes its limitations explicit. Static GitHub Pages cannot execute Node server routes or privately configured API credentials. Turning a local provider integration into a public music service requires permission, hosting, and security hardening.
