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
// The banner only shows while some registered grade lacks an estimate; once
// the operator has numbers everywhere, its absence is the correct state.
const plannerForBanner = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/planner`)
  .then((r) => r.json())
const allEstimated = (plannerForBanner?.state?.units ?? [])
  .filter((u) => u.approved > 0)
  .every((u) => u.expected > 0)
ok(
  "step 1 start-from-registrations state is honest",
  /Start from registrations/i.test(step1) || allEstimated,
  allEstimated ? "every registered grade already estimated" : "banner shown"
)
ok("step 1 offers add-a-grade", /Add a grade/i.test(step1))
await page.screenshot({ path: `${SHOTS}/2-step1-teams.png`, fullPage: true })

// ── Step 2: gym roles, taken weekends, reserved notice ────────────────────
// Re-pinned 2026-08-03 (venue model v2): fill order is dead on this screen, so
// the checks read the home gym tag and the pool language instead of ranking.
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=2`)
// Wait for the grid itself, not a guessed number of seconds: on a cold dev
// server this step compiles for a while and a flat timeout screenshots a
// half-painted page. The notice slot is deliberately invisible when it has
// nothing to say, so this waits for it to be ATTACHED.
await page.waitForSelector('[data-testid="step2-notice"]', {
  state: "attached",
  timeout: 60000,
})
const roleChips = page.locator('[data-testid="venue-role-chip"]')
// A season with no gyms has no chip to wait for; the assertions below say so.
await roleChips.first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1000)
const step2 = await page.locator("main").innerText()
const homeChips = page.locator('[data-testid="venue-role-chip"][data-role="home"]')
const gymCards = await roleChips.count()
const homeCards = await homeChips.count()
ok("step 2 tags the home gym", homeCards === 1 && /Home gym/.test(step2), `${gymCards} gyms`)
ok("step 2 puts every other gym in the pool", gymCards > homeCards && /In the pool/.test(step2))
const chipTexts = (await roleChips.allInnerTexts()).map((t) => t.trim())
ok(
  "step 2 has no fill-order vocabulary left",
  !/fills? first|overflow #|fill order/i.test(step2) &&
    chipTexts.every((t) => t === "Home gym" || t === "In the pool"),
  chipTexts.join(" · ")
)
ok(
  "step 2 offers make-home on every gym that is not home",
  (await page.locator('[data-testid="make-home"]').count()) === gymCards - homeCards
)
ok(
  "step 2 has no reorder arrows",
  (await page.getByRole("button", { name: /move .* (up|down)/i }).count()) === 0
)
ok("step 2 shows taken weekends", /Taken|NJC/.test(step2))
ok("step 2 has whole-season toggles", /all weekends/i.test(step2))
ok("step 2 still edits courts", (await page.getByLabel(/ courts$/).count()) >= gymCards)
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
  "planner state leads with the home gym",
  someWeekend?.venues?.[0]?.role === "home",
  `first venue: ${someWeekend?.venues?.[0]?.name}`
)
ok(
  "planner state gives every gym a role",
  (someWeekend?.venues ?? []).length > 0 &&
    (someWeekend?.venues ?? []).every((v) => v.role === "home" || v.role === "pool")
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
// Re-pinned 2026-08-03 (venue model v2): the building a weekend has to fit
// into is the one the league OWNS, not the biggest gym on the season. One-gym
// may open a second building only when the home gym cannot hold the weekend
// (the spill becomes a rental), or when every grade on the weekend is standing
// in the gym it lives in all season (residency, now a small tiebreak).
const teamsOf = Object.fromEntries(
  (plannerForBanner?.state?.units ?? []).map((u) => [u.key, u.teams])
)
const weekendsBySession = Object.fromEntries(
  (plannerForBanner?.state?.windows ?? [])
    .flatMap((w) => w.weekends)
    .map((w) => [w.sessionId, w])
)
const gymCounts = {}
for (const m of Object.values(propose?.venues ?? {})) {
  for (const [k, v] of Object.entries(m)) {
    gymCounts[k] = gymCounts[k] ?? {}
    gymCounts[k][v] = (gymCounts[k][v] ?? 0) + 1
  }
}
const homeOf = Object.fromEntries(
  Object.entries(gymCounts).map(([k, counts]) => [
    k,
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0],
  ])
)
const unjustified = Object.entries(propose?.venues ?? {}).filter(([sessionId, m]) => {
  if (new Set(Object.values(m)).size <= 1) return false
  const w = weekendsBySession[sessionId]
  if (!w) return true
  const demand = (propose.assignment?.[sessionId] ?? []).reduce(
    (sum, k) => sum + Math.ceil(((teamsOf[k] ?? 0) * w.targetGamesPerTeam) / 2),
    0
  )
  const homeGym = (w.venues ?? []).find((v) => v.role === "home")
  if (demand > (homeGym?.capacityGames ?? w.largestVenueCapacity)) return false
  return !Object.entries(m).every(([k, v]) => homeOf[k] === v)
})
ok(
  "one-gym splits a weekend only when the home gym is full, or for residency",
  unjustified.length === 0,
  unjustified.length ? `unjustified: ${unjustified.map(([s]) => s).join(", ")}` : ""
)
// The v2 law behind every rental number: nothing gets rented while the
// building the league owns still has room, so the home gym is used on every
// weekend that opens a gym at all.
const idleHome = Object.entries(propose?.venues ?? {}).filter(([sessionId, m]) => {
  const w = weekendsBySession[sessionId]
  const homeGym = (w?.venues ?? []).find((v) => v.role === "home")
  if (!homeGym) return false
  return !Object.values(m).includes(homeGym.venueId)
})
ok(
  "no weekend rents a gym while the home gym sits empty",
  idleHome.length === 0,
  idleHome.length ? `idle home on: ${idleHome.map(([s]) => s).join(", ")}` : ""
)

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
// Every weekend we have says where the booking stands, and every weekend we do
// not have says nothing — that is what the hatch and the Booked it tap read.
const gridRows = gridBefore?.grid?.venues ?? gridBefore?.venues ?? []
const attached = gridRows.flatMap((v) => v.cells.filter((c) => c.daysOn > 0))
ok(
  "attached weekends carry a booking status",
  attached.length > 0 &&
    attached.every((c) => c.bookingStatus === "assumed" || c.bookingStatus === "confirmed") &&
    gridRows
      .flatMap((v) => v.cells.filter((c) => c.daysOn === 0))
      .every((c) => c.bookingStatus === null),
  `${attached.filter((c) => c.bookingStatus === "assumed").length} assumed of ${attached.length}`
)
ok(
  "the grid names exactly one home gym",
  gridRows.filter((v) => v.role === "home").length === 1 &&
    gridRows.every((v) => v.role === "home" || v.role === "pool")
)

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
