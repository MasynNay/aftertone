# AFTERTONE

**The real music discovery app, not a synthetic-track showcase.**

[**Launch AFTERTONE ↗**](https://aftertone.masynnay.com) · [GitHub Pages deployment](https://masynnay.github.io/aftertone/) · [Release notes](docs/CHANGELOG.md)

AFTERTONE makes discovering music interactive: hear a short excerpt, swipe **Keep** or **Pass**, use personalized discovery routes, build a local collection, and compete in fully featured Music Duels. Everything persists privately in your browser.

## The full application

The public interface is restored from the original **AFTERTONE v0.10.0** application. This is not the previously published 12-song fictional demo. It includes:

- **Real Deezer catalog metadata and album artwork**, on-demand short preview audio from Deezer's CDN, search, related-artist discovery and optional public Deezer playlist imports.
- **Comfort Zone, New Territory, and Wild Card** discovery with independent candidate selection, personalized paths, browsing by genre, era and language, and artist-seed rotation.
- **Continuous autoplay** after the user starts playback, as well as playback controls, volume control, mute, skip, Keep/Pass, undo and visual feedback.
- **Collection, taste map, Tune Lab, Challenges,** and six **Music Duels** tournament arenas with a persistent Hall of Fame.
- **20 appearance themes**, responsive controls, local progress persistence and CSV exports.

## Deployment modes

| Mode | Description |
| --- | --- |
| **GitHub Pages** (this website) | Complete original interface. An in-browser adapter queries Deezer's public JSONP catalog API, then loads original Deezer 30-second previews on demand. There are no third-party proxy services and no hosted copies of recordings. Live provider access can vary by region or availability. |
| **Local Node app** | Original `/server.mjs` backend, which makes direct Deezer API requests. It is the primary maintained application and includes optional locally configured services. |

**Provider rights:** Deezer's public API and preview links are not a blanket license for public use in a music game. Deezer has directed similar non-commercial discovery-game projects to seek approval from Deezer for Business. Public music/game deployment needs the appropriate provider authorization; this code alone does not grant it. The public site does not store, rebroadcast, download, or rehost audio.

**Limitations:** GitHub Pages cannot run a Node server. The browser adapter depends on Deezer's JSONP support and externally hosted audio URLs and may fail if Deezer changes their API. No official full-track playback SDK or user login is integrated. Optional synced lyrics depend on LRCLIB CORS and content rights. User-private Jellyfin and other local configured services are only supported by the local server, not public Pages. No key or credential is published.

## Run locally

Node.js 20+ is required. The original local backend remains unchanged:

```sh
npm start
# visit http://127.0.0.1:4173
```

Or use `START_MAC.command` / `START_WINDOWS.bat` after extracting the repository.

## Validate and build

```sh
npm run check  # original suite + browser adapter contract tests + static build
npm run build  # static release into dist/
```

The GitHub Actions workflow publishes only `dist/` to GitHub Pages. That directory is rebuilt from `public/` and the browser-safe `src/` modules, not from the former fictional-track showcase. `.env` files, local account tokens, test fixtures and media are not included in the published assets.

## Folder guide

- `public/` — original UI, CSS, themes, controls, game screens, browser API bridge.
- `src/` — original discovery, taste, playlist, Deezer, quiz, tournament, audio metadata modules.
- `server.mjs` — original Node server for local use.
- `scripts/` — checks and GitHub Pages build.
- `test/` — original test suite plus browser API contract tests.
- `docs/` — architecture, history, and deployment notes.

Development checkpoint: [`CONTINUE_HERE.md`](CONTINUE_HERE.md).
