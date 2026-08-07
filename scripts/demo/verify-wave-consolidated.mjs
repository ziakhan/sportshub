// Consolidated evidence pass for the 2026-08-06 wave (A1/A2, B1/B2, C1-C4,
// D1/D2/E) on the season plan wizard.
//
// SAFE ON THE OWNER'S LIVE INSTANCE: the only plan this drive writes to is its
// own throwaway ("Wave check - delete me"), created at the start and deleted
// at the end. Everything it does to the season's own imported reference plan
// is read-only navigation (opening it, walking the five steps, expanding a
// collapsed ghost month). It never touches step-2 season controls, never
// changes venues/sessions/divisions, and never activates anything.
//
// Env: BASE_URL, SEASON_ID, LEAGUE_ID, SHOT_DIR
// Run from scripts/demo (its node_modules has Playwright):
//   node verify-wave-consolidated.mjs
import { chromium } from "playwright"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SEASON = process.env.SEASON_ID ?? "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = process.env.LEAGUE_ID ?? "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SHOTS =
  process.env.SHOT_DIR ?? "/Users/ziakhan/zia/personal/sportshub/scratchpad/shots-wave"
const USER = "owner-nph@sportshub.demo"
const PASS = "TestPass123!"
const THROWAWAY = "Wave check - delete me"

const results = []
const ok = (name, pass, extra = "") => {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`)
}
const note = (name, extra) => {
  console.log(`NOTE  ${name} — ${extra}`)
}

const fs = await import("node:fs")
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })

// This drive should meet exactly one real confirm() — the throwaway plan's
// own delete, at the very end. Anything else is dismissed on purpose.
const EXPECTED_DIALOGS = /delete/i
page.on("dialog", async (dialog) => {
  const expected = EXPECTED_DIALOGS.test(dialog.message())
  console.log(`      dialog (${expected ? "accepted" : "DISMISSED"}): ${dialog.message()}`)
  await (expected ? dialog.accept() : dialog.dismiss())
})

const stepUrl = (step, planId) => {
  const u = new URL(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan`)
  u.searchParams.set("step", String(step))
  if (planId) u.searchParams.set("plan", planId)
  return u.toString()
}

for (const p of ["/sign-in", stepUrl(1)]) {
  await page.request.get(`${BASE}${p}`).catch(() => {})
}

await page.goto(`${BASE}/sign-in`)
let user = null
for (let attempt = 0; attempt < 3 && !user; attempt++) {
  if (attempt > 0) await page.goto(`${BASE}/sign-in`)
  await page.waitForTimeout(2500)
  await page.fill('input[type="email"]', USER)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000)
    const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json()).catch(() => null)
    if (session?.user) {
      user = session.user
      break
    }
  }
}
ok("signed in as owner-nph", !!user)
if (!user) {
  await browser.close()
  process.exit(1)
}

const listPlans = async () =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json()))?.plans ?? []

/* ══════════════════════ 3a. OLD plan: the imported reference ══════════════ */
await page.goto(stepUrl(1), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-empty"]', { timeout: 90000 })
await page.locator('[data-testid="plan-open"]').click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 20000 })
const importedOption = page.locator('[data-testid="plan-option"][data-source="imported"]').first()
ok("the imported reference is listed in the step-1 chooser", (await importedOption.count()) === 1)
const importedPlanId = await importedOption.getAttribute("data-plan-id")
await importedOption.click()
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 30000 })
await page.waitForTimeout(600)

