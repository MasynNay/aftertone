# AFTERTONE — Product & Engineering Roadmap

**Project:** [AFTERTONE](https://aftertone.masynnay.com/) · **Full-screen app:** [Launch the app](https://aftertone.masynnay.com/demo/) · **Backlog:** [Open issues](https://github.com/MasynNay/aftertone/issues) · **Releases:** [Changelog](CHANGELOG.md)

**Last reviewed:** November 7, 2026  
**Current release:** v0.10.1  
**Approach:** Ship small, verified improvements. Version targets indicate order of work, **not promised release dates**.

AFTERTONE is an independent music-discovery portfolio application: real catalog search where available, personalized discovery modes, short previews, Keep/Pass, collection, autoplay, themes, and six Music Duels arenas. The public version runs on GitHub Pages with a browser-side provider adapter; the local Node server remains in `app/server.mjs`.

## Release plan

| Target | Priority | Focus | Status |
| --- | --- | --- | --- |
| **v0.10.2 — Trust & stability** | P0 | Prevent blank pages, recover from provider failures, confirm media permissions | In progress · browser and preview fixes shipped |
| **v0.11 — More rewarding discovery** | P1 | First-run UX, safe save-data backup/restore, Music Duels hardening | Planned |
| **v0.12 — Experience & presentation** | P2 | Accessibility/mobile QA, actual app screenshots, better release communication | Planned |
| **v1.0 — Responsible public readiness** | Gate | Only after cross-browser reliability, provider rights, privacy, and licensing are resolved | Conditional |

### v0.10.2 — Trust & stability (next up)

- [ ] [#1: Automated real-browser smoke tests for landing and full app](https://github.com/MasynNay/aftertone/issues/1). Catch broken CSS, import paths and blank app views before deployment.
  - **Automated portion shipped (November 11, 2026):** [PR #10](https://github.com/MasynNay/aftertone/pull/10) now gates deployments on desktop/mobile Chromium tests of the built site. Remains open for manual Firefox/Chrome provider verification.
- [ ] [#2: Recover gracefully from Deezer catalog/preview failures](https://github.com/MasynNay/aftertone/issues/2). **Partial implementation shipped:** [PR #11](https://github.com/MasynNay/aftertone/pull/11) adds Retry Preview, Skip Without Voting, Retry Discovery, independent JSONP cancellation, and browser regression coverage. Real-provider verification and regional failure handling remain open.
- [ ] [#3: Review third-party music and artwork permissions](https://github.com/MasynNay/aftertone/issues/3). Document authorization or provide a rights-cleared public fallback; a portfolio disclaimer alone does not establish usage rights.

**Exit criteria:** `npm run check` passes; both public routes pass a real-browser smoke test; at least one actual preview is manually tested where permitted; provider failures yield a useful state; required media permissions are addressed.

### v0.11 — More rewarding discovery

- [ ] [#4: First-run guidance and useful empty states](https://github.com/MasynNay/aftertone/issues/4). Improve discoverability of Comfort Zone, New Territory and Wild Card.
- [ ] [#5: Safe browser-data backup/restore and migration checks](https://github.com/MasynNay/aftertone/issues/5). Protect favorites, preferences and tournament history without introducing an account.
- [ ] [#6: Music Duels reliability across arenas and refreshes](https://github.com/MasynNay/aftertone/issues/6). Cover sparse track pools, brackets, persistence, and the Hall of Fame.

**Exit criteria:** New listeners understand the first run; saved data survives upgrades; tournament states are tested and recoverable.

### v0.12 — Polish & portfolio proof

- [ ] [#7: Accessibility and responsive interface audit](https://github.com/MasynNay/aftertone/issues/7). Keyboard, focus, contrast, reduced motion, mobile and assistive-technology checks.
- [ ] [#8: Real application screenshots and consistent release notes](https://github.com/MasynNay/aftertone/issues/8). Show actual discovery, player and Music Duels screens—not just the marketing page.

**Exit criteria:** Representative mobile/desktop checks pass; the README shows the working application; each release explains visible changes.

### v1.0 — Only if the project is ready

A 1.0 label is **not** a deadline or a promise of unrestricted Deezer access. Public distribution of third-party music experiences may require provider or rights-holder authorization. If those rights cannot be obtained, switch to authorized media/sources or restrict affected features. Don't describe browser-accessible previews as inherently licensed.

Before considering 1.0: verified real-browser playback and fallback states, accessibility baseline, privacy review, no known critical regressions, accurate legal/provider guidance, and clear setup documentation.

## What counts as real progress?

Use a simple trail for each improvement:

1. **Issue:** Describe the problem, how to reproduce it, and what “done” means.
2. **Change:** Work on a focused branch or commit referencing the issue (for example, `Fixes #1` when finished).
3. **Evidence:** Run `npm run check`; add a browser screenshot or regression test when the issue affects UI or playback.
4. **Release:** Verify GitHub Pages, update [CHANGELOG.md](CHANGELOG.md), and close the issue once the acceptance criteria are met.
5. **Portfolio:** Update the README only when there's something concrete to show. Don't make cosmetic commits merely to fill an activity calendar.

## Sustainable maintenance rhythm

| When | Checklist |
| --- | --- |
| **On every meaningful code change** | Review affected issue → `npm run check` → verify relevant UI/behavior → commit with a clear message |
| **About once a month (15–30 minutes)** | Open the live site and direct app; test real catalog search, preview, autoplay and a Duels round; review failed Actions runs; confirm links/screenshots work; triage open issues |
| **After each release** | Update changelog, roadmap status, version references, and add any new regression tests |
| **Every quarter** | Review external provider behavior/terms, browser changes, accessibility debt, and whether roadmap priorities still matter |

If capacity is limited, **one well-tested fix per month is better than frequent low-value commits**. Keep incomplete items open rather than marking them shipped for appearances.

## Known boundaries and risk register

- **External music provider:** Deezer API and preview behavior can change or vary by region. Automated mocked tests don't prove live playback. Track live failures explicitly.
- **Usage rights:** Copyrighted audio, lyrics, and artwork require appropriate permissions. The MIT source license covers AFTERTONE code, not third-party media.
- **Static hosting:** GitHub Pages cannot execute the local Node server. The browser adapter and the local app should each have appropriate regression coverage.
- **Local storage:** Browser clearing removes saved progress unless the user has an export/backup. Treat safe recovery as a planned feature, not a current guarantee.
- **Deployment regressions:** Previous stylesheet and ESM import path issues caused blank or unstyled screens. Browser-level smoke tests are the top engineering priority.

## Keeping this roadmap honest

**Planned** = issue exists and acceptance criteria are defined. **In progress** = an implementation branch/PR or documented work exists. **Shipped** = code merged, checks passed, deployed if appropriate, and issue closed. **Blocked** = dependency or provider policy prevents safe completion. Update status as work happens; do not imply a feature is complete solely because CI is green.

The older [NEXT_STEPS.md](NEXT_STEPS.md) records ideas from the early prototype and is retained for historical context. This document is the current source of truth.
