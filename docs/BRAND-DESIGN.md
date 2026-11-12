# AFTERTONE product design direction

AFTERTONE is a free, open-source music discovery application. It is **not** an engineering portfolio case study. This is a product homepage for people who want to listen.

## Distinctive identity

- Logo lime `#D6FB77` and charcoal `#0D1A1E` only, with calm neutral supporting tones
- The station-console layout, sticky desktop rail, discovery channel dial, and horizontal station rows distinguish AFTERTONE from Keystoria's cinematic gaming hero and other projects' generic marketing layouts
- Strong readability, clear one-click paths into the app, and keyboard accessibility matter more than decorative imagery
- Do not present ornamental artwork or static illustrations as interactive playback
- Treat channel and frequency terminology as a **playful interface metaphor**, not an actual FM broadcast service

## User-facing promise

Free to use. Open source under MIT for the app code. No sign-up required. Favorites and progress stored in the browser. Real third-party catalog discovery with short previews **where available**. Never claim that music rights are granted by the software's license, and do not promise provider uptime.

## Navigation

`./demo/` opens the application. `./demo/?path=familiar`, `balanced`, or `explore` opens the corresponding discovery mode. `./demo/?view=duels` opens Music Duels. Preserve the local app and its stored progress. Homepage navigation is plain HTML and does not need JavaScript.

## Release safeguard

Run the full Node test suite and Playwright desktop/mobile checks before deployment. CI can also emit actual viewport screenshots for visual review on pull requests. A passing test suite establishes functionality, not subjective visual quality.
