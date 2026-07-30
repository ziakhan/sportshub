/**
 * Runtime verify: league IA redesign (2026-07-30).
 * Flat 8-tab console, one-page Settings, season checklist w/ status buttons,
 * legacy ?tab= remap, capacity words on Schedule, derived-naming forms.
 *
 * Run from scripts/demo:  node verify-league-ia.mjs
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const SHOT_DIR = "/tmp/league-ia-verify"
const FALL = {
  league: "971368ef-dff7-4b0b-8ba6-75216489876f",
  season: "e8f80a34-d65e-4434-a8b4-d4eb3613e88d",
}
const FORCE_CLUB = "9664fbd0-46da-4e00-b3c3-977339db2a3b"

const results = []
function check(label, ok, extra = "") {
  results.push({ label, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`)
}

async function login(page, email) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  // Cold-compiled pages hydrate slowly — clicking before React attaches
  // handlers does a native form submit that never logs in.
  await page.waitForTimeout(2500)
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"], input[name="password"]').first().fill("TestPass123!")
  await page.locator('button[type="submit"]').first().click()
  // Poll the session until the login is actually live (storageState gotcha)
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

  // ---- 1. Flat tab row, no sub-pills -------------------------------------
  const consoleUrl = `${BASE}/manage/leagues/${FALL.league}/seasons/${FALL.season}/manage`
  await page.goto(consoleUrl)
  await page.waitForSelector('[role="tablist"]', { timeout: 30000 })
  await page.waitForTimeout(1500)
  const tabs = await page.locator('[role="tablist"] [role="tab"]').allTextContents()
  check(
    "flat 8-tab row",
    JSON.stringify(tabs) ===
      JSON.stringify(["Overview", "Clubs", "Teams", "Schedule", "Standings", "Playoffs", "Referees", "⚙ Settings"]),
    tabs.join(" · ")
  )
  // The old two-level nav rendered a pill row under the tablist
  const pills = await page.locator('[role="tablist"] + div button.rounded-full').count()
  check("no second-level pill nav", pills === 0)

  // ---- 2. Season checklist on Overview w/ status button ------------------
  const checklist = page.locator("text=Season checklist").first()
  check("season checklist present", (await checklist.count()) > 0)
  const closeBtn = await page.locator("button:has-text('Close registration'), button:has-text('Close anyway')").count()
  check("status action lives in checklist (Fall = REGISTRATION)", closeBtn > 0)
  // Header must NOT have its own status button anymore
  const headerClose = await page
    .locator("h1 ~ * button:has-text('Close Registration')")
    .count()
  check("no header status button", headerClose === 0)
  await page.screenshot({ path: `${SHOT_DIR}/1-overview-checklist.png`, fullPage: true })

  // ---- 3. Settings: one page, five visible sections ----------------------
  await page.click('[role="tab"]:has-text("Settings")')
  await page.waitForTimeout(800)
  for (const sec of ["basics", "registration", "game-format", "rules", "divisions"]) {
    const present = await page.locator(`section#${sec}`).count()
    check(`settings section #${sec}`, present === 1)
  }
  const savedBasicsLabel = await page.locator('section#basics input').first().inputValue()
  check("basics form populated", savedBasicsLabel.length > 0, savedBasicsLabel)
  await page.screenshot({ path: `${SHOT_DIR}/2-settings-onepage.png`, fullPage: true })

  // ---- 4. Legacy ?tab= remap ---------------------------------------------
  await page.goto(`${consoleUrl}?tab=tiebreakers`)
  await page.waitForTimeout(2000)
  const url = page.url()
  check("legacy ?tab=tiebreakers remaps to settings", url.includes("tab=settings"), url)
  const rulesVisible = await page.locator("section#rules").isVisible()
  check("rules section on screen after remap", rulesVisible)

  // ---- 5. Schedule tab: capacity words + sessions + venues + scheduler ---
  await page.goto(`${consoleUrl}?tab=schedule`)
  await page.waitForTimeout(8000) // capacity fetch + cold compiles
  const words = await page.locator("text=/You need .* game slots/").count()
  check("capacity math in words at top", words > 0)
  check("sessions panel on schedule tab", (await page.locator("text=Sessions (game days)").count()) > 0)
  check("venues panel on schedule tab", (await page.locator("h3:has-text('Venues'), div:has-text('Venues')").first().count()) > 0)
  check("venue page link present", (await page.locator("a:has-text('Venue page')").count()) > 0)
  await page.screenshot({ path: `${SHOT_DIR}/3-schedule-capacity-words.png`, fullPage: true })

  // ---- 6. Division editor: structured create + composed name + delete ----
  await page.goto(`${consoleUrl}?tab=settings`)
  await page.waitForTimeout(1500)
  const divSection = page.locator("section#divisions")
  await divSection.scrollIntoViewIfNeeded()
  const selects = divSection.locator("select")
  await selects.nth(0).selectOption("U11")
  await selects.nth(1).selectOption("MALE")
  await selects.nth(2).selectOption("2")
  const preview = await divSection.locator("text=Will be named").count()
  check("division name preview shows", preview > 0)
  await divSection.locator("button:has-text('Add Division')").click()
  await page.waitForTimeout(4000)
  const created = await page.locator("text=U11 Boys · Tier 2").count()
  check("division created with composed name", created > 0)
  await page.screenshot({ path: `${SHOT_DIR}/4-division-composed.png`, fullPage: true })
  // cleanup: delete it (keeps the demo world pristine)
  page.on("dialog", (d) => d.accept())
  const row = page.locator("div", { hasText: "U11 Boys · Tier 2" }).locator("button:has-text('Remove')").last()
  await row.click()
  await page.waitForTimeout(2000)
  const stillThere = await page.locator("text=U11 Boys · Tier 2").count()
  check("division cleanup (deleted)", stillThere === 0)

  // ---- 7. Club side: derived team-name form + club Short Name ------------
  const clubPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  clubPage.on("dialog", (d) => d.accept())
  await login(clubPage, "owner-force@sportshub.demo")
  await clubPage.goto(`${BASE}/clubs/${FORCE_CLUB}/teams/create`)
  await clubPage.waitForSelector("#ageGroup", { timeout: 30000 })
  await clubPage.waitForTimeout(6000) // let the club (shortName) fetch land
  const nameInput = await clubPage.locator('input#name').count()
  check("team create: no typed name input", nameInput === 0)
  await clubPage.selectOption("#ageGroup", "U15")
  await clubPage.locator("button:has-text('Blue')").first().click()
  await clubPage.waitForTimeout(500)
  const previewText = await clubPage.locator("text=Team name (written for you)").locator("..").textContent()
  check(
    "team name preview composes club + age + suffix",
    (previewText ?? "").includes("Burlington Force Elite U15 Blue"),
    previewText?.trim().slice(0, 90)
  )
  await clubPage.screenshot({ path: `${SHOT_DIR}/5-team-create-derived.png`, fullPage: true })

  await clubPage.goto(`${BASE}/clubs/${FORCE_CLUB}/settings`)
  await clubPage.waitForTimeout(2000)
  const shortNameField = await clubPage.locator("text=Short Name").count()
  check("club settings: Short Name field", shortNameField > 0)
  await clubPage.screenshot({ path: `${SHOT_DIR}/6-club-shortname.png`, fullPage: true })

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
