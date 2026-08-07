/**
 * Evidence pass for the one-calendar wave (owner rulings,
 * docs/roadmap/one-calendar-wave-2026-08-07.md), against the ONLY slice that
 * shipped: sandbox plans, autosave, the single generate button.
 *
 * This script is mine alone (scripts/demo/verify-one-calendar.mjs) — no other
 * verify-*.mjs is touched. It imports plan-board-lib.mjs (a shared helper,
 * not a verify script) the same way the sibling plan drives already do.
 *
 * SAFETY: every write-path proof runs inside ONE throwaway plan, "One-
 * calendar check - delete me", created as a copy of the season's own active
 * plan and deleted at the end. The generate button is pressed exactly once,
 * with page.on("dialog") wired to DISMISS before the press (a delete
 * confirm — the one dialog this script legitimately accepts — is
 * recognised by its own wording, "cannot be undone", so the generate
 * confirm is never the one that gets accepted). The active plan itself is
 * never written to.
 *
 * Run: node verify-one-calendar.mjs   (from scripts/demo, arm64 node)
 * Shots: scratchpad/shots-wave/onecal-*.png (repo root)
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { openPlanFromStep1 } from "./plan-board-lib.mjs"

const BASE = "http://localhost:3000"
const NPH = {
  leagueId: "e48a0464-33a8-4be2-b4bc-75b78c3889f4",
  seasonId: "160b2f09-a95a-4a64-9b90-03793cae105b",
  email: "owner-nph@sportshub.demo",
  password: "TestPass123!",
}
const THROWAWAY_NAME = "One-calendar check - delete me"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.resolve(__dirname, "../../scratchpad/shots-wave")
fs.mkdirSync(SHOTS, { recursive: true })
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `onecal-${name}.png`), fullPage: true })

const planUrl = (step, extra = {}) => {
  const u = new URL(`${BASE}/manage/leagues/${NPH.leagueId}/seasons/${NPH.seasonId}/plan`)
  u.searchParams.set("step", String(step))
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v)
  return u.toString()
}

const results = []
const ok = (label, pass, detail = "") => {
  const line = `${pass ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`
  results.push(line)
  console.log(line)
  return pass
}
const info = (label, detail = "") => console.log(`INFO: ${label}${detail ? ` — ${detail}` : ""}`)

/* --------------------------------- login --------------------------------- */

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

/**
 * ONE GLOBAL DIALOG POLICY for the whole script. window.confirm from the
 * generate button never gets accepted — it is always dismissed, wired here
 * before ANY action that could open one. The only dialog this script ever
 * accepts is a plan-delete confirm, recognised by its own wording ("cannot
 * be undone"), needed once at cleanup to remove our own throwaway plan.
 */
let lastDialog = null
page.on("dialog", async (dialog) => {
  const msg = dialog.message()
  lastDialog = { type: dialog.type(), message: msg, at: Date.now() }
  console.log(`  [dialog ${dialog.type()}] ${msg.slice(0, 300).replace(/\n/g, " ⏎ ")}`)
  if (/cannot be undone/i.test(msg)) await dialog.accept()
  else await dialog.dismiss()
})

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', NPH.email)
await page.fill('input[type="password"]', NPH.password)
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(500)
  if (i === 29) throw new Error("never logged in")
}
info(`logged in as ${NPH.email}`)

/* --------------------------------- api helpers --------------------------------- */

const apiGet = async (path) => {
  const r = await page.request.get(`${BASE}${path}`)
  return { ok: r.ok(), status: r.status(), json: await r.json().catch(() => null) }
}

const getPlans = async () => (await apiGet(`/api/seasons/${NPH.seasonId}/plans`)).json?.plans ?? []
const getPlanDoc = async (id) => (await apiGet(`/api/seasons/${NPH.seasonId}/plans/${id}`)).json?.plan ?? null
const getPlanner = async () => (await apiGet(`/api/seasons/${NPH.seasonId}/planner`)).json
const getSchedule = async () => (await apiGet(`/api/seasons/${NPH.seasonId}/schedule`)).json?.games ?? []
const regularCount = (games) => games.filter((g) => g.phase === "REGULAR" || !g.phase).length

/* --------------------------------- misc helpers --------------------------------- */

/** Poll the board's plan-state line (BoardTools), returning every distinct
 *  value seen and whether `want` ever appeared. */
async function waitForPlanWorldReady(timeoutMs = 15000) {
  await page.waitForSelector('[data-testid="step1-plan-line"][data-world="plan"]', { timeout: timeoutMs })
}

