## v0.12 development — Listening Journal (November 27, 2026)

- Taste Map adds a read-only listening journal with full-history path counts, Keep/Pass filters, 20-entry pages, and explicit missing-title/artist fallback. New decisions retain bounded song titles in the existing compatible session and backup format.
- Tune Lab accuracy now reflects actual saved Tune Lab scores, rather than only historical recognition fields. Collection tiles no longer label every unassessed song a discovery.
- Queue copy describes conditional automatic refills instead of promising a request every three seconds.
- Unit and browser regressions cover bounded history, honest metadata, escaped content, filter focus and data neutrality. Manual device/provider review remains open.

## v0.12 development — Verified personalization imports (November 27, 2026)

- Playlist replacement/deletion and favorite artist saves verify browser storage before changing the current personalization. Failed writes keep the dialog open with persistent retry messages and intact inputs.
- File and link imports cannot compete within a dialog; canceled file reads cannot update a later dialog.
- Imported playlists share the existing 3,000-song backup limit; oversized unique playlists are rejected rather than silently truncated. Input scanning remains bounded at 5,000 rows.
- Deleting an inactive saved playlist no longer disables artist personalization, and the import dialog accurately labels its saved playlist and activation state.
- Node and mocked-browser regression coverage exercises failure, retry, deletion, backup compatibility and active-profile preservation. Live provider and physical-device verification remain open.

## v0.12 development — Discovery transition safety, durable Tune Lab scores and static packaging (November 27, 2026)

