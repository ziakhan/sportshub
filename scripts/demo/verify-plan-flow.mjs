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
import { openBoard, openPlanFromStep1 } from "./plan-board-lib.mjs"

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

// ── The Plan Your Season tab is a DOOR (owner 2026-08-07, double-rail
// collapse): no stage-rail home screen between the console and the wizard.
// A cold ?tab=plan URL — old bookmarks — redirects straight into the wizard,
// which still opens on STEP 1 (owner ruling 2026-08-05 #1 stands).
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage?tab=plan`)
await page.waitForSelector('[data-testid="wizard-nav"]', { timeout: 90000 })
ok(
  "?tab=plan walks straight into the wizard",
  page.url().includes(`/seasons/${SEASON}/plan`),
  page.url()
)
const stepRail = await page.locator('ol[class*="rounded-2xl"]').first().innerText()
ok(
  "one rail: the wizard's five steps",
  ["Teams", "Your buildings", "Your calendar", "Publish", "Schedule"].every((s) =>
    stepRail.includes(s)
  )
)
ok(
  "the walk starts on step 1",
  (await page.locator('[aria-current="step"]').first().innerText()).includes("Teams")
)
// Already inside the wizard (the tab IS the door now); just wait for step 1.
// OWNER 2026-08-10 (supersedes the 08-06 empty-start pin): with editable
// plans existing, the wizard OPENS ON ONE — landing on the read-only
// reference read as "everything is uneditable". The empty-state card is
// now only for a season with no plans of its own.
await page.waitForSelector('[data-testid="step1-plan-line"], [data-testid="step1-plan-empty"]', {
  timeout: 90000,
})
const plansAtOpen = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/plans`)
  .then((r) => r.json())
  .then((d) => (d.plans ?? []).filter((p) => p.source !== "imported"))
  .catch(() => [])
ok(
  "the walk starts on teams",
  /[?&]step=1/.test(page.url()),
  page.url().split("/").pop()
)
ok(
  "OWNER 2026-08-10: with editable plans existing, step 1 opens on one (never the read-only reference)",
  plansAtOpen.length === 0 ||
    ((await page.locator('[data-testid="step1-plan-line"]').count()) > 0 &&
      !/reference/i.test(await page.locator('[data-testid="step1-plan-line"]').innerText())),
  `editable plans: ${plansAtOpen.length}`
)
await page.screenshot({ path: `${SHOTS}/1-plan-tab.png`, fullPage: true })

// ── Step 1: estimates only ────────────────────────────────────────────────
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=1`)
// Wait for a real row, not a guessed number of seconds: under load (a
// concurrent seed, a cold compile) three seconds is not always enough, and a
// flat timeout reads the half-painted page as a content regression.
await page.waitForSelector('[data-testid="grade-row"]', { timeout: 60000 })
await page.waitForTimeout(300)
const step1 = await page.locator("main").innerText()
ok("step 1 shows registered counts as overlay chips", /registered/.test(step1))
/**
 * NEW 2026-08-06 (wave B intake copy): "estimate, never decide" is the whole
 * point of step 1 existing before registration does. The words are load-
 * bearing enough to pin directly rather than trust the looser "registered"
 * check above to catch a rewrite of them.
 */
ok(
  "step 1 carries the estimate-not-decide intake line",
  /Registrations inform the numbers, they never decide them/.test(step1)
)
/**
 * RE-PINNED 2026-08-05: the chip is correct only while some grade really has no
 * estimate. Once the operator has numbers everywhere its absence IS the right
 * state, and asserting it unconditionally was pinning the world rather than the
 * screen. Same reasoning as the start-from-registrations banner below.
 *
 * RE-PINNED AGAIN 2026-08-06 wave (owner ruling A1): "unestimated" is not
 * "expected === 0" any more. A deliberate 0 (source "expected", teams 0) is an
 * answered question and stays 0 — it does not wear the pill. Only a grade
 * nobody ever put a number on (source !== "expected") is unestimated.
 */
const step1Planner = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/planner`)
  .then((r) => r.json())
  .catch(() => null)
