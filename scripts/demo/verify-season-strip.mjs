/**
 * The season strip on plan step 3 (owner 2026-08-02: "show me some sort of
 * great view from the left side to the right side of where they are playing…
 * we can then maybe toggle between the proposed plan and this plan. Right now
 * we're making assumptions that both gyms are available").
 *
 *   node verify-season-strip.mjs
 *
 * Read only, on the NPH Showcase season that holds the official 35-placement
 * calendar: switch the view to Strip, read the month bands, the grade rows,
 * the gym row and the capacity readouts, toggle Kept plan against Proposal,
 * and prove at the end that nothing was kept or applied.
 *
 * Screenshots to /tmp/season-strip.png and /tmp/season-strip-kept.png.
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const LEAGUE = "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"
const EMAIL = "owner-nph@sportshub.demo"

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(1000)
  if (i === 29) fail("never logged in")
}
console.log(`logged in as ${EMAIL}`)

const plannerState = async () => {
  const res = await page.request.get(`${BASE}/api/seasons/${SEASON}/planner`)
  if (!res.ok()) fail(`GET planner ${res.status()}`)
  return res.json()
}
const placementsOf = (data) =>
  data.state.windows.flatMap((w) => w.weekends).reduce((n, w) => n + w.assigned.length, 0)

const before = await plannerState()
const keptPlacements = placementsOf(before)
console.log(
  `season: ${before.seasonStatus}, ${before.state.units.length} grades, ` +
    `${before.state.windows.length} months, ` +
    `${before.state.windows.flatMap((w) => w.weekends).length} weekends, ` +
    `${keptPlacements} kept placements`
)
if (keptPlacements !== 35) fail(`expected the official 35 placements, got ${keptPlacements}`)

await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`)
await page.waitForSelector("text=Plan your season", { timeout: 20000 })
await page.waitForSelector("[data-session-id]", { timeout: 20000 })
await page.waitForTimeout(600)
if ((await page.locator('[data-testid="season-strip"]').count()) > 0)
  fail("the board is meant to be the default view")

// ————————————————————————————— the strip —————————————————————————————
await page.click('[data-testid="calendar-view-strip"]')
await page.waitForSelector('[data-testid="season-strip"]', { timeout: 20000 })
await page.waitForTimeout(400)

const months = await page.locator('[data-testid="season-strip"] th[scope="colgroup"]').allTextContents()
console.log(`month bands: ${months.map((m) => m.trim()).join(" ")}`)
if (months.length !== before.state.windows.length)
  fail(`expected ${before.state.windows.length} month bands, got ${months.length}`)

const weekendCols = await page.locator('[data-testid="strip-weekend"]').count()
const expectedCols = before.state.windows.flatMap((w) => w.weekends).length
if (weekendCols !== expectedCols) fail(`expected ${expectedCols} weekend columns, got ${weekendCols}`)
console.log(`weekend columns: ${weekendCols}`)

const rows = await page.locator('[data-testid="strip-row"]').count()
if (rows !== before.state.units.length)
  fail(`expected ${before.state.units.length} grade rows, got ${rows}`)
const firstRow = (await page.locator('[data-testid="strip-row"] th').first().innerText()).replace(/\n/g, " · ")
console.log(`grade rows: ${rows} (first: ${firstRow})`)

// The gym row: the whole point of the view.
if ((await page.locator('[data-testid="strip-gyms"]').count()) !== 1) fail("no gym availability row")
const gymCells = await page.locator('[data-testid="strip-gyms"] td').allTextContents()
console.log(`gyms row: ${gymCells.map((c) => c.replace(/\s+/g, " ").trim()).join(" | ")}`)
if (gymCells.length !== weekendCols) fail("the gym row does not cover every weekend")
if (!gymCells.some((c) => /\w/.test(c))) fail("the gym row says nothing")

const meters = await page.locator('[data-testid="strip-capacity"]').allTextContents()
if (meters.length !== weekendCols) fail("a weekend is missing its capacity readout")
if (!meters.every((m) => /^\d+ \/ \d+$/.test(m.trim())))
  fail(`capacity readouts should read "demand / capacity", got ${JSON.stringify(meters.slice(0, 3))}`)
console.log(`capacity readouts: ${meters.map((m) => m.trim()).join(" ")}`)

// ————————————————————————— kept against proposal —————————————————————————
const pillsNow = await page.locator('[data-testid="strip-pill"]').count()
console.log(`proposal side: ${pillsNow} pills`)

await page.click('[data-testid="strip-side-kept"]')
await page.waitForTimeout(400)
const keptPills = await page.locator('[data-testid="strip-pill"]').count()
console.log(`kept side: ${keptPills} pills`)
if (keptPills < 30) fail(`expected the kept calendar's placements, got ${keptPills} pills`)
if (keptPills !== keptPlacements)
  fail(`the strip draws ${keptPills} placements, the season has ${keptPlacements}`)
// Read only: nothing on the kept side can be armed, and nothing offers to save.
if ((await page.locator('[data-testid="strip-pill"]:is(button)').count()) > 0)
  fail("the kept calendar must not be editable")
if ((await page.locator("button:has-text('Keep this calendar')").count()) > 0)
  fail("the kept side must not offer to save the proposal")
await page.screenshot({ path: "/tmp/season-strip-kept.png", fullPage: true })

await page.click('[data-testid="strip-side-proposal"]')
await page.waitForTimeout(400)
if ((await page.locator('[data-testid="strip-pill"]:is(button)').count()) === 0)
  fail("the proposal side should be editable")
if ((await page.locator("button:has-text('Keep this calendar')").count()) !== 1)
  fail("the proposal side keeps its save button")
console.log("toggle works both ways: kept is read only, proposal is live")

// One-tap move, armed and then cancelled: the strip must offer destinations
// inside the grade's own month, and Escape must put it back.
await page.locator('[data-testid="strip-pill"]').first().click()
await page.waitForSelector("text=is ready to move", { timeout: 10000 })
const targets = await page.locator('button[aria-label^="Move "]').count()
console.log(`arming a pill offers ${targets} destination${targets === 1 ? "" : "s"} in its own month`)
if (targets === 0) fail("an armed grade had nowhere to go")
await page.keyboard.press("Escape")
await page.waitForTimeout(300)
if ((await page.locator("text=is ready to move").count()) > 0) fail("Escape did not disarm")

await page.screenshot({ path: "/tmp/season-strip.png", fullPage: true })

// The grade column stays put while February scrolls into view.
const gradeCellX = async () =>
  (await page.locator('[data-testid="strip-row"] th').first().boundingBox())?.x
const restX = await gradeCellX()
const scrolled = await page.evaluate(() => {
  const table = document.querySelector('[data-testid="season-strip"] table')
  const box = table?.parentElement
  if (!box) return null
  box.scrollLeft = box.scrollWidth
  return { scrollLeft: box.scrollLeft, max: box.scrollWidth - box.clientWidth }
})
if (!scrolled || scrolled.max <= 0) fail("the strip should scroll sideways on a 13 weekend season")
await page.waitForTimeout(300)
const heldX = await gradeCellX()
if (Math.abs((heldX ?? 0) - (restX ?? 0)) > 1)
  fail(`the grade column moved while scrolling: ${restX} → ${heldX}`)
console.log(`sticky grade column holds at x=${heldX} through ${scrolled.max}px of scroll`)
await page.screenshot({ path: "/tmp/season-strip-scrolled.png", fullPage: true })

// A phone scrolls the strip, never the page.
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(500)
const sideways = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
}))
if (sideways.doc > sideways.win + 1)
  fail(`the page scrolls sideways on a phone: ${sideways.doc} > ${sideways.win}`)
const touchShort = await page.evaluate(() => {
  const pills = [...document.querySelectorAll('[data-testid="strip-pill"]')]
  return pills.filter((p) => p.getBoundingClientRect().height < 44).length
})
if (touchShort > 0) fail(`${touchShort} pills are under the 44px touch target`)
console.log(`phone: page width ${sideways.doc} of ${sideways.win}, every pill at least 44px`)
await page.screenshot({ path: "/tmp/season-strip-mobile.png", fullPage: true })
await page.setViewportSize({ width: 1500, height: 1100 })

// ——————————————————————— back to the board, unharmed ———————————————————————
await page.click('[data-testid="calendar-view-board"]')
await page.waitForSelector("[data-session-id]", { timeout: 20000 })
if ((await page.locator('[data-testid="season-strip"]').count()) > 0) fail("the strip did not close")
const chips = await page.locator('[data-session-id] span[draggable="true"]').count()
if (chips !== keptPlacements) fail(`the board lost chips in the refactor: ${chips}`)
await page.click('[data-testid="compare-toggle"]')
await page.waitForSelector('[data-testid="compare-banner"]', { timeout: 10000 })
await page.click('[data-testid="compare-toggle"]')
console.log(`board still whole: ${chips} chips, compare lens still opens`)

// ————————————————————————————— nothing moved —————————————————————————————
await page.reload()
await page.waitForSelector("[data-session-id]", { timeout: 20000 })
const after = await plannerState()
if (placementsOf(after) !== keptPlacements)
  fail(`the kept calendar changed: ${keptPlacements} → ${placementsOf(after)}`)
console.log(`kept calendar untouched: ${placementsOf(after)} placements`)

await browser.close()
console.log("SEASON STRIP: ALL PASS")
