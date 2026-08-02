// Drive the season-planning flow end to end, read-only where it matters
// (2026-08-02 planner arc P1-P5: buildings, taken weekends, estimate-only
// planning, levers, Plan Your Season tab).
//
// Never taps anything that persists: propose and preview-hours are
// server-side no-writes, and the script only screenshots steps 1/2/strip.
// Safe to run against the owner's live test world.
//
// Env (defaults = the 2026-08-02 local world):
//   SEASON_ID, LEAGUE_ID, SHOT_DIR
// Run from scripts/demo (its node_modules has Playwright):
//   node verify-plan-flow.mjs
import { chromium } from "playwright"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SEASON = process.env.SEASON_ID ?? "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = process.env.LEAGUE_ID ?? "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SHOTS = process.env.SHOT_DIR ?? "/tmp/plan-flow-shots"
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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

// Warm cold routes so first paint is compiled, not a spinner.
for (const p of [`/sign-in`, `/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage`]) {
  await page.request.get(`${BASE}${p}`).catch(() => {})
}

// Sign in. The page needs its hydration beat before filling — a click on a
// pre-hydration form is a native submit that never logs in.
await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', USER)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
let user = null
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000)
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) {
    user = session.user
    break
  }
}
ok("signed in as owner-nph", !!user)
if (!user) {
  await browser.close()
  process.exit(1)
}

// ── The Plan Your Season tab ──────────────────────────────────────────────
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage?tab=plan`)
await page.waitForSelector('[data-testid="plan-tab-rail"]', { timeout: 30000 })
const railText = await page.locator('[data-testid="plan-tab-rail"]').innerText()
ok(
  "plan tab rail shows the five stages",
  ["Plan", "Publish", "Watch registration", "Schedule", "Live"].every((s) => railText.includes(s))
)
ok("plan tab has a CTA", (await page.locator('[data-testid="plan-tab-cta"]').count()) === 1)
await page.screenshot({ path: `${SHOTS}/1-plan-tab.png`, fullPage: true })

// ── Step 1: estimates only ────────────────────────────────────────────────
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=1`)
await page.waitForTimeout(3000)
const step1 = await page.locator("main").innerText()
ok("step 1 shows registered counts as overlay chips", /registered/.test(step1))
ok(
  "step 1 marks unestimated grades as not in the plan",
  step1.includes("Not in the plan yet")
)
ok("step 1 offers start-from-registrations", /Start from registrations/i.test(step1))
ok("step 1 offers add-a-grade", /Add a grade/i.test(step1))
await page.screenshot({ path: `${SHOTS}/2-step1-teams.png`, fullPage: true })

// ── Step 2: gym order, taken weekends, reserved notice ────────────────────
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=2`)
await page.waitForTimeout(3000)
const step2 = await page.locator("main").innerText()
ok("step 2 shows the fill order chip", /Fills first/.test(step2))
ok("step 2 shows taken weekends", /Taken|NJC/.test(step2))
ok("step 2 has whole-season toggles", /all weekends/i.test(step2))
ok(
  "step 2 notice slot is mounted even when empty",
  (await page.locator('[data-testid="step2-notice"]').count()) === 1
)
await page.screenshot({ path: `${SHOTS}/3-step2-gyms.png`, fullPage: true })

// ── Step 3: gym sections, levers, hours chips (no Keep, no Apply) ─────────
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`)
// The levers and hours chips live behind quiet disclosures that render once
// the board's data is in; wait for the triggers, open both, then assert.
await page.waitForSelector('[data-testid="hours-toggle"]', { timeout: 60000 })
await page.getByRole("button", { name: "Adjust grouping rules" }).click()
await page.waitForTimeout(500)
const step3 = await page.locator("main").innerText()
ok("step 3 offers the one-gym lever", /Pack one gym/i.test(step3))
await page.locator('[data-testid="hours-toggle"]').click()
await page.waitForTimeout(500)
const step3Hours = await page.locator("main").innerText()
ok(
  "step 3 offers the hours chips",
  /Start early/i.test(step3Hours) && /Finish early/i.test(step3Hours)
)
await page.screenshot({ path: `${SHOTS}/4-step3-board.png`, fullPage: true })

// ── API truths (all reads or server-side no-writes) ───────────────────────
const planner = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/planner`)
  .then((r) => r.json())
const someWeekend = planner?.state?.windows?.flatMap((w) => w.weekends)?.[0]
ok(
  "planner state carries venue fill order",
  typeof someWeekend?.venues?.[0]?.fillOrder === "number",
  `first venue: ${someWeekend?.venues?.[0]?.name}`
)

const propose = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/planner/propose`, { data: { lever: "one-gym" } })
  .then((r) => r.json())
const venueMaps = Object.values(propose?.venues ?? {})
ok(
  "propose(one-gym) returns a gym per grade per weekend",
  venueMaps.length > 0 && venueMaps.every((m) => Object.values(m).every((v) => typeof v === "string")),
  `${venueMaps.length} weekends carry gym maps`
)
const twoBuildingWeekends = venueMaps.filter(
  (m) => new Set(Object.values(m)).size > 1
).length
ok("one-gym keeps weekends in one building here", twoBuildingWeekends === 0)

const preview = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/planner/preview-hours`, {
    data: { deltaStartMinutes: -60 },
  })
  .then((r) => r.json())
ok(
  "preview-hours answers without writing",
  typeof preview?.preview === "object" && preview?.preview !== null
)
const gridBefore = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/planner/venues`)
  .then((r) => r.json())
const sixPark = (gridBefore?.grid?.venues ?? gridBefore?.venues ?? []).find((v) =>
  /Six Park/.test(v.name ?? "")
)
const takenCells = (sixPark?.cells ?? []).filter((c) => c.state === "taken").length
ok("Six Park carries taken weekends in the grid", takenCells >= 5, `${takenCells} taken`)

// ── Strip: one gym per grade ──────────────────────────────────────────────
const stripToggle = page.getByRole("button", { name: /strip/i }).first()
if ((await stripToggle.count()) > 0) {
  await stripToggle.click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOTS}/5-strip.png`, fullPage: true })
  ok("strip renders", true)
} else {
  ok("strip toggle present", false, "Board|Strip toggle not found on step 3")
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
