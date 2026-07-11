// Runtime verification for the overnight responsive batch (5 commits).
import { chromium } from "playwright"
import { BASE } from "./lib.mjs"
import fs from "node:fs"

const SHOTS = "/tmp/rsvp-verify"
fs.mkdirSync(SHOTS, { recursive: true })
const results = []
const ok = (label, pass, detail = "") => {
  results.push(`${pass ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`)
  console.log(results[results.length - 1])
}
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const browser = await chromium.launch()
const owner = "/tmp/rsvp-verify/session2-owner_force_sportshub_demo.json"
const FORCE = "/clubs/9664fbd0-46da-4e00-b3c3-977339db2a3b"

// ---- 1. Nav: sidebar de-dup (desktop) + pill tabs ----
{
  const ctx = await browser.newContext({ storageState: owner, viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  const subItems = await p.locator(`aside a[href="${FORCE}/teams"]`).count()
  ok("desktop sidebar: no duplicate club sub-items", subItems === 0)
  await p.goto(`${BASE}${FORCE}`, { waitUntil: "networkidle" })
  const pills = await p.locator('nav[aria-label="Club sections"] a').count()
  ok("club tab bar renders as pills", pills >= 10, `${pills} pills`)
  await p.screenshot({ path: `${SHOTS}/r1-desktop-nav.png` })
  await ctx.close()

  const m = await browser.newContext({ storageState: owner, viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })
  const mp = await m.newPage()
  await mp.goto(`${BASE}${FORCE}`, { waitUntil: "networkidle" })
  ok("club page phone: no page h-scroll", (await noHScroll(mp)) === 0)
  const nav = mp.locator('nav[aria-label="Club sections"]')
  const scrollable = await nav.evaluate((el) => el.scrollWidth > el.clientWidth)
  ok("pills scroll within their bar on phone", scrollable)
  await mp.screenshot({ path: `${SHOTS}/r2-phone-pills.png` })
  await m.close()
}

// ---- 2. Forms: camp create single column on phone ----
{
  const ctx = await browser.newContext({ storageState: owner, viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.goto(`${BASE}${FORCE}/camps/create`, { waitUntil: "networkidle" })
  const nameBox = await p.locator('input[placeholder*="Summer"]').first().boundingBox()
  ok("camp-name input spans the phone width", nameBox && nameBox.width > 300, `${Math.round(nameBox?.width ?? 0)}px wide`)
  ok("camp create phone: no page h-scroll", (await noHScroll(p)) === 0)
  await p.screenshot({ path: `${SHOTS}/r3-phone-form.png` })
  await ctx.close()
}

// ---- 3. Standings: sticky column + in-card scroll ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/league/8d1b540d-f28c-42be-abe2-26d21893fd55`, { waitUntil: "networkidle" })
  ok("league page phone: no page h-scroll", (await noHScroll(p)) === 0)
  const gb = await p.locator("th", { hasText: /^GB$/ }).count()
  ok("GB/STRK columns exist on phone now", gb >= 1, `${gb} GB headers`)
  const hdr = p.locator("h2, h3").filter({ hasText: "Standings" }).first()
  await hdr.evaluate((el) => el.scrollIntoView({ block: "start" })).catch(() => {})
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${SHOTS}/r4-phone-standings.png` })
  await ctx.close()
}

// ---- 4. Signups: cards on phone, table on desktop ----
{
  const ctx = await browser.newContext({ storageState: owner, viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.goto(`${BASE}${FORCE}/tryouts/e4066347-a208-4a5d-9696-6e0d1d814747/signups`, { waitUntil: "networkidle" })
  ok("signups phone: no page h-scroll", (await noHScroll(p)) === 0)
  const cards = await p.locator("details").count()
  ok("signups render as cards on phone", cards >= 10, `${cards} cards`)
  const table = await p.locator("table").isVisible().catch(() => false)
  ok("table hidden on phone", !table)
  await p.locator("details").first().click()
  await p.waitForTimeout(300)
  const email = await p.locator("text=@sportshub.demo").first().isVisible().catch(() => false)
  ok("expanded card shows full untruncated email", email)
  await p.screenshot({ path: `${SHOTS}/r5-phone-signup-cards.png` })
  await ctx.close()

  const d = await browser.newContext({ storageState: owner, viewport: { width: 1280, height: 900 } })
  const dp = await d.newPage()
  await dp.goto(`${BASE}${FORCE}/tryouts/e4066347-a208-4a5d-9696-6e0d1d814747/signups`, { waitUntil: "networkidle" })
  ok("desktop signups still a table", await dp.locator("table").isVisible())
  await d.close()
}

// ---- 5. Customize: ▲▼ on phone, drag on desktop ----
{
  const ctx = await browser.newContext({ storageState: owner, viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.goto(`${BASE}${FORCE}/customize`, { waitUntil: "networkidle" })
  await p.waitForTimeout(600)
  const ups = await p.locator('button[aria-label="Move up"]:visible').count()
  ok("customize phone: ▲▼ reorder buttons visible", ups >= 3, `${ups} rows`)
  const drags = await p.locator('button[aria-label="Drag to reorder"]:visible').count()
  ok("customize phone: drag handles hidden", drags === 0)
  ok("customize phone: no page h-scroll", (await noHScroll(p)) === 0)
  await p.screenshot({ path: `${SHOTS}/r6-phone-customize.png` })
  await ctx.close()
}

await browser.close()
const fails = results.filter((r) => r.startsWith("FAIL"))
console.log(`\n${results.length - fails.length}/${results.length} checks passed`)
process.exit(fails.length ? 1 : 0)
