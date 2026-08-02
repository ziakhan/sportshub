/**
 * Plan wizard step 2 drive (wave 2, 2026-08-02): the gyms-and-weekends grid
 * after the owner's rulings — EVERY weekend of the season, month by month,
 * one-tap cells, and one from-to range per gym.
 *
 *   locked   (season FINALIZED) every weekend of Oct through Feb is drawn,
 *            the official ones on, the rest off and dashed, all cells disabled
 *   unlocked one-tap a weekend the season does not have -> the session is
 *            created and the gym attached with the card's hours; one-tap it
 *            off; edit the gym's hours through the UI and watch every weekend
 *            follow; set and clear a one-weekend exception. Self-restoring:
 *            the session it created is deleted, hours are put back, and the
 *            13 official weekends are never touched.
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

/** NPH's real 2026-27 calendar, as the journey world seeds it. */
const OFFICIAL_SATS = [
  "2026-10-24", "2026-10-31", "2026-11-14", "2026-11-21", "2026-11-28",
  "2026-12-12", "2026-12-19", "2027-01-09", "2027-01-16", "2027-01-30",
  "2027-02-06", "2027-02-13", "2027-02-20",
]
const FINALS_SATS = ["2027-02-27", "2027-03-06", "2027-03-13"]

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const satOf = (w) => (w.satDateISO ? w.satDateISO.slice(0, 10) : null)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

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
const realWeekends = grid.weekends.filter((w) => w.sessionId)
const virtualWeekends = grid.weekends.filter((w) => !w.sessionId)
const months = [...new Set(grid.weekends.map((w) => w.month))]
console.log(
  `grid: ${grid.venues.length} gym(s) x ${grid.weekends.length} weekends ` +
    `(${realWeekends.length} real, ${virtualWeekends.length} not created yet), months ${months.join(" ")}, season ${seasonStatus}`
)

// ——— the shape both modes rely on ———
if (grid.venues.length < 1) fail("expected at least one gym on the season")
for (const sat of OFFICIAL_SATS) {
  const w = grid.weekends.find((x) => satOf(x) === sat)
  if (!w) fail(`official weekend ${sat} is missing from the grid`)
  if (!w.sessionId) fail(`official weekend ${sat} lost its session`)
}
if (virtualWeekends.length === 0) fail("no un-created weekends: the grid is still only the sessions")
for (const m of ["Oct", "Nov", "Dec", "Jan", "Feb"]) {
  if (!months.includes(m)) fail(`month ${m} missing from the strip`)
}

const PLAN_URL = `${BASE}/manage/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/plan?step=2`
await page.goto(PLAN_URL)
await page.waitForSelector("text=Plan your season", { timeout: 20000 })
await page.waitForSelector("text=Gym time", { timeout: 20000 })
await page.waitForTimeout(1200)

// The month band the owner asked for is really rendered.
for (const m of ["Oct", "Nov", "Dec", "Jan", "Feb"]) {
  const header = page.locator(`th[scope="colgroup"]:text-is("${m}")`)
  if ((await header.count()) === 0) fail(`month header ${m} not rendered`)
}
console.log(`month headers rendered: ${months.join(" ")}`)

if (MODE === "locked") {
  if (seasonStatus !== "FINALIZED") fail("locked mode expects FINALIZED")
  await page.waitForSelector("text=read only", { timeout: 10000 })

  const venue = grid.venues[0]
  for (const [i, w] of grid.weekends.entries()) {
    const cell = venue.cells[i]
    const sat = satOf(w)
    if (w.sessionId && cell.state === "off") fail(`${sat}: a weekend the season has reads off`)
    if (!w.sessionId && cell.state !== "off") fail(`${sat}: an un-created weekend reads ${cell.state}`)
  }
  const officialOn = OFFICIAL_SATS.every((sat) => {
    const i = grid.weekends.findIndex((w) => satOf(w) === sat)
    return i >= 0 && venue.cells[i].state !== "off"
  })
  if (!officialOn) fail("an official weekend is not on")
  console.log(
    `all ${realWeekends.length} weekends the season has read on; all ${virtualWeekends.length} others read off`
  )

  const cells = page.locator("table button[aria-pressed]")
  if (!(await cells.first().isDisabled())) fail("cells should be disabled while finalized")
  if ((await cells.count()) !== grid.weekends.length)
    fail(`expected ${grid.weekends.length} cells, rendered ${await cells.count()}`)
  // Hours read as a fact, not an editor, while the season is locked.
  if ((await page.locator("text=Available").count()) === 0) fail("the hours fact is missing")
  await page.screenshot({ path: "/tmp/plan-step2-locked.png", fullPage: true })
  console.log("locked state verified: every weekend drawn, official ones on, cells disabled")
  await browser.close()
  console.log("PLAN STEP2 LOCKED: PASS")
  process.exit(0)
}

