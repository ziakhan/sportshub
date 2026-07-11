// Runtime verification for the RSVP feature (not a demo clip).
// Drives: family buttons -> persistence -> staff roll-up -> staff bell ->
// scoring-console pre-mark, plus authz probes at the API surface.
import { chromium } from "playwright"
import { BASE } from "./lib.mjs"
import fs from "node:fs"

const SHOTS = process.env.SHOTS_DIR || "/tmp/rsvp-verify"
fs.mkdirSync(SHOTS, { recursive: true })

// lib.mjs's ensureSession can snapshot before the session cookie lands;
// here we poll /api/auth/session until the login is actually live.
async function login(browser, email, password = "TestPass123!") {
  const file = `${SHOTS}/session-${email.replace(/[^a-z0-9]/gi, "_")}.json`
  if (fs.existsSync(file)) return file
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(700)
  await p.locator('input[type="email"], input[name="email"]').first().fill(email)
  await p.locator('input[type="password"], input[name="password"]').first().fill(password)
  await p.locator('button[type="submit"]').first().click()
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(500)
    const session = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (session?.user) break
    if (i === 29) throw new Error(`login never became live for ${email}`)
  }
  await ctx.storageState({ path: file })
  await ctx.close()
  console.log(`  ↪ session live: ${email}`)
  return file
}

const FORCE_TEAM = "12faf7fd-0cc1-4103-9374-89c3b12c9bb3" // Burlington Force Grade 10 (Trey)
const LORDS_TEAM = "30678448-33c0-483d-95dd-ecb6209058e7" // Toronto Lords Grade 9 (Miles)
const GAME_ID = "ac8100ee-2597-478a-a0b9-00bb6492ffe1" // Force away game TODAY
const TREY = "77c8b3f6-d9ca-4959-a091-ae777e430aa0"
const MILES = "0cc33b47-6ee7-4759-91c8-6bb2f505454a"

const results = []
const ok = (label, pass, detail = "") => {
  results.push(`${pass ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`)
  console.log(results[results.length - 1])
}

async function page(browser, sessionFile) {
  const ctx = await browser.newContext({
    storageState: sessionFile,
    viewport: { width: 860, height: 1000 }, // <1024 => agenda view by default
  })
  const p = await ctx.newPage()
  p.on("pageerror", (e) => ok(`pageerror on ${p.url()}`, false, e.message))
  return p
}

const browser = await chromium.launch()
const parentSession = await login(browser, "parent@sportshub.demo")
const coachSession = await login(browser, "coach-force-gr10@sportshub.demo")

// ---- A. family: "Can't go" on today's game (Force calendar) ----
{
  const p = await page(browser, parentSession)
  await p.goto(`${BASE}/teams/${FORCE_TEAM}/calendar`, { waitUntil: "networkidle" })
  const cantGo = p.locator("button", { hasText: "Can't go" }).first()
  await cantGo.waitFor({ timeout: 15000 })
  const before = await cantGo.getAttribute("class")
  await cantGo.click()
  await p.waitForTimeout(1200)
  const afterClass = await cantGo.getAttribute("class")
  ok("family sees RSVP buttons on game card", true)
  ok("Can't-go becomes selected after click", before !== afterClass && /hoop/.test(afterClass))
  await p.screenshot({ path: `${SHOTS}/1-family-game-cantgo.png`, fullPage: false })

  await p.reload({ waitUntil: "networkidle" })
  const persisted = await p
    .locator("button", { hasText: "Can't go" })
    .first()
    .getAttribute("class")
  ok("Not-going persists across reload", /hoop/.test(persisted))
  await p.close()
}

// ---- B. family: "Going" on Lords practice ----
{
  const p = await page(browser, parentSession)
  await p.goto(`${BASE}/teams/${LORDS_TEAM}/calendar`, { waitUntil: "networkidle" })
  const going = p.locator("button", { hasText: /^Going$/ }).first()
  await going.waitFor({ timeout: 15000 })
  await going.click()
  await p.waitForTimeout(1200)
  ok("Going selectable on practice card", /court/.test(await going.getAttribute("class")))
  await p.screenshot({ path: `${SHOTS}/2-family-practice-going.png` })
  await p.close()
}

