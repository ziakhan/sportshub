/**
 * Plan wizard step 3 drive (wave 3, 2026-08-02). Two runs, no world damage:
 *
 *   node verify-plan-step3.mjs locked
 *     The NPH journey season (FINALIZED, official calendar saved): the old
 *     /planner URL redirects into the wizard, the board opens on the SAVED
 *     calendar, the header pill reads the plan, and nothing can be moved.
 *     Read-only end to end: the three levers are exercised through the
 *     propose endpoint, which saves nothing.
 *
 *   node verify-plan-step3.mjs drive
 *     A scratch season built through the API as the platform admin (grades,
 *     a gym, four weekends across two months), driven for real: the board
 *     opens ALREADY holding a recommendation with nothing saved, a grade is
 *     moved by tapping it and tapping a weekend, saving it as the season's
 *     first plan persists it, a reload proves it, a lever makes it dirty
 *     again, and the whole scratch world is torn down afterwards.
 *
 * Re-pinned 2026-08-02 for plans as documents: the single "Keep this
 * calendar" button is now the plan save controls (save-as-new / save-plan),
 * and a season with no plans yet takes the first one saved as its calendar.
 *
 * Screenshots to /tmp/plan-step3-*.png.
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const MODE = process.argv[2] ?? "locked"

// The NPH journey world (locked run).
const NPH = {
  leagueId: "f58ff1a4-80b7-4548-b385-2d335d0f3612",
  seasonId: "1464549a-ad8d-412b-a0c1-b1730e57ae2c",
  email: "owner-nph@sportshub.demo",
}

// A DRAFT season with nothing in it (drive run). The drive builds its own
// grades/gym/weekends here and removes them again; season status is never
// touched, because finalization is one-way through the API.
const SCRATCH = {
  leagueId: "415d4332-84ae-41e3-927a-5a4832df43f6",
  seasonId: "8d427814-2c4d-4692-b29b-0173224e7aa5",
  email: "admin@sportshub.demo",
  // That league's own venue, which already has its courts: the drive never
  // creates courts on a shared venue.
  venueId: "9e6b53fa-dc5e-43d0-ab0d-ad4be78529ed",
  courtCount: 2,
  grades: [
    { ageGroup: "S3Alpha", teams: 8 },
    { ageGroup: "S3Bravo", teams: 6 },
    { ageGroup: "S3Charlie", teams: 4 },
  ],
  // Two month windows, two weekends each: a grade can be moved WITHIN a
  // window, which is the only move the plan allows.
  weekends: [
    ["2027-09-11", "2027-09-12"],
    ["2027-09-25", "2027-09-26"],
    ["2027-10-09", "2027-10-10"],
    ["2027-10-23", "2027-10-24"],
  ],
}

const target = MODE === "locked" ? NPH : SCRATCH

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', target.email)
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(1000)
  if (i === 29) fail("never logged in")
}
console.log(`logged in as ${target.email}`)

const plannerState = async () => {
  const res = await page.request.get(`${BASE}/api/seasons/${target.seasonId}/planner`)
  if (!res.ok()) fail(`GET planner ${res.status()}`)
  return res.json()
}

/** Which weekends hold a grade right now, straight off the board. */
const whereOnBoard = (grade) =>
  page.evaluate((g) => {
    const out = []
    document.querySelectorAll("[data-session-id]").forEach((card) => {
      const hit = [...card.querySelectorAll("button[aria-label]")].some((b) =>
        (b.getAttribute("aria-label") ?? "").startsWith(`${g} on `)
      )
      if (hit) out.push(card.getAttribute("data-session-id"))
    })
    return out
  }, grade)

const whereInApi = (state, grade) =>
  state.windows
    .flatMap((w) => w.weekends)
    .filter((w) => w.assigned.includes(`age:${grade}`))
    .map((w) => w.sessionId)

