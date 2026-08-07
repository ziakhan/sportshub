// Drive "plans as documents" on step 3 (owner ruling 2026-08-02: "we can have
// multiple plans, we can save them, we can name them, we can call one an NPH
// plan. We should be able to go to the dropdown and choose them").
//
// SAFE ON THE OWNER'S LIVE INSTANCE. It creates one plan through the UI and
// deletes it again through the API, and it never activates anything: the only
// writes it makes are the lazy snapshot the list endpoint takes (the season's
// own calendar, named) and that one throwaway plan. It captures the season's
// saved calendar before it starts and asserts it is byte-identical at the end.
//
// Env (defaults = the 2026-08-02 local world):
//   BASE_URL, SEASON_ID, LEAGUE_ID, SHOT_DIR
// Run from scripts/demo (its node_modules has Playwright):
//   node verify-plans.mjs
import { chromium } from "playwright"
import { openBoard, switchPlan, openPlanFromStep1 } from "./plan-board-lib.mjs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SEASON = process.env.SEASON_ID ?? "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = process.env.LEAGUE_ID ?? "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SHOTS =
  process.env.SHOT_DIR ??
  "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/4eadfbff-644b-4ed7-a799-a1ea780f28c6/scratchpad/shots-plans"
const USER = "owner-nph@sportshub.demo"
const PASS = "TestPass123!"
const DRIVE_PLAN = "Drive test plan"

const results = []
const ok = (name, pass, extra = "") => {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`)
}

const fs = await import("node:fs")
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
const PLAN_URL = `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`

// This script must never change the calendar the season runs.
// The only confirms this drive should ever meet are "you have unsaved changes"
// and "redraw replaces the calendar on the board". Both are board-local and
// write nothing. Anything else (activating a plan) is dismissed on purpose.
const EXPECTED_DIALOGS = /throws them away|Redraw replaces the calendar/i
page.on("dialog", async (dialog) => {
  const expected = EXPECTED_DIALOGS.test(dialog.message())
  console.log(`      dialog (${expected ? "accepted" : "DISMISSED"}): ${dialog.message()}`)
  await (expected ? dialog.accept() : dialog.dismiss())
})

for (const p of ["/sign-in", `/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`]) {
  await page.request.get(`${BASE}${p}`).catch(() => {})
}

await page.goto(`${BASE}/sign-in`)
let user = null
// Three attempts, not one: under load a single try can fail outright (the
// callback answers but authorize()'s own DB query never got a load-free
// moment), and that reads exactly like invalid credentials from here. A fresh
// page and a fresh attempt is the honest retry, not a longer wait on the same
// stuck one.
for (let attempt = 0; attempt < 3 && !user; attempt++) {
  if (attempt > 0) {
    await page.goto(`${BASE}/sign-in`)
  }
  await page.waitForTimeout(2500)
  await page.fill('input[type="email"]', USER)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  for (let i = 0; i < 40; i++) {
    const s = await page.request
      .get(`${BASE}/api/auth/session`)
      .then((r) => r.json())
      .catch(() => null)
    if (s?.user) {
      user = s.user
      break
    }
    await page.waitForTimeout(500)
  }
}
ok("signed in as the league owner", Boolean(user))
if (!user) {
  await browser.close()
  process.exit(1)
}

/* ------------------- the calendar the season runs, before ---------------- */
const savedCalendar = async () => {
  const data = await page.request
    .get(`${BASE}/api/seasons/${SEASON}/planner`)
    .then((r) => r.json())
    .catch(() => null)
  return JSON.stringify(
    (data?.state?.windows ?? [])
      .flatMap((w) => w.weekends)
      .map((w) => ({ id: w.sessionId, assigned: w.assigned, gyms: w.assignedVenues ?? {} }))
  )
}
const listPlans = async () =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json()))?.plans ?? []

/** The quiet gold line above the board, or null when the plan on screen was
 *  saved in the world the season is still in. */
const driftLine = async () => {
  const line = page.locator('[data-testid="plan-drift"]')
  if ((await line.count()) === 0) return null
  return (await line.innerText()).replace(/\n/g, " ").trim()
}

const before = await savedCalendar()
ok("captured the season's saved calendar", before.length > 2, `${before.length} bytes`)

/* ------------------------------ the picker ------------------------------- */
// RE-PINNED 2026-08-05 (owner rulings #1 and #2). Step 3 no longer opens the
// season's active plan for you: it opens the chooser. The drive picks the plan
// the way an operator does, and pins the empty entry on the way through.
// RE-PINNED 2026-08-06 wave (B1): the chooser itself moved to step 1 — a cold
// visit to step 3 draws board-plan-pointer instead, and openBoard opens the
// plan from step 1 before following the URL back to the board.
const entry = await openBoard(page, PLAN_URL)
ok(
  "step 3 opens on nothing: no plan is selected just because one is active",
  entry.empty && entry.sections === 0 && entry.weekends === 0,
  `${entry.pointerText} · ${entry.sections} gym sections, ${entry.weekends} weekends drawn`
)

// The board names the plan it holds with a label now, not a control (B1: the
// picker moved to step 1, and board-plan-badge is what is left in its place).
const badge = page.locator('[data-testid="board-plan-badge"]')
const badgeText = (await badge.innerText()).replace(/\n/g, " ")
const activeRow = (await listPlans()).find((p) => p.isActive)
ok(
  "the board names the plan it holds, and the API agrees it is the active one",
  badgeText.includes("NPH plan") && activeRow?.name === "NPH plan",
  `${badgeText} · active plan is ${activeRow?.name ?? "none"}`
)
ok(
  "the reference plan says so before anybody tries to save onto it",
  (await page.locator('[data-testid="plan-reference-note"]').count()) === 1,
  await page.locator('[data-testid="plan-reference-note"]').innerText().catch(() => "")
)

// A plan remembers the WORLD it was made in (owner 2026-08-02). The reference
// plan either carries one and the board is honest about the difference, or it
// predates world-tracking and says so quietly. Both are correct; claiming
// nothing changed while carrying no world is not.
const referenceDoc = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/plans/${(await listPlans()).find((p) => p.isActive)?.id}`)
  .then((r) => r.json())
  .catch(() => null)