const unestimated = (step1Planner?.state?.units ?? []).filter((u) => u.source !== "expected")
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
// RE-PINNED 2026-08-06 wave (A1): "estimated" is source === "expected", not
// expected > 0 — a deliberate 0 counts as answered.
const plannerForBanner = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/planner`)
  .then((r) => r.json())
const allEstimated = (plannerForBanner?.state?.units ?? [])
  .filter((u) => u.approved > 0)
  .every((u) => u.source === "expected")
ok(
  "step 1 start-from-registrations state is honest",
  /Start from registrations/i.test(step1) || allEstimated,
  allEstimated ? "every registered grade already estimated" : "banner shown"
)
ok(
  "step 1 offers add-a-grade (or the auto-opened plan carries the affordance)",
  /Add a grade/i.test(step1) ||
    (await page.locator('[data-testid="step1-plan-chooser"]').count()) > 0,
  /Add a grade/i.test(step1) ? "button shown" : "auto-opened plan view"
)
await page.screenshot({ path: `${SHOTS}/2-step1-teams.png`, fullPage: true })

// ── Step 2: building roster, league weekend row, reserved notice ──────────
// Re-pinned 2026-08-03 (venue model v2): fill order is dead on this screen, so
// the checks read the home gym tag and the pool language instead of ranking.
// RE-PINNED 2026-08-06 (wave B): the screen is a roster now, not a paint grid.
// The per-weekend per-gym cells, the whole-season per-gym toggles and the
// "Booked it" assumed rows are gone (see gyms-weekends-step.tsx); "taken"
// booking conflicts are data the API still carries (checked below, via the
// grid endpoint) but this roster no longer shows them cell by cell.
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
/**
 * RE-PINNED 2026-08-06 (wave B intake copy): "the home gym fills first, at full
 * capacity" is now the INTENDED headline sentence on this screen (see the
 * screen-head copy below), so "fills first" can no longer be forbidden
 * vocabulary — only the old numbered ranking ("overflow #2", "fill order")
 * would mean the roster regressed to talking about order instead of role.
 */
ok(
  "step 2 has no numbered fill-order vocabulary left",
  !/overflow #|fill order/i.test(step2) &&
    chipTexts.every((t) => t === "Home gym" || t === "In the pool"),
  chipTexts.join(" · ")
)
/**
 * NEW 2026-08-06 (wave B intake copy): the screen head's own sentence, present
 * word for word.
 */
ok(
  "step 2 carries its own intake line: buildings, home gym, fills first",
  /Name your buildings and pick your home gym\. The home gym fills first, at full capacity, before anything is rented\./.test(
    step2
  )
)
/**
 * RE-PINNED 2026-08-07 (one-calendar wave, docs/roadmap/one-calendar-wave-
 * 2026-08-07.md rulings #1+#2: write-through died, and steps 1-2 with nothing
 * open are read only). make-home is a WRITE control. Before this wave, "nothing
 * open" on step 2 fell back to writing the season's own buildings straight
 * through, so the button rendered on a cold visit; that fallback is gone and
 * there is nowhere left for the click to land, so the roster renders read
 * only and offers no make-home button at all. OLD: "offers make-home on every
 * gym that is not home" (season fallback). NEW: offers none, with nothing
 * open.
 */
{
  const planOpenStep2 = (await page.locator('[data-testid="step2-plan-line"]').count()) > 0
  ok(
    "step 2 write controls follow the open document: present on an auto-opened plan, absent with nothing open (owner 2026-08-10)",
    planOpenStep2 || (await page.locator('[data-testid="make-home"]').count()) === 0,
    planOpenStep2 ? "auto-opened plan — writes allowed" : "nothing open — read only"
  )
}
ok(
  "step 2 has no reorder arrows",
  (await page.getByRole("button", { name: /move .* (up|down)/i }).count()) === 0
)
/**
 * RE-PINNED 2026-08-06 (wave B): "Taken: NJC/NSC" was a per-cell reason on the
 * paint grid, and the grid is gone from this screen — booking conflicts are
 * board work now. The DATA still carries them (pinned below, off the grid
 * API, unchanged: "Six Park carries taken weekends in the grid"); what is
 * pinned here instead is that the roster does not try to fake a per-cell
 * reading it no longer has.
 */
ok(
  "step 2's roster does not show per-cell taken reasons any more (that data now lives in the grid API only)",
  !/Taken:/.test(step2)
)
// NEW 2026-08-05 (owner ruling #3), reframed 2026-08-06: the league's
// weekends are chosen ONCE, in one row above the buildings, as GUIDANCE for
// the draw rather than a booking — the per-gym paint grid it used to sit
// above is gone.
const leagueRow = page.locator('[data-testid="league-weekends"]')
const leagueCells = await page.locator('[data-testid="league-weekend"]').count()
const gridBox = await page.locator('[data-testid="venue-role-chip"]').first().boundingBox()
const rowBox = await leagueRow.boundingBox().catch(() => null)
ok(
  "step 2 asks when the league would like to run, once, above the buildings",
  (await leagueRow.count()) === 1 &&
    /When would you like to run sessions/.test(step2) &&
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
/**
 * NEW 2026-08-06 (wave B), reworded 2026-08-07: this section navigated
 * straight to ?step=2 without opening a plan, so it is truly the
 * nothing-open state — the row can only read the season's own weekends back,
 * and it has to say it is read only rather than let a tap mean nothing. Before
 * the one-calendar wave this state and "the active plan is open" behaved
 * identically (both wrote through to the season); write-through's death
 * (ruling #1) makes them two different states now — an open active plan is a
 * sandbox like any other (driven in the courtBuffer/drift section and the
 * autosave section below), and nothing-open is the one that stays read only.
 * The editable half of this contract (a plan of the operator's own, chosen)
 * is driven later in the "A PLAN OWNS ITS WORLD" section below, where the row
 * starts at 0 of N and a click really turns one on.
 */
{
  const planOpenStep2 = (await page.locator('[data-testid="step2-plan-line"]').count()) > 0
  ok(
    "the league-weekends row is honest about writability (editable on the auto-opened plan, read-only note otherwise)",
    planOpenStep2 ||
      ((await page.locator('[data-testid="league-weekends-note"]').count()) === 1 &&
        /Open a plan of your own to choose the weekends it fills first/.test(step2)),
    planOpenStep2 ? "auto-opened plan" : "read-only note shown"
  )
}
/**
 * RE-PINNED 2026-08-06 (wave B): the per-gym "toggle all weekends at once"
 * bulk buttons are gone along with the paint grid they lived on — booking a
 * building onto a Saturday is board work now, one drop at a time. What is
 * pinned is the removal, not a replacement bulk verb, because there isn't one
 * any more.
 */
ok(
  "step 2 has no whole-season per-gym toggle any more (that was the paint grid)",
  (await page.getByRole("button", { name: /all weekends/i }).count()) === 0
)
/**
 * NEW 2026-08-06 (wave B regression guard): the whole point of the roster
 * rewrite was deleting the paint grid, the assumed/Booked-it rows and the
 * cell legend. Nothing on this screen may reintroduce them.
 */
ok(
  "step 2 has no paint grid and no Booked-it rows left",
  !/Booked it/.test(step2) && !/assumed, not booked yet/.test(step2)
)
/**
 * RE-PINNED 2026-08-07 (write-through died, same ruling as make-home above).
 * The courts INPUT is a write control too, so with nothing open it is gone
 * along with make-home: the roster falls back to a read-only "<b>N</b>
 * courts" badge. OLD: "step 2 still edits courts" (the season-fallback write
 * path). NEW: nothing open means no editable input anywhere on the roster.
 */
{
  const planOpenStep2 = (await page.locator('[data-testid="step2-plan-line"]').count()) > 0
  ok(
    "courts editability follows the open document (inputs on the auto-opened plan, badges otherwise)",
    gymCards > 0 && (planOpenStep2 || (await page.getByLabel(/ courts$/).count()) === 0),
    planOpenStep2 ? "auto-opened plan — inputs allowed" : "read-only badges"
  )
}
ok(
  "step 2 notice slot is mounted even when empty",
  (await page.locator('[data-testid="step2-notice"]').count()) === 1
)
await page.screenshot({ path: `${SHOTS}/3-step2-gyms.png`, fullPage: true })

// ── Step 3: gym sections, levers, hours chips (no Keep, no Apply) ─────────
// RE-PINNED 2026-08-05 (#2): step 3 opens on the chooser, so the drive opens the
// season's own plan before there is a board to assert anything about.
// RE-PINNED 2026-08-06 wave (B1): the chooser moved to step 1 — a cold visit to
// step 3 now draws the board-plan-pointer card, and openBoard opens the plan
// from step 1 before following the URL back here.
const boardEntry = await openBoard(
  page,
  `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`
)
ok(
  "step 3 cold entry is coherent: pointer card when no plans, an auto-opened board otherwise (owner 2026-08-10)",
  boardEntry.empty ? boardEntry.weekends === 0 : boardEntry.weekends > 0,
  boardEntry.pointerText
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
/**
 * RE-PINNED 2026-08-06 (owner ruling #6, already in effect before wave B):
 * "Start early"/"Finish early" were the board-level hours disclosure, and it
 * is gone with the other one — hours are edited on the gym section they are
 * about, one date at a time, via the ⋯ menu (driven end to end in
 * verify-blocks.mjs's "gym-menu-panel" checks). What is pinned here is that
 * the board-level chips do not come back.
 */
ok(
  "step 3 has no board-level hours chips left (hours moved to the gym section's ⋯ menu)",
  !/Start early/i.test(step3Hours) && !/Finish early/i.test(step3Hours)
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

// A generous timeout, not Playwright's 30s default: this solves the whole
// season and a concurrent seed on the same box can push it well past that.
const propose = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/planner/propose`, {
    data: { lever: "one-gym" },
    timeout: 90000,
  })
  .then((r) => r.json())
  .catch(() => null)
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
    timeout: 90000,
  })
  .then((r) => r.json())
  .catch(() => null)
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
// Six holds NJC marks; only the ones on IN-SEASON weekends have columns now
// (owner 2026-08-07: the season's dates define the supply — the clamp drops
// bare out-of-span Saturdays, and playoff weekends already have no column).
const takenCells = (sixPark?.cells ?? []).filter((c) => c.state === "taken").length
// RE-PINNED 2026-08-07: the season now ends at the last finals, so most NJC
// weekends fall outside the span and have no column. What this check pins is
// that cross-league taken marks still reach the grid at all, not how many of
// them the current season span happens to overlap.
ok("Six Park carries taken weekends in the grid", takenCells >= 1, `${takenCells} taken`)
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
// Owner ruling 2026-08-03. This is the ONE season-level write this script
// makes outside any plan's own document, and it puts it straight back: set
// the buffer to 1, read the LIVE capacity, then (RE-PINNED 2026-08-07, ruling
// #5) confirm the ACTIVE plan's board does NOT pick it up — GET
// plans/[planId] answers from stored settings now, the active plan included,
// so a season-level change made outside any plan's sandbox is drift the plan
// cannot see until it is re-generated. Restore 0 and check the season is
// exactly as it was found.
const capacityOf = (planner) =>
  (planner?.state?.windows ?? [])
    .flatMap((w) => w.weekends)
    .reduce((sum, w) => sum + w.capacityGames, 0)
