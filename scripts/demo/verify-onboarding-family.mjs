// Family-code surfaces + guardian MATCH path (2026-08-13).
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const SHOTS = process.env.SHOTS_DIR || "/tmp/onboarding-verify-family"
fs.mkdirSync(SHOTS, { recursive: true })
const STAMP = Date.now()
const PASSWORD = "TestPass123!"
const KID_EMAIL = process.env.KID_EMAIL // an already-onboarded 13-17 self-owned player
const accounts = []
const out = []

async function signUp(page, firstName, lastName) {
  const email = `onbfam-${firstName.toLowerCase()}-${STAMP}@example.com`
  const res = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: PASSWORD, firstName, lastName },
  })
  if (!res.ok()) throw new Error(`signup failed ${res.status()} ${await res.text()}`)
  accounts.push(email)
  return email
}

async function signIn(page, email) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400)
    const s = await (await page.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (s?.user) return
  }
  throw new Error(`login never became live for ${email}`)
}

const browser = await chromium.launch()

// ── 1. Parent onboards, then sees the Family code card on /players
let parentCode = null
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const email = await signUp(page, "Nadia", "Brooks")
  await signIn(page, email)

  await page.goto(`${BASE}/onboarding?role=Parent`, { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  await page.locator("#phoneNumber").fill("905 555 0123")
  await page.locator("#city").fill("Burlington")
  await page.locator("#subdivision-select").click()
  await page.waitForTimeout(200)
  await page.locator('li[role="option"]:has-text("Ontario")').first().click()
  await page.screenshot({ path: `${SHOTS}/parent-step.png` })
  await page.locator('button[type="submit"]:has-text("Finish")').click()
  await page.waitForTimeout(6000)
  out.push(["parent finished at", page.url()])

  await page.goto(`${BASE}/players`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1200)
  const make = page.locator('button:has-text("Make a code")')
  if (await make.count()) {
    await make.first().click()
    await page.waitForTimeout(1500)
  }
  await page.screenshot({ path: `${SHOTS}/players-family-code.png`, fullPage: true })
  const got = await (await page.request.get(`${BASE}/api/family/link-code`)).json()
  parentCode = got?.code || null
  out.push(["parent link code", parentCode])
  await ctx.close()
}

// ── 2. The kid redeems it from the dashboard nudge dialog
if (KID_EMAIL && parentCode) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await signIn(page, KID_EMAIL)
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)
  const nudge = page.locator('button:has-text("Add my parent"), button:has-text("Send to a different email")')
  out.push(["nudge banner present", await nudge.count()])
  if (await nudge.count()) {
    await nudge.first().click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Enter a code instead")').click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/nudge-code-dialog.png` })
    await page.locator("#family-link-code").fill(parentCode)
    await page.locator('button:has-text("Link my parent")').click()
    await page.waitForTimeout(2500)
    out.push([
      "linked confirmation",
      await page.locator("text=Linked. Your parent can see your account now.").count(),
    ])
    await page.screenshot({ path: `${SHOTS}/nudge-linked.png` })
  }
  await ctx.close()
} else {
  out.push(["kid redeem", `skipped (KID_EMAIL=${KID_EMAIL} code=${parentCode})`])
}

await browser.close()
console.log("\n== results ==")
for (const [k, v] of out) console.log(`  ${k}: ${v}`)
console.log("\n== throwaway accounts ==")
for (const a of accounts) console.log(`  ${a}`)
console.log(`\nshots in ${SHOTS}`)
