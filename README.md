# AFTERTONE

**[Launch the interactive demo](https://masynnay.github.io/aftertone/)** · **Planned custom domain:** [aftertone.masynnay.com](https://aftertone.masynnay.com) *(not configured yet)*

**Music discovery, made playable.** A deployable, no-backend case study of an independently developed discovery-game prototype.

This repository contains the **public-safe showcase**, not the original Deezer-powered local app. The demo uses fictional track names and original sound motifs synthesized with Web Audio. It neither downloads nor reproduces commercial recordings or lyrics, makes no external API requests, requires no account or API key, and does not load external scripts or analytics. All demo decisions are saved in localStorage, with a visible **Reset demo** control.

## Try it locally

```bash
npm run check
npm run preview
```

Then open http://127.0.0.1:4174. Requires Node.js 20+ for the build, tests and local preview server. On macOS you can instead double-click `START_PORTFOLIO_MAC.command` after making it executable. Opening the HTML directly as a `file://` URL may not work because browser ES modules require a web origin.

## What visitors can try

- Three different recommendation paths: **Comfort Zone**, **New Territory**, and **Wild Card**. These use separate candidate eligibility rules, not just three labels.
- Eight-second original Web Audio synthesizer previews with persistent volume, an explicit autoplay next-song toggle, skip without a vote, keyboard shortcuts, blind mode, Pass, Keep and Undo.
- Collection storage in this browser with JSON/CSV downloads, plus a 4-song bracket with semifinals, bronze matchup, final, archived podiums and a demo Hall of Fame.
- Responsive presentation with keyboard focus, reduced-motion support and descriptive control labels.

**This is a portfolio demonstration.** The full local application includes a much larger catalog, 20 app themes, a playlist importer, 22-second remote audio previews, larger tournament arenas and 211 automated checks as of v0.10.0. That prototype remains local and is not being publicly deployed until relevant music and lyrics permissions are addressed. The public demo does not claim a commercial music catalog or live provider authorization.

## Deploy to GitHub Pages

1. Create an empty public GitHub repository named **`aftertone`** under **`MasynNay`**. Do not add a generated README or license.
2. Add the **contents of this folder** to the repository root and push to `main`.
3. In GitHub, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. The included workflow checks the site, builds `dist/`, and deploys only public-safe static files. Once Actions finishes, the default public address will be `https://masynnay.github.io/aftertone/`.
5. Optional recommended custom domain: set `aftertone.masynnay.com` in repository Settings → Pages, then in Cloudflare add a **DNS only** CNAME named `aftertone` with target `masynnay.github.io`; enable HTTPS after domain verification. See `docs/CUSTOM_DOMAIN.md`.

**Do not copy your local application's `.env` file, API keys, provider downloads or copyrighted media into this public repository.** The build intentionally excludes test data, local application source, and documentation from the published Pages artifact.

To build without deploying:

```bash
npm run build
```

Only `dist/` should be hosted. It contains `index.html`, `assets/`, `src/demo-engine.mjs`, and `.nojekyll`.

## Code layout

```
index.html                     Semantic case-study content and demo shell
assets/styles.css              Responsive visual system
assets/mark.svg                Original SVG brand mark
assets/app.js                  Browser UI, accessible actions and session state
assets/audio.js                Short original synth motif player
src/demo-engine.mjs            Pure discovery path and tournament logic
test/engine.test.mjs           Dependency-free Node test suite
scripts/build.mjs              Safe static build, copies only public assets
scripts/preview.mjs            Dependency-free local preview server
START_PORTFOLIO_MAC.command     Optional Mac launcher
.github/workflows/pages.yml    Automated tests and GitHub Pages deployment
docs/                         Architecture, rights and publishing notes
CONTINUE_HERE.md               Durable development checkpoint
```

## Technical design choices

- Vanilla HTML, CSS and JavaScript keep the static demo auditable and free of build dependencies.
- Recommendation decisions and bracket transitions are pure functions that can be tested independently of the UI.
- Session state is stored under `aftertone:portfolio-demo:v1`, separate from the local app's storage keys.
- Sound motifs are generated at the moment of interaction from a fixed note sequence; no sample files or third-party audio are served.
- The demo does not use `fetch()`, remote fonts, analytics or tracking scripts.

## Limitations

This is a demonstration of design and technical architecture, **not** an independently licensed commercial music service. Recommendation sample size is intentionally small (12 fictional tracks) and the demo sounds are synthesized, not actual published music. Web Audio requires a user gesture and may be unavailable in some browsers. Detailed provider integrations belong to the separate local prototype.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md), and [RIGHTS_AND_PRIVACY.md](docs/RIGHTS_AND_PRIVACY.md).

## Playback continuity

- **Autoplay: On** is the default, matching the earlier continuous listening experience. A visitor must first press **Play preview** because browsers require an intentional interaction before starting sound. After that, the next fictional track starts automatically when each 8-second motif ends. **Keep**, **Pass**, **Skip** and switching discovery routes also continue playback while the session is active.
- Turning **Autoplay: Off** stops automatic advancement and stops after the current audio preview. Manual Skip remains possible. Pause stops the continuous session. The volume and autoplay preference are saved in this browser.
- **S** skips without voting; **Space** plays/pauses. Export JSON and CSV from Collection at any time.
- All original local v0.10 features remain in the separate untouched full source package. Static GitHub Pages cannot safely replace server-backed catalog and music playback without approved provider terms and a hosting backend; it is not accurate to claim that those source integrations execute on Pages.
