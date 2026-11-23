## Mobile Filters overlay keyboard behavior (v0.12 development)

At 320px and 390px, Chromium and Firefox test the fixed Filters panel's open-only `role=dialog` and `aria-modal=true`, Tab wrapping from the final visible control back to Done, Shift+Tab wrapping back, restoration from a background focus attempt, suppression of Arrow-key Keep/Pass shortcuts behind the panel, and retained Done focus when the sidebar redraws. The suite also checks the existing Escape, Done, filter-change and search-submit flows, plus desktop-breakpoint cleanup of the dialog role and expanded state. This is synthetic keyboard/browser coverage; real touch and screen-reader verification remain separate.

## Repeated manual browser permission denial (v0.12 development)

At a 390px viewport, the Chromium and Firefox smoke suites use a controlled media element with fictional Deezer metadata to simulate two consecutive `NotAllowedError` rejections from explicit keyboard Play attempts, then a successful third attempt. After **each** denial, the same song must remain available, the browser-permission explanation persists, the failed-provider recovery panel stays hidden, continuous listening is off, the audio element is unloaded and Keep/Pass history/favorites stay unchanged. Successful keyboard replay must clear the warning, keep focus on Play and *not* reenable continuous listening without a separate new session. This is a controlled behavior regression, **not** evidence of native browser permissions, real provider rights or physical-device support.

## Autoplay permission recovery (v0.12 development)

At a 390px viewport, Chromium and Firefox use fictional Deezer metadata and a controlled media element to exercise the *real application state machine* without depending on codec support. The listener explicitly Plays and Passes one song, then the next automatic `play()` rejects with the browser's `NotAllowedError`. The test requires exactly one deliberate Pass, unchanged favorites, no automatic skipping of the unheard next track, a stopped continuous-listening session and a persistent manual Play instruction instead of a broken-stream warning.

The user then activates Play with Enter. The same next recording must resume as a single-song preview, preserve keyboard focus and leave history untouched. A deliberately dispatched stale `ended` event must not skip that recording.

This is **not** proof of actual media decoding or permission behavior on iOS and Android. Separate Chromium/Firefox smoke tests load synthetic WAV audio and exercise on-demand preview resolution, native playback, mid-stream recovery and cancellation. Live provider availability, rights and physical mobile/assistive-technology checks remain open.

## Recovering from a terminal preview error via main Play (v0.12 development)

A 390px Chromium/Firefox regression plays synthetic, locally generated silent WAV bytes in the real audio element, triggers one recoverable media error followed by a terminal error, and then presses the main Play button with Enter. It checks that the explicit replay resolves *new* Deezer metadata instead of reusing the failed cached source, keeps the same song and keyboard focus, clears the failure UI, and creates no Keep/Pass or favorite changes. The test mocks provider metadata and does not validate live Deezer availability or music rights.

## Pass the Aux editor focus continuity (v0.12 development)

Chromium and Firefox now rerender the real 320px Pass the Aux screen while Add, Move Earlier, Share or Use Latest Five owns focus. The tests verify that the equivalent button remains focused after a content update, and that a filtered-out Add control returns focus to the labeled search field, with no unintended favorites/history writes. The test simulates an unrelated redraw using the existing search event handler; it does not substitute for a manual assistive-technology review.

## Clipboard-denied Pass the Aux sharing (v0.12 development)

A 320px Chromium/Firefox built-site test denies the modern clipboard API and then makes the legacy copy command return false or throw. Pass the Aux still displays the exact ID-only link in a focusable read-only input, selects it for Ctrl+C/Command+C, cleans up temporary nodes, and returns focus to Share after dismissal. No favorites or listening votes are changed. This verifies fallback UI under synthetic permissions, not platform-specific clipboard behavior on real phones.

## Media-error refresh cancellation (v0.12 development)

- New Chromium and Firefox phone-width checks simulate a media-element error after an explicit fixture preview has started, hold the replacement Deezer metadata request, cancel it through the player control and verify that the late callback cannot restart playback or change listening votes. An explicit subsequent Play starts a fresh metadata request.
- The media fixture uses only generated silence and fictional catalog metadata, not third-party audio. Actual provider behavior and physical-device audio interruptions still require manual verification.

## Cancel a pending preview with its own Play control (v0.12 development)

- Chromium and Firefox at a 390px phone viewport hold a fictional Deezer track metadata lookup, verify that Play becomes a keyboard-accessible Cancel loading preview button, activate it, and assert that the JSONP request is aborted, no late callback starts audio, no recovery error/vote appears, and fresh Play can retry.
- The test does not fetch a real preview or establish that a third-party audio source is available or licensed for public use.

## Preview interruption by modal dialogs (v0.12 development)

- Opening a modal while a fictional Deezer preview metadata lookup is pending now aborts that lookup before the dialog becomes interactive. The phone-width Chromium/Firefox regression checks script removal, inert late callback behavior, paused/cleared audio, no automatic restart, correct return of focus, and a fresh explicit Play afterward.
- The browser fixture does not fetch actual media or establish external playback permissions. The non-loading path pauses rather than resets an existing preview; physical-device playback interruption still requires manual checking.

