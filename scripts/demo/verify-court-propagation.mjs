/**
 * Courts reach the weekends (bug the owner hit live, 2026-08-02): the season's
 * court count was edited and planner capacity never moved, because capacity is
 * built from the SeasonSessionDayVenueCourt rows that were wired ONCE when the
 * gym was attached. Step 3 then painted red over a plan that had the courts.
 *
 * This drive uses the NEW step-2 courts control on the journey world and reads
 * the answer where it matters — GET /api/seasons/[id]/planner, weekend
 * capacityGames:
 *
 *   A  raise the count -> every weekend follows, capacity rises exactly in
 *      proportion; put it back -> capacity returns to the baseline number
 *   B  lower it under a scheduled game -> that court stays on THAT day, the
 *      operator is told, and the days with no game there still rewire
 *
 * Why not the literal 5 -> 6 of the bug report: this world ships with
 * SeasonVenue.courtsAvailable = 5 while all 32 weekend days are wired with 6
 * courts — the drift the bug produces. Asking for 6 is a no-op against that
 * wiring, so the drive proves the same thing one court higher (6 -> 7 -> 6)
 * and adds the blocked-by-games case the world can actually show.
 *
 * Self-restoring: the auto-created Court 7 is deleted, the count is put back
 * to 6-wired, and the wrapper resets courtsAvailable + season status.
 *
 * Run (season must be unlocked first — see the wrapper in the task notes):
 *   node scripts/demo/verify-court-propagation.mjs
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const LEAGUE_ID = "f58ff1a4-80b7-4548-b385-2d335d0f3612"
const SEASON_ID = "1464549a-ad8d-412b-a0c1-b1730e57ae2c"

const fail = (msg) => {
  console.error("FAIL:", msg)
  throw new Error(msg)
}

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

/** sessionId -> capacityGames, the number step 3 paints and step 5 measures. */
const capacityMap = async () => {
  const res = await page.request.get(`${BASE}/api/seasons/${SEASON_ID}/planner`)
  if (!res.ok()) fail(`GET planner ${res.status()}`)
  const { state, seasonStatus } = await res.json()
  const out = new Map()
  for (const win of state.windows) for (const w of win.weekends) out.set(w.sessionId, w.capacityGames)
  return { caps: out, seasonStatus }
}

const wiredCourts = (grid, venueId) => {
  const row = grid.venues.find((v) => v.venueId === venueId)
  return row.cells.filter((c) => c.state !== "off").map((c) => c.courts)
}

let venueId = null
let seasonVenueId = null
let venueName = null
let restoreNeeded = false

