/**
 * Check that the merge confirmation reports the truth, using the exact pair
 * that went wrong on 2026-08-15: the Mississauga club (5 teams, 92 payments)
 * against the bare Lancers listing. Merging that way round must be flagged.
 */
import { chromium } from "playwright"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const MIS = "777c542e-742e-45ad-95c4-60a9f2ba081e"
const LAN = "677e11f4-f7fe-4ba4-bfa9-74f0674461d1"

let failed = false
const check = (ok, msg) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`)
  if (!ok) failed = true
}

const browser = await chromium.launch()
const page = await browser.newContext().then((c) => c.newPage())
await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle", timeout: 90000 })
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', "admin@sportshub.demo")
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
// The post-login redirect tears down the execution context, so wait for the
// navigation to settle before evaluating anything in the page.
await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 60000 })
await page.waitForLoadState("networkidle")
for (let i = 0; i < 40; i++) {
  const s = await page
    .evaluate(() => fetch("/api/auth/session").then((r) => r.json()).catch(() => null))
    .catch(() => null)
  if (s?.user?.id) break
  await page.waitForTimeout(1000)
}

const preview = (sourceId, targetId) =>
  page.evaluate(
    ([s, t]) =>
      fetch(`/api/admin/clubs/lifecycle?preview=merge&sourceId=${s}&targetId=${t}`).then((r) =>
        r.json()
      ),
    [sourceId, targetId]
  )

try {
  console.log("\nWRONG WAY ROUND (what actually happened)")
  const bad = await preview(MIS, LAN)
  check(bad.backwards === true, "flagged as backwards")
  check(
    bad.moves.some((m) => m.label === "payment" && m.count === 92),
    `payments counted: ${bad.moves.find((m) => m.label === "payment")?.count}`
  )
  check(
    bad.moves.some((m) => m.label === "team" && m.count === 5),
    `teams counted: ${bad.moves.find((m) => m.label === "team")?.count}`
  )
  console.log(
    `       would move: ${bad.moves.map((m) => `${m.count} ${m.label}`).join(", ")}`
  )

  console.log("\nRIGHT WAY ROUND")
  const good = await preview(LAN, MIS)
  check(good.backwards === false, "not flagged")
  check(good.moves.length === 0, `nothing attached to the bare listing (${good.moves.length})`)

  console.log("\nGUARDS")
  const missing = await page.evaluate(() =>
    fetch("/api/admin/clubs/lifecycle?preview=merge&sourceId=").then((r) => r.status)
  )
  check(missing === 400, `missing ids rejected (${missing})`)
} finally {
  await browser.close()
  console.log(failed ? "\nVERIFY FAILED" : "\nVERIFY OK")
  process.exitCode = failed ? 1 : 0
}