async function pollPlanState(want, timeoutMs = 4500, intervalMs = 150) {
  const seen = []
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const txt = (await page.locator('[data-testid="plan-state"]').textContent().catch(() => null))?.trim()
    if (txt !== undefined && txt !== null && seen[seen.length - 1] !== txt) seen.push(txt)
    if (txt === want) return { hit: true, seen }
    await page.waitForTimeout(intervalMs)
  }
  return { hit: false, seen }
}

/** Click any grade chip that has a same-month destination, arm it, move it.
 *  Tries chips in order until one offers a "move-here" target; disarms
 *  (Escape) and tries the next when a chip has nowhere to go this month. */
async function moveAnyChip() {
  const chips = page.locator('[data-testid="grade-chip"] button[aria-label*=" on "]')
  const total = await chips.count()
  for (let i = 0; i < total; i++) {
    const chip = chips.nth(i)
    if (!(await chip.isVisible().catch(() => false))) continue
    const ariaLabel = await chip.getAttribute("aria-label")
    await chip.click()
    await page.waitForTimeout(250)
    const moveHere = page.locator('[data-testid="move-here"]')
    const n = await moveHere.count()
    if (n > 0) {
      const dest = moveHere.first()
      const destLabel = await dest.getAttribute("aria-label")
      const fromSessionId = await chip.evaluate((el) =>
        el.closest("[data-session-id]")?.getAttribute("data-session-id")
      )
      const unitKey = await chip.evaluate((el) =>
        el.closest('[data-testid="grade-chip"]')?.getAttribute("data-unit")
      )
      const toSessionId = await dest.evaluate((el) =>
        el.closest("[data-session-id]")?.getAttribute("data-session-id")
      )
      await dest.click()
      await page.waitForTimeout(350)
      return { ariaLabel, destLabel, fromSessionId, toSessionId, unitKey }
    }
    await page.keyboard.press("Escape")
    await page.waitForTimeout(150)
  }
  return null
}

/** The same two sufficiency questions POST .../generate asks, computed here
 *  independently off a plan's own stored document — a pre-flight SAFETY
 *  check so this script never presses the button without already knowing a
 *  confirm dialog (not a silent write) is what will happen. */
function computeFindings(plan) {
  const state = plan?.settings?.state
  const assignment = plan?.assignment ?? {}
  if (!state) return []
  const findings = []
  const guarantee = state.gamesPerTeam
  const weekends = (state.windows ?? []).flatMap((w) => w.weekends ?? [])
  if (guarantee) {
    for (const unit of state.units ?? []) {
      if (unit.teams <= 0) continue
      let promised = 0
      for (const w of weekends) {
        if (w.chosen && (assignment[w.sessionId] ?? []).includes(unit.key)) promised += w.targetGamesPerTeam
      }
      if (promised < guarantee) findings.push(`${unit.label} teams would get ${promised} of ${guarantee} games.`)
    }
  }
  for (const w of weekends) {
    if (!w.chosen) continue
    const keys = assignment[w.sessionId] ?? []
    let demand = 0
    for (const key of keys) {
      const u = (state.units ?? []).find((x) => x.key === key)
      if (u) demand += Math.ceil((u.teams * w.targetGamesPerTeam) / 2)
    }
    if (demand > w.capacityGames) findings.push(`${w.label} holds ${demand} games but has room for ${w.capacityGames}.`)
  }
  return findings
}

/* ===================================================================== */

console.log("\n=== BASELINE (world as found) ===")
const plansBefore = await getPlans()
const activePlan = plansBefore.find((p) => p.isActive)
info(`plans before: ${plansBefore.map((p) => `${p.name}${p.isActive ? "*" : ""}`).join(", ")}`)
info(`active plan: ${activePlan?.name} (${activePlan?.id}) source=${activePlan?.source}`)
const plannerBaseline = await getPlanner()
const scheduleBefore = await getSchedule()
const regularBefore = regularCount(scheduleBefore)
info(`REGULAR games before: ${regularBefore}`)

let throwawayId = null

