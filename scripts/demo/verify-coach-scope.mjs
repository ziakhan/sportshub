// Runtime verification of the coach-scoping security fix (owner report
// 2026-07-20: a one-team coach saw + could act on the whole club).
// Drives Lisa Reid (Burlington Force Grade 10 coach) and asserts containment.
import { chromium } from "playwright"
import { BASE } from "./lib.mjs"
import fs from "node:fs"

const SHOTS = process.env.SHOTS_DIR || "/tmp/coach-scope-verify"
fs.mkdirSync(SHOTS, { recursive: true })

const CLUB = "9664fbd0-46da-4e00-b3c3-977339db2a3b" // Burlington Force
const MY_TEAM = "12faf7fd-0cc1-4103-9374-89c3b12c9bb3" // Grade 10 (Lisa's team)

async function login(browser, email, password = "TestPass123!") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(700)
  await p.locator('input[type="email"], input[name="email"]').first().fill(email)
  await p.locator('input[type="password"], input[name="password"]').first().fill(password)
  await p.locator('button[type="submit"]').first().click()
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(500)
    const s = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (s?.user) break
    if (i === 29) throw new Error(`login never became live for ${email}`)
  }
  const file = `${SHOTS}/session.json`
  await ctx.storageState({ path: file })
  await ctx.close()
  return file
}

const results = []
const ok = (label, pass, detail = "") => {
  results.push(`${pass ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`)
  console.log(results[results.length - 1])
}

// Follows redirects manually so we can see the FINAL landing path.
async function landing(p, path) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(600)
  return new URL(p.url()).pathname
}

const run = async () => {
  const browser = await chromium.launch()
  const session = await login(browser, "coach-force-gr10@sportshub.demo")
  const ctx = await browser.newContext({ storageState: session, viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()

  // 1. Club overview must NOT stay on the club page — coach bounced to own team
  const overview = await landing(p, `/clubs/${CLUB}`)
  ok("club overview redirects coach away", !overview.endsWith(`/clubs/${CLUB}`), `landed ${overview}`)
  ok("coach lands on own team", overview.includes(`/teams/${MY_TEAM}`), `landed ${overview}`)

  // 2. All-teams list is off-limits
  const teamsList = await landing(p, `/clubs/${CLUB}/teams`)
  ok("all-teams list blocked", !teamsList.endsWith(`/clubs/${CLUB}/teams`), `landed ${teamsList}`)

  // 3. Club-wide tryouts / offers / payments off-limits
  for (const seg of ["tryouts", "offers", "payments", "staff", "settings"]) {
    const landed = await landing(p, `/clubs/${CLUB}/${seg}`)
    ok(`club ${seg} blocked`, !landed.endsWith(`/${seg}`), `landed ${landed}`)
  }

  // 4. Own team page IS reachable
  const mine = await landing(p, `/clubs/${CLUB}/teams/${MY_TEAM}/dashboard`)
  ok("own team dashboard reachable", mine.includes(`/teams/${MY_TEAM}`), `landed ${mine}`)

  // 5. Another team (find one that isn't Lisa's) → 404/blocked
  const others = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
  void others
  await p.goto(`${BASE}/clubs/${CLUB}/teams`, { waitUntil: "domcontentloaded" })
  // We can't easily enumerate other team ids from the UI (it's blocked), so
  // probe a known sibling id via direct nav — grabbed from the DB out-of-band.
  const OTHER_TEAM = process.env.OTHER_TEAM
  if (OTHER_TEAM) {
    await p.goto(`${BASE}/clubs/${CLUB}/teams/${OTHER_TEAM}/dashboard`, { waitUntil: "domcontentloaded" })
    await p.waitForTimeout(500)
    const body = await p.textContent("body").catch(() => "")
    const blocked = /not found|404|page could not be found/i.test(body || "") ||
      !new URL(p.url()).pathname.includes(OTHER_TEAM)
    ok("another team's page blocked", blocked, `at ${new URL(p.url()).pathname}`)
  }

  await p.screenshot({ path: `${SHOTS}/coach-landing.png`, fullPage: true }).catch(() => {})
  await browser.close()

  console.log("\n" + results.join("\n"))
  const failed = results.filter((r) => r.startsWith("FAIL"))
  console.log(`\n${failed.length === 0 ? "ALL PASS" : `${failed.length} FAILED`}`)
  process.exit(failed.length === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
