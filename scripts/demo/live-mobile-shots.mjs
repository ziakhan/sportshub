/**
 * Live game page — mobile verification harness (2026-08-14).
 *
 * Shoots /live/<gameId> at 390x844 signed out AND signed in, plus 1440x900 for
 * the desktop regression check, and measures the things the owner rejected:
 * horizontal overflow, hero edge bleed, and anything the fixed chrome covers.
 *
 *   node scripts/demo/live-mobile-shots.mjs [outDir] [gameId]
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const OUT =
  process.argv[2] ||
  "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/f4bd129f-a7c5-4766-b470-394023809374/scratchpad/live-v3-shots"
const GAME = process.argv[3] || "856c8e4f-740c-4565-8657-f016223e413d"
const EMAIL = "summer-parent-force@sportshub.demo"
const PASS = "TestPass123!"
fs.mkdirSync(OUT, { recursive: true })
const SESSIONS = `${OUT}/sessions`
fs.mkdirSync(SESSIONS, { recursive: true })

async function login(browser) {
  const file = `${SESSIONS}/${EMAIL.replace(/[^a-z0-9]/gi, "_")}.json`
  if (fs.existsSync(file) && !process.env.FRESH_LOGIN) return file
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(2500)
  await p.locator('input[type="email"], input[name="email"]').first().fill(EMAIL)
  await p.locator('input[type="password"], input[name="password"]').first().fill(PASS)
  await p.locator('button[type="submit"]').first().click()
  let ok = false
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(500)
    const s = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (s?.user) {
      ok = true
      break
    }
  }
  if (!ok) throw new Error("login never became live")
  await ctx.storageState({ path: file })
  console.log(`session live: ${EMAIL}`)
  await ctx.close()
  return file
}

/** Geometry probe: overflow, hero bleed, chrome overlap. */
async function probe(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const hero = document.querySelector("[data-hero]")
    const heroBox = hero ? hero.getBoundingClientRect() : null
    // Widest offender for horizontal overflow
    let widest = null
    if (document.documentElement.scrollWidth > vw) {
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1 && r.width > 0) {
          const overflow = r.right - vw
          if (!widest || overflow > widest.overflow) {
            widest = {
              overflow: Math.round(overflow),
              tag: el.tagName,
              cls: String(el.className).slice(0, 90),
              text: (el.textContent || "").trim().slice(0, 40),
            }
          }
        }
      }
    }
    // Fixed chrome rectangles (bottom bar, FAB, demo chip)
    const fixedBoxes = []
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const cs = getComputedStyle(el)
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") continue
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      if (r.bottom < 0 || r.top > vh) continue
      fixedBoxes.push({
        tag: el.tagName,
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
      })
    }
    return {
      vw,
      vh,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      hero: heroBox
        ? { left: Math.round(heroBox.left), right: Math.round(heroBox.right), width: Math.round(heroBox.width), height: Math.round(heroBox.height) }
        : null,
      widest,
      fixedBoxes,
    }
  })
}

/** Does any fixed chrome cover meaningful content at the current scroll? */
async function overlapCheck(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight
    const vw = window.innerWidth
    const bars = Array.from(document.querySelectorAll('nav[aria-label="Primary"]'))
    const bar = bars.find((n) => n.getBoundingClientRect().height > 10 && getComputedStyle(n).position === "fixed")
    // Desktop hides the bar entirely (lg:hidden) — nothing to check.
    if (!bar) return { bar: false, covered: [] }
    const b = bar.getBoundingClientRect()
    const covered = []
    // Sample the strip the bar sits over. elementFromPoint would just return
    // the bar (it is on top), so walk elementsFromPoint past the bar and its
    // descendants: whatever is UNDER the bar there is content it covers.
    for (let x = 20; x < vw; x += 60) {
      for (let y = Math.max(0, b.top + 6); y < vh; y += 14) {
        const stack = document.elementsFromPoint(x, y)
        const el = stack.find((n) => !bar.contains(n) && n !== bar)
        if (!el) continue
        if (["HTML", "BODY", "MAIN"].includes(el.tagName)) continue
        const txt = (el.textContent || "").trim()
        if (txt && el.children.length === 0) {
          covered.push({ x, y: Math.round(y), text: txt.slice(0, 30), tag: el.tagName })
        }
      }
    }
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    return {
      bar: true,
      barTop: Math.round(b.top),
      atBottom: Math.abs(window.scrollY - maxScroll) < 2,
      scrollY: Math.round(window.scrollY),
      maxScroll: Math.round(maxScroll),
      covered: covered.slice(0, 10),
    }
  })
}

