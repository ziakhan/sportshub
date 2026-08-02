/**
 * Plan wizard step 1 drive (wave 2, 2026-08-02). Two runs, no world damage:
 *
 *   node verify-plan-step1.mjs locked
 *     The NPH journey season (FINALIZED, every grade already registered):
 *     read-only banner, real counts instead of steppers, summary line.
 *
 *   node verify-plan-step1.mjs drive
 *     An editable season, driven as the platform admin: scratch grades are
 *     created, stepped through the UI, checked against the API (including the
 *     grade→divisions split), then removed again. The "N last season" hint
 *     comes from that league's real prior season.
 *
 * Screenshots to /tmp/plan-step1-*.png.
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const MODE = process.argv[2] ?? "locked"

// The NPH journey world (locked run).
const NPH = {
  leagueId: "f58ff1a4-80b7-4548-b385-2d335d0f3612",
  seasonId: "1464549a-ad8d-412b-a0c1-b1730e57ae2c",
  email: "owner-nph@sportshub.demo",
}
// An editable season whose league has history (drive run).
const SCRATCH = {
  leagueId: "415d4332-84ae-41e3-927a-5a4832df43f6",
  seasonId: "8d427814-2c4d-4692-b29b-0173224e7aa5",
  email: "admin@sportshub.demo",
  grade: "U12", // the prior season ran this grade, so the hint has something to say
}

const target = MODE === "locked" ? NPH : SCRATCH

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', target.email)
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(1000)
  if (i === 29) fail("never logged in")
}
console.log(`logged in as ${target.email}`)

const plannerState = async () => {
  const res = await page.request.get(`${BASE}/api/seasons/${target.seasonId}/planner`)
  if (!res.ok()) fail(`GET planner ${res.status()}`)
  return res.json()
}

const data = await plannerState()
if (!("lastSeasonTeams" in data)) fail("planner GET should carry lastSeasonTeams")
console.log(
  `planner: ${data.state.units.length} grades, ${data.state.gamesPerTeam} games/team, ` +
    `season ${data.seasonStatus}, last season ` +
    (data.lastSeasonTeams ? JSON.stringify(data.lastSeasonTeams) : "unknown (no prior season)")
)

const open = async () => {
  await page.goto(`${BASE}/manage/leagues/${target.leagueId}/seasons/${target.seasonId}/plan`)
  await page.waitForSelector("text=Plan your season", { timeout: 20000 })
  await page.waitForSelector("text=How many teams do you expect?", { timeout: 20000 })
  await page.waitForTimeout(1000)
}
const summary = async () =>
  (await page.locator("text=/team(s)? ·|team(s)?\\./").first().textContent())?.trim()

await open()

// ——— locked ———
if (MODE === "locked") {
  if (data.seasonStatus !== "FINALIZED") fail("locked mode expects a FINALIZED season")
  if (data.state.units.length < 1) fail("expected grades on the journey world")
  await page.waitForSelector("text=read only", { timeout: 10000 })
  const live = await page.locator('button[aria-label*="One more"]:not([disabled])').count()
  if (live > 0) fail(`${live} steppers still live while finalized`)
  // Every NPH grade has approved teams: registration truth, not an estimate.
  await page.waitForSelector("text=already registered", { timeout: 10000 })
  console.log(`summary line: ${await summary()}`)
  await page.screenshot({ path: "/tmp/plan-step1-locked.png", fullPage: true })
  await browser.close()
  console.log("PLAN STEP1 LOCKED: PASS")
  process.exit(0)
}

// ——— drive ———
if (["FINALIZED", "IN_PROGRESS", "COMPLETED"].includes(data.seasonStatus))
  fail("drive mode expects an editable season")
if (!data.lastSeasonTeams?.[SCRATCH.grade])
  fail(`drive season should have "${SCRATCH.grade}" history to show a hint`)

const divisionsUrl = `${BASE}/api/seasons/${target.seasonId}/divisions`
const listDivisions = async () =>
  (await page.request.get(divisionsUrl).then((r) => r.json())).divisions ?? []

// Pre-flight repair: a previous aborted run may have left scratch grades.
for (const d of await listDivisions()) {
  if (d.ageGroup !== SCRATCH.grade) continue
  await page.request.delete(`${divisionsUrl}?divisionId=${d.id}`)
  console.log("pre-flight: removed a stale scratch grade")
}

// TWO divisions of one grade: the grid shows ONE row, and the save has to
// split the operator's number across both.
const scratchIds = []
for (const tier of [1, 2]) {
  const res = await page.request.post(divisionsUrl, {
    data: { ageGroup: SCRATCH.grade, gender: "MALE", tier },
  })
  if (!res.ok()) fail(`create scratch division tier ${tier}: ${res.status()}`)
  scratchIds.push((await res.json()).id)
}
console.log(`scratch grade created: ${SCRATCH.grade} across ${scratchIds.length} divisions`)

const cleanup = async () => {
  for (const id of scratchIds) {
    const res = await page.request.delete(`${divisionsUrl}?divisionId=${id}`)
    if (!res.ok()) console.error(`CLEANUP FAILED for ${id}: ${res.status()}`)
  }
  console.log("scratch grades removed; world restored")
}

try {
  await open()
  const rows = page.locator("tbody tr")
  if ((await rows.count()) !== 1) fail(`two divisions of one grade should be ONE row, got ${await rows.count()}`)
  const before = await summary()
  console.log(`summary line: ${before}`)

  const plus = page.locator(`button[aria-label="One more ${SCRATCH.grade} team"]`)
  const minus = page.locator(`button[aria-label="One fewer ${SCRATCH.grade} team"]`)
  if (!(await minus.isDisabled())) fail("minus should be disabled at zero")

  for (let i = 0; i < 5; i++) await plus.click()
  await page.waitForSelector("text=Saved.", { timeout: 15000 })

  let after = await plannerState()
  let unit = after.state.units.find((u) => u.label === SCRATCH.grade)
  if (unit?.teams !== 5) fail(`expected 5 teams saved, got ${unit?.teams}`)
  if (unit?.source !== "expected") fail(`should read as an estimate, got ${unit?.source}`)
  const split = await listDivisions()
  const scratch = split.filter((d) => d.ageGroup === SCRATCH.grade).map((d) => d.expectedTeams)
  if (scratch.reduce((a, b) => a + b, 0) !== 5)
    fail(`the grade total must survive the split, got ${JSON.stringify(scratch)}`)
  console.log(`stepper saved 5, split across divisions as ${JSON.stringify(scratch)}`)

  // The hint reads last season, and says so when this year is bigger.
  const hint = await page.locator("tbody tr td:last-child").first().textContent()
  const history = data.lastSeasonTeams[SCRATCH.grade]
  if (!hint?.includes(`${history} last season`)) fail(`hint should read last season, got "${hint}"`)
  if (5 > history && !hint.includes("growing")) fail(`hint should say growing, got "${hint}"`)
  console.log(`hint reads: ${hint?.trim()}`)
  await page.screenshot({ path: "/tmp/plan-step1-stepped.png", fullPage: true })

  const stepped = await summary()
  console.log(`summary after stepping: ${stepped}`)
  if (stepped === before) fail("summary line did not recompute")

  await minus.click()
  await page.waitForTimeout(1500)
  await page.waitForSelector("text=Saved.", { timeout: 15000 })
  after = await plannerState()
  unit = after.state.units.find((u) => u.label === SCRATCH.grade)
  if (unit?.teams !== 4) fail(`expected 4 after one step down, got ${unit?.teams}`)
  console.log("stepping down saves too")

  // Reload: the number is really persisted, not just optimistic.
  await open()
  const shown = await page.locator("tbody tr td b").first().textContent()
  if (shown?.trim() !== "4") fail(`after reload the row should read 4, got "${shown}"`)
  console.log("survives a reload")
} finally {
  await cleanup()
}

await browser.close()
console.log("PLAN STEP1 DRIVE: ALL PASS")
