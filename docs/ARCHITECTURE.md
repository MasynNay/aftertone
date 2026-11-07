# Engineering architecture

## Public portfolio boundaries

The interactive site demonstrates three domain concerns using an offline-safe, fictional catalog:

1. **Catalog and modes** — `src/demo-engine.mjs` exports twelve curated fictional tracks and three route-specific candidate policies. `chooseNext` excludes heard songs, rotates performers, and falls back only when the intended route is depleted.
2. **Gameplay and state** — the four-song bracket state machine calculates semifinal winners and losers, a third-place match and a final. History and favorites are stored in browser localStorage; no cloud data leaves the site.
3. **Playback/UI** — `assets/audio.js` uses an AudioContext, oscillator nodes and gain envelopes for original eight-second motifs. `assets/app.js` manages listener events, tempo, volume, keyboard actions, and stateful views. `assets/styles.css` handles responsive layout.

This architecture resembles the structure of the separate local music app without using its media sources. The complete local app includes catalog/provider adapters (`src/deezer.mjs`), the route engine, the playlist parser, state validation, multi-size tournaments, and 211 tests as of its v0.10.0 release. **Do not deploy the local app's playback paths or lyrics lookup as part of this showcase.**

## Why split the two projects?

- Playback rights, API permissions and embed restrictions are different from UI/interaction engineering.
- A hiring manager should be able to try the interface instantly even when music hosts are down or a user has no account.
- No API credentials, copyrighted songs, external trackers, or proprietary media files need to be deployed.
- The demo can be reviewed and tested in isolation using Node's built-in test runner.

## Data lifecycle

```
Click a discovery route
     ↓
route-specific candidate filter
     ↓
choose an unheard track
     ↓
play original synth sequence (explicit user gesture)
     ↓
Keep / Pass / Undo
     ↓
update localStorage & collection

Start a tournament
     ↓
four distinct fictional tracks
     ↓
semifinals → bronze → final
     ↓
podium → local Hall of Fame
```

## Design constraints

- Web Audio must always stop and disconnect scheduled nodes when leaving a track.
- No autoplay before the first explicit Play action.
- User input never changes the original track data.
- State changes are limited and versioned; users can reset locally.
- The generated `dist` directory contains only static public artifacts.
