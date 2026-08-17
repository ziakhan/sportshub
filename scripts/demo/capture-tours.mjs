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

const CHAT_HREF = /\/teams\/[^/]+\/chat/
const SHOTS = [
  { name: "game-1-live", url: LIVE_GAME },
  { name: "game-2-stats", url: LIVE_GAME, tapText: "Team stats" },
  { name: "game-3-pbp", url: LIVE_GAME, tapText: "Play-by-play" },
  { name: "discover", url: "/events" },
  { name: "tabbar-public", url: "/club", barClip: true, barName: "tabbar-public" },
  // The phone's bottom tab bar is captured ONCE (from the live viewport) and
  // pinned by the slide player; it is hidden in the tall captures so it can
  // never scroll away (owner bug report 2026-08-17).
  { name: "tabbar", url: "/calendar", auth: true, barClip: true },
  { name: "payments", url: "/payments", auth: true, hideTabbar: true },
  { name: "calendar-1", url: "/calendar", auth: true, hideTabbar: true },
  // The kid filter in action: tap one child's lens, events filter.
  { name: "calendar-2", url: "/calendar", auth: true, hideTabbar: true, tapText: "Danielle" },
  // Chat is a conversation, not a scroll: three viewport frames tell it as
  // typing and sending a real message.
  { name: "chat-1", url: "/messages", auth: true, followHref: CHAT_HREF, viewport: true },
  { name: "chat-2", url: "/messages", auth: true, followHref: CHAT_HREF, viewport: true, fill: "We'll bring the drinks on Saturday!" },
  { name: "chat-3", url: "/messages", auth: true, followHref: CHAT_HREF, viewport: true, fill: "We'll bring the drinks on Saturday!", send: true },
  { name: "chat-4", url: "/messages", auth: true, followHref: CHAT_HREF, viewport: true, tapText: "We're in" },
  { name: "recap", url: "/news/toronto-lords-grade-10-girls-vs-burlington-force-grade-10-gi-20260815-4d49de76" },
  { name: "feed", url: "/feed", auth: true, hideTabbar: true },
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
    // Sticky bars duplicate in stitched full-page captures ("double screen"):
    // pin them in place for the shot.
    document.querySelectorAll("*").forEach((el) => {
      if (getComputedStyle(el).position === "sticky") el.style.position = "static"
    })
  })

const hideBottomBar = (page) =>
  page.evaluate(() => {
    const vh = window.innerHeight
    document.querySelectorAll("nav, div").forEach((el) => {
      const cs = getComputedStyle(el)
      if (cs.position !== "fixed") return
      const r = el.getBoundingClientRect()
      if (r.bottom >= vh - 4 && r.height > 30 && r.height < 140) el.style.display = "none"
    })
  })

// The typed demo message must exist exactly once: clear prior runs' copies.
if (process.env.DATABASE_URL) {
  try {
    const { PrismaClient } = await import("@prisma/client")
    const prisma = new PrismaClient()
    const gone = await prisma.teamMessage.deleteMany({ where: { body: { in: ["See everyone Saturday at 2!", "We'll bring the drinks on Saturday!"] } } })
    console.log("stale demo chat messages removed:", gone.count)
    await prisma.$disconnect()
  } catch (e) {
    console.log("chat cleanup skipped:", String(e).slice(0, 60))
  }
} else {
  console.log("chat cleanup skipped: no DATABASE_URL")
}

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
    if (shot.fill) {
      const box = page.locator('input[placeholder*="Message"], textarea[placeholder*="Message"]').first()
      await box.fill(shot.fill).catch(() => console.log(`${shot.name}: composer miss`))
      await page.waitForTimeout(600)
    }
    if (shot.send) {
      await page.getByText("Send", { exact: true }).first().click({ timeout: 6000 }).catch(() => console.log(`${shot.name}: send miss`))
      await page.waitForTimeout(2500)
    }
    await hideChrome(page)
    if (shot.barClip) {
      await page.screenshot({ path: path.join(OUT, `${shot.barName ?? "tabbar"}.jpg`), type: "jpeg", quality: 82, clip: { x: 0, y: 756, width: 390, height: 88 } })
      console.log(`${shot.barName ?? "tabbar"}: captured`)
      await ctx.close()
      continue
    }
    if (!shot.viewport && !shot.barClip) await hideBottomBar(page)
    await page.screenshot({
      path: path.join(OUT, `${shot.name}.jpg`),
      fullPage: !shot.viewport,
      type: "jpeg",
      quality: 78,
    })
    console.log(`${shot.name}: captured`)
  } catch (e) {
    console.log(`${shot.name}: FAILED ${String(e).slice(0, 100)}`)
  }
  await ctx.close()
}
await browser.close()