// ——— unlocked interaction drive ———
if (seasonStatus === "FINALIZED") fail("unlocked mode expects the wrapper to have unlocked the season")

const venueId = grid.venues[0].venueId
const venueName = grid.venues[0].name
const seasonVenueId = grid.venues[0].seasonVenueId

const putHours = async (hours) => {
  const res = await page.request.put(
    `${BASE}/api/seasons/${SEASON_ID}/venues/${seasonVenueId}/hours`,
    { data: { hours } }
  )
  if (!res.ok()) fail(`PUT season venue hours ${res.status()}`)
}

// The seed ships this gym with posted hours and NO season override, so the
// way back is: push the posted window onto every day row, then drop the
// override again.
const posted = (dow) => grid.venues[0].postedHours.find((h) => h.dayOfWeek === dow)
const postedSat = posted(6)
const postedSun = posted(0) ?? postedSat
if (!postedSat?.openTime) fail("the gym has no posted weekend hours to restore to")
const restoreHours = async () => {
  await putHours([
    { dayOfWeek: 6, openTime: postedSat.openTime, closeTime: postedSat.closeTime },
    { dayOfWeek: 0, openTime: postedSun.openTime, closeTime: postedSun.closeTime },
  ])
  await putHours([
    { dayOfWeek: 6, openTime: null, closeTime: null },
    { dayOfWeek: 0, openTime: null, closeTime: null },
  ])
}

// Pre-flight repair: a previous aborted run may have left a weekend off or a
// session of its own behind. The journey world ships with every weekend it
// has fully on and exactly 16 sessions.
let repaired = 0
for (const [i, w] of grid.weekends.entries()) {
  const cell = grid.venues[0].cells[i]
  const sat = satOf(w)
  const official = OFFICIAL_SATS.includes(sat) || FINALS_SATS.includes(sat)
  if (w.sessionId && !official) {
    const res = await page.request.delete(
      `${BASE}/api/seasons/${SEASON_ID}/sessions?sessionId=${w.sessionId}`
    )
    if (res.ok()) repaired++
    continue
  }
  if (w.sessionId && cell.state === "off") {
    const res = await page.request.post(
      `${BASE}/api/seasons/${SEASON_ID}/sessions/${w.sessionId}/venues/${venueId}`,
      { data: {} }
    )
    if (res.ok()) repaired++
  }
}
if (repaired > 0) console.log(`pre-flight: repaired ${repaired} weekend(s) from an earlier run`)
await restoreHours()

const reload = async () => {
  await page.reload()
  await page.waitForSelector("text=Gym time", { timeout: 20000 })
  await page.waitForTimeout(900)
  return (await gridState()).grid
}

let live = await reload()
const baselineReal = live.weekends.filter((w) => w.sessionId).length
const baselineOn = live.venues[0].cells.filter((c) => c.state !== "off").length
console.log(`baseline: ${baselineReal} weekends the season has, ${baselineOn} cells on`)
await page.screenshot({ path: "/tmp/plan-step2-grid.png", fullPage: true })

const cellButtons = page.locator("table button[aria-pressed]")

// 1) ONE TAP on a weekend the season does not have: the session is created
//    and the gym goes on with the card's hours. No panel, no second click.
const targetIdx = live.weekends.findIndex((w) => !w.sessionId)
if (targetIdx < 0) fail("no un-created weekend to tap")
const targetSat = satOf(live.weekends[targetIdx])
console.log(`target: ${venueName} on ${live.weekends[targetIdx].label} (no session yet)`)

await cellButtons.nth(targetIdx).click()
await page.waitForSelector("text=is on for", { timeout: 20000 })
live = (await gridState()).grid

