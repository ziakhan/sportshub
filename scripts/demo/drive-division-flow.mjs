import { chromium } from "playwright"
const BASE = "http://localhost:3000"
const SHOT = "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/558c8853-b51f-4a1c-ad6b-110ae708a3e1/scratchpad"
let pass = 0, fail = 0
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); ok ? pass++ : fail++ }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

/* login */
await page.goto(`${BASE}/auth/signin`, { waitUntil: "networkidle", timeout: 120000 })
await page.waitForTimeout(4000)
await page.fill('input[type="email"]', "owner-nph@sportshub.demo")
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 40; i++) {
  const s = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json()).catch(() => null)
  if (s?.user) break
  await page.waitForTimeout(500)
}

const schedUrl = `${BASE}/manage/leagues/e48a0464-33a8-4be2-b4bc-75b78c3889f4/seasons/160b2f09-a95a-4a64-9b90-03793cae105b/manage?tab=schedule`
await page.goto(schedUrl, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByText("Manage divisions").waitFor({ timeout: 90000 })

/* scroll DOWN first so the position test is honest, then open */
await page.evaluate(() => window.scrollTo(0, 600))
await page.getByText("Manage divisions").click()
const picker = page.getByText("Choose the grades to set up", { exact: false })
await picker.waitFor({ timeout: 10000 })
const box = await picker.boundingBox()
check(`dialog opens INSIDE the viewport (picker text at y=${Math.round(box?.y ?? -1)})`, box !== null && box.y > 0 && box.y < 500)
await page.screenshot({ path: `${SHOT}/flow-1-picker.png` })

/* pick Grade 7 only */
await page.locator("label", { hasText: "Grade 7" }).locator('input[type="checkbox"]').check()
await page.getByRole("button", { name: /Set up 1 grade/ }).click()
await page.getByText("How many divisions?").waitFor({ timeout: 5000 })
check("shape step: count buttons, no dropdowns", (await page.locator("select").count()) === 0)

/* deal randomly -> board */
await page.getByText("Deal randomly", { exact: false }).first().click()
await page.getByTestId("division-col-pool").waitFor({ timeout: 5000 })
const colCount = async (id) => (await page.getByTestId(`division-col-${id}`).getByTestId("team-chip").count())
check(`random deal fills both divisions (A=${await colCount(0)}, B=${await colCount(1)}, pool=${await colCount("pool")})`,
  (await colCount(0)) >= 2 && (await colCount(1)) >= 2 && (await colCount("pool")) === 0)

/* drag division->division */
const a0 = await colCount(0), b0 = await colCount(1)
await page.getByTestId("division-col-0").getByTestId("team-chip").first().dragTo(page.getByTestId("division-col-1"))
await page.waitForTimeout(400)
check(`drag A→B moves a team (A ${a0}→${await colCount(0)}, B ${b0}→${await colCount(1)})`,
  (await colCount(0)) === a0 - 1 && (await colCount(1)) === b0 + 1)

/* drag division->pool shows the guard, then back */
await page.getByTestId("division-col-1").getByTestId("team-chip").first().dragTo(page.getByTestId("division-col-pool"))
await page.waitForTimeout(400)
check("drag back to pool works and the guard speaks", (await colCount("pool")) === 1 && (await page.getByText("still unassigned").count()) === 1)
const createBtn = page.getByRole("button", { name: /Create 2 divisions/ })
check("Create is disabled while a team is unassigned", await createBtn.isDisabled())
await page.getByTestId("division-col-pool").getByTestId("team-chip").first().dragTo(page.getByTestId("division-col-0"))
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOT}/flow-2-board.png` })

/* create */
await createBtn.click()
await page.getByText("✓ Grade 7", { exact: false }).waitFor({ timeout: 15000 })
check("done step lists the result", true)
await page.getByRole("button", { name: "Close" }).click()
await page.waitForTimeout(2500)
const g7 = await page.request.get(`${BASE}/api/seasons/160b2f09-a95a-4a64-9b90-03793cae105b/divisions/formation`).then(r => r.json())
const grade7 = g7.grades.find((g) => g.ageGroup === "Grade 7")
check(`Grade 7 is now ${grade7.divisions.length} divisions in the DB`, grade7.divisions.length === 2)

/* merge back */
await page.goto(schedUrl, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByText("Manage divisions").waitFor({ timeout: 90000 })
await page.getByText("Manage divisions").click()
await page.locator("label", { hasText: "Grade 7" }).locator('input[type="checkbox"]').check()
await page.getByRole("button", { name: /Set up 1 grade/ }).click()
await page.getByText("or merge Grade 7 back to one division", { exact: false }).click()
await page.getByRole("button", { name: "Merge to one division" }).click()
await page.getByText("✓ Grade 7", { exact: false }).waitFor({ timeout: 15000 })
await page.getByRole("button", { name: "Close" }).click()
await page.waitForTimeout(2500)
const g7b = await page.request.get(`${BASE}/api/seasons/160b2f09-a95a-4a64-9b90-03793cae105b/divisions/formation`).then(r => r.json())
check("merge restores Grade 7 to one division", g7b.grades.find((g) => g.ageGroup === "Grade 7").divisions.length === 1)

/* playoffs tab pooling control on the twin */
await page.goto(`${BASE}/manage/leagues/db302c51-3589-4d36-9b18-814a002967f1/seasons/860f7c32-65be-45c4-8d4f-84fea6c5d296/manage?tab=playoffs`, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByText("runs as 4 divisions", { exact: false }).first().waitFor({ timeout: 90000 })
check("playoffs tab offers per-grade pooling", true)
const g11row = page.locator("div", { hasText: "Grade 11 runs as 4 divisions" }).last()
check("twin Grade 11 shows 'a bracket per division' selected",
  (await g11row.getByRole("button", { name: "a bracket per division" }).getAttribute("aria-pressed")) === "true")
await page.screenshot({ path: `${SHOT}/flow-3-playoffs.png` })

await browser.close()
console.log(`${pass}/${pass + fail} checks passed`)
process.exit(fail === 0 ? 0 : 1)
