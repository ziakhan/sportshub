/**
 * Schedule board drive (owner 2026-08-02: "show a day view or a gym view or
 * maybe somehow if you can combine them both to see where you see them
 * playing on which venue").
 *
 * READ-ONLY end to end — it logs in, switches the schedule tab to the board
 * and looks at it. Nothing is previewed, committed, published or patched;
 * every click is local view state.
 *
 * Run: node scripts/demo/verify-schedule-board.mjs
 * Screenshots: /tmp/schedule-board.png (+ -gym, -sunday).
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const LEAGUE = "f58ff1a4-80b7-4548-b385-2d335d0f3612"
const SEASON = "1464549a-ad8d-412b-a0c1-b1730e57ae2c"
const EMAIL = "owner-nph@sportshub.demo"

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(1000)
  if (i === 29) fail("never logged in")
}
console.log(`logged in as ${EMAIL}`)

// The season's committed games, straight from the console's own endpoint —
// the board must agree with this, not with a number typed into the drive.
const games = (await page.request.get(`${BASE}/api/seasons/${SEASON}/schedule`).then((r) => r.json()))
  .games
if (!games?.length) fail("the journey season has no committed games to board")
const dayOf = (g) => {
  const d = new Date(g.scheduledAt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const byDay = new Map()
for (const g of games) {
  if (!byDay.has(dayOf(g))) byDay.set(dayOf(g), [])
  byDay.get(dayOf(g)).push(g)
}
const dayKeys = [...byDay.keys()].sort()
const today = dayOf({ scheduledAt: new Date() })
const openingDay = dayKeys.find((k) => k >= today) ?? dayKeys[0]
const openingGames = byDay.get(openingDay)
const openingCourts = new Set(openingGames.map((g) => g.courtId)).size
const openingGyms = new Set(openingGames.map((g) => g.venueId)).size
console.log(
  `season holds ${games.length} games over ${dayKeys.length} days; ` +
    `the board should open on ${openingDay}: ${openingGames.length} games, ` +
    `${openingGyms} gym(s), ${openingCourts} courts`
)
if (openingGames.length < 20) fail(`opening day has only ${openingGames.length} games`)

await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage?tab=schedule`)
await page.waitForSelector("text=Generate the schedule", { timeout: 30000 })
// Whole-season mode so the board holds every weekend (view state only —
// no request leaves the page).
await page.click("button:has-text('Whole season at once')")
await page.waitForTimeout(400)
await page.click('[data-games-view="board"]')
await page.waitForSelector("[data-schedule-board]", { timeout: 20000 })
await page.waitForTimeout(600)

// ── 1. Day chips: one per day that has games, grouped by weekend ────────
const dayChips = await page.locator("[data-day-chip]").count()
if (dayChips !== dayKeys.length) fail(`expected ${dayKeys.length} day chips, got ${dayChips}`)
const pressedDay = await page
  .locator('[data-day-chip][aria-pressed="true"]')
  .first()
  .getAttribute("data-day-chip")
if (pressedDay !== openingDay) fail(`board opened on ${pressedDay}, expected ${openingDay}`)
const weekendGroups = await page.locator("[data-day-chip]").evaluateAll(
  (els) => new Set(els.map((e) => e.closest("div.rounded-xl"))).size
)
console.log(`day picker: ${dayChips} day chips in ${weekendGroups} weekend groups, open on ${pressedDay}`)
if (weekendGroups < 5) fail("day chips are not grouped by weekend")

// ── 2. The board: gyms over courts, times down the side ─────────────────
const gymHeaders = await page.locator("[data-gym-header]").count()
const courtColumns = await page.locator("[data-court-column]").count()
const chips = await page.locator("[data-game-chip]").count()
console.log(`board: ${gymHeaders} gym header(s), ${courtColumns} court columns, ${chips} game chips`)
if (gymHeaders !== openingGyms) fail(`expected ${openingGyms} gym header(s), got ${gymHeaders}`)
if (courtColumns !== openingCourts) fail(`expected ${openingCourts} court columns, got ${courtColumns}`)
if (chips < 20) fail(`expected at least 20 game chips, got ${chips}`)
if (chips !== openingGames.length) fail(`board shows ${chips} chips for ${openingGames.length} games`)
const timeRows = await page.locator("[data-time-row]").count()
const startTimes = new Set(
  openingGames.map((g) => {
    const d = new Date(g.scheduledAt)
    return d.getHours() * 60 + d.getMinutes()
  })
).size
console.log(`time rows: ${timeRows} tip-off times down the gutter`)
if (timeRows !== startTimes) fail(`expected ${startTimes} time rows, got ${timeRows}`)

// Every game has a court in this world, so the Unassigned column must NOT
// be there — it appears only when it has something to hold.
if ((await page.locator('[data-court-column="unassigned"]').count()) > 0)
  fail("Unassigned column rendered with no unassigned games")

// Double-headers are marked, not left to be spotted.
const marked = await page.locator("[data-game-chip]:has-text('²')").count()
console.log(`double-header marks on ${marked} chips`)
if (marked === 0) fail("teams play twice on this day but no chip is marked")

await page.locator("[data-board-root]").scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.locator("[data-board-root]").screenshot({ path: "/tmp/schedule-board.png" })

// ── 3. Gym filter narrows the columns ──────────────────────────────────
const gymChips = await page.locator("[data-gym-chip]").count()
if (gymChips !== openingGyms + 1) fail(`expected "All gyms" + ${openingGyms} gym chip(s)`)
const gymId = [...new Set(openingGames.map((g) => g.venueId))][0]
await page.click(`[data-gym-chip="${gymId}"]`)
await page.waitForTimeout(400)
const narrowedColumns = await page.locator("[data-court-column]").count()
const narrowedChips = await page.locator("[data-game-chip]").count()
const inThatGym = openingGames.filter((g) => g.venueId === gymId)
const courtsInThatGym = new Set(inThatGym.map((g) => g.courtId)).size
if (narrowedColumns !== courtsInThatGym)
  fail(`gym filter left ${narrowedColumns} columns, that gym has ${courtsInThatGym}`)
if (narrowedChips !== inThatGym.length)
  fail(`gym filter left ${narrowedChips} chips, that gym hosts ${inThatGym.length} games`)
if ((await page.locator("[data-gym-header]").count()) > 0)
  fail("the gym header row must collapse once a single gym is picked")
console.log(
  `gym filter: one gym → ${narrowedColumns} columns / ${narrowedChips} chips, headers collapsed`
)
await page.locator("[data-board-root]").screenshot({ path: "/tmp/schedule-board-gym.png" })
await page.click('[data-gym-chip="all"]')
await page.waitForTimeout(300)
if ((await page.locator("[data-court-column]").count()) !== openingCourts)
  fail("All gyms did not restore every column")

// ── 4. Another day rebuilds the columns from that day's data ───────────
const quietDay = dayKeys.find((k) => {
  const gs = byDay.get(k)
  return new Set(gs.map((g) => g.courtId)).size < openingCourts
})
if (quietDay) {
  await page.click(`[data-day-chip="${quietDay}"]`)
  await page.waitForTimeout(400)
  const expectCourts = new Set(byDay.get(quietDay).map((g) => g.courtId)).size
  const gotColumns = await page.locator("[data-court-column]").count()
  const gotChips = await page.locator("[data-game-chip]").count()
  if (gotColumns !== expectCourts) fail(`${quietDay}: expected ${expectCourts} columns, got ${gotColumns}`)
  if (gotChips !== byDay.get(quietDay).length)
    fail(`${quietDay}: expected ${byDay.get(quietDay).length} chips, got ${gotChips}`)
  console.log(`${quietDay}: board rebuilt to ${gotColumns} columns / ${gotChips} chips`)
  await page.locator("[data-board-root]").screenshot({ path: "/tmp/schedule-board-quiet.png" })
}

// ── 4b. The toggle goes back: the list is untouched ────────────────────
await page.click('[data-games-view="list"]')
await page.waitForTimeout(400)
if ((await page.locator("[data-schedule-board]").count()) > 0) fail("List still shows the board")
const listRows = await page.locator("button:has-text('vs')").count()
if (listRows < 20) fail(`the games list came back with ${listRows} rows`)
console.log(`back to List: ${listRows} rows, board gone`)
await page.click('[data-games-view="board"]')
await page.waitForSelector("[data-schedule-board]", { timeout: 10000 })

// ── 5. Phone: the board scrolls sideways, the PAGE never does ──────────
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(500)
await page.locator("[data-board-root]").scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
const overflow = await page.evaluate(() => ({
  page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  board: (() => {
    const grid = document.querySelector("[data-schedule-board]")
    const box = grid?.parentElement
    return box ? box.scrollWidth - box.clientWidth : 0
  })(),
  chipHeight: Math.min(
    ...[...document.querySelectorAll("[data-game-chip]")].map((c) => c.getBoundingClientRect().height)
  ),
}))
console.log(
  `phone 390px: page overflow ${overflow.page}px, board scroller ${overflow.board}px, ` +
    `smallest chip ${overflow.chipHeight}px tall`
)
if (overflow.page > 1) fail(`the page scrolls sideways on a phone (${overflow.page}px)`)
if (overflow.board <= 0) fail("the board did not become horizontally scrollable on a phone")
if (overflow.chipHeight < 44) fail(`chips are ${overflow.chipHeight}px tall, under the 44px target`)
await page.screenshot({ path: "/tmp/schedule-board-phone.png" })
await page.setViewportSize({ width: 1500, height: 1000 })

// ── 6. A season with no schedule says so ───────────────────────────────
const EMPTY_LEAGUE = "96427e92-349a-469f-99fc-76167e09cf06"
const EMPTY_SEASON = "bc8e5950-1012-4550-b977-c0c072b2da04"
await page.goto(`${BASE}/manage/leagues/${EMPTY_LEAGUE}/seasons/${EMPTY_SEASON}/manage?tab=schedule`)
await page.waitForSelector("text=Generate the schedule", { timeout: 30000 })
await page.click('[data-games-view="board"]')
await page.waitForSelector("text=No schedule yet", { timeout: 10000 })
if ((await page.locator("[data-schedule-board]").count()) > 0)
  fail("an empty season should show words, not an empty grid")
console.log("empty season: board says No schedule yet")

// ── 7. Nothing moved ───────────────────────────────────────────────────
const after = (await page.request.get(`${BASE}/api/seasons/${SEASON}/schedule`).then((r) => r.json()))
  .games
if (after.length !== games.length) fail("the drive changed the schedule")
const same = after.every((g, i) => g.id === games[i].id && g.scheduledAt === games[i].scheduledAt)
if (!same) fail("the drive moved a game")
console.log("read-only confirmed: every game is where it was")

await browser.close()
console.log("SCHEDULE BOARD: ALL PASS")
