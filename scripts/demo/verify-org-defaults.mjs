/**
 * Runtime verify: Phase A org season defaults.
 * Org "Season defaults" editor saves → league Settings shows the override
 * bar (seed seasons have explicit values) → Reset to organization flips the
 * section to the inherited read-only summary with the org's values.
 *
 * Run from scripts/demo:  node verify-org-defaults.mjs
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const SHOT_DIR = "/tmp/org-defaults-verify"
const ORG_ID = "3d1c8a5f-943c-4a76-b2a4-463c00c2e679"
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
  page.on("dialog", (d) => d.accept())

  await login(page, "owner-nph@sportshub.demo")

  // ---- 1. Org settings: Season defaults editor saves --------------------
  await page.goto(`${BASE}/manage/org/${ORG_ID}`)
  await page.waitForSelector("text=Season defaults", { timeout: 60000 })
  await page.waitForTimeout(1500)
  check("org Season defaults section", true)
  // set the org rulebook via the API (fast, deterministic), then reload UI
  const patch = await page.request.patch(`${BASE}/api/organizations/${ORG_ID}`, {
    data: {
      seasonDefaults: {
        gamesGuaranteed: 12,
        gamePeriods: "QUARTERS",
        periodLengthMinutes: 10,
        gameSlotMinutes: 90,
        teamFee: 3990,
        depositPct: 50,
        balanceDueDaysBeforeStart: 14,
        tiebreakerOrder: ["HEAD_TO_HEAD", "POINT_DIFFERENTIAL"],
        allowGuestPlayers: true,
      },
    },
  })
  check("org PATCH accepts seasonDefaults", patch.ok())
  await page.reload()
  await page.waitForTimeout(2000)
  const gamesVal = await page
    .locator("section:has-text('Games & format') input")
    .first()
    .inputValue()
    .catch(() => "")
  check("editor round-trips saved defaults", gamesVal === "12", `games=${gamesVal}`)
  await page.screenshot({ path: `${SHOT_DIR}/1-org-defaults.png`, fullPage: true })

  // ---- 2. League Settings: override bar on explicit sections ------------
  const settingsUrl = `${BASE}/manage/leagues/${FALL.league}/seasons/${FALL.season}/manage?tab=settings`
  await page.goto(settingsUrl)
  await page.waitForSelector("section#rules", { timeout: 60000 })
  await page.waitForTimeout(2000)
  const overrideBars = await page.locator("text=Overrides North Pole Hoops").count()
  check("seed season shows override bars (explicit values)", overrideBars >= 1, `${overrideBars} sections`)
  await page.screenshot({ path: `${SHOT_DIR}/2-override-bars.png`, fullPage: true })

  // ---- 3. Reset Rules to org → inherited summary -------------------------
  const rulesReset = page.locator("section#rules button:has-text('Reset to organization')")
  check("rules Reset button present", (await rulesReset.count()) > 0)
  await rulesReset.click()
  await page.waitForTimeout(3000)
  const inherited = await page.locator("section#rules >> text=Inherited from").count()
  check("rules section flips to inherited summary", inherited > 0)
  const orgTb = await page.locator("section#rules >> text=head to head").count()
  check("summary shows org tiebreakers", orgTb > 0)
  const chip = await page.locator("button:has-text('Rules'):has-text('Inherited')").count()
  check("status strip shows Inherited", chip > 0)
  await page.screenshot({ path: `${SHOT_DIR}/3-inherited-summary.png`, fullPage: true })

  // ---- 4. Override again ---------------------------------------------------
  await page.locator("section#rules button:has-text('Override for this league')").click()
  await page.waitForTimeout(1000)
  const form = await page.locator("section#rules >> text=Tiebreaker order").count()
  check("Override reopens the editable form", form > 0)

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
