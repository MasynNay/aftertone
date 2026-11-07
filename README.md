# AFTERTONE

**A product-design case study with the real AFTERTONE music discovery app embedded for visitors to play.**

[**Portfolio homepage & disclaimer ↗**](https://aftertone.masynnay.com/) · [**Play the full app directly ↗**](https://aftertone.masynnay.com/demo/) · [Release notes](docs/CHANGELOG.md)

AFTERTONE makes discovering music interactive: hear a short excerpt, swipe **Keep** or **Pass**, use personalized discovery routes, build a local collection, and compete in fully featured Music Duels. Everything persists privately in your browser.

## Portfolio experience

The first visit shows an accessible, dismissible portfolio and third-party media disclaimer. The home page explains the product, its engineering, and its development journey. The **real AFTERTONE application** is embedded in the Live App section, with an **Open full screen** option. There are no fictional songs or substitute mini-games in this live preview. The original local Node application logic is preserved under `app/`.

The disclaimer is shown once per browser tab session. Favorites, player preferences, and discovery history retain the original application local-storage keys across the embedded and full-screen views. The notice does **not** substitute for rights-holder authorization to deploy third-party music previews.

## The full application

The public interface is restored from the original **AFTERTONE v0.10.1** application. This is not the previously published 12-song fictional demo. It includes:

- **Real Deezer catalog metadata and album artwork**, on-demand short preview audio from Deezer's CDN, search, related-artist discovery and optional public Deezer playlist imports.
- **Comfort Zone, New Territory, and Wild Card** discovery with independent candidate selection, personalized paths, browsing by genre, era and language, and artist-seed rotation.
- **Continuous autoplay** after the user starts playback, as well as playback controls, volume control, mute, skip, Keep/Pass, undo and visual feedback.
- **Collection, taste map, Tune Lab, Challenges,** and six **Music Duels** tournament arenas with a persistent Hall of Fame.
- **20 appearance themes**, responsive controls, local progress persistence and CSV exports.

## Deployment modes

| Mode | Description |
| --- | --- |
| **GitHub Pages** (this website) | A portfolio homepage with the actual app in `/demo/`, either embedded in the page or launched full screen. The app uses an in-browser adapter that queries Deezer's JSONP catalog API and loads Deezer preview URLs when available. There are no third-party proxy services and no hosted copies of recordings. Live provider access can vary by region or availability. |
| **Local Node app** | Original `app/server.mjs` backend, which makes direct Deezer API requests. It is the primary maintained application and includes optional locally configured services. |

**Provider rights:** Deezer's public API and preview links are not a blanket license for public use in a music game. Deezer has directed similar non-commercial discovery-game projects to seek approval from Deezer for Business. Public music/game deployment needs the appropriate provider authorization; this code alone does not grant it. The public site does not store, rebroadcast, download, or rehost audio.

**Limitations:** GitHub Pages cannot run a Node server. The browser adapter depends on Deezer's JSONP support and externally hosted audio URLs and may fail if Deezer changes their API. No official full-track playback SDK or user login is integrated. Optional synced lyrics depend on LRCLIB CORS and content rights. User-private Jellyfin and other local configured services are only supported by the local server, not public Pages. No key or credential is published.

## Run locally

Node.js 20+ is required. The original local backend remains unchanged:

```sh
npm start
# visit http://127.0.0.1:4173
```

Or run `scripts/launch/START_MAC.command` (Mac) or `scripts/launch/START_WINDOWS.bat` (Windows) after extracting the repository.

## Validate and build

```sh
npm run check  # original suite + browser adapter contract tests + static build
npm run build  # static release into dist/
```

The GitHub Actions workflow publishes only `dist/` to GitHub Pages. The build copies the informational portfolio page from `site/`, and the real application from `app/public/` plus the browser-safe `app/src/` modules to `dist/demo/`. It does **not** publish the former fictional-track showcase. `.env` files, local account tokens, test fixtures and media are not included in the published assets.

## Folder guide

- `site/` — polished portfolio landing, first-visit splash, consent-style acknowledgement and embedded live-app frame.
- `app/public/` — original UI, CSS, themes, controls, game screens, browser API bridge.
- `app/src/` — original discovery, taste, playlist, Deezer, quiz, tournament, audio metadata modules.
- `app/server.mjs` — original Node server for local use.
- `scripts/` — builds, checks, and cross-platform launchers under `scripts/launch/`.
- `test/` — original test suite plus browser API contract tests.
- `.github/workflows/` — automated test gate and GitHub Pages deployment.
- `docs/` — architecture, history, and deployment notes.

Development checkpoint: [`docs/development/CONTINUE_HERE.md`](docs/development/CONTINUE_HERE.md).

## Repository layout

```text
aftertone/
├── .github/workflows/    Automated testing and GitHub Pages publishing
├── app/                  Real music application (UI, discovery engine, Node server)
│   ├── public/           Browser UI and assets
│   ├── src/              Discovery, Deezer, playlists, music duels, state
│   └── server.mjs        Local Node application backend
├── site/                 Portfolio homepage, disclaimer and live-app embed
├── scripts/              Build, verification and cross-platform launchers
│   └── launch/           Double-click launchers for Mac and Windows
├── test/                 Automated test suite
├── docs/                 Architecture, release history and progress checkpoints
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

The repository root intentionally contains just the project metadata. All application code is under `app/`, and the deployed site is generated into the ignored `dist/` folder. The root layout is stable; GitHub Pages always deploys only the generated output.
