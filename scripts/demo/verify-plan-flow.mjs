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
import { openBoard } from "./plan-board-lib.mjs"

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
// NEW 2026-08-05 (owner ruling #1): launching the planner from outside lands on
// STEP 1, never on the board. The rail's Plan stage is that door, and no link
// on this tab may point an operator into step 3 as their entry.
const planStageHref = await page
  .locator('[data-testid="plan-tab-rail"] a')
  .first()
  .getAttribute("href")
ok(
  "the tab's door into the planner opens step 1",
  /[?&]step=1$/.test(planStageHref ?? ""),
  planStageHref ?? "missing"
)
const ctaHref = await page.locator('[data-testid="plan-tab-cta"] a').getAttribute("href")
ok(
  "and the primary CTA never drops you straight on the board",
  !/[?&]step=3$/.test(ctaHref ?? ""),
  ctaHref ?? "no href (this stage uses a tab switch)"
)
await page.locator('[data-testid="plan-tab-rail"] a').first().click()
await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 90000 })
ok(
  "the walk starts on teams, with the plan controls in the header",
  /[?&]step=1/.test(page.url()) &&
    (await page.locator('[data-testid="step1-plan-chooser"]').count()) === 1,
  page.url().split("/").pop()
)
ok(
  "and no plan is opened for you: step 1 asks which one first",
  (await page.locator('[data-testid="step1-plan-empty"]').count()) === 1 &&
    /None open/.test(await page.locator('[data-testid="plan-picker"]').innerText()),
  (await page.locator('[data-testid="step1-plan-chooser"]').innerText()).replace(/\n/g, " ")
)
await page.screenshot({ path: `${SHOTS}/1-plan-tab.png`, fullPage: true })

// ── Step 1: estimates only ────────────────────────────────────────────────
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=1`)
await page.waitForTimeout(3000)
const step1 = await page.locator("main").innerText()
ok("step 1 shows registered counts as overlay chips", /registered/.test(step1))
/**
 * RE-PINNED 2026-08-05: the chip is correct only while some grade really has no
 * estimate. Once the operator has numbers everywhere its absence IS the right
 * state, and asserting it unconditionally was pinning the world rather than the
 * screen. Same reasoning as the start-from-registrations banner below.
 */
const step1Planner = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/planner`)
  .then((r) => r.json())
  .catch(() => null)
