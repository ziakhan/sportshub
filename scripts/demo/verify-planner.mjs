/**
 * Season planner drive (owner 2026-08-02 build): login as the league owner,
 * open the planner board, exercise GET state + propose (balance/compact/
 * spread) + a real APPLY round-trip, screenshot the board.
 * Run from scripts/demo:  node verify-planner.mjs
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const LEAGUE_ID = "f58ff1a4-80b7-4548-b385-2d335d0f3612"
const SEASON_ID = "1464549a-ad8d-412b-a0c1-b1730e57ae2c"
const SHOTS = "/tmp/planner-verify"

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })

// Manual login (pre-hydration click is a native submit; wait first).
await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', "owner-nph@sportshub.demo")
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(1000)
  if (i === 29) fail("never logged in")
}
console.log("logged in as owner-nph")

// API round-trips first.
const stateRes = await page.request.get(`${BASE}/api/seasons/${SEASON_ID}/planner`)
if (!stateRes.ok()) fail(`GET planner ${stateRes.status()}`)
const { state, suggestions } = await stateRes.json()
const weekends = state.windows.flatMap((w) => w.weekends)
console.log(
  `state: ${state.units.length} units, ${state.windows.length} windows, ${weekends.length} weekends, ${suggestions.length} suggestions`
)
if (state.units.length < 5) fail("expected the journey world's grade units")
if (weekends.length < 10) fail("expected the official 13 weekends")

for (const lever of ["balance", "compact", "spread"]) {
  const res = await page.request.post(`${BASE}/api/seasons/${SEASON_ID}/planner/propose`, {
    data: { lever },
  })
  if (!res.ok()) fail(`propose ${lever} ${res.status()}`)
  const body = await res.json()
  const assignedCount = Object.values(body.assignment).flat().length
  console.log(`propose ${lever}: ${assignedCount} chip placements, ${body.suggestions.length} suggestions`)
  if (assignedCount === 0) fail(`${lever} proposed nothing`)
}

// APPLY round-trip: save the balance proposal, confirm persisted, restore.
const before = weekends.map((w) => [w.sessionId, w.assigned])
const balance = await page.request
  .post(`${BASE}/api/seasons/${SEASON_ID}/planner/propose`, { data: { lever: "balance" } })
  .then((r) => r.json())
const applyRes = await page.request.post(`${BASE}/api/seasons/${SEASON_ID}/planner/apply`, {
  data: { assignment: balance.assignment },
})
if (!applyRes.ok()) fail(`apply ${applyRes.status()}`)
const applied = await applyRes.json()
console.log(`apply: updated ${applied.updated} sessions`)
const after = await page.request.get(`${BASE}/api/seasons/${SEASON_ID}/planner`).then((r) => r.json())
const afterMap = Object.fromEntries(
  after.state.windows.flatMap((w) => w.weekends).map((w) => [w.sessionId, w.assigned.sort()])
)
for (const [sid, keys] of Object.entries(balance.assignment)) {
  const want = [...keys].sort()
  const got = afterMap[sid] ?? []
  if (JSON.stringify(want) !== JSON.stringify(got))
    fail(`apply mismatch on ${sid}: want ${want} got ${got}`)
}
console.log("apply verified: unitKeys round-tripped through grade clusters")

// Restore the official assignment so the demo world stays pristine.
const restore = Object.fromEntries(before)
const restoreRes = await page.request.post(`${BASE}/api/seasons/${SEASON_ID}/planner/apply`, {
  data: { assignment: restore },
})
if (!restoreRes.ok()) fail("restore failed")
console.log("official calendar restored")

// The board itself.
await page.goto(`${BASE}/manage/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/planner`)
await page.waitForSelector("text=Season planner", { timeout: 20000 })
await page.waitForSelector("text=Grades and team counts", { timeout: 20000 })
await page.waitForTimeout(1500)
const chipCount = await page.locator("span[draggable=true]").count()
console.log(`board renders ${chipCount} draggable chips`)
if (chipCount < 10) fail("board should show grade chips on weekends")
await page.screenshot({ path: `${SHOTS}-board.png`, fullPage: true })

// Drive a lever through the UI.
await page.click("button:has-text('Balance')")
await page.waitForSelector("text=Proposed: flattest weekends", { timeout: 15000 })
await page.screenshot({ path: `${SHOTS}-proposed.png`, fullPage: true })
console.log("UI lever works; screenshots at", SHOTS + "-*.png")

await browser.close()
console.log("PLANNER VERIFY: ALL PASS")
