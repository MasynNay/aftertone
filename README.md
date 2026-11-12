<div align="center">

<a href="https://aftertone.masynnay.com/"><img src="site/assets/mark.svg" alt="AFTERTONE waveform logo" width="96" height="96"></a>

# AFTERTONE

**Good music gets curious.**

**A free, open-source music discovery app for curious ears.**

Explore real music, discover outside your usual rotation, save what you love, and let your favorites compete in Music Duels.

[**Start Listening**](https://aftertone.masynnay.com/demo/) · [Visit AFTERTONE](https://aftertone.masynnay.com/) · [Explore the source](https://github.com/MasynNay/aftertone) · [Roadmap](docs/ROADMAP.md) · [Issues & suggestions](https://github.com/MasynNay/aftertone/issues)

**Free to use · MIT licensed · No account required · Browser based**

</div>

---

## Discover your way

AFTERTONE isn't another playlist you scroll past. Choose a listening mode, hear short previews where providers make them available, and shape your experience with every choice.

| Mode | What it feels like | Start |
| --- | --- | --- |
| **Comfort Zone** | Find new music close to what you already love. | [Listen](https://aftertone.masynnay.com/demo/?path=familiar) |
| **New Territory** | Meet artists and sounds beyond your normal rotation. | [Explore](https://aftertone.masynnay.com/demo/?path=balanced) |
| **Wild Card** | Leave the next discovery to chance. | [Surprise me](https://aftertone.masynnay.com/demo/?path=explore) |
| **Music Duels** | Pick a winner in head-to-head track tournaments. | [Start a duel](https://aftertone.masynnay.com/demo/?view=duels) |

Use **Keep** and **Pass** to guide discoveries, save favorites to your collection, import playlist ideas, explore your taste, and play Music Duels. The full browser app includes local progress backup and restore, audio volume controls and selectable themes.

## Screenshots

These screenshots show real AFTERTONE interface layouts, using test fixture music and placeholder artwork for repeatable, rights-safe captures. They are **not** evidence that an external provider's previews will always play.

**Discover music**

![Discover screen with listening controls, path selection and test tracks](docs/screenshots/app-discover.webp)

**Your collection**

![Collection screen with test favorite tracks](docs/screenshots/app-collection.webp)

**Music Duels**

![Music Duels competition setup](docs/screenshots/app-music-duels.webp)

## Start listening

Open **[aftertone.masynnay.com](https://aftertone.masynnay.com/)** and choose a discovery station, or go directly to **[the app](https://aftertone.masynnay.com/demo/)**.

You do not need to create an account. Favorites, past decisions and tournament history live in your browser's local storage. Back them up using the in-app export controls before clearing browser data or switching devices.

Third-party catalog and short audio preview availability can vary with browser restrictions, provider access and region. See [first-listen guidance](docs/FIRST_LISTEN.md) and [backup and restore](docs/BACKUP_RESTORE.md).

## Run it yourself

Requires Node.js 20 or newer.

```bash
git clone https://github.com/MasynNay/aftertone.git
cd aftertone
npm start
```

Open the localhost URL printed by the server. For development:

```bash
npm run dev      # local server with watch mode
npm test         # automated tests
npm run check    # tests, static build and site validation
npm run build    # generate the static site and browser app
```

The browser edition at `/demo/` uses a browser-safe adapter for supported third-party catalog access. The local Node server is separate from the GitHub Pages deployment.

## Open source and contributing

AFTERTONE is **free to use** and its original source code is released under the **[MIT License](LICENSE)**. That license applies to the software, not to third-party songs, recordings, metadata or artwork.

Have a feature idea or found an issue? [Open a GitHub issue](https://github.com/MasynNay/aftertone/issues). The [roadmap](docs/ROADMAP.md), [release history](docs/CHANGELOG.md), and [technical architecture](docs/ARCHITECTURE.md) are public.

## Third-party audio and privacy

AFTERTONE is independent and is not affiliated with or endorsed by Deezer. It requests third-party catalog metadata and short previews when available; neither API access nor the MIT software license grants music distribution or performance rights. Rights holders retain ownership of their content. The project does not bundle or redistribute copyrighted recordings.

The public app needs no user account. Local collections and game state are stored in the user's browser. A new browser, private session or cleared local storage may start with an empty collection; use the app's progress backup for portability. Availability of live providers or synchronized lyrics is not guaranteed.

## Project resources

- [Roadmap](docs/ROADMAP.md)
- [Changelog](docs/CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Browser testing](docs/BROWSER_TESTING.md)
- [First-listen help](docs/FIRST_LISTEN.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [Open issues](https://github.com/MasynNay/aftertone/issues)
- [Software license](LICENSE)
