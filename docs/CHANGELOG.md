## v0.12 development — Repair public blind challenge links (November 20, 2026)

- **Make my challenge** accepts saved Deezer recordings and creates an ID-only link; it never includes local preferences, listening history, signed playback URLs or private Jellyfin paths.
- A new, bounded lookup resolves up to five requested Deezer tracks in a fresh visitor's browser on both static hosting and the Node server. Missing or rejected records are omitted without substituting unrelated songs.
- **Try a sample** uses loaded Deezer tracks only and reports the actual clip count; no more empty or invalid challenge-link parameters.
- Added Node provider-validation and local-endpoint tests plus Chromium/Firefox simulated browser journeys. Deezer availability and authorization for public music games remain separate, unresolved checks.

## v0.12 development — Continue keyboard navigation through Music Duels (November 20, 2026)

- Starting and reopening brackets now put focus on the next available preview. Each vote moves to the following matchup; the last vote focuses a readable podium heading, without starting playback or changing any listening preferences.
- Closing/deleting a bracket restores focus to an available archive action or arena choice, while Hall of Fame period changes preserve select focus across redraws.
- Added a Node regression and simulated real-browser keyboard tournament journey in Chromium/Firefox. Physical screen-reader and live-provider playback checks remain open.

## v0.12 development — Keep keyboard focus through Tune Lab questions (November 19, 2026)

- Starting or advancing a Tune Lab question now focuses the first available answer, or Skip if the current collection cannot provide multiple choices. Keyboard listeners no longer land on a deleted Start / Next button.
- After an answer, focus moves to the visible, polite result announcement rather than being stranded on a now-disabled answer button. Mood selections expose `aria-pressed` and retain the focused mood through rerenders so users can compare choices without restarting keyboard navigation.
- Added Node view/controller checks and full Chromium/Firefox phone-width keyboard tests for Start, answer/result, mood switching, and Next. Real screen-reader speech and physical-device testing remain outstanding.

## v0.12 development — Cancel stale media-error recovery (November 19, 2026)

- After an already-started preview encounters a media error, the Deezer URL refresh or Audius fallback now enters the same cancelable **loading preview** state as a normal Play request. A second manual Play cancels the retry; Stop or changing sections also invalidates it.
- Both the provider-response and later media-playback continuations check the original playback generation. Abandoned retries cannot attach a replacement source, set success/failure status, or restart audio for a newer listening session, even if the same track was quickly replayed.
- Added focused Node regression checks and phone-width Chromium/Firefox browser coverage for aborting an in-flight media-error refresh, harmless late callbacks and a fresh manual retry. Automated fixtures do not validate actual Deezer/Audius playback or media permissions.

## v0.12 development — Let listeners cancel a loading preview (November 19, 2026)

- Clicking Play again while the same preview is still resolving now **cancels** the pending metadata request instead of silently doing nothing. The button changes to a labeled Cancel loading preview control while busy, and a later Play starts a fresh request.
- The cancellation ends continuous listening, stops the old provider lookup, prevents delayed callbacks from starting playback, and leaves Keep/Pass, saves and history untouched. Automatic resume checks still ignore duplicate requests rather than canceling themselves.
- Saved Collection and Music Duels preview controls now show a Cancel loading label for their pending track as well. Added Node assertions and Chromium/Firefox phone-width fixture checks; real-provider reliability and permission reviews remain separate gates.

## v0.12 development — Stop pending playback when opening dialogs (November 19, 2026)

- Opening Help, Appearance themes, a playlist dialog, onboarding or an official video modal now ends the automatic listening session. If a short preview is still resolving, its on-demand metadata request is canceled and its playback generation invalidated before the dialog is shown, preventing the recording from starting behind the modal.
- An already-loaded preview is only paused, retaining its position so the listener can manually resume after closing the dialog. Background listening never restarts without another Play.
- Added Node controller checks and Chromium/Firefox phone-viewport fixtures for a held preview request, dialog opening, safe delayed callbacks, focus restoration and a clean subsequent Play. Real provider playback and physical screen-reader checks remain outside this automated test.

## v0.12 development — Keep discovery-path keyboard focus (November 19, 2026)

- Switching among Comfort Zone, New Territory and Wild Card now keeps keyboard focus on the selected path button rather than unexpectedly moving it to Play or the page landmark.
- The focused option survives the immediate Discover rebuild and any later catalog-loading rerender, while `aria-pressed` continues to identify the active mode. Changing paths still requests a genuinely different discovery lane; no Keep/Pass votes are created by changing a setting.
- Added a Node wiring regression and phone-width Chromium/Firefox interaction checks. Real screen-reader navigation and physical touch-device behavior remain separately unverified.

## v0.12 development — Stop abandoned preview metadata requests (November 18, 2026)

- Closing an active preview, switching to a new song or navigating away from Discover now aborts any pending on-demand preview metadata lookups. Previously the player ignored stale replies but allowed their underlying provider calls to keep running.
- A new per-track request scope coalesces simultaneous requests for the same song; cancellation releases those entries immediately and prevents late, canceled replies from populating the preview URL cache. Fresh user-initiated playback can request a new URL without joining the old canceled request.
- Added deterministic request-scope regressions and Chromium/Firefox browser tests for a held Deezer JSONP lookup, Stop, navigation, late callback safety and a fresh Play attempt. Mocked records verify client behavior only, not provider availability or playback permission.

## v0.12 development — Protect spreadsheet CSV exports (November 18, 2026)

- Collection, Music Duels podium and Hall of Fame CSV exports now use one shared encoder. It quotes commas and double quotes as before, and neutralizes track names, artists and tournament names that a spreadsheet might interpret as formulas (including values starting with =, +, -, @ or leading whitespace before them).
- This affects **downloaded CSV text only**. Displayed song names, JSON backups, saved records, source URLs and tournament results are unchanged; users can still distinguish the exact metadata in the app.
- Added malicious-metadata regression tests for all three exporters and a real Chromium/Firefox fixture download from Collection. No claims are made about external provider authorization or a full spreadsheet-app security audit.

## v0.12 development — Preserve listening controls through background redraws (November 18, 2026)

- A provider refresh can replace the active listening card while keyboard users are adjusting preview volume, preview position or lyrics. The same-track card now restores focus to Play, preview volume, Lyrics or synchronized-lyrics offset controls when those controls remain visible.
- A new song, route change or hidden/disabled control never inherits focus from an old card. Keyboard Arrow input remains native for sliders and cannot accidentally record Keep/Pass votes.
- Added Node and real Chromium/Firefox fixture-browser checks for same-track rerenders, slider values, keyboard behavior and deliberate navigation. Physical screen-reader or touch-device interaction remains separately unverified.

