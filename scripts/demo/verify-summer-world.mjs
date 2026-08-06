// Runtime verification for the NPH Summer World (scripts/seed-summer-world.ts).
//
// Drives, as real users:
//   · summer-parent-lords@ — social feed with cards, bell, offers
//   · public Toronto Lords club page — programs + reviews + announcements
//   · summer-ref-mike@ — an upcoming assignment
//   · the league page — tonight's game on the schedule
//   · owner-nph@ — the Showcase planner still loads untouched
//
// Usage: node scripts/demo/verify-summer-world.mjs
// Screenshots land in $SHOTS_DIR (default ./shots-summer).
import { chromium } from "playwright"
import { login as repoLogin } from "./login-lib.mjs"
import fs from "node:fs"

const BASE = process.env.BASE || "http://localhost:3000"
const SHOTS = process.env.SHOTS_DIR || "shots-summer"
const SHOWCASE_SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"
const SHOWCASE_LEAGUE = "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
fs.mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (label, pass, detail = "") => {
  results.push(`${pass ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`)
  console.log(results[results.length - 1])
}


/** Dev-server navigations can exceed 30s under compile load — retry once. */
async function go(page, url, waitMs = 0) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 })
      if (waitMs) await page.waitForTimeout(waitMs)
      return true
    } catch (e) {
      if (attempt === 2) throw e
      await page.waitForTimeout(2000)
    }
  }
}

// Repo recipe (.claude/skills/verify): fill after hydration, submit with
// Enter, then POLL /api/auth/session until the login is actually live —
// snapshotting storageState any earlier captures a session-less context.
async function login(browser, email, password = "TestPass123!") {
  const file = `${SHOTS}/session-${email.replace(/[^a-z0-9]/gi, "_")}.json`
  if (fs.existsSync(file)) return file
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  p.setDefaultNavigationTimeout(120000)
  let live = false
  for (let attempt = 0; attempt < 3 && !live; attempt++) {
    live = await repoLogin(p, BASE, email, password).catch(() => false)
    if (!live) await p.waitForTimeout(3000)
  }
  if (!live) throw new Error(`login never became live for ${email}`)
  await ctx.storageState({ path: file })
  await ctx.close()
  return file
}

const browser = await chromium.launch()