const created = live.weekends.find((w) => satOf(w) === targetSat)
if (!created?.sessionId) fail("one tap did not create the weekend")
const createdIdx = live.weekends.findIndex((w) => satOf(w) === targetSat)
const createdCell = live.venues[0].cells[createdIdx]
if (createdCell.state !== "on") fail(`created weekend reads ${createdCell.state}`)
if (createdCell.dayCount !== 2 || createdCell.daysOn !== 2) fail("created weekend is not a full Sat+Sun")
if (createdCell.courts !== live.venues[0].cells[0].courts && createdCell.courts < 1)
  fail("created weekend came with no courts")
if (createdCell.startTime !== live.venues[0].simpleOpen || createdCell.endTime !== live.venues[0].simpleClose)
  fail(
    `created weekend did not inherit the card's hours: ${createdCell.startTime}-${createdCell.endTime} vs ${live.venues[0].simpleOpen}-${live.venues[0].simpleClose}`
  )
const createdSessionId = created.sessionId
console.log(
  `one tap created the weekend + attached ${venueName}: ${createdCell.courts} courts, ${createdCell.startTime}-${createdCell.endTime}`
)

// The 13 official weekends never moved.
const officialIntact = (g) =>
  OFFICIAL_SATS.every((sat) => {
    const i = g.weekends.findIndex((w) => satOf(w) === sat)
    return i >= 0 && g.weekends[i].sessionId && g.venues[0].cells[i].state !== "off"
  })
if (!officialIntact(live)) fail("an official weekend changed while creating a new one")
await page.screenshot({ path: "/tmp/plan-step2-created.png", fullPage: true })

// 2) ONE TAP again turns it off. The session stays (capacity 0), nothing else moves.
await page.reload()
await page.waitForSelector("text=Gym time", { timeout: 20000 })
await page.waitForTimeout(900)
await cellButtons.nth(createdIdx).click()
await page.waitForSelector("text=is off for", { timeout: 20000 })
live = (await gridState()).grid
const offCell = live.venues[0].cells[live.weekends.findIndex((w) => satOf(w) === targetSat)]
if (offCell.state !== "off") fail(`cell should read off, got ${offCell.state}`)
if (!live.weekends.some((w) => w.sessionId === createdSessionId)) fail("the session was deleted on toggle off")
if (!officialIntact(live)) fail("an official weekend changed while toggling off")
console.log("one tap off released the gym and kept the weekend at capacity 0")

// Clean up the session this drive created — the journey world owns 16.
const del = await page.request.delete(
  `${BASE}/api/seasons/${SEASON_ID}/sessions?sessionId=${createdSessionId}`
)
if (!del.ok()) fail(`could not delete the session the drive created (${del.status()})`)
live = await reload()
if (live.weekends.filter((w) => w.sessionId).length !== baselineReal)
  fail("session count did not come back to baseline")
console.log("created session deleted; the season is back to its own weekends")

// 3) The simple hours range, through the UI: one from-to, every weekend follows.
const originalOpen = live.venues[0].simpleOpen
const originalClose = live.venues[0].simpleClose
const hoursGroup = page.getByRole("group", { name: `${venueName} availability` })

const setPicker = async (which, hour) => {
  await hoursGroup.getByRole("button").nth(which).click()
  await page.waitForSelector('select[aria-label="Hour"]', { timeout: 10000 })
  await page.selectOption('select[aria-label="Hour"]', String(hour))
  await page.click('button:has-text("Done")')
  await page.waitForTimeout(300)
}
await setPicker(0, 7)
await setPicker(1, 22)
await page.click('button:has-text("Save hours")')
// The notice, not the card's standing hint: waiting on "every weekend" alone
// matches copy that is always on screen and reads the grid mid-write.
await page.waitForSelector("text=runs 07:00 to 22:00 every weekend", { timeout: 20000 })
live = (await gridState()).grid
if (live.venues[0].simpleOpen !== "07:00" || live.venues[0].simpleClose !== "22:00")
  fail(`card hours did not save: ${live.venues[0].simpleOpen}-${live.venues[0].simpleClose}`)
