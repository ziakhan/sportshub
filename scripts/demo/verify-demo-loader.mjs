// Admin demo-loader drive (owner 2026-08-01): admin loads a stage via the
// console API, status polls to done, world marker reflects it.
import { chromium } from "playwright"
const BASE = "http://localhost:3000"
let passed = 0, failed = 0
const check = (l, ok, d = "") => { console.log(`${ok ? "✅" : "❌"} ${l}${d ? " — " + d : ""}`); ok ? passed++ : failed++ }
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
for (let attempt = 0; attempt < 3; attempt++) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  await page.locator('input[type="email"]').first().fill("admin@sportshub.demo")
  await page.locator('input[type="password"]').first().fill("TestPass123!")
  await page.locator('button[type="submit"]').first().click()
  let ok = false
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500)
    const s = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json()).catch(() => null)
    if (s?.user) { ok = true; break }
  }
  if (ok) break
  if (attempt === 2) { console.log("login failed"); process.exit(1) }
}
const st0 = await page.request.get(`${BASE}/api/admin/demos/status`)
check("status endpoint", st0.ok())
const world0 = (await st0.json()).world
check("world marker present", !!world0, JSON.stringify(world0))
// Page renders
await page.goto(`${BASE}/dashboard/admin/demos`)
await page.waitForTimeout(2500)
check("demos page shows journey card", await page.locator("text=NPH full-scale journey").isVisible().catch(() => false))
await page.screenshot({ path: "/tmp/demo-loader.png", fullPage: true })
// Trigger a stage-4 "fast forward" (already at 4 → seeder no-ops fast) via API
const load = await page.request.post(`${BASE}/api/admin/demos/load`, { data: { scenario: "nph-pitch-journey", stage: 4 } })
check("load endpoint accepts", load.ok())
let final = null
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(2000)
  const s = await page.request.get(`${BASE}/api/admin/demos/status`).then((r) => r.json())
  if (s.load?.state && s.load.state !== "running") { final = s.load.state; break }
}
check("load completes via spawn+poll", final === "done", String(final))
await browser.close()
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
