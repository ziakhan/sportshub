// Read-only check of plan step 3 after the gym-residency fix: which building
// the season strip names for each grade, weekend by weekend. Presses nothing
// that writes (no Keep, no Apply, no drags) — it only switches the Board|Strip
// view, which is local state.
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const SHOTS = process.env.SHOTS_DIR || "/tmp/strip-residency"
const LEAGUE = "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const p = await ctx.newPage()
p.on("pageerror", (e) => console.log("PAGEERROR:", e.message))

await p.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
await p.waitForTimeout(2500) // pre-hydration clicks never log in
await p.locator('input[type="email"], input[name="email"]').first().fill("owner-nph@sportshub.demo")
await p.locator('input[type="password"], input[name="password"]').first().fill("TestPass123!")
await p.locator('button[type="submit"]').first().click()
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(500)
  const session = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
  if (session?.user) break
  if (i === 39) throw new Error("login never became live")
}
console.log("session live")

await p.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`, {
  waitUntil: "domcontentloaded",
})
await p.waitForSelector('[data-testid="calendar-view"]', { timeout: 60_000 })
await p.waitForTimeout(2500)
await p.screenshot({ path: `${SHOTS}/step3-board.png`, fullPage: true })

// Board | Strip is a view toggle: no data moves.
await p.locator('[data-testid="calendar-view-strip"]').click()
await p.waitForSelector('[data-testid="season-strip"]', { timeout: 30_000 })
await p.waitForTimeout(1200)

const table = await p.evaluate(() => {
  const strip = document.querySelector('[data-testid="season-strip"]')
  const weekends = [...strip.querySelectorAll('[data-testid="strip-weekend"]')].map((th) =>
    th.textContent.replace(/\s+/g, " ").trim()
  )
  const gymRow = [...strip.querySelectorAll('[data-testid="strip-gyms"] td')].map((td) =>
    td.textContent.replace(/\s+/g, " ").trim()
  )
  const rows = [...strip.querySelectorAll('[data-testid="strip-row"]')].map((tr) => ({
    grade: tr.querySelector("th").textContent.replace(/\s+/g, " ").trim(),
    cells: [...tr.querySelectorAll("td")].map((td) =>
      td.textContent.replace(/\s+/g, " ").trim()
    ),
  }))
  return { weekends, gymRow, rows }
})

console.log("\nWEEKENDS:", table.weekends.join(" || "))
console.log("GYMS ON :", table.gymRow.join(" || "))
for (const row of table.rows) console.log(`${row.grade}  ::  ${row.cells.join(" | ")}`)

// The December columns, which is what the owner asked about.
const dec = table.weekends
  .map((w, i) => ({ w, i }))
  .filter(({ i }) => /Dec|1[29]–/.test(table.weekends[i]))
console.log("\nDECEMBER")
for (const { w, i } of dec) {
  console.log(`  ${w.replace(/ /g, " ")}  gyms: ${table.gymRow[i]}`)
  for (const row of table.rows) {
    const cell = row.cells[i]
    if (cell) console.log(`     ${row.grade.split(" teams")[0]} → ${cell}`)
  }
}

await p.screenshot({ path: `${SHOTS}/step3-strip.png`, fullPage: true })
const strip = p.locator('[data-testid="season-strip"]')
await strip.screenshot({ path: `${SHOTS}/season-strip.png` })
console.log(`\nshots: ${SHOTS}`)
await browser.close()