- Keep/Pass animation callbacks are bound to the original song, feed and challenge. Navigation, new tracks, modal opening or Undo cancel unfinished choices. Delayed media events cannot auto-advance while a decision is pending. Focus is restored only if the listener did not move to another control.
- Tune Lab scores use bounded, verified writes before the answer is revealed or the count advances. A storage failure leaves the same question retryable with a persistent status message.
- Static builds discover all public JavaScript modules, including future nested view modules, rather than maintaining a fragile list. Import and re-export paths are rewritten relative to the demo's source directory, and asset checks include side-effect imports.
- Added Node regressions and expanded Chromium/Firefox keyboard journeys with rapid navigation and modal interruption. Tests use fictional metadata; physical-device, live-provider and media-permission checks remain open (#2, #3, #5, #7).

## v0.12 development — Safer restore preview with current-versus-backup counts (November 27, 2026)

- Restore Backup now displays an explicit **current → incoming backup** comparison of saved songs, listening history, Music Duels, favorite artists, Tune Lab answers, imported playlist songs and lyric timing adjustments *before* asking for destructive confirmation.
- Reductions are called out clearly; restoring is never described as a merge. Older v1 backups explicitly identify optional playlist and lyric data that will remain unchanged.
- If current local data is damaged and cannot be inspected, the dialog says the comparison is unavailable rather than presenting misleading zero counts. Validation, cancel, storage verification, rollback and reload protections are unchanged.
- Added pure read-only comparison tests for reductions, v1 preservation and invalid input, plus fictional Chromium/Firefox browser confirmation and cancellation checks. Real cross-device backup acceptance (#5/#7) remains open.

## v0.12 development — Saved Collection overview and quick filters (November 27, 2026)

- The Collection page now summarizes **all saved songs**, distinct artists, and meaningful genre and mood categories, even when only 40 cards are mounted on screen.
- Popular genre and mood chips act as accessible, touch-size quick filters. Activate or deactivate a chip to browse its entire set of songs; the existing search, sort, combined filters, paging and full-library exports remain intact.
- The overview transparently counts saved song IDs lacking metadata instead of inventing titles or counting them as visible cards.
- Buttons retain keyboard focus and reflect their active state with `aria-pressed`; no preference, Keep/Pass decision or saved data is written when browsing.
- Pure Node tests and fictional 390px Chromium/Firefox browser cases cover global counts, mobile layout, keyboard toggles, escaping untrusted metadata and unchanged exports/history. Real-device and screen-reader checks remain open (#7).

## v0.12 development — More forgiving saved-song search and tags (November 27, 2026)

- Collection merges genre and mood labels that differ only by capitalization, surrounding spaces or common accent marks. One genre now has one honest count and a filter works regardless of how its original source spelled the tag.
- Saved-song search finds names with or without accents (for example, "Bjork" finds "Björk") while leaving original titles, artists, and provider tags unchanged.
- A blank, unknown or generic "Fresh" saved-history mood no longer conceals meaningful catalog mood metadata. An explicit Tune Lab mood still takes priority.
- Keep the selected filter if removing a saved song changes which capitalization represents that tag. No favorites, preferences, history, exports or backup schema are rewritten.
- Added pure Node coverage and a second fictional cross-browser fixture for mixed-case genre/mood metadata, accent-insensitive search and storage non-mutation. Real mobile/screen-reader checks and external-provider permission review remain open (#7, #3).

## v0.12 development — Full-library genre and mood Collection filters (November 23, 2026)

- Collection now has **Genre** and **Mood** filters, with actual saved-song counts in each option. They combine with existing text search and title/artist/recent sorting before selecting the visible 40-song page, so results reflect the **whole** library rather than just currently rendered cards.
- Mood filters use the listener's latest saved **Tune Lab mood** for a song when present, falling back to the track's supplied mood; blank, unknown and generic "Fresh" values are not presented as meaningful facet choices. No genre or mood is fabricated.
- Changing a facet resets paging and restores keyboard focus to the rebuilt dropdown. Combined-filter result counts use an accessible status; the empty state has **Show All Saved Songs**, and a dedicated Clear Filters action restores the full library. Search-only Clear Search remains available.
- Browsing filters are ephemeral UI state. They never alter favorites, history, track metadata, exports or backup format. CSV/JSON/backup operations continue to cover all saved songs, including those hidden by filters.
- Pure Node regressions cover 123 saved songs, intersected filters, stale cursors, mood overrides, XSS-safe labels, and keyboard wiring; fictional 390px Chromium/Firefox browser scenarios cover filtering, mobile overflow, keyboard focus, and exporting all 123 songs.
- Real phone and screen-reader acceptance remains open (#7). No new provider/preview use or licensing assertion (#3).

## v0.12 development — Verified, write-before-change listening progress (November 23, 2026)

- Normal saved listening sessions now verify browser storage read-back after every `setItem`; silently discarded writes, blocked storage reads, and quota errors return failure rather than a false saved-success.
- **Keep/Pass** prepares a candidate state and commits it before advancing the song, starting recommendation expansion, or recording a shared-challenge vote. A blocked write retains the same current track and permits a genuine user retry.
- **Undo last decision, Collection Remove and Undo Remove** preserve the previous in-memory and browser state when persistence fails, including retaining Undo for a subsequent retry.
- **Music Duels "Save Podium" and "Save Champions"**, Tune Lab mood ratings, and destructive listening-history reset likewise require verified persistence before changing or confirming saved data.
- Node tests cover successful writes, silent discard, thrown quota/read errors and retry after recovery. Synthetic 390px Chromium/Firefox checks exercise failed Keep, remove and Undo, followed by successful retries without phantom votes. Ordinary preference-change failures continue to display a warning; real private-browser/quota testing remains open (#5/#7).
- No format migration, provider traffic, gameplay voting semantics, or changes to provider licensing.

## v0.12 development — Large Collection paging and mobile responsiveness (November 23, 2026)

- Collection now displays **40 saved-song cards per page** instead of mounting potentially 1,500 cards on a phone. Accessible Previous/Next buttons, a page selector, exact result ranges and a keyboard-focus target let listeners move through the library without a full-page reload.
- Search and sorting operate across **the entire saved library**, then select the visible page; changes to search/sort reset the cursor. The view safely clamps a stale cursor after deletions, restores or library changes rather than showing an empty phantom page.
- Catalog lookups use a per-render ID index, and Recently Kept sorting uses saved favorite positions instead of repeatedly searching the favorites array. These address two avoidable performance costs on large libraries.
- **Undo Remove, export JSON/CSV and progress backups retain the entire collection**, never just the current page. No saved-data format or music-playback logic changes.
- Node regressions cover 123 saved songs, page sizes, global filters/sorts, stale cursors, empty searches and keyboard wiring. Chromium and Firefox browser checks at 390px verify page navigation/focus, global search, full CSV export and Undo with fictional entries. Manual real-phone and screen-reader acceptance remains open (#5/#7).

## v0.12 development — Collection preview accessibility and mobile playback efficiency (November 23, 2026)

- Collection playback buttons now announce their **current** action with the recording's visible title: Listen, Pause, or Cancel loading. Screen readers no longer hear a stale "Listen to SONG" label when the control would pause or cancel.
- Repeated media `timeupdate` events update the progress display without scanning and rewriting every saved-song preview button on each tick. Full Collection/duel rerenders explicitly invalidate the cached playback-control state so freshly rebuilt buttons still match the current player.
- Button text and accessible names are only written when they actually change; Music Duels contender labels remain identity-safe for Mystery Matchups.
- New Node tests and synthetic 390px Chromium/Firefox browser checks cover Play/Pause/Cancel labels, 12 saved songs, grid sort during playback, and absence of repeated button queries across media ticks. Real-device and screen-reader acceptance still require manual review (#7).

## v0.12 development — Music Duels preview recovery and keyboard guidance (November 23, 2026)

- Music Duels now shows a persistent, politely announced message when a contender's preview fails or browser media permissions deny playback. The tournament no longer misleadingly displays a failed recording as merely Paused or as an untouched match.
- Contender preview buttons change to an explicitly labeled **Retry A / Retry B** action after a failure. A fresh preview clears the old warning; no failure or retry changes tournament votes, listening history or favorites.
- Mystery Matchups recovery status identifies only **contender A/B**, never the song's title or artist. Timers remain outside the polite live announcement region so assistive technology is not flooded with time updates.
- Node and synthetic 390px Chromium/Firefox browser regressions cover failed preview metadata, manual retry, permission denial, unchanged saved data and mystery privacy. Physical device and screen-reader testing remain open (#2, #7).

## v0.12 development — Guard stranded tournaments and verify bracket saves (November 23, 2026)

- Reject a corrupted 8- or 16-song Music Duels archive where every matchup in the last recorded round is decided but its required following round is missing. Those records previously could load as active tournaments despite having no playable next matchup.
- Confirm tournament vote and selected-bracket persistence by reading the browser storage value after each write. Silently dropped saves now report failure, preventing the app from presenting an unsaved vote as stored.
- Tests cover normal round progression, missing follow-up rounds, damaged backup export/import with unchanged target data, silently ignored storage writes, and storage read errors.
- No storage schema, tournament-voting rules, or audio preview behavior changed.

## v0.12 development — Stop autoplay on Deezer rate limits (November 23, 2026)

- A Deezer HTTP/JSONP 429 encountered during automatic preview loading now stops continuous listening immediately. AFTERTONE leaves the current unheard song on screen with the existing manual Retry Preview and Skip Without Voting controls instead of automatically requesting the next songs.
- A rate-limited metadata response is a temporary provider outage, **not** proof the recording is broken: it no longer blacklists that track or consumes the three-failure autoplay skip allowance. The same handling applies if a stale Deezer URL refresh encounters quota limits after playback had begun.
- New 390px Chromium and Firefox browser smoke journeys start continuous listening, Pass one fictional recording, simulate a 429 on the next automatic preview, verify no extra provider calls or false decisions, then retry manually after synthetic recovery.
- All tests use fictional provider fixtures; real Deezer permissions and actual browser-device behavior remain subject to manual review (issues #2, #3 and #7).

## v0.12 development — Verify saved Music Duels brackets (November 23, 2026)

- Loading tournament history now verifies that every matchup uses the entrants or winners of its preceding round, that votes occur in order, and that bronze pairings match the losing semifinalists. A corrupted or forged later round is excluded instead of appearing as a resumable bracket.
- Completed podiums must agree with the recorded championship and bronze votes. Inconsistent data can no longer award an invented Hall of Fame champion or be accepted through progress backup/restore.
- Regression tests cover valid 4-, 8-, 16-song and two-champion tournaments at each vote, forged results, missing transitions and rejected backup imports. This is archive-integrity hardening, not a claim of licensed Deezer playback.

## v0.12 development — Verified local progress restore (November 22, 2026)

- Restore now reads back every browser-storage write and deletion before reporting success. A storage adapter that silently drops a changed value triggers the same rollback as a thrown quota/security error; no false `Progress restored` message is shown.
- Rollback writes are verified too, so AFTERTONE distinguishes confirmed recovery from an incomplete rollback instead of promising previously saved data was restored when it was not.
- Malformed Music Duels data containing a null entry now produces a readable validation error rather than a low-level property-access exception.
- Node regressions cover silently dropped writes, ignored playlist removals, incomplete rollback and invalid tournament metadata. This does not replace actual multi-device transfer or provider playback checks (issues #5 and #3).

## v0.12 development — Mobile Filters focus containment (November 22, 2026)

- The fixed small-screen Filters drawer is an accessible dialog while open. Keyboard Tab and Shift+Tab remain inside its visible controls until Done or Escape closes it and returns focus to the opener.
- Background page shortcuts can no longer accidentally Keep or Pass an unheard song while the Filters drawer covers the player. Asynchronous catalog rerenders preserve keyboard focus on Done or the drawer's collapse control instead of stranding it on the page.
- Resizing from mobile to desktop clears the temporary dialog semantics, and opening a full Help/other modal closes the Filters drawer first so two competing dialogs do not remain active.
- Added Chromium and Firefox browser checks at 320px and 390px for focus wrapping, redraw focus restoration, no hidden votes, Escape/Done, resize, and the existing filter/search workflows. Real-device and screen-reader verification remain open.

## v0.12 development — Manual Play permission denials remain retryable (November 22, 2026)

- An HTML media `NotAllowedError` from a **manual** Play now follows the same neutral browser-permission path as denied automatic playback: no blacklisted Deezer song, no broken-provider warning, no extra Keep/Pass, and no silent advance.
- The discovery card keeps the same song visible with persistent instructions to check browser media permissions and press Play again. Repeating the denial does not mark the recording unavailable; a subsequent permitted Play resumes it as a single preview without unexpectedly restarting continuous listening.
- Dedicated 390px Chromium and Firefox browser regressions use fictional provider metadata and controlled media-element outcomes to deny the first **two** keyboard Play attempts, then permit the third. They check focus, status, no failure-recovery UI and unchanged listening history. Actual browser codecs, provider rights, physical devices and accessibility tools require separate review.

## v0.12 development — Autoplay permission denial does not skip songs (November 22, 2026)

- Consecutive automatic media failures are no longer cleared merely because `audio.play()` resolves. A stream must advance at least one second before the failure streak resets, so Firefox-style immediate decode errors cannot drain an entire listening queue without audio being heard.
- Firefox can emit a delayed media-element error while the previous song is being dismissed or the next `play()` request is still pending. The player now ignores those transitional events instead of treating the newly selected song as broken and repeatedly auto-skipping. Genuine `play()` rejections are still handled by their promise.
- The preview's `timeupdate` boundary also ignores old end-of-clip positions while the next source is still loading or paused. A Firefox handoff cannot fast-forward an unheard track on stale timing metadata.
- A related media handoff guard now ignores late `ended` events from canceled/previous sources unless the **currently loaded** audio truly ended. This prevents a stale event from advancing a newly resumed recording; genuine short previews still finish normally.
- A browser `NotAllowedError` during **automatic** continuous listening now stops the automatic session without blacklisting or silently skipping the next unheard track. The current song stays on screen and the player gives a persistent **Press Play** instruction to resume by user gesture.
- The permission refusal is not mislabeled as a broken Deezer stream, does not mark a Keep/Pass or change favorites, and cannot accidentally trigger the previous three-track automatic error-skip chain. Explicit manual Play clears the guidance. For Audius, a gesture-denied play no longer wastes a fallback stream request that cannot bypass browser permission.
- 390px Chromium and Firefox browser tests use a controlled media element with the real application, provider metadata and UI. They deliberately Pass one song, then simulate `NotAllowedError` on the next automatic play, verifying exactly one intentional Pass, no extra votes, a stopped session, same-song keyboard replay and no stray ended-event skip. Actual media decoding is covered by separate playback smoke tests.  These synthetic fixtures do not establish live provider availability or rights.

## v0.12 development — Main Play retries a failed preview (November 22, 2026)

- Once a preview reaches a terminal media error, clicking the **main Play** control explicitly discards that track's cached preview URL and requests fresh metadata. Listeners no longer need to discover the separate Retry Preview button to recover from a stale link.
- Terminal media failures now pause the audio element before showing recovery controls. Existing Retry Preview and Skip Without Voting paths remain available; no failed attempt is counted as a Keep or Pass.
- Synthetic 30-second silent WAV media tests cover initial playback, automatic Deezer URL refresh, terminal failure and keyboard-triggered main Play retry in Chromium and Firefox. Live licensed playback, provider rights and physical-device verification remain separate tasks.

## v0.12 development — Keep focus in Pass the Aux through redraws (November 22, 2026)

- Pass the Aux now retains keyboard focus on a specific song's **Add**, **Remove**, or **Move Earlier/Later** action when a background refresh rebuilds the editor. The **Share** and **Use Latest Five** controls also retain focus instead of dropping to the page body.
- If a changing search removes a focused song from the results, focus moves to the labeled saved-song search input instead of selecting a different song. No songs are added, removed, reordered, rated or shared by focus restoration itself.
- Added a 320px Chromium/Firefox fixture-based browser regression and a Node controller guard for focus, filtered-result fallback, and unchanged listening data. Physical-device and screen-reader verification remain open under #7.

## v0.12 development — Share challenges when clipboard access is blocked (November 22, 2026)

- **Pass the Aux** now keeps a challenge shareable when a browser blocks clipboard access. If both the modern Clipboard API and the legacy copy command fail, Aftertone opens a clearly named dialog with the exact selected Deezer-ID challenge link, ready for manual Ctrl+C / Command+C and easy dismissal.
- Keyboard focus moves to the read-only, preselected link. Escape and Done restore focus to Share. The dialog is touch-friendly at 320px, uses the current theme, and does not store or transmit personal favorites, history, titles or preview URLs.
- The temporary copy element is removed even when the browser throws. Late clipboard failures do not reopen a share dialog after navigation. Chromium and Firefox simulate a blocked API and a throwing legacy command; real device/clipboard policy verification remains open.

## v0.12 development — Predictable Blind Mode controls (November 22, 2026)

- **Blind Mode** toggling during ordinary discovery now preserves keyboard focus on the rebuilt Blind button. Enter can turn it on or off repeatedly without stranding focus on a removed listening card.
- **Shared blind challenges** always hide song identities. The old switch looked editable despite having no way to reveal a challenge song, and pressing it (or the B shortcut) silently changed the visitor's personal blind preference. The challenge now shows a noninteractive **Locked** status with an accessible explanation and ignores B until the visitor exits.
- Returning to regular discovery restores the listener's original blind preference, not a side effect of the challenge. No Keep/Pass votes, favorites, preview playback, or track IDs are changed by this fix.
- Added Node view/controller assertions and Chromium/Firefox browser journeys at 320px testing two successive Enter toggles, focused controls, saved preferences, challenge lock, ignored B, and exit behavior. Manual assistive-technology and physical-device checks remain open.

## v0.12 development — Browse the entire saved-song challenge library (November 21, 2026)

- The five-song **Pass the Aux** challenge editor now pages through **every eligible unselected saved Deezer recording**, 40 results at a time. Previously only the first 40 matches were shown; songs farther down required a specific search and could not be browsed.
- Search matches and selected-track exclusion happen before pagination, keeping the result count accurate. Previous/Next page controls, visible range and page count make the remaining saved songs discoverable without rendering hundreds of mobile rows. A new query returns to page one, and changing the selection clamps stale pages.
- The result range is an accessible live status. After keyboard paging it receives focus, and Tab continues into the new result list. Buttons maintain 44px touch targets on a 320px phone viewport.
- Added data-model, view and controller regression tests; Chromium and Firefox simulate a 94-song saved catalog, keyboard paging to the oldest eligible recording, adding it to a five-song challenge, preserving favorites/Keep–Pass history, and resetting pagination on search. No third-party audio requests or personal challenge data are needed.
- Third-party preview availability, permissions and manual assistive-technology testing remain open.

## v0.12 development — Restore earliest favorite-only backup sessions safely (November 21, 2026)

- Genuine version 1 progress backups whose old listening session omitted the `savedTracks` field can now be inspected and restored. Migration is limited to **absent metadata in format v1**; newer format v2 files and malformed/explicitly invalid fields remain rejected before any browser data changes.
- Existing favorite IDs and Keep/Pass decisions are preserved without inventing song titles, artwork or playable previews. If any backed-up favorites lack full track metadata (including v2 backups exported from an older local session), the export notice and restore confirmation clearly warn that those songs might not appear in Collection until their details are found again.
- Version 1 imports continue to **retain** the target browser's separately saved imported playlist and lyric timing settings. Version 2 behavior is unchanged. A rejected file never rewrites local data.
- Extended Node tests for missing vs malformed metadata, cross-version rejection, no invented titles, existing optional-data retention, and honest warning counts; added real-file Chromium/Firefox browser restore journeys with fictional source metadata. Physical browser/device transfers and live music permissions remain separate checks.

## v0.12 development — Start the first preview directly from onboarding (November 21, 2026)

- The inline **Your First Listen** guide now has a prominent **Play My First Preview** button when a track is ready. It uses the existing player and normal user-initiated Play action, moves keyboard focus to the real player, and never records a Keep/Pass on its own.
- When no song is ready, the guide explains whether music is still loading or unavailable and points listeners to the existing **Retry Discovery** or **Find More Songs** action on the card. There remains only one retry button and one live error announcement.
- The guide still disappears after the first genuine Keep or Pass and is never shown during shared blind challenges. Autoplay, source selection, saved settings, and the application's visual direction remain unchanged.
- Added Node state and wiring tests, plus fictional-provider Chromium/Firefox browser journeys at a 390px viewport for keyboard-triggered Play, on-demand Deezer preview metadata, safe failure, first rating, and a first-run 429 retry. These checks do not establish live media licensing or playback reliability.

## v0.12 development — Progressive Deezer discovery retry cooldown (November 21, 2026)

- Repeated Deezer discovery failures now extend **automatic** retry pauses from 20 seconds to 40, 80, 160, then a maximum of 180 seconds. This avoids repeated rapid requests during sustained provider outages, while keeping the public demo recoverable and leaving already loaded tracks intact.
- A successful provider response clears the cooldown and failure count. A listener pressing **Retry Discovery** can check again immediately; it is not blocked by automatic backoff. Provider failure history is scoped to each discovery feed, so switching paths does not inherit an unrelated outage counter.
- Outage help explains the automatic cooldown without promising an exact live countdown; no extra timers run on the page. Existing browser playback, choices, and theme behavior are unchanged.
- Node policy tests and fictional-provider Chromium/Firefox regression tests check 20-/40-second pauses, automatic recovery and no invented listening votes. Live Deezer uptime, regional quotas, usage rights and physical-device testing remain unverified.

## v0.12 development — Resume a curated Pass the Aux draft after refresh (November 21, 2026)

- The five-song challenge editor now remembers intentionally edited song IDs and their exact order across refreshes of the **same browser tab** using session storage. A deliberate empty selection stays empty; the Share button does not silently reselect five songs.
- **Use Latest Five** clears the tab draft and restores ordinary one-click sharing. A draft is always rechecked against the currently saved, public Deezer catalog before displaying or sharing, so deleted/unavailable/private source IDs cannot be introduced into a link.
- The stored draft contains at most five validated public Deezer IDs plus a format version—no track titles, audio previews, listening history, or account information. Other tabs/devices receive nothing. If session storage is blocked, editing still works and the screen correctly warns that the changes were not saved.
- Added Node tests for persistence, corrupted/future versions, unsupported sources, duplicate IDs, tab reset, and blocked storage; Chromium/Firefox simulated-provider browser coverage tests actual refresh, empty draft restoration, reset, and failure handling. This does not verify live Deezer authorization or physical-device accessibility.

## v0.12 development — Curate your shared five-song challenge (November 20, 2026)

- **Pass the Aux** now lets listeners choose the exact saved Deezer songs to send, rather than silently always choosing only the five newest. The newest five remain preselected for one-click quick sharing.
- Add or remove tracks, use **Move Earlier/Move Later** to set playback order, search the saved catalog beyond the initial 40 visible results, and restore the newest five at any time. The Share button displays the selected count and stays disabled for an empty draft.
- The resulting link contains only validated public Deezer track IDs in the chosen order; private Jellyfin sources, history, track names, preview URLs and browser preferences are excluded. Selection is tab-local; regular Keep/Pass progress and collection are not changed by editing it.
- Native, focusable 44px reorder buttons and search-caret recovery are covered by Node unit tests and fictional-provider Chromium/Firefox mobile browser flows, including opening a deliberately reordered two-song link in a clean browser profile.
- Browser fixtures do not establish live third-party playback or authorize public media use.

## v0.12 development — Skip an unplayable shared preview without voting (November 20, 2026)

- A shared challenge that resolves track metadata but cannot play its preview no longer traps the listener: **Retry Preview** and **Skip Without Voting** are available, with a direct **Leave Challenge** control during active rounds.
- A failed clip advances to the next shared recording without writing a Keep, Pass, favorite, or recommendation signal, and without rewriting the original challenge link. The completion summary separates actual ratings from unplayable previews; an all-failed challenge never invents a score.
- Shared challenge previews now wait for an explicit choice when 22 seconds end instead of repeating in continuous-radio mode. Ordinary Discover autoplay and neutral skip behavior remain unchanged.
- Added Node view/controller checks and fictional-provider Chromium/Firefox browser tests for two consecutive blocked clips, keyboard focus, a mixed skip/Pass result, and leaving the challenge. Live Deezer availability and media game-use permission remain unverified.

## v0.12 development — Recover unavailable shared blind challenges (November 20, 2026)

- Shared links no longer silently abandon the challenge when all requested tracks are temporarily missing. An explicit recovery screen retains the original IDs and offers **Retry Missing Songs** and **Back to Discovery**.
- Partially available links require a listener's choice: retry the missing tracks, or **Play Available Songs** with the exact reduced count and a persistent notice. No selection or vote is invented; the original shared link is not rewritten.
- Retry runs a bounded Deezer metadata lookup, is cancelable, and ignores stale responses if another action supersedes it. Exiting the challenge now refills the normal discovery feed instead of leaving a blank page.
- Accessible, keyboard-focusable recovery status and phone-size action targets are included. Node and mocked Chromium/Firefox regression coverage added; live provider outages and public music rights are not verified.

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