// ── 1. The demo parent: feed, bell, offers ────────────────────────────
{
  const session = await login(browser, "summer-parent-lords@sportshub.demo")
  const ctx = await browser.newContext({ storageState: session, viewport: { width: 1280, height: 1100 } })
  const page = await ctx.newPage()

  const feed = await (await page.request.get(`${BASE}/api/feed`)).json().catch(() => null)
  const items = feed?.items ?? feed?.data?.items ?? []
  ok("parent feed returns items", items.length > 0, `${items.length} items`)

  await go(page, `${BASE}/feed`)
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${SHOTS}/01-parent-feed.png`, fullPage: false })
  const feedText = await page.locator("body").innerText()
  ok("feed page renders content", feedText.length > 400, `${feedText.length} chars`)

  await go(page, `${BASE}/offers`)
  await page.waitForTimeout(6000)
  await page.waitForFunction(() => !/Loading offers/.test(document.body.innerText), { timeout: 60000 }).catch(() => {})
  const offersText = await page.locator("body").innerText()
  ok("parent has a pending fall offer", /Lords/i.test(offersText) && !/Loading offers/.test(offersText),
    offersText.replace(/\n+/g, " · ").slice(0, 150))
  await page.screenshot({ path: `${SHOTS}/02-parent-offers.png`, fullPage: true })
  await ctx.close()
}

// ── 2. Public club page: programs + reviews + announcements ───────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } })
  const page = await ctx.newPage()
  await go(page, `${BASE}/club/nphj-toronto-lords`)
  await page.waitForTimeout(3500)
  const text = await page.locator("body").innerText()
  ok("club page shows the club", /Toronto Lords/i.test(text))
  ok("club page shows a program (camp/tryout)", /Camp|Tryout|Skills/i.test(text))
  ok("club page shows reviews", /review|rating|★|out of 5/i.test(text))
  ok("club page shows an announcement", /Practice times|Fall registration|Announcement/i.test(text))
  await page.screenshot({ path: `${SHOTS}/03-club-lords.png`, fullPage: true })
  await ctx.close()
}

// ── 3. Referee: an upcoming assignment ────────────────────────────────
{
  const session = await login(browser, "summer-ref-mike@sportshub.demo")
  const ctx = await browser.newContext({ storageState: session, viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  await go(page, `${BASE}/referee`)
  await page.waitForTimeout(6000)
  await page.waitForFunction(() => !/Loading/.test(document.body.innerText), { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const text = await page.locator("body").innerText()
  ok("referee has a pending shift offer", /Summer League|referee|09:00/i.test(text) && !/Loading/.test(text),
    text.replace(/\n+/g, " · ").slice(0, 140))
  ok("referee availability is declared", !/No upcoming availability/i.test(text))
  await page.screenshot({ path: `${SHOTS}/04-ref-mike.png`, fullPage: true })
  await go(page, `${BASE}/dashboard`)
  await page.waitForTimeout(5000)
  const dashText = await page.locator("body").innerText()
  ok("referee dashboard lists assigned games", /Grade (9|10)/.test(dashText), dashText.replace(/\n+/g, " · ").slice(0, 160))
  await page.screenshot({ path: `${SHOTS}/04b-ref-mike-dashboard.png`, fullPage: true })
  await ctx.close()
}

// ── 3b. News surface: every item is a card with a cover ───────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } })
  const page = await ctx.newPage()
  await go(page, `${BASE}/news`)
  await page.waitForTimeout(4000)
  const text = await page.locator("body").innerText()
  ok("news surface carries summer stories", /Summer|Championship Weekend|standings/i.test(text))
  const imgs = await page.locator("img").count()
  ok("news items render cover images", imgs > 3, `${imgs} images`)
  await page.screenshot({ path: `${SHOTS}/07-news.png`, fullPage: false })
  await ctx.close()
}

// ── 4. Tonight's game ─────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const res = await page.request.get(`${BASE}/api/games?today=1`).catch(() => null)
  void res
  await go(page, `${BASE}/scores`)
  await page.waitForTimeout(3500)
  const text = await page.locator("body").innerText()
  const today = new Date()
  const dayName = today.toLocaleDateString("en-CA", { weekday: "long" })
  ok("scores page has live/today games", /LIVE|Today|Final/i.test(text), dayName)
  ok("tonight's game is on the board", /TODAY[\s\S]{0,400}7:30 PM/i.test(text))
  await page.screenshot({ path: `${SHOTS}/05-scores-today.png`, fullPage: false })

  // Walk into tonight's game page — the live-scoring demo starting point.
  const links = page.locator('a[href^="/live/"]')
  const n = await links.count()
  let opened = false
  for (let i = 0; i < n; i++) {
    const t = await links.nth(i).innerText().catch(() => "")
    if (/7:30 PM/.test(t)) {
      const href = await links.nth(i).getAttribute("href")
      await go(page, `${BASE}${href}`)
      opened = true
      break
    }
  }
  if (opened) {
    for (let i = 0; i < 3; i++) {
      const clear = await page
        .waitForFunction(() => !/Loading[.…]/.test(document.body.innerText), { timeout: 60000 })
        .then(() => true).catch(() => false)
      if (clear) break
      await go(page, page.url())
    }
    await page.waitForTimeout(3000)
    const gameText = await page.locator("body").innerText()
    const todayLabel = today.toLocaleDateString("en-CA", { month: "long", day: "numeric" })
    const todayShort = today.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
    ok("game page is TONIGHT's game", /7:30/.test(gameText) && (gameText.includes(todayLabel) || gameText.includes(todayShort)),
      `${todayLabel} · ${page.url()}`)
    await page.screenshot({ path: `${SHOTS}/08-tonights-game.png`, fullPage: true })
  } else {
    ok("game page is TONIGHT's game", false, "no 7:30 PM card link found")
  }
  await ctx.close()
}

// ── 5. The Showcase planner is untouched ──────────────────────────────
{
  const session = await login(browser, "owner-nph@sportshub.demo")
  const ctx = await browser.newContext({ storageState: session, viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const res = await page.request.get(`${BASE}/api/seasons/${SHOWCASE_SEASON}/planner`)
  ok("Showcase planner API still 200s", res.status() === 200, `HTTP ${res.status()}`)
  const plans = await (await page.request.get(`${BASE}/api/seasons/${SHOWCASE_SEASON}/plans`)).json()
  const names = (plans?.plans ?? plans ?? []).map((x) => x.name)
  // The summer world must never remove or rename a Showcase plan. (Count is
  // NOT asserted — the owner adds plans while testing.)
  const KEEP = ["NPH plan", "New Plan", "Our plan", "Our plan 6"]
  ok("Showcase plans all survive", KEEP.every((n) => names.includes(n)), JSON.stringify(names))
  const active = (plans?.plans ?? []).find((x) => x.isActive)
  ok("the active Showcase plan is still NPH plan", active?.name === "NPH plan", active?.name ?? "none")
  await go(page, `${BASE}/manage/leagues/${SHOWCASE_LEAGUE}/seasons/${SHOWCASE_SEASON}/planner`)
  for (let i = 0; i < 3; i++) {
    const clear = await page
      .waitForFunction(() => !/Loading your grades/.test(document.body.innerText), { timeout: 60000 })
      .then(() => true).catch(() => false)
    if (clear) break
    await go(page, page.url())
  }
  await page.waitForTimeout(5000)
  const boardText = await page.locator("body").innerText()
  ok("Showcase planner board still renders", /Grade|weekend|gym/i.test(boardText) && !/Loading your grades/.test(boardText), `${boardText.length} chars`)
  await page.screenshot({ path: `${SHOTS}/06-planner-untouched.png`, fullPage: true })
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => r.startsWith("FAIL"))
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exit(1)
