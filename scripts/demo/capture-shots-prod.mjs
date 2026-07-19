// Captures marketing screenshots FROM PRODUCTION (the rule after 2026-07-19:
// screenshots may only show what prod actually serves). Sessions are minted
// via the auth API. Desktop 1440x900, phone true 390x844@2x.
//   node scripts/demo/capture-shots-prod.mjs
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const BASE = process.env.BASE_URL || "https://sportshubone.com"
const HOST = new URL(BASE).host
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/shots")
fs.mkdirSync(OUT, { recursive: true })

async function mintCookies(email) {
  const jarRes = await fetch(`${BASE}/api/auth/csrf`)
  const setCookies = jarRes.headers.getSetCookie ? jarRes.headers.getSetCookie() : [jarRes.headers.get("set-cookie")].filter(Boolean)
  const { csrfToken } = await jarRes.json()
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ")
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader },
    body: new URLSearchParams({ csrfToken, email, password: "TestPass123!", json: "true" }),
    redirect: "manual",
  })
  const got = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean)
  return [...setCookies, ...got].map((c) => c.split(";")[0]).filter(Boolean).map((kv) => {
    const i = kv.indexOf("=")
    return { name: kv.slice(0, i), value: kv.slice(i + 1), domain: HOST, path: "/", secure: true }
  })
}

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }

const SHOTS = [
  { name: "club-dashboard", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "/dashboard" },
  { name: "club-tryouts", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "DISCOVER_CLUB_TRYOUTS" },
  { name: "club-payments", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "/payments" },
  { name: "club-chat", who: "owner-force@sportshub.demo", vp: DESKTOP, url: "/messages" },
  { name: "coach-team-home", who: "coach-force-gr10@sportshub.demo", vp: DESKTOP, url: "/teams" },
  { name: "public-scores", vp: DESKTOP, url: "/scores" },
  { name: "public-news", vp: DESKTOP, url: "/news" },
  { name: "public-club-page", vp: DESKTOP, url: "DISCOVER_CLUB_PAGE" },
  { name: "public-leagues", vp: DESKTOP, url: "/leagues" },
  { name: "game-page", vp: DESKTOP, url: "DISCOVER_GAME" },
  { name: "phone-home", who: "parent@sportshub.demo", vp: PHONE, url: "/" },
  { name: "phone-calendar", who: "parent@sportshub.demo", vp: PHONE, url: "/calendar" },
  { name: "phone-game", who: "parent@sportshub.demo", vp: PHONE, url: "DISCOVER_GAME" },
  { name: "phone-chat", who: "parent@sportshub.demo", vp: PHONE, url: "/messages" },
  { name: "phone-kids", who: "parent@sportshub.demo", vp: PHONE, url: "/players" },
]

const browser = await chromium.launch()
const cookieCache = new Map()
async function ctxFor(who, vp) {
  const opts = { viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor ?? 1, isMobile: !!vp.isMobile, colorScheme: "light" }
  const ctx = await browser.newContext(opts)
  if (who) {
    if (!cookieCache.has(who)) cookieCache.set(who, await mintCookies(who))
    await ctx.addCookies(cookieCache.get(who))
  }
  return ctx
}

// discover URLs that exist ON PROD
async function discover(who, fromUrl, pattern) {
  const ctx = await ctxFor(who, DESKTOP)
  const page = await ctx.newPage()
  await page.goto(BASE + fromUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const links = await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute("href")))
  await ctx.close()
  return links.find((l) => l && pattern.test(l)) ?? null
}

const gameUrl = await discover(null, "/scores", /^\/live\//)
const clubTryoutsUrl = await discover("owner-force@sportshub.demo", "/dashboard", /^\/clubs\/[^/]+\/tryouts/)
const clubPageUrl = (await discover(null, "/club", /^\/club\/[a-z0-9-]+$/)) || "/club/force"
console.log("discovered:", { gameUrl, clubTryoutsUrl, clubPageUrl })

let ok = 0, skipped = []
for (const shot of SHOTS) {
  let url = shot.url
  if (url === "DISCOVER_GAME") url = gameUrl
  if (url === "DISCOVER_CLUB_TRYOUTS") url = clubTryoutsUrl
  if (url === "DISCOVER_CLUB_PAGE") url = clubPageUrl
  if (!url) { skipped.push(shot.name); console.log("· skip", shot.name); continue }
  const ctx = await ctxFor(shot.who, shot.vp)
  const page = await ctx.newPage()
  const res = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 35000 }).catch(() => null)
  await page.waitForTimeout(1800)
  const status = res ? res.status() : 0
  if (status !== 200 || page.url().includes("/sign-in")) {
    skipped.push(shot.name)
    console.log("✗", shot.name, "status", status)
  } else {
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) })
    console.log("✓", shot.name, "<-", url)
    ok++
  }
  await ctx.close()
}
await browser.close()
console.log(`done: ${ok}/${SHOTS.length} from PROD; skipped: ${skipped.join(", ") || "none"}`)