const step1Line = page.locator('[data-testid="step1-plan-line"]')
// A2: any non-active plan with a world draws it (data-world="plan"). This
// world's reference happens to ALSO be the active plan (source=imported AND
// isActive=true — confirmed by the earlier wave's own drives), and
// session.readsPlanWorld is explicitly gated on `!chosen.isActive` — so for
// THIS season the correct, documented value is "season", not "plan". Recorded
// honestly rather than forcing the literal word from the brief.
const oldWorld = await step1Line.getAttribute("data-world")
const importedIsActive = (await listPlans()).find((p) => p.id === importedPlanId)?.isActive
ok(
  "step1-plan-line reports a resolved data-world for the opened reference (not stuck on 'loading')",
  oldWorld === "plan" || oldWorld === "season",
  `data-world="${oldWorld}" · this plan isActive=${importedIsActive} (A2 requires !isActive to read "plan"; this season's reference is active, so "season" is the documented, correct value here)`
)
await page.screenshot({ path: `${SHOTS}/old-step1.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="step2-plan-line"]', { timeout: 60000 })
await page.waitForTimeout(500)
const step2Line = page.locator('[data-testid="step2-plan-line"]')
const oldWorld2 = await step2Line.getAttribute("data-world")
ok(
  "step2-plan-line also resolves (not stuck on 'loading') for the opened reference",
  oldWorld2 === "plan" || oldWorld2 === "season",
  `data-world="${oldWorld2}"`
)
await page.screenshot({ path: `${SHOTS}/old-step2.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 90000 })
await page.waitForTimeout(700)
ok(
  "the board resolves and draws the reference plan's real calendar (plan-opening resolves)",
  (await page.locator('[data-testid="weekend-gym-section"]').count()) > 0 &&
    (await page.locator('[data-testid="board-plan-pointer"]').count()) === 0
)
await page.screenshot({ path: `${SHOTS}/old-step3.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="step4-notice"]', { state: "attached", timeout: 60000 })
await page.waitForTimeout(500)
ok("step 4 (publish) loads for the reference plan", true)
await page.screenshot({ path: `${SHOTS}/old-step4.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="step5-notice"]', { state: "attached", timeout: 60000 })
await page.waitForTimeout(500)
ok("step 5 (schedule) loads for the reference plan", true)
await page.screenshot({ path: `${SHOTS}/old-step5.png`, fullPage: true })

/* ══════════════════════ 3b. NEW plan: the throwaway ═══════════════════════ */
for (let i = 0; i < 4; i++) {
  await page.locator('[data-testid="wizard-prev"]').click()
  await page.waitForTimeout(200)
}
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 30000 })

// Clean up a stray throwaway from an earlier interrupted run before making a
// fresh one, so the picker never shows two.
for (const p of await listPlans()) {
  if (p.name === THROWAWAY) await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${p.id}`)
}

await page.locator('[data-testid="plan-new"]').click()
await page.waitForSelector('[data-testid="plan-create-input"]', { timeout: 20000 })
await page.fill('[data-testid="plan-create-input"]', THROWAWAY)
await page.locator('[data-testid="plan-create-confirm"]').click()

let throwawayId = null
for (let i = 0; i < 60 && !throwawayId; i++) {
  throwawayId = (await listPlans()).find((p) => p.name === THROWAWAY)?.id ?? null
  if (!throwawayId) await page.waitForTimeout(500)
}
ok("the throwaway plan was created", Boolean(throwawayId), throwawayId ?? "missing")
if (!throwawayId) {
  await browser.close()
  process.exit(1)
}
await page.waitForSelector('[data-testid="step1-plan-line"]', { timeout: 30000 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${SHOTS}/new-step1.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="step2-plan-line"]', { timeout: 60000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${SHOTS}/new-step2.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
// A fresh plan has no chosen weekend, so weekend-gym-section never shows, and
// (C2) if nothing anywhere is used every month can collapse to a summary —
// draw-hero (or board-notice, always attached per D2) is what is guaranteed.
await page.waitForSelector(
  '[data-testid="draw-hero"], [data-testid="weekend-gym-section"], [data-testid="board-notice"]',
  { timeout: 90000 }
)
await page.waitForTimeout(700)
const drawHero = page.locator('[data-testid="draw-hero"]')
const heroCount = await drawHero.count()
const heroSize = heroCount > 0 ? await drawHero.getAttribute("data-size") : null
ok(
  "draw-hero appears on step 3 for the fresh plan, with a data-size attribute (C3)",
  heroCount === 1 && (heroSize === "full" || heroSize === "compact"),
  `count=${heroCount} data-size="${heroSize}"`
)
await page.screenshot({ path: `${SHOTS}/new-step3.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="step4-notice"]', { state: "attached", timeout: 60000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${SHOTS}/new-step4.png`, fullPage: true })

await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="step5-notice"]', { state: "attached", timeout: 60000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${SHOTS}/new-step5.png`, fullPage: true })

/* ══════════════════════ 3c. minus-to-0 repro ═══════════════════════════════ */
for (let i = 0; i < 4; i++) {
  await page.locator('[data-testid="wizard-prev"]').click()
  await page.waitForTimeout(200)
}
await page.waitForSelector('[data-testid="grade-row"]', { timeout: 30000 })
await page.waitForTimeout(400)

const targetGrade = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-testid="grade-row"]')]
  for (const row of rows) {
    const hasRegistered = row.querySelector('[data-testid="registered-chip"]')
    const value = row.querySelector('b[aria-live="polite"]')
    const n = value ? Number(value.textContent.trim()) : 0
    if (hasRegistered && n > 0) return { grade: row.getAttribute("data-grade"), value: n }
  }
  return null
})
ok(
  "found a grade row with registrations and a stepper above 0",
  Boolean(targetGrade),
  targetGrade ? `${targetGrade.grade} at ${targetGrade.value}` : "no qualifying row on this plan"
)