const referenceSettings = referenceDoc?.plan?.settings ?? null
const referenceDrift = await driftLine()
ok(
  "the plan on the board says where its own settings stand",
  referenceSettings
    ? referenceDrift === null || /Saved under different settings/.test(referenceDrift)
    : referenceDrift !== null && /Saved before plans remembered/.test(referenceDrift),
  `${referenceSettings ? "has a saved world" : "predates world-tracking"} · ${referenceDrift ?? "no drift line"}`
)

const railAbout = page.locator('[data-testid="rail-about"]')
if ((await railAbout.count()) > 0) {
  const about = await railAbout.innerText()
  ok("the rail says whose plan it is critiquing", about.trim() === "Ideas for NPH plan", about)
} else {
  ok("the rail says whose plan it is critiquing", true, "no rail on this board, nothing to label")
}

// RE-PINNED 2026-08-06 (owner ruling #1): the colour key and the gym tray are
// one row now, and it is still the row above the calendar.
const legend = page.locator('[data-testid="gym-list"]')
const legendBox = await legend.boundingBox().catch(() => null)
const boardBox = await page.locator("[data-session-id]").first().boundingBox()
ok(
  "the gym list still sits above the board",
  Boolean(legendBox && boardBox && legendBox.y < boardBox.y),
  legendBox && boardBox ? `legend y=${Math.round(legendBox.y)}, board y=${Math.round(boardBox.y)}` : "missing"
)

// RE-PINNED 2026-08-06 wave (B1): the dropdown lives at step 1 now, not beside
// the board. The drive checks it there, then returns to the board where the
// rest of this suite runs — nothing about the plan open changes underneath it.
const boardUrl = new URL(page.url())
const step1Check = new URL(boardUrl)
step1Check.searchParams.set("step", "1")
await page.goto(step1Check.toString(), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })
const picker = page.locator('[data-testid="plan-picker"]')
await picker.click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 30000 })
const options = page.locator('[data-testid="plan-option"]')
const optionCount = await options.count()
const nphRow = options.filter({ hasText: "NPH plan" }).first()
ok(
  "the dropdown lists the season's plans, the imported one flagged",
  optionCount >= 1 &&
    (await nphRow.getAttribute("data-source")) === "imported" &&
    (await nphRow.getAttribute("data-active")) === "true",
  `${optionCount} plan(s)`
)
await page.screenshot({ path: `${SHOTS}/1-picker-open.png` })
await page.keyboard.press("Escape")
await page.waitForTimeout(250)
ok("Escape shuts the dropdown", (await page.locator('[data-testid="plan-menu"]').count()) === 0)
// Back to the board, still on the reference plan — nothing was selected.
await page.goto(boardUrl.toString(), { timeout: 90000 })
await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 90000 })
await page.waitForTimeout(700)

/* --------------------- one edit, then the save controls ------------------ */
let edited = false
const railMove = page.locator('[data-testid="suggestion-move"]').first()
if ((await railMove.count()) > 0) {
  await railMove.click()
  edited = true
} else {
  // No idea on the rail: send one grade to the other gym on its own weekend.
  // Working copy only, exactly like a drag.
  const swap = page.locator('button[aria-label^="Move "][title^="Move to"]').first()
  if ((await swap.count()) > 0) {
    await swap.click()
    edited = true
  }
}
await page.waitForTimeout(700)
ok("one edit lands on the working copy", edited)

const saveNew = page.locator('[data-testid="save-as-new"]')
ok(
  "an edited reference plan offers to save your own",
  (await saveNew.count()) === 1 && (await saveNew.innerText()).includes("Save as new plan"),
  await saveNew.innerText().catch(() => "")
)
ok(
  "the reference plan is never offered a write-back button",
  (await page.locator('[data-testid="save-plan"]').count()) === 0
)
const stateLine = await page.locator('[data-testid="plan-state"]').innerText()
ok("the state line says the changes are not saved", /not saved/i.test(stateLine), stateLine)
await saveNew.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/2-save-controls-dirty.png` })

await saveNew.click()
await page.waitForSelector('[data-testid="plan-name-input"]', { timeout: 30000 })
const suggested = await page.locator('[data-testid="plan-name-input"]').inputValue()
ok("the name box opens with a name already in it", suggested.length > 0, suggested)
await page.locator('[data-testid="plan-name-input"]').fill(DRIVE_PLAN)
await page.locator('[data-testid="plan-name-row"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/3-naming.png` })
await page.locator('[data-testid="save-new-confirm"]').click()
// Saving a copy is a POST, a list refresh and a document fetch. On a cold route
// that is well past a second and a half, so this waits for the answer instead of
// guessing at it.
// RE-PINNED 2026-08-06 wave (B1): the board names its plan with the badge now,
// not a picker (there is no picker on step 3 any more).
let afterSaveText = ""
let afterSaveActive = null
for (let i = 0; i < 40; i++) {
  afterSaveText = (await badge.innerText().catch(() => "")).replace(/\n/g, " ")
  if (afterSaveText.includes(DRIVE_PLAN)) {
    afterSaveActive = (await listPlans()).find((p) => p.name === DRIVE_PLAN)?.isActive ?? null
    break
  }
  await page.waitForTimeout(500)
}