## v0.12 development — Cancel obsolete timed-lyrics requests (November 18, 2026)

- Optional LRCLIB lookups now receive an AbortSignal from the active listening card through the static browser adapter and lyrics helper. Advancing to another song, disabling lyrics or leaving Discover cancels pending work rather than only ignoring its eventual display.
- The lyrics helper stops during its provider pacing delay or HTTP fetch and does not store a canceled lookup as a provider error. A subsequent request for the same track can retry normally. Timeout handling, verified artist/title matching and optional lyric offset controls remain intact.
- Added deterministic cancellation tests and a Chromium/Firefox built-site regression for song changes, disabling and re-enabling lyrics, and a fresh successful fixture response. These tests use fictional lyric lines and make no claim of lyric reproduction rights or live LRCLIB reliability.

## v0.12 development — Keep keyboard focus inside the theme dialog (November 18, 2026)

- Choosing one of the 20 appearance themes inside the modal no longer moves keyboard focus to the header theme button behind the inert page backdrop. Instead, focus remains on the selected color tile after the dialog rerenders, and Escape still closes the dialog and returns focus to its original opener.
- Preserve the existing behavior of the separate, non-modal header palette: selecting a theme closes that palette and returns focus to the header toggle. Add focused Node guards and browser tests for both interactions in Chromium and Firefox.
- This is a narrow automated keyboard-accessibility fix. It does not establish manual VoiceOver/TalkBack compatibility, full WCAG conformance or a physical-device audit.

## v0.12 development — Stop stale artist-graph requests after changing taste (November 18, 2026)

- Changing or clearing the active artist/playlist personalization now aborts outstanding related-artist lookups from the prior session. These requests previously kept running after listeners returned to fresh discovery or changed their chosen artists.
- Use a fresh AbortSignal for each personalization generation and send it through all three graph request paths: initial seed exploration, saved-Keep warmup and one-hop expansion after a Keep. Old callbacks stay inert under the existing bounded JSONP cancellation rules.
- Preserve unrelated discovery, existing favorites, playback and completed graph metadata. Add Node contract tests and a Chromium/Firefox browser scenario that leaves a seed artist lookup pending, exits to fresh discovery, and simulates its late response without a stale result or listening vote. Test tracks are fictional.

## v0.12 development — Cancel abandoned playlist dialogs (November 18, 2026)

- Closing or replacing the playlist import dialog now aborts an in-flight Deezer playlist request, including a slow playlist metadata/page lookup, instead of continuing the import after a listener leaves the dialog.
- Bind each import result to the exact dialog that started it. Reopening another playlist dialog cannot receive a stale result or error from an older request, and a delayed local CSV/JSON file read is ignored if its original dialog has closed.
- Preserve normal successful imports, keyboard Escape and modal focus-return behavior; add a browser regression for closing a pending import, safely ignoring a late callback, reopening and completing a fresh import. Third-party music remains mocked in CI.

## v0.12 development — Cancel other obsolete Deezer requests (November 18, 2026)

- Forward the caller's cancellation signal to on-demand Deezer preview metadata, playlist-link import pages, and related-artist graph lookups, while retaining each provider helper's own timeout. Abandoned lookups now remove their JSONP scripts and stop follow-on playlist/artist requests instead of silently continuing after a user changes course.
- Prevent independent related-artist callers from sharing one cancelable in-flight Promise. Canceling one listener's request must not terminate another listener's healthy request for the same artist; cached completed results and normal fetcher coalescing remain available.
- Add deterministic tests that abort preview metadata and a multi-page playlist import, then exercise concurrent related-artist lookups with one cancellation and one successful result. Tests use fictional API responses; they do not establish live Deezer availability or permission to use commercial music.

## v0.12 development — Cancel an active swipe when a second finger arrives (November 18, 2026)

- A second touch anywhere on the page now cancels a primary listening-card drag, resetting its animation and preventing the first finger's later release from saving an unintended Keep or Pass.
- Extended the 390px/320px Chromium and Firefox smoke checks with a primary-drag-then-secondary-touch regression, plus a source-level guard for page-wide contact handling. These are browser simulations, not physical touchscreen validation.

## v0.12 development — Safer phone swipe decisions (November 18, 2026)

- Only primary-pointer horizontal swipes on the original listening card can record Keep or Pass. Secondary touch contacts and right mouse-button drags are neutral, so accidental inputs cannot silently change taste history.
- Capture an active pointer on its original card so a deliberate release just outside that card remains reliable. Cancel gestures when the browser takes over touch scrolling, focus leaves the window, a pointer is lost, or the card is replaced by a rerender or view change.
- Partial/vertical drags now clear the card preview and never count as listening votes. Keep/Pass remains available through the large on-card buttons and existing keyboard shortcuts.
- Added source-level guards plus Chromium/Firefox mobile-width tests at 390px and 320px for neutral drags, cancellation, exact Keep/Pass votes, pointer capture and view-switch safety. These are simulated pointer inputs on real browser engines, not physical touch-hardware or screen-reader certification.

## v0.12 development — Late JSONP cancellation safety (November 18, 2026)

- A canceled Deezer JSONP script may still execute after its tag is removed, depending on browser timing. Replacing its callback with an inert short-lived function prevents `window.__aftertoneDeezer_* is not a function` page errors while keeping obsolete results isolated from the active search.
- The inert callbacks expire after 15 seconds, are capped at 48 entries and only delete themselves if still unchanged. Normal successful responses continue removing callbacks immediately.
- Added Node tests for aborted/timed-out late callbacks, bounded cleanup and successful requests, plus updated Chromium/Firefox stale-search regressions to simulate a late canceled script. This is browser reliability work, not a live-provider availability or media-usage claim.

## v0.12 development — Mobile Filters keyboard recovery (November 18, 2026)

- Made the mobile Filters overlay explicitly dismissible via a 44px **Done** button and Escape. Opening places focus on Done rather than triggering the phone's software keyboard, and closing restores focus to the Filters opener.
- Submitting a music search dismisses Filters and returns focus to Discover so new results are visible. Switching sections resets the button's expanded state, and selecting genre/language/discovery mix preserves keyboard focus through sidebar rerenders.
- Added source-level checks and Chromium/Firefox browser regressions at 390px and 320px, covering Escape, Done, search, select focus, section navigation, no reload or false listening votes.

