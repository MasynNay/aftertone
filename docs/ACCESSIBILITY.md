## Optional lyrics request cancellation (v0.12 development)

- When the listener changes tracks, leaves Discover or turns off optional lyrics, in-progress timed-lyrics requests are now aborted rather than continuing to use the external provider. Canceled requests do not populate the old card or contaminate the shared negative-result cache; a later enabled lookup can still succeed.
- Node and Chromium/Firefox fixture tests verify abort propagation, stale-request isolation and fresh lookup recovery. The browser regression does not exercise actual third-party lyrics, screen-reader speech or reproduction rights. Human and legal review remains open.

## Theme dialog keyboard focus (v0.12 development)

- Fixed a focus regression where activating a theme tile inside the **Appearance themes** dialog could move focus to the header palette button, which is inert while the dialog is open. The selected tile now retains keyboard focus after the theme rerenders; repeated selections remain inside the dialog, and Escape restores the original Help button.
- The standalone header palette retains its distinct expected behavior: selecting a theme closes the palette and focuses its header toggle. Node and Chromium/Firefox browser tests cover both paths. Manual screen-reader and touch-device review is still required.

## Phone swipe input safety (v0.12 development)

- Swipe gestures now only begin with a primary pointer and ordinary left-button mouse input. A second touch, right-button drag, canceled pointer, document blur or song-card rerender never becomes a Keep/Pass vote. A second finger arriving **while the first is already dragging** also cancels the entire gesture, including if that finger lands outside the card.
- The card retains pointer capture during a deliberate drag, so lifting a finger just outside the card still produces the intended result. Horizontal movement that returns to mostly vertical immediately clears its visual decision preview, preserving native `touch-action: pan-y` page scrolling.
- Chromium and Firefox validate 390px and 320px app viewports using real mouse drags plus synthetic cancellation/multi-touch pointer events. Tests confirm exactly one vote for valid Keep/Pass, no vote for canceled/secondary/vertical/short drags and no reload or stale vote during a view switch. Physical Android/iOS gesture ergonomics and VoiceOver/TalkBack support still require manual verification.

## Provider cancellation and mobile interactions (v0.12 development)

The phone-width Filters test exposed a race in the browser-side Deezer adapter: a removed JSONP script may still execute after its callback was deleted, causing an uncaught page error even though the obsolete results are ignored. A bounded, short-lived no-op callback now absorbs these delayed responses. Browser automation checks that stale results never replace an active search or change listening history. This does not change third-party playback rights or the need for manual device testing.

## Mobile Filters focus and dismissal (v0.12 development)

- On screens 900px wide or narrower, opening **Filters** now focuses a visible, 44px-tall **Done** button instead of raising the phone keyboard immediately. The header toggle identifies its settings panel through `aria-controls` and keeps `aria-expanded` synchronized with the actual open state.
- **Escape** and **Done** close the drawer and return focus to the Filters opener. Submitting a music search closes the overlay and focuses the newly rendered Discover landmark so results are not hidden behind the panel. Switching to another app section also resets the expanded state.
- Discovery genre/language/mix selects preserve focus when their options cause the sidebar to rerender. Automated browser checks cover 390px and 320px CSS viewport widths in Chromium and Firefox, including keyboard operation, no fabricated votes and no horizontal overflow. These tests do not establish manual VoiceOver/TalkBack compatibility or actual touch-keyboard behavior.

# AFTERTONE v0.12 — Accessibility and Mobile Verification

