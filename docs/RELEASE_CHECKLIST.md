# AFTERTONE — Release Verification Checklist

Use this for each tagged public release, not for every incremental development PR.

**Current published tag:** [v0.11.0](https://github.com/MasynNay/aftertone/releases/tag/v0.11.0). The v0.12 accessibility work has been merged to `main` but is not a separately tagged release.

## 1. Code and deployment evidence

- [ ] Confirm the intended PRs are merged and the GitHub Actions commit SHA matches the exact `main` commit to release.
- [ ] Confirm `npm run check` passes: source syntax, automated Node tests, static Pages build, JavaScript imports, HTML/CSS asset references.
- [ ] Confirm the real built-site Chromium smoke test passes on desktop and both narrow-phone viewports. Check landing page, full app, backup/restore, Duels and keyboard interaction.
- [ ] Confirm the successful main-branch Pages **deploy** job and verify `https://aftertone.masynnay.com/` plus `https://aftertone.masynnay.com/demo/` in an actual browser. Do not confuse a green PR-only test with a published site.

## 2. Hands-on listening checks

- [ ] Search an actual artist and verify catalog results where the provider and region permit it. Check both success and an unavailable/empty result.
- [ ] Attempt a real short preview only when its usage is authorized and supported; verify Play/Pause, volume, stop, and repeated source failures. Record the tested browser, approximate region and date. Mocked provider fixtures do not satisfy this check.
- [ ] Confirm neutral skips are not recorded as Pass votes and that automatic playback stops safely after repeated errors.
- [ ] Check saved collection data, backup/restore, Duels resume and CSV export after refreshing in a second browser session.
- [ ] Run keyboard-only checks in Chrome and Firefox, plus an actual NVDA/VoiceOver screen-reader pass and real-phone touch/zoom review. Record unresolved issues rather than claiming general accessibility compliance.

## 3. Third-party and privacy gate

- [ ] Recheck current provider terms and required permissions for public use of music previews, artwork, lyrics and metadata. Document authorization, or disable/replace the affected feature with an appropriately licensed source.
- [ ] Confirm the code contains no bundled commercial recordings, third-party credentials, or sensitive user data.
- [ ] Confirm descriptions explain that browsing an API does **not** itself grant public music usage rights and that browser-saved progress can disappear without backups.
- [ ] Keep [media-permissions issue #3](https://github.com/MasynNay/aftertone/issues/3) open until authorization or an allowed fallback is evidenced.

## 4. Presentation and publishing

- [ ] Check that the README's actual-app screenshots still match the released UI, with honest fixture captions and useful alt text.
- [ ] Update [CHANGELOG.md](CHANGELOG.md), [ROADMAP.md](ROADMAP.md), and the release-notes file for the exact new version.
- [ ] Review the release summary for user-visible improvements, known limitations and required acknowledgements.
- [ ] Publish a tag/release only after all required gates are satisfied; verify it points to the deployed commit and do not relabel the last stable release to imply new features were already tagged.

**No blanket v1.0 approval:** GitHub Actions passing does not establish legal rights, full screen-reader compatibility or the availability of every live preview.