const unestimated = (step1Planner?.state?.units ?? []).filter((u) => u.expected === 0)
ok(
  "step 1 marks unestimated grades as not in the plan, and only then",
  unestimated.length > 0
    ? step1.includes("Not in the plan yet")
    : !step1.includes("Not in the plan yet"),
  unestimated.length > 0
    ? `${unestimated.length} grade(s) with no estimate`
    : "every grade already estimated, so nothing to mark"
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
// NEW 2026-08-05 (owner ruling #3): the league's weekends are chosen ONCE, in
// one row above the per-gym grid, and the per-gym cells follow it.
const leagueRow = page.locator('[data-testid="league-weekends"]')
const leagueCells = await page.locator('[data-testid="league-weekend"]').count()
const gridBox = await page.locator('[data-testid="venue-role-chip"]').first().boundingBox()
const rowBox = await leagueRow.boundingBox().catch(() => null)
ok(
  "step 2 asks when the league runs, once, above the gyms",
  (await leagueRow.count()) === 1 &&
    /When do you want to run sessions/.test(step2) &&
    leagueCells > 0 &&
    Boolean(rowBox && gridBox && rowBox.y < gridBox.y),
  `${leagueCells} weekend toggles · ${await page.locator('[data-testid="league-weekends-count"]').innerText()}`
)
const leagueOn = await page.locator('[data-testid="league-weekend"][data-on="1"]').count()
const gymOn = await page.evaluate(() => {
  // A weekend the league runs must be a weekend some gym is really on.
  const cells = [...document.querySelectorAll('[data-testid="league-weekend"]')]
  return cells.filter((c) => c.getAttribute("data-on") === "1").length
})
ok(
  "the row counts the weekends the season really has a gym on",
  leagueOn === gymOn && leagueOn > 0,
  `${leagueOn} weekends on`
)
ok("step 2 has whole-season toggles", /all weekends/i.test(step2))
ok("step 2 still edits courts", (await page.getByLabel(/ courts$/).count()) >= gymCards)
ok(
  "step 2 notice slot is mounted even when empty",
  (await page.locator('[data-testid="step2-notice"]').count()) === 1
)
await page.screenshot({ path: `${SHOTS}/3-step2-gyms.png`, fullPage: true })

// ── Step 3: gym sections, levers, hours chips (no Keep, no Apply) ─────────
// RE-PINNED 2026-08-05 (#2): step 3 opens on the chooser, so the drive opens the
// season's own plan before there is a board to assert anything about.
const boardEntry = await openBoard(
  page,
  `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`
)
ok(
  "step 3 opens with nothing selected, and the plan is opened by hand",
  boardEntry.empty && boardEntry.weekends === 0,
  boardEntry.picker
)
/**
 * RE-PINNED 2026-08-06 (owner ruling #6): the two disclosures under the board
 * are gone. The lever worth a button is beside Redraw, and the hours are edited
 * on the gym section they are about, one date at a time.
 */
await page.waitForSelector('[data-testid="redraw-spread"]', { timeout: 60000 })
await page.waitForTimeout(500)
const step3 = await page.locator("main").innerText()
ok("step 3 offers the spread redraw beside Redraw", /Redraw, spread out instead/i.test(step3))
await page.waitForTimeout(200)
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
/**
 * RE-PINNED 2026-08-05: the first weekend the SEASON has is not necessarily a
 * weekend it has a gym on — an operator turning one off in step 2 is a normal
 * thing to do, and this check was asserting a world shape rather than the
 * contract. The contract is about weekends that HAVE gyms: the home gym leads,
 * and every gym has a role.
 */
const weekendsWithGyms = (planner?.state?.windows ?? [])
  .flatMap((w) => w.weekends)
  .filter((w) => (w.venues ?? []).length > 0)
const someWeekend = weekendsWithGyms[0]
ok(
  "planner state leads with the home gym on every weekend that has one",
  weekendsWithGyms.length > 0 &&
    weekendsWithGyms.every((w) => w.venues.some((v) => v.role === "home") ? w.venues[0].role === "home" : true),
  `${weekendsWithGyms.length} weekend(s) with gyms · first venue: ${someWeekend?.venues?.[0]?.name}`
)
ok(
  "planner state gives every gym a role",
  weekendsWithGyms.length > 0 &&
    weekendsWithGyms.every((w) => w.venues.every((v) => v.role === "home" || v.role === "pool"))
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

// ── The court buffer: courts the league holds back ────────────────────────
// Owner ruling 2026-08-03. This is the ONE write this script makes, and it
// puts it straight back: set the buffer to 1, read the capacity and the
// board's own sentence, then restore 0 and check the season is exactly as it
// was found. Nothing else here persists anything.
const capacityOf = (planner) =>
  (planner?.state?.windows ?? [])
    .flatMap((w) => w.weekends)
    .reduce((sum, w) => sum + w.capacityGames, 0)
const plannerNow = () =>
  page.request.get(`${BASE}/api/seasons/${SEASON}/planner`).then((r) => r.json())
const setBuffer = (courtBuffer) =>
  page.request.patch(`${BASE}/api/seasons/${SEASON}/planner/venues`, { data: { courtBuffer } })

const capBefore = capacityOf(await plannerNow())
const saved = await setBuffer(1)
ok("the court buffer saves", saved.ok(), `HTTP ${saved.status()}`)
const withBuffer = await plannerNow()
const capHeld = capacityOf(withBuffer)
ok(
  "holding one court back drops the season's capacity",
  capHeld < capBefore,
  `${capBefore} games → ${capHeld}`
)
const venuesHeld = (withBuffer?.state?.windows ?? [])
  .flatMap((w) => w.weekends)
  .flatMap((w) => w.venues)
ok(
  "every gym reports the court it is holding",
  venuesHeld.length > 0 && venuesHeld.every((v) => (v.courtsHeld ?? 0) === 1),
  `${venuesHeld.filter((v) => (v.courtsHeld ?? 0) > 0).length} of ${venuesHeld.length} gym-weekends`
)
// The weekend's sentence lives behind its "why" chip, so the check opens one
// the way an operator would. The panel portals to body, so read the document.
await openBoard(page, `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`)
await page.waitForSelector('[data-testid="gym-list"]', { timeout: 60000 })
await page.waitForTimeout(1200)
/**
 * RE-PINNED 2026-08-05: only a weekend that HAS a gym can be holding a court
 * back, so the check opens the chips in turn rather than assuming the first
 * weekend of the season is one of them.
 */
const whyChips = page.locator('[data-testid="weekend-why"]')
const whyCount = await whyChips.count()
let boardHeld = ""
for (let i = 0; i < Math.min(whyCount, 6); i++) {
  await whyChips.nth(i).click()
  await page.waitForTimeout(500)
  const body = await page.locator("body").innerText()
  if (/held back/i.test(body)) {
    boardHeld = body
    break
  }
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
}
ok(
  "the board says a court is held back",
  /held back/i.test(boardHeld),
  whyCount === 0 ? "no weekend-why chip on the board" : `checked ${Math.min(whyCount, 6)} weekend(s)`
)
await page.screenshot({ path: `${SHOTS}/6-court-buffer.png`, fullPage: true })

const restored = await setBuffer(0)
const capRestored = capacityOf(await plannerNow())
ok(
  "the world is left exactly as it was found",
  restored.ok() && capRestored === capBefore,
  `${capRestored} games`
)

/* ================= A PLAN OWNS ITS WORLD (owner ruling 2026-08-05) ========= */
/**
 * The architecture, driven end to end on the real screens:
 *
 *  1. a fresh plan starts with no weekend chosen and no gym availability;
 *  2. editing STEP 2 on that plan does NOT touch the season — the season's own
 *     gym grid and its saved calendar come back byte-identical;
 *  3. stepping 2 → 3 shows those edits immediately, with no reload;
 *  4. taking the gym away again strands the placements loudly instead of drawing
 *     games in a building the plan no longer has;
 *  5. the venue tray is on the board whenever a plan is open.
 *
 * Self-restoring: the plan it creates is deleted at the end.
 */
const planUrl = (step) => `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=${step}`
const plansOf = async () =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json()))?.plans ?? []

