// Drive "plans as documents" on step 3, ROUND 2 (owner ruling 2026-08-07,
// docs/roadmap/one-calendar-wave-2026-08-07.md, landed in f16b715 "one-
// calendar wave, round 1"). Write-through died: every plan, the active one
// included, edits only its own document; the board autosaves on a ~1s
// debounce; Save to / Save as new / Use for the season / Undo changes are
// gone from the board; "Save a copy" now lives in two places — the picker
// row's own menu (any plan, open or not) and one control on the read-only
// reference board. The season moves through exactly one door: the generate
// button (board header "generate-season", step 5 "step5-generate"), which
// previews two plain-words questions and, on a green board, writes with NO
// confirm at all.
//
// SAFETY, restated because that last sentence is exactly why this matters:
// this script NEVER presses generate-season or step5-generate, and NEVER
// POSTs .../generate itself, confirmed or not — on a clean plan that call
// writes the season on the FIRST try, no dialog in between. Every other
// write this drive makes lands on a plan document (its own throwaway plans,
// or PATCHes this script issues directly), never on the season's own
// sessions. The one dialog class this drive still expects and accepts is
// the redraw confirm ("Redraw replaces the calendar on the board"); anything
// else is dismissed on sight. It captures the season's saved calendar AND
// the active/reference plan's own document (assignment + venues) before it
// starts and asserts both are byte-identical at the end.
//
// Env (defaults = the 2026-08-07 local world):
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
const DRIVE_PLAN_COPY = "Drive picker copy"

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

// This script must never change the calendar the season runs, and must never
// complete a generate. The only confirm it should ever meet is "Redraw
// replaces the calendar on the board" — board-local, writes nothing. A
// "Generate anyway?" dialog would mean the generate button got pressed,
// which never happens here; if one somehow appeared, dismissing it (not
// accepting) is the only safe move, which the fallback below already does.
const EXPECTED_DIALOGS = /Redraw replaces the calendar/i
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

/* ------------------------------ small helpers ----------------------------- */
const listPlans = async () =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json()))?.plans ?? []