## v0.12 development — Cache pinned Playwright browser downloads (November 18, 2026)

- Reuse the version-pinned Chromium/Firefox browser binary cache in GitHub Actions instead of downloading both from scratch on every build, while still installing OS dependencies and executing every existing browser and Node check.
- Cache keys include runner OS, architecture, Ubuntu 24.04 and Playwright 1.56.0, so changing versions cannot silently reuse incompatible browsers. A cache miss remains a normal verified build; caching does not bypass tests or the Pages deployment gate.

## v0.12 development — Avoid redundant artist searches during Deezer outages (November 18, 2026)

- On Deezer artist lookup timeout, transport/network failure, HTTP 5xx or throttling, return the original provider failure instead of immediately requesting an additional ranked search. A user-initiated Retry Discovery remains available and does not change saved favorites or history.
- Retain ranked-search fallback when the artist index or top-list endpoint genuinely returns HTTP 400/404 or lacks a verified playable match; fallback artist tracks still require an exact artist identity.
- Added Node regressions for timeouts, transport failures, HTTP/JSONP 5xx, and valid 400/404 fallback. Chromium and Firefox simulate a failing artist index, confirm no redundant provider search and recover via Retry without a reload or listening vote.

## v0.12 development — Cancel stale Deezer discovery requests (November 18, 2026)

- When a listener submits another search or changes listening paths/filters while discovery is still fetching, cancel the obsolete request instead of allowing it to update shared catalog metadata or fire additional fallback lookups.
- Forward the browser's AbortSignal through Deezer JSONP chart and artist-resolution requests while retaining the per-lookup timeout. Cancellation removes the obsolete JSONP script and callback and does not appear as a provider error or a false listening vote.
- Preserve an interrupted path's unprimed state so reopening it still fetches its own real first page. Added Node cancellation tests and Chromium/Firefox checks that hold an old request unanswered while a newer search completes, with fictional provider records.

## v0.12 development — Undo accidental Collection removals (November 17, 2026)

- Added a persistent **Undo Remove** action whenever a song is removed from Collection, including the final saved song. The last removed track can be restored in the same browser tab until another removal supersedes it or the tab reloads.
- Restoration preserves the saved-song order and existing listening history; the app does not manufacture a new Keep vote. A focused Remove button hands focus to Undo, and Undo returns focus to a safe Collection control.
- Added Node and real Chromium/Firefox regression tests for order preservation, duplicate prevention, last-song removal, keyboard focus, no lost listening choices and successful persistence through reload. Automated provider results remain fictional.

## v0.12 development — Collection search recovery and keyboard sorting (November 17, 2026)

- Added truthful saved-song match counts and explicit Clear Search / Show All Saved Songs actions in Collection, including a direct recovery option when no saved tracks match a filter.
- Restored focus to the Collection search input after a keyboard-activated clear action, and to the replacement sort dropdown after changing order. Filtering also retains full text selection instead of collapsing it.
- Added Node rendering/behavior assertions and Chromium/Firefox browser regressions for empty filters, reset, sorting, focus, no page reload and unchanged saved favorites.

## v0.12 development — Search draft continuity during discovery refreshes (November 17, 2026)

- Fixed an unfinished music search disappearing whenever background discovery or an unrelated UI action rerendered the sidebar. The draft is now separate from the active submitted query.
- Preserve keyboard focus and the exact text selection/caret if a rerender occurs while a listener is editing the search field. Deliberately clearing the search still clears the draft; switching sections retains it until submitted.
- Added Node markup regressions and Chromium/Firefox browser coverage for draft persistence, caret/focus retention, cross-section navigation and Enter submission using fictional provider fixtures.

## v0.12 development — Keyboard continuity when discovery is empty (November 17, 2026)

- Fixed a keyboard dead end after Retry Discovery replaced its own button with a loading state: focus now returns to the rebuilt Play control on success or the new enabled Retry action on another outage.
- Applied focus continuity to Clear Search, Broaden Filters and keyboard-selected discovery-path changes, without stealing focus after pointer actions or after the user moves to another control while waiting.
- Extended real Chromium and Firefox provider-outage checks to press Enter for an unsuccessful retry followed by a successful retry, preserve Keep/Pass history and assert focus returns to a usable target.
- Provider calls use fictional test fixtures. Live Deezer playback and music-use authorization are still separate open requirements.

## v0.12 development — Honest backups and fresh-profile transfer verification (November 16, 2026)

- Corrected the Collection note: format v2 **does** include imported playlist artist/song names and manual lyric timing offsets, though never music files. The old notice incorrectly claimed both were omitted.
- Before a destructive restore, the confirmation now shows how many favorite artists and Tune Lab correct/answered results will be restored, in addition to saved tracks, decisions, tournament counts, imported playlist tracks and lyric offsets.
- Added Chromium and Firefox browser checks that export a real JSON backup with listening decisions, close the source browser profile, create a fresh independent profile, import using the actual file input and confirmation, and verify the saved track/decision, Tune Lab, artist choices, playlist and lyric offsets after a second reload.
- **Scope:** cross-profile transfer in each browser engine is automated; physical-device transfers, cross-engine transfer and screen-reader/manual accessibility remain open. Fictional fixture tracks do not verify music playback rights.

## v0.12 development — Request Deezer preview links only when listeners press Play (November 16, 2026)

- Rendering discovery cards and Music Duels no longer silently fetches short-lived Deezer preview URLs. Preview metadata is resolved **on demand** when listeners start playback or use Retry Preview, reducing unnecessary provider requests, especially during quotas/outages.
- Other provider-specific prewarming remains unchanged. First playback may incur a metadata lookup before the preview starts; Keep/Pass history, saved favorites, and neutral skip behavior are unchanged.
- Added built-site Chromium and Firefox checks requiring zero Deezer track-preview metadata requests during navigation, an actual metadata request on Play, and no false listening votes. These are fictional fixture tests with real external audio blocked, not provider-availability or licensing evidence.

## v0.12 development — Player-level Deezer rate-limit explanations (November 16, 2026)

