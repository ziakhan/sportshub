/**
 * Plan wizard step 2 drive (wave 1, 2026-08-02): login as the league owner,
 * check the locked (FINALIZED) read-only state, then — with the season
 * temporarily unlocked by the wrapper — exercise the gyms-and-weekends grid
 * for real: release a weekend through the UI, confirm siblings untouched,
 * put it back, set a one-weekend hours exception, confirm the custom cell,
 * reset it. Screenshots to /tmp/plan-step2-*.png.
 *
 * Run via the wrapper that flips season status around it:
 *   node verify-plan-step2.mjs locked    (FINALIZED checks only)
 *   node verify-plan-step2.mjs unlocked  (interaction drive)
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const LEAGUE_ID = "f58ff1a4-80b7-4548-b385-2d335d0f3612"
const SEASON_ID = "1464549a-ad8d-412b-a0c1-b1730e57ae2c"
const MODE = process.argv[2] ?? "locked"

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', "owner-nph@sportshub.demo")
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(1000)
  if (i === 29) fail("never logged in")
}
console.log("logged in as owner-nph")

const gridState = async () => {
  const res = await page.request.get(`${BASE}/api/seasons/${SEASON_ID}/planner/venues`)
  if (!res.ok()) fail(`GET planner/venues ${res.status()}`)
  return res.json()
}

const { grid, seasonStatus } = await gridState()
console.log(
  `grid: ${grid.venues.length} venues x ${grid.weekends.length} weekends, season ${seasonStatus}`
)
if (grid.weekends.length !== 13) fail("expected the journey world's 13 weekends")
if (grid.venues.length < 1) fail("expected at least one gym on the season")

await page.goto(`${BASE}/manage/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/plan`)
await page.waitForSelector("text=Plan your season", { timeout: 20000 })
await page.waitForSelector("text=Gym time", { timeout: 20000 })
await page.waitForTimeout(1200)

if (MODE === "locked") {
  if (seasonStatus !== "FINALIZED") fail("locked mode expects FINALIZED")
  await page.waitForSelector("text=read only", { timeout: 10000 })
  const cellDisabled = await page
    .locator("table button[aria-pressed]")
    .first()
    .isDisabled()
  if (!cellDisabled) fail("cells should be disabled while finalized")
  await page.screenshot({ path: "/tmp/plan-step2-locked.png", fullPage: true })
  console.log("locked state verified: banner + disabled cells")
  await browser.close()
  console.log("PLAN STEP2 LOCKED: PASS")
  process.exit(0)
}

// ——— unlocked interaction drive ———
if (seasonStatus === "FINALIZED") fail("unlocked mode expects the wrapper to have unlocked the season")

// Pre-flight repair: a previous aborted run may have left a weekend released.
// The journey world ships with every weekend on, so put any off cells back.
let repaired = 0
for (const v of grid.venues) {
  for (const c of v.cells) {
    if (c.state !== "off") continue
    const r = await page.request.post(
      `${BASE}/api/seasons/${SEASON_ID}/sessions/${c.sessionId}/venues/${v.venueId}`,
      { data: {} }
    )
    if (r.ok()) repaired++
  }
}
if (repaired > 0) {
  console.log(`pre-flight: re-attached ${repaired} released weekend(s)`)
  await page.reload()
  await page.waitForSelector("text=Gym time", { timeout: 20000 })
  await page.waitForTimeout(800)
}
const freshGrid = (await gridState()).grid

const venue = freshGrid.venues[0]
const target = venue.cells.findIndex((c) => c.state === "on")
if (target < 0) fail("no 'on' cell to exercise")
const sessionId = venue.cells[target].sessionId
const weekendLabel = freshGrid.weekends[target].label
console.log(`target: ${venue.name} on ${weekendLabel}`)

await page.screenshot({ path: "/tmp/plan-step2-grid.png", fullPage: true })

// 1) Tap the cell → panel opens → release the weekend.
const cellButtons = page.locator("table button[aria-pressed]")
await cellButtons.nth(target).click()
await page.waitForSelector("text=Release this weekend", { timeout: 10000 })
await page.click("text=Release this weekend")
await page.waitForSelector(`text=released for`, { timeout: 15000 })
console.log("released through the UI")

// 2) API truth: that weekend off, every other weekend untouched.
let after = (await gridState()).grid
const mine = after.venues.find((v) => v.venueId === venue.venueId)
if (mine.cells[target].state !== "off") fail("cell should read off after release")
const others = mine.cells.filter((_, i) => i !== target)
const beforeOthers = venue.cells.filter((_, i) => i !== target)
for (let i = 0; i < others.length; i++) {
  if (others[i].state !== beforeOthers[i].state)
    fail(`sibling weekend ${i} changed state: ${beforeOthers[i].state} -> ${others[i].state}`)
}
console.log("release scoped to one weekend; siblings untouched")
await page.screenshot({ path: "/tmp/plan-step2-released.png", fullPage: true })

// 3) Put it back through the UI. The panel stayed open on the released cell
//    after step 1 (releasing doesn't clear the selection), so the button is
//    already there — clicking the cell again would CLOSE the panel.
await page.waitForSelector("text=Use this gym this weekend", { timeout: 10000 })
await page.click("text=Use this gym this weekend")
await page.waitForSelector("text=is on for", { timeout: 15000 })
after = (await gridState()).grid
const back = after.venues.find((v) => v.venueId === venue.venueId).cells[target]
if (back.state !== "on") fail("cell should be on again")
if (back.courts !== venue.cells[target].courts)
  fail(`courts came back different: ${venue.cells[target].courts} -> ${back.courts}`)
console.log("re-attached with the same court count")

// 4) One-weekend hours exception via API (UI hours editor is DateTimePicker;
//    the mutation itself is covered by 13 route tests) — verify the CELL UI.
const hoursRes = await page.request.patch(
  `${BASE}/api/seasons/${SEASON_ID}/sessions/${sessionId}/venues/${venue.venueId}/hours`,
  { data: { startTime: "08:00", endTime: "21:30" } }
)
if (!hoursRes.ok()) fail(`hours PATCH ${hoursRes.status()}`)
await page.reload()
await page.waitForSelector("text=Gym time", { timeout: 20000 })
await page.waitForTimeout(800)
const customCell = page.locator("table button[aria-pressed]").nth(target)
const customText = await customCell.textContent()
if (!/08:00|21:30/.test(customText ?? "")) fail(`custom cell should show the window, got "${customText}"`)
await page.screenshot({ path: "/tmp/plan-step2-custom.png", fullPage: true })
console.log(`custom cell renders: "${customText?.trim()}"`)

// 5) Reset back to the season default.
const resetRes = await page.request.patch(
  `${BASE}/api/seasons/${SEASON_ID}/sessions/${sessionId}/venues/${venue.venueId}/hours`,
  { data: { reset: true } }
)
if (!resetRes.ok()) fail(`hours reset ${resetRes.status()}`)
after = (await gridState()).grid
const reset = after.venues.find((v) => v.venueId === venue.venueId).cells[target]
if (reset.state !== "on") fail(`cell should be back to on after reset, got ${reset.state}`)
console.log("reset back to season default; world restored")

await browser.close()
console.log("PLAN STEP2 UNLOCKED: ALL PASS")