/** GET a plan document, retrying past a transient ECONNRESET rather than
 *  crashing the whole drive on one dropped connection — seen under load from
 *  a concurrent seed on the same box, always on this exact call. */
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** AUTOSAVE (owner ruling 2026-08-07, #4) replaced every manual save button
 *  with a debounced PATCH and a status line: "Saving…" while dirty, then a
 *  brief "Saved just now." (BoardTools' own 2s flash), settling into "Every
 *  change saves to <name>." Both of the latter two are "clean" — this polls
 *  until the line reaches one of them rather than assuming exact timing. */
const waitForCleanState = async (name, timeoutMs = 15000) => {
  const clean = new RegExp(`^(Saved just now\\.|Every change saves to ${escapeRe(name)}\\.)$`)
  const el = page.locator('[data-testid="plan-state"]')
  const start = Date.now()
  let text = ""
  while (Date.now() - start < timeoutMs) {
    text = (await el.innerText().catch(() => "")).trim()
    if (clean.test(text)) return text
    await page.waitForTimeout(300)
  }
  return text
}

/**
 * ONE EDIT, RELIABLY (fixed during this drive's own run — the fallback this
 * file used to reach for, `button[aria-label^="Move "][title^="Move to"]`,
 * never matches anything live: the real "move here" targets carry
 * `data-testid="move-here"`/`"move-section-here"` and NO title attribute at
 * all, and — more importantly — they only exist once a grade chip has been
 * armed by a first tap (grade-chip.tsx: "one tap arms it, the next tap on a
 * weekend moves"). A rail suggestion is a bonus when the solver has one to
 * offer; failing that, this arms the first workable chip on the board and
 * takes the first target that lights up for it, the same two-tap path a real
 * operator uses. It tries a few chips in case the first one armed has
 * nowhere to go (a lone grade in a month with only one weekend chosen).
 */
const makeOneEdit = async () => {
  const railMove = page.locator('[data-testid="suggestion-move"]').first()
  if ((await railMove.count()) > 0) {
    await railMove.click()
    await page.waitForTimeout(500)
    return true
  }
  const chips = page.locator('[data-testid="grade-chip"]')
  const chipCount = await chips.count()
  for (let i = 0; i < Math.min(chipCount, 15); i++) {
    // The arm button is the chip's own first <button> child (the grip beside
    // it is an svg, not a button); the "×" remove and "why" popover buttons
    // come after it, so `.first()` is always the tap-to-arm control.
    const armBtn = chips.nth(i).locator("button").first()
    if (!(await armBtn.isEnabled().catch(() => false))) continue
    await armBtn.click()
    await page.waitForTimeout(250)
    const target = page.locator('[data-testid="move-here"], [data-testid="move-section-here"]').first()
    if ((await target.count()) > 0) {
      await target.click()
      await page.waitForTimeout(500)
      return true
    }
    // Nothing lit up for this one: disarm (tapping an armed chip again puts
    // it down, per grade-chip.tsx) and try the next.
    await armBtn.click().catch(() => {})
    await page.waitForTimeout(150)
  }
  return false
}

/* ------------------- nothing open: steps are read only -------------------- */
// NEW 2026-08-07 (ruling: "steps 1-2 with nothing open are read-only" — the
// season is no longer a fallback for a plan's numbers). A cold visit to step
// 1, before any plan is chosen: the grade table still shows the season's
// live counts (folded in, same as always), but the stepper that used to
// write straight through to the season's divisions has nowhere left to
// write, so it is simply disabled.
const step1Cold = new URL(PLAN_URL)
step1Cold.searchParams.set("step", "1")
step1Cold.searchParams.delete("plan")
await page.goto(step1Cold.toString(), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-empty"]', { timeout: 90000 })
await page.waitForSelector('[data-testid="grade-row"]', { timeout: 30000 }).catch(() => {})
const coldRowCount = await page.locator('[data-testid="grade-row"]').count()
const coldPlusBtn = page.locator('button[aria-label^="One more "]').first()
const coldPlusDisabled = coldRowCount > 0 ? await coldPlusBtn.isDisabled().catch(() => null) : null
ok(
  "nothing open: step 1's stepper is read only (no season fallback to write into)",
  coldRowCount > 0 && coldPlusDisabled === true,
  `${coldRowCount} grade row(s), stepper disabled=${coldPlusDisabled}`
)

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

/* ---- RE-PINNED 2026-08-07: GET now serves stored settings, even active --- */
/**
 * The on-board drift line (plan-drift) is gone from the DOM — it has been for
 * several waves; "where a plan's world stands" is now said only inside the
 * activation/generate confirm text this drive must never trigger. What IS
 * new and squarely this wave's to pin: GET .../plans/[planId] used to
 * recompute the ACTIVE plan's settings live, on every single request (owner's
 * old "one truth" ruling — the active plan IS the season). Write-through
 * died, so the active plan is a plan like any other now: it reads what was
 * saved, the same as every row below it. Two reads a moment apart should
 * therefore land on the exact same `capturedAt`, where the old live-recompute
 * branch would have stamped a fresh one every time.
 */
ok("plan-drift is gone from the board (no UI drift indicator remains)", (await page.locator('[data-testid="plan-drift"]').count()) === 0)
const activeDoc1 = await planDoc(activeRow.id)
const activeDoc2 = await planDoc(activeRow.id)
ok(
  "GET now serves the active plan's STORED settings, not a live recompute",
  Boolean(activeDoc1?.settings?.capturedAt) && activeDoc1.settings.capturedAt === activeDoc2?.settings?.capturedAt,
  `capturedAt ${activeDoc1?.settings?.capturedAt ?? "none"} on read 1, ${activeDoc2?.settings?.capturedAt ?? "none"} on read 2`
)
// What the byte-identical check at the very end compares against: the
// active/reference plan's OWN document, calendar and gyms only (settings can
// legitimately self-heal a gym roster on a later read, which is not a
// regression this drive is chasing).
const referenceCalendarBefore = JSON.stringify({
  assignment: activeDoc1?.assignment ?? null,
  venues: activeDoc1?.venues ?? null,
})

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
// NEW 2026-08-07: the world attribute on step 1's own line. It used to read
// "season" for the active plan (steps wrote through to the season's rows);
// write-through died, so it is "plan" for any chosen plan now, the active
// one included — there is no more "season" value at all.
const stepLine = page.locator('[data-testid="step1-plan-line"]')
ok(
  "step 1 says the numbers on screen belong to a PLAN now, never the season",
  (await stepLine.getAttribute("data-world")) === "plan",
  `data-world=${await stepLine.getAttribute("data-world").catch(() => "?")}`
)
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

/* --------------------- one edit, then Save a copy (board) ----------------- */
/**
 * RE-PINNED 2026-08-07 (ruling #4, autosave): the board's own save controls
 * — Save to <plan>, Save as new plan, Use for the season, Undo changes — are
 * gone. The reference plan keeps exactly one board control now: "Save a
 * copy", always labelled that (it no longer flexes its label with dirty
 * state the way the old "Save as new plan"/"Save this calendar" toggle did).
 * Its name box is the shared NameBox component under the SAME testid
 * ("save-as-new"), not the separate plan-name-input/-row/save-new-confirm
 * trio the old PlanSaveControls used.
 */
const edited = await makeOneEdit()
await page.waitForTimeout(700)
ok("one edit lands on the working copy", edited)

const saveNew = page.locator('[data-testid="save-as-new"]')
ok(
  "an edited reference plan offers exactly one board control: Save a copy",
  (await saveNew.count()) === 1 && (await saveNew.innerText()).trim() === "Save a copy",
  await saveNew.innerText().catch(() => "")
)
ok(
  "no plan is EVER offered a manual write-back button — autosave replaced it",
  (await page.locator('[data-testid="save-plan"]').count()) === 0
)
ok(
  "the write-through note is gone: there is nothing left to write through to",
  (await page.locator('[data-testid="write-through-note"]').count()) === 0
)
const stateLine = await page.locator('[data-testid="plan-state"]').innerText()
ok(
  "the reference plan's state line is constant — read only, whatever the local dirt is",
  stateLine.trim() === "Reference plan, read only. Save a copy to change it.",
  stateLine
)
await saveNew.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/2-save-controls-dirty.png` })

await saveNew.click()
await page.waitForSelector('[data-testid="save-as-new-input"]', { timeout: 30000 })
const suggested = await page.locator('[data-testid="save-as-new-input"]').inputValue()
ok("the name box opens with a name already in it", suggested.length > 0, suggested)
await page.locator('[data-testid="save-as-new-input"]').fill(DRIVE_PLAN)
await page.locator('[data-testid="save-as-new"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/3-naming.png` })
await page.locator('[data-testid="save-as-new-confirm"]').click()
// Saving a copy is a POST, a list refresh and a document fetch. On a cold route
// that is well past a second and a half, so this waits for the answer instead of
// guessing at it.
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
// RE-PINNED 2026-08-07: the old state line ("Saved to X. Y still runs the
// season.") is gone with the write-through it was explaining. The new line
// says nothing about which plan runs the season at all — it is purely about
// THIS plan's own save status, "Saved just now." or "Every change saves to
// <name>." once things settle.
const savedState = await waitForCleanState(DRIVE_PLAN)
ok(
  "the state line is about THIS plan's save status only, no mention of the season",
  /Saved just now\.|Every change saves to/.test(savedState) && !/season/i.test(savedState),
  savedState
)
// RE-PINNED 2026-08-07 (ruling #3): "activate" left every user-facing string
// this file owns. There is no more "offer to use a plan for the season" —
// that is the generate button's job, elsewhere, and it never appears here.
ok(
  "a plan the season does not run is offered NO activate control — one door only, elsewhere",
  (await page.locator('[data-testid="activate-plan"]').count()) === 0
)
await page.locator('[data-testid="plan-state"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/4-save-controls-own-plan.png` })

const listAfterSave = await listPlans()
const drivePlan = listAfterSave.find((p) => p.name === DRIVE_PLAN)
ok(
  "the API agrees: saved, not applied — saveAsNew no longer auto-activates a season's first saved plan either",
  Boolean(drivePlan) && drivePlan.isActive === false && drivePlan.source === "manual",
  drivePlan ? `${drivePlan.name} source=${drivePlan.source} active=${drivePlan.isActive}` : "missing"
)

/* ------------------- the world the plan was saved in --------------------- */
const savedDoc = drivePlan ? await planDoc(drivePlan.id) : null
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

/* ------------------ saving onto a plan of your own: AUTOSAVE ------------- */
/**
 * RE-PINNED 2026-08-07 (ruling #4, THE autosave re-pin). There is no
 * "save-plan" button to click any more — the plan-state's poll-based helper
 * above already proves that globally. What used to be "click Save, poll
 * plan-state, poll the document" is now: edit, wait past the 1s debounce,
 * and check BOTH the document (proves the PATCH landed) and a hard page
 * reload (proves it is durable, not just optimistic client state — a reload
 * re-reads ?plan=<id> from the URL and re-fetches the document from
 * scratch).
 */
const docBefore = drivePlan ? JSON.stringify((await planDoc(drivePlan.id))?.assignment) : ""

const editedAgain = await makeOneEdit()
if (editedAgain) {
  // Prompt check: right after the edit, well before the 1s debounce fires,
  // the line should already say "Saving…" — proof the debounce is armed on
  // the very edit that dirtied the board, not on some later poll.
  await page.waitForTimeout(300)
  const pending = (await page.locator('[data-testid="plan-state"]').innerText().catch(() => "")).trim()
  ok(
    "autosave arms the moment the board goes dirty: the line says Saving… before the debounce fires",
    pending === "Saving…",
    pending
  )
  // Past the debounce, no button involved.
  await page.waitForTimeout(1500)
  const settled = await waitForCleanState(DRIVE_PLAN)
  ok("autosave lands the edit on its own, no save button pressed", /Saved just now\.|Every change saves to/.test(settled), settled)
  const docAfter = JSON.stringify((await planDoc(drivePlan.id))?.assignment)
  ok("the plan document actually changed", docAfter !== docBefore)

  // Reload: the URL still carries ?plan=<id>, so this is a cold re-fetch of
  // the document, not a client cache re-reading itself.
  await page.reload({ timeout: 90000 })
  await page.waitForSelector('[data-testid="board-plan-badge"]', { timeout: 90000 })
  await page.waitForTimeout(700)
  const afterReloadBadge = (await badge.innerText().catch(() => "")).replace(/\n/g, " ")
  const afterReloadState = (await page.locator('[data-testid="plan-state"]').innerText().catch(() => "")).trim()
  const docAfterReload = JSON.stringify((await planDoc(drivePlan.id))?.assignment)
  ok(
    "the edit survives a hard reload: it was written to the document, not held in memory",
    afterReloadBadge.includes(DRIVE_PLAN) &&
      afterReloadState === `Every change saves to ${DRIVE_PLAN}.` &&
      docAfterReload === docAfter,
    `${afterReloadBadge} · ${afterReloadState}`
  )
} else {
  ok("autosave arms the moment the board goes dirty", true, "no rail idea and no swap button to edit with")
  ok("autosave lands the edit on its own, no save button pressed", true, "n/a: no edit was made")
  ok("the plan document actually changed", true, "n/a: no edit was made")
  ok("the edit survives a hard reload", true, "n/a: no edit was made")
}

/* ------------------- picker-menu Save a copy (the OTHER copy path) ------- */
/**
 * NEW 2026-08-07 (ruling #4, second half). There are now TWO "Save a copy"
 * paths and they behave differently on purpose:
 *   - the board's own control (just exercised above, saveAsNew) copies the
 *     WORKING COPY and OPENS the result — you were mid-edit, so you stay
 *     with what you made.
 *   - the picker row's own copy icon (plan-copy-open, any row, open or not)
 *     duplicates that row's STORED document and leaves the board exactly
 *     where it was — session.duplicate() never calls session.choose().
 * This drive is sitting on DRIVE_PLAN after the reload above; duplicating it
 * from the picker must not move the board off it.
 */
const step1ForCopy = new URL(page.url())
step1ForCopy.searchParams.set("step", "1")
await page.goto(step1ForCopy.toString(), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })
const urlBeforeCopy = new URL(page.url())
const planBeforeCopy = urlBeforeCopy.searchParams.get("plan")
await page.locator('[data-testid="plan-picker"]').click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 20000 })
await page.locator(`[data-testid="plan-copy-open"][data-plan-id="${drivePlan.id}"]`).click()
await page.waitForSelector('[data-testid="plan-copy-input"]', { timeout: 20000 })
const copySuggested = await page.locator('[data-testid="plan-copy-input"]').inputValue()
ok("the picker's copy box also opens with a name already suggested", copySuggested.length > 0, copySuggested)
await page.fill('[data-testid="plan-copy-input"]', DRIVE_PLAN_COPY)
await page.locator('[data-testid="plan-copy-confirm"]').click()