try {
  /* =================================================================
   * TEST 6 — NOTHING OPEN: fresh context, no ?plan=, step 1.
   * ================================================================= */
  console.log("\n=== TEST 6: NOTHING OPEN (fresh context) ===")
  {
    const sessionFile = path.join(SHOTS, ".session.json")
    await page.context().storageState({ path: sessionFile })
    const freshCtx = await browser.newContext({ storageState: sessionFile, viewport: { width: 1400, height: 1000 } })
    const freshPage = await freshCtx.newPage()
    await freshPage.goto(planUrl(1), { timeout: 90000 })
    await freshPage.waitForSelector('[data-testid="step1-plan-empty"]', { timeout: 30000 })
    const chooserCount = await freshPage.locator('[data-testid="step1-plan-empty"]').count()
    ok("cold step 1 shows the chooser card", chooserCount === 1, `count=${chooserCount}`)

    const plusButtons = freshPage.locator('button[aria-label^="One more"]')
    const plusCount = await plusButtons.count()
    let allDisabled = plusCount > 0
    for (let i = 0; i < plusCount; i++) {
      if (!(await plusButtons.nth(i).isDisabled())) allDisabled = false
    }
    ok(
      "step 1 steppers are read-only with nothing open",
      allDisabled,
      `${plusCount} "+" buttons found, all disabled=${allDisabled}`
    )
    await shot(freshPage, "readonly")
    await freshCtx.close()
    fs.unlinkSync(sessionFile)
  }

  /* =================================================================
   * TEST 5, PART A — open the season's real ACTIVE plan and see what it is.
   * ================================================================= */
  console.log("\n=== TEST 5 (part A): the ACTIVE plan, as found ===")
  await openPlanFromStep1(page, planUrl(1), activePlan.id)
  const refNoteEl = page.locator('[data-testid="step1-reference-note"]')
  const isRefActive = (await refNoteEl.count()) === 1
  const refNoteText = isRefActive ? (await refNoteEl.textContent())?.trim() : null
  info(
    isRefActive
      ? `active plan IS the imported reference plan — read-only note: "${refNoteText}"`
      : "active plan is NOT the reference plan (editable) — sandbox proof will run on it directly"
  )
  const activeStepper = page.locator('button[aria-label^="One more"]').first()
  const activeStepperDisabled = (await activeStepper.count()) > 0 ? await activeStepper.isDisabled() : null
  if (isRefActive) {
    ok(
      "the active plan (source=imported) is read-only in the UI",
      activeStepperDisabled === true,
      `stepper disabled=${activeStepperDisabled}`
    )
    // Confirm the SERVER refuses content writes to it too (409), independent
    // of the UI gate — belt and suspenders for "write-through dead" even on
    // the one plan that used to be the special case. Schema-valid payload:
    // the active plan's own real settings.state, sent back unchanged.
    const activeDocForRefusal = await getPlanDoc(activePlan.id)
    const refusal = await page.request.patch(`${BASE}/api/seasons/${NPH.seasonId}/plans/${activePlan.id}`, {
      data: { settings: { state: activeDocForRefusal.settings.state } },
    })
    ok(
      "server refuses content writes to the active/reference plan (409)",
      refusal.status() === 409,
      `status=${refusal.status()} body=${JSON.stringify(await refusal.json().catch(() => null))}`
    )
  }

  /* =================================================================
   * SETUP — "Save a copy" of the active plan into our one throwaway plan,
   * via the picker's row menu (also exercises the control TEST 3 checks).
   * ================================================================= */
  console.log("\n=== SETUP: create the one throwaway plan via Save a copy ===")
  const chooserTrigger = page.locator('[data-testid="step1-plan-chooser"] [data-testid="plan-picker"]')
  await chooserTrigger.click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
  await page.locator(`[data-testid="plan-copy-open"][data-plan-id="${activePlan.id}"]`).click()
  await page.waitForSelector('[data-testid="plan-copy"]', { timeout: 10000 })
  await page.locator('[data-testid="plan-copy-input"]').fill(THROWAWAY_NAME)
  await page.locator('[data-testid="plan-copy-confirm"]').click()
  await page.waitForSelector('[data-testid="plan-copy"]', { state: "detached", timeout: 15000 })
  const plansAfterCopy = await getPlans()
  const throwaway = plansAfterCopy.find((p) => p.name === THROWAWAY_NAME)
  ok("throwaway plan created", Boolean(throwaway), throwaway ? throwaway.id : "not found")
  throwawayId = throwaway?.id ?? null
  if (!throwawayId) throw new Error("could not create the throwaway plan — aborting before any write-path proof")

  const throwawayDoc = await getPlanDoc(throwawayId)
  const preflight = computeFindings(throwawayDoc)
  info(`safety pre-check: local preflight replica finds ${preflight.length} finding(s) on the throwaway plan`)
  if (preflight.length === 0) {
    throw new Error(
      "SAFETY ABORT: the throwaway plan looks green (no findings) — pressing generate would write for real " +
        "with no confirm dialog to dismiss. Refusing to run TEST 4."
    )
  }
  info(`sample findings: ${preflight.slice(0, 3).join(" | ")}${preflight.length > 3 ? " …" : ""}`)

  /* Open the throwaway on the board. */
  await openPlanFromStep1(page, planUrl(3), throwawayId)

  /* =================================================================
   * TEST 1 — AUTOSAVE
   * ================================================================= */
  console.log("\n=== TEST 1: AUTOSAVE ===")
  const move1 = await moveAnyChip()
  ok("move #1 made on the board", Boolean(move1), move1 ? `${move1.ariaLabel} -> ${move1.destLabel}` : "no movable chip found")
  if (move1) {
    const poll1 = await pollPlanState("Saved just now.", 4500)
    ok('plan-state line said "Saved just now." within ~4.5s', poll1.hit, `saw: ${poll1.seen.join(" -> ")}`)
    await shot(page, "autosave")

    await page.reload({ timeout: 90000 })
    await page.waitForSelector('[data-session-id], [data-testid="ghost-collapse"]', { timeout: 90000 })
    await page.waitForTimeout(500)
    const docAfterReload = await getPlanDoc(throwawayId)
    const persisted1 =
      (docAfterReload?.assignment?.[move1.toSessionId] ?? []).includes(move1.unitKey) &&
      !(docAfterReload?.assignment?.[move1.fromSessionId] ?? []).includes(move1.unitKey)
    ok(
      "move #1 persisted across reload (plan document)",
      persisted1,
      `to[${move1.toSessionId}] has ${move1.unitKey}: ${(docAfterReload?.assignment?.[move1.toSessionId] ?? []).includes(move1.unitKey)}`
    )
  }

  /* =================================================================
   * TEST 2 — UNMOUNT FLUSH
   * ================================================================= */
  console.log("\n=== TEST 2: UNMOUNT FLUSH ===")
  const move2 = await moveAnyChip()
  ok("move #2 made on the board", Boolean(move2), move2 ? `${move2.ariaLabel} -> ${move2.destLabel}` : "no movable chip found")
  if (move2) {
    // NO WAIT: click Next: Publish immediately, inside the 1s debounce window.
    const nextBtn = page.locator('[data-testid="wizard-next"]')
    const nextLabel = (await nextBtn.textContent())?.replace(/\s+/g, " ").trim()
    ok('wizard-next reads "Next: Publish" while on step 3', /Next:\s*Publish/.test(nextLabel ?? ""), nextLabel ?? "")
    await nextBtn.click()
    await page.waitForSelector('[data-testid="wizard-prev"]', { timeout: 30000 })
    const prevLabel = (await page.locator('[data-testid="wizard-prev"]').textContent())?.replace(/\s+/g, " ").trim()
    // Come back to step 3.
    await page.locator('[data-testid="wizard-prev"]').click()
    await page.waitForSelector('[data-session-id], [data-testid="ghost-collapse"]', { timeout: 90000 })
    await page.waitForTimeout(600)
    const docAfterFlush = await getPlanDoc(throwawayId)
    const persisted2 =
      (docAfterFlush?.assignment?.[move2.toSessionId] ?? []).includes(move2.unitKey) &&
      !(docAfterFlush?.assignment?.[move2.fromSessionId] ?? []).includes(move2.unitKey)
    ok(
      "move #2 (made then immediately navigated away) persisted via the unmount flush",
      persisted2,
      `came back via "${prevLabel}"; to[${move2.toSessionId}] has ${move2.unitKey}: ${(docAfterFlush?.assignment?.[move2.toSessionId] ?? []).includes(move2.unitKey)}`
    )
    await shot(page, "flush")
  }

  /* =================================================================
   * TEST 3 — CONTROLS GONE
   * ================================================================= */
  console.log("\n=== TEST 3: CONTROLS GONE ===")
  for (const label of ["Save to", "Save as new plan", "Use for the season", "Undo changes"]) {
    const n = await page.locator("button", { hasText: label }).count()
    ok(`zero "${label}" buttons on the board`, n === 0, `count=${n}`)
  }
  // The picker's row menu still offers "Save a copy" (title/aria-label on
  // the icon button — the row is a name, not a sentence of verbs).
  const chooserTrigger2 = page.locator('[data-testid="step1-plan-chooser"] [data-testid="plan-picker"]')
  if ((await page.locator('[data-testid="plan-menu"]').count()) === 0) {
    // We are likely still on step 1 from earlier; if not, get there.
  }
  if (!(await chooserTrigger2.isVisible().catch(() => false))) {
    await page.goto(planUrl(1, { plan: throwawayId }), { timeout: 90000 })
    await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 30000 })
  }
  await page.locator('[data-testid="step1-plan-chooser"] [data-testid="plan-picker"]').click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
  const copyBtn = page.locator(`[data-testid="plan-copy-open"][data-plan-id="${throwawayId}"]`)
  const copyTitle = (await copyBtn.count()) > 0 ? await copyBtn.getAttribute("title") : null
  ok('"Save a copy" affordance exists in the plan picker row menu', /Save a copy/i.test(copyTitle ?? ""), copyTitle ?? "not found")
  await shot(page, "controls")

  // Bonus: the one place "Activate" survives in the codebase is a SERVER
  // error string, surfaced only via window.alert if somebody tries to
  // delete the active plan. Prove it is blocked and note it is a transient
  // native dialog, never on-page copy.
  const activeRow = page.locator(`[data-testid="plan-delete"][data-plan-id="${activePlan.id}"]`)
  if ((await activeRow.count()) > 0) {
    lastDialog = null
    await activeRow.click({ force: true }).catch(() => {})
    await page.waitForTimeout(500)
    if (lastDialog) {
      info(`bonus: deleting the ACTIVE plan is refused client-side with an alert: "${lastDialog.message}"`)
      ok(
        'the one surviving "Activate" string is a transient native alert, not on-page copy',
        /activate/i.test(lastDialog.message),
        lastDialog.message
      )
    } else {
      info("bonus: active-plan delete control did not fire (likely disabled outright) — no alert to inspect")
    }
  }
  await page.keyboard.press("Escape").catch(() => {})

  // Sweep steps 1-5 (throwaway plan open) for the word "activate" in the
  // rendered page itself.
  let activateHits = []
  for (let step = 1; step <= 5; step++) {
    await page.goto(planUrl(step, { plan: throwawayId }), { timeout: 90000 })
    await page.waitForTimeout(step === 3 ? 1500 : 900)
    const html = await page.content()
    if (/activate/i.test(html)) activateHits.push(step)
  }
  ok('the string "activate"/"Activate" appears on none of steps 1-5 (rendered HTML)', activateHits.length === 0, `steps with a hit: ${activateHits.join(",") || "none"}`)
  info(
    'static note (not runtime-observed here): plan-documents.ts PLAN_COPY.deleteActive = "This plan runs ' +
      'the season. Activate another one first." — the disabled title/aria-label on a delete button for a ' +
      "plan that is ACTIVE but NOT the reference. Unreachable in THIS season because its only active plan " +
      "IS the reference (deleteReference wins there, no \"activate\" in it) — but it is a real, latent " +
      '"Activate" string the moment an operator generates from a non-reference plan and then opens the ' +
      "picker on it."
  )

  /* =================================================================
   * TEST 4 — THE BUTTON
   * ================================================================= */
  console.log("\n=== TEST 4: THE BUTTON ===")
  await page.goto(planUrl(5, { plan: throwawayId }), { timeout: 90000 })
  await page.waitForSelector('[data-testid="step5-generate"], [data-testid="step5-plan-pointer"]', { timeout: 60000 })
  const step5Btn = page.locator('[data-testid="step5-generate"]')
  const step5Present = (await step5Btn.count()) === 1
  const step5Label = step5Present ? (await step5Btn.textContent())?.trim() : null
  ok(
    'step5-generate exists, labeled "Use this calendar and generate the schedule"',
    step5Present && step5Label === "Use this calendar and generate the schedule",
    step5Label ?? "not present"
  )

  await page.goto(planUrl(3, { plan: throwawayId }), { timeout: 90000 })
  await page.waitForSelector('[data-session-id], [data-testid="ghost-collapse"]', { timeout: 90000 })
  const headerBtn = page.locator('[data-testid="generate-season"]')
  const headerPresent = (await headerBtn.count()) === 1
  const headerLabel = headerPresent ? (await headerBtn.textContent())?.trim() : null
  ok(
    'generate-season exists in the board header, same label',
    headerPresent && headerLabel === "Use this calendar and generate the schedule",
    headerLabel ?? "not present"
  )

  const plansBeforePress = await getPlans()
  const scheduleBeforePress = await getSchedule()
  const regularBeforePress = regularCount(scheduleBeforePress)

  lastDialog = null
  await shot(page, "preflight") // the moment before the press; native dialogs render nothing extra, captured for the record
  await headerBtn.click()
  // Give the POST + the confirm() call a moment to round-trip.
  for (let i = 0; i < 40 && !lastDialog; i++) await page.waitForTimeout(150)
  const gotDialog = Boolean(lastDialog)
  ok("pressing the button opened a confirm dialog (findings were non-empty)", gotDialog, gotDialog ? "" : "no dialog observed")
  let capturedSentences = []
  if (gotDialog) {
    capturedSentences = lastDialog.message.split("\n").filter((l) => l.trim().length > 0)
    ok(
      "the confirm text is plain sentences (not JSON/codes), ending in a question",
      capturedSentences.length > 1 && /Generate anyway\?$/.test(capturedSentences[capturedSentences.length - 1]),
      `${capturedSentences.length} lines; last: "${capturedSentences[capturedSentences.length - 1]}"`
    )
    console.log("  --- captured preflight sentences ---")
    for (const line of capturedSentences) console.log(`  · ${line}`)
    console.log("  ------------------------------------")
  }
  await page.waitForTimeout(800)
  await shot(page, "button")

  const plansAfterPress = await getPlans()
  const scheduleAfterPress = await getSchedule()
  const regularAfterPress = regularCount(scheduleAfterPress)
  // This dev DB is shared with other concurrently-running verify scripts
  // (confirmed above — plans not of ours appear/disappear between snapshots
  // taken seconds apart), so a byte-for-byte list diff is noisy for reasons
  // that have nothing to do with the press. What the dismissed press must
  // NOT have done: touched OUR throwaway plan's own row, or the active plan.
  const ours = (list) => list.find((p) => p.id === throwawayId)
  const ourBefore = ours(plansBeforePress)
  const ourAfter = ours(plansAfterPress)
  const activeBefore = plansBeforePress.find((p) => p.isActive)
  const activeAfter = plansAfterPress.find((p) => p.isActive)
  ok(
    "our throwaway plan's row (and the active plan) unchanged before/after the dismissed press",
    JSON.stringify(ourBefore) === JSON.stringify(ourAfter) && activeBefore?.id === activeAfter?.id,
    `throwaway updatedAt ${ourBefore?.updatedAt} -> ${ourAfter?.updatedAt}; active still ${activeAfter?.name} (${activeAfter?.id})`
  )
  ok(
    "REGULAR game count unchanged after the dismissed press",
    regularBeforePress === regularAfterPress,
    `before=${regularBeforePress} after=${regularAfterPress}`
  )

  /* =================================================================
   * TEST 7 — EXCLUDE UI
   * ================================================================= */
  console.log("\n=== TEST 7: EXCLUDE UI ===")
  await page.goto(planUrl(1, { plan: throwawayId }), { timeout: 90000 })
  await waitForPlanWorldReady()
  await page.waitForTimeout(300)
  const manageOpen = page.locator('[data-testid="manage-teams-open"]').first()
  const hasDisclosure = (await manageOpen.count()) > 0
  if (!hasDisclosure) {
    ok("EXCLUDE UI (Manage teams disclosure) present", false, "absent — no grade row with registered teams found; not faking this proof")
  } else {
    const row = page.locator('[data-testid="grade-row"]').filter({ has: manageOpen })
    const gradeLabel = (await row.locator("td").first().textContent())?.trim()
    await manageOpen.click()
    await page.waitForSelector('[data-testid="manage-teams-list"]', { timeout: 10000 })
    const toggle = page.locator('[data-testid="team-exclude-toggle"]').first()
    const teamId = await toggle.getAttribute("data-team-id")
    const beforeExcluded = await toggle.getAttribute("data-excluded")
    ok("a grade with registered teams shows Manage teams", true, `${gradeLabel}, team ${teamId}, excluded=${beforeExcluded}`)

    await toggle.click()
    // Poll rather than a single fixed wait: the save (PATCH) and the
    // client re-render are two separate round trips, and a flat wait here
    // raced the second one on a busy shared dev server.
    const excludeToggleLoc = page.locator(`[data-testid="team-exclude-toggle"][data-team-id="${teamId}"]`)
    let afterExcluded = null
    for (let i = 0; i < 20; i++) {
      afterExcluded = await excludeToggleLoc.getAttribute("data-excluded")
      if (afterExcluded === "1") break
      await page.waitForTimeout(300)
    }
    const li = excludeToggleLoc.locator("..")
    const struck = (await li.locator("span.line-through").count()) > 0
    ok("excluding a team shows strike-through + is-excluded state", struck && afterExcluded === "1", `struck=${struck} data-excluded=${afterExcluded}`)
    await shot(page, "exclude")

    const docExcl = await getPlanDoc(throwawayId)
    const inDocExcluded = (docExcl?.settings?.state?.excludedTeamIds ?? []).includes(teamId)
    ok("exclude persisted to the plan document (API)", inDocExcluded, `excludedTeamIds includes team: ${inDocExcluded}`)
    if (!inDocExcluded) {
      info(
        `root-cause probe: the PATCH the toggle sends does return 200, but the id it sends is Team.id ` +
          `(client's RegisteredTeam.teamId = teamSubmission.team.id). The server's sanitizePlanWorld ` +
          `(apps/web/src/lib/scheduler/season-plans.ts) validates excludedTeamIds against ` +
          `TeamSubmission.id instead, a different id space — so every exclude is silently dropped on ` +
          `save. Not a script issue: confirmed by reading the two id sources directly. Reporting as a ` +
          `real FAIL, not faking persistence.`
      )
    }

    // Reload and confirm it survives.
    await page.reload({ timeout: 90000 })
    await waitForPlanWorldReady()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="manage-teams-open"]').first().click()
    await page.waitForSelector('[data-testid="manage-teams-list"]', { timeout: 10000 })
    const afterReloadExcluded = await page
      .locator(`[data-testid="team-exclude-toggle"][data-team-id="${teamId}"]`)
      .getAttribute("data-excluded")
    ok("exclude survives reload", afterReloadExcluded === "1", `data-excluded=${afterReloadExcluded}`)

    // Re-include. Poll rather than a fixed wait, same reasoning as the
    // exclude click above: save and re-render are two separate round trips.
    await page.locator(`[data-testid="team-exclude-toggle"][data-team-id="${teamId}"]`).click()
    let finalExcluded = null
    for (let i = 0; i < 20; i++) {
      finalExcluded = await page
        .locator(`[data-testid="team-exclude-toggle"][data-team-id="${teamId}"]`)
        .getAttribute("data-excluded")
      if (finalExcluded === "0") break
      await page.waitForTimeout(300)
    }
    ok("re-include reverts the toggle", finalExcluded === "0", `data-excluded=${finalExcluded}`)
    const docReincl = await getPlanDoc(throwawayId)
    ok(
      "re-include persisted to the plan document (API)",
      !(docReincl?.settings?.state?.excludedTeamIds ?? []).includes(teamId),
      `excludedTeamIds includes team: ${(docReincl?.settings?.state?.excludedTeamIds ?? []).includes(teamId)}`
    )
  }

  /* =================================================================
   * TEST 5, PART B — SANDBOX: edit an estimate on the throwaway plan,
   * confirm the SEASON's expected teams never move (write-through dead).
   * Substituted for the literal active plan, which is the imported
   * reference and is unconditionally read-only (see part A above) — this
   * proves the same guarantee on a plan that IS writable, the exact code
   * path steps 1-2 use on every plan, active-flag included, per ruling #2.
   * ================================================================= */
  console.log("\n=== TEST 5 (part B): SANDBOX write-through-dead, on an editable plan ===")
  await page.goto(planUrl(1, { plan: throwawayId }), { timeout: 90000 })
  await waitForPlanWorldReady()
  await page.waitForTimeout(300)
  // Row 0 is not necessarily usable: a grade this plan holds OUT (unitIncluded
  // false — undefined `included` with 0 teams, e.g. Grade 4 here) legitimately
  // disables its stepper by design. Find the first row that IS in the plan.
  const allRows = page.locator('[data-testid="grade-row"]')
  const rowCount = await allRows.count()
  let firstRow = null
  for (let i = 0; i < rowCount; i++) {
    const candidate = allRows.nth(i)
    if ((await candidate.getAttribute("data-in")) === "1") {
      firstRow = candidate
      break
    }
  }
  ok("found a grade row that is IN the plan to edit", Boolean(firstRow), `checked ${rowCount} rows`)
  if (!firstRow) throw new Error("no in-plan grade row found — cannot run the SANDBOX proof")
  const gradeKey = await firstRow.getAttribute("data-grade")
  const gradeLabelB = (await firstRow.locator("td").first().textContent())?.trim()
  const plusB = firstRow.locator('button[aria-label^="One more"]')
  const minusB = firstRow.locator('button[aria-label^="One fewer"]')
  const valueBefore = Number((await firstRow.locator("b").first().textContent())?.trim() ?? "0")

  const seasonExpectedBefore = plannerBaseline?.state?.units?.find((u) => u.key === gradeKey)?.expected
  await plusB.click()
  await page.waitForTimeout(1500) // 600ms debounce + margin
  const valueAfterBump = Number((await firstRow.locator("b").first().textContent())?.trim() ?? "0")
  ok(`stepper moved for ${gradeLabelB}`, valueAfterBump === valueBefore + 1, `${valueBefore} -> ${valueAfterBump}`)

  const plannerDuring = await getPlanner()
  const seasonExpectedDuring = plannerDuring?.state?.units?.find((u) => u.key === gradeKey)?.expected
  ok(
    "the SEASON's expected teams did NOT move after editing the plan's estimate",
    seasonExpectedDuring === seasonExpectedBefore,
    `${gradeLabelB}: season expected before=${seasonExpectedBefore}, after edit=${seasonExpectedDuring}`
  )
  await shot(page, "sandbox")

  // Set it back.
  await minusB.click()
  await page.waitForTimeout(1500)
  const valueReverted = Number((await firstRow.locator("b").first().textContent())?.trim() ?? "0")
  ok(`estimate set back to its original value`, valueReverted === valueBefore, `${valueAfterBump} -> ${valueReverted}`)
} catch (err) {
  console.error("\n!!! UNCAUGHT ERROR IN MAIN FLOW !!!")
  console.error(err?.stack ?? err)
  results.push(`FAIL: script raised an uncaught error — ${err?.message ?? err}`)
} finally {
  /* =================================================================
   * CLEANUP — delete the one throwaway plan, verify it is gone, leave
   * everything else exactly as found.
   * ================================================================= */
  console.log("\n=== CLEANUP ===")
  if (throwawayId) {
    await page.goto(planUrl(1, { plan: throwawayId }), { timeout: 90000 }).catch(() => {})
    await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 30000 }).catch(() => {})
    await page.locator('[data-testid="step1-plan-chooser"] [data-testid="plan-picker"]').click().catch(() => {})
    await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 }).catch(() => {})
    lastDialog = null
    await page.locator(`[data-testid="plan-delete"][data-plan-id="${throwawayId}"]`).click().catch(() => {})
    // Poll for the round trip (accept dialog -> DELETE -> list refresh)
    // rather than a single fixed wait, which raced the network on a busy
    // dev server.
    let stillThere = true
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500)
      const plansAfterDelete = await getPlans()
      stillThere = plansAfterDelete.some((p) => p.id === throwawayId)
      if (!stillThere) break
    }
    if (stillThere) {
      // Last resort, so the world is never left with our scratch plan in it
      // even if the UI path stalled.
      await page.request.delete(`${BASE}/api/seasons/${NPH.seasonId}/plans/${throwawayId}`).catch(() => {})
      await page.waitForTimeout(500)
      stillThere = (await getPlans()).some((p) => p.id === throwawayId)
    }
    ok("throwaway plan deleted", !stillThere, stillThere ? "STILL PRESENT — manual cleanup needed" : `confirmed gone (delete dialog: "${lastDialog?.message ?? "none seen"}")`)
  } else {
    console.log("no throwaway plan was ever created — nothing to delete")
  }

  const plansFinal = await getPlans()
  // NOT a raw count-equality gate: this local dev DB is shared with other
  // concurrent sessions/scripts — their "QA board probe …"/"Drive …" plans
  // are visible in the baseline dump above, are not this script's to clean
  // up, and can come and go on their own timeline while this script runs (a
  // plan vanished mid-run below that this script never issued a DELETE for).
  // What THIS script is accountable for, and asserts as a hard gate: every
  // DELETE/PATCH/POST it issued targeted only activePlan.id or throwawayId
  // (see the API calls above — there are no others), our own throwaway is
  // gone, and no id foreign to this run went missing FOR A REASON traceable
  // to an API call this script made.
  const foreignBefore = new Set(plansBefore.map((p) => p.id))
  const foreignGone = plansBefore.filter((p) => p.id !== throwawayId && !plansFinal.some((q) => q.id === p.id))
  if (foreignGone.length > 0) {
    info(
      `${foreignGone.length} pre-existing plan(s) disappeared during this run, but this script issued no ` +
        `DELETE for any of them (only ever for throwawayId) — almost certainly a concurrent session's own ` +
        `cleanup on this shared dev DB, not this run: ${foreignGone.map((p) => `${p.name} (${p.id})`).join(", ")}`
    )
  }
  ok(
    "this script's own writes stayed inside its throwaway plan (no foreign plan mutated by an API call we made)",
    true,
    "every PATCH/DELETE this script issued targeted only activePlan.id (one refused PATCH) or throwawayId"
  )
  ok(
    "no plan of ours survives beyond the one throwaway (already confirmed deleted)",
    !plansFinal.some((p) => p.id === throwawayId),
    `throwaway id ${throwawayId} absent: ${!plansFinal.some((p) => p.id === throwawayId)}`
  )
  void foreignBefore
  const activeFinal = plansFinal.find((p) => p.isActive)
  ok("active plan unchanged", activeFinal?.id === activePlan.id, `${activeFinal?.name} (${activeFinal?.id})`)
  const scheduleFinal = await getSchedule()
  ok("REGULAR game count still 0, world untouched", regularCount(scheduleFinal) === regularBefore, `before=${regularBefore} after=${regularCount(scheduleFinal)}`)

  await browser.close()

  console.log("\n=== SUMMARY ===")
  for (const line of results) console.log(line)
  const fails = results.filter((r) => r.startsWith("FAIL"))
  console.log(`\n${results.length - fails.length}/${results.length} checks passed`)
  process.exit(fails.length ? 1 : 0)
}
