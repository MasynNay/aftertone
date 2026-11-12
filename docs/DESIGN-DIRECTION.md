# AFTERTONE Visual Direction

## Purpose

AFTERTONE's portfolio landing page is intentionally unlike the Keystoria portfolio landing page. The products should show range in information architecture, typography, hierarchy, layout, color, and interaction rather than repeat a common dark developer template.

## AFTERTONE: a record-shop editorial

- **Palette:** warm paper, deep blue, warm orange, butter yellow, and mint. The light canvas is a deliberate contrast to Keystoria's dark cyber-themed stage.
- **Type:** expressive Georgia headlines paired with utilitarian sans-serif text and small monospace issue markers. The headings use an editorial voice rather than all-caps techno typography.
- **Composition:** an illustrated sleeve and vinyl, magazine-like marginalia, an editorial manifesto, a four-row record index for discovery modes, a layered listening-card illustration, and a typographic closing section.
- **Interaction:** no landing-page JavaScript, no blocking welcome modal, obvious launch links, keyboard-visible focus rings, a skip link, and a reduced-motion stylesheet.
- **Real product:** all launch links still target the untouched browser app at \`./demo/\`. The static build preserves \`app/public\` and its bundled modules.
- **Honesty:** illustration is explicitly artwork, not a fabricated product screenshot; playback claims are qualified by third-party availability; attribution and independent-project disclosure remain visible.

## Maintenance

The page lives in \`site/index.html\` and \`site/styles.css\`. The GitHub Pages build in \`scripts/build-static.mjs\` publishes these alongside the complete AFTERTONE demo. Keep \`#explore-experience\`, \`#modes\`, \`#engineering\`, \`.nav-launch\`, and \`.launch-section\` for deployment checks.

Design note updated November 2026.
