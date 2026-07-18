# SportsHub One — brand assets

Chosen 2026-07-18 (owner): **A1** wordmark + **N3** icon
(exploration: docs/marketing/brand-naming-and-messaging.md + logo artifact).

## Naming scheme
`wordmark-one-<variant>.svg|png` — the A1 lockup: two-tone SportsHub + "ONE"
in the energy box, superscript right.
- `-color` — ink #10142a "Sports" + play blue #4f46e5 "Hub" (light grounds)
- `-reverse` — white + soft blue #a5b4fc (dark grounds)
- `-mono` — single ink + energy box (small sizes < ~20px, print, fax-grade)

`icon-n3*` — the app icon: navy stage tile (#1e2d4d→#0b1628), white S,
energy box (#f24e1e) with "1" top-right.
- `icon-n3.svg` — rounded tile (web/favicon use)
- `icon-n3-foreground.svg` — S + box only, transparent (Android adaptive)
- `box-one.svg` — the ONE box alone (bullet/accent use)

## Rules
- The word **ONE** is spelled out anywhere the name is read (it matches the
  domain). The numeral **1** appears only inside icons.
- In-app headers use the React component
  `apps/web/src/components/brand/wordmark.tsx` (BrandWordmark / BrandIcon),
  not these files — the component tracks page fonts and theme exactly.
- SVGs here use system-font `<text>` — good enough for web/social; before
  print or app-store marketing, regenerate outlined-path masters with the
  final licensed typeface (queued with the OAuth-branding pass).

## Regenerating PNGs (mobile icons, apple-touch, exports)
`node scripts/brand/render-assets.mjs` (Playwright; overwrites
apps/mobile/assets/images/* and apps/web/src/app/apple-icon.png in place —
filenames stay stable so app.json/next never change; native icon/splash
changes still need a new EAS build to appear on devices).

To swap logos later: drop replacement files under the SAME names (or edit
the component + re-run the script) — nothing else references color values
directly.
