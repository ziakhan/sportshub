import { chromium } from "playwright"
import { ensureSession, BASE } from "./lib.mjs"
const LEAGUE = "cf910ab9-f5cc-4ae9-80db-3c5507013b50"
const SEASON = "8d1b540d-f28c-42be-abe2-26d21893fd55"
const state = await ensureSession("owner-nph@sportshub.demo")
const browser = await chromium.launch()
const ctx = await browser.newContext({ storageState: state, viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on("pageerror", (e) => errs.push(String(e)))
const res = await page.goto(`${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage`, { waitUntil: "networkidle", timeout: 45000 })
console.log(`manage page status ${res.status()}`)
await page.waitForTimeout(800)
const tabs = await page.$$eval("button", (bs) => bs.map((b) => b.textContent?.trim()).filter((t) => t && /teams|schedule|standings|divisions|venues|referees|sessions|scheduling|tiebreak/i.test(t)))
console.log("tab buttons found:", tabs.slice(0, 12).join(" | "))
let bad = 0
for (const label of ["Teams", "Divisions", "Venues", "Sessions", "Scheduling", "Schedule", "Standings", "Tiebreakers", "Referees"]) {
  errs.length = 0
  const btn = page.locator("button", { hasText: new RegExp(`^\\s*${label}`, "i") }).first()
  if ((await btn.count()) === 0) { console.log(`  -- no tab: ${label}`); continue }
  await btn.click().catch(() => {})
  await page.waitForTimeout(900)
  const ok = errs.length === 0
  if (!ok) bad++
  console.log(`${ok ? " ok " : "FAIL"} tab ${label}${errs.length ? " " + errs[0].slice(0, 140) : ""}`)
}
await ctx.close(); await browser.close()
console.log(bad ? `${bad} TAB FAILURES` : "ALL TABS CLEAN")
