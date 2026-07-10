import { chromium } from "playwright"
import { ensureSession, BASE } from "./lib.mjs"
const HUSKIES = "1995bfdf-5750-470c-abd0-251f9c04aa8b"
const TEAM = "f1e3e7b3-30ba-4ede-aa32-f0f9eb8866cd"
const state = await ensureSession("owner-huskies@sportshub.demo")
const browser = await chromium.launch()
const ctx = await browser.newContext({ storageState: state, viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on("pageerror", (e) => errs.push(String(e)))
let bad = 0
for (const path of [`/clubs/${HUSKIES}/teams/${TEAM}/dashboard`, `/clubs/${HUSKIES}/teams/${TEAM}/roster`, `/clubs/${HUSKIES}/teams/${TEAM}/edit`, `/clubs/${HUSKIES}/teams/${TEAM}/league-rosters`]) {
  errs.length = 0
  const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(500)
  const status = res ? res.status() : 0
  const ok = status === 200 && errs.length === 0
  if (!ok) bad++
  console.log(`${ok ? " ok " : "FAIL"} ${status} ${path}${errs.length ? " " + errs[0].slice(0, 100) : ""}`)
}
await ctx.close(); await browser.close()
console.log(bad ? `${bad} FAILURES` : "TEAM PAGES CLEAN")