// ---- C. staff: roll-up + expandable names ----
{
  const p = await page(browser, coachSession)
  await p.goto(`${BASE}/teams/${FORCE_TEAM}/calendar`, { waitUntil: "networkidle" })
  const rollup = p.locator("button", { hasText: /going ·/ }).first()
  await rollup.waitFor({ timeout: 15000 })
  const summary = await rollup.textContent()
  ok("staff sees roll-up line", /1 out/.test(summary), summary.trim())
  await rollup.click()
  await p.waitForTimeout(300)
  const names = await p.locator("text=Out:").first().textContent().catch(() => "")
  ok("expanded roll-up names Trey", /Trey/.test(names), names.trim())
  await p.screenshot({ path: `${SHOTS}/3-staff-rollup.png` })
  await p.close()
}

// ---- D. staff bell: rsvp_change notification via the bell API ----
{
  const p = await page(browser, coachSession)
  await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" })
  const res = await p.request.get(`${BASE}/api/notifications`)
  const body = await res.json().catch(() => ({}))
  const list = body.notifications ?? body ?? []
  const hit = JSON.stringify(list).includes("rsvp_change")
  ok("coach got rsvp_change bell (late Not-going, game <48h)", hit)
  await p.close()
}

// ---- E. scoring console: Trey pre-marked absent ----
{
  const p = await page(browser, coachSession)
  await p.goto(`${BASE}/games/${GAME_ID}/score`, { waitUntil: "networkidle" })
  await p.locator("text=Attendance —").waitFor({ timeout: 20000 })
  const treyBtn = p.locator("button", { hasText: "Trey" }).first()
  await treyBtn.waitFor({ timeout: 10000 })
  const cls = await treyBtn.getAttribute("class")
  const label = await treyBtn.textContent()
  ok("Trey pre-marked absent in roll call", /hoop/.test(cls) && /absent/i.test(label))
  const note = await p.locator("text=pre-marked").count()
  ok("pre-marked explainer copy shown", note > 0)
  await p.screenshot({ path: `${SHOTS}/4-console-premark.png` })
  await p.close()
}

// ---- F. probes at the API surface ----
{
  // anonymous
  const anon = await (await browser.newContext()).request.put(`${BASE}/api/rsvp`, {
    data: { playerId: TREY, itemType: "GAME", itemId: GAME_ID, status: "GOING" },
  })
  ok("probe: anonymous PUT -> 401", anon.status() === 401)

  const ctx = await browser.newContext({ storageState: coachSession })
  // staff isn't the parent
  const staffPut = await ctx.request.put(`${BASE}/api/rsvp`, {
    data: { playerId: TREY, itemType: "GAME", itemId: GAME_ID, status: "GOING" },
  })
  ok("probe: staff PUT for someone's kid -> 403", staffPut.status() === 403)

  const pctx = await browser.newContext({ storageState: parentSession })
  // malformed
  const junk = await pctx.request.put(`${BASE}/api/rsvp`, {
    data: { playerId: MILES, itemType: "BANQUET", itemId: "x", status: "YES" },
  })
  ok("probe: malformed body -> 400", junk.status() === 400)
  // unknown item
  const missing = await pctx.request.put(`${BASE}/api/rsvp`, {
    data: { playerId: MILES, itemType: "PRACTICE", itemId: "no-such", status: "GOING" },
  })
  ok("probe: unknown item -> 404", missing.status() === 404)
  // kid not on that team (Miles is Lords, game is Force's)
  const wrongTeam = await pctx.request.put(`${BASE}/api/rsvp`, {
    data: { playerId: MILES, itemType: "GAME", itemId: GAME_ID, status: "GOING" },
  })
  ok("probe: own kid but wrong team -> 403", wrongTeam.status() === 403)
}

await browser.close()
const fails = results.filter((r) => r.startsWith("FAIL"))
console.log(`\n${results.length - fails.length}/${results.length} checks passed`)
process.exit(fails.length ? 1 : 0)