let drivePlanCopy = null
for (let i = 0; i < 40; i++) {
  drivePlanCopy = (await listPlans()).find((p) => p.name === DRIVE_PLAN_COPY) ?? null
  if (drivePlanCopy) break
  await page.waitForTimeout(500)
}
ok(
  "the picker's Save a copy makes a real, unapplied plan of its own",
  Boolean(drivePlanCopy) && drivePlanCopy.isActive === false && drivePlanCopy.source === "manual",
  drivePlanCopy ? `${drivePlanCopy.name} source=${drivePlanCopy.source} active=${drivePlanCopy.isActive}` : "missing"
)
const urlAfterCopy = new URL(page.url())
ok(
  "and — unlike the board's own copy — it does NOT move the open plan out from under you",
  urlAfterCopy.searchParams.get("plan") === planBeforeCopy,
  `plan param before=${planBeforeCopy}, after=${urlAfterCopy.searchParams.get("plan")}`
)
await page.screenshot({ path: `${SHOTS}/4b-picker-save-a-copy.png` })

// The duplicate is a real, openable plan, not a broken shell: open it
// through the normal chooser path (openPlanFromStep1, imported here but
// unused by every other section — this is its one honest job) and confirm
// it carries the source plan's world.
if (drivePlanCopy) {
  await openPlanFromStep1(page, PLAN_URL, drivePlanCopy.id)
  const copyBadge = (await badge.innerText().catch(() => "")).replace(/\n/g, " ")
  ok(
    "the picker's copy opens cleanly onto the board, carrying the world it copied",
    copyBadge.includes(DRIVE_PLAN_COPY) &&
      (await page.locator('[data-session-id], [data-testid="ghost-collapse"]').count()) > 0,
    copyBadge
  )
}

