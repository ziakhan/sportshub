/** Drive the plan seam (owner design 2026-08-10): journey strip, built-on
 *  header, change→door, quick-setup dialog render, live division rename. */
import { chromium } from "playwright"
const BASE = "http://localhost:3000"
const SHOT = "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/558c8853-b51f-4a1c-ad6b-110ae708a3e1/scratchpad"
const SCHED = `${BASE}/manage/leagues/e48a0464-33a8-4be2-b4bc-75b78c3889f4/seasons/160b2f09-a95a-4a64-9b90-03793cae105b/manage?tab=schedule`
let pass = 0, fail = 0
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); ok ? pass++ : fail++ }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
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

await page.goto(SCHED, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByText("Built on plan").waitFor({ timeout: 90000 })
check("built-on header answers 'where am I'", true)
const strip = await page.getByTestId("journey-strip").innerText()
check("journey strip shows the road", ["Plan", "Divisions", "Generate", "Publish"].every((w) => strip.includes(w)))
await page.screenshot({ path: `${SHOT}/door-A-built-on.png` })

/* change → the door, with quick setup + full planner paths */
await page.getByRole("button", { name: "change", exact: true }).click()
await page.getByText("Which plan drives this schedule?").waitFor({ timeout: 10000 })
check("change reveals the door", true)
check("door offers quick setup and the full planner", (await page.getByRole("button", { name: /Quick setup/ }).count()) === 1 && (await page.getByRole("link", { name: /Plan it properly/ }).count()) === 1)
await page.getByRole("button", { name: /Quick setup/ }).click()
await page.getByText("Where do you play?").waitFor({ timeout: 15000 })
await page.locator('input[type="checkbox"]').first().waitFor({ timeout: 30000 })
const qbox = await page.getByText("Where do you play?").boundingBox()
check(`quick setup dialog in viewport (y=${Math.round(qbox?.y ?? -1)})`, qbox !== null && qbox.y > 0 && qbox.y < 600)
check("quick setup lists gyms + weekends + hours + games", (await page.locator('input[type="checkbox"]').count()) >= 1 && (await page.locator('input[type="date"]').count()) === 1 && (await page.locator('input[type="time"]').count()) === 2 && (await page.locator('input[type="number"]').count()) === 1)
await page.screenshot({ path: `${SHOT}/door-B-quick-setup.png` })
await page.getByRole("button", { name: "Cancel" }).click()
await page.getByRole("button", { name: "keep it" }).click()

/* live rename: pencil → type → blur → saved (EXACT aria-label — a loose
   ancestor match once renamed the wrong grade's division) */
const row = page.locator('button[aria-label="Rename Grade 9 Boys · Division A"]')
await row.waitFor({ timeout: 30000 })
await row.click()
const input = page.locator('input[aria-label^="Name for"]')
await input.fill("Grade 9 Boys · NORTH")
await input.blur()
let renamed = false
for (let i = 0; i < 20 && !renamed; i++) {
  await page.waitForTimeout(1000)
  const fm = await page.request.get(`${BASE}/api/seasons/160b2f09-a95a-4a64-9b90-03793cae105b/divisions/formation`).then((r) => r.json())
  renamed = fm.grades.find((g) => g.ageGroup === "Grade 9").divisions.some((d) => d.name === "Grade 9 Boys · NORTH")
}
check("rename autosaves on blur (no save button)", (await page.getByText("NORTH (", { exact: false }).count()) > 0)
check("rename persisted to the database", renamed)
await page.screenshot({ path: `${SHOT}/door-C-renamed.png` })
/* rename back */
await page.locator('button[aria-label="Rename Grade 9 Boys · NORTH"]').click()
await page.locator('input[aria-label^="Name for"]').fill("Grade 9 Boys · Division A")
await page.locator('input[aria-label^="Name for"]').blur()
await page.waitForTimeout(4000)
const fm2 = await page.request.get(`${BASE}/api/seasons/160b2f09-a95a-4a64-9b90-03793cae105b/divisions/formation`).then((r) => r.json())
check("renamed back — world unchanged", fm2.grades.find((g) => g.ageGroup === "Grade 9").divisions.some((d) => d.name === "Grade 9 Boys · Division A"))

await browser.close()
console.log(`${pass}/${pass + fail} checks passed`)
process.exit(fail === 0 ? 0 : 1)
