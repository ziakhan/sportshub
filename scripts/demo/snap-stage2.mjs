// One-off evidence shot: the summary-first scheduler screen on a PREVIEW
// (no writes). Recipe per .claude/skills/verify/SKILL.md.
import { chromium } from "playwright"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = "e48a0464-33a8-4be2-b4bc-75b78c3889f4"

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1100 } })).newPage()
await page.goto(`${BASE}/auth/signin`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', "owner-nph@sportshub.demo")
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const s = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()))
  if (s?.user) break
  await page.waitForTimeout(1000)
}
await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage?tab=schedule`)
await page.waitForSelector("text=Generate the schedule", { timeout: 60000 })
await page.click("button:has-text('Whole season at once')").catch(() => {})
await page.waitForTimeout(300)
const preview = page.locator("button", { hasText: /^Preview/ }).first()
await preview.click()
await page.waitForSelector('[data-testid="schedule-verdict"]', { timeout: 180000 })
await page.waitForSelector('[data-testid="fairness-summary"]', { timeout: 30000 })
const rowsBefore = await page.locator('[data-testid="fairness-summary"] tbody tr').count()
console.log("fairness rows:", rowsBefore)
await page.locator('[data-testid="schedule-verdict"]').scrollIntoViewIfNeeded()
await page.screenshot({ path: "/Users/ziakhan/zia/personal/sportshub/scratchpad/shots-wave/stage2-summary.png", fullPage: false })
// Drill into the worst team.
await page.locator('[data-testid="fairness-summary"] tbody tr').first().click()
await page.waitForSelector('[data-testid="team-drilldown"]', { timeout: 20000 })
await page.screenshot({ path: "/Users/ziakhan/zia/personal/sportshub/scratchpad/shots-wave/stage2-drilldown.png", fullPage: false })
const verdict = await page.locator('[data-testid="schedule-verdict"]').innerText()
console.log("VERDICT:", verdict.replace(/\n/g, " | "))
console.log("rows:", await page.locator('[data-testid="fairness-summary"] tbody tr').count())
await browser.close()
console.log("OK")
