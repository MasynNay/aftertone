**v0.12 development note (November 20, 2026):** Shared blind-challenge reliability and customization advanced through [PR #74](https://github.com/MasynNay/aftertone/pull/74) (valid fresh-browser Deezer links), [PR #75](https://github.com/MasynNay/aftertone/pull/75) (provider-outage retry and honest partial continuation), and [PR #76](https://github.com/MasynNay/aftertone/pull/76) (skip broken audio without false votes). [PR #77](https://github.com/MasynNay/aftertone/pull/77) now ships a searchable, ordered five-song challenge editor. Follow-up work preserves an edited ID-only draft across reloads of the same browser tab when session storage is available. Mocked Node/Chromium/Firefox evidence is not evidence of licensed or reliably available real playback. Leave provider permissions and real-device accessibility issues open.

# AFTERTONE — Product & Engineering Roadmap

**Project:** [AFTERTONE](https://aftertone.masynnay.com/) · **Full-screen app:** [Launch the app](https://aftertone.masynnay.com/demo/) · **Backlog:** [Open issues](https://github.com/MasynNay/aftertone/issues) · **Releases:** [Changelog](CHANGELOG.md)

**Last reviewed:** November 17, 2026  
**Current release:** v0.11.0  
**Approach:** Ship small, verified improvements. Version targets indicate order of work, **not promised release dates**.

AFTERTONE is an independent, free and open-source music-discovery product: real catalog search where available, personalized discovery modes, short previews, Keep/Pass, collection, autoplay, themes, and six Music Duels arenas. The public version runs on GitHub Pages with a browser-side provider adapter; the local Node server remains in `app/server.mjs`.

## Release plan

| Target | Priority | Focus | Status |
| --- | --- | --- | --- |
| **v0.10.2 — Trust & stability** | P0 | Prevent blank pages, recover from provider failures, confirm media permissions | In progress · browser, preview and CSS asset guards shipped |
| **v0.11.0 — More rewarding discovery** | P1 | First-run UX, safe save-data backup/restore, Music Duels hardening | **Released** · [v0.11.0](https://github.com/MasynNay/aftertone/releases/tag/v0.11.0); independent manual checks remain open |
| **v0.12 — Experience & presentation** | P2 | Accessibility/mobile QA, actual app screenshots, better release communication | In progress · keyboard, phone tap targets and contrast improved |
| **v1.0 — Responsible public readiness** | Gate | Only after cross-browser reliability, provider rights, privacy, and licensing are resolved | Conditional |

### v0.10.2 — Trust & stability (next up)

- [ ] [#1: Automated real-browser smoke tests for landing and full app](https://github.com/MasynNay/aftertone/issues/1). Catch broken CSS, import paths and blank app views before deployment.
  - **Automated portion shipped:** [PR #10](https://github.com/MasynNay/aftertone/pull/10) gates deployment on desktop/mobile Chromium. [PR #24](https://github.com/MasynNay/aftertone/pull/24) additionally validates built CSS `url()` references against published files. Manual Firefox/Chrome provider verification remains a separate check.
- [ ] [#2: Recover gracefully from Deezer catalog/preview failures](https://github.com/MasynNay/aftertone/issues/2). **Partial implementations shipped:** [PR #11](https://github.com/MasynNay/aftertone/pull/11) adds Retry Preview, Skip Without Voting, Retry Discovery, and isolated JSONP cancellation; [PR #24](https://github.com/MasynNay/aftertone/pull/24) cleans blocked script insertion; [PR #31](https://github.com/MasynNay/aftertone/pull/31) distinguishes Deezer error envelopes from missing previews; and [PR #34](https://github.com/MasynNay/aftertone/pull/34) verifies an outage and no-reload recovery in Chromium and Firefox. The empty outage state now presents one accessible error and Retry Discovery action. The older mixed-source loader no longer permanently exhausts sources after a temporary error; this path remains disabled in the current Deezer-only startup pending provider authorization and product review. Deezer throttling (HTTP 429 or error envelope) now produces actionable retry guidance and stops additional fallback artist requests; public JSONP responses retain the 429 status. Real-provider availability, regional behavior and usage permissions remain open.
- [ ] [#3: Review third-party music and artwork permissions](https://github.com/MasynNay/aftertone/issues/3). Document authorization or provide a rights-cleared public fallback; a portfolio disclaimer alone does not establish usage rights.

**Exit criteria:** `npm run check` passes; both public routes pass a real-browser smoke test; at least one actual preview is manually tested where permitted; provider failures yield a useful state; required media permissions are addressed.

### v0.11 — More rewarding discovery

- [ ] [#4: First-run guidance and useful empty states](https://github.com/MasynNay/aftertone/issues/4). **First milestone shipped:** [PR #14](https://github.com/MasynNay/aftertone/pull/14) adds inline first-listen steps, non-destructive empty-search recovery, broaden filters and route switching. A subsequent v0.12 development milestone preserves keyboard focus through repeated provider retries, Clear Search, Broaden Filters and route changes, with simulated Chromium/Firefox outage regression coverage. Manual screen-reader, real-device and live-provider checks remain open.
- [ ] [#5: Safe browser-data backup/restore and migration checks](https://github.com/MasynNay/aftertone/issues/5). **Core shipped:** [PR #12](https://github.com/MasynNay/aftertone/pull/12). **Extension shipped:** [PR #13](https://github.com/MasynNay/aftertone/pull/13) adds imported playlist metadata, lyric timing adjustments, backward-compatible v1 restore and late-write rollback to format v2. Current work also prevents silent export of corrupted local progress instead of substituting empty defaults. Manual Firefox/Chrome restoration and future schema migrations remain open.
- [x] [#6: Music Duels reliability across arenas and refreshes](https://github.com/MasynNay/aftertone/issues/6). **Shipped:** [PR #15](https://github.com/MasynNay/aftertone/pull/15) tests all six arenas at 4/8/16 entrants, provides honest size-aware eligibility and empty-pool help, resumes brackets after reload, protects votes on storage failure, and exercises the podium and Hall CSV in Chromium. [Walkthrough](MUSIC_DUELS.md).

**Exit criteria:** New listeners understand the first run; saved data survives upgrades; tournament states are tested and recoverable.

### v0.12 — Experience & product proof

- [ ] [#7: Accessibility and responsive interface audit](https://github.com/MasynNay/aftertone/issues/7). **Partial milestones merged:** [PR #23](https://github.com/MasynNay/aftertone/pull/23) added skip navigation, modal focus management, native Space shortcuts, reduced motion, narrow-screen overflow fixes and representative theme contrast tests. [PR #25](https://github.com/MasynNay/aftertone/pull/25) verified 44px touch targets for primary phone controls. [PR #26](https://github.com/MasynNay/aftertone/pull/26) now names focused app sections and removes whole-screen live announcements; [PR #27](https://github.com/MasynNay/aftertone/pull/27) provides concise, deduplicated preview status announcements. Node/build and Chromium 1440/390/320px checks passed before merging. Manual Firefox, screen-reader, real-device touch, zoom and wider component contrast audits remain; [verification record](ACCESSIBILITY.md).
- [x] [#8: Real application screenshots and consistent release notes](https://github.com/MasynNay/aftertone/issues/8). **Completed:** the product README now shows verified browser captures of Discover, Collection, Music Duels setup, an in-progress four-song bracket, and the completed podium. The [screenshot provenance](SCREENSHOT_PROVENANCE.md) explains fictional test tracks, the real browser workflow and non-claims about external playback; the changelog and [release checklist](RELEASE_CHECKLIST.md) keep releases accountable. Refresh screenshots whenever the UI changes materially.

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
