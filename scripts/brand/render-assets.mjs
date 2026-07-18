/**
 * Renders the N3 icon + A1 wordmark into every raster asset the platforms
 * need, at the exact filenames already wired into app.json / next — so a
 * rebrand is: edit this file (or the CSS in it), run it, rebuild apps.
 *
 *   node scripts/brand/render-assets.mjs        (needs playwright, any node ≥18)
 *
 * Outputs:
 *   apps/mobile/assets/images/{icon,android-icon-foreground,android-icon-background,
 *     android-icon-monochrome,splash-icon,favicon}.png
 *   apps/web/src/app/apple-icon.png (180)
 *   apps/web/public/brand/{icon-n3-1024,icon-n3-180,wordmark-one-color,
 *     wordmark-one-reverse}.png
 */
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
// playwright lives in scripts/demo (the repo's browser-automation toolbox)
const require = createRequire(resolve(root, "scripts/demo/package.json"))
const { chromium } = require("playwright")
const out = (p) => resolve(root, p)

// One tile renderer: full-bleed square (OS rounds icons itself); the
// rounded=web flag bakes corners for browser-tab/touch contexts.
const FONT = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
function iconHTML({ size, rounded, bg, fg = "#fff", boxBg = "#f24e1e", mono = false, pad = 0 }) {
  const s = size - pad * 2
  const S = Math.round(s * 0.62), B = Math.round(s * 0.27), O = Math.round(s * 0.1)
  const background = mono ? "transparent" : bg
  const sColor = mono ? "#ffffff" : fg
  const box = mono
    ? `<div style="position:absolute;top:${O + pad}px;right:${O + pad}px;width:${B}px;height:${B}px;border-radius:${Math.round(B * 0.2)}px;background:#ffffff"></div>`
    : `<div style="position:absolute;top:${O + pad}px;right:${O + pad}px;width:${B}px;height:${B}px;border-radius:${Math.round(B * 0.2)}px;background:${boxBg};color:#fff;display:flex;align-items:center;justify-content:center;font:800 ${Math.round(B * 0.62)}px ${FONT}">1</div>`
  return `<div id="a" style="width:${size}px;height:${size}px;background:${background};${rounded ? `border-radius:${Math.round(size * 0.225)}px;` : ""}position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
    <span style="font:800 ${S}px ${FONT};color:${sColor};margin-top:${Math.round(s * 0.04)}px">S</span>${box}</div>`
}
function wordmarkHTML({ h, sports, hub }) {
  const f = Math.round(h * 0.72), bf = Math.round(f * 0.3)
  return `<div id="a" style="height:${h}px;display:inline-flex;align-items:flex-start;padding:${Math.round(h * 0.14)}px ${Math.round(h * 0.1)}px;font:800 ${f}px ${FONT};letter-spacing:-0.03em">
    <span style="color:${sports}">Sports</span><span style="color:${hub}">Hub</span>
    <span style="background:#f24e1e;color:#fff;font-size:${bf}px;letter-spacing:0.08em;border-radius:${Math.round(bf * 0.4)}px;padding:${Math.round(bf * 0.38)}px ${Math.round(bf * 0.5)}px;margin-left:${Math.round(f * 0.12)}px;line-height:1">ONE</span></div>`
}

const NAVY = "linear-gradient(150deg,#1e2d4d,#0b1628)"
const JOBS = [
  // mobile (filenames pinned by app.json)
  { file: "apps/mobile/assets/images/icon.png", html: iconHTML({ size: 1024, rounded: false, bg: NAVY }) },
  { file: "apps/mobile/assets/images/android-icon-background.png", html: `<div id="a" style="width:1024px;height:1024px;background:${NAVY}"></div>` },
  { file: "apps/mobile/assets/images/android-icon-foreground.png", html: iconHTML({ size: 1024, rounded: false, bg: "transparent", pad: 240 }), transparent: true },
  { file: "apps/mobile/assets/images/android-icon-monochrome.png", html: iconHTML({ size: 1024, rounded: false, bg: "transparent", mono: true, pad: 240 }), transparent: true },
  { file: "apps/mobile/assets/images/splash-icon.png", html: iconHTML({ size: 512, rounded: true, bg: NAVY }), transparent: true },
  { file: "apps/mobile/assets/images/favicon.png", html: iconHTML({ size: 48, rounded: true, bg: NAVY }), transparent: true },
  // web
  { file: "apps/web/src/app/apple-icon.png", html: iconHTML({ size: 180, rounded: false, bg: NAVY }) },
  // exportable brand pngs
  { file: "apps/web/public/brand/icon-n3-1024.png", html: iconHTML({ size: 1024, rounded: true, bg: NAVY }), transparent: true },
  { file: "apps/web/public/brand/icon-n3-180.png", html: iconHTML({ size: 180, rounded: true, bg: NAVY }), transparent: true },
  { file: "apps/web/public/brand/wordmark-one-color.png", html: wordmarkHTML({ h: 160, sports: "#10142a", hub: "#4f46e5" }), transparent: true },
  { file: "apps/web/public/brand/wordmark-one-reverse.png", html: wordmarkHTML({ h: 160, sports: "#ffffff", hub: "#a5b4fc" }), transparent: true },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const job of JOBS) {
  await page.setContent(`<body style="margin:0;background:${job.transparent ? "transparent" : "#fff"}">${job.html}</body>`)
  const el = page.locator("#a")
  mkdirSync(dirname(out(job.file)), { recursive: true })
  await el.screenshot({ path: out(job.file), omitBackground: !!job.transparent })
  console.log("✓", job.file)
}
await browser.close()
