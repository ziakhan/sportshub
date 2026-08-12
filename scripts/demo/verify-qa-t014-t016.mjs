// QA T-014 + T-016 drive (2026-08-11): the teams-step affordance fixes and
// the consolidation suggestion with the T-019 preview-confirm interaction.
//
// Stages its own throwaway plans over the live local world and deletes them
// after; nothing it creates survives the run.
//
// Env (defaults = the Showcase gate world):
//   SEASON_ID, LEAGUE_ID, SHOT_DIR
// Run from scripts/demo (its node_modules has Playwright):
//   node verify-qa-t014-t016.mjs
import { chromium } from "playwright"
import { openPlanFromStep1 } from "./plan-board-lib.mjs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SEASON = process.env.SEASON_ID ?? "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = process.env.LEAGUE_ID ?? "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SHOTS = process.env.SHOT_DIR ?? "/tmp/qa-t014-t016-shots"
const USER = "owner-nph@sportshub.demo"
const PASS = "TestPass123!"

const results = []
const ok = (name, pass, extra = "") => {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`)
}

const fs = await import("node:fs")
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

for (const p of [`/sign-in`, `/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan`]) {
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
    const session = await page.request
      .get(`${BASE}/api/auth/session`)
      .then((r) => r.json())
      .catch(() => null)
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

const planUrl = `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan`
const madePlans = []

// A crashed earlier run may have left staging plans behind; clear them first
// so the picker and the rail are never matching a stale twin.
const existing = await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json())
for (const p of existing.plans ?? []) {
  if (/^QA T-01[46] drive/.test(p.name)) {
    await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${p.id}`)
  }
}

/* ------------------------- T-016: consolidation ------------------------- */

// Stage: the smallest grade alone on a month's first weekend, pinned to a
// RENTED gym, with the rest of the month free to absorb it.
const planner = await page.request.get(`${BASE}/api/seasons/${SEASON}/planner`).then((r) => r.json())
const state = planner.state
const unit = [...state.units].filter((u) => u.teams > 0).sort((a, b) => a.teams - b.teams)[0]
const win = state.windows.find((w) => w.weekends.length >= 2)
const w1 = win.weekends[0]
const w2 = win.weekends[1]
const pool = w1.venues.find((v) => v.role === "pool")
ok(
  "staging pieces exist (unit, two weekends in one month, a rented gym)",
  Boolean(unit && w1 && w2 && pool),
  `${unit?.label} on ${w1?.label}, rented ${pool?.name}`
)

const t016 = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/plans`, {
    data: {
      name: "QA T-016 drive",
      source: "manual",
      assignment: { [w1.sessionId]: [unit.key] },
      venues: { [w1.sessionId]: { [unit.key]: pool.venueId } },
    },
  })
  .then((r) => r.json())
ok("T-016 staging plan created", Boolean(t016?.plan?.id))
madePlans.push(t016.plan.id)

await openPlanFromStep1(page, `${planUrl}?step=3`, t016.plan.id)
await page.locator('[data-testid="rail-tab"]').click()
await page.waitForSelector('[data-testid="suggestion-rail"]', { timeout: 30000 })
// The idea may sit behind the fold.
if ((await page.locator('[data-testid="more-ideas"]').count()) > 0) {
  await page.locator('[data-testid="more-ideas"]').first().click()
}
const idea = page.locator('[data-testid="rail-idea"]', { hasText: "releases the weekend" })
ok("the rail offers a consolidation idea (releases the weekend)", (await idea.count()) > 0)
const ideaCost = await idea.locator('[data-testid="idea-cost"]').innerText().catch(() => "")
ok(
  "the idea says the booking comes off the ask sheet",
  /off the ask sheet/.test(ideaCost),
  ideaCost.replace(/\n/g, " ").slice(0, 120)
)

// T-019 preview-confirm: FIRST click pins the preview, never applies.
const askBefore = await page.locator('[data-testid="suggestion-rail"]').innerText()
await idea.locator('[data-testid="suggestion-move"]').click()
await page.waitForTimeout(400)
ok(
  "first click flips the button to the confirm (Apply move), nothing applied",
  (await idea.locator('[data-testid="suggestion-apply"]').count()) === 1 &&
    (await page.locator('[data-testid="board-notice"]').innerText().catch(() => "")).includes(
      "off the plan"
    ) === false
)
ok(
  "both ends of the move draw their preview strips (before → after)",
  (await page.locator('[data-testid="weekend-preview"]').count()) === 2
)
ok(
  "the source card says the weekend comes off the plan",
  /comes off the plan/.test(
    await page.locator('[data-testid="weekend-preview"][data-role="from"]').innerText()
  )
)
await page.screenshot({ path: `${SHOTS}/t016-consolidation-preview.png`, fullPage: true })

// SECOND click applies: the move lands AND the weekend is released whole.
await idea.locator('[data-testid="suggestion-apply"]').click()
await page.waitForTimeout(800)
const notice = await page.locator('[data-testid="board-notice"]').innerText().catch(() => "")
ok(
  "the confirm applies the move and releases the weekend",
  /off the plan/.test(notice) && /off the ask sheet/.test(notice),
  notice.replace(/\n/g, " ").slice(0, 140)
)
ok(
  "the released weekend now draws as a ghost row, not a card",
  (await page.locator(`[data-testid="ghost-date"][data-session-id="${w1.sessionId}"]`).count()) ===
    1 && (await page.locator(`div[data-session-id="${w1.sessionId}"]:not([data-testid="ghost-date"])`).count()) === 0
)
ok(
  "one undo pill offers the whole thing back",
  (await page.locator('[data-testid="undo-float"]').count()) === 1,
  await page.locator('[data-testid="undo-float"]').innerText().catch(() => "")
)
await page.screenshot({ path: `${SHOTS}/t016-after-apply.png`, fullPage: true })

await page.locator('[data-testid="undo-float"] button, button[data-testid="undo-float"]').first().click()
await page.waitForTimeout(600)
ok(
  "undo restores the released weekend as a card",
  (await page.locator(`[data-session-id="${w1.sessionId}"]`).count()) >= 1 &&
    (await page
      .locator(`[data-testid="ghost-date"][data-session-id="${w1.sessionId}"]`)
      .count()) === 0
)

/* ------------------------ T-014: the teams step ------------------------- */

const t014 = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/plans`, {
    data: { name: "QA T-014 drive", source: "manual", assignment: {} },
  })
  .then((r) => r.json())
