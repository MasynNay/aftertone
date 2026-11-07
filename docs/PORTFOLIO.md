# AFTERTONE — Portfolio & live application

The public root URL, **https://aftertone.masynnay.com/**, is now a standalone product/engineering portfolio homepage, modeled on the direct-launch presentation approach used by Keystoria. It explains the experience, demonstrates the visual language, describes engineering choices, and includes an **inline independent-project and third-party media notice**. It deliberately has **no modal, no splash page, no iframe and no JavaScript**.

The primary **Explore the Experience** button, the header launch, and the final CTA all navigate directly in the same browser tab to **https://aftertone.masynnay.com/demo/**, which serves the **actual AFTERTONE music-discovery app** from `app/public/` and `app/src/`, including the browser Deezer adapter. The homepage uses an explicitly labeled illustrative preview rather than fake screenshots, fictional tracks or a substitute demo.

## Build and deployment

- `npm run check` runs syntax checks, the application tests, static build, and published-file/import verification. Tests also ensure the homepage does not include a dialog or embedded frame and that the CTA points to the real app.
- `npm start` runs the preserved Node app locally at http://127.0.0.1:4173.
- `npm run build` generates `dist/` for GitHub Pages. Only the portfolio frontend and browser-safe music app modules are published. The local Node server, `.env` and private service credentials are not published.
- Existing custom domain and Cloudflare DNS remain unchanged (`aftertone` CNAME to `masynnay.github.io`, DNS only).

## Release safety checklist

1. Run `npm run check` and confirm the site build, direct app entry, and ESM graph pass.
2. Open the public homepage; confirm styling, hero CTA, experience and engineering sections, responsive layout, and visible inline media notice.
3. Click **Explore the Experience**. Confirm `/demo/` loads the original Discover screen, not a static/fake demo.
4. On an internet-connected device, verify a live Deezer search, short audio playback, Keep/Pass, autoplay and a Music Duels session; mock tests alone do not prove live provider availability.
5. Review the GitHub Actions deployment outcome, check the custom HTTPS domain, and update the changelog if behavior changes.

## Provider and rights boundary

AFTERTONE is an independent portfolio project. Browser-accessible Deezer metadata, cover images and preview URLs may require the provider's authorization for this public use; the inline notice is not a license. If approval is unavailable, restrict affected features or replace the source with explicitly authorized media. No commercial music recordings or lyrics are redistributed from this repository.