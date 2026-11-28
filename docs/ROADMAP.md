**v0.12 Taste Map listening journal (November 27, 2026):** Added read-only decision history, path breakdown, Keep/Pass filtering and bounded 20-row paging. Optional title metadata survives future reload/backup; older events remain readable without invented titles. Tune Lab score presentation uses verified quiz counters. Automated verification covers browsing, escaping and persistence; physical-device review remains open.

**v0.12 verified personalization milestone (November 27, 2026):** Playlist imports, deletion and chosen artist preferences require storage read-back. Oversized unique playlists are rejected with a visible explanation rather than truncated; file/link operations share a dialog-level exclusion guard. Backup limits and keys share a module. The playlist dialog distinguishes saved versus active tailoring and does not disable an unrelated active artist profile on deletion. Automated tests cover failure and retry; manual device/provider checks remain open.

**v0.12 transition and persistence hardening (November 27, 2026):** Pending Keep/Pass animation callbacks are canceled when their listening context ends, and automatic playback cannot advance during a decision. Tune Lab answer scores require read-back before revealing the result; failure leaves the question retryable. Static packaging now discovers all public modules and handles nested imports. Automated verification covers these changes; manual device and real-provider checks remain open.

**v0.12 non-destructive restore comparison (November 27, 2026):** Restore confirmation now previews current → incoming counts across listening, tournaments, quizzes, artists, imported playlists and lyric offsets. Any reduction gets an explicit warning; legacy v1 settings omitted from the file are identified as unchanged. Corrupt current data yields a comparison-unavailable warning, not fabricated zeroes. Node and simulated Chromium/Firefox confirmation/cancel checks cover this UI; real cross-device restore verification remains open (#5/#7).

**v0.12 Collection overview milestone (November 27, 2026):** Added full-library saved-song, artist, genre and mood insight totals, transparent missing-metadata disclosure, and top genre/mood quick chips that toggle the existing browse-only facet filters. UI caps remain 40 song cards per page; no persistence changes. Node plus fictional Chromium/Firefox mobile checks cover focus, toggling, counts, and escaping. Manual screen-reader and real mobile acceptance stay open (#7).

**v0.12 saved Collection matching hardening (November 27, 2026):** Genre/mood filters now combine labels that differ only by case, spacing or accent marks and retain selected facets when a representative label changes. Search matches common accent variants in song and artist names. Blank/default saved moods correctly fall back to meaningful provider metadata, while explicit Tune Lab moods win. Node and synthetic Chromium/Firefox fixtures cover saved-data neutrality, filtering and search; physical-device checks (#7) and provider permission review (#3) remain open.

**v0.12 Collection genre/mood faceted browsing (November 23, 2026):** Saved Collection now supports combined global genre and mood filtering, full-library facet counts, Tune Lab mood overrides, 40-card paging, existing search/sort, accessible match counts and Clear Filters recovery. Filtering is browse-only; full CSV/JSON/progress backups still contain all saved tracks. Added 123-song Node and fictional 390px Chromium/Firefox regressions for keyboard focus, escaping and data neutrality. Manual accessibility and real-device checks remain open (#7); rights review remains open (#3).

**v0.12 verified session mutations (November 23, 2026):** A browser can silently discard session writes without throwing; listening progress now confirms read-back. Keep/Pass (including shared challenges), decision Undo, Collection Remove/Undo, Music Duels Save Podium/Champions, Tune Lab mood, and destructive history reset only update state or report success after confirmed storage. Node regressions cover no-ops, throws, blocked reads and recovery; fictional 390px Chromium/Firefox regressions exercise safe retries. Real browser storage restrictions and device accessibility acceptance remain open (#5/#7).

**v0.12 bounded Collection paging (November 23, 2026):** Large saved libraries now mount at most 40 cards per page, with touch-sized Previous/Next controls, a page selector, visible ranges and accessible focus after navigation. Searches/sorts operate over all saved songs; CSV/JSON/backup exports and Undo retain all data. An indexed catalog lookup and saved-order sort avoid quadratic work on large libraries. Node and fictional 390px Chromium/Firefox 123-song tests cover navigation, full export and unchanged votes. Manual real-device screen-reader/performance verification remains open (#5/#7).

**v0.12 Collection player accessibility and mobile efficiency (November 23, 2026):** Saved-song preview controls now announce the correct Listen/Pause/Cancel loading action for the visible title, while repeated media timeupdates skip full-grid control scans until playback state actually changes. Rendered Collection grids invalidate the cached state so active buttons remain correct after sorting. Node plus synthetic 390px Chromium/Firefox coverage verifies labels and no unnecessary button traversals. Real phone and assistive-technology verification remain open (#7).

**v0.12 Music Duels accessible preview recovery (November 23, 2026):** A failed or browser-blocked contender preview now retains a persistent error and keyboard-identified Retry A/B action instead of looking like an ordinary paused recording. A separate polite status announces the failure without flooding the listener with progress updates, and Mystery Matchups exposes only contender A/B. Fictional provider/browser-policy regressions in Chromium and Firefox verify recovery and unchanged votes; manual assistive-technology checks remain open (#2, #7).

**v0.12 Music Duels durability follow-up (November 23, 2026):** Active tournament archives cannot end on an entirely decided nonfinal round without the next round generated by the normal voting engine; such data would be impossible to resume and is rejected during load and backup inspection. Tournament and selection writes now verify read-back, preventing silently dropped browser storage updates from reporting saved success. Node regressions cover incomplete 8/16-song progress, untrusted backups and storage failures. Real-device migration verification remains open (#5/#7).

**v0.12 autoplay quota recovery milestone (November 23, 2026):** When Deezer temporarily rate-limits a preview (HTTP/JSONP 429), continuous listening now stops on the same unheard song rather than skipping multiple recordings and multiplying provider traffic. The track stays eligible for an explicit retry, and a failed signed-preview refresh follows the same quota classification. Chromium and Firefox smoke checks at 390px verify one intentional Pass, no additional votes, no automatic request chain and manual recovery with fictional metadata. Real provider and license checks remain open (#2/#3).

**v0.12 Music Duels archive-integrity milestone (November 23, 2026):** Saved tournaments and backup imports now reject inconsistent round advancement, premature future rounds, mismatched bronze contestants, and podiums that disagree with recorded votes. Node tests verify valid mid-round and complete brackets at 2/4/8/16 entrants alongside forged winner rejection. This guards Hall of Fame results but does not replace real-device or provider licensing checks (#3, #5, #7).

**v0.12 verified restore milestone (November 22, 2026):** Browser-data restores now verify each persisted write or removal and all rollback writes. Silent storage failures no longer report a false success; incomplete recovery is explicitly flagged. Node regressions cover silent `setItem`/`removeItem` failures and malformed Music Duels entries. Physical-device/cross-browser restore validation remains open (#5).

**v0.12 mobile Filters keyboard milestone (November 22, 2026):** The fixed discovery Filters drawer now contains Tab/Shift+Tab focus, preserves Done focus across live rerenders, prevents background rating shortcuts, and clears dialog semantics on close/desktop resize. Chromium and Firefox smoke tests cover 320px/390px dialog behavior. Real mobile-device and assistive-technology verification remain open (#7).

**v0.12 manual media-permission milestone (November 22, 2026):** Manual Play permission denial uses neutral recovery, never a broken-source classification. A persistent keyboard-friendly retry message and same-song single-preview recovery have controlled Chromium/Firefox regression coverage; real device media policies, screen readers and provider usage rights still need review (#2, #7).

**v0.12 Blind Mode accessibility milestone (November 22, 2026):** Discovery's Blind toggle preserves keyboard focus after the card rerenders. Shared blind challenges show a noninteractive Locked indicator instead of a misleading switch; their B shortcut cannot silently change the user's saved preference. Node and synthetic Chromium/Firefox tests at 320px cover these interactions without modifying votes. Manual screen-reader/physical-device verification remains open (#7).

**v0.12 challenge-library usability milestone (November 21, 2026):** Pass the Aux can now browse all eligible unselected saved Deezer songs in 40-row pages, not just the first 40. Search, counts, selected-track exclusion, keyboard focus, 320px mobile controls and page changes have Node and synthetic Chromium/Firefox coverage. Manual screen-reader/mobile-device verification remains open (#7); permissions and real provider playback remain open (#2/#3).

**v0.12 data migration milestone (November 21, 2026):** Authentic early v1 backups with no `savedTracks` property now restore favorite IDs without fabricated track details; malformed v1 and v2 data remains rejected. Export and restore explicitly disclose incomplete favorite metadata, while later playlist/lyric settings are retained on v1 imports. Node and simulated Chromium/Firefox coverage added. Manual cross-device/cross-browser transfer verification remains open (#5).

**v0.12 first-run milestone (November 21, 2026):** New visitors can start their first preview directly from the inline guide, see a loading state, or use the existing single retry action when discovery is unavailable. The action delegates to existing Play, with keyboard focus, no speculative audio request, and no false Keep/Pass. Browser tests use fictional Deezer data; manual licensed playback and assistive-technology checks remain open (#2, #3, #4 and #7).

**v0.12 reliability follow-up (November 21, 2026):** Discovery now uses bounded progressive cooldowns for repeated Deezer failures, while explicit **Retry Discovery** remains available. Node and simulated browser evidence covers rapid-repeat protection and automatic recovery. This does not resolve issue #2's real-provider/manual-availability criteria or issue #3's public-use permission requirements.

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


**v0.12 preview navigation milestone (November 27, 2026):** Added session-only Auto-advance toggle and neutral Next/Previous controls. Default autoplay remains unchanged, unrated history is bounded and scoped to active feed, and shared challenges remain isolated. Browser/provider rights and physical-device validation remain open.