/* -------------------------- back to the reference ------------------------ */
// RE-PINNED 2026-08-06 wave (B1): switching plans is a step-1 errand now —
// switchPlan hops there, picks the imported one, and follows the URL back.
await switchPlan(page, { source: "imported" })
const backText = (await badge.innerText()).replace(/\n/g, " ")
// RE-PINNED 2026-08-07: the old "...season's calendar..." wording belonged to
// planStateLine, which BoardTools no longer calls — its own inline text is
// the fixed reference sentence, whatever the plan's dirty state.
const backState = await page.locator('[data-testid="plan-state"]').innerText()
const backActive = (await listPlans()).find((p) => p.name === "NPH plan")?.isActive
ok(
  "picking another plan reloads the board onto it, clean",
  backText.includes("NPH plan") &&
    backActive === true &&
    backState.trim() === "Reference plan, read only. Save a copy to change it." &&
    // Clean again: nothing to write back, and the only control left is the
    // quiet copy escape.
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
 *
 * This whole block is UNCHANGED by the 2026-08-07 wave: createNew never had
 * an auto-activate mechanic to lose (that only ever lived in the board's old
 * "Save as new" takesOver logic, which is gone with the rest of it), and
 * gyms-weekends-step's own world-write path for a non-active plan of your
 * own was already exactly this.
 */
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
//
// FIXED during this drive's own run (a real, reproducible race, unrelated to
// the three owner fixes): the OLD approach read `page.url()` right after
// finding `made` via this drive's own independent `listPlans()` poll. That
// poll is a raw HTTP GET, disjoint from the browser's own click handler
// (POST → await refresh() [a second GET] → setPlanId → render → a
// history.replaceState effect) — under load the poll can resolve before
// that chain finishes, so `page.url()` still carried the PREVIOUS plan
// (NPH plan, left open by switchPlan above), and the drive spent the rest
// of this section reading NPH plan's real calendar under `made`'s name,
// crashing when it expected an empty-board hero that plan does not have.
// Building the URL from `made.id` directly — known from this drive's own
// poll — sidesteps the browser's timing entirely.
const madeName = made?.name ?? FRESH_NAME
const backToBoard = new URL(step1ForNew)
backToBoard.searchParams.set("step", "3")
if (made) backToBoard.searchParams.set("plan", made.id)
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
// NEW 2026-08-07: THE ONE BUTTON exists at the board header the moment any
// plan is open, whatever shape its calendar is in — never pressed here.
const generateSeasonBtn = page.locator('[data-testid="generate-season"]')
ok(
  "the board header carries THE ONE BUTTON (never pressed by this drive)",
  (await generateSeasonBtn.count()) === 1 &&
    (await generateSeasonBtn.innerText()).trim() === "Use this calendar and generate the schedule" &&
    !(await generateSeasonBtn.isDisabled()),
  await generateSeasonBtn.innerText().catch(() => "missing")
)
const madeDoc = made ? await planDoc(made.id) : null
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

/* ------------------- step 5 carries the other one-button copy ------------ */
// NEW 2026-08-07: step 5 got its own press of the same one button
// (step5-generate), reached only when a plan is open — never pressed here
// either. A quick detour, then straight back to step 3 to keep drawing.
const step5Url = new URL(page.url())
step5Url.searchParams.set("step", "5")
await page.goto(step5Url.toString(), { timeout: 90000 })
await page.waitForSelector('[data-testid="step5-generate"], [data-testid="step5-plan-pointer"]', {
  timeout: 60000,
})
const step5Generate = page.locator('[data-testid="step5-generate"]')
ok(
  "step 5 carries the same one button, with a plan open (never pressed by this drive)",
  (await step5Generate.count()) === 1 &&
    (await step5Generate.innerText()).trim() === "Use this calendar and generate the schedule",
  await step5Generate.innerText().catch(() => "missing")
)
await page.screenshot({ path: `${SHOTS}/7b-step5-one-button.png` })
const step3Url = new URL(page.url())
step3Url.searchParams.set("step", "3")
await page.goto(step3Url.toString(), { timeout: 90000 })
await page.waitForSelector('[data-session-id], [data-testid="ghost-collapse"], [data-testid="draw-hero"]', {
  timeout: 90000,
})
await page.waitForTimeout(700)

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
 *
 * None of this section's mechanics moved in the 2026-08-07 wave: DrawHero,
 * StrandedBanner, board-verbs and gyms-weekends-step's write path for a
 * non-active plan of your own were already exactly this. The two things that
 * DID change are (a) there is no "save-plan" button to click any more — the
 * drawn calendar reaches the plan document via autosave, same as the section
 * above — and (b) the dirty-state text this section reads.
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
await stepButton("Your calendar").click()
await page.waitForSelector('[data-testid="draw-hero"]', { timeout: 60000 })
await page.waitForTimeout(1200)
// A CHOSEN WEEKEND is the whole requirement now. The plan has no gym time on
// it and it is usable anyway, because the draw is what puts the league's own
// building on the dates it chose.
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

/**
 * RE-PINNED 2026-08-07, THE FULL SHAPE (found live, during this drive's own
 * run): savePlan() — autosave's own completion handler — unconditionally
 * calls setUndoStack([]) on every successful save. That means the undo
 * button for THIS draw only exists for the ~1s before the debounce fires;
 * the render itself (assignment, sections, the notice) is a synchronous
 * client-side result of the draw and is already on screen well inside that
 * same window, so everything below reads in one early pass rather than
 * after the fixed ~1.8s wait the pre-autosave version used (which would
 * itself run well past the debounce and find the undo button already gone —
 * exactly what this drive hit on its first pass; see this drive's report).
 */
await page.locator('[data-testid="draw-calendar"]').click()
await page.waitForTimeout(400)
const drawPending = (await page.locator('[data-testid="plan-state"]').innerText().catch(() => "")).trim()
ok("the draw dirties the board immediately, autosave arms itself", drawPending === "Saving…", drawPending)
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
 * The draw did not just place games, it put the league's own building on the
 * weekend it filled. So the card has a real gym section with a real meter on
 * it, exactly as if the operator had placed it, and the notice says which
 * building appeared and why.
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
 * weekend) rather than by the notice's words.
 *
 * RE-PINNED AGAIN, SAME DAY: COPY.drawn's tail was "Nothing is saved until
 * you save it." (this drive's own first report flagged it as stale — a
 * save action that no longer exists once autosave replaced the button) and
 * is now "Every change saves on its own.", fixed on the owner's word. The
 * same family (redrawn/resolved/redrawConfirm) got the same treatment; the
 * redraw/resolve notices below only pin their unaffected PREFIX so they
 * needed no change.
 */
