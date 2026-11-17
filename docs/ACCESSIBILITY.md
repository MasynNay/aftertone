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

## Automated evidence

[Successful GitHub Actions run](https://github.com/MasynNay/aftertone/actions/runs/43982300690) on PR #23:

- **265/265 Node tests** passing, including the new `test/accessibility-navigation.test.mjs` and `test/theme-accessibility-contrast.test.mjs`.
- **Chromium 1440×900, 390×844 and 320×740** passing against the built Pages app.
- Browser exercises skip-link presence, first-run dialog Shift+Tab/Tab wrapping, Escape close, opener focus restoration, appearance picker Escape behavior, native Space navigation, active navigation state, and mobile horizontal overflow.
- Existing browser regression flow still covers the portfolio and actual app launch, backup/restore and Music Duels using fictitious provider metadata, **not live Deezer playback**.

## Manual acceptance checklist (not yet verified)

- [ ] Test all six navigation sections and all first-run dialogs with keyboard-only use in **Firefox** and **Chrome**.
- [ ] Test a real screen reader (NVDA/VoiceOver), including labels, headings, dialog announcements and status changes.
- [ ] Review focus order, scrolling, touch targets and 200% zoom at phone, tablet and desktop widths.
- [ ] Perform a component-level contrast audit across representative dark/light palettes, including dim text, outlines, overlaid images and disabled controls.
- [ ] Validate that reduced motion fully prevents disorienting transitions in practical use.
- [ ] Check cross-browser backups, live provider failures and regional restrictions where applicable. Provider/rights review is tracked in separate roadmap issues.

**Status:** A meaningful keyboard and responsive baseline shipped; issue #7 remains open for these acceptance steps. This is not a claim of WCAG conformance or of authorization to use third-party recordings.
