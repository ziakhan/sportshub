// Runtime verification: Energy Pass poll bubble on the web team chat.
// Login as the Lords parent -> open Lords G9 chat -> poll renders with the
// new design -> tap an option -> my-vote state appears.
import { chromium } from "playwright"
import { BASE } from "./lib.mjs"
import fs from "node:fs"

const SHOTS = process.env.SHOTS_DIR || "/tmp/poll-verify"
fs.mkdirSync(SHOTS, { recursive: true })

const LORDS_TEAM = "30678448-33c0-483d-95dd-ecb6209058e7"

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const p = await ctx.newPage()

await p.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
await p.waitForTimeout(1500)
await p.locator('input[type="email"]').first().fill("parent@sportshub.demo")
await p.locator('input[type="password"]').first().fill("TestPass123!")
await p.locator('button[type="submit"]').first().click()
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(500)
  const session = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
  if (session?.user) break
  if (i === 29) throw new Error("login never became live")
}
console.log("session live")

await p.goto(`${BASE}/teams/${LORDS_TEAM}/chat`, { waitUntil: "networkidle" })
await p.waitForTimeout(3500)

const bubbles = p.locator("button").filter({ hasText: /\d+ · \d+%/ })
const count = await bubbles.count()
console.log(`poll option buttons visible: ${count}`)
if (count === 0) throw new Error("no poll options found in chat")

await p.screenshot({ path: `${SHOTS}/poll-before.png`, fullPage: false })

// switch my vote to the LAST option — proves the tap path posts + re-folds
await bubbles.last().click()
await p.waitForTimeout(2000)
const lastHasCheck = await bubbles.last().locator("span", { hasText: "✓" }).count()
const checks = lastHasCheck
console.log(`my-vote check on tapped option: ${checks}`)
await p.screenshot({ path: `${SHOTS}/poll-after-vote.png`, fullPage: false })

await browser.close()
console.log(checks > 0 ? "PASS: poll redesign renders + voting works" : "FAIL: no my-vote state")
process.exit(checks > 0 ? 0 : 1)