**Reviewed November 16, 2026** · [Roadmap issue #7](https://github.com/MasynNay/aftertone/issues/7) · [Keyboard/layout PR #23](https://github.com/MasynNay/aftertone/pull/23) · [Touch targets PR #25](https://github.com/MasynNay/aftertone/pull/25)

## Shipped improvements

This milestone addresses specific barriers discovered in the original browser application (not just the portfolio landing page):

- A keyboard-focusable **Skip to listening room** link, a labelled app navigation landmark, `aria-current="page"` for the selected section, and focus moved to the main area after in-app navigation.
- Active dialogs constrain Tab/Shift+Tab within their available controls, Escape closes the dialog, and focus returns to the original opener. Appearance themes retain the focused theme when the dialog is updated.
- Music shortcuts no longer override Space/arrow keys while a native interactive control is focused. This preserves Space activation of buttons and normal operation of text inputs and sliders.
- Clear `:focus-visible` outlines and a reduced-motion mode affecting animations and smooth scrolling.
- Narrow-viewport repairs: a topbar control group previously extended **8px** off a 390px screen; the listening card previously forced **54px** overflow at 320px. Responsive wrapping removes both overflow cases, while six navigation sections remain visible.
- Palette token corrections: Sandstone muted text, Solarized muted and accent text. Added automated WCAG-style **4.5:1** contrast checks for the four common token combinations (main text on background, muted text on surface, accent text on surface, and button text on accent) across the 20 defined themes. This does not establish that every individual component meets accessibility criteria.

## Phone touch target follow-up (PR #25)

- At 650px or narrower, the appearance, sound, help, and Filters header controls and all six navigation destinations now have at least **44px** rendered width and height. Key recovery and Collection/Duels buttons also have a 44px minimum height.
- On 360px or narrower screens, the top breadcrumb is hidden while accessible navigation remains available.
- [GitHub Actions run 43998680847](https://github.com/MasynNay/aftertone/actions/runs/43998680847) passed **269 Node tests** and **Chromium 1440×900, 390×844 and 320×740**. The browser tests measure all ten primary phone hit rectangles rather than merely matching selectors in CSS.
- Touch hardware, 200% browser zoom, screen readers and Firefox still require separate manual checks. No complete WCAG conformance claim is made.

## Screen-reader navigation follow-up

- Active sections now give the focused main landmark a concise accessible name and update the browser tab title, so moving between Discover, Collection, Taste Map, Tune Lab, Music Duels and Challenges identifies the destination.
- Removed `aria-live` from the repeatedly replaced main view and dialog wrapper. The separate toast remains a polite status region, and dialogs retain their own accessible names and focus management. This avoids attempting to announce an entire rerendered page or modal body on every update.
- Added Node and real Chromium assertions for these behaviors. A manual screen-reader review is **still required** before claiming screen-reader compatibility or WCAG conformance.

## Preview playback status follow-up

- The Discover playback status is now a dedicated polite, atomic status region. It announces loading, playing, preview failure and native YouTube-player instructions instead of relying only on a changing icon.
- Ordinary audio `timeupdate` events refresh the timer but do **not** rewrite unchanged status text; redundant DOM mutations could otherwise cause screen readers to repeat the same sentence throughout a 22-second preview.
- Added a small unit regression and rendered Chromium check. Actual NVDA/VoiceOver playback behavior still needs human verification; these checks do not establish live third-party preview availability or authorization.

## Firefox cross-browser gate (v0.12 development)

- Added a dedicated Playwright **Firefox** smoke mode at desktop 1440px and phone widths 390px and 320px, alongside the existing Chromium gate. It exercises dialog focus/return, native Space navigation, named landmarks, all six views, mobile hit areas/overflow and uncaught browser errors with fictional provider records.
- The GitHub Pages workflow installs both engines and requires both browser scripts to pass before deploying. See [browser testing](BROWSER_TESTING.md).
- Automated Firefox coverage does **not** replace a real-device Firefox run, manual keyboard and screen-reader testing, 200% zoom assessment, or legitimate provider playback/rights verification. Keep issue #7 open until those checks are recorded.

## Zoom-equivalent reflow and reduced-motion automation (v0.12 development)

- Added real Chromium and Firefox checks at **720px** and **360px** CSS viewport widths with `prefers-reduced-motion: reduce` enabled. Each pass verifies marketing-page reflow, reduced-motion styles and scrolling, all six app sections, named landmarks, no document-level horizontal overflow, and that navigation/header controls remain inside the viewport.
- A 720px CSS viewport is a useful **layout proxy** for a 1440px browser at roughly 200% zoom; this is **not** an actual user-controlled browser zoom test. Real-device zoom, text-only resizing, assistive technology, focus-order and additional per-component contrast checks remain unverified. Keep issue #7 open.

## Preview failure keyboard continuity (v0.12 development)

- When Retry Preview hides the recovery buttons during an audio reload, focus now returns to the persistent Play/Pause control instead of remaining on a hidden button. A neutral Skip Without Voting restores focus to the next song's Play button, or to the named main area when the feed is empty.
- Chromium and Firefox now simulate a **blocked CDN preview** against fictional provider metadata, retry for a fresh preview URL, and skip without changing listening history or favorites. This is automated focus/recovery evidence, **not** a screen-reader audit or confirmation of live media playback rights.

## Reduced-motion scripted navigation follow-up

- The Search for an Artist shortcut, Discover passport jump and newly created Music Duels bracket now choose instantaneous scrolling whenever the device advertises `prefers-reduced-motion: reduce`. CSS-only reduced-motion rules were insufficient because JavaScript explicitly requested smooth scrolling in these three places.
- The built-app Chromium/Firefox reduced-motion tests now intercept a real Search for an Artist click at 720px and 360px and assert that the browser receives `behavior: 'auto'`. This is automated motion-respect verification, not a human photosensitivity or screen-reader audit.

## Keyboard continuity for listening decisions (v0.12 development)

- Keep and Pass replace the current card after a short animation. When activated from a focused button, keyboard focus now moves to the corresponding button on the next card, or the named main area if no song remains. Undo likewise restores the previous card and focuses the main area if Undo becomes disabled.
- Real Chromium and Firefox tests activate Pass, Undo and Keep through the keyboard, verify history/favorites and no page reload, and assert the active element is never a removed or disabled decision control.
- Gestures and keyboard shortcuts that did not start from a focused decision button do not receive an unexpected focus jump. Manual screen-reader testing remains outstanding.

## Automated evidence

[Successful GitHub Actions run](https://github.com/MasynNay/aftertone/actions/runs/43982300690) on PR #23:

- **265/265 Node tests** passing, including the new `test/accessibility-navigation.test.mjs` and `test/theme-accessibility-contrast.test.mjs`.
- **Chromium 1440×900, 390×844 and 320×740** passing against the built Pages app.
- Browser exercises skip-link presence, first-run dialog Shift+Tab/Tab wrapping, Escape close, opener focus restoration, appearance picker Escape behavior, native Space navigation, active navigation state, and mobile horizontal overflow.
- Existing browser regression flow still covers the portfolio and actual app launch, backup/restore and Music Duels using fictitious provider metadata, **not live Deezer playback**.

## Backup and restore keyboard continuity (v0.12 development)

- Collection now warns that restore **replaces** local progress and backup JSON is **unencrypted**. The Restore button describes its warning, and a persistent polite status message reports validation errors, completed downloads, and canceled imports without depending on a short-lived toast.
- Restore is temporarily disabled while the selected file is being checked to prevent simultaneous import attempts. After an invalid or canceled import, focus returns to the visible Restore Backup button instead of a hidden file input.
- Chromium and Firefox browser checks exercise invalid-file rejection, explicit confirmation dismissal without writes, focus restoration, and subsequent confirmed restore of the same selected backup. This is automated keyboard-continuity evidence, not a real screen-reader review or physical-device transfer.

## Empty discovery and keyboard recovery (v0.12 development)

- When a focused Retry Discovery button rebuilds a loading card, the app holds focus on the stable main region while fetching and then returns it to the new Play button or an enabled Retry button. A retry that fails again never strands the user on a removed control.
- Clear Search, Broaden Filters, and keyboard-activated listening-path changes use the same focus-aware recovery where appropriate. Focus is returned only when the action started from a focused control and the listener has not moved to something else while loading.
- Both Chromium and Firefox browser scripts now simulate a provider outage, keyboard retry while the provider is still offline, and successful retry after recovery; saved votes and the document stay unchanged. This does not verify manual screen-reader speech output, real Deezer playback or mobile hardware behavior.

## Modified and repeated keyboard shortcuts (v0.12 development)

- Global music shortcuts ignore Control/Command, Alt, Shift, repeat, composition and events that were already handled. This protects browser and assistive-technology shortcuts and prevents holding a rating arrow from acting on successive songs.
- Standalone B, Left/Right Arrow and Space remain available when focus is not in a native interactive control. The existing dialog and appearance-menu Escape handling is unchanged.
- Chromium and Firefox scripted browser tests send synthetic modified/repeated key events, verify no unintended blind-mode changes, playback metadata requests or Keep/Pass records, and confirm ordinary B and Left Arrow still work. This is not a complete screen-reader or physical keyboard audit.

## Music search draft and caret preservation (v0.12 development)

- Background discovery updates can rebuild the sidebar. The search field now renders the in-progress text rather than only the last submitted query, so a partially typed artist/song name survives rerenders and cross-section navigation without becoming the active search.
- If the listener was editing the input when a refresh happened, the replacement input regains keyboard focus and the original caret/selection. Deliberate navigation, focus changes or Clear Search do not force focus back.
- Chromium and Firefox browser regressions type a new query, trigger a separate UI rerender while editing, verify focus and selection, navigate to Collection and back, and confirm Enter commits the preserved search. Provider results are mocked; manual screen-reader and live-provider checks remain separate.

## Collection search and sort continuity (v0.12 development)

- Filtering saved songs now shows a visible match count and an explicit **Show All Saved Songs** empty-state action, so keyboard and touch users do not have to discover how to clear the search manually.
- Clearing an active Collection filter restores keyboard focus to the saved-music search box if the action began there; sorting restores focus to the new dropdown after rerendering rather than leaving users on a removed element. Search selection direction and range are preserved during live filtering.
- Browser checks in Chromium and Firefox save a fictional song, enter a query that yields zero matches, clear it by keyboard, sort the recovered result and verify that favorite data and browser document identity remain unchanged. This is not a manual screen-reader audit.

## Collection removal recovery and focus (v0.12 development)

- Removing a saved song now shows a persistent in-page **Undo Remove** control, including when the final saved track disappears. The status text is separately announced, and the action has a 44px minimum touch height.
- Keyboard users activating the focused Remove control are moved to Undo instead of being stranded on the deleted tile. Activating Undo returns focus to the search field (or named main area) while restoring the favorite's exact saved position. The user's listening history and saved track metadata are not rewritten.
- Node tests check order, duplicate prevention, unchanged history and last-song recovery. Chromium and Firefox test Remove → Undo → reload with fictional music fixtures. The one-step recovery is available only while the browser tab remains open; it is not a substitute for an exported progress backup or a manual screen-reader audit.

## Manual acceptance checklist (not yet verified)

- [ ] Test all six navigation sections and all first-run dialogs with keyboard-only use in **Firefox** and **Chrome**.
- [ ] Test a real screen reader (NVDA/VoiceOver), including labels, headings, dialog announcements and status changes.
- [ ] Review focus order, scrolling, touch targets and 200% zoom at phone, tablet and desktop widths.
- [ ] Perform a component-level contrast audit across representative dark/light palettes, including dim text, outlines, overlaid images and disabled controls.
- [ ] Validate that reduced motion fully prevents disorienting transitions in practical use.
- [ ] Check cross-browser backups, live provider failures and regional restrictions where applicable. Provider/rights review is tracked in separate roadmap issues.

**Status:** A meaningful keyboard and responsive baseline shipped; issue #7 remains open for these acceptance steps. This is not a claim of WCAG conformance or of authorization to use third-party recordings.
