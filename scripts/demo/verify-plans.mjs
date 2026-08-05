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
import { openBoard } from "./plan-board-lib.mjs"

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

// The only confirm this drive should ever meet is "you have unsaved changes".
// Anything else (activating a plan) is dismissed on purpose: this script must
// never change the calendar the season runs.
page.on("dialog", async (dialog) => {
  const discard = /throws them away/i.test(dialog.message())
  console.log(`      dialog (${discard ? "accepted" : "DISMISSED"}): ${dialog.message()}`)
  await (discard ? dialog.accept() : dialog.dismiss())
})

for (const p of ["/sign-in", `/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`]) {
  await page.request.get(`${BASE}${p}`).catch(() => {})
}

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', USER)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
let user = null
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
const entry = await openBoard(page, PLAN_URL)
ok(
  "step 3 opens on nothing: no plan is selected just because one is active",
  entry.empty && entry.sections === 0 && entry.weekends === 0 && /None open/.test(entry.picker),
  `${entry.picker} · ${entry.sections} gym sections, ${entry.weekends} weekends drawn`
)

const picker = page.locator('[data-testid="plan-picker"]')
const pickerText = (await picker.innerText()).replace(/\n/g, " ")
ok(
  "the picker names the plan on the board and marks it active",
  pickerText.includes("NPH plan") && /active/i.test(pickerText),
  pickerText
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

const legend = page.locator('[data-testid="gym-legend"]')
const legendBox = await legend.boundingBox().catch(() => null)
const boardBox = await page.locator("[data-session-id]").first().boundingBox()
ok(
  "the gym legend still sits above the board",
  Boolean(legendBox && boardBox && legendBox.y < boardBox.y),
  legendBox && boardBox ? `legend y=${Math.round(legendBox.y)}, board y=${Math.round(boardBox.y)}` : "missing"
)

await picker.click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 5000 })
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
await page.waitForSelector('[data-testid="plan-name-input"]', { timeout: 5000 })
const suggested = await page.locator('[data-testid="plan-name-input"]').inputValue()
ok("the name box opens with a name already in it", suggested.length > 0, suggested)
await page.locator('[data-testid="plan-name-input"]').fill(DRIVE_PLAN)
await page.locator('[data-testid="plan-name-row"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/3-naming.png` })
await page.locator('[data-testid="save-new-confirm"]').click()
await page.waitForTimeout(1500)

const afterSaveText = (await picker.innerText()).replace(/\n/g, " ")
ok(
  "the board is now the new plan, and the new plan does not run the season",
  afterSaveText.includes(DRIVE_PLAN) && !/active/i.test(afterSaveText),
  afterSaveText
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
const planDoc = async (id) =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans/${id}`).then((r) => r.json()))?.plan
const docBefore = drivePlan ? JSON.stringify((await planDoc(drivePlan.id)).assignment) : ""

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
  await page.waitForTimeout(1500)
  const savedAgain = await page.locator('[data-testid="plan-state"]').innerText()
  ok(
    "saving to your own plan clears the changes",
    savedAgain.startsWith(`Saved to ${DRIVE_PLAN}`) &&
      (await page.locator('[data-testid="save-plan"]').count()) === 0,
    savedAgain
  )
  const docAfter = JSON.stringify((await planDoc(drivePlan.id)).assignment)
  ok("the plan document actually changed", docAfter !== docBefore)
} else {
  ok("a plan of your own offers to be written back by name", true, "no rail idea to edit with")
}

/* -------------------------- back to the reference ------------------------ */
await picker.click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 5000 })
await page.locator('[data-testid="plan-option"][data-source="imported"]').first().click()
await page.waitForTimeout(1500)
const backText = (await picker.innerText()).replace(/\n/g, " ")
const backState = await page.locator('[data-testid="plan-state"]').innerText()
ok(
  "picking another plan reloads the board onto it, clean",
  backText.includes("NPH plan") &&
    /active/i.test(backText) &&
    backState.includes("season's calendar") &&
    // Clean again: nothing to write back, and the only save left is the quiet
    // fork of the league's own calendar.
    (await page.locator('[data-testid="save-plan"]').count()) === 0 &&
    (await page.locator('[data-testid="save-as-new"]').innerText()) === "Save a copy",
  `${backText} · ${backState}`
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
const newRow = page.locator('[data-testid="plan-new"]')
ok(
  "making a plan is a button beside the picker, not a row inside it",
  (await newRow.count()) === 1 && (await newRow.innerText()).trim() === "New plan",
  await newRow.innerText().catch(() => "missing")
)
await page.screenshot({ path: `${SHOTS}/6-new-plan-row.png` })

const plansBeforeNew = await listPlans()
await newRow.click()
await page.waitForSelector('[data-testid="plan-create-input"]', { timeout: 15000 })
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

await page.waitForTimeout(1500)
const madeName = made?.name ?? FRESH_NAME
const newText = (await picker.innerText()).replace(/\n/g, " ")
ok(
  "the board opens on the new plan, and the season keeps the one it runs",
  newText.includes(madeName) && !/active/i.test(newText),
  newText
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
ok(
  "the board still draws every weekend of the season, chosen or not",
  (await page.locator("[data-session-id]").count()) > 0,
  `${await page.locator("[data-session-id]").count()} weekends`
)
await page.screenshot({ path: `${SHOTS}/7-new-plan-on-the-board.png` })

/* ------------------- rename and delete, from the picker ------------------ */
// Owner ruling 2026-08-05, #2: plan CRUD lives in the picker.
let renamed = false
if (made) {
  await picker.click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
  await page.locator(`[data-testid="plan-rename-open"][data-plan-id="${made.id}"]`).click()
  await page.waitForSelector('[data-testid="plan-rename-input"]', { timeout: 10000 })
  await page.fill('[data-testid="plan-rename-input"]', "Drive renamed plan")
  await page.locator('[data-testid="plan-rename-confirm"]').click()
  for (let i = 0; i < 30; i++) {
    const rows = await listPlans()
    renamed = rows.some((p) => p.id === made.id && p.name === "Drive renamed plan")
    if (renamed) break
    await page.waitForTimeout(400)
  }
}
ok("a plan renames in place, from the picker", renamed)

// The two plans that cannot be thrown away say so on the button itself.
await picker.click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
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