const openBoard = async () => {
  await page.goto(`${BASE}/manage/leagues/${target.leagueId}/seasons/${target.seasonId}/plan?step=3`)
  await page.waitForSelector("text=Plan your season", { timeout: 20000 })
  await page.waitForSelector("[data-session-id]", { timeout: 20000 })
  await page.waitForTimeout(600)
}

const headTitle = async () =>
  (await page.locator(".border-b p.font-bold").first().textContent())?.trim()

// ——————————————————————————————— locked ———————————————————————————————
if (MODE === "locked") {
  const data = await plannerState()
  if (data.seasonStatus !== "FINALIZED") fail("locked mode expects a FINALIZED season")
  const weekends = data.state.windows.flatMap((w) => w.weekends)
  console.log(
    `state: ${data.state.units.length} grades, ${data.state.windows.length} windows, ` +
      `${weekends.length} weekends, ${data.suggestions.length} suggestions`
  )
  if (weekends.length < 10) fail("expected the journey world's 13 weekends")
  if (!weekends.some((w) => w.assigned.length > 0)) fail("journey season should have a saved plan")

  // The old board URL is now a doorway into the wizard.
  await page.goto(`${BASE}/manage/leagues/${target.leagueId}/seasons/${target.seasonId}/planner`)
  await page.waitForURL(/\/plan\?step=3$/, { timeout: 20000 })
  console.log("old /planner URL redirects to /plan?step=3")
  await page.waitForSelector("[data-session-id]", { timeout: 20000 })
  await page.waitForTimeout(800)

  // A saved calendar is not a proposal.
  const title = await headTitle()
  if (title !== "Your calendar") fail(`saved plan should read "Your calendar", got "${title}"`)
  await page.waitForSelector("text=read only", { timeout: 10000 })

  const chips = await page.locator("[data-session-id] span[draggable]").count()
  const draggable = await page.locator('[data-session-id] span[draggable="true"]').count()
  console.log(`board renders ${chips} grade chips, ${draggable} of them draggable`)
  if (chips < 10) fail("expected the saved calendar's grade chips")
  if (draggable > 0) fail(`${draggable} chips still draggable on a finalized season`)
  const liveChip = await page.locator('[data-session-id] button[aria-label*=" on "]:not([disabled])').count()
  if (liveChip > 0) fail(`${liveChip} chips still tappable on a finalized season`)
  if ((await page.locator('[data-testid="save-as-new"], [data-testid="save-plan"]').count()) > 0)
    fail("a finalized season must not offer to save")
  // RE-PINNED 2026-08-06 (owner ruling #6): the lever disclosure is gone. The
  // one lever left is a button beside Redraw, and a finalized season draws
  // neither of them.
  if ((await page.locator('[data-testid="redraw-spread"], [data-testid="redraw"]').count()) > 0)
    fail("a finalized season must not offer to redraw")

  const pill = await page.locator("text=/All grades fit|weekends? tight|weekends? over|grades? not placed/").first().textContent()
  console.log(`header pill: ${pill?.trim()}`)
  const courts = await page.locator("[data-session-id] p:last-of-type").first().textContent()
  console.log(`first weekend meter: ${courts?.trim()}`)

  // Levers are read-only until Apply, so the locked run can still prove all
  // three solve without touching the world.
  for (const lever of ["balance", "compact", "spread"]) {
    const res = await page.request.post(`${BASE}/api/seasons/${target.seasonId}/planner/propose`, {
      data: { lever },
    })
    if (!res.ok()) fail(`propose ${lever} ${res.status()}`)
    const body = await res.json()
    const placements = Object.values(body.assignment).flat().length
    if (placements === 0) fail(`${lever} proposed nothing`)
    console.log(`propose ${lever}: ${placements} chip placements`)
  }
  const after = await plannerState()
  if (JSON.stringify(whereInApi(after.state, "Grade 7")) !== JSON.stringify(whereInApi(data.state, "Grade 7")))
    fail("proposing must never save")
  console.log("proposals saved nothing; the official calendar is untouched")

  // The lock must hold at the API, not just in the client: a finalized
  // season refuses apply and expected-team writes with 409.
  const applyRes = await page.request.post(`${BASE}/api/seasons/${target.seasonId}/planner/apply`, {
    data: { assignment: {} },
  })
  if (applyRes.status() !== 409) fail(`apply on FINALIZED should 409, got ${applyRes.status()}`)
  const patchRes = await page.request.patch(`${BASE}/api/seasons/${target.seasonId}/planner`, {
    data: { expected: [{ divisionId: "any", expectedTeams: 1 }] },
  })
  if (patchRes.status() !== 409) fail(`expected PATCH on FINALIZED should 409, got ${patchRes.status()}`)
  console.log("season lock holds at the API: apply 409, expected-teams 409")

  await page.screenshot({ path: "/tmp/plan-step3-locked.png", fullPage: true })
  await browser.close()
  console.log("PLAN STEP3 LOCKED: PASS")
  process.exit(0)
}