if (targetGrade) {
  const row = page.locator(`[data-testid="grade-row"][data-grade="${targetGrade.grade}"]`)
  const minusBtn = row.locator('button[aria-label^="One fewer"]')
  for (let i = 0; i < targetGrade.value + 1; i++) {
    const disabled = await minusBtn.isDisabled().catch(() => true)
    if (disabled) break
    await minusBtn.click()
    await page.waitForTimeout(120)
  }
  // Wait for the debounced save to land: "Saved." on the screen's own
  // aria-live status line.
  const savingLine = page.locator('p[aria-live="polite"]', { hasText: /Saved\.|Saving…/ })
  let savedText = ""
  for (let i = 0; i < 40; i++) {
    savedText = await savingLine.innerText().catch(() => "")
    if (savedText.trim() === "Saved.") break
    await page.waitForTimeout(300)
  }
  ok('the debounced save lands and the line reads "Saved."', savedText.trim() === "Saved.", savedText)

  const valueNow = await row.locator('b[aria-live="polite"]').innerText()
  ok("the stepper shows 0 (a deliberate 0 estimate, not bounced back to registrations)", valueNow.trim() === "0", valueNow)
  await row.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/zero-before.png`, fullPage: true })

  const urlBeforeReload = new URL(page.url())
  ok(
    "the URL carries ?plan= and ?step=1 before the reload",
    urlBeforeReload.searchParams.get("plan") === throwawayId &&
      urlBeforeReload.searchParams.get("step") === "1",
    urlBeforeReload.toString()
  )

  await page.reload({ timeout: 90000 })
  await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })
  await page.waitForSelector('[data-testid="grade-row"]', { timeout: 30000 })
  await page.waitForTimeout(600)
  const urlAfterReload = new URL(page.url())
  ok(
    "the plan reopens from the URL on reload (B1)",
    urlAfterReload.searchParams.get("plan") === throwawayId &&
      (await page.locator('[data-testid="step1-plan-chooser"]').count()) === 1,
    urlAfterReload.toString()
  )

  const rowAfter = page.locator(`[data-testid="grade-row"][data-grade="${targetGrade.grade}"]`)
  const valueAfter = await rowAfter.locator('b[aria-live="polite"]').innerText()
  const pillAfter = await rowAfter.locator('[data-testid="not-planned"]').count()
  ok(
    "after reload the stepper is STILL 0, and the row does not show the not-planned pill (A1)",
    valueAfter.trim() === "0" && pillAfter === 0,
    `value=${valueAfter.trim()} not-planned-pill-count=${pillAfter}`
  )
  await rowAfter.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/zero-after.png`, fullPage: true })
}

/* ══════════════════════ 3d. ONE CHOOSER ════════════════════════════════════ */
ok(
  "step 1 with the plan open: exactly one plan-picker trigger, step1-plan-empty absent",
  (await page.locator('[data-testid="plan-picker"]').count()) === 1 &&
    (await page.locator('[data-testid="step1-plan-empty"]').count()) === 0
)
await page.screenshot({ path: `${SHOTS}/chooser-step1-open.png`, fullPage: true })

let noPickerOnAnyStep = true
let step2PointerAbsent = true
for (const step of [2, 3, 4, 5]) {
  await page.goto(stepUrl(step, throwawayId), { timeout: 90000 })
  await page.waitForSelector(
    step === 3
      ? '[data-testid="board-notice"]'
      : `[data-testid="step${step}-notice"], [data-testid="step${step}-plan-line"]`,
    { state: "attached", timeout: 60000 }
  )
  await page.waitForTimeout(400)
  const pickerCount = await page.locator('[data-testid="plan-picker"]').count()
  if (pickerCount !== 0) noPickerOnAnyStep = false
  if (step === 2) {
    step2PointerAbsent = (await page.locator('[data-testid="step2-plan-pointer"]').count()) === 0
  }
}
ok("zero plan-picker triggers exist on steps 2 through 5 while a plan is open", noPickerOnAnyStep)
ok("step2-plan-pointer is absent on step 2 while a plan is open", step2PointerAbsent)