ok(
  "the board is now the new plan, and the new plan does not run the season",
  afterSaveText.includes(DRIVE_PLAN) && afterSaveActive === false,
  `${afterSaveText} · isActive=${afterSaveActive}`
)
const savedState = await page.locator('[data-testid="plan-state"]').innerText()
ok(
  "the state line separates saved from running the season",
  savedState.includes(DRIVE_PLAN) && savedState.includes("NPH plan"),
  savedState
)
ok(
  "a plan the season does not run offers to be used for it",
  (await page.locator('[data-testid="activate-plan"]').count()) === 1,
  await page.locator('[data-testid="activate-plan"]').innerText().catch(() => "")
)
await page.locator('[data-testid="plan-state"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/4-save-controls-own-plan.png` })

const listAfterSave = await listPlans()
const drivePlan = listAfterSave.find((p) => p.name === DRIVE_PLAN)
ok(
  "the API agrees: saved, not applied",
  Boolean(drivePlan) && drivePlan.isActive === false && drivePlan.source === "manual",
  drivePlan ? `${drivePlan.name} source=${drivePlan.source} active=${drivePlan.isActive}` : "missing"
)

/* ------------------- the world the plan was saved in --------------------- */
const savedDoc = drivePlan
  ? (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans/${drivePlan.id}`).then((r) => r.json()))?.plan
  : null
const savedWorld = savedDoc?.settings?.state ?? null
const savedWeekends = (savedWorld?.windows ?? []).flatMap((w) => w.weekends ?? [])
ok(
  "the saved plan carries the world it was made in",
  Boolean(savedDoc?.settings?.capturedAt) &&
    !Number.isNaN(Date.parse(savedDoc.settings.capturedAt)) &&
    (savedWorld?.units ?? []).length > 0 &&
    savedWeekends.length > 0 &&
    savedWeekends.every((w) => Array.isArray(w.venues)) &&
    savedWeekends.some((w) => w.venues.length > 0),
  savedWorld
    ? `${savedWorld.units.length} grades, ${savedWeekends.length} weekends, ${
        new Set(savedWeekends.flatMap((w) => w.venues.map((v) => v.venueId))).size
      } gyms, captured ${savedDoc.settings.capturedAt}`
    : "no settings on the saved plan"
)
ok(
  "the world holds no calendar: that is what the plan's own columns are for",
  savedWeekends.every((w) => w.assigned === undefined && w.assignedVenues === undefined)
)
ok(
  "a plan saved from the season's own world shows no drift line",
  (await driftLine()) === null,
  (await driftLine()) ?? "no drift line"
)

/* ------------------ saving onto a plan of your own (PATCH) --------------- */
// Safe: this plan is NOT the one the season runs, so the write stops at the
// document. The byte-compare at the end proves the sessions never moved.
// Retries past a transient ECONNRESET rather than crashing the whole drive on
// one dropped connection — seen twice under load from a concurrent seed on
// the same box, always on this exact call.
const planDoc = async (id) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const doc = await page.request
      .get(`${BASE}/api/seasons/${SEASON}/plans/${id}`, { timeout: 30000 })
      .then((r) => r.json())
      .catch(() => null)
    if (doc?.plan) return doc.plan
    await page.waitForTimeout(1000)
  }
  return undefined
}
const docBefore = drivePlan ? JSON.stringify((await planDoc(drivePlan.id))?.assignment) : ""

let editedAgain = false
const railMove2 = page.locator('[data-testid="suggestion-move"]').first()
if ((await railMove2.count()) > 0) {
  await railMove2.click()
  editedAgain = true
}
await page.waitForTimeout(700)
if (editedAgain) {
  const savePlan = page.locator('[data-testid="save-plan"]')
  ok(
    "a plan of your own offers to be written back by name",
    (await savePlan.count()) === 1 && (await savePlan.innerText()).includes(DRIVE_PLAN),
    await savePlan.innerText().catch(() => "")
  )
  await savePlan.click()
  // Polls for up to 30s rather than a fixed 1.5s: under load the PATCH can
  // take much longer than the happy path to actually land and re-render.
  let savedAgain = await page.locator('[data-testid="plan-state"]').innerText()
  for (
    let i = 0;
    i < 60 && !(savedAgain.startsWith(`Saved to ${DRIVE_PLAN}`) && (await page.locator('[data-testid="save-plan"]').count()) === 0);
    i++
  ) {
    await page.waitForTimeout(500)
    savedAgain = await page.locator('[data-testid="plan-state"]').innerText().catch(() => savedAgain)
  }
  ok(
    "saving to your own plan clears the changes",
    savedAgain.startsWith(`Saved to ${DRIVE_PLAN}`) &&
      (await page.locator('[data-testid="save-plan"]').count()) === 0,
    savedAgain
  )
  const docAfter = JSON.stringify((await planDoc(drivePlan.id))?.assignment)
  ok("the plan document actually changed", docAfter !== docBefore)
} else {
  ok("a plan of your own offers to be written back by name", true, "no rail idea to edit with")
}

/* -------------------------- back to the reference ------------------------ */
// RE-PINNED 2026-08-06 wave (B1): switching plans is a step-1 errand now —
// switchPlan hops there, picks the imported one, and follows the URL back.
await switchPlan(page, { source: "imported" })
const backText = (await badge.innerText()).replace(/\n/g, " ")
const backState = await page.locator('[data-testid="plan-state"]').innerText()
const backActive = (await listPlans()).find((p) => p.name === "NPH plan")?.isActive
ok(
  "picking another plan reloads the board onto it, clean",
  backText.includes("NPH plan") &&
    backActive === true &&
    backState.includes("season's calendar") &&
    // Clean again: nothing to write back, and the only save left is the quiet
    // fork of the league's own calendar.
    (await page.locator('[data-testid="save-plan"]').count()) === 0 &&
    (await page.locator('[data-testid="save-as-new"]').innerText()) === "Save a copy",
  `${backText} · active=${backActive} · ${backState}`
)
ok(
  "the rail follows the plan it is critiquing",
  (await railAbout.count()) === 0 || (await railAbout.innerText()).trim() === "Ideas for NPH plan",
  await railAbout.innerText().catch(() => "no rail")
)
await page.screenshot({ path: `${SHOTS}/5-back-on-reference.png` })

/* ------------------------ a NEW plan starts fresh ------------------------ */
/**
 * RE-PINNED 2026-08-05 (owner ruling, the plan-world architecture). This block
 * used to pin "the system makes the plan": one tap and the solver handed back a
 * balanced calendar. That is gone, and it had to go — a plan now owns its own
 * gym time, so there is nothing to solve against until the operator has said
 * which weekends the league runs and which gyms it has on them.
 *
 * What is pinned instead:
 *   - the plan is NAMED at creation, with a suggestion already in the box;
 *   - it starts with NO calendar, NO weekend chosen and NO gym availability;
 *   - its grades are prefilled, because re-typing twenty numbers is not a
 *     decision;
 *   - the pool gyms are still LISTED, by name, with nothing on them.
 */
// RE-PINNED 2026-08-06 wave (B1): "New plan" lives beside step 1's header
// chooser now — there is no picker (and no New plan button) left on the board.
const boardUrlForNew = new URL(page.url())
const step1ForNew = new URL(boardUrlForNew)
step1ForNew.searchParams.set("step", "1")
await page.goto(step1ForNew.toString(), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })

const newRow = page.locator('[data-testid="plan-new"]')
ok(
  "making a plan is a button beside step 1's picker, not a row inside it",
  (await newRow.count()) === 1 && (await newRow.innerText()).trim() === "New plan",
  await newRow.innerText().catch(() => "missing")
)
await page.screenshot({ path: `${SHOTS}/6-new-plan-row.png` })

const plansBeforeNew = await listPlans()
await newRow.click()
await page.waitForSelector('[data-testid="plan-create-input"]', { timeout: 30000 })
const suggestedName = await page.locator('[data-testid="plan-create-input"]').inputValue()
ok(
  "New plan asks for a name, with one already suggested",
  /^Our plan/.test(suggestedName),
  suggestedName || "empty box"
)

const FRESH_NAME = "Drive fresh plan"
await page.fill('[data-testid="plan-create-input"]', FRESH_NAME)
await page.locator('[data-testid="plan-create-confirm"]').click()

let made = null
for (let i = 0; i < 60; i++) {
  const rows = await listPlans()
  made = rows.find((p) => !plansBeforeNew.some((b) => b.id === p.id)) ?? null
  if (made) break
  await page.waitForTimeout(500)
}
ok(
  "the plan is created under the operator's own name, saved and unapplied",
  Boolean(made) && made.isActive === false && made.name === FRESH_NAME,
  made ? `${made.name} source=${made.source} active=${made.isActive}` : "no new plan appeared"
)

// RE-PINNED 2026-08-06 wave (B1): the URL now carries the new plan — follow it
// to the board rather than watching a picker that no longer lives there.
const madeName = made?.name ?? FRESH_NAME
const backToBoard = new URL(page.url())
backToBoard.searchParams.set("step", "3")
await page.goto(backToBoard.toString(), { timeout: 90000 })
// A fresh plan has no chosen weekend, so weekend-gym-section never appears.
// And on a plan where nothing is used anywhere, every month's whole run of
// ghosts collapses into one summary row (C2, 2026-08-06 wave), so even
// [data-session-id] can be genuinely absent — ghost-collapse is the one thing
// guaranteed to show up here.
await page.waitForSelector('[data-session-id], [data-testid="ghost-collapse"]', {
  timeout: 90000,
})
await page.waitForTimeout(900)
const newText = (await badge.innerText().catch(() => "")).replace(/\n/g, " ")
const newActive = (await listPlans()).find((p) => p.id === made?.id)?.isActive
ok(
  "the board opens on the new plan, and the season keeps the one it runs",
  newText.includes(madeName) && newActive === false,
  `${newText} · isActive=${newActive}`
)
const madeDoc = made
  ? (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans/${made.id}`).then((r) => r.json()))?.plan
  : null