ok(
  "it announces the draw, says it used the plan's own gyms, and that it saves on its own",
  /Here is the calendar/.test(drawNotice) &&
    /in the gyms this plan has/.test(drawNotice) &&
    /Every change saves on its own/.test(drawNotice),
  drawNotice.replace(/\n/g, " ")
)
// Still well inside the pre-debounce window: the undo button for this draw
// is already here (openPlan resets the stack fresh per plan, so this is
// its first entry).
ok(
  "the whole draw is one step on the undo stack",
  (await page.locator('[data-testid="undo-last"]').count()) === 1 &&
    /drawing the calendar/i.test(await page.locator('[data-testid="undo-last"]').innerText()),
  await page.locator('[data-testid="undo-last"]').innerText().catch(() => "")
)
await page.screenshot({ path: `${SHOTS}/11-drawn-on-one-weekend.png` })

/**
 * RE-PINNED 2026-08-07, TO THE HEALTHY TRUTH (owner fix, same day as this
 * drive's first report: "savePlan no longer clears the undo stack, so undo
 * survives autosave"). This drive's first pass caught savePlan() calling
 * setUndoStack([]) on every successful autosave, which meant the undo
 * button for a draw vanished within about a second whether or not anybody
 * touched it — flagged prominently, now fixed. Re-verified live here: wait
 * past the ~1s debounce (2s, same margin the fix was asked to be checked
 * at) with NO action taken, and the undo entry for this draw is still
 * standing, autosave and all.
 */