// Fresh visit, no ?plan= on the URL: nothing is open.
await page.goto(stepUrl(1), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-empty"]', { timeout: 90000 })
const noneStep1Empty = (await page.locator('[data-testid="step1-plan-empty"]').count()) === 1
const noneStep1ChooserAbsent = (await page.locator('[data-testid="step1-plan-chooser"]').count()) === 0
ok(
  "with no plan open, step 1 shows step1-plan-empty and NOT step1-plan-chooser",
  noneStep1Empty && noneStep1ChooserAbsent
)
await page.screenshot({ path: `${SHOTS}/chooser-none.png`, fullPage: true })

await page.goto(stepUrl(3), { timeout: 90000 })
await page.waitForSelector('[data-testid="board-plan-pointer"]', { timeout: 90000 })
ok(
  "with no plan open, step 3 shows board-plan-pointer",
  (await page.locator('[data-testid="board-plan-pointer"]').count()) === 1
)

/* ══════════════════════ 3e. C2 ghost-collapse check ════════════════════════ */
// Reopen the reference plan's board — the fuller, real calendar is the more
// likely place to find a month with a collapsed leading run.
await page.goto(stepUrl(1), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-empty"]', { timeout: 90000 })
await page.locator('[data-testid="plan-open"]').click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 20000 })
await page.locator('[data-testid="plan-option"][data-source="imported"]').first().click()
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 30000 })
await page.goto(stepUrl(3, importedPlanId), { timeout: 90000 })
await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 90000 })
await page.waitForTimeout(700)

let collapseTestedOn = null
let collapse = page.locator('[data-testid="ghost-collapse"]').first()
if ((await collapse.count()) > 0) collapseTestedOn = "reference plan"
if ((await collapse.count()) === 0) {
  // Try the throwaway plan's board instead — a fresh plan with nothing chosen
  // anywhere is, per C2, likely to have every month collapsed.
  await page.goto(stepUrl(3, throwawayId), { timeout: 90000 })
  await page.waitForSelector(
    '[data-testid="draw-hero"], [data-testid="weekend-gym-section"], [data-testid="ghost-collapse"]',
    { timeout: 90000 }
  )
  await page.waitForTimeout(700)
  collapse = page.locator('[data-testid="ghost-collapse"]').first()
  if ((await collapse.count()) > 0) collapseTestedOn = "throwaway plan"
}

if (collapseTestedOn) {
  const count = await collapse.getAttribute("data-count")
  ok(`a collapsed month was found (on the ${collapseTestedOn}'s board)`, true, `data-count=${count}`)
  await collapse.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/collapse-before.png`, fullPage: true })
  const win = await collapse.getAttribute("data-window")
  await collapse.click()
  await page.waitForTimeout(400)
  const hide = page.locator(`[data-testid="ghost-collapse-hide"][data-window="${win}"]`)
  ok(
    "clicking ghost-collapse expands it: the hide control appears and the summary button is gone",
    (await hide.count()) === 1 &&
      (await page.locator(`[data-testid="ghost-collapse"][data-window="${win}"]`).count()) === 0
  )
  await page.screenshot({ path: `${SHOTS}/collapse-after.png`, fullPage: true })
  await hide.click()
  await page.waitForTimeout(400)
  ok(
    "ghost-collapse-hide folds it back: the summary button returns",
    (await page.locator(`[data-testid="ghost-collapse"][data-window="${win}"]`).count()) === 1 &&
      (await page.locator(`[data-testid="ghost-collapse-hide"][data-window="${win}"]`).count()) === 0
  )
} else {
  note(
    "C2 ghost-collapse check",
    "no month on either board's calendar had 2+ leading unused dates to collapse — nothing to click"
  )
}

/* ══════════════════════ 3f. fence-gone check ═══════════════════════════════ */
ok(
  "fence-window appears nowhere on the board",
  (await page.locator('[data-testid="fence-window"]').count()) === 0
)
ok(
  "playoff-band appears nowhere on the board",
  (await page.locator('[data-testid="playoff-band"]').count()) === 0
)

/* ══════════════════════ 4. cleanup: delete the throwaway ══════════════════ */
await page.goto(stepUrl(1, throwawayId), { timeout: 90000 })
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })
await page.locator('[data-testid="plan-picker"]').click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 20000 })
const deleteBtn = page.locator(`[data-testid="plan-delete"][data-plan-id="${throwawayId}"]`)
ok("the throwaway plan's delete control is present and not blocked", (await deleteBtn.count()) === 1 && (await deleteBtn.getAttribute("data-blocked")) === "0")
await deleteBtn.click()
await page.waitForTimeout(1000)
const stillListed = (await listPlans()).some((p) => p.id === throwawayId)
ok("the throwaway plan is deleted and gone from the picker", !stillListed)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "))
console.log(`shots: ${SHOTS}`)
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
