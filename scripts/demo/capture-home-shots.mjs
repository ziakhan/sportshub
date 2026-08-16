// Capture real public screens for the homepage screenshots band.
import { chromium } from "playwright"
import fs from "node:fs"

const OUT = "/Users/ziakhan/zia/personal/sportshub/apps/web/public/home-preview"
fs.mkdirSync(OUT, { recursive: true })

const SHOTS = [
  {
    name: "live-game-phone",
    url: "http://localhost:3000/live/856c8e4f-740c-4565-8657-f016223e413d",
    viewport: { width: 390, height: 844 },
    scale: 2,
    settle: 4000,
  },
  {
    // The completed End-of-Season world: real W-L records, games played.
    name: "league-desktop",
    url: "http://localhost:3000/league/860f7c32-65be-45c4-8d4f-84fea6c5d296",
    viewport: { width: 1440, height: 900 },
    scale: 2,
    settle: 4000,
    scrollY: 760,
  },
  {
    // NPH Summer world recap: the Toronto Lords girls, real names, no seed
    // litter. Scrolled so the score art and Player of the Game land in frame.
    name: "news-recap-phone",
    url: "http://localhost:3000/news/toronto-lords-grade-10-girls-vs-burlington-force-grade-10-gi-20260805-f44d3c46",
    viewport: { width: 390, height: 844 },
    scale: 2,
    settle: 4000,
    scrollY: 300,
  },
]

const browser = await chromium.launch()
for (const shot of SHOTS) {
  const ctx = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.goto(shot.url, { waitUntil: "networkidle", timeout: 60000 }).catch(async () => {
    await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 60000 })
  })
  await page.waitForTimeout(shot.settle)
  // Launch state: signup entry points are hidden at soft-open, and the demo
  // pill is local-only chrome. Hide both so captures match the launch build.
  await page.evaluate(() => {
    document.querySelectorAll("a, button").forEach((el) => {
      const t = (el.textContent || "").trim()
      if (t === "Start Free" || t.toUpperCase().includes("TRY THE DEMO")) {
        el.style.visibility = "hidden"
      }
    })
  })
  if (shot.scrollY) {
    await page.evaluate((y) => window.scrollBy(0, y), shot.scrollY)
    await page.waitForTimeout(1200)
  }
  await page.screenshot({ path: `${OUT}/${shot.name}.png` })
  console.log(`${shot.name}: captured${errors.length ? ` (pageerrors: ${errors.length})` : ""}`)
  await ctx.close()
}
await browser.close()
