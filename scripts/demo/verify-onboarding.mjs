// Runtime verification for the onboarding rebuild (2026-08-13).
// Creates throwaway accounts, drives /onboarding?role=Player, and captures
// the decorated hero + compact player form at desktop and phone, plus the
// guardian block in NO MATCH and MATCH.
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const SHOTS = process.env.SHOTS_DIR || "/tmp/onboarding-verify"
fs.mkdirSync(SHOTS, { recursive: true })

const STAMP = Date.now()
const PASSWORD = "TestPass123!"

// A parent-created, unclaimed player in the local seed. Signing up under this
// name + birth year makes /api/family/claim-check answer { match: true }.
const MATCH_KID = { firstName: "Cameron", lastName: "Nguyen", y: 2010, m: 11, d: 21 }
// Nobody in the seed. Answers { match: false }.
const NO_MATCH_KID = { firstName: "Zeta", lastName: "Quixote", y: 2010, m: 4, d: 12 }

const accounts = []

async function signUp(page, { firstName, lastName }) {
  const email = `onbverify-${firstName.toLowerCase()}-${STAMP}@example.com`
  const res = await page.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password: PASSWORD, firstName, lastName },
  })
  if (!res.ok()) throw new Error(`signup failed ${res.status()} ${await res.text()}`)
  accounts.push(email)
  return email
}

async function signIn(page, email) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500) // pre-hydration clicks do a native submit
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

async function pickDob(page, { y, m, d }) {
  await page.locator("#dateOfBirth").click()
  await page.waitForTimeout(250)
  await page.locator('select[aria-label="Year"]').selectOption(String(y))
  await page.locator('select[aria-label="Month"]').selectOption(String(m))
  await page.waitForTimeout(150)
  await page.locator(`.grid.grid-cols-7 button:text-is("${d}")`).first().click()
  await page.waitForTimeout(200)
}

async function pageOverflow(page) {
  return page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
}

const results = []

const browser = await chromium.launch()

// ───────────────────────────────────────────── account A: NO MATCH
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const email = await signUp(page, NO_MATCH_KID)
  await signIn(page, email)

  await page.goto(`${BASE}/onboarding?role=Player`, { waitUntil: "networkidle" })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${SHOTS}/a-desktop-1440x900.png` })
  results.push(["desktop 1440x900", JSON.stringify(await pageOverflow(page))])
  results.push([
    "role chip present",
    await page.locator('text="Not a player? Change"').count(),
  ])
  results.push(["handle chip present", await page.locator('text="yours"').count()])

  // Guardian NO MATCH: pick a birth date, let claim-check answer.
  await pickDob(page, NO_MATCH_KID)
  await page.waitForTimeout(1800)
  results.push([
    "guardian no-match copy",
    await page.locator("text=They approve payments and permissions").count(),
  ])
  await page.screenshot({ path: `${SHOTS}/c-guardian-no-match.png` })
  results.push(["after-dob overflow", JSON.stringify(await pageOverflow(page))])

  // phone
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/onboarding?role=Player`, { waitUntil: "networkidle" })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${SHOTS}/b-phone-390x844.png`, fullPage: true })
  results.push(["phone overflow", JSON.stringify(await pageOverflow(page))])

  // Demo skip: the server choke point.
  const r = await page.request.get(
    `${BASE}/onboarding?callbackUrl=%2Fdemo%2Fstart%3Fpersona%3Dplayer`,
    { maxRedirects: 0 }
  )
  results.push(["demo skip status", r.status()])
  results.push(["demo skip location", r.headers()["location"]])

  await ctx.close()
}

// ───────────────────────────────────────────── account B: MATCH
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const email = await signUp(page, MATCH_KID)
  await signIn(page, email)

  await page.goto(`${BASE}/onboarding?role=Player`, { waitUntil: "networkidle" })
  await page.waitForTimeout(900)
  await pickDob(page, MATCH_KID)
  await page.waitForTimeout(2000)
  const matched = await page.locator("text=Looks like a parent already added you").count()
  results.push(["guardian match copy", matched])
  await page.screenshot({ path: `${SHOTS}/d-guardian-match.png` })
  if (matched) {
    await page.locator('button:text-is("Ask to link")').click()
    await page.waitForTimeout(300)
    results.push([
      "ask-to-link confirmed",
      await page.locator("text=We will ask your parent to link you").count(),
    ])
    await page.screenshot({ path: `${SHOTS}/d2-guardian-match-asked.png` })
  }
  await ctx.close()
}

// ───────────────────────────────────────────── role step (no ?role=)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const email = await signUp(page, { firstName: "Rowan", lastName: "Pike" })
  await signIn(page, email)
  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${SHOTS}/e-role-step.png` })
  results.push(["role step overflow", JSON.stringify(await pageOverflow(page))])
  await ctx.close()
}

await browser.close()

console.log("\n== results ==")
for (const [k, v] of results) console.log(`  ${k}: ${v}`)
console.log("\n== throwaway accounts ==")
for (const a of accounts) console.log(`  ${a}`)
console.log(`\nshots in ${SHOTS}`)
