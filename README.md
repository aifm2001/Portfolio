# AIFM Solutions portfolio

Static export of https://illuminated-founders-388889.framer.app/ for GitHub Pages.

Target address: https://aifm2001.github.io/Portfolio/

## Activate hosting

In Settings → Pages → Build and deployment, choose **GitHub Actions**. Then open Actions → Publish AIFM portfolio → Run workflow (or rerun the latest failed deployment).

## Update the site

Publish your changes in Framer, then run the workflow. Each build downloads the published pages, JavaScript, images, and fonts into a static Pages artifact. The existing deployed snapshot is not automatically changed when Framer changes. Keep the source site available for future exports.

## Local export

Requires Node.js 22 or newer; no package installation needed.

```sh
node scripts/export.mjs
```

The output is in `dist`. Serve it mounted at `/Portfolio/` to preview routing. `export-manifest.json` records the routes and asset counts. GitHub Actions retains a downloadable `github-pages` artifact.

This is a published-site snapshot, not the editable Framer project. Framer-hosted forms, search, editor functions, or integrations may require separate migration if added later. Portfolio links, email links, and Instagram links remain external.