// ——————————————————————————————— drive ———————————————————————————————
const first = await plannerState()
if (["FINALIZED", "IN_PROGRESS", "COMPLETED"].includes(first.seasonStatus))
  fail("drive mode expects an editable season")

const divisionsUrl = `${BASE}/api/seasons/${target.seasonId}/divisions`
const sessionsUrl = `${BASE}/api/seasons/${target.seasonId}/sessions`
const venuesUrl = `${BASE}/api/seasons/${target.seasonId}/venues`
const scratchGrades = new Set(SCRATCH.grades.map((g) => g.ageGroup))

const listDivisions = async () =>
  (await page.request.get(divisionsUrl).then((r) => r.json())).divisions ?? []

/** Remove everything a drive creates — also the pre-flight for an aborted run. */
const teardown = async () => {
  const state = await plannerState()
  for (const win of state.state.windows) {
    for (const w of win.weekends) {
      const res = await page.request.delete(`${sessionsUrl}?sessionId=${w.sessionId}`)
      if (!res.ok()) console.error(`CLEANUP session ${w.sessionId}: ${res.status()}`)
    }
  }
  for (const d of await listDivisions()) {
    if (!scratchGrades.has(d.ageGroup)) continue
    const res = await page.request.delete(`${divisionsUrl}?divisionId=${d.id}`)
    if (!res.ok()) console.error(`CLEANUP division ${d.id}: ${res.status()}`)
  }
  const venues = await page.request.get(venuesUrl).then((r) => (r.ok() ? r.json() : { venues: [] }))
  for (const v of venues.venues ?? []) {
    if (v.venueId !== SCRATCH.venueId) continue
    const res = await page.request.delete(`${venuesUrl}?seasonVenueId=${v.id}`)
    if (!res.ok()) console.error(`CLEANUP season venue ${v.id}: ${res.status()}`)
  }
}

await teardown()
console.log("pre-flight: scratch season emptied")

// 1) Build a season worth planning: a gym, four weekends, three grades.
const venueRes = await page.request.post(venuesUrl, {
  data: {
    venueId: SCRATCH.venueId,
    courtCount: SCRATCH.courtCount,
    openTime: "09:00",
    closeTime: "13:00",
    addToSessions: false,
  },
})
if (!venueRes.ok()) fail(`attach venue ${venueRes.status()} ${await venueRes.text()}`)

for (const [sat, sun] of SCRATCH.weekends) {
  const res = await page.request.post(sessionsUrl, {
    data: {
      days: [
        { date: sat, startTime: "09:00", endTime: "13:00" },
        { date: sun, startTime: "09:00", endTime: "13:00" },
      ],
      venueId: SCRATCH.venueId,
      targetGamesPerTeam: 2,
    },
  })
  if (!res.ok()) fail(`create weekend ${sat}: ${res.status()} ${await res.text()}`)
}

