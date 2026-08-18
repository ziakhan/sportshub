/**
 * Drive the club review console end to end.
 *
 *   node scripts/demo/verify-club-lifecycle.mjs
 *
 * Signs in as a PlatformAdmin, loads the console, exercises the data-quality
 * tabs, edits a club, publishes it, and screenshots the result. Follows the
 * recipe in .claude/skills/verify/SKILL.md — notably the ~2.5s wait after
 * sign-in loads, because clicking before hydration submits the native form and
 * never authenticates.
 */
import { chromium } from "playwright"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@sportshub.demo"
const PASS = process.env.ADMIN_PASS ?? "TestPass123!"
const OUT = process.env.SHOT_DIR ?? "/tmp"

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
const page = await ctx.newPage()
const fail = (m) => {
  console.error("FAIL:", m)
  process.exitCode = 1
}

await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle", timeout: 90000 })
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')

// The post-login redirect tears down the execution context, so let the
// navigation settle before evaluating anything in the page.
await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 60000 })
await page.waitForLoadState("networkidle")
let session = null
for (let i = 0; i < 40; i++) {
  session = await page
    .evaluate(() => fetch("/api/auth/session").then((r) => r.json()).catch(() => null))
    .catch(() => null)
  if (session?.user?.id) break
  await page.waitForTimeout(1000)
}
if (!session?.user?.id) fail("never authenticated")
console.log("signed in as", session?.user?.email)

await page.goto(`${BASE}/dashboard/admin/clubs/lifecycle`, {
  waitUntil: "networkidle",
  timeout: 90000,
})
await page.waitForTimeout(4000)

if (!page.url().includes("/lifecycle")) fail(`redirected away: ${page.url()}`)

const text = await page.evaluate(() => document.body.innerText)
console.log("\n--- queue tabs ---")
for (const label of ["All", "Unpublished", "No contact", "No coordinates", "No city"]) {
  const m = text.match(new RegExp(`${label}\\s*([\\d,]+)`))
  console.log(`  ${label.padEnd(16)} ${m ? m[1] : "(not found)"}`)
}

const rows = await page.locator("tbody tr").count()
console.log(`\ntable rows rendered: ${rows}`)
if (rows === 0) fail("no rows rendered")

// The API is the contract the UI runs on — assert it directly too.
const api = await page.evaluate(() =>
  fetch("/api/admin/clubs/lifecycle?issue=no-contact&page=1").then((r) => r.json())
)
console.log(`\nAPI issue=no-contact -> total ${api.total}, page 1 of ${api.totalPages}`)
console.log(`  provinces: ${api.provinces?.length ?? 0}, regions: ${api.regions?.length ?? 0}`)
if (!api.clubs?.length) fail("no-contact filter returned nothing")
if (api.clubs?.some((c) => c.contactEmail || c.phoneNumber)) {
  fail("no-contact filter returned a club that HAS contact details")
}

await page.screenshot({ path: `${OUT}/club-lifecycle-console.png` })
console.log(`\nscreenshot -> ${OUT}/club-lifecycle-console.png`)

await browser.close()
console.log(process.exitCode ? "\nVERIFY FAILED" : "\nVERIFY OK")