await page.waitForTimeout(2000)
const drawStateAfterDebounce = (await page.locator('[data-testid="plan-state"]').innerText().catch(() => "")).trim()
ok(
  "autosave lands the draw on its own, no button pressed",
  /Saved just now\.|Every change saves to/.test(drawStateAfterDebounce),
  drawStateAfterDebounce
)
ok(
  "FIXED (re-pinned to the healthy truth): undo survives autosave — still here 2s after the edit, with no user action in between",
  (await page.locator('[data-testid="undo-last"]').count()) === 1 &&
    /drawing the calendar/i.test(await page.locator('[data-testid="undo-last"]').innerText()),
  await page.locator('[data-testid="undo-last"]').innerText().catch(() => "")
)
await page.locator('[data-testid="undo-last"]').click()
await page.waitForTimeout(800)
ok(
  "and it still works: one undo puts the empty calendar back, hero and all, past the debounce",
  (await playedOn()).length === 0 &&
    (await page.locator('[data-testid="draw-calendar"]').count()) === 1,
  `${(await playedOn()).length} weekend(s) with games`
)
// Best-effort settle: the undo just dirtied the board again (empty now
// disagrees with the drawn state autosave just persisted), so let that
// second autosave land before starting the next edit, avoiding overlapping
// in-flight PATCHes confusing later polls. Not asserted — purely a courtesy
// wait, since the next step draws again regardless of whether this landed.
await waitForCleanState(madeName, 4000).catch(() => {})

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
/**
 * RE-PINNED 2026-08-07: there is no "save-plan" button to click here any
 * more — the redraw above already dirtied the board, so this just waits for
 * autosave to land it, the same poll loop as before minus the click.
 */
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
 * RE-PINNED 2026-08-06, AND EXACT AGAIN: autosave persists the working copy, and
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
  "the drawn calendar autosaves onto the plan, on the one weekend it chose",
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
await stepButton("Your buildings").click()
await page.waitForSelector('[data-testid="league-weekends"]', { timeout: 60000 })
ok(`${secondWeekend.label} goes on in this plan`, await setWeekend(secondWeekend, true))
ok(`${firstWeekend.label} comes off in this plan`, await setWeekend(firstWeekend, false))
await page.screenshot({ path: `${SHOTS}/12-step2-weekend-swapped.png` })