const created = []
for (const g of SCRATCH.grades) {
  const res = await page.request.post(divisionsUrl, {
    data: { ageGroup: g.ageGroup, gender: "MALE", tier: 1 },
  })
  if (!res.ok()) fail(`create grade ${g.ageGroup}: ${res.status()} ${await res.text()}`)
  created.push({ id: (await res.json()).id, ...g })
}
const expectedRes = await page.request.patch(`${BASE}/api/seasons/${target.seasonId}/planner`, {
  data: { expected: created.map((c) => ({ divisionId: c.id, expectedTeams: c.teams })) },
})
if (!expectedRes.ok()) fail(`expected teams ${expectedRes.status()}`)
console.log(
  `scratch world: ${SCRATCH.weekends.length} weekends, ${created.length} grades ` +
    `(${created.map((c) => `${c.ageGroup} ${c.teams}`).join(", ")})`
)

try {
  const built = await plannerState()
  const weekends = built.state.windows.flatMap((w) => w.weekends)
  if (built.state.windows.length !== 2) fail(`expected 2 month windows, got ${built.state.windows.length}`)
  if (weekends.some((w) => w.capacityGames <= 0)) fail("every scratch weekend should have court capacity")
  if (weekends.some((w) => w.assigned.length > 0)) fail("a fresh season should have nothing saved")
  if (built.state.units.filter((u) => u.teams > 0).length !== SCRATCH.grades.length)
    fail(`expected ${SCRATCH.grades.length} grades with teams, got ${JSON.stringify(built.state.units)}`)
  console.log(
    `planner sees capacity ${weekends.map((w) => w.capacityGames).join("/")} games per weekend, ` +
      `${built.state.units.filter((u) => u.teams > 0).length} grades with teams, nothing saved yet`
  )

  // 2) The board OPENS on a recommendation. No click, no empty state.
  await openBoard()
  let title = await headTitle()
  if (title !== "Proposed calendar")
    fail(`an unsaved recommendation should read "Proposed calendar", got "${title}"`)
  await page.waitForSelector("text=We placed every grade for you", { timeout: 10000 })
  const openingChips = await page.locator('[data-session-id] span[draggable="true"]').count()
  if (openingChips < SCRATCH.grades.length * 2)
    fail(`expected every grade placed in both windows, got ${openingChips} chips`)
  // Nothing has ever been saved here, so the one save control offers to make
  // this the season's calendar.
  const keep = page.locator('[data-testid="save-as-new"]')
  if ((await keep.count()) !== 1 || (await keep.isDisabled()))
    fail("the opening recommendation should be savable")
  if ((await keep.innerText()) !== "Save this calendar")
    fail(`a season with no plans should offer to keep this one, got "${await keep.innerText()}"`)
  console.log(`opens on a recommendation: ${openingChips} chips placed, nothing saved`)
  await page.screenshot({ path: "/tmp/plan-step3-opened.png", fullPage: true })

  // The API still holds nothing: the opening plan is a proposal, not a save.
  if ((await plannerState()).state.windows.flatMap((w) => w.weekends).some((w) => w.assigned.length > 0))
    fail("opening on a recommendation must not write anything")

  // 3) One-tap move: tap the chip, tap the weekend.
  const grade = SCRATCH.grades[0].ageGroup
  const before = await whereOnBoard(grade)
  if (before.length !== 2) fail(`${grade} should sit on one weekend per window, got ${before.length}`)
  await page.locator(`button[aria-label^="${grade} on "]`).first().click()
  await page.waitForSelector("text=is ready to move", { timeout: 10000 })
  const moveButtons = page.locator(`button[aria-label^="Move ${grade} to "]`)
  const destinations = await moveButtons.count()
  if (destinations === 0) fail("arming a chip should offer somewhere to move it")
  // A grade plays one weekend a month, so the only destinations are the OTHER
  // weekends of its own month: 2 weekends per window here, so exactly one.
  if (destinations !== 1)
    fail(`moves must stay inside the month: expected 1 destination, got ${destinations}`)
  const destLabel = await moveButtons.first().getAttribute("aria-label")
  await page.screenshot({ path: "/tmp/plan-step3-armed.png", fullPage: true })
  await moveButtons.first().click()
  await page.waitForTimeout(400)
  const after = await whereOnBoard(grade)
  if (JSON.stringify(after) === JSON.stringify(before)) fail("the one-tap move changed nothing")
  if (after.length !== 2) fail(`${grade} should still play once a month, got ${after.length} weekends`)
  console.log(`one-tap move: ${destLabel} (${destinations} destination offered)`)
  if ((await page.locator("text=is ready to move").count()) > 0) fail("the chip stayed armed after moving")

  // Escape disarms.
  await page.locator(`button[aria-label^="${grade} on "]`).first().click()
  await page.waitForSelector("text=is ready to move", { timeout: 10000 })
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  if ((await page.locator("text=is ready to move").count()) > 0) fail("Escape did not disarm the chip")
  console.log("Escape disarms an armed chip")

  // 4) Keep it as this season's first plan, and check the API agrees.
  await keep.click()
  await page.waitForSelector('[data-testid="plan-name-input"]', { timeout: 10000 })
  await page.locator('[data-testid="plan-name-input"]').fill("Scratch plan")
  await page.locator('[data-testid="save-new-confirm"]').click()
  await page.waitForSelector("text=It is the calendar this season runs", { timeout: 20000 })
  const saved = await plannerState()
  const savedWhere = whereInApi(saved.state, grade).sort()
  if (JSON.stringify(savedWhere) !== JSON.stringify([...after].sort()))
    fail(`saved plan ${savedWhere} does not match the board ${after}`)
  console.log(`kept: ${grade} persisted onto ${savedWhere.length} weekends`)
  await page.screenshot({ path: "/tmp/plan-step3-saved.png", fullPage: true })

  // 5) A reload opens on the SAVED plan, not a fresh proposal.
  await openBoard()
  title = await headTitle()
  if (title !== "Your calendar") fail(`a saved plan should read "Your calendar", got "${title}"`)
  // Saved and unedited: nothing to write back, only the quiet copy.
  if ((await page.locator('[data-testid="save-plan"]').count()) > 0)
    fail("a saved, unedited board has nothing to keep")
  const reloaded = await whereOnBoard(grade)
  if (JSON.stringify(reloaded.sort()) !== JSON.stringify([...after].sort()))
    fail("the reloaded board lost the move")
  console.log("reload opens on the saved calendar")

  // 6) RE-PINNED 2026-08-06 (owner ruling #6): the levers were a row of chips
  // behind "adjust grouping rules", a phrase that described none of them. The
  // one that is genuinely a different answer is a button beside Redraw.
  await page.click('[data-testid="redraw-spread"]')
  await page.waitForSelector("text=every weekend of the season in use", { timeout: 20000 })
  // Dirty against the plan it came from, so it can be written straight back.
  if ((await page.locator('[data-testid="save-plan"]').count()) !== 1)
    fail("a lever proposal should be savable")
  if ((await headTitle()) !== "Proposed calendar") fail("a lever proposal should read as proposed")
  console.log("levers propose without saving")
  await page.screenshot({ path: "/tmp/plan-step3-levers.png", fullPage: true })

  await page.click("button:has-text('Undo changes')")
  await page.waitForTimeout(1200)
  const undone = await whereOnBoard(grade)
  if (JSON.stringify(undone.sort()) !== JSON.stringify([...after].sort()))
    fail("undo did not return to the saved calendar")
  if ((await page.locator('[data-testid="save-plan"]').count()) > 0)
    fail("after undo there is nothing to keep")
  console.log("undo returns to the saved calendar")

  // 7) The pill reads the plan.
  const pill = await page
    .locator("text=/All grades fit|weekends? tight|weekends? over|grades? not placed/")
    .first()
    .textContent()
  console.log(`header pill: ${pill?.trim()}`)
  if (!pill) fail("the header pill should always say something")
} finally {
  await teardown()
  console.log("scratch world removed; season is empty again")
}

await browser.close()
console.log("PLAN STEP3 DRIVE: ALL PASS")
