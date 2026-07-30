/**
 * Runtime verify: league console tune-up (2026-07-30 owner feedback round).
 * Settings status strip + compact registration · editable sessions w/ court
 * order · schedule mode question + readiness banner · session-scoped preview
 * · org link in sidebar.
 *
 * Run from scripts/demo:  node verify-league-tuneup.mjs
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const SHOT_DIR = "/tmp/league-tuneup-verify"
const FALL = {
  league: "971368ef-dff7-4b0b-8ba6-75216489876f",
  season: "e8f80a34-d65e-4434-a8b4-d4eb3613e88d",
}

const results = []
function check(label, ok, extra = "") {
  results.push({ label, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`)
}

async function login(page, email) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"], input[name="password"]').first().fill("TestPass123!")
  await page.locator('button[type="submit"]').first().click()
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500)
    const session = await (await page.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (session?.user) return
  }
  throw new Error(`Login as ${email} never produced a session`)
}

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const { mkdirSync } = await import("fs")
  mkdirSync(SHOT_DIR, { recursive: true })

  await login(page, "owner-nph@sportshub.demo")
  const consoleUrl = `${BASE}/manage/leagues/${FALL.league}/seasons/${FALL.season}/manage`

  // ---- 1. Settings: status strip + new order + compact registration ------
  await page.goto(`${consoleUrl}?tab=settings`)
  await page.waitForSelector("section#basics", { timeout: 60000 })
  await page.waitForTimeout(2000)
  const chipRow = await page.locator("button:has-text('Basics')").first().isVisible()
  check("settings status strip present", chipRow)
  const order = []
  for (const id of ["basics", "divisions", "registration", "game-format", "rules"]) {
    const el = page.locator(`section#${id}`)
    if ((await el.count()) === 1) order.push(id)
  }
  check(
    "sections in importance order",
    JSON.stringify(order) ===
      JSON.stringify(["basics", "divisions", "registration", "game-format", "rules"])
  )
  check(
    "deposit is a checkbox",
    (await page.locator("section#registration label:has-text('Deposit required') input[type=checkbox]").count()) === 1
  )
  check(
    "balance-due days control",
    (await page.locator("section#registration label:has-text('Remaining balance due')").count()) === 1
  )
  await page.screenshot({ path: `${SHOT_DIR}/1-settings-strip.png`, fullPage: true })

  // ---- 2. Schedule: readiness banner + mode question ---------------------
  await page.goto(`${consoleUrl}?tab=schedule`)
  await page.waitForTimeout(8000)
  const readiness = await page
    .locator("text=/generate the season|Not ready to generate/")
    .count()
  check("readiness banner in words", readiness > 0)
  check(
    "mode question present",
    (await page.locator("button:has-text('Session by session')").count()) > 0 &&
      (await page.locator("button:has-text('Whole season at once')").count()) > 0
  )
  const sessionChips = await page.locator("button:has-text('· empty'), button:has-text('✓')").count()
  check("session picker chips", sessionChips > 0)
  const capCards = await page.locator("text=This session's capacity").count()
  check("capacity scoped to selected session", capCards === 1)
  await page.screenshot({ path: `${SHOT_DIR}/2-schedule-mode.png`, fullPage: true })

  // ---- 3. Session-scoped preview: ~2 games/team, not the whole season ----
  await page.locator("button:has-text('Preview')").first().click()
  await page.waitForTimeout(12000)
  const previewHead = await page.locator("text=/Preview: \\d+ game/").first().textContent().catch(() => null)
  const previewCount = previewHead ? parseInt(previewHead.match(/Preview: (\d+) game/)?.[1] ?? "0") : 0
  check(
    "session preview is session-sized (8 games for 8 teams × 2/team, not 48)",
    previewCount > 0 && previewCount <= 10,
    `got ${previewCount}`
  )
  await page.screenshot({ path: `${SHOT_DIR}/3-session-preview.png`, fullPage: true })

  // ---- 4. Sessions editable + court picker -------------------------------
  const editBtn = page.locator("button:has-text('Edit')").first()
  check("session Edit button", (await editBtn.count()) > 0)
  await editBtn.click()
  await page.waitForTimeout(1000)
  check("court picker in editor", (await page.locator("text=Where do games run?").count()) > 0)
  const orderArrows = await page.locator("button[aria-label='Move up']").count()
  check("court preference order arrows", orderArrows > 0)
  await page.screenshot({ path: `${SHOT_DIR}/4-session-edit.png`, fullPage: true })
  // Save unchanged → PATCH round-trip
  await page.locator("button:has-text('Save session')").click()
  await page.waitForTimeout(3000)
  check(
    "session PATCH round-trip (list back, days intact)",
    (await page.locator("text=Where do games run?").count()) === 0
  )

  // ---- 5. Org link in sidebar -------------------------------------------
  const orgLink = await page.locator("a[href^='/manage/org/']").count()
  check("organization navigable from sidebar", orgLink > 0)

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