## Abandoned audio-metadata cancellation (v0.12 development)

- Added a phone-width Chromium/Firefox regression that intercepts fictional on-demand Deezer track JSONP metadata, starts Play, stops before the lookup responds, then verifies the script was removed and an old callback is harmless. Navigating away also stops an in-flight lookup; a new Play on returning to Discover starts a fresh request and never records a Keep/Pass.
- The test intentionally never requests a real recording. These checks establish browser cancellation and retry safety, not live Deezer reliability, licensed preview rights or physical mobile-device behavior.

# Browser Smoke Testing

The published AFTERTONE site has two entry points: the portfolio homepage at / and the original interactive music application at /demo/. In an earlier deployment, missing CSS and JavaScript imports produced a blank or unstyled screen even though static unit tests succeeded.

## Automated deployment gate

The GitHub Pages workflow builds the site with `npm run check`, installs Playwright, Chromium and Firefox, then runs both `python scripts/browser-smoke.py` and `python scripts/browser-smoke.py --firefox` before uploading the Pages artifact. To avoid re-downloading the two large browser binaries on every run, the workflow caches `~/.cache/ms-playwright` with a key tied to the GitHub runner OS/architecture, Ubuntu 24.04 and the pinned `playwright==1.56.0` version. A cache miss downloads both browsers normally, and system dependencies are installed on every fresh runner. The cache is a performance optimization only: **all Node checks, Chromium tests, Firefox tests and the Pages deploy gate still run**.

The backup regression suite also transfers a real downloaded progress file into an entirely **new browser context** in Chromium and Firefox separately, with independent localStorage. It verifies the import confirmation and all backed-up data after reload. This is stronger than clearing the same session, but it does not simulate two physical devices or a transfer between browser engines.

The app's build validation also checks local CSS `url()` references inside `dist/` using `scripts/check-css-assets.mjs`. The existing styles currently have no local asset URL references, so focused fixture tests ensure missing assets and traversal are rejected when encountered. This check never downloads remote resources.

The script serves the actual generated dist/ directory through a localhost HTTP server. In desktop Chromium (1440×900) and mobile Chromium (390×844 and 320×740) it checks homepage styling and the direct listening link, navigates into the real app, verifies the listening card and three discovery paths, and checks Collection and Music Duels navigation on desktop. It also checks keyboard dialog focus cycling/return, narrow-phone overflow, and 44px hit rectangles for the Filters/theme/sound/help controls and all six navigation buttons on 390px and 320px screens. Missing local assets, HTTP errors and uncaught JavaScript exceptions cause a failure.

A separate Firefox smoke pass checks desktop 1440×900 and phone 390×844 / 320×740: real homepage to app launch, first-run dialog Tab wrapping and Escape focus restoration, native Space navigation, all six app sections and their accessible labels/titles, mobile overflow/touch targets and browser JavaScript errors. It is a browser regression gate, **not** a manual cross-browser accessibility audit.

The static browser adapter now forwards route cancellation into Deezer's JSONP lookups, including the provider's nested artist resolution requests, while retaining each lookup's timeout. Node regressions ensure an aborted request removes its script and callback, does not launch a fallback search, and is not reported as a new provider outage. Chromium and Firefox also hold an old artist lookup unanswered, submit a new successful query, and assert the old script/callback is gone without a reload, false vote or overwritten search. Fixture metadata is fictional; this is not a live-provider availability or rights audit.

The Chromium and Firefox smoke suites also simulate an HTTP-200 JSONP provider error, verify the user sees a nonblank **Music Is Temporarily Unavailable** state and usable Retry Discovery control, then restore fixture responses and retry without reloading or changing favorites/history. These deterministic simulations cannot establish actual provider uptime or availability by region.

Provider cancellation tests also simulate an already downloaded JSONP script executing after cancellation. The canceled callback is temporarily replaced by a bounded, inert function so late responses do not throw a browser exception or overwrite the active search; normal successful JSONP callbacks are still removed immediately. Node checks verify the callback tombstone expires by design and has a fixed maximum size.

The browser suite also exercises listening-card swipe safety on 390px and 320px layouts in Chromium and Firefox. It performs actual mouse drags to check that primary swipes vote exactly once, including a pointer released just outside the card. Synthetic secondary-touch and pointer-cancel events verify that multi-contact gestures and browser scrolling cannot generate votes; the newer second-contact case also starts a real primary drag, introduces a second touch outside the card, then releases the original pointer and checks that no vote or stale animation remains. A drag interrupted by section navigation must not vote for a new card. These checks do not substitute for physical touchscreen testing.

The mobile app's Filters panel now has real Chromium and Firefox keyboard checks at both 390px and 320px: opening focus, 44px Done target, Escape dismissal, preserved focus after changing genre, automatic panel closure after searching, section navigation and unchanged local favorites/history. These are viewport simulations, not physical iPhone/Android keyboard or screen-reader audits.