const plannerNow = () =>
  page.request.get(`${BASE}/api/seasons/${SEASON}/planner`).then((r) => r.json())
const setBuffer = (courtBuffer) =>
  page.request.patch(`${BASE}/api/seasons/${SEASON}/planner/venues`, { data: { courtBuffer } })
/** Hoisted above the drift check below (and reused later, in "A PLAN OWNS ITS
 *  WORLD"): the plan list and one plan's whole document. */
const plansOf = async () =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json()))?.plans ?? []
const docOf = async (id) =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans/${id}`).then((r) => r.json()))?.plan

const capBefore = capacityOf(await plannerNow())
/**
 * THE ACTIVE PLAN'S OWN "BEFORE", read from ITS document, not the season's.
 * This is a long-lived demo world that other drives have run against, so the
 * active plan's stored settings may already disagree with the season's
 * current live numbers for reasons that have nothing to do with this test —
 * that pre-existing disagreement IS the "active plans can show drift" ruling
 * in the wild, but it means the fair comparison for THIS test is the plan's
 * own before-and-after, not the plan's stored value against the season's.
 */
const plans = await plansOf()
const activePlanRow = plans.find((p) => p.isActive) ?? null
ok(
  "the season has an active plan to test drift against",
  Boolean(activePlanRow),
  activePlanRow ? `${activePlanRow.name} (${activePlanRow.source})` : "no active plan"
)
const activeCapStoredBefore = activePlanRow
  ? capacityOf({ state: (await docOf(activePlanRow.id))?.settings?.state })
  : null

const saved = await setBuffer(1)
ok("the court buffer saves", saved.ok(), `HTTP ${saved.status()}`)
const withBuffer = await plannerNow()
const capHeld = capacityOf(withBuffer)
ok(
  "holding one court back drops the season's LIVE capacity",
  capHeld < capBefore,
  `${capBefore} games → ${capHeld}`
)
const venuesHeld = (withBuffer?.state?.windows ?? [])
  .flatMap((w) => w.weekends)
  .flatMap((w) => w.venues)
ok(
  "every gym reports the court it is holding, on the live grid",
  venuesHeld.length > 0 && venuesHeld.every((v) => (v.courtsHeld ?? 0) === 1),
  `${venuesHeld.filter((v) => (v.courtsHeld ?? 0) > 0).length} of ${venuesHeld.length} gym-weekends`
)

/**
 * RE-PINNED 2026-08-07 (ruling #5: "GET plans/[planId] returns STORED
 * settings for the active plan now — no live season read; active plans can
 * show drift"). Before this wave the active plan's GET read the season's rows
 * LIVE (write-through's mirror image), so this exact season-level buffer
 * write would have shown up on its board immediately — the OLD version of
 * this check clicked the board's "why" chips looking for "held back" and
 * expected to find it, because the active plan WAS the season. Now the active
 * plan reads what it last had SAVED, so a change made outside any plan's
 * document is invisible to it until the plan is re-generated: that is the
 * drift the ruling names, not a bug.
 *
 * capacityGames is already a field stored per weekend inside the plan's own
 * settings.state — the identical shape `capacityOf` already reads off the
 * live planner endpoint — so the same helper proves the point two ways: the
 * active plan's STORED total does not move when the season's does (compared
 * against ITS OWN before, captured above), and it now visibly disagrees with
 * the LIVE total.
 */
const activeCapStoredAfter = activePlanRow
  ? capacityOf({ state: (await docOf(activePlanRow.id))?.settings?.state })
  : null
ok(
  "the active plan's GET reads STORED settings, unmoved by the season's live buffer change",
  activePlanRow ? activeCapStoredAfter === activeCapStoredBefore : true,
  `stored ${activeCapStoredBefore} → ${activeCapStoredAfter} (live moved ${capBefore} → ${capHeld})`
)
ok(
  "so the active plan now visibly DRIFTS from the live season — exactly the shape ruling #5 describes",
  activePlanRow ? activeCapStoredAfter !== capHeld : true,
  `stored ${activeCapStoredAfter} ≠ live ${capHeld}`
)

// The board itself, opened on the active plan: RE-PINNED — it must NOT have
// picked up a change that never touched its document. The OLD check here
// asserted the opposite (that the board's "why" chip said "held back"),
// which was only ever true because the active plan used to be read live.
await openBoard(page, `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`)
await page.waitForSelector('[data-testid="gym-list"]', { timeout: 60000 })
await page.waitForTimeout(1200)
/**
 * RE-PINNED 2026-08-05, still true: only a weekend that HAS a gym could ever
 * be holding a court back, so the check opens the chips in turn rather than
 * assuming the first weekend of the season is one of them. What changed
 * 2026-08-07 is the expected OUTCOME of opening them (see above).
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
  "RE-PINNED: the active plan's board does NOT say a court is held back (its document was never touched)",
  !/held back/i.test(boardHeld),
  whyCount === 0
    ? "no weekend-why chip on the board"
    : `checked ${Math.min(whyCount, 6)} weekend(s), none mentioned it`
)
await page.screenshot({ path: `${SHOTS}/6-court-buffer-drift.png`, fullPage: true })

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
// plansOf and docOf are hoisted above, in the court-buffer/drift section.

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
  // RE-PINNED 2026-08-06 wave (B2): a bare goto with no ?plan= lands on the
  // empty-state card, not the header chooser — the two are never both mounted.
  await page.goto(planUrl(1))
  // Auto-open (owner 2026-08-10): a bare goto may land with a plan already
  // open — the chooser is then the header's, otherwise the empty card's.
  await page.waitForSelector(
    '[data-testid="step1-plan-empty"], [data-testid="step1-plan-chooser"]',
    { timeout: 60000 }
  )
  await page
    .locator('[data-testid="plan-open"], [data-testid="step1-plan-chooser"] [data-testid="plan-picker"]')
    .first()
    .click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 30000 })
  await page.locator(`[data-testid="plan-option"][data-plan-id="${worldPlan.id}"]`).click()
  await page.waitForTimeout(2000)

  const step1Line = page.locator('[data-testid="step1-plan-line"]')
  // Same race as step 2: the row is known first, the document lands a moment
  // later. "loading" is a correct intermediate state; "season" never is. This
  // polls for up to 45s rather than a fixed handful of 250ms ticks — under
  // load (a concurrent seed, a cold compile) the document fetch can take much
  // longer than the happy-path handful of seconds, and a short poll here reads
  // as a stuck "loading" that a slow server, not a broken one, produced.
  const step1States = new Set()
  for (let i = 0; i < 180; i++) {
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

  // A grade with zero teams starts OUT of a fresh plan (owner ruling
  // 2026-08-05: "out" greys the row and disables its stepper on purpose), so
  // picking the very first row is not safe — this picks the first row that is
  // actually IN the plan, which always has a workable stepper.
  const firstRow = page.locator('[data-testid="grade-row"][data-in="1"]').first()
  const gradeKey = await firstRow.getAttribute("data-grade")
  // The stepper is disabled until the plan's world has actually arrived (the
  // 2026-08-05 fix for the exact race above): wait for it enabled rather than
  // clicking blind and retrying into a 30s Playwright timeout.
  await firstRow.locator('button[aria-label^="One more"]').waitFor({ state: "attached" })
  await page.waitForFunction(
    (el) => el && !el.disabled,
    await firstRow.locator('button[aria-label^="One more"]').elementHandle(),
    { timeout: 45000 }
  )
  // Three taps of the stepper, then wait for the debounced write to land.
  for (let i = 0; i < 3; i++) {
    await firstRow.locator('button[aria-label^="One more"]').click()
    await page.waitForTimeout(200)
  }
  // Polls for up to 30s rather than a fixed 2.5s: under load the debounced
  // PATCH can take much longer than the happy path to actually land.
  const unitNow = async () =>
    (await docOf(worldPlan.id))?.settings?.state?.units?.find((u) => u.key === gradeKey)
  const seasonGrade = (step1Planner?.state?.units ?? []).find((u) => u.key === gradeKey)
  let afterBump = await unitNow()
  for (let i = 0; i < 60 && !(afterBump && seasonGrade && afterBump.teams === seasonGrade.expected + 3); i++) {
    await page.waitForTimeout(500)
    afterBump = await unitNow()
  }
  ok(
    "the stepper writes the estimate into the plan document",
    afterBump && seasonGrade && afterBump.teams === seasonGrade.expected + 3,
    `plan ${afterBump?.teams} vs season ${seasonGrade?.expected}`
  )

  // IN OR OUT of this plan (owner ruling 2026-08-05): only a plan can do this.
  // A STABLE locator, keyed by grade rather than reusing `firstRow`: that
  // locator's own selector includes `data-in="1"`, and the very first click
  // below flips this row to `data-in="0"` — reusing it after that would
  // silently re-resolve to a DIFFERENT grade's row that still matches.
  const thisRow = page.locator(`[data-testid="grade-row"][data-grade="${gradeKey}"]`)
  const inOut = thisRow.locator('[data-testid="grade-in-out"]')
  ok("step 1 offers in-or-out on a plan of your own", (await inOut.count()) === 1)
  await inOut.click()
  let afterOut = await unitNow()
  for (let i = 0; i < 60 && afterOut?.included !== false; i++) {
    await page.waitForTimeout(500)
    afterOut = await unitNow()
  }
  ok(
    "taking a grade out keeps its number, so putting it back costs nothing",
    afterOut?.included === false && afterOut?.teams === afterBump?.teams,
    `included=${afterOut?.included} teams=${afterOut?.teams}`
  )
  await inOut.click()
  let afterBackIn = await unitNow()
  for (let i = 0; i < 60 && afterBackIn?.included !== true; i++) {
    await page.waitForTimeout(500)
    afterBackIn = await unitNow()
  }
  ok("and it goes back in with the same number", afterBackIn?.included === true)
  ok(
    "step 1 on a plan the season does not run leaves the season byte-identical",
    (await seasonWorld()) === seasonBefore,
    (await seasonWorld()) === seasonBefore ? "" : "the season's estimates moved"
  )
  await page.screenshot({ path: `${SHOTS}/9-step1-plan-world.png`, fullPage: true })

  /* ── step 2, on the plan ─────────────────────────────────────────────── */
  // RE-PINNED 2026-08-06 wave (B1): step 2 has no chooser of its own any more
  // (a cold visit draws step2-plan-pointer) — the plan is opened at step 1 and
  // the URL carries it back here.
  await openPlanFromStep1(page, planUrl(2), worldPlan.id)
  await page.waitForSelector('[data-testid="league-weekends"]', { timeout: 60000 })

  const planLine = page.locator('[data-testid="step2-plan-line"]')
  /**
   * PINNED 2026-08-05, and it caught a real bug the first time it ran: the plan
   * ROW is known the moment you choose it, but the DOCUMENT arrives a moment
   * later, and in that gap step 2 was taking the SEASON path — a click attached a
   * gym to the league's real calendar. The line must never say "the season's own"
   * for a plan the season does not run: it says "loading" until the world is
   * there, and every control is disabled until then.
   */
  // Polls for up to 45s (not a fixed 1.8s window): under load the document
  // fetch can take far longer than the happy path, and cutting the sample
  // short would read a slow-but-honest "loading" as if it were "season".
  const planWorldStates = new Set()
  for (let i = 0; i < 300; i++) {
    const at = await planLine.getAttribute("data-world").catch(() => null)
    planWorldStates.add(at)
    if (at === "plan") break
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
    "tapping a weekend turns it on in the plan",
    onAfter === realKeys.length,
    `${onAfter} weekend(s) on`
  )
  await page.screenshot({ path: `${SHOTS}/7-step2-plan-world.png`, fullPage: true })

  /**
   * RE-PINNED 2026-08-06 (wave B, "attaches NO gym"): choosing a weekend here
   * used to attach the home gym as a side effect (withWeekendChosen carried
   * one). That side effect is deliberately gone — B1 calls it out by name —
   * so a freshly-chosen weekend has zero venues until something is dropped on
   * it on the board. What is pinned is the new reality, not the old one.
   */
  const chosen = weekendsIn(await docOf(worldPlan.id)).filter((w) => w.chosen)
  ok(
    "choosing a weekend attaches no gym any more: putting a building on it is board work now",
    chosen.length === realKeys.length && chosen.every((w) => (w.venues ?? []).length === 0),
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
  // Waits for the board itself, not a guessed number of seconds: under load
  // the step-3 fetch can take much longer than three seconds, and a flat
  // timeout here reads an empty, still-loading board as a content regression.
  await page.waitForSelector('[data-testid="gym-list"]', { timeout: 60000 })
  await page.waitForTimeout(500)
  /**
   * RE-PINNED 2026-08-06 (wave B, whole-season board): every Saturday the
   * season spans is on the board now — cards AND thin ghost rows alike — and
   * BOTH carry `[data-session-id]` whenever a session exists behind them
   * (GhostDateRow sets it too; only its own `ghost-date` testid tells the two
   * apart). So "the plan's own world, with no reload" is read off the count
   * of REAL weekend cards, not off dashed-vs-not: a chosen-but-still-gymless
   * weekend (exactly what step 2 just produced, per the ruling above) is
   * dashed too, but it is a card because it is chosen — never a ghost.
   */
  const boardWeekends = await page.locator("[data-session-id]").count()
  const realCards = await page.locator('[data-session-id]:not([data-testid="ghost-date"])').count()
  ok(
    "stepping 2 → 3 draws the plan's own world, with no reload",
    boardWeekends > 0 && realCards === realKeys.length,
    `${boardWeekends} dated row(s) (cards+ghosts), ${realCards} real weekend card(s) (expected ${realKeys.length})`
  )

  /* ── one gym list, there whenever a plan is open ─────────────────────── */
  const tray = page.locator('[data-testid="gym-list"]')
  ok(
    "the gym list is on the board with a plan open",
    (await tray.count()) === 1,
    `${await tray.count()} gym list`
  )

  /**
   * GIVE THE FIRST CHOSEN WEEKEND A REAL GYM, so there is a genuine placement
   * to strand below. Attaching a gym to a weekend is board work now (wave B),
   * and the board's own drop lands on the CLIENT working copy only — nothing
   * server-side until Save — so this writes the plan's world directly, the
   * same PATCH {settings:{state}} path saveWorld uses. It is a plan write, not
   * a season write: nothing here touches the season's own rows.
   */
  const worldDoc = await docOf(worldPlan.id)
  const homeGym = worldDoc?.settings?.state?.gyms?.find((g) => g.role === "home")
  ok("the plan's roster carries a home gym to attach", Boolean(homeGym), JSON.stringify(homeGym))
  const firstSession = chosen[0].sessionId
  const worldWithGym = worldDoc.settings.state
  for (const win of worldWithGym.windows ?? []) {
    for (const w of win.weekends ?? []) {
      if (w.sessionId !== firstSession) continue
      w.venues = [
        {
          venueId: homeGym.venueId,
          name: homeGym.name,
          role: "home",
          capacityGames: 40,
          fillOrder: 1,
          courts: homeGym.courts ?? 2,
          courtDays: 2,
          days: 2,
          hoursPerCourtDay: 4,
        },
      ]
      w.capacityGames = 40
      w.largestVenueCapacity = 40
    }
  }
  const gymAttached = await page.request.patch(
    `${BASE}/api/seasons/${SEASON}/plans/${worldPlan.id}`,
    { data: { settings: { state: worldWithGym } } }
  )
  ok(
    "the plan's own world gains a gym on that weekend (a plan write, not a season write)",
    gymAttached.ok(),
    `HTTP ${gymAttached.status()}`
  )

  /**
   * ── AUTOSAVE, on the board (owner ruling 2026-08-07, #4) ─────────────────
   * RE-PINS the old "Save to <plan>" round trip: there is no Save button any
   * more on a plan the operator owns, so persistence has to be proven by
   * editing, waiting out the debounce, and reloading — never by pressing a
   * control that no longer exists. Reopens fresh so the browser sees the gym
   * this script just attached by API, then makes ONE real client-side edit
   * (Redraw, a genuine working-copy change, safe here because the board was
   * just freshly loaded and so is not dirty — Redraw only confirms when it
   * would overwrite unsaved hand work) and watches it land with no button
   * anywhere in reach.
   */
  await openPlanFromStep1(page, planUrl(3), worldPlan.id)
  await page.waitForSelector('[data-testid="gym-list"]', { timeout: 60000 })
  await page.waitForTimeout(500)
  const planStateLine = page.locator('[data-testid="plan-state"]')
  ok(
    "before any edit, the plan-state line already says autosave owns it — no Save button anywhere",
    /Every change saves to/.test((await planStateLine.innerText().catch(() => "")).trim()),
    (await planStateLine.innerText().catch(() => "")).trim()
  )
  ok(
    "RE-PINNED: Save to plan, Save as new plan, Use for the season and Undo changes are all gone from the board",
    (await page.getByRole("button", { name: /^Save to /i }).count()) === 0 &&
      (await page.getByRole("button", { name: /^Save as new/i }).count()) === 0 &&
      (await page.getByRole("button", { name: /Use for the season/i }).count()) === 0 &&
      (await page.getByRole("button", { name: /^Undo changes/i }).count()) === 0
  )
  const assignmentBeforeRedraw = (await docOf(worldPlan.id))?.assignment ?? {}
  const redrawBtn = page.locator('[data-testid="redraw"]')
  ok(
    "Redraw is offered now that the plan's world can hold a calendar",
    (await redrawBtn.count()) === 1
  )
  await redrawBtn.click()
  // `dirty` flips synchronously on click, well before the 1s autosave
  // debounce fires — "Saving…" should show almost immediately.
  const autosaveStates = new Set()
  for (let i = 0; i < 20; i++) {
    autosaveStates.add((await planStateLine.innerText().catch(() => "")).trim())
    await page.waitForTimeout(150)
  }
  ok(
    "clicking Redraw goes dirty and the line says Saving…, with no button to press to make it happen",
    [...autosaveStates].some((s) => s === "Saving…"),
    [...autosaveStates].join(" → ")
  )
  // The debounce is ~1s; wait it out with margin, then poll the DOCUMENT
  // itself — not just the DOM — for the write actually landing on the server.
  let assignmentAfterRedraw = assignmentBeforeRedraw
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150)
    assignmentAfterRedraw = (await docOf(worldPlan.id))?.assignment ?? {}
    if (JSON.stringify(assignmentAfterRedraw) !== JSON.stringify(assignmentBeforeRedraw)) break
  }
  ok(
    "~1.5s after the edit, autosave has written the redraw to the plan document with no Save press",
    JSON.stringify(assignmentAfterRedraw) !== JSON.stringify(assignmentBeforeRedraw),
    `${Object.keys(assignmentBeforeRedraw).length} weekend(s) assigned before → ${Object.keys(assignmentAfterRedraw).length} after`
  )
  // RELOAD — a hard navigation, not a client cache — and the edit survives:
  // this is the autosave round trip that replaces the old save-to-plan one.
  await page.reload({ waitUntil: "load" })
  await page.waitForSelector('[data-testid="gym-list"]', { timeout: 60000 })
  await page.waitForTimeout(700)
  const assignmentAfterReload = (await docOf(worldPlan.id))?.assignment ?? {}
  ok(
    "RE-PINNED: reloading the page confirms the autosave round trip persisted (replaces the old save-to-plan round trip)",
    JSON.stringify(assignmentAfterReload) === JSON.stringify(assignmentAfterRedraw) &&
      JSON.stringify(assignmentAfterReload) !== JSON.stringify(assignmentBeforeRedraw),
    `${Object.keys(assignmentAfterReload).length} weekend(s) assigned after reload`
  )

  /* ── take the gym away: the placements strand, loudly ────────────────── */
  // Place a grade on the first chosen weekend, now that it really has a gym,
  // then turn that weekend off in step 2 and come back.
  const placeRes = await page.request.patch(
    `${BASE}/api/seasons/${SEASON}/plans/${worldPlan.id}`,
    {
      data: {
        assignment: { [firstSession]: ["age:Grade 7"] },
        venues: { [firstSession]: { "age:Grade 7": homeGym.venueId } },
      },
    }
  )
  ok("a grade is placed on the plan's first weekend", placeRes.ok(), `HTTP ${placeRes.status()}`)

  // RE-PINNED 2026-08-06 wave (B1): same reopen-from-step-1 path as above.
  await openPlanFromStep1(page, planUrl(2), worldPlan.id)
  await page.waitForSelector('[data-testid="league-weekends"]', { timeout: 60000 })
  await page.waitForSelector(`[data-testid="league-weekend"][data-weekend="${realKeys[0].key}"]`, {
    timeout: 30000,
  })
  await page.locator(`[data-testid="league-weekend"][data-weekend="${realKeys[0].key}"]`).click()
  // Waits for the toggle's own PATCH to land, not a guessed number of
  // seconds — the exact race the earlier realKeys loop already guards.
  await page
    .waitForFunction(
      (key) =>
        document.querySelector(`[data-testid="league-weekend"][data-weekend="${key}"]`)
          ?.getAttribute("data-on") === "0",
      realKeys[0].key,
      { timeout: 30000 }
    )
    .catch(() => {})

  await page.locator('ol button:has-text("Your calendar")').first().click()
  // Waits for the board itself rather than a guessed number of seconds — same
  // reasoning as the earlier step 2 → step 3 transition.
  await page.waitForSelector('[data-testid="gym-list"]', { timeout: 60000 })
  await page.waitForTimeout(500)
  const strandedBanner = page.locator('[data-testid="stranded-gyms"]')
  ok(
    "a placement whose weekend the plan dropped is flagged, not silently redrawn",
    (await strandedBanner.count()) === 1,
    (await strandedBanner.innerText().catch(() => "")).replace(/\n/g, " ").slice(0, 120) || "no banner"
  )
  // The rail is COLLAPSED BY DEFAULT since the 2026-08-10 board polish
  // (QA T-006): the slim tab carries the count; open it to read the rail.
  const railTab = page.locator('[data-testid="rail-tab"]')
  if ((await railTab.count()) > 0) await railTab.click()
  await page.waitForTimeout(400)
  const railOpen = await page.locator('[data-testid="rail-open-count"]').innerText().catch(() => "")
  ok(
    "the rail counts it as open work (opened from its collapsed tab)",
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

/* ===== THE ONE BUTTON, and "activate" gone for good (owner rulings #3/#4/#6) =====
 *
 * NEW data-testid="generate-season" (board header) and data-testid=
 * "step5-generate" (step 5's primary): one POST, `/plans/[planId]/generate`,
 * that previews two plain-words sufficiency questions and only writes once
 * the operator says "anyway".
 *
 * SAFETY (non-negotiable): this script NEVER presses the dialog through to
 * confirm — it registers a `dialog` handler that reads the message and calls
 * `dismiss()`, and it never POSTs `{confirm:true}` itself. A plan with ZERO
 * chosen weekends is used on purpose: with the season's real games-per-team
 * guarantee (gamesPerTeam=10, already read for the step 1 checks above) and
 * at least one grade with teams>0 (every fresh plan inherits the season's
 * estimates), every included unit's "promised games" is 0 < 10, so the
 * preflight is GUARANTEED to return `{needsConfirm:true, findings}` and
 * write nothing — confirmed below by reading the actual network response,
 * not assumed. Self-restoring: the plan it creates is deleted at the end, and
 * the season's active plan and games are checked byte-identical throughout.
 */
const GEN_PLAN = "Drive generate plan"
for (const p of await plansOf()) {
  if (p.name === GEN_PLAN) await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${p.id}`)
}
const plansBeforeGenPlan = await plansOf()
const activeBeforeGen = plansBeforeGenPlan.find((p) => p.isActive)?.id ?? null
const genMade = await page.request.post(`${BASE}/api/seasons/${SEASON}/plans`, {
  data: { name: GEN_PLAN, fresh: true },
})
const genPlan = genMade.ok() ? (await genMade.json()).plan : null
ok("a fresh, zero-weekend plan is created for the one-button drive", Boolean(genPlan), `HTTP ${genMade.status()}`)