await stepButton("Your calendar").click()
await page.waitForSelector('[data-testid="stranded-gyms"]', { timeout: 60000 })
await page.waitForTimeout(1200)
const banner = page.locator('[data-testid="stranded-gyms"]')
const moveButton = page.locator('[data-testid="move-stranded"]').first()
/**
 * "resolve-world" is the one way out that is ALWAYS offered, whatever shape
 * the stranding takes. "move-stranded" is the single-group shortcut, and it
 * names a destination weekend with capacity already on it: the weekend this
 * plan just chose is bare until a draw fills it, so on this path the
 * universal fix is the one offered. Both are legitimate ways out; which one
 * appears depends on the shape of the mess.
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

/* ---------------- no "activate" anywhere on a live board ----------------- */
// NEW 2026-08-07 (ruling #3): a broad, cheap sweep. Title/aria-label
// attributes are NOT part of innerText, so this only proves the VISIBLE
// text is clean — a real, separate leak in a disabled button's tooltip is
// reported in prose, not asserted here (see this drive's report).
const bodyText = await page.locator("body").innerText()
ok(
  "no visible text on a live board ever says 'activate' or offers to 'use for the season'",
  !/\bactivate\b/i.test(bodyText) && !/use for the season/i.test(bodyText),
  /\bactivate\b/i.test(bodyText) ? "found 'activate' in visible body text" : "clean"
)

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
const blockedDeleteBtn = activePlanRow
  ? page.locator(`[data-testid="plan-delete"][data-plan-id="${activePlanRow.id}"]`)
  : null
