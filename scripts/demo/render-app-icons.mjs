// Renders the SportsHub app icon set (Energy Pass hardwood look) into
// apps/mobile/assets/images/. Re-run after palette/brand changes:
//   cd scripts/demo && node render-app-icons.mjs
import { chromium } from "playwright"
import { mkdirSync } from "fs"
import { resolve } from "path"

const OUT = resolve(import.meta.dirname, "../../apps/mobile/assets/images")
mkdirSync(OUT, { recursive: true })

// Energy Pass hardwood (packages/design-tokens PALETTES.hardwood)
const STAGE = "#0b1628"
const STAGE2 = "#1e2d4d"
const ENERGY = "#f24e1e"
const ENERGY_DEEP = "#c93a10"
const HIGHLIGHT = "#fbbf24"

/** Basketball: energy-orange sphere, stage-dark seams, soft top-left light. */
function ball(cx, cy, r, seam = STAGE) {
  const sw = Math.max(2, r * 0.055)
  return `
    <defs>
      <radialGradient id="ballShade" cx="0.35" cy="0.3" r="1.1">
        <stop offset="0%" stop-color="${ENERGY}"/>
        <stop offset="62%" stop-color="${ENERGY}"/>
        <stop offset="100%" stop-color="${ENERGY_DEEP}"/>
      </radialGradient>
      <clipPath id="ballClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ballShade)"/>
    <g clip-path="url(#ballClip)" stroke="${seam}" stroke-width="${sw}" fill="none">
      <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/>
      <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/>
      <circle cx="${cx - r * 1.18}" cy="${cy}" r="${r * 0.78}"/>
      <circle cx="${cx + r * 1.18}" cy="${cy}" r="${r * 0.78}"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${r - sw / 2}" fill="none" stroke="${ENERGY_DEEP}" stroke-width="${sw}" opacity="0.35"/>
  `
}

/** White silhouette with knocked-out seams (Android 13 monochrome). */
function ballMono(cx, cy, r) {
  const sw = Math.max(2, r * 0.06)
  return `
    <defs><clipPath id="mClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
    <g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>
      <g clip-path="url(#mClip)" stroke="black" stroke-width="${sw}" fill="none">
        <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/>
        <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/>
        <circle cx="${cx - r * 1.18}" cy="${cy}" r="${r * 0.78}"/>
        <circle cx="${cx + r * 1.18}" cy="${cy}" r="${r * 0.78}"/>
      </g>
    </g>
  `
}

const stageGradient = `
  <defs>
    <linearGradient id="stage" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${STAGE2}"/>
      <stop offset="100%" stop-color="${STAGE}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#stage)"/>
`

// Gold shot trail sweeping up INTO the ball (drawn first; ball covers the
// join) — ball-in-flight, the Energy Pass highlight.
const trail = (d, w) =>
  `<path d="${d}" stroke="${HIGHLIGHT}" stroke-width="${w}" fill="none"
     stroke-linecap="round" opacity="0.95"/>`

const assets = [
  {
    file: "icon.png",
    size: 1024,
    transparent: false,
    svg: `${stageGradient}${trail("M 148 886 Q 258 610 430 520", 46)}${ball(610, 440, 285)}`,
  },
  {
    file: "android-icon-background.png",
    size: 1024,
    transparent: false,
    svg: stageGradient,
  },
  {
    file: "android-icon-foreground.png",
    size: 1024,
    transparent: true,
    // adaptive safe zone = inner 66% — keep everything inside r≈330
    svg: `${trail("M 292 736 Q 360 570 456 512", 30)}${ball(576, 468, 190)}`,
  },
  {
    file: "android-icon-monochrome.png",
    size: 1024,
    transparent: true,
    svg: ballMono(512, 512, 300),
  },
  {
    file: "splash-icon.png",
    size: 512,
    transparent: true,
    svg: `<g transform="scale(0.5)">${ball(512, 512, 380)}</g>`,
  },
  {
    file: "favicon.png",
    size: 48,
    transparent: true,
    svg: `<g transform="scale(0.046875)">${ball(512, 512, 460)}</g>`,
  },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })
for (const a of assets) {
  await page.setViewportSize({ width: a.size, height: a.size })
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <svg width="${a.size}" height="${a.size}" viewBox="0 0 ${a.size} ${a.size}"
      xmlns="http://www.w3.org/2000/svg">${a.svg}</svg></body></html>`)
  await page.screenshot({
    path: resolve(OUT, a.file),
    omitBackground: a.transparent,
    type: "png",
  })
  console.log("rendered", a.file)
}
await browser.close()
