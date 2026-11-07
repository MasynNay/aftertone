# AFTERTONE portfolio deployment

The public GitHub Pages home page at `aftertone.masynnay.com/` is a product/engineering case study with a first-visit disclaimer. It embeds the **original restored application** at `/demo/` and offers a full-screen link to `/demo/`.

## Local workflow

- `npm run check` executes the original app test suite, verifies syntax, builds the static site and checks output paths.
- `npm start` runs the original Node application locally at http://127.0.0.1:4173.
- `npm run build` writes `dist/`, which is ignored by Git and deployed via `.github/workflows/pages.yml`.

## Static output

- `/` is generated from `site/` and displays the project information, portfolio disclaimer and embedded app.
- `/demo/` is generated from `app/public/` and `app/src/`, using the same original music discovery experience and browser Deezer adapter.
- No `.env`, credential, locally configured integration or hosted audio recording is copied to `dist/`.
- Deezer catalog requests and preview playback in a browser depend on current provider behavior, availability and applicable permissions. They cannot be guaranteed by build tests.

## Custom domain

Set the repository GitHub Pages custom domain to `aftertone.masynnay.com`. In Cloudflare use a DNS-only CNAME `aftertone` -> `masynnay.github.io`. The build writes `dist/CNAME`. Do not change the root domain DNS or other subdomains.

## Safely changing the site

1. Run `npm run check` before pushing.
2. Verify the first-visit notice opens and closes, overview is readable, embedded app loads, and the `/demo/` direct link works.
3. Confirm Music Duels, search, Keep/Pass, autoplay, and favorites against realistic Deezer responses in a browser and test actual provider availability separately.
4. Confirm GitHub Actions succeeds.
5. Do not claim third-party media rights are granted by this disclaimer.