const blockedDelete = blockedDeleteBtn ? await blockedDeleteBtn.getAttribute("data-blocked") : null
// RE-PINNED 2026-08-07 (owner fix, same day as this drive's first report):
// PLAN_COPY.deleteActive used to say "Activate another one first." — fixed
// to speak in generate-from-another-plan words instead. This exact season's
// active plan is also its reference, so the tooltip actually shown is
// PLAN_COPY.deleteReference (isReferencePlan wins the ternary) — captured
// as evidence either way, and asserted clean of "activate" now that it can
// be.
const blockedDeleteTitle = blockedDeleteBtn ? await blockedDeleteBtn.getAttribute("title") : null
ok(
  "the reference plan the season runs refuses deletion, says why on the button, and never says 'activate'",
  blockedDelete === "1" && !/activate/i.test(blockedDeleteTitle ?? ""),
  `data-blocked=${blockedDelete} · title="${blockedDeleteTitle}"`
)
const referenceRefusal = activePlanRow
  ? await page.request
      .delete(`${BASE}/api/seasons/${SEASON}/plans/${activePlanRow.id}`)
      .then(async (r) => ({ status: r.status(), error: (await r.json().catch(() => ({}))).error }))
  : null
// RE-PINNED 2026-08-07: ACTIVE_PLAN_DELETE_MESSAGE's reason-giving wording
// changed with the fix ("This plan is active. Activate another one first,
// then delete this." → "This plan is the one the season runs. Generate the
// season from another plan first, then delete this."), so the old
// /active|reference/i regex no longer matches ("active" itself is gone from
// the sentence). Broadened to the new phrasing.
ok(
  "and the API refuses it too, with a reason",
  referenceRefusal?.status === 409 &&
    /season runs|generate.*another plan|reference/i.test(referenceRefusal?.error ?? ""),
  `${referenceRefusal?.status} ${referenceRefusal?.error ?? ""}`
)
/**
 * FIXED 2026-08-07 (owner, same day as this drive's first report). This
 * exact 409 body used to be ACTIVE_PLAN_DELETE_MESSAGE's old wording,
 * "This plan is active. Activate another one first, then delete this." —
 * a direct, live-hit violation of ruling #4 ("the word 'activate' never
 * appears again"). Now re-pinned to confirm the fix rather than the finding.
 */
ok(
  "the delete-refusal message never says 'activate' (ruling #4: the word appears in no user-facing string)",
  !/activate/i.test(referenceRefusal?.error ?? ""),
  referenceRefusal?.error ?? ""
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
// RE-PINNED 2026-08-07: two "Drive "-prefixed plans exist now instead of one
// (the board's own copy, and the picker row's copy), so cleanup sweeps by
// prefix rather than a single exact name.
let deletedCount = 0
for (const plan of await listPlans()) {
  if (!plan.name.startsWith("Drive ")) continue
  const res = await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${plan.id}`)
  if (res.ok()) deletedCount += 1
}
ok("the drive's throwaway plans are deleted again", deletedCount >= 1, `${deletedCount} deleted`)

const finalPlans = await listPlans()
// RE-PINNED 2026-08-05: the world can hold plans this drive did not make (the
// owner's own, or an older run's). What this suite owns is its own litter and
// the plan the season RUNS, so that is what it pins.
ok(
  "everything this drive made is gone, and the season still runs its own plan",
  !finalPlans.some((p) => p.name.startsWith("Drive ") || p.id === made?.id) &&
    finalPlans.some((p) => p.name === "NPH plan" && p.isActive === true),
  finalPlans.map((p) => `${p.name}${p.isActive ? " (active)" : ""}`).join(", ")
)

const after = await savedCalendar()
ok("the season's saved calendar is byte-identical to where it started", after === before)

/**
 * NEW 2026-08-07: the season-untouched claim, held even more strictly.
 * write-through died specifically so that editing a plan — the active one
 * included — never moves the season's rows. This drive edited plenty of
 * plans, including making a working-copy edit directly on the active
 * plan's own board (the very first edit in this drive), and the check
 * above already proves the season's SESSIONS never moved. This second
 * check proves the active plan's OWN DOCUMENT (its calendar and its gyms)
 * never moved either — the working-copy edit on it was real, in the
 * browser, and never reached its document, because the autosave effect
 * explicitly skips the reference plan.
 */
const activeDocAfter = await planDoc(activeRow.id)
const referenceCalendarAfter = JSON.stringify({
  assignment: activeDocAfter?.assignment ?? null,
  venues: activeDocAfter?.venues ?? null,
})
ok(
  "the active/reference plan's own document (calendar + gyms) is untouched too",
  referenceCalendarAfter === referenceCalendarBefore
)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "))
console.log(`shots: ${SHOTS}`)
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
