/**
 * Drive the divisions lifecycle (design 2026-08-09): setup door, manage
 * door, lock state, playoffs calm state, DIVISION_FIRST opening round.
 * Runs against localhost on the COLLAPSED pre-season world; leaves the
 * world back at the scheduling gate (splits Grade 7, manages it, merges).
 */
import { chromium } from "playwright"
const BASE = "http://localhost:3000"
const SHOT = "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/558c8853-b51f-4a1c-ad6b-110ae708a3e1/scratchpad"
const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"
const SCHED = `${BASE}/manage/leagues/e48a0464-33a8-4be2-b4bc-75b78c3889f4/seasons/${SEASON}/manage?tab=schedule`
const TWIN = `${BASE}/manage/leagues/db302c51-3589-4d36-9b18-814a002967f1/seasons/860f7c32-65be-45c4-8d4f-84fea6c5d296/manage`
let pass = 0, fail = 0
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); ok ? pass++ : fail++ }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
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

/* 1 — the scheduling gate + clean card */
await page.goto(SCHED, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByText("Set up divisions").first().waitFor({ timeout: 90000 })
check("scheduling gate speaks", (await page.getByText("You're about to build the real schedule").count()) > 0)
check("card offers setup only (no Manage rows)", (await page.getByRole("button", { name: "Manage" }).count()) === 0)
await page.screenshot({ path: `${SHOT}/v3-A-gate.png` })

/* 2 — setup door: checkbox → shape → deal → board + yes/no → create */
await page.getByText("Set up divisions").first().click()
await page.getByText("Create divisions for teams").waitFor({ timeout: 10000 })
const box = await page.getByText("Create divisions for teams").boundingBox()
check(`dialog in viewport (y=${Math.round(box?.y ?? -1)})`, box !== null && box.y > 0 && box.y < 500)
check("setup lists only unsplit grades", (await page.locator("label", { hasText: "one group today" }).count()) >= 6)
await page.locator("label", { hasText: "Grade 7" }).locator('input[type="checkbox"]').check()
await page.getByRole("button", { name: /Set up 1 grade/ }).click()
await page.getByText("How many divisions?").waitFor({ timeout: 5000 })
check("no dropdowns anywhere in setup", (await page.locator("select").count()) === 0)
await page.getByText("Deal randomly", { exact: false }).first().click()
await page.getByTestId("division-col-pool").waitFor({ timeout: 5000 })
check("yes/no question present", (await page.getByText("do divisions play each other?").count()) === 1)
await page.getByText("Yes — they can mix").click()
await page.screenshot({ path: `${SHOT}/v3-B-setup-board.png` })
await page.getByRole("button", { name: /Create 2 divisions/ }).click()
await page.getByText("✓ Grade 7", { exact: false }).waitFor({ timeout: 15000 })
await page.getByRole("button", { name: "Close" }).click()
await page.waitForTimeout(2500)

/* 3 — card rows + manage door */
await page.getByRole("button", { name: "Manage" }).first().waitFor({ timeout: 90000 })
check("split grade row appears with Manage", true)
await page.screenshot({ path: `${SHOT}/v3-C-card-rows.png` })
await page.getByRole("button", { name: "Manage" }).first().click()
await page.getByText("manage divisions").waitFor({ timeout: 10000 })
const colCount = async (id) => (await page.getByTestId(`division-col-${id}`).getByTestId("team-chip").count())
check("board seeded from today's divisions", (await colCount(0)) >= 2 && (await colCount(1)) >= 2)
check("cross-play shows saved YES", (await page.getByRole("button", { name: /Yes — they can mix/ }).getAttribute("aria-pressed")) === "true")
/* inline rename */
await page.locator('input[aria-label="Division 1 name"]').fill("Grade 7 Boys · EAST")
/* drag one team across, one out and back */
const a0 = await colCount(0), b0 = await colCount(1)
await page.getByTestId("division-col-0").getByTestId("team-chip").first().dragTo(page.getByTestId("division-col-1"))
await page.waitForTimeout(300)
check("drag across works in manage", (await colCount(0)) === a0 - 1 && (await colCount(1)) === b0 + 1)
await page.getByTestId("division-col-1").getByTestId("team-chip").first().dragTo(page.getByTestId("division-col-pool"))
await page.waitForTimeout(300)
check("pool guard speaks + save disabled", (await page.getByText("still unassigned").count()) === 1 && (await page.getByRole("button", { name: "Save changes" }).isDisabled()))
await page.getByTestId("division-col-pool").getByTestId("team-chip").first().dragTo(page.getByTestId("division-col-0"))
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOT}/v3-D-manage.png` })
await page.getByRole("button", { name: "Save changes" }).click()
await page.waitForTimeout(2500)
await page.getByText("EAST").first().waitFor({ timeout: 90000 })
check("rename persisted to the card row", true)

/* 4 — merge back through manage */
await page.getByRole("button", { name: "Manage" }).first().click()
await page.getByText("or merge", { exact: false }).click()
await page.getByRole("button", { name: "Merge to one group" }).click()
await page.waitForTimeout(2500)
await page.getByText("Set up divisions").first().waitFor({ timeout: 90000 })
const g = await page.request.get(`${BASE}/api/seasons/${SEASON}/divisions/formation`).then((r) => r.json())
const g7 = g.grades.find((x) => x.ageGroup === "Grade 7")
check(`merge restores one group named "${g7.divisions[0].name}"`, g7.divisions.length === 1 && g7.divisions[0].name === "Grade 7 Boys")

/* 5 — playoffs calm on pre-season */
await page.goto(`${SCHED.replace("tab=schedule", "tab=playoffs")}`, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByText("Playoffs are planned once the season is underway").waitFor({ timeout: 90000 })
check("pre-season playoffs tab is calm", (await page.getByRole("button", { name: "Plan the playoffs" }).count()) === 0)
await page.screenshot({ path: `${SHOT}/v3-E-playoffs-calm.png` })

/* 6 — twin: locked divisions + full playoff config + DIVISION_FIRST */
await page.goto(`${TWIN}?tab=schedule`, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByText("Divisions are locked", { exact: false }).waitFor({ timeout: 90000 })
check("twin shows the publish-lock state, no Manage", (await page.getByRole("button", { name: "Manage" }).count()) === 0)
/* API: formation POST must 422 on the locked twin */
const lockRes = await page.request.post(`${BASE}/api/seasons/860f7c32-65be-45c4-8d4f-84fea6c5d296/divisions/formation`, {
  data: { ageGroup: "Grade 10", divisions: [{ id: null, name: "X", teamIds: ["a", "b"] }] },
})
check(`locked POST rejected (${lockRes.status()})`, lockRes.status() === 422)
await page.goto(`${TWIN}?tab=playoffs`, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.getByRole("button", { name: "Plan the playoffs" }).waitFor({ timeout: 90000 })
check("twin playoff config fully present", (await page.getByText("runs as 4 divisions", { exact: false }).count()) > 0)
await browser.close()
console.log(`${pass}/${pass + fail} checks passed`)
process.exit(fail === 0 ? 0 : 1)
