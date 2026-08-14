// Happy path + demo-exit round trip for the onboarding rebuild (2026-08-13).
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const SHOTS = process.env.SHOTS_DIR || "/tmp/onboarding-verify-happy"
fs.mkdirSync(SHOTS, { recursive: true })
const STAMP = Date.now()
const PASSWORD = "TestPass123!"
const accounts = []
const out = []

async function signUp(page, firstName, lastName) {
  const email = `onbhappy-${firstName.toLowerCase()}-${STAMP}@example.com`
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

// ── 1. Player happy path, guardian email included
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const email = await signUp(page, "Harper", "Lindqvist")
  await signIn(page, email)

  await page.goto(`${BASE}/onboarding?role=Player`, { waitUntil: "networkidle" })
  await page.waitForTimeout(800)

  await page.locator("#dateOfBirth").click()
  await page.waitForTimeout(200)
  await page.locator('select[aria-label="Year"]').selectOption("2009")
  await page.locator('select[aria-label="Month"]').selectOption("5")
  await page.waitForTimeout(150)
  await page.locator('.grid.grid-cols-7 button:text-is("14")').first().click()

  await page.locator('button[role="radio"]:text-is("Female")').click()
  await page.locator("#city").fill("Hamilton")
  await page.locator("#subdivision-select").click()
  await page.waitForTimeout(200)
  await page.locator('li[role="option"]:has-text("Ontario")').first().click()
  await page.locator('button[role="radio"]:text-is("Point guard")').click()
  await page.locator("#guardian-email").fill(`onbhappy-parent-${STAMP}@example.com`)
  await page.screenshot({ path: `${SHOTS}/f-filled.png` })

  await page.locator('button[type="submit"]:has-text("Finish")').click()
  await page.waitForTimeout(6000)
  out.push(["after finish url", page.url()])
  await page.screenshot({ path: `${SHOTS}/g-after-finish.png` })

  const me = await (await page.request.get(`${BASE}/api/players`)).json().catch(() => ({}))
  out.push(["player row created", JSON.stringify(me?.players?.map((p) => p.firstName))])
  const inv = await (
    await page.request.get(`${BASE}/api/family-invitations`)
  ).json().catch(() => ({}))
  out.push([
    "guardian invite created",
    JSON.stringify((inv?.invitations || []).map((i) => `${i.type}->${i.invitedEmail}`)),
  ])
  await ctx.close()
}

// ── 2. Demo exit hands an un-onboarded account to ?role=
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const email = await signUp(page, "Ines", "Vasquez")
  await signIn(page, email)

  await page.goto(`${BASE}/demo/start?persona=player`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(6000)
  out.push(["landed in demo at", page.url()])
  const exit = page.locator('button:has-text("Exit demo")')
  if (await exit.count()) {
    await page.screenshot({ path: `${SHOTS}/h-in-demo.png` })
    await exit.first().click()
    await page.waitForTimeout(5000)
    out.push(["exit landed at", page.url()])
    await page.screenshot({ path: `${SHOTS}/i-after-exit.png` })
  } else {
    out.push(["exit control", "not found (demo mode off?)"])
  }
  await ctx.close()
}

await browser.close()
console.log("\n== results ==")
for (const [k, v] of out) console.log(`  ${k}: ${v}`)
console.log("\n== throwaway accounts ==")
for (const a of accounts) console.log(`  ${a}`)
console.log(`\nshots in ${SHOTS}`)