ok("T-014 staging plan created", Boolean(t014?.plan?.id))
madePlans.push(t014.plan.id)

await openPlanFromStep1(page, `${planUrl}?step=1`, t014.plan.id)
await page.waitForSelector('[data-testid="grade-row"]', { timeout: 30000 })

// Remove a grade from the plan entirely — the fold-in row it leaves behind is
// exactly the zero-unit row the dead toggle used to render on.
page.once("dialog", (d) => d.accept())
const removed = page.locator('[data-testid="grade-row"]').first()
const removedLabel = (await removed.locator("td").first().innerText()).trim()
await removed.locator('[data-testid="grade-remove"]').click()
await page.waitForTimeout(1200)

const foldRow = page.locator('[data-testid="grade-row"]', { hasText: removedLabel })
ok(
  "a zero-unit row offers + Add this grade instead of the dead toggle",
  (await foldRow.locator('[data-testid="grade-add-to-plan"]').count()) === 1 &&
    (await foldRow.locator('[data-testid="grade-in-out"]').count()) === 0
)
await page.screenshot({ path: `${SHOTS}/t014-add-this-grade.png`, fullPage: true })

await foldRow.locator('[data-testid="grade-add-to-plan"]').click()
await page.waitForTimeout(1200)
ok(
  "+ Add this grade puts the grade back in the plan (live toggle again)",
  (await foldRow.locator('[data-testid="grade-in-out"][data-in="1"]').count()) === 1 &&
    (await foldRow.locator('[data-testid="grade-add-to-plan"]').count()) === 0
)

// The silent-inert states: the reference calendar shows the pill visibly
// disabled, with the reason on it.
await page.locator('[data-testid="step1-plan-chooser"] [data-testid="plan-picker"], [data-testid="plan-open"]').first().click()
await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
await page.locator('[data-testid="plan-option"][data-source="imported"]').first().click()
await page.waitForTimeout(1200)
const disabledPill = page.locator('[data-testid="grade-in-out"][data-disabled="1"]').first()
ok(
  "the reference calendar's pill is visibly disabled with the reason",
  (await page.locator('[data-testid="grade-in-out"][data-disabled="1"]').count()) > 0 &&
    /open one of your plans/i.test((await disabledPill.getAttribute("title")) ?? ""),
  (await disabledPill.getAttribute("title")) ?? ""
)
await page.screenshot({ path: `${SHOTS}/t014-disabled-pill.png`, fullPage: true })

/* ------------------------------- cleanup -------------------------------- */

for (const id of madePlans) {
  const res = await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${id}`)
  ok(`staging plan ${id.slice(0, 8)} deleted`, res.ok())
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) process.exit(1)