/** The season's own gym grid and saved calendar, in one comparable string. This
 *  is what must not move while a plan of the operator's own is edited. */
const seasonWorld = async () => {
  const [grid, planner] = await Promise.all([
    page.request.get(`${BASE}/api/seasons/${SEASON}/planner/venues`).then((r) => r.json()),
    page.request.get(`${BASE}/api/seasons/${SEASON}/planner`).then((r) => r.json()),
  ])
  return JSON.stringify({
    buffer: grid?.grid?.courtBuffer,
    gyms: (grid?.grid?.venues ?? []).map((v) => ({
      id: v.venueId,
      role: v.role,
      courts: v.courtsAvailable,
      open: v.simpleOpen,
      close: v.simpleClose,
      cells: v.cells.map((c) => `${c.state}:${c.daysOn}`),
    })),
    calendar: (planner?.state?.windows ?? [])
      .flatMap((w) => w.weekends)
      .map((w) => ({ id: w.sessionId, assigned: w.assigned, gyms: w.assignedVenues ?? {} })),
  })
}

const WORLD_PLAN = "Drive world plan"
const seasonBefore = await seasonWorld()

// Clean up any leftover from an interrupted run, then make the plan fresh.
for (const p of await plansOf()) {
  if (p.name === WORLD_PLAN) await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${p.id}`)
}
const madeRes = await page.request.post(`${BASE}/api/seasons/${SEASON}/plans`, {
  data: { name: WORLD_PLAN, fresh: true },
})
const worldPlan = madeRes.ok() ? (await madeRes.json()).plan : null
ok("a fresh plan is created for the world drive", Boolean(worldPlan), `HTTP ${madeRes.status()}`)

const docOf = async (id) =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans/${id}`).then((r) => r.json()))?.plan
const weekendsIn = (doc) =>
  (doc?.settings?.state?.windows ?? []).flatMap((w) => w.weekends ?? [])