- When a preview's metadata request returns HTTP 429, the visible Play status and **Retry Preview / Skip Without Voting** region now explain that Deezer is temporarily limiting requests and recommend waiting before retrying. Previously the player discarded that distinction and only said the stream was unavailable.
- Preserve the HTTP status through preview resolution without displaying raw provider responses as markup. Ordinary CDN/audio errors continue to show the existing generic recovery message; a subsequent retry clears an old quota warning when the failure reason changes.
- Added built-site Chromium and Firefox tests for metadata quota errors, visible recovery guidance, fresh preview link retry, ordinary CDN-error fallback and unchanged favorites/history.
- These are simulated provider responses and blocked media; public playback rights and real-world uptime remain unverified.

## v0.12 development — Recover cleanly from Deezer request throttling (November 16, 2026)

- Deezer can signal quota exhaustion inside a nominally successful HTTP-200 JSONP response or through HTTP 429. AFTERTONE now recognizes both as **temporary rate limits** and shows actionable “wait a moment, then retry” guidance rather than treating them as empty search results.
- A throttled artist lookup or artist-top request no longer triggers another immediate ranked catalog search, preventing fallback requests from amplifying a provider rate limit.
- The public GitHub Pages adapter preserves HTTP 429 for Deezer quota errors. Existing background retry backoff, Retry Discovery, saved favorites, and neutral skip behavior remain unchanged.
- Added deterministic Deezer search/preview tests and a Chromium+Firefox outage test asserting the useful 429 message. This does **not** independently verify current Deezer availability, regional restrictions or public music-use permissions.

## v0.12 development — Preserve future mixed-source recovery after temporary outages (November 16, 2026)

- Fixed a latent discovery bug: a failed Audius/Jamendo/Commons/Jellyfin request in mixed-source mode incorrectly marked its entire catalog permanently exhausted. That provider is now skipped only for the current fetch batch, with existing bounded background backoff and explicit Retry Discovery behavior preserved.
- Added deterministic regression checks for one-source failure, several simultaneous outages, an all-sources-down batch and subsequent recovery, without mutating truly exhausted pagination state.
- **Current public and main app startup defaults to Deezer-only**; this change hardens the dormant mixed-source fetch path rather than enabling additional third-party integrations or verifying their authorization. Actual upstream recovery and permissions remain unverified.

## v0.12 development — Keep, Pass and Undo keyboard continuity (November 17, 2026)

- When a keyboard user activates Keep or Pass, AFTERTONE now returns focus to the same visible decision on the next song rather than losing focus when the old card is replaced. Undo returns focus to its new control when enabled, or to the named main region when Undo becomes disabled.
- Added real Chromium and Firefox button-activation regression tests for Pass → Undo → Keep, verifying history/favorites, current-card restoration, no page reload and correct focus targets.
- Gesture/shortcut users retain their previous focus behavior. Manual screen-reader and device testing remains outstanding under #7.

## v0.12 development — Respect reduced motion during in-app scroll shortcuts (November 16, 2026)

- Search for an Artist, the Discover passport shortcut and entering a newly created Music Duels bracket no longer force smooth JavaScript scrolling when reduced motion is enabled. Normal-motion users retain the existing smooth transitions.
- Added automated Chromium/Firefox checks for real search-shortcut scrolling with reduced motion enabled at 720px and 360px, plus static guards for all three app-controlled scroll destinations.
- Actual human accessibility/device checks remain outstanding under issue #7.

## v0.12 development — Keyboard-safe preview failure controls (November 16, 2026)

- **Retry Preview** now transfers keyboard focus from the soon-to-be-hidden recovery buttons to the persistent Play/Pause control. **Skip Without Voting** moves focus to the next track's Play control, or the labelled main region if the feed is empty.
- New Chromium and Firefox browser tests block actual media access, exercise the real preview failure/retry/skip path with keyboard activation, verify a fresh provider-link resolution attempt, and confirm that no listening decision or favorite was recorded.
- No recordings were used in these tests. Real Deezer availability, human assistive-technology testing and media permissions remain outstanding.

## v0.12 development — Prevent silent loss during progress backup export (November 16, 2026)

- Backup Progress now **refuses export** when an existing listening session, tournament archive, Tune Lab record or favorite-artist record is malformed or unsupported, instead of silently replacing that source with an empty/default record. The original browser storage is left untouched.
- Fresh browsers can still export empty, valid backups; legacy version-1 listening sessions without `savedTracks` remain supported without changing the stored record.
- Added regression coverage for corrupt JSON, invalid saved tracks, invalid tournament metadata, damaged quiz counters, duplicate artist choices, fresh sessions and the legacy schema.
- This prevents misleading backups; it does not repair damaged local data or substitute for retaining an earlier known-good backup.

## v0.12 development — Zoom-equivalent reflow and reduced-motion browser audits (November 16, 2026)

- Added built-site Chromium **and Firefox** checks at 720px and 360px with reduced-motion preferences enabled, covering the marketing page, all six app sections, named landmarks, visible primary controls, animation suppression and horizontal overflow.
- 720px is a CSS layout proxy for reflow at approximately 200% zoom from a 1440px window, **not** an actual human browser-zoom or screen-reader test. Manual zoom and assistive-technology acceptance remain open under issue #7.
- The tests use fictional music fixtures, no external recording playback or media-rights claims.

## v0.12 development — Safer browser-data recovery verification (November 16, 2026)

- Added genuine Chromium and Firefox file download/import tests for versioned progress backups with a saved favorite, listening decision, volume, Tune Lab record, favorite artist, imported-playlist metadata and lyric offset.
- Both browsers now verify that an invalid format version is rejected without modifying saved data, and that restoring the exported file after intentionally clearing progress rehydrates the browser and shows the saved song in Collection.
- This is automated fixture testing; transferring a backup between physical devices, real music-provider availability and accessibility with assistive technology remain separate manual checks.

## v0.12 development — One clear retry when music is unavailable (November 16, 2026)

- When the current discovery path has **no playable song** and the provider fails, the empty state now owns the error announcement and displays one clearly labelled **Retry Discovery** action instead of repeating the same error above the page and showing a second **Find More Songs** button.
- When a playable song is still visible, the existing compact provider-warning banner and its retry action remain available, without replacing the active card.
- Added regression tests for one retry button, one error announcement and preservation of the in-card error banner. The Chromium and Firefox end-to-end outage/retry tests remain part of the deployment gate.

## v0.12 development — End-to-end Deezer outage and retry browser coverage (November 16, 2026)

- Added real Chromium and Firefox browser simulations of Deezer returning an error envelope inside HTTP 200. The test expects a visible, nonblank error state and an enabled Retry Discovery control, then switches the mock provider back online.
- Confirms a recovered song renders in-place without a page reload, and that a failed search plus retry cannot silently add Keep/Pass votes or change favorites.
- These tests use fictional data with all third-party requests blocked; live service uptime, regional behavior and media-use permissions remain separately unverified.

