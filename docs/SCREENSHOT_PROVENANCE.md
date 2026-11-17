# Screenshot provenance — AFTERTONE product README

The images in [the README](../README.md#screenshots) are **real browser captures of the AFTERTONE application**, with synthetic music metadata rather than copyrighted recordings or album artwork. Screenshots demonstrate the interface and tournament flow, **not** live provider availability, legal permission to stream third-party music or accessibility certification.

## Music Duels — Nov 16–17, 2026

| File | What it shows | Source |
| --- | --- | --- |
| `screenshots/app-music-duels.webp` | Arena and tournament-size selection | Existing verified fixture capture |
| `screenshots/app-music-duels-bracket.webp` | Open Stage, four fictional tracks, live semifinal matchup and voting controls | Built-app Chromium smoke test at 1440×900 |
| `screenshots/app-music-duels-podium.webp` | Finished four-track tournament with podium, Hall of Fame and saved history | Same built-app Chromium smoke test |
| `screenshots/app-discover.webp` | Discovery modes and listening controls | Existing verified fixture capture |
| `screenshots/app-collection.webp` | Saved collection view | Existing verified fixture capture |

The new two Duels images were created on a restricted feature branch from the successful [browser-smoke tests](../scripts/browser-smoke.py). The test uses `demo_tracks()` with fictional track and artist names, intercepts Deezer JSONP calls, and blocks external network access. It starts a real tournament, captures the semifinal, votes through the bracket, verifies three podium places and a CSV export, and captures the completed competition after transient notifications disappear.

The full-page original PNGs were resized from a 1440px browser capture to 1280px-wide WebP at quality 77, preserving their actual UI contents. Both WebP files are committed in the repository rather than linked to an expiring GitHub Actions artifact. The one-time capture workflow was removed from the feature branch before merging, so no permanent write-enabled snapshot workflow exists.

## How to reproduce and review

From a clean clone with Node.js 22 and Python 3.12 or later:

```bash
npm run check
python -m pip install playwright==1.56.0 Pillow==11.3.0
python -m playwright install chromium
python scripts/browser-smoke.py
```

Open `browser-smoke-artifacts/music-duels-bracket-1440x900.png` and `browser-smoke-artifacts/music-duels-complete-1440x900.png`; inspect them rather than trusting screenshot filenames. The image assets in the README should be refreshed when the UI changes materially. GitHub Actions also uploads seven-day `aftertone-ui-evidence` artifacts for successful pull requests, but those are temporary review attachments, not permanent release screenshots.

This does not satisfy unresolved work to obtain media permissions, verify real Deezer playback or perform manual assistive-technology checks.
