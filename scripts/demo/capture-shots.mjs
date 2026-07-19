// Captures REAL product screens from the seeded demo world for the
// marketing pages (capabilities-pages-proposal.md Layer 1). Desktop shots
// at 1440x900, family shots at a true iPhone viewport 390x844. Output:
// apps/web/public/shots/*.png. Re-run any time the UI changes.
//
//   node scripts/demo/capture-shots.mjs
//
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { BASE, ensureSession } from "./lib.mjs"

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/shots")
fs.mkdirSync(OUT, { recursive: true })

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }

const SHOTS = [
  // club / operator surfaces (real admin, PC size)
  { name: "club-dashboard", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "/dashboard" },
  { name: "club-tryouts", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "/tryouts" },
  { name: "club-payments", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "/payments" },
  { name: "club-chat", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "/messages" },
  { name: "coach-team-home", who: "coach-force-gr10@sportshub.demo", vp: DESKTOP, url: "/teams" },
  // public power surfaces
  { name: "public-scores", vp: DESKTOP, url: "/scores" },
  { name: "public-news", vp: DESKTOP, url: "/news" },
  { name: "public-club-page", vp: DESKTOP, url: "/club/force" },
  { name: "public-leagues", vp: DESKTOP, url: "/leagues" },
  { name: "game-page", vp: DESKTOP, url: "DISCOVER_GAME" },
  // parent, true iPhone viewport
  { name: "phone-home", who: "parent@sportshub.demo", vp: PHONE, url: "/" },
  { name: "phone-calendar", who: "parent@sportshub.demo", vp: PHONE, url: "/calendar" },
  { name: "phone-scores", who: "parent@sportshub.demo", vp: PHONE, url: "/scores" },
  { name: "phone-game", who: "parent@sportshub.demo", vp: PHONE, url: "DISCOVER_GAME" },
  { name: "phone-chat", who: "parent@sportshub.demo", vp: PHONE, url: "/messages" },
  { name: "phone-kids", who: "parent@sportshub.demo", vp: PHONE, url: "/players" },
]

const browser = await chromium.launch()

// find one real game page URL from the public scores hub
async function discoverGameUrl() {
  const ctx = await browser.newContext({ viewport: DESKTOP })
  const page = await ctx.newPage()
  await page.goto(BASE + "/scores", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1200)
  const href = await page
    .locator('a[href*="/game"]')
    .first()
    .getAttribute("href")
    .catch(() => null)
  await ctx.close()
  return href
}

const gameUrl = await discoverGameUrl()
console.log("game url:", gameUrl ?? "none found")

let ok = 0
for (const shot of SHOTS) {
  const url = shot.url === "DISCOVER_GAME" ? gameUrl : shot.url
  if (!url) {
    console.log("· skip", shot.name, "(no url)")
    continue
  }
  const opts = { viewport: { width: shot.vp.width, height: shot.vp.height }, deviceScaleFactor: shot.vp.deviceScaleFactor ?? 1, isMobile: !!shot.vp.isMobile, colorScheme: "light" }
  if (shot.who) opts.storageState = await ensureSession(shot.who)
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  try {
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1600)
    const finalUrl = page.url()
    if (finalUrl.includes("/sign-in")) {
      console.log("✗", shot.name, "bounced to sign-in")
    } else {
      await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) })
      console.log("✓", shot.name, "<-", url)
      ok++
    }
  } catch (e) {
    console.log("✗", shot.name, String(e).slice(0, 90))
  }
  await ctx.close()
}

await browser.close()
console.log(`done: ${ok}/${SHOTS.length} captured -> apps/web/public/shots/`)
