# AFTERTONE custom-domain setup (GitHub Pages + Cloudflare)

Recommended public URL: **https://aftertone.masynnay.com/**. Keep `masynnay.com` and existing subdomains unchanged.

## First, deploy to GitHub Pages

1. Create a **public** repository named `aftertone` under `MasynNay` (no initial README or license).
2. Upload/push this source to the `main` branch, including `.github/workflows/pages.yml`.
3. GitHub repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow runs `npm run check`, builds `dist/`, and deploys it.
4. Verify **https://masynnay.github.io/aftertone/** after GitHub Actions reports success. A working default URL is an important prerequisite for custom DNS troubleshooting.

## Then configure the branded address

1. Verify control of `masynnay.com` under GitHub **Settings → Pages → Verify domain** (or your account's Pages domain verification), if prompted. GitHub recommends verification to help prevent domain takeover.
2. In the **aftertone** repository, go to **Settings → Pages → Custom domain** and enter **`aftertone.masynnay.com`**. Save it. Configure GitHub before adding DNS to avoid an unclaimed CNAME.
3. In **Cloudflare → masynnay.com → DNS → Records → Add record** enter:

   - **Type:** CNAME
   - **Name:** `aftertone`
   - **Target/content:** `masynnay.github.io`  *(not `masynnay.github.io/aftertone` and not the main apex domain)*
   - **Proxy status:** **DNS only** (gray cloud, at least initially)
   - **TTL:** Auto

4. Do **not** change the `@`/root records, `www`, other subdomains, your reverse-proxy records, or Cloudflare nameservers.
5. Return to **Settings → Pages** and enable **Enforce HTTPS** when GitHub offers it. Certificate provisioning and DNS can take time; do not publish the branded URL before it actually resolves over HTTPS.
6. Open `https://aftertone.masynnay.com/` on desktop and phone; test Start/Play, **autoplay transitions**, audio volume, Keep, Pass, Skip, export and a duel tournament. Verify browsers' initial audio gesture requirement is explained.

**Important:** GitHub Pages workflows that publish via **GitHub Actions** do not need a `CNAME` file. GitHub associates the custom domain through repository settings. Cloudflare DNS credentials are not required in this repository and must not be uploaded. HTTPS may initially be unavailable during certificate provisioning. If DNS already has an `aftertone` record, inspect it before replacing it.

Sources: [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and [GitHub Pages publishing with Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
