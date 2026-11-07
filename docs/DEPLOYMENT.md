# Publish the static AFTERTONE showcase

This guide deliberately publishes the **static portfolio demo only**.

## GitHub Pages route

1. Sign into GitHub and create a repository named `aftertone` under the `MasynNay` account.
2. Upload all source files in this folder, including `.github/workflows/pages.yml`, to the repository root. Avoid uploading the local app's `.env`, music files, or archived prototypes.
3. In repository Settings → Pages, set the deployment source to **GitHub Actions**.
4. Push to `main`. The workflow runs tests, creates `dist/` and deploys the verified static files.
5. Open the repository's Actions tab to inspect the deployment result and Pages URL. For the repository named `aftertone` under the GitHub handle `MasynNay`, the conventional Pages path would be `https://masynnay.github.io/aftertone/` **after deployment is actually enabled and succeeds**.
6. Test on a phone and desktop, including Play, Keep, Pass, Undo, each discovery path and a complete four-match tournament.

The workflow uploads only `dist/`, not the original Node server or provider modules. The site uses relative asset URLs and works at a project subpath.

## Manual deployment to another static host

`npm run check && npm run build`, then upload the contents of `dist/` to a static host (such as Netlify or Cloudflare Pages). No runtime environment variables are needed.

## Final quality checks before sharing

- [ ] Verify all actions after the site is deployed.
- [ ] Confirm the content is clearly labeled as a demo with fictional tracks.
- [ ] Check laptop, phone, keyboard-only, and reduced-motion mode.
- [ ] Verify no third-party script or audio requests are present in Network tools.
- [ ] Link to the actual published URL from your main portfolio when it is live.
- [ ] Decide whether to link the full local application source separately; review copyright and provider agreements first.

## Custom branded address

After the Pages site is live, you can use `aftertone.masynnay.com` without changing `masynnay.com` or your other subdomains. Follow `docs/CUSTOM_DOMAIN.md` for the GitHub settings, Cloudflare CNAME, HTTPS and safety checklist.