async function shoot(browser, { name, viewport, storageState, tab, url }) {
  const ctx = await browser.newContext({ viewport, storageState, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const errors = []
  p.on("pageerror", (e) => errors.push(e.message))
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  await p.goto(`${BASE}${url || `/live/${GAME}`}`, { waitUntil: "domcontentloaded", timeout: 60000 })
  await p.waitForTimeout(Number(process.env.WAIT_MS || 5000))
  if (tab) {
    const btn = p.locator(`[role="tab"]:has-text("${tab}")`).first()
    if (await btn.count()) {
      await btn.click()
      await p.waitForTimeout(900)
    }
  }
  const geo = await probe(p)
  // Scroll to the true END of the document: a fixed bar always has content
  // sliding under it mid-scroll, so the only real question is whether the LAST
  // rows can be read once you cannot scroll further.
  await p.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })
  )
  await p.waitForTimeout(800)
  const bottom = await overlapCheck(p)
  await p.screenshot({ path: `${OUT}/${name}-bottom.png` })
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${OUT}/${name}-viewport.png` })
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  await ctx.close()
  const report = { name, geo, bottom, errors: errors.slice(0, 6) }
  fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(report, null, 2))
  console.log(
    `\n=== ${name} === scrollWidth=${geo.scrollWidth}/${geo.vw} hero=${JSON.stringify(geo.hero)}`
  )
  if (geo.widest) console.log(`  OVERFLOW by ${geo.widest.overflow}px: <${geo.widest.tag}> ${geo.widest.cls} :: ${geo.widest.text}`)
  if (bottom.bar) console.log(`  at page end: ${bottom.atBottom} (scrollY ${bottom.scrollY}/${bottom.maxScroll})`)
  if (bottom.covered?.length) console.log(`  COVERED BY BAR: ${JSON.stringify(bottom.covered.slice(0, 4))}`)
  console.log(`  fixed: ${geo.fixedBoxes.map((f) => `${f.label || f.tag}@${f.rect.x},${f.rect.y} ${f.rect.w}x${f.rect.h}`).join(" | ")}`)
  if (report.errors.length) console.log(`  errors: ${report.errors.join(" | ")}`)
  return report
}

const browser = await chromium.launch()
const only = process.env.ONLY || ""
const session = await login(browser)

const jobs = [
  { name: "anon-390-game", viewport: { width: 390, height: 844 }, storageState: undefined, tab: null },
  { name: "anon-390-plays", viewport: { width: 390, height: 844 }, storageState: undefined, tab: "Play-by-play" },
  { name: "auth-390-game", viewport: { width: 390, height: 844 }, storageState: session, tab: null },
  { name: "auth-390-plays", viewport: { width: 390, height: 844 }, storageState: session, tab: "Play-by-play" },
  { name: "auth-1440-game", viewport: { width: 1440, height: 900 }, storageState: session, tab: null },
  // The demo ribbon lives on every public page — /scores is the other one the
  // owner checks at 390.
  { name: "anon-390-scores", viewport: { width: 390, height: 844 }, storageState: undefined, tab: null, url: "/scores" },
  // The bottom-bar space reservation is shared with the platform layout.
  { name: "auth-390-dashboard", viewport: { width: 390, height: 844 }, storageState: session, tab: null, url: "/dashboard" },
]
for (const j of jobs) {
  if (only && !j.name.includes(only)) continue
  await shoot(browser, j)
}
await browser.close()
