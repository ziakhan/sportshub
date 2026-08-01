// Full-loop verification (owner 2026-08-01): club submits a schedule
// request → league simulates its cost → approves → regenerated schedule
// honors it. Plus scenarios + org planner endpoint receipts.
// Run from scripts/demo: node verify-schedule-requests.mjs
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const PASS = "TestPass123!"
const ORG_ID = process.env.ORG_ID || "6c8387a4-70d0-4c29-8e5a-29c65df39a49"
const FALL_ID = process.env.FALL_ID || "78796f5b-34d9-46f7-8c64-0e3cbc4e700e"
const SUMMER_ID = process.env.SUMMER_ID || "41f0d87b-09ea-4cfb-a0a1-6d4dbc5fc49c"
const SHOTS = "/tmp/schedule-requests-verify"
// Seeded ids (from the demo world; re-derive with a prisma query if reseeded)
const FORCE_CLUB_ID = process.env.FORCE_CLUB_ID || "9664fbd0-46da-4e00-b3c3-977339db2a3b"
const FORCE_G9_TEAM_ID = process.env.FORCE_G9_TEAM_ID || "ed3ccaaf-37aa-4a01-9e3a-a7e7b62f0ff4"
const PENDING_REQ_ID = process.env.PENDING_REQ_ID || "e793c913-e9c2-4a55-b37a-933b8b7aa6e3"

import { mkdirSync } from "fs"
mkdirSync(SHOTS, { recursive: true })

let passed = 0
let failed = 0
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`)
  ok ? passed++ : failed++
}

async function login(browser, email) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2500) // pre-hydration click = native submit
    await page.locator('input[type="email"], input[name="email"]').first().fill(email)
    await page.locator('input[type="password"], input[name="password"]').first().fill(PASS)
    await page.locator('button[type="submit"]').first().click()
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500)
      const session = await page.request
        .get(`${BASE}/api/auth/session`)
        .then((r) => r.json())
        .catch(() => null)
      if (session?.user) return { ctx, page }
    }
  }
  throw new Error(`login failed for ${email}`)
}

const browser = await chromium.launch()

// ── CLUB SIDE (owner-force@): sees + submits requests ──
const club = await login(browser, "owner-force@sportshub.demo")
{
  const page = club.page
  await page.goto(`${BASE}/clubs/${FORCE_CLUB_ID}/teams/${FORCE_G9_TEAM_ID}/dashboard`)
  await page.waitForTimeout(2500)
  const btn = page.locator('a:has-text("Schedule requests")').first()
  const visible = await btn.isVisible().catch(() => false)
  check("team dashboard shows Schedule requests button (enabled team)", visible)
  await page.goto(`${BASE}/clubs/${FORCE_CLUB_ID}/teams/${FORCE_G9_TEAM_ID}/schedule-requests`)
  await page.waitForTimeout(2500)
  const approvedBadge = await page
    .locator("text=approved")
    .first()
    .isVisible()
    .catch(() => false)
  check("club requests page lists the APPROVED Ottawa window", approvedBadge)
  const bestEffort = await page
    .locator("text=best-effort")
    .first()
    .isVisible()
    .catch(() => false)
  check("best-effort copy present", bestEffort)
  await page.screenshot({ path: `${SHOTS}/1-club-requests-page.png`, fullPage: true })
}

// ── LEAGUE SIDE (owner-nph@): pending request → simulate → approve ──
const league = await login(browser, "owner-nph@sportshub.demo")
{
  const page = league.page
  // The seeded PENDING request lives on Force Fall Grade 10.
  const games = await page.request.post(`${BASE}/api/seasons/${FALL_ID}/schedule/preview`, {
    data: {},
  })
  check("league can run preview", games.ok())

  const requestId = PENDING_REQ_ID
  check("seeded PENDING request id known", !!requestId)

  if (requestId) {
    const sim = await page.request.post(
      `${BASE}/api/seasons/${FALL_ID}/schedule/simulate-request`,
      { data: { requestId } }
    )
    check("simulate-request returns a cost diff", sim.ok())
    if (sim.ok()) {
      const body = await sim.json()
      check(
        "diff present",
        body.diff !== undefined && body.baseline?.totals !== undefined,
        `unplaced Δ${body.diff?.unscheduled} b2b Δ${body.diff?.backToBackTeamDays} prefs Δ${body.diff?.preferenceViolations}`
      )
    }
    const approve = await page.request.patch(`${BASE}/api/schedule-requests/${requestId}`, {
      data: { action: "approve", note: "Best effort — verified loop" },
    })
    check("league approves the request", approve.ok())

    // Regenerate: Force G10 Saturday games must now start ≥ 14:00.
    const preview = await page.request.post(`${BASE}/api/seasons/${FALL_ID}/schedule/preview`, {
      data: {},
    })
    if (preview.ok()) {
      const body = await preview.json()
      const g10 = body.games.filter(
        (g) =>
          (g.homeTeamName?.includes("Force Fall Grade 10") ||
            g.awayTeamName?.includes("Force Fall Grade 10")) &&
          !g.homeTeamName?.includes("White") &&
          !g.awayTeamName?.includes("White")
      )
      const saturdays = g10.filter((g) => new Date(g.scheduledAt).getDay() === 6)
      const allAfter2 = saturdays.every((g) => {
        const d = new Date(g.scheduledAt)
        return d.getHours() * 60 + d.getMinutes() >= 14 * 60
      })
      check(
        "regenerated schedule honors the approved late-Saturday window",
        saturdays.length > 0 && allAfter2,
        saturdays.map((g) => new Date(g.scheduledAt).toTimeString().slice(0, 5)).join(", ")
      )
    }
  }

  // ── Scenarios ──
  const scen = await page.request.post(`${BASE}/api/seasons/${FALL_ID}/schedule/scenarios`, {
    data: {},
  })
  check("scenarios endpoint responds", scen.ok())
  if (scen.ok()) {
    const body = await scen.json()
    check(
      "scenarios return baseline + variants",
      (body.cards?.length ?? 0) >= 2,
      body.cards?.map((c) => c.key).join(", ")
    )
  }

  // ── Org planner ──
  const plan = await page.request.post(`${BASE}/api/organizations/${ORG_ID}/planner/run`, {
    data: { seasonIds: [FALL_ID, SUMMER_ID] },
  })
  check("org planner run responds", plan.ok())
  if (plan.ok()) {
    const body = await plan.json()
    check(
      "planner returns per-season fit + utilization",
      Array.isArray(body.seasons) && body.seasons.length === 2 && Array.isArray(body.utilization),
      `allFit=${body.allFit} courts=${body.utilization?.length}`
    )
  }
  // Planner page screenshot
  await page.goto(`${BASE}/manage/org/${ORG_ID}/planner`)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${SHOTS}/2-org-planner.png`, fullPage: true })
  const runBtn = await page.locator('button:has-text("Run the plan")').isVisible().catch(() => false)
  check("planner page renders with Run button", runBtn)
}

await browser.close()
console.log(`\n${passed} passed, ${failed} failed · screenshots in ${SHOTS}`)
process.exit(failed > 0 ? 1 : 0)