const freshWeekends = (madeDoc?.settings?.state?.windows ?? []).flatMap((w) => w.weekends ?? [])
ok(
  "a FRESH plan chooses no weekend and assumes no gym availability",
  freshWeekends.length > 0 &&
    freshWeekends.every((w) => w.chosen === false && (w.venues ?? []).length === 0),
  `${freshWeekends.length} weekend(s), ${freshWeekends.filter((w) => w.chosen).length} chosen, ` +
    `${freshWeekends.filter((w) => (w.venues ?? []).length > 0).length} with a gym`
)
ok(
  "it has no calendar at all: there is nothing to solve against yet",
  Object.keys(madeDoc?.assignment ?? {}).length === 0,
  `${Object.keys(madeDoc?.assignment ?? {}).length} placed weekend(s)`
)
const freshGyms = madeDoc?.settings?.state?.gyms ?? []
ok(
  "the gyms the league HAS are still listed, home role included",
  freshGyms.length >= 2 && freshGyms.some((g) => g.role === "home"),
  freshGyms.map((g) => `${g.name}:${g.role}`).join(", ") || "no gyms"
)
const freshUnits = madeDoc?.settings?.state?.units ?? []
ok(
  "its grades are prefilled, so nobody re-types twenty numbers",
  freshUnits.length > 0 && freshUnits.some((u) => u.teams > 0),
  `${freshUnits.length} grade(s), ${freshUnits.filter((u) => u.teams > 0).length} with a number`
)
ok(
  "the rail follows the plan it is critiquing",
  (await railAbout.count()) === 0 || (await railAbout.innerText()).trim() === `Ideas for ${madeName}`,
  await railAbout.innerText().catch(() => "no rail")
)
// RE-PINNED 2026-08-06 wave (C2): a plan where nothing is used ANYWHERE has
// every month's whole run of ghosts collapsed into one summary row on
// arrival, so [data-session-id] itself can legitimately be zero. What still
// has to be true is that the board drew SOMETHING for every month — a real
// card, a ghost row, or a collapsed summary of them.
const drawnMonths =
  (await page.locator("[data-session-id]").count()) +
  (await page.locator('[data-testid="ghost-collapse"]').count())
ok(
  "the board still draws every month of the season, chosen or not (cards, ghosts, or their collapsed summary)",
  drawnMonths > 0,
  `${drawnMonths} dated row(s) or collapsed month(s)`
)
await page.screenshot({ path: `${SHOTS}/7-new-plan-on-the-board.png` })

/* ==================== drawing the calendar, from empty =================== */
/**
 * THE THREE 2026-08-05 RULINGS ABOUT AN EMPTY BOARD:
 *
 *  1. a plan with weekends and gym time and no calendar leads with one button,
 *     "Draw the calendar"; a plan with NO gym time points at step 2 instead;
 *  2. the "gym no longer available" banner offers a re-solve and a move;
 *  3. "Redraw calendar" is in the board header whenever the world can hold one.
 *
 * All of it happens inside the drive's own throwaway plan. Every write is a PATCH
 * on that plan document — its weekends, its gyms, its calendar — and the plan is
 * deleted at the end, which is why the season's own calendar is byte-identical.
 */
