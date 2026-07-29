import { chromium } from "playwright"
import { login } from "./login-lib.mjs"

const LEAGUE = "71f5a467-5980-4c8b-a672-e4a84b4d5486"
const SEASON = "02646cb3-467d-46a5-a1a3-900a290c7b55"
const SUB = "3119c8af-18e4-4468-b0fc-c29c1f6e08b3"
const TEAM = "d5f4b31a-55f1-4eaf-a0aa-c69f353a6cb8"

const browser = await chromium.launch()
const page = await browser.newPage()
await login(page, "http://localhost:3000", "owner-nph@sportshub.demo", "TestPass123!")

// 1. Internal team detail page
await page.goto(`http://localhost:3000/manage/leagues/${LEAGUE}/seasons/${SEASON}/teams/${SUB}`, { waitUntil: "networkidle" })
const body = await page.textContent("body")
const checks = {
  "team name": body.includes("Scarborough Titans U15"),
  "status badge": body.toLowerCase().includes("approved"),
  "entry fee": body.includes("$3,990") || body.includes("3,990"),
  "deposit row": body.includes("50% deposit"),
  "roster table": body.includes("Roster (10)"),
  "waiver col T&C": body.includes("NPH League Registration"),
  "waiver col Rowan": body.includes("Concussion Code"),
  "waiver states": body.includes("not sent") || body.includes("sent") || body.includes("signed"),
  "games empty state": body.includes("schedule is generated"),
  "contacts": body.includes("ClubOwner") || body.includes("@sportshub.demo"),
}
for (const [k, v] of Object.entries(checks)) console.log(v ? `  PASS ${k}` : `  FAIL ${k}`)

// 2. Teams tab rows: Details link present
await page.goto(`http://localhost:3000/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage`, { waitUntil: "networkidle" })
await page.click('button:has-text("Teams")')
await page.waitForTimeout(1200)
const detailLinks = await page.locator(`a[href*="/teams/"]:has-text("Details")`).count()
console.log(detailLinks >= 4 ? `  PASS teams tab Details links (${detailLinks})` : `  FAIL teams tab Details links (${detailLinks})`)
// one-row check: measure a row's height — single row ≈ < 60px
const rowH = await page.locator('div.border-court-100').first().evaluate((el) => el.getBoundingClientRect().height)
console.log(rowH < 60 ? `  PASS one-row height (${Math.round(rowH)}px)` : `  FAIL row still tall (${Math.round(rowH)}px)`)

// 3. Public team page: clickable season chip without games
await page.goto(`http://localhost:3000/team/${TEAM}`, { waitUntil: "networkidle" })
const chip = await page.locator(`a[href^="/league/"]:has-text("NPH Showcase League")`).count()
console.log(chip >= 1 ? "  PASS public page season chip clickable" : "  FAIL public page season chip missing")

await browser.close()