The Chromium and Firefox suites also verify **artist-index outage traffic**: a fictional Deezer JSONP 503 response must surface a recoverable provider error with no extra ranked search request, then permit a manual Retry Discovery after the service recovers without losing favorites or voting. Node tests separately exercise timeout, 5xx and HTTP 400/404 fallback behavior. These tests do not connect to the real Deezer service.

The Chromium and Firefox smoke suites now also exercise a **real JSON file download and file-input restore**. Each test creates fictional favorites and one listening choice, exports a version-2 backup including favorite artists, Tune Lab results, imported-playlist metadata and lyric timing adjustments, rejects an unsupported version without modifying storage, deliberately clears local progress, imports the saved file through the app’s destructive confirmation dialog, and verifies the restored favorite appears in Collection after reload. This tests both browser engines independently without an account or external music calls. It does not simulate a second physical device or guarantee future backup schema compatibility.

The suite also checks both engines under **reduced motion** at narrow 720px and 360px CSS viewport widths, inspecting all six views for horizontal document overflow and clipped primary controls. These viewports are reflow/zoom-equivalent proxies, **not literal browser zoom tests**; a manual 200% zoom test is still required.

Both engines now additionally simulate a Deezer preview-metadata rate limit (429 inside HTTP 200 JSONP). The browser tests require a visible **wait-before-retrying** explanation, then switch metadata responses back to success, exercise **Retry Preview**, and confirm the message returns to ordinary CDN-failure guidance if audio remains blocked. No fake Keep/Pass votes are created. This is entirely fixture-backed and does not establish actual Deezer service availability or music-use permissions.

Real Chromium and Firefox tests now also assert **on-demand Deezer preview metadata**: opening Discover and navigating to Collection or Music Duels must issue **zero** `/track/` metadata lookups before the listener presses Play. Clicking Play must make the first preview lookup, with blocked media and no false listening votes. Catalog/artist metadata may still be loaded for discovery. This reduces unnecessary calls; it does not prove provider playback or media-use permission.

Both browser engines also simulate a blocked audio CDN and use **real keyboard activation** of Retry Preview and Skip Without Voting. The checks require a fresh provider-resolution request, keyboard focus returned to a visible Play button (or the main landmark on an exhausted feed), and **no accidental Keep/Pass vote**. Provider metadata remains fictional and media requests remain blocked.

The current public app is Deezer-only. The dormant local mixed-source planner has independent Node tests for temporary provider failures: outages exclude a provider from the **current request batch** without permanently marking its catalog exhausted, so a subsequent request may retry. This is a unit/source-wiring regression test, **not** a browser test of live Audius/Jamendo/Commons/Jellyfin providers or proof of usage permissions.

The Deezer outage recovery tests now explicitly simulate a provider rate-limit (429) inside HTTP 200 JSONP and require the visible error to advise a short wait before Retry Discovery. Node tests independently cover direct HTTP 429, search/artist throttling and artist-top throttling without issuing redundant fallback requests. These are fictional fixtures and **do not** establish provider uptime or permission.

Both browser passes intercept Deezer JSONP calls with deterministic fictional fixture metadata and block all other external requests. This tests our own routing and interface behavior; **it does not prove real Deezer availability, playback, usage permission, or media licensing**.

**Successful pull-request builds** now attach a seven-day `aftertone-ui-evidence` artifact with browser-generated desktop captures of the marketing page, Discover, Music Duels setup, an **in-progress four-song bracket**, and the completed podium. These use fictional fixture tracks, real rendered application markup and blocked external requests. This makes feature screenshots reviewable before they are copied into permanent README assets. The existing failure artifact is separate. Images do not demonstrate live music provider playback, content permissions or a human accessibility audit.

Pull requests run the same checks but **never deploy**. Main-branch pushes deploy only after the test job succeeds. Failure screenshots are uploaded to the aftertone-browser-debug workflow artifact for seven days.

## Local verification

1. Install Node.js 22+ and Python 3.12+.
2. Run npm run check to generate dist/.
3. Install Playwright: python -m pip install playwright==1.56.0
4. Install browsers: `python -m playwright install chromium firefox` (and operating-system dependencies as required).
5. Run Chromium checks: `python scripts/browser-smoke.py`
6. Run Firefox checks: `python scripts/browser-smoke.py --firefox`

If an environment blocks Chromium network navigation, report that limitation instead of asserting the browser test passed. Consult the GitHub Actions logs.

## Real-provider smoke check (still manual)

After a release, open the deployed /demo/ application in Firefox and Chrome. Search an artist, play a real preview when authorized and available, adjust volume, confirm autoplay after a user gesture, Keep and Pass a track, reopen Collection, and complete a Music Duels matchup. Note any third-party failures or regional restrictions and check that the app does not go blank.

These checks must be performed on the real website to validate providers. No automated fixture grants permission for public use of third-party media.