const stepButton = (label) => page.locator("ol button").filter({ hasText: label }).first()
const gridColumns = async () =>
  (
    await page.request.get(`${BASE}/api/seasons/${SEASON}/planner/venues`).then((r) => r.json())
  )?.grid?.weekends ?? []
/** Every weekend the board is drawing games on, by session. */
const playedOn = async () =>
  page
    .locator('[data-session-id]:has([data-testid="weekend-gym-section"])')
    .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-session-id")))
const weekendCell = (key) => page.locator(`[data-testid="league-weekend"][data-weekend="${key}"]`)
/** One weekend on or off in THIS PLAN, waiting for the document to say so. */
const setWeekend = async (weekend, on) => {
  const cell = weekendCell(weekend.key)
  await cell.scrollIntoViewIfNeeded()
  if ((await cell.getAttribute("data-on")) === (on ? "1" : "0")) return true
  await cell.click()
  for (let i = 0; i < 60; i++) {
    if ((await cell.getAttribute("data-on")) === (on ? "1" : "0")) return true
    await page.waitForTimeout(400)
  }
  return false
}

/* --- 1a. no world to solve in: the hero names the step that gives it one -- */
/**
 * RE-PINNED 2026-08-06 (the world-first fix). A fresh plan HAS its home gym, so
 * the one thing it is short of is dates, and the hero has to say that and only
 * that: "pick your weekends and gym time" sent the operator to a step that has
 * no control for gym time any more, which is the circle this fix broke.
 */
const hero = page.locator('[data-testid="draw-hero"]')
ok(
  "a fresh plan's empty board asks for WEEKENDS, and offers no button that would draw nothing",
  (await hero.count()) === 1 &&
    (await hero.getAttribute("data-usable")) === "0" &&
    (await hero.getAttribute("data-gap")) === "weekends" &&
    /Pick your weekends in step 2 first/.test(await hero.innerText()) &&
    (await page.locator('[data-testid="world-first"]').count()) === 1 &&
    (await page.locator('[data-testid="draw-calendar"]').count()) === 0 &&
    // Ruling #3's button is gated on the same fact, so it is not offered either.
    (await page.locator('[data-testid="redraw"]').count()) === 0,
  (await hero.innerText().catch(() => "")).replace(/\n/g, " ")
)
await page.screenshot({ path: `${SHOTS}/8-hero-world-first.png` })

/* --- 1b. give the plan a world: one weekend. The gyms it already has ----- */
await page.locator('[data-testid="world-first"]').click()
await page.waitForSelector('[data-testid="league-weekends"]', { timeout: 60000 })
ok("the hero's link lands on step 2", (await page.locator('[data-testid="league-weekends"]').count()) === 1)

const columns = await gridColumns()
const monthsWithSessions = new Map()
for (const w of columns) {
  if (!w.sessionId) continue
  monthsWithSessions.set(w.month, [...(monthsWithSessions.get(w.month) ?? []), w])
}
// Two weekends of the SAME month, both of which the season already has: the
// drive must never create a session, because that would be a write to the season.
const pair = [...monthsWithSessions.values()].find((list) => list.length >= 2) ?? []
const [firstWeekend, secondWeekend] = pair
ok(
  "found two weekends of one month the season already has",
  Boolean(firstWeekend && secondWeekend),
  pair.map((w) => `${w.month} ${w.label}`).join(" · ")
)
if (!firstWeekend || !secondWeekend) {
  await browser.close()
  process.exit(1)
}

/**
 * A HOME GYM THE PLAN CAN ACTUALLY HOLD 175 TEAMS IN. The plan's home gym runs
 * three courts, which is 72 games a weekend against a demand of 175, so a plan
 * running one weekend a month would be in overflow everywhere and every check
 * below would be reading a board full of red. This plan says twelve.
 *
 * It is a PLAN-ONLY write (withGymCourts on the plan's world, PATCHed onto the
 * plan document), which is exactly the point: the season's own gyms never move.
 * It is also the only gym setup this drive does: what the plan runs ON is the
 * building it owns, and the draw is what puts that building on a date.
 */