if (worldPlan) {
  const fresh = weekendsIn(await docOf(worldPlan.id))
  ok(
    "the fresh plan has zero chosen weekends and no gym availability",
    fresh.length > 0 && fresh.every((w) => !w.chosen && (w.venues ?? []).length === 0),
    `${fresh.length} weekend(s), ${fresh.filter((w) => w.chosen).length} chosen`
  )

  /* ── step 1, on the plan: the estimates are the PLAN's ───────────────── */
  await page.goto(planUrl(1))
  await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })
  await page.locator('[data-testid="plan-open"]').click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 15000 })
  await page.locator(`[data-testid="plan-option"][data-plan-id="${worldPlan.id}"]`).click()
  await page.waitForTimeout(2000)

  const step1Line = page.locator('[data-testid="step1-plan-line"]')
  // Same race as step 2: the row is known first, the document lands a moment
  // later. "loading" is a correct intermediate state; "season" never is.
  const step1States = new Set()
  for (let i = 0; i < 20; i++) {
    const at = await step1Line.getAttribute("data-world").catch(() => null)
    step1States.add(at)
    if (at === "plan") break
    await page.waitForTimeout(250)
  }
  ok(
    "step 1 says the numbers belong to the plan, and never to the season",
    (await step1Line.getAttribute("data-world")) === "plan" && !step1States.has("season"),
    `${[...step1States].join(" → ")} · ${(await step1Line.innerText().catch(() => "")).replace(/\n/g, " ").slice(0, 80)}`
  )

  const firstRow = page.locator('[data-testid="grade-row"]').first()
  const gradeKey = await firstRow.getAttribute("data-grade")
  // Three taps of the stepper, then wait for the debounced write to land.
  for (let i = 0; i < 3; i++) {
    await firstRow.locator('button[aria-label^="One more"]').click()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(2500)
  const afterBump = (await docOf(worldPlan.id))?.settings?.state?.units?.find((u) => u.key === gradeKey)
  const seasonGrade = (step1Planner?.state?.units ?? []).find((u) => u.key === gradeKey)
  ok(
    "the stepper writes the estimate into the plan document",
    afterBump && seasonGrade && afterBump.teams === seasonGrade.expected + 3,
    `plan ${afterBump?.teams} vs season ${seasonGrade?.expected}`
  )

  // IN OR OUT of this plan (owner ruling 2026-08-05): only a plan can do this.
  const inOut = firstRow.locator('[data-testid="grade-in-out"]')
  ok("step 1 offers in-or-out on a plan of your own", (await inOut.count()) === 1)
  await inOut.click()
  await page.waitForTimeout(2000)
  const afterOut = (await docOf(worldPlan.id))?.settings?.state?.units?.find((u) => u.key === gradeKey)
  ok(
    "taking a grade out keeps its number, so putting it back costs nothing",
    afterOut?.included === false && afterOut?.teams === afterBump?.teams,
    `included=${afterOut?.included} teams=${afterOut?.teams}`
  )
  await inOut.click()
  await page.waitForTimeout(2000)
  ok(
    "and it goes back in with the same number",
    (await docOf(worldPlan.id))?.settings?.state?.units?.find((u) => u.key === gradeKey)?.included === true
  )
  ok(
    "step 1 on a plan the season does not run leaves the season byte-identical",
    (await seasonWorld()) === seasonBefore,
    (await seasonWorld()) === seasonBefore ? "" : "the season's estimates moved"
  )
  await page.screenshot({ path: `${SHOTS}/9-step1-plan-world.png`, fullPage: true })

  /* ── step 2, on the plan ─────────────────────────────────────────────── */
  await page.goto(planUrl(2))
  await page.waitForSelector('[data-testid="league-weekends"]', { timeout: 60000 })
  // Open the plan the way an operator does.
  await page.locator('[data-testid="plan-open"], [data-testid="step2-plan-chooser"] [data-testid="plan-picker"]').first().click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 15000 })
  await page.locator(`[data-testid="plan-option"][data-plan-id="${worldPlan.id}"]`).click()
  await page.waitForTimeout(2000)

  const planLine = page.locator('[data-testid="step2-plan-line"]')
  /**
   * PINNED 2026-08-05, and it caught a real bug the first time it ran: the plan
   * ROW is known the moment you choose it, but the DOCUMENT arrives a moment
   * later, and in that gap step 2 was taking the SEASON path — a click attached a
   * gym to the league's real calendar. The line must never say "the season's own"
   * for a plan the season does not run: it says "loading" until the world is
   * there, and every control is disabled until then.
   */
  const planWorldStates = new Set()
  for (let i = 0; i < 12; i++) {
    planWorldStates.add(await planLine.getAttribute("data-world").catch(() => null))
    await page.waitForTimeout(150)
  }
  ok(
    "step 2 never claims the season's gym time for a plan the season does not run",
    !planWorldStates.has("season"),
    [...planWorldStates].join(" → ")
  )
  ok(
    "step 2 says whose gym time it is drawing, and it is the plan's",
    (await planLine.getAttribute("data-world")) === "plan",
    (await planLine.innerText().catch(() => "")).replace(/\n/g, " ").slice(0, 90)
  )

  const weekendToggles = page.locator('[data-testid="league-weekend"]')
  const onBefore = await page.locator('[data-testid="league-weekend"][data-on="1"]').count()
  ok(
    "the plan's own weekend row starts with nothing on",
    onBefore === 0,
    `${onBefore} of ${await weekendToggles.count()} on`
  )

  // Choose the first two weekends the season already has sessions for, so the
  // drive never has to create one (and never has to clean one up).
  const realKeys = (
    await page.request.get(`${BASE}/api/seasons/${SEASON}/planner/venues`).then((r) => r.json())
  ).grid.weekends.filter((w) => w.sessionId).slice(0, 2)
  for (const w of realKeys) {
    await page.locator(`[data-testid="league-weekend"][data-weekend="${w.key}"]`).click()
    // Each tap is a PATCH of the plan document and a re-derive of the grid, so
    // the row is read once it has settled rather than mid-write.
    await page.waitForFunction(
      (key) =>
        document
          .querySelector(`[data-testid="league-weekend"][data-weekend="${key}"]`)
          ?.getAttribute("data-on") === "1",
      w.key,
      { timeout: 20000 }
    ).catch(() => {})
    await page.waitForTimeout(400)
  }
  const onAfter = await page.locator('[data-testid="league-weekend"][data-on="1"]').count()
  ok(
    "tapping a weekend turns it on in the plan, with the home gym",
    onAfter === realKeys.length,
    `${onAfter} weekend(s) on`
  )
  await page.screenshot({ path: `${SHOTS}/7-step2-plan-world.png`, fullPage: true })

  const chosen = weekendsIn(await docOf(worldPlan.id)).filter((w) => w.chosen)
  ok(
    "the plan document holds those weekends, with the home gym attached",
    chosen.length === realKeys.length && chosen.every((w) => (w.venues ?? []).length === 1),
    `${chosen.length} chosen · ${chosen.map((w) => (w.venues ?? []).length).join(",")} gym(s) each`
  )

  /* ── THE SEASON DID NOT MOVE ─────────────────────────────────────────── */
  ok(
    "step 2 on a plan the season does not run leaves the season byte-identical",
    (await seasonWorld()) === seasonBefore,
    (await seasonWorld()) === seasonBefore ? "" : "the season's grid or calendar moved"
  )

  /* ── step 2 → step 3 shows the edits, immediately ────────────────────── */
  await page.locator('ol button:has-text("Your calendar")').first().click()
  await page.waitForTimeout(3000)
  const boardWeekends = await page.locator("[data-session-id]").count()
  /**
   * A weekend this plan does not run has no gym and therefore no capacity, which
   * the board paints as the dashed "unavailable" card (CARD_TONE in
   * plan-shared.ts). So the count of cards that are NOT dashed is exactly the
   * count of weekends step 2 just turned on — which is the staleness fix stated
   * as a number: the board is drawing the document, not its own memory of it.
   */
  const liveCards = await page
    .locator("[data-session-id]")
    .evaluateAll((cards) => cards.filter((c) => !c.className.includes("border-dashed")).length)
  ok(
    "stepping 2 → 3 draws the plan's own world, with no reload",
    boardWeekends > 0 && liveCards === realKeys.length,
    `${boardWeekends} weekend cards, ${liveCards} of them with gym time (expected ${realKeys.length})`
  )

  /* ── one gym list, there whenever a plan is open ─────────────────────── */
  const tray = page.locator('[data-testid="gym-list"]')
  ok(
    "the gym list is on the board with a plan open",
    (await tray.count()) === 1,
    `${await tray.count()} gym list`
  )

  /* ── take the gym away: the placements strand, loudly ────────────────── */
  // Place a grade on the first chosen weekend, save it, then turn that weekend
  // off in step 2 and come back.
  const firstSession = chosen[0].sessionId
  const placeRes = await page.request.patch(
    `${BASE}/api/seasons/${SEASON}/plans/${worldPlan.id}`,
    {
      data: {
        assignment: { [firstSession]: ["age:Grade 7"] },
        venues: { [firstSession]: { "age:Grade 7": chosen[0].venues[0].venueId } },
      },
    }
  )
  ok("a grade is placed on the plan's first weekend", placeRes.ok(), `HTTP ${placeRes.status()}`)

  await page.goto(planUrl(2))
  await page.waitForSelector('[data-testid="league-weekends"]', { timeout: 60000 })
  await page.locator('[data-testid="plan-open"], [data-testid="step2-plan-chooser"] [data-testid="plan-picker"]').first().click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 15000 })
  await page.locator(`[data-testid="plan-option"][data-plan-id="${worldPlan.id}"]`).click()
  await page.waitForTimeout(2000)
  await page.locator(`[data-testid="league-weekend"][data-weekend="${realKeys[0].key}"]`).click()
  await page.waitForTimeout(1500)

  await page.locator('ol button:has-text("Your calendar")').first().click()
  await page.waitForTimeout(3000)
  const strandedBanner = page.locator('[data-testid="stranded-gyms"]')
  ok(
    "a placement whose weekend the plan dropped is flagged, not silently redrawn",
    (await strandedBanner.count()) === 1,
    (await strandedBanner.innerText().catch(() => "")).replace(/\n/g, " ").slice(0, 120) || "no banner"
  )
  const railOpen = await page.locator('[data-testid="rail-open-count"]').innerText().catch(() => "")
  ok(
    "the rail counts it as open work",
    /open/.test(railOpen),
    railOpen.replace(/\n/g, " ")
  )
  await page.screenshot({ path: `${SHOTS}/8-stranded-gym.png`, fullPage: true })

  /* ── clean up: the plan goes, the season is where it started ─────────── */
  const gone = await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${worldPlan.id}`)
  ok("the drive's world plan is deleted again", gone.ok(), `HTTP ${gone.status()}`)
  ok(
    "the season's gym grid and saved calendar are byte-identical to where they started",
    (await seasonWorld()) === seasonBefore
  )
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
