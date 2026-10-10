# App icons

`favicon.svg` is committed and used by the browser tab.

The PWA manifest (`vite.config.js`) also references PNG icons that still need
to be generated (Person 1, during Phase 6 PWA setup):

- `icon-192.png` — 192×192
- `icon-512.png` — 512×512
- `icon-512-maskable.png` — 512×512, maskable (safe zone padding)

Quick way to generate them from the SVG (any one of these):
- https://realfavicongenerator.net/ or https://maskable.app/
- or `npx pwa-asset-generator favicon.svg . --icon-only`

Until the PNGs exist the app still runs; only "Add to Home Screen" needs them.