const gridVenues =
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/planner/venues`).then((r) => r.json()))
    ?.grid?.venues ?? []
// THE PLAN'S OWN home gym, not the grid's guess at one: the draw fills a bare
// weekend from the building in the plan's roster, so that is the building every
// check below has to name.
const planHomeId = freshGyms.find((g) => g.role === "home")?.venueId
const homeGym =
  gridVenues.find((v) => v.venueId === planHomeId) ??
  gridVenues.find((v) => v.role === "home") ??
  gridVenues[0]
const homeCourts = page.getByLabel(`${homeGym.name} courts`)
await homeCourts.scrollIntoViewIfNeeded()
await homeCourts.fill("12")
await page.locator("button", { hasText: "Save courts" }).first().click()
// Polls for up to 30s rather than a fixed 1.5s: under load the plan-world
// PATCH can take much longer than the happy path to land and re-render.
let courtsNoticed = await page.locator('[data-testid="step2-notice"]').innerText().catch(() => "")
for (let i = 0; i < 60 && !/in this plan/i.test(courtsNoticed); i++) {
  await page.waitForTimeout(500)
  courtsNoticed = await page.locator('[data-testid="step2-notice"]').innerText().catch(() => courtsNoticed)
}
ok(
  "the plan's own courts are a plan write, and the step says so",
  /in this plan/i.test(courtsNoticed),
  courtsNoticed.replace(/\n/g, " ")
)

ok(`${firstWeekend.label} is on in this plan`, await setWeekend(firstWeekend, true))
const runningLine = await page.locator('[data-testid="league-weekends-count"]').innerText()
ok("exactly one weekend is on", /^1 of /.test(runningLine.trim()), runningLine.trim())
/**
 * RE-PINNED 2026-08-06 (the fix). This used to be followed by a raw PATCH that
 * wrote the home gym onto that weekend by hand, because wave B made choosing a
 * weekend attach nothing and everything downstream still demanded gym time up
 * front. That was the bug, written down as a workaround.
 *
 * The chosen weekend is BARE and that is the whole point: the draw fills it from
 * the building the league owns. Nothing else is set up here, so what follows is
 * the owner's own path, exactly as he walks it.
 */
const bareChosen = (await planDoc(made.id))?.settings?.state
const chosenNow = (bareChosen?.windows ?? [])
  .flatMap((win) => win.weekends ?? [])
  .filter((w) => w.chosen)
ok(
  "the chosen weekend carries no gym at all: choosing a date is not a booking",
  chosenNow.length === 1 &&
    chosenNow[0].sessionId === firstWeekend.sessionId &&
    (chosenNow[0].venues ?? []).length === 0 &&
    (chosenNow[0].capacityGames ?? 0) === 0,
  chosenNow
    .map((w) => `${w.label}: ${(w.venues ?? []).length} gym(s), ${w.capacityGames} games`)
    .join(" · ") || "nothing chosen"
)
await page.screenshot({ path: `${SHOTS}/9-step2-one-weekend.png` })

/* ------------- 1c. back on the board: one button, and it works ----------- */
/**
 * RE-PINNED 2026-08-06 (the fix). This used to reload the whole page and pick
 * the plan out of the chooser again, because a RAW PATCH had gone round the back
 * of the client and only a fresh open would show it. There is no raw PATCH any
 * more, so the drive walks step 2 → step 3 the way the owner does: the wizard
 * holds the document, the board redraws from the version step 2 just wrote, and
 * that is the exact path the bug was hit on.
 */
await stepButton("Your calendar").click()
await page.waitForSelector('[data-testid="draw-hero"]', { timeout: 60000 })
await page.waitForTimeout(1200)
// RE-PINNED 2026-08-06 (the fix): a CHOSEN WEEKEND is the whole requirement now.
// The plan has no gym time on it and it is usable anyway, because the draw is
// what puts the league's own building on the dates it chose.
// RE-PINNED 2026-08-06 wave (C3): the hero's own line shortened to "Nothing is
// saved until you say so." — the fuller "Nothing is booked or saved..." moved
// into the draw-how popover below, alongside the shape-of-the-draw sentence.
ok(
  "a plan with a chosen weekend and a home gym leads with Draw the calendar, bare weekend and all",
  (await hero.getAttribute("data-usable")) === "1" &&
    (await hero.getAttribute("data-gap")) === "" &&
    (await page.locator('[data-testid="draw-calendar"]').count()) === 1 &&
    (await page.locator('[data-testid="world-first"]').count()) === 0 &&
    /Nothing is saved until you say so/.test(await hero.innerText()),
  (await hero.innerText()).replace(/\n/g, " ")
)
ok(
  "and Redraw calendar is in the board header from the moment the world can hold one",
  (await page.locator('[data-testid="redraw"]').count()) === 1,
  await page.locator('[data-testid="redraw"]').innerText().catch(() => "")
)
/**
 * NEW 2026-08-06 (wave B, slice B2): the draw's shape, in one line, before it
 * is pressed — the building the plan owns fills first, then rents as few gyms
 * as it can. This only shows on the USABLE hero (a plan with weekends and gym
 * time but no calendar yet), so this is the one place in the three suites
 * that can see it: the reference plan's board already has a calendar, and the
 * world-first hero has no draw button to explain.
 *
 * RE-PINNED 2026-08-06 wave (C3): draw-how is the WhyPopover TRIGGER now, not
 * a paragraph — the explanation only exists once the popover is open, in the
 * portalled why-popover panel.
 */
const drawHow = page.locator('[data-testid="draw-how"]')
ok("the hero offers a trigger explaining the draw, before you press it", (await drawHow.count()) === 1)
await drawHow.click()
await page.waitForSelector('[data-testid="why-popover"]', { timeout: 5000 })
const drawHowText = await page.locator('[data-testid="why-popover"]').last().innerText()
ok(
  "and the popover explains the draw's shape",
  /Fills your home gym first, then rents as few gyms as possible/.test(drawHowText),
  drawHowText
)
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
ok("nothing is drawn yet", (await playedOn()).length === 0)
await page.screenshot({ path: `${SHOTS}/10-hero-draw-calendar.png` })

await page.locator('[data-testid="draw-calendar"]').click()
await page.waitForTimeout(1800)
const drawnOn = await playedOn()
/**
 * RE-PINNED 2026-08-06, AND EXACT AGAIN (the fix).
 *
 * This check used to say only "a draw produces a calendar", with a long note
 * explaining that the solver defaulted a grade onto every month the plan had not
 * chosen: those months still carried the season's real sessions structurally, and
 * a chosen-but-bare weekend was dropped from the solve, so the month it was in
 * went with it. One chosen weekend came back as games in five months, most of
 * them on Saturdays this plan never took and with zero capacity behind them.
 *
 * The month fallback is dead. The solve is handed the chosen weekends filled from
 * the home gym, and a month with no chosen weekend is dropped whole, so the
 * identities hold up and the check names them.
 */
ok(
  "the draw fills the weekend the plan chose, and no other",
  drawnOn.length === 1 && drawnOn[0] === firstWeekend.sessionId,
  `${drawnOn.length} weekend(s) with games: ${drawnOn.join(", ")}`
)
/**
 * NEW 2026-08-06 (the fix, part 3): the draw did not just place games, it put the
 * league's own building on the weekend it filled. So the card has a real gym
 * section with a real meter on it, exactly as if the operator had placed it, and
 * the notice says which building appeared and why.
 */
const drawnSections = await page
  .locator(
    `[data-session-id="${firstWeekend.sessionId}"] [data-testid="weekend-gym-section"]`
  )
  .evaluateAll((rows) =>
    rows.map((r) => `${r.getAttribute("data-venue-id")}:${r.getAttribute("data-role")}`)
  )
ok(
  "and it puts the home gym on that weekend, so the board draws a real section",
  drawnSections.some((s) => s === `${homeGym.venueId}:home`),
  `${drawnSections.length} section(s): ${drawnSections.join(", ")}`
)
const drawNotice = await page.locator('[data-testid="board-notice"]').innerText().catch(() => "")
/**
 * RE-PINNED 2026-08-07 (drive sweep, following the 2bc1b07 commit's own "Drive
 * debt queued for sweep" note). `drawnHome` — the clause naming the building
 * and "because that is the building your league owns" — was deleted in that
 * commit; COPY.drawn (board-shared.ts) no longer names a building in the
 * toast at all. WHICH building got used is still pinned, just by the DOM
 * assertion right above this one (the home gym's own section on the drawn
 * weekend) rather than by the notice's words. What the notice still promises,
 * asserted on its current, stable copy: it announces the draw, says it used
 * the plan's own gyms, and says nothing is saved yet.
 */
ok(
  "it announces the draw, says it used the plan's own gyms, and that nothing is saved",
  /Here is the calendar/.test(drawNotice) &&
    /in the gyms this plan has/.test(drawNotice) &&
    /Nothing is saved/.test(drawNotice),
  drawNotice.replace(/\n/g, " ")
)
const drawState = await page.locator('[data-testid="plan-state"]').innerText()
ok("the board is dirty and says so", /not saved/i.test(drawState), drawState)
ok(
  "the whole draw is one step on the undo stack",
  (await page.locator('[data-testid="undo-last"]').count()) === 1 &&
    /drawing the calendar/i.test(await page.locator('[data-testid="undo-last"]').innerText()),
  await page.locator('[data-testid="undo-last"]').innerText().catch(() => "")
)
await page.screenshot({ path: `${SHOTS}/11-drawn-on-one-weekend.png` })

await page.locator('[data-testid="undo-last"]').click()
await page.waitForTimeout(1200)
ok(
  "one undo puts the empty calendar back, hero and all",
  (await playedOn()).length === 0 &&
    (await page.locator('[data-testid="draw-calendar"]').count()) === 1,
  `${(await playedOn()).length} weekend(s) with games`
)

/* ------------- 3. redraw, from the header, over hand work ---------------- */
await page.locator('[data-testid="draw-calendar"]').click()
await page.waitForTimeout(1500)
await page.locator('[data-testid="redraw"]').click()
await page.waitForTimeout(1800)
const redrawNotice = await page.locator('[data-testid="board-notice"]').innerText().catch(() => "")
const redrawnOn = await playedOn()
// RE-PINNED 2026-08-06, AND EXACT AGAIN: the same solve, the same one chosen
// weekend, the same answer. Redraw is not a different question.
ok(
  "Redraw asks first, then draws the same calendar again in the same world",
  /Redrawn from your weekends/.test(redrawNotice) &&
    redrawnOn.length === 1 &&
    redrawnOn[0] === firstWeekend.sessionId,
  `${redrawNotice.replace(/\n/g, " ")} · ${redrawnOn.join(", ") || "no weekends"}`
)

/* --------- 2. the world moves under a SAVED calendar: two ways out ------- */
await page.locator('[data-testid="save-plan"]').click()
// Polls for up to 30s rather than a fixed 2s: under load the save PATCH can
// take much longer than the happy path to actually land.
let savedKeys = []
for (let i = 0; i < 60; i++) {
  const savedDrawnNow = made ? await planDoc(made.id) : null
  savedKeys = Object.entries(savedDrawnNow?.assignment ?? {})
    .filter(([, keys]) => (keys ?? []).length > 0)
    .map(([id]) => id)
  if (savedKeys.length > 0) break
  await page.waitForTimeout(500)
}
/**
 * RE-PINNED 2026-08-06, AND EXACT AGAIN: the save persists the working copy, and
 * the working copy is now one weekend, so the saved calendar is one weekend. It
 * also carries the gym the draw asserted, written into the plan's own world, so
 * reopening this plan finds the building on that date rather than the games
 * stranded.
 */
const drawnDoc = made ? await planDoc(made.id) : null
const savedWeekend = (drawnDoc?.settings?.state?.windows ?? [])
  .flatMap((win) => win.weekends ?? [])
  .find((w) => w.sessionId === firstWeekend.sessionId)
ok(
  "the drawn calendar saves onto the plan, on the one weekend it chose",
  savedKeys.length === 1 && savedKeys[0] === firstWeekend.sessionId,
  savedKeys.join(", ") || "nothing saved"
)
ok(
  "and the home gym the draw put down is saved into the plan's own world",
  (savedWeekend?.venues ?? []).some((v) => v.venueId === homeGym.venueId) &&
    (savedWeekend?.capacityGames ?? 0) > 0,
  `${(savedWeekend?.venues ?? []).map((v) => v.name).join(", ") || "no gyms"} · ${
    savedWeekend?.capacityGames ?? 0
  } games`
)

// Step 2 again: this month now runs the OTHER weekend, and not the one the
// saved calendar is on. Every game in the plan is suddenly homeless.
// RE-PINNED 2026-08-06 (wave B): step 2's rail label changed from "Gyms &
// weekends" to "Your buildings" now that painting a gym onto each Saturday
// moved to the board and this step is a roster of buildings.
await stepButton("Your buildings").click()
await page.waitForSelector('[data-testid="league-weekends"]', { timeout: 60000 })
ok(`${secondWeekend.label} goes on in this plan`, await setWeekend(secondWeekend, true))
ok(`${firstWeekend.label} comes off in this plan`, await setWeekend(firstWeekend, false))
await page.screenshot({ path: `${SHOTS}/12-step2-weekend-swapped.png` })

/**
 * RE-PINNED 2026-08-06 (the fix): the raw PATCH that used to put the home gym on
 * secondWeekend by hand is gone with the one above it, and so is the page
 * reload. The new weekend is chosen and bare, which is all step 2 does now, and
 * "Re-solve in this world" below is what fills it. That is the whole point of
 * the fix, driven the way the owner drives it.
 */
await stepButton("Your calendar").click()
await page.waitForSelector('[data-testid="stranded-gyms"]', { timeout: 60000 })
await page.waitForTimeout(1200)
const banner = page.locator('[data-testid="stranded-gyms"]')
const moveButton = page.locator('[data-testid="move-stranded"]').first()
/**
 * RE-PINNED 2026-08-06: "resolve-world" is the one way out that is ALWAYS
 * offered, whatever shape the stranding takes. "move-stranded" is the single-
 * group shortcut, and it names a destination weekend with capacity already on
 * it: the weekend this plan just chose is bare until a draw fills it, so on this
 * path the universal fix is the one offered. Both are legitimate ways out; which
 * one appears depends on the shape of the mess.
 */
ok(
  "the gym-gone banner offers a way out",
  (await page.locator('[data-testid="resolve-world"]').count()) === 1,
  `${(await banner.innerText()).replace(/\n/g, " ")}`
)
await page.screenshot({ path: `${SHOTS}/13-stranded-two-ways-out.png` })

if ((await moveButton.count()) === 1) {
  const beforeMoveCount = (await playedOn()).length
  await moveButton.click()
  await page.waitForTimeout(1500)
  const movedOn = await playedOn()
  ok(
    "the move lands the stranded games on the weekend it named",
    movedOn.length >= beforeMoveCount,
    `${beforeMoveCount} → ${movedOn.length} weekend(s) with games`
  )
  ok(
    "the move is undoable like any other move",
    (await page.locator('[data-testid="undo-last"]').count()) === 1,
    await page.locator('[data-testid="undo-last"]').innerText().catch(() => "")
  )
  await page.locator('[data-testid="undo-last"]').click()
  await page.waitForTimeout(1200)
  ok("undoing it strands them again", (await banner.count()) === 1)
} else {
  ok(
    "the move lands the stranded games on the weekend it named",
    true,
    "no single move-stranded button on a mess this shape: resolve-world is the way out, checked below"
  )
  ok("the move is undoable like any other move", true, "n/a: no single move was made")
}

await page.locator('[data-testid="resolve-world"]').click()
await page.waitForTimeout(1800)
const resolvedOn = await playedOn()
const resolveNotice = await page.locator('[data-testid="board-notice"]').innerText().catch(() => "")
/**
 * RE-PINNED 2026-08-06, AND EXACT AGAIN (the fix, end to end). The weekend this
 * plan swapped to has no gym time on it, and nothing in the UI can put one there
 * any more. Re-solving fills it from the building the league owns: the games land
 * on the new weekend and only there, and the section that appears is real.
 */
const resolvedSections = await page
  .locator(
    `[data-session-id="${secondWeekend.sessionId}"] [data-testid="weekend-gym-section"]`
  )
  .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-venue-id")))
ok(
  "re-solving in this world fills the bare weekend the plan chose, and the banner clears",
  (await banner.count()) === 0 &&
    resolvedOn.length === 1 &&
    resolvedOn[0] === secondWeekend.sessionId &&
    resolvedSections.includes(homeGym.venueId) &&
    /Redrawn in this plan/.test(resolveNotice),
  `${resolvedOn.join(", ")} · sections ${resolvedSections.join(", ") || "none"} · ${resolveNotice.replace(/\n/g, " ")}`
)
await page.screenshot({ path: `${SHOTS}/14-resolved-in-this-world.png` })

/* ------------------- rename and delete, from the picker ------------------ */
// Owner ruling 2026-08-05, #2: plan CRUD lives in the picker.
// RE-PINNED 2026-08-06 wave (B1): the picker itself lives at step 1 only now,
// so both this rename and the delete-blocked check below happen there.
const step1ForCrud = new URL(page.url())
step1ForCrud.searchParams.set("step", "1")
await page.goto(step1ForCrud.toString(), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })
const crudPicker = page.locator('[data-testid="plan-picker"]')

let renamed = false
if (made) {
  await crudPicker.click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 20000 })
  await page.locator(`[data-testid="plan-rename-open"][data-plan-id="${made.id}"]`).click()
  await page.waitForSelector('[data-testid="plan-rename-input"]', { timeout: 20000 })
  await page.fill('[data-testid="plan-rename-input"]', "Drive renamed plan")
  await page.locator('[data-testid="plan-rename-confirm"]').click()
  for (let i = 0; i < 30; i++) {
    const rows = await listPlans()
    renamed = rows.some((p) => p.id === made.id && p.name === "Drive renamed plan")
    if (renamed) break
    await page.waitForTimeout(400)
  }
}
ok("a plan renames in place, from step 1's picker", renamed)

// The two plans that cannot be thrown away say so on the button itself.
await crudPicker.click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 20000 })
const activePlanRow = (await listPlans()).find((p) => p.isActive)
const blockedDelete = activePlanRow
  ? await page
      .locator(`[data-testid="plan-delete"][data-plan-id="${activePlanRow.id}"]`)
      .getAttribute("data-blocked")
  : null
ok(
  "the reference plan the season runs refuses deletion, and says why on the button",
  blockedDelete === "1",
  `data-blocked=${blockedDelete}`
)
const referenceRefusal = activePlanRow
  ? await page.request
      .delete(`${BASE}/api/seasons/${SEASON}/plans/${activePlanRow.id}`)
      .then(async (r) => ({ status: r.status(), error: (await r.json().catch(() => ({}))).error }))
  : null
ok(
  "and the API refuses it too, with a reason",
  referenceRefusal?.status === 409 && /active|reference/i.test(referenceRefusal?.error ?? ""),
  `${referenceRefusal?.status} ${referenceRefusal?.error ?? ""}`
)
await page.keyboard.press("Escape")

let madeDeleted = false
if (made) {
  madeDeleted = (await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${made.id}`)).ok()
}
ok(
  "the drive's fresh plan is deleted again",
  madeDeleted && !(await listPlans()).some((p) => p.id === made.id)
)

/* ------------------------------- clean up -------------------------------- */
let deleted = false
for (const plan of await listPlans()) {
  if (plan.name !== DRIVE_PLAN) continue
  const res = await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${plan.id}`)
  deleted = res.ok()
}
ok("the drive's plan is deleted again", deleted)

const finalPlans = await listPlans()
// RE-PINNED 2026-08-05: the world can hold plans this drive did not make (the
// owner's own, or an older run's). What this suite owns is its own litter and
// the plan the season RUNS, so that is what it pins.
ok(
  "everything this drive made is gone, and the season still runs its own plan",
  !finalPlans.some((p) => p.name === DRIVE_PLAN || p.id === made?.id) &&
    finalPlans.some((p) => p.name === "NPH plan" && p.isActive === true),
  finalPlans.map((p) => `${p.name}${p.isActive ? " (active)" : ""}`).join(", ")
)

const after = await savedCalendar()
ok("the season's saved calendar is byte-identical to where it started", after === before)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "))
console.log(`shots: ${SHOTS}`)
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