## v0.12 development — Real Music Duels bracket and podium in the product README (November 16, 2026)

- Added permanent, verified WebP screenshots of an in-progress four-track Music Duels semifinal and the complete podium / Hall of Fame / tournament-history screen, alongside the existing real Discover, Collection and Duels setup captures. All screenshots use fictional test songs and placeholder artwork.
- Verified the source browser PNGs through GitHub Actions, regenerated both images with a temporary restricted capture workflow, then removed that workflow before merging. Added an automated test for valid WebP image signatures, reasonable sizes, README links and screenshot provenance.
- Documented reproduction instructions and evidence boundaries in [SCREENSHOT_PROVENANCE.md](SCREENSHOT_PROVENANCE.md). This completes the engineering and documentation work for issue #8; screenshot accuracy still needs maintenance if the UI changes, and no media rights or actual Deezer playback is implied.

## v0.12 development — Verifiable in-progress Music Duels screenshot (November 16, 2026)

- Browser smoke testing now captures an actual **in-progress Music Duels bracket** after clicking Create Bracket and before the first vote; previously the captured Duels evidence was limited to setup and the completed podium.
- Successful pull requests upload a seven-day `aftertone-ui-evidence` artifact containing the rendered landing, Discover, Duels setup, in-progress bracket and podium screenshots. Missing evidence now fails PR CI instead of silently omitting the image.
- Evidence uses synthetic track metadata and blocks real provider requests. Publishing a screenshot into the README still requires inspecting the captured image; no audio rights, playback or accessibility claims are implied.

## v0.12 development — Deezer preview provider errors (November 16, 2026)

- Deezer can signal a rejected preview request in an HTTP-200 JSON or JSONP body. The preview resolver now distinguishes that provider error from an ordinary track without a playable preview, and handles malformed metadata without throwing an unrelated JavaScript TypeError.
- Both GitHub Pages and the local Node API return a recoverable error rather than a fake playable URL. The existing Retry Preview / Skip Without Voting flow remains unchanged and does not record a failed playback as a dislike.
- Added mocked provider error, missing-preview, malformed-response, and successful retry cases, including actual API calls through the browser-style adapter and local Node server. Automated tests do **not** establish real Deezer availability, media rights, or regional provider behavior.

## v0.12 development — Accurate preview recovery guidance (November 16, 2026)

- Preview failures now give source-aware advice instead of telling users of local Jellyfin or other music providers to retry a Deezer link. Deezer retries mention a fresh provider link; Jellyfin advises checking the local media server; other providers receive neutral retry/skip wording.
- **Retry Preview** and **Skip Without Voting** remain available and continue to preserve listening history and favorites after failed audio.
- Added tests for Deezer, Jellyfin, and another source plus a rendered browser assertion for a blocked Deezer preview. Provider availability, licensed usage and real media playback still require separate verification.

## v0.12 development — Accessible navigation and preview feedback (November 16, 2026)