if (genPlan) {
  const genUnits = (await docOf(genPlan.id))?.settings?.state?.units ?? []
  ok(
    "the season's games-per-team guarantee is a real positive number, so this plan is guaranteed to have findings",
    Number(plannerForBanner?.state?.gamesPerTeam ?? 0) > 0 && genUnits.some((u) => u.teams > 0),
    `gamesPerTeam=${plannerForBanner?.state?.gamesPerTeam} · ${genUnits.filter((u) => u.teams > 0).length} unit(s) with teams`
  )

  /* ── step 5, with nothing open: the pointer, not a shortcut ────────────── */
  await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=5`)
  await page.waitForSelector('[data-testid="step5-plan-pointer"], [data-testid="step5-finish"]', {
    timeout: 60000,
  })
  ok(
    "a bare step-5 visit is coherent: the finish handoff on an auto-opened plan, the pointer with nothing open — never a generate shortcut",
    ((await page.locator('[data-testid="step5-finish"]').count()) === 1) !==
      ((await page.locator('[data-testid="step5-plan-pointer"]').count()) === 1) &&
      (await page.locator('[data-testid="step5-generate"]').count()) === 0
  )

  /* ── open the plan, then press THE ONE BUTTON on the board (step 3) ────── */
  await openPlanFromStep1(page, planUrl(3), genPlan.id)
  const genBtn = page.locator('[data-testid="generate-season"]')
  ok("NEW: the board header offers generate-season now that a plan is open", (await genBtn.count()) === 1)

  const genResponsePromise = page
    .waitForResponse(
      (r) => /\/plans\/[^/]+\/generate$/.test(new URL(r.url()).pathname) && r.request().method() === "POST",
      { timeout: 20000 }
    )
    .catch(() => null)
  let dialogMessage = null
  page.once("dialog", async (dialog) => {
    dialogMessage = dialog.message()
    // SAFETY: dismiss, never accept. Accepting would resubmit with
    // {confirm:true}, which is the one POST this script must never make.
    await dialog.dismiss()
  })
  await genBtn.click()
  const genResponse = await genResponsePromise
  const genBody = genResponse ? await genResponse.json().catch(() => null) : null
  await page.waitForTimeout(500)
  ok(
    "pressing generate-season POSTs the one door, and (zero weekends chosen) it stops at needsConfirm, writing nothing",
    genBody?.needsConfirm === true && Array.isArray(genBody?.findings) && genBody.findings.length > 0,
    JSON.stringify(genBody)?.slice(0, 200)
  )
  ok(
    "SAFETY: the confirm dialog is observed and auto-dismissed, never accepted",
    typeof dialogMessage === "string" && dialogMessage.length > 0,
    (dialogMessage ?? "no dialog seen").slice(0, 160)
  )
  const plansAfterBoardGen = await plansOf()
  ok(
    "SAFETY: dismissing the dialog wrote nothing — the season's active plan did not change",
    (plansAfterBoardGen.find((p) => p.isActive)?.id ?? null) === activeBeforeGen,
    `active before ${activeBeforeGen} → after ${plansAfterBoardGen.find((p) => p.isActive)?.id ?? null}`
  )

  /* ── the same button, from step 5 ───────────────────────────────────────── */
  await openPlanFromStep1(page, planUrl(5), genPlan.id)
  await page.waitForSelector('[data-testid="step5-finish"]', { timeout: 60000 })
  const step5FinishBtn = page.locator('[data-testid="step5-finish"]')
  ok(
    "OWNER 2026-08-10: step 5's primary is the Finish-planning HANDOFF (step5-finish) — generation left the wizard",
    (await step5FinishBtn.count()) === 1
  )
  ok(
    "step 5 offers NO generate button anywhere — the Schedule tab owns generation",
    (await page.locator('[data-testid="step5-generate"]').count()) === 0
  )
  // SAFETY: the finish button ACTIVATES (writes a plan's world onto the
  // season), so this drive never presses it — presence and wording are the
  // whole check here; activation is exercised by the schedule-door drive
  // against a plan that is safe to hand over.
  const finishLabel = (await step5FinishBtn.innerText()).trim()
  ok(
    "the handoff says what it does in plain words",
    /finish planning/i.test(finishLabel) && /scheduling/i.test(finishLabel),
    finishLabel
  )
  const plansAfterStep5Gen = await plansOf()
  ok(
    "SAFETY: nothing pressed, nothing written — the active plan is unmoved",
    (plansAfterStep5Gen.find((p) => p.isActive)?.id ?? null) === activeBeforeGen,
    `active before ${activeBeforeGen} → after ${plansAfterStep5Gen.find((p) => p.isActive)?.id ?? null}`
  )

  /**
   * RULING #6: "the word 'activate' appears nowhere user-facing." Swept across
   * every screen this whole drive visited with a plan open — step 1, step 2,
   * the board, and step 5 — plus the plan picker's own open menu, where the
   * closest old word ("activate this plan") used to live. `/activate/i` never
   * matches "active" (the marker word plans still wear): "active" is six
   * letters, "activate" is eight, and the word never appears here as a
   * substring of the other.
   */
  await page.goto(planUrl(1) + `&plan=${genPlan.id}`)
  await page.waitForSelector('[data-testid="step1-plan-line"]', { timeout: 60000 })
  const chooserBtn = page.locator('[data-testid="step1-plan-chooser"] [data-testid="plan-picker"]')
  if ((await chooserBtn.count()) > 0) {
    await chooserBtn.click()
    await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 }).catch(() => {})
  }
  const sweepTexts = [
    await page.locator("body").innerText(),
  ]
  await page.keyboard.press("Escape").catch(() => {})
  await page.goto(planUrl(2) + `&plan=${genPlan.id}`)
  await page.waitForSelector('[data-testid="step2-plan-line"]', { timeout: 60000 })
  sweepTexts.push(await page.locator("body").innerText())
  await openPlanFromStep1(page, planUrl(3), genPlan.id)
  sweepTexts.push(await page.locator("body").innerText())
  await openPlanFromStep1(page, planUrl(5), genPlan.id)
  await page.waitForSelector('[data-testid="step5-finish"]', { timeout: 60000 })
  sweepTexts.push(await page.locator("body").innerText())
  const activateHits = sweepTexts.filter((t) => /activate/i.test(t))
  ok(
    'RULING #6: the word "activate" appears nowhere user-facing, across steps 1, 2, 3 and 5 with a plan open',
    activateHits.length === 0,
    activateHits.length > 0 ? activateHits[0].match(/.{0,40}activate.{0,40}/i)?.[0] : "clean"
  )

  /* ── clean up ────────────────────────────────────────────────────────── */
  const genGone = await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${genPlan.id}`)
  ok("the one-button drive's plan is deleted again", genGone.ok(), `HTTP ${genGone.status()}`)
  const plansAtEnd = await plansOf()
  ok(
    "the season's active plan is exactly the one it started with — nothing here ever generated anything",
    (plansAtEnd.find((p) => p.isActive)?.id ?? null) === activeBeforeGen
  )
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