try {
  const first = await gridState()
  if (first.seasonStatus === "FINALIZED")
    fail("the season is still FINALIZED — the wrapper must flip it to REGISTRATION first")

  const row = first.grid.venues.find((v) => /six park/i.test(v.name)) ?? first.grid.venues[0]
  venueId = row.venueId
  seasonVenueId = row.seasonVenueId
  venueName = row.name
  const baseCourts = wiredCourts(first.grid, venueId)
  const baseCount = baseCourts[0]
  if (!baseCourts.every((c) => c === baseCount)) fail(`weekends disagree on courts: ${baseCourts}`)

  const { caps: baseCaps } = await capacityMap()
  const baseTotal = [...baseCaps.values()].reduce((a, b) => a + b, 0)
  console.log(
    `baseline: ${venueName}, season count ${row.courtsAvailable}, ${baseCourts.length} live weekends ` +
      `wired with ${baseCount} courts, total capacity ${baseTotal} games`
  )

  const PLAN_URL = `${BASE}/manage/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/plan?step=2`
  await page.goto(PLAN_URL)
  await page.waitForSelector("text=Gym time", { timeout: 20000 })
  await page.waitForTimeout(1000)

  const courtsInput = page.locator(`input[aria-label="${venueName} courts"]`)
  if ((await courtsInput.count()) === 0) fail("the courts control is not on the gym card")

  /** Set the count through the UI exactly the way the operator does. */
  const setCourts = async (n) => {
    restoreNeeded = true
    await courtsInput.fill(String(n))
    await page.click('button:has-text("Save courts")')
    await page.waitForSelector(`text=now runs ${n} court`, { timeout: 30000 })
    const el = page.locator('[data-testid="step2-notice"]').first()
    const notice = await el.textContent()
    const tone = await el.getAttribute("data-tone")
    await page.waitForTimeout(400)
    return { text: notice?.trim() ?? "", tone }
  }

  // ——— A. raise the count: every weekend follows, capacity rises ———
  const up = baseCount + 1
  const noticeUp = await setCourts(up)
  console.log(`notice (${noticeUp.tone}): "${noticeUp.text}"`)
  if (!noticeUp.text.includes(`${venueName} now runs ${up} courts, every weekend updated.`))
    fail(`the notice does not say what happened: "${noticeUp.text}"`)
  if (noticeUp.tone !== "court") fail("a clean save should read green")

  let live = (await gridState()).grid
  const upCourts = wiredCourts(live, venueId)
  if (!upCourts.every((c) => c === up))
    fail(`only ${upCourts.filter((c) => c === up).length}/${upCourts.length} weekends took ${up} courts`)

  const { caps: upCaps } = await capacityMap()
  let moved = 0
  for (const [sessionId, base] of baseCaps) {
    const now = upCaps.get(sessionId) ?? 0
    const expected = (base / baseCount) * up
    if (now !== expected) fail(`weekend ${sessionId}: capacity ${base} -> ${now}, expected ${expected}`)
    if (now > base) moved++
  }
  const upTotal = [...upCaps.values()].reduce((a, b) => a + b, 0)
  if (moved === 0) fail("no weekend gained capacity — the court edit never reached the planner")
  console.log(
    `${up} courts: ${moved} weekends rose, total capacity ${baseTotal} -> ${upTotal} ` +
      `(exactly ${up}/${baseCount} of the baseline)`
  )
  await page.screenshot({ path: "/tmp/court-propagation-up.png", fullPage: true })

  // Back down to the baseline count: the same numbers, exactly.
  await setCourts(baseCount)
  live = (await gridState()).grid
  if (!wiredCourts(live, venueId).every((c) => c === baseCount)) fail("weekends did not come back down")
  const { caps: backCaps } = await capacityMap()
  for (const [sessionId, base] of baseCaps) {
    if ((backCaps.get(sessionId) ?? 0) !== base)
      fail(`weekend ${sessionId}: capacity did not return (${base} -> ${backCaps.get(sessionId)})`)
  }
  console.log(`back at ${baseCount} courts: capacity restored to ${baseTotal} games`)

  // The court the raise auto-created is not part of this world.
  const created = (live.venues.find((v) => v.venueId === venueId)?.courts ?? []).find(
    (c) => c.name === `Court ${up}`
  )
  if (created) {
    const del = await page.request.delete(`${BASE}/api/venues/${venueId}/courts/${created.id}`)
    if (!del.ok()) fail(`could not delete the auto-created ${created.name} (${del.status()})`)
    console.log(`auto-created ${created.name} deleted; the gym is back to ${baseCount} courts`)
  }

  // ——— B. lower it under scheduled games: blocked per day, and said out loud ———
  const down = baseCount - 1
  const noticeDown = await setCourts(down)
  console.log(`notice (${noticeDown.tone}): "${noticeDown.text}"`)
  if (!/because a game is already scheduled there/.test(noticeDown.text))
    fail(`a season full of scheduled games should have blocked days: "${noticeDown.text}"`)
  if (/every weekend updated/.test(noticeDown.text))
    fail("a partly-blocked save must not claim every weekend updated")
  if (noticeDown.tone !== "gold") fail("a partly-blocked save should read amber, not green")

  live = (await gridState()).grid
  const mixed = wiredCourts(live, venueId)
  const kept = mixed.filter((c) => c === baseCount).length
  const dropped = mixed.filter((c) => c === down).length
  if (kept === 0) fail("no weekend kept its court despite games being on it")
  if (dropped === 0) fail("no weekend rewired — the whole season cannot be blocked")
  console.log(
    `${down} courts asked for: ${dropped} weekends rewired, ${kept} kept ${baseCount} courts ` +
      `because a game is on the one being pulled`
  )
  await page.screenshot({ path: "/tmp/court-propagation-blocked.png", fullPage: true })

  // ——— restore ———
  await setCourts(baseCount)
  live = (await gridState()).grid
  const finalCourts = wiredCourts(live, venueId)
  if (!finalCourts.every((c) => c === baseCount)) fail(`weekends left at ${finalCourts}`)
  const { caps: finalCaps } = await capacityMap()
  for (const [sessionId, base] of baseCaps) {
    if ((finalCaps.get(sessionId) ?? 0) !== base)
      fail(`weekend ${sessionId} did not survive the drive (${base} -> ${finalCaps.get(sessionId)})`)
  }
  const finalVenueCourts = live.venues.find((v) => v.venueId === venueId)?.courts.length
  console.log(
    `world restored: ${finalCourts.length} live weekends at ${baseCount} courts, ` +
      `${finalVenueCourts} courts at the gym, total capacity ${baseTotal} games`
  )
  restoreNeeded = false

  await browser.close()
  console.log("COURT PROPAGATION: ALL PASS")
} catch (error) {
  console.error(error.message)
  if (restoreNeeded && seasonVenueId) {
    console.error("attempting to put the court count back before exiting…")
    await page.request
      .patch(`${BASE}/api/seasons/${SEASON_ID}/venues/${seasonVenueId}`, {
        data: { courtsAvailable: 6 },
      })
      .catch(() => null)
  }
  await browser.close()
  process.exit(1)
}