const stragglers = live.venues[0].cells.filter(
  (c) => c.state !== "off" && (c.startTime !== "07:00" || c.endTime !== "22:00")
)
if (stragglers.length > 0) fail(`${stragglers.length} weekend(s) kept the old hours`)
if (live.venues[0].cells.some((c) => c.state === "custom"))
  fail("changing the season hours should not leave a weekend reading custom")
console.log(`hours edited on the card propagated to all ${baselineOn} weekends that are on`)
await page.screenshot({ path: "/tmp/plan-step2-hours.png", fullPage: true })

// 4) The quiet exception path still works: one weekend, different hours.
await page.reload()
await page.waitForSelector("text=Gym time", { timeout: 20000 })
await page.waitForTimeout(900)
await page.click("text=One weekend runs different hours?")
await page.waitForSelector('select[aria-label="Weekend with different hours"]', { timeout: 10000 })
const exceptionKey = await page
  .locator('select[aria-label="Weekend with different hours"] option')
  .first()
  .getAttribute("value")
const exceptionIdx = live.weekends.findIndex((w) => w.key === exceptionKey)
if (exceptionIdx < 0) fail("the exception picker offered a weekend the grid does not have")

const panel = page.locator("div").filter({ hasText: "Pick the weekend that runs different hours" }).last()
await panel.getByRole("button").filter({ hasText: ":" }).first().click()
await page.waitForSelector('select[aria-label="Hour"]', { timeout: 10000 })
await page.selectOption('select[aria-label="Hour"]', "9")
await page.click('button:has-text("Done")')
await page.waitForTimeout(300)
await panel.getByRole("button").filter({ hasText: ":" }).nth(1).click()
await page.waitForSelector('select[aria-label="Hour"]', { timeout: 10000 })
await page.selectOption('select[aria-label="Hour"]', "18")
await page.click('button:has-text("Done")')
await page.waitForTimeout(300)
await page.click('button:has-text("Save these hours")')
await page.waitForSelector("text=keeps your usual hours", { timeout: 20000 })

live = (await gridState()).grid
const exCell = live.venues[0].cells[live.weekends.findIndex((w) => w.key === exceptionKey)]
if (exCell.state !== "custom") fail(`the exception weekend reads ${exCell.state}, expected custom`)
if (exCell.startTime !== "09:00" || exCell.endTime !== "18:00")
  fail(`exception window is ${exCell.startTime}-${exCell.endTime}`)
if (live.venues[0].cells.filter((c) => c.state === "custom").length !== 1)
  fail("the exception leaked to other weekends")
const amber = await page.locator("table button[aria-pressed]").nth(exceptionIdx).textContent()
if (!/09:00|18:00/.test(amber ?? "")) fail(`the custom cell should show its window, got "${amber}"`)
console.log(`one-weekend exception set and visible on the cell: "${amber?.trim()}"`)
await page.screenshot({ path: "/tmp/plan-step2-custom.png", fullPage: true })

await page.click('button:has-text("Back to your usual hours")')
await page.waitForSelector("text=back on your usual hours", { timeout: 20000 })
live = (await gridState()).grid
if (live.venues[0].cells.some((c) => c.state === "custom")) fail("the exception did not reset")
console.log("exception cleared; every weekend is back on the one range")

// 5) Restore the world: the season's hours go back to what the seed shipped.
await restoreHours()
live = (await gridState()).grid

const finalReal = live.weekends.filter((w) => w.sessionId).length
const finalOn = live.venues[0].cells.filter((c) => c.state !== "off").length
if (finalReal !== baselineReal) fail(`weekend count drifted: ${baselineReal} -> ${finalReal}`)
if (finalOn !== baselineOn) fail(`cells on drifted: ${baselineOn} -> ${finalOn}`)
if (!officialIntact(live)) fail("an official weekend did not survive the drive")
const wrongHours = live.venues[0].cells.filter(
  (c) => c.state !== "off" && (c.startTime !== originalOpen || c.endTime !== originalClose)
)
if (wrongHours.length > 0) fail(`${wrongHours.length} weekend(s) kept the drive's hours`)
console.log(
  `world restored: ${finalReal} weekends, ${finalOn} on, all at ${originalOpen}-${originalClose}`
)

await browser.close()
console.log("PLAN STEP2 UNLOCKED: ALL PASS")
