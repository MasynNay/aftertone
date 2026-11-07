# AFTERTONE portfolio publishing checkpoint

**Milestone:** 1.0.0 static showcase built from local app v0.10.0 concepts. Public demo uses original browser-synthesized tones and fictional tracks; it must remain separate from the provider-dependent local app.

**Verified:** All 15 new Node tests passed; `npm run check` built the restricted static site into `dist/`. Chromium isolated-page test exercised desktop/mobile mode changes, Play/Pause, Keep/Undo and a complete tournament. Direct localhost navigation was blocked by this sandbox; see `docs/DEVELOPMENT_JOURNAL.md`. GitHub repository and Pages deployment are NOT yet created by this package.

**Next steps:** (1) Upload the contents to a new GitHub repository; (2) enable Pages using GitHub Actions; (3) open published URL and test audio and tournaments; (4) add real published URL to primary portfolio. Do not merge the private Deezer preview implementation into the static deploy.

**Files to start with:** `README.md`, `src/demo-engine.mjs`, `assets/app.js`, `assets/audio.js`, `.github/workflows/pages.yml`, `docs/RIGHTS_AND_PRIVACY.md`.

## 1.0.1 publishing-parity continuation (2026-11-07)

User explicitly requires that publishing does not remove autoplay or existing functionality. The original full local app v0.10.0 remains untouched. Static portfolio 1.0.1 now exposes continuous autoplay and a saved On/Off setting, Skip, audio race protections, song-route continuity, collection export. Static Pages still has no live provider catalog; do not conflate the two variants. See `docs/FEATURE_PARITY.md` and tests. Next: create GitHub repository, push portfolio files, enable Pages, check the deployed URL in a browser. Do not publish unlicensed recordings or secrets.

## Publication setup continuation (repo: aftertone, domain: aftertone.masynnay.com)

- Target new public repo: `MasynNay/aftertone` (not yet created). Public GitHub Pages URL, once deployed: `https://masynnay.github.io/aftertone/`. Branded domain, once configured: `https://aftertone.masynnay.com/`.
- GitHub connector cannot create repositories or modify Pages settings. Next operator step: user creates the empty repo, then use connected GitHub create-file/tree/commit/update-ref tools to push this source; user selects Pages Actions in Settings → Pages. Then configure custom domain in GitHub Settings before creating CNAME in Cloudflare.
- `docs/CUSTOM_DOMAIN.md` contains DNS, HTTPS and checks. The full local source is not included in the published `dist/`.