- [PR #26](https://github.com/MasynNay/aftertone/pull/26) replaced full-screen live announcements with concise names for the focused app section and matching browser tab titles. Dialog focus behavior and the separate toast status are unchanged.
- [PR #27](https://github.com/MasynNay/aftertone/pull/27) made the Discover preview status a polite, atomic announcement for loading, playback, and failure. Identical updates are ignored so a 22-second preview does not repeat announcements on every time tick.
- Both PRs passed Node/build checks and actual generated-site Chromium smoke tests at desktop and small-phone widths before merging. The new browser regression measures whether repeated audio time updates mutate the status text.
- These are **merged v0.12 development milestones**, not a new version tag or a claim of screen-reader, live Deezer playback, third-party media rights, or WCAG certification. Manual verification and the [release checklist](RELEASE_CHECKLIST.md) remain necessary.

## v0.12 mobile usability — Primary touch target sizing (November 16, 2026)

- Enlarged phone header theme, sound and help buttons, Filters, and all six navigation destinations to **at least 44 × 44 CSS pixels** at narrow widths. Key preview recovery, Collection and Duels recovery buttons now use a 44px minimum height.
- Below 360px, hide the redundant header breadcrumb to keep all essential controls visible without introducing horizontal scrolling.
- Extended the actual generated-site Chromium suite to measure **ten real rendered tap rectangles** at 390×844 and 320×740; preserve desktop 1440×900 and existing no-overflow, keyboard dialog, backup and tournament checks.
- [PR #25](https://github.com/MasynNay/aftertone/pull/25) passed **269/269 Node tests** and all three Chromium viewport checks in [GitHub Actions](https://github.com/MasynNay/aftertone/actions/runs/43998680847). Manual device/zoom/assistive-technology verification remains open in [issue #7](https://github.com/MasynNay/aftertone/issues/7).
- This is an incremental **v0.12 development milestone**, not a new tagged v0.12 release or a claim of complete accessibility compliance.

## v0.12 development — CSS publishing safeguards and Deezer request cleanup (November 16, 2026)

- Combined two previously tested but conflict-prone PRs (#21, draft #22) into [PR #24](https://github.com/MasynNay/aftertone/pull/24), cleanly based on the latest accessibility and mobile fixes. The superseded PRs were closed after equivalent functional changes were merged.
- Built Pages validation now checks any local CSS `url()` references for missing files and escaping paths, excluding remote/data/blob/fragment references. The current emitted CSS contained **zero local references**, so correctness is verified with targeted fixture regression cases as well as the normal build gate.
- Deezer JSONP now handles `document.head.append(script)` errors through the existing one-shot error cleanup. A test checks the rejected Promise, removed script and callback, and a later successful request.
- [PR verification](https://github.com/MasynNay/aftertone/actions/runs/43998075871) passed **268/268 Node tests**, and real built Pages Chromium checks at **1440×900, 390×844, 320×740**.
- No change to audio rights, source allowlists, or the tagged `v0.11.0` release. Manual live Deezer playback and authorization checks are still open.

## v0.12 accessibility milestone — Keyboard and mobile baseline (November 16, 2026)

- Added a visible-on-focus **Skip to listening room** link, labelled navigation and `aria-current` indication of the current app section.
- Dialogs now cycle Tab/Shift+Tab focus and return focus to their original opener on Escape/Close. Native keyboard behavior of focused buttons, links, sliders and inputs takes precedence over global game shortcuts.
- Made focus outlines more visible and respected reduced-motion settings for animation and navigation scrolling.
- Fixed genuine horizontal overflow in the app at **390px** (top-right header controls) and **320px** (listening card labels/playback layout); all six mobile navigation sections remain visible.
- Improved Sandstone's muted text contrast and Solarized's muted/accent contrast; added representative text-contrast regression checks for all 20 themes (text/background, muted/surface, accent/surface, accentInk/accent at **4.5:1 or better**).
- [PR #23](https://github.com/MasynNay/aftertone/pull/23) passed **265/265 Node tests** and generated-site Chromium checks at **1440×900, 390×844, and 320×740**, including keyboard focus and layout tests. This is a verified **development milestone**, not a formal v0.12 release or full accessibility certification.
- Remaining: manual Firefox/assistive-technology verification, all-component contrast/touch-target review and external media rights/dependency checks. Details in [accessibility verification](ACCESSIBILITY.md).

## v0.11.0 — Verified Portfolio Release (November 11, 2026)

**Release:** [v0.11.0](https://github.com/MasynNay/aftertone/releases/tag/v0.11.0) · [Full release notes](releases/v0.11.0.md)

- Consolidates the working public music discovery application, standalone portfolio landing, first-listen guidance, reliable empty-state recovery, and Deezer preview failure controls.
- Delivers versioned metadata-only progress backup and restore (format v2, with v1 import compatibility), preserving saved tracks, decisions, theme/listening preferences, Music Duels, optional playlists, and lyric timing adjustments.
- Completes all six Music Duels arena reliability checks with honest eligibility counts, resumable brackets, defensive local saving, Hall of Fame CSV, and bronze/final podiums.
- Gates deployment on **251 passing automated tests** and actual desktop/mobile Chromium navigation and tournament workflow tests (with fictional provider fixtures).
- The original music player and application are preserved. **No live Deezer playback, content licensing, regional availability, or rights-holder authorization is asserted by automated tests.**
- Release handoff records the next focus: accessibility/mobile QA, real-provider verification, and issue triage. No additional runtime functionality was added by the version/tag publishing commit.

## v0.11 reliability milestone — Music Duels Arenas and Bracket Resume (November 11, 2026)

- All **six Music Duels arenas** now display eligible track counts for the actual 4, 8 or 16 entrants selected and for the Discovery/Favorites song pool. Unavailable themes no longer claim that a smaller bracket is ready.
- When a cup can't start, the app explains what is missing, disables Start Bracket, and offers **Find More Songs** to return to Discover without inventing unverified genre/year metadata.
- The last opened tournament resumes after a refresh. **Close Bracket** remains closed after reload; a removed active bracket safely falls back to another unfinished event. Tournament votes and creation are only reflected in the UI when their browser storage write succeeds.
- Added a **6-arena × 3-size** reliability matrix, including reload after every match, bronze playoff before the final, mystery identities, real podium progress, archive selection and Hall of Fame CSV.
- Chromium now creates a bracket using fictional test tracks, votes, refreshes, resumes, completes the final podium, exports the Hall of Fame, closes the bracket and reopens it from History.
- [PR #15](https://github.com/MasynNay/aftertone/pull/15) passed **251/251 automated tests** plus desktop and mobile Chromium smoke checks. See the [Music Duels walkthrough](MUSIC_DUELS.md). Live Deezer playback and usage permissions remain separate unverified dependencies.

## v0.11 usability milestone — First-Listen Guidance and Search Recovery (November 11, 2026)

- Added an inline, three-step first-listen guide: choose Comfort Zone, New Territory, or Wild Card; press Play; then Keep or Pass. No new popup and no changes to the existing welcome flow.
- Empty searches and unavailable catalogs now offer explicit retry, clear-search, broaden-filter, alternate-path and artist-search options without requiring the listener to erase history.
- Broaden Filters resets genre, language and era only. Favorites, choices, imported playlists and Music Duels remain saved.
- Added regression tests for user guidance and empty states plus a Chromium first-visit screen assertion.
- Verified in [PR #14](https://github.com/MasynNay/aftertone/pull/14): **245/245 automated tests** and desktop/mobile Chromium smoke tests passed. No Deezer request, audio preview, autoplay, theme or taste algorithm changes. Real provider availability and permissions remain unresolved.

## v0.11 saved-data improvement — Complete progress backup formats (November 11, 2026)

- New AFTERTONE progress backups use **format v2**, adding imported playlist artist/song entries and per-track lyric timing adjustments to the existing saved favorites, listening history, theme, volume, Duels, and quiz data.
- Old **format v1** progress backups remain readable. Restoring one preserves the destination browser's existing playlist and lyric adjustments because those fields were never present in v1.
- Each imported playlist row and offset is validated before any browser storage changes. Version 2 can also explicitly clear an absent playlist or empty offsets without leaving stale settings.
- Expanded tests cover round trips, malformed data, rollback after late write failures, and a Chromium browser download/upload test that verifies playlist and offsets are restored.
- No Deezer previews, audio, lyrics text, or provider credentials are included in these files. Real third-party playback is still a separate check.

## v0.11 preview — Safe Progress Backup and Restore (November 11, 2026)

- Added **Backup Progress** and **Restore Backup** in Collection (even when no tracks have been saved), without changing the existing song-list JSON and CSV exports.
- Versioned JSON file includes saved tracks, Keep/Pass history, visual and listening preferences, Music Duels tournaments, Tune Lab score, and selected favorite artists. No music files are exported.
- Restore validates format, size, track identities, tournament structures and other fields, previews the counts, asks before replacing current data, and attempts rollback on browser-storage failures.
- Six Node regression tests and a Chromium end-to-end round-trip test cover export, import, malformed files, and rollback. Existing music discovery and playback logic are unchanged.
- This first backup format does **not** include optional imported playlist files or lyric timing offsets. These remain in the browser and must be recreated after moving to a new browser. Details: [Backup guide](BACKUP_RESTORE.md).
- Implementation: [PR #12](https://github.com/MasynNay/aftertone/pull/12). The rest of v0.11 remains on the [roadmap](ROADMAP.md).

## v0.10.2 stability milestone — Deezer recovery (November 11, 2026)

- Added **Retry Preview** and **Skip Without Voting** after unavailable audio. Retrying requests a fresh link; skipping is neutral and does not alter favorites or listening history.
- Added **Retry Discovery** for catalog errors while preserving existing listening selections.
- Isolated concurrent Deezer JSONP requests so canceling one request cannot abort another; reused PR #9's network-failure and timeout cleanup tests.
- Prevented multiple media-error events from repeatedly incrementing autoplay failure handling. The existing three-failure stop remains.
- Added Node regression checks and a Chromium scenario that deliberately blocks preview audio, verifies recovery controls, and confirms Skip doesn't count as an exploration decision. [PR #11](https://github.com/MasynNay/aftertone/pull/11) passed checks before merging.
- **Limits:** Automated Deezer data is fictional. CI does not prove real upstream availability, region restrictions, or rights for preview or artwork use. Issues #2 and #3 remain open.

## v0.10.2 stability milestone — Browser deployment guard (November 11, 2026)

- Added real Chromium checks against the **generated GitHub Pages build** at desktop and mobile sizes, exercising the portfolio's **Explore the Experience** button, application boot, Discover, Collection, and Music Duels.
- The tests fail on local asset 404s, uncaught JavaScript errors, missing application UI, broken styles, and mobile portfolio overflow. Debug screenshots are retained on failures.
- Pull requests now run the same checks without deploying; only a passing main-branch workflow can publish. This addresses the earlier broken-CSS and blank-app regressions.
- Mocked fictional metadata keeps browser testing independent of third-party provider availability. No Deezer playback or media authorization is claimed by these tests.
- Verified [PR #10](https://github.com/MasynNay/aftertone/pull/10) and [main Pages deployment](https://github.com/MasynNay/aftertone/actions/runs/43136162194) completed successfully. Roadmap issue #1 remains open for manual provider/browser checks.

## Editorial Polish — November 7, 2026

- Standardized headings and navigation to consistent title case across the AFTERTONE portfolio, Discover, Collection, Tune Lab, and Music Duels.
- Corrected UI copy including **Runners-up**, tournament labels, proper names of the three discovery paths, and button wording. Improved punctuation, the portfolio notice, and the app's browser description.
- Added three focused naming-consistency regression checks and updated existing test expectations for intentional copy changes.
- No changes to playback, provider adapters, state keys, routes, saved preferences, or tournament logic.

# v0.10.1 — Portfolio Presentation Refresh (November 7, 2026)

- Redesigned the public homepage to match the direct-launch portfolio flow used by Keystoria, while keeping AFTERTONE's lime/charcoal identity.
- **Explore the Experience** now opens the original music discovery application immediately at `/demo/`. Removed the forced disclaimer popup and embedded iframe; the independent-project notice now appears inline.
- Added dedicated homepage regression checks, responsive desktop/mobile previews, and kept the full `app/` source unchanged.
- Added browser-captured screenshots of the restored Discover, Collection, and Music Duels interfaces to the README, using clearly labeled sample track fixtures and original placeholder artwork instead of claiming live Deezer playback.
- Published the same original Deezer-aware browser app at `/demo/`; third-party provider playback and permissions are external dependencies and were not revalidated by the portfolio-only redesign.

# v0.10.0 — Music Arenas & Hall of Fame

- Added six Music Duels arena presets with distinct, testable entry criteria. Pop vs Rock is balanced and uses verified genre metadata; 2000s Throwback requires genuine release-year metadata. No genre/year guessing.
- Added mystery tournament presentation: hidden artwork and artist/title in contender cards, bracket, and status until the tournament ends. Older brackets remain readable.
- Added a derived Hall of Fame with gold/silver/bronze podium tallies, Champions Cup victories, sortable deterministic points, all-time and UTC-quarterly leaderboards.
- Added Hall of Fame leaderboard CSV export and explicit Save Champions to Collection action, preserving the existing podium exports.
- Reused the existing `aftertone:duels:v1` local storage key and compatible snapshots; old completed tournaments remain available. No new accounts, APIs, or third-party packages.
- Added targeted tests for theme selection, missing metadata, mystery concealment, full tournament completion, derived rankings, season filtering, exports, and prior archive compatibility.
- Maintained the licensing caveat: short Deezer previews are a technical prototype, not a public music-game license. Real audio and the full browser interaction require device testing.

# v0.9.4 — Comfortable Listening

- Added shared, persistent 0–100% volume slider on the music card and tournament previews; new installs and legacy saved sessions start at a safe 35% when no volume is stored.
- Muting preserves the chosen level; zero-to-unmute restores the safe default; volume adjusts immediately without restarting the current preview.
- Prevented slider dragging from being interpreted as Pass or Keep. Included keyboard and accessible label/output controls.
- Added `src/volume.mjs` pure logic and seven regression tests; retained all v1 storage fields, songs, favorites, themes, playlist imports and Duels history.
- 201 automated tests pass, Node syntax verification succeeds; streaming/browser interaction still requires user-device testing. Public licensing is not established.

# v0.9.3 — Responsive artist search and distinct first impressions

- **Fixed:** switching discovery paths immediately playing songs from a shared queue before fetching the selected path's own music.
- **Fixed:** active manual searches remaining in effect when choosing Comfort Zone, New Territory or Wild Card.
- **Improved:** Deezer artist searches now resolve an exact artist via `/search/artist` and load `/artist/{id}/top` instead of unreliable `artist:"..."` text filters. Exact artist identity is checked and covers remain excluded.
- **Improved:** sparse or unavailable artist top pages gracefully retry with ranked plain search (with exact artist checks for seeded requests). Song-title searches remain supported.
- **Improved:** active path requests take precedence; shared results are a transparent last resort after a route is primed. A loading state prevents misleading "instant" duplication.
- **Fixed:** stale requests from an inactive feed cannot replace the current card; search queries are captured at request time.
- **Verified:** 194 Node tests, syntax check, server static/API smoke check. Actual Deezer connectivity and audio are not verified by these mocks.
- **Compatibility:** no saved data migration; favorites, playlists, theme and tournament history unchanged.

# v0.9.2 — No More Empty Discovery Paths

- **Fixed:** Comfort Zone, New Territory, and Wild Card can present already
  fetched, still-unheard Deezer tracks while their ideal artist lanes load.
  Fallback reasons are honest and visible; manual searches stay isolated.
- **Fixed:** the already-heard song check now runs before the strict artist
  path filter, preventing an apparently full but unplayable queue.
- **Fixed:** genuine multi-page Deezer artist searches no longer repeat page
  zero on subsequent requests.
- **Fixed:** exhausted chart pages do not strand viable liked/related artist
  lanes; temporary provider errors retry with a cooldown.
- **Added:** related-artist lookup from previously Kept artists after reload;
  no need to keep a new track to restart personalization.
- **Added:** compact invitation to search new artists beside discovery intro;
  button focuses the actual sidebar search field.
- **Removed:** oversized Music Duels trophy emblem; normal sidebar crown,
  bracket, podium, Champions Cup and tournament exports remain.
- **Validation:** 180 passing automated tests (including 10 new regression
  checks), Node syntax validation, archive validation. Browser and live Deezer
  playback not verified; Chromium local navigation was denied by test runtime.

# v0.9.1 — Distinct Discovery Paths

- Replaced the previous ratio-only behavior with a dedicated pure path engine: separate request policies, on-screen performer filters, and per-path explanations.
- **Comfort Zone:** explicit Keeps and related artists. **New Territory:** alternates Deezer-related performers with broad picks while excluding saved and five onboarding artists. **Wild Card:** rotates genre-specific Deezer searches, excluding familiar and related performers.
- Changed artist fetches to use Deezer's artist-specific API search rather than loose text queries, reducing unrelated matches.
- Extended Keep-triggered related-artist discovery to fresh sessions as well as seeded ones; searches alone remain temporary.
- Made the three-second auto-refill and queue counts respect the path's eligible song pool, rather than counting songs that path would never show.
- Changed Music Duels to use the same monochrome icon form as the other navigation links.
- Added `test/discovery-paths.test.mjs` with twelve path and UI regression tests, updated architecture and handoff documentation. Saved favorites, imported playlists, bracket history and themes are untouched.
- Live Deezer / browser playback and provider game licensing remain external release gates.

# v0.9.0 — Music Duels

- Added four-, eight-, and sixteen-song knockout tournaments, with two-contender preview cards, third-place playoff, and a final deciding the champion and runner-up.
- Added saved independent tournaments and complete archive, Hall of Fame podium cards, explicit Add Podium to Collection and podium playlist CSV export.
- Added a Champions Cup seeded with distinct winners from earlier completed regular tournaments, supporting a two-champion showdown and larger brackets as the winner pool grows.
- Preserved all older listening/favorites data in its original storage key. Tournament brackets use a separate validated local key with bounded archive size and metadata snapshots.
- Added tournament navigation, responsive desktop/mobile styling, shared preview timing, keyboard 1/2 voting, and comprehensive regression tests.
- No new provider accounts, API keys, or dependencies. Live Deezer preview behavior and public game licensing remain unverified.

# v0.8.0 — A Discovery Passport

- Moved Blind Mode into the music card beside Undo and added `B` keyboard toggle. Removed the redundant sidebar control.
- Moved all 20 themes to an accessible crescent-moon navbar popover; changing colors does not pause audio.
- Added four optional Passport quests derived from saved Keep/Pass history and Tune Lab answers. Completing quests awards stamps without interrupting a song.
- Recorded the active discovery path for new decisions; existing stored history remains compatible, with missing path data uncounted rather than guessed.
- Kept Deezer player, continuous previews, auto refill, discovery paths, Tune Lab, saved collection and playlist imports intact.
- Added regression coverage for theme menu, Blind button placement, quest progress, search isolation, and Undo.

# v0.7.0 — The Discovery Journey

- Three selectable, functional listening paths and more informative progression.
- Bounded automatic catalog refill every 3 seconds (only when necessary); no player DOM re-render during background fetch.
- X / Undo / Heart consolidated inside card; repetitive technical copy removed.
- Synchronized lyrics lookup (optional experimental LRCLIB), manual preview offset calibration, no bundled lyrics.
- Corrected Deezer all-genre tracks falsely labeled Pop; hidden unknown metadata from taste counts.
- 20 existing themes, Keep/Pass history, Tune Lab and playlist imports remain intact.

# AFTERTONE release history

## v0.6.1 — Open Discovery
- Moved the Keep (heart) and Pass (X) buttons into the listening card with accessible labels and tooltips.
- Balanced requests 50% related / 50% broader tracks and no repeats explicitly sourced from the five onboarding artists; Adventurous favors broader tracks 70% of requests. Closer to favorites preserves a 20% seed option.
- Removed the scoring bonus for onboarding artists, preserving learned preferences from actual Keep/Pass actions.
- Added zero-credential public Deezer playlist links, safe server-side pagination, and explicit Spotify link limitations.
- Kept playlist file/paste imports, favorites, continuous listening, and startup-fresh behavior.

# AFTERTONE changelog

## 0.6.0 — Outside Your Orbit

- **Deezer artist graph:** Discover genuinely related artists through exact-match artist lookup and Deezer's `artist/{id}/related` endpoint. No new API keys or accounts.
- **Three discovery lanes:** Balanced mixes related artists, broad catalog picks and the original five seeds (6:3:1 request target). Choose a more adventurous or more familiar mix in the sidebar.
- **Artist rotation:** The next-song selector prioritizes variety of performers; recent tracks and artist exposure counts are considered before the traditional taste scores.
- **Growing taste graph:** Keeping a new artist can expand discovery into that artist's network. Temporary searching never triggers such expansion.
- **Negative feedback:** Two Passes of an artist without any Keeps discourage more songs by that performer when alternatives exist.
- **Faster delivery of recommendations:** Related artists are fetched concurrently (bounded), interleaved across each of the five seeds, and injected into the session even when older chart tracks are already queued.
- **Resilience and cleanup:** Bounded artist lookup cache, bounded graph size, protected browser storage compatibility, small focused pure modules, architecture documentation, and a dependency-free full-source syntax check.
- **Preserved:** Five-artist introduction, fresh default on launch, playlist import, short Deezer previews, saved favorites, Blind Mode, Tune Lab, 20 themes, swipe controls.

## 0.5.4 — Five-artist introduction

- Five artist slots, optional playlist import and skip-to-fresh onboarding.
- Search pool isolation and basic novelty/repetition scoring.

## 0.5.3 — Continuous preview experiment

- Native audio control using short-lived Deezer preview links; no bundled audio.
- Removed the discontinued original-recordings checkbox and associated saved preference.

## 0.5.2 — Streamlined listening

- Immediate Keep/Pass and separate optional Tune Lab.
- Discovery filters moved to the sidebar.

## 0.1–0.5.1 — Prototypes

- Evolved from a small Commons catalog through independent sources and a visible YouTube player to Deezer metadata/short previews. Legacy adapters are retained for older saved data and regression tests, but not presented in the current discovery UI.
