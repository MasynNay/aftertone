# Restoring AFTERTONE to GitHub Pages

The original app was a Node app. Its UI and discovery code have been restored. A static browser adapter now serves Deezer metadata without adding an untrusted CORS proxy or an API key.

## Deploy

GitHub Desktop: clone `MasynNay/aftertone`, copy the **contents** of this archive's `aftertone` directory into it (replace same-named files; do not copy `.git`), commit and push. Github Actions tests, builds `dist/`, and deploys through the existing `.github/workflows/pages.yml`.

Custom DNS: keep `aftertone.masynnay.com` CNAME to `masynnay.github.io` DNS-only. The static build includes a CNAME file in `dist`.

## Verification after publishing

- Open DevTools → Network; `/main.js` and `/src/taste.mjs` must load successfully (no 404).
- A request for `https://api.deezer.com/chart/0/tracks?...output=jsonp&callback=...` should return JSONP, not a 403/404 or blocked script.
- Actual Deezer song title/artist/art should appear (not fictional demo tracks). Click Play; signed CDN audio should play. Continue through autoplay and try Volume and Keep/Pass.
- Search an artist, change discovery modes, open Collection and Music Duels.
- For any failure, capture the browser Console and Network errors. Never silently fall back to fabricated songs.

## Provider authorization

Deezer has indicated that music-game/preview use may require direct approval even if no audio is rehosted. Contact Deezer for Business before treating this as a public licensed product. Technical API accessibility does not imply a grant of use rights. See Deezer developer API terms.
