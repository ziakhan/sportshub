// Full-page phone captures for the landing's guided scrolling slides (owner
// 2026-08-17): each slide starts at the top of a real page and slow-scrolls
// through it; the game slide also walks the three tabs. JPEG to keep the tall
// assets light.
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { ensureSession, BASE } from "./lib.mjs"

const OUT = path.resolve("apps/web/public/home-preview/tours")
fs.mkdirSync(OUT, { recursive: true })

const PARENT = "summer-parent-lords@sportshub.demo"
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }

const LIVE_GAME = "/live/96ae0a97-2476-4b4a-b5f1-864b75c29091"

const SHOTS = [
  { name: "game-1-live", url: LIVE_GAME },
  { name: "game-2-stats", url: LIVE_GAME, tapText: "Team stats" },
  { name: "game-3-pbp", url: LIVE_GAME, tapText: "Play-by-play" },
  { name: "discover", url: "/club" },
  { name: "payments", url: "/payments", auth: true },
  { name: "calendar", url: "/calendar", auth: true },
  { name: "chat", url: "/messages", auth: true, followHref: /\/teams\/[^/]+\/chat/ },
  { name: "recap", url: "/news/toronto-lords-grade-10-girls-vs-burlington-force-grade-10-gi-20260815-4d49de76" },
  { name: "feed", url: "/feed", auth: true },
  { name: "player", url: "/player/8c298c76-8d17-4f78-81d3-37e73f5695b5" },
]

const hideChrome = (page) =>
  page.evaluate(() => {
    document.querySelectorAll("a, button").forEach((el) => {
      const t = (el.textContent || "").trim()
      if (t === "Start Free" || t.toUpperCase().includes("TRY THE DEMO")) el.style.visibility = "hidden"
    })
    // The tour scrolls to the page's end; the site footer is not the pitch
    // (owner 2026-08-17), so it leaves the frame entirely.
    document.querySelectorAll("footer").forEach((el) => (el.style.display = "none"))
  })

const browser = await chromium.launch()
const storageState = await ensureSession(PARENT).catch(() => null)

for (const shot of SHOTS) {
  if (shot.auth && !storageState) {
    console.log(`${shot.name}: SKIP (no session)`)
    continue
  }
  const ctx = await browser.newContext({ ...PHONE, ...(shot.auth ? { storageState } : {}) })
  const page = await ctx.newPage()
  try {
    await page
      .goto(BASE + shot.url, { waitUntil: "networkidle", timeout: 60000 })
      .catch(async () => page.goto(BASE + shot.url, { waitUntil: "domcontentloaded", timeout: 60000 }))
    await page.waitForTimeout(3000)
    if (shot.auth && page.url().includes("/sign-in")) {
      console.log(`${shot.name}: SKIP (bounced)`)
      await ctx.close()
      continue
    }
    if (shot.followHref) {
      const href = await page.evaluate((pattern) => {
        const re = new RegExp(pattern)
        const a = Array.from(document.querySelectorAll("a")).find((el) => re.test(el.getAttribute("href") || ""))
        return a ? a.getAttribute("href") : null
      }, shot.followHref.source)
      if (!href) {
        console.log(`${shot.name}: SKIP (no chat link)`)
        await ctx.close()
        continue
      }
      await page.goto(BASE + href, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
      await page.waitForTimeout(2500)
    }
    if (shot.tapText) {
      await page.getByText(shot.tapText, { exact: true }).first().click({ timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(1500)
    }
    await hideChrome(page)
    await page.screenshot({ path: path.join(OUT, `${shot.name}.jpg`), fullPage: true, type: "jpeg", quality: 78 })
    console.log(`${shot.name}: captured`)
  } catch (e) {
    console.log(`${shot.name}: FAILED ${String(e).slice(0, 100)}`)
  }
  await ctx.close()
}
await browser.close()
