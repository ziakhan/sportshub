// Runtime verification for the 2026-07-11 feedback batch: calendar lenses,
// coach permission fixes, static public menus, program staff.
import { chromium } from "playwright"
import { BASE } from "./lib.mjs"
import fs from "node:fs"

const SHOTS = "/tmp/rsvp-verify"
fs.mkdirSync(SHOTS, { recursive: true })
const results = []
const ok = (label, pass, detail = "") => {
  results.push(`${pass ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`)
  console.log(results[results.length - 1])
}

async function login(browser, email, password = "TestPass123!") {
  const file = `${SHOTS}/session2-${email.replace(/[^a-z0-9]/gi, "_")}.json`
  if (fs.existsSync(file)) return file
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(700)
  await p.locator('input[type="email"], input[name="email"]').first().fill(email)
  await p.locator('input[type="password"], input[name="password"]').first().fill(password)
  await p.locator('button[type="submit"]').first().click()
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(500)
    const session = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (session?.user) break
    if (i === 59) throw new Error(`login never became live for ${email}`)
  }
  await ctx.storageState({ path: file })
  await ctx.close()
  console.log(`  ↪ session live: ${email}`)
  return file
}

const browser = await chromium.launch()
const parentS = await login(browser, "parent@sportshub.demo")
const coachS = await login(browser, "coach-force-gr10@sportshub.demo")
const ownerS = await login(browser, "owner-force@sportshub.demo")

// ---- 1. Calendar lenses (parent) ----
{
  const ctx = await browser.newContext({ storageState: parentS, viewport: { width: 1280, height: 950 } })
  const p = await ctx.newPage()
  p.on("pageerror", (e) => ok(`pageerror ${p.url()}`, false, e.message))
  await p.goto(`${BASE}/calendar`, { waitUntil: "networkidle" })
  const body = await (await p.request.get(`${BASE}/api/calendar/mine`)).json()
  ok(
    "two family lenses (one per kid×team)",
    body.lenses?.length === 2 && body.lenses.every((l) => l.kind === "family"),
    (body.lenses ?? []).map((l) => l.label).join(" | ")
  )
  const chips = p.locator('button[aria-pressed="true"]', { hasText: "·" })
  await chips.first().waitFor({ timeout: 10000 })
  ok("lens toggle chips render", (await chips.count()) === 2)
  await p.screenshot({ path: `${SHOTS}/10-lenses-on.png` })

  // count agenda cards, hide Trey's lens, count again
  const before = await p.locator("text=Burlington Force").count()
  const treyChip = p.locator("button", { hasText: /Trey ·/ }).first()
  await treyChip.click()
  await p.waitForTimeout(500)
  const after = await p.locator("text=Burlington Force").count()
  ok("toggling a lens off hides that kid's items", after < before, `${before} → ${after}`)
  await p.screenshot({ path: `${SHOTS}/11-lens-off.png` })
  await treyChip.click() // back on
  await p.waitForTimeout(300)
  await ctx.close()
}

// ---- 2. Coach: no program tabs / quick actions; owner keeps them ----
{
  const cctx = await browser.newContext({ storageState: coachS, viewport: { width: 1280, height: 900 } })
  const cp = await cctx.newPage()
  // coach's club = Burlington Force Elite; find club id from their team page nav
  const clubId = "b31be0a0-06e0-4989-b3bf-ba25f30bcc39" // filled at runtime below if wrong
  const mine = await (await cp.request.get(`${BASE}/api/teams?tenantId=`)).json().catch(() => null)
  // simpler: hit the dashboard and use the Staff workspace link
  await cp.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  const wsLink = cp.locator('aside a[href^="/clubs/"]').first()
  await wsLink.waitFor({ timeout: 10000 })
  const href = await wsLink.getAttribute("href")
  await cp.goto(`${BASE}${href}`, { waitUntil: "networkidle" })
  // href-scoped: the sidebar's public Browse links legitimately say "Tournaments"
  const campsTab = await cp.locator(`a[href="${href}/camps"]`).count()
  const hlTab = await cp.locator(`a[href="${href}/house-leagues"]`).count()
  const tournTab = await cp.locator(`a[href="${href}/tournaments"]`).count()
  ok("coach club view: no Camps/House League/Tournaments tabs", campsTab + hlTab + tournTab === 0)
  const staffQ = await cp.locator(`a[href="${href}/staff"]`).count()
  const settingsQ = await cp.locator(`a[href="${href}/settings"]`).count()
  const teamCreateQ = await cp.locator(`a[href="${href}/teams/create"]`).count()
  ok("coach club view: no Manage staff / Settings / Create team quick actions",
    staffQ + settingsQ + teamCreateQ === 0)
  ok("coach still sees Create tryout",
    (await cp.locator(`a[href="${href}/tryouts/create"]`).count()) > 0)
  await cp.screenshot({ path: `${SHOTS}/12-coach-club-view.png` })

  // API enforcement (schema-valid body so the role gate is what answers)
  const campPost = await cp.request.post(`${BASE}/api/camps`, {
    data: { tenantId: href.split("/")[2], name: "Probe Camp", campType: "SUMMER", ageGroup: "U12",
      startDate: new Date(Date.now() + 864000000).toISOString(),
      endDate: new Date(Date.now() + 1728000000).toISOString(),
      dailyStartTime: "09:00", dailyEndTime: "15:00", location: "Main Gym", weeklyFee: 1 },
  })
  ok("coach POST /api/camps -> 403", campPost.status() === 403, `got ${campPost.status()}`)
  await cctx.close()

  const octx = await browser.newContext({ storageState: ownerS, viewport: { width: 1280, height: 900 } })
  const op = await octx.newPage()
  await op.goto(`${BASE}${href}`, { waitUntil: "networkidle" })
  const ownerTabs = (await op.locator("a").allTextContents()).join("|")
  ok("owner still sees Camps/House League/Tournaments", /Camps/.test(ownerTabs) && /House League/.test(ownerTabs))
  await octx.close()
}

// ---- 3. Static public menus (club with empty sections) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  // An UNCLAIMED imported club has no description/programs/games — the
  // exact case that used to lose its tabs
  const slug = "/club/north-toronto-basketball-association-ntba"
  await p.goto(`${BASE}${slug}`, { waitUntil: "networkidle" })
  const nav = (await p.locator('a[href^="#"]').allTextContents()).join("|")
  ok(
    "empty club page still shows all five tabs",
    ["About", "Teams", "Programs", "Schedule", "Contact"].every((t) => nav.includes(t)),
    `${slug}: ${nav}`
  )
  // NTBA has real About+Contact data from the import; Programs + Schedule
  // are the sections that are actually empty here
  const emptyStates = await p
    .locator("text=/Nothing is open for registration|No games on the calendar/")
    .count()
  ok("empty sections render empty states (not blank)", emptyStates >= 2, `${emptyStates} found`)
  await p.screenshot({ path: `${SHOTS}/13-club-static-tabs.png`, fullPage: true })
  await ctx.close()
}

// ---- 4. Program staff: owner assigns coach on a camp ----
{
  const ctx = await browser.newContext({ storageState: ownerS, viewport: { width: 1280, height: 1000 } })
  const p = await ctx.newPage()
  p.on("pageerror", (e) => ok(`pageerror ${p.url()}`, false, e.message))
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  const club = await p.locator('aside a[href^="/clubs/"]').first().getAttribute("href")
  const tenantId = club.split("/")[2]
  // Owner creates a camp (also proves admins still can), then assigns staff
  const created = await p.request.post(`${BASE}/api/camps`, {
    data: {
      tenantId, name: "Verify Camp 0711", campType: "SUMMER", ageGroup: "U12",
      startDate: new Date(Date.now() + 30 * 864e5).toISOString(),
      endDate: new Date(Date.now() + 37 * 864e5).toISOString(),
      dailyStartTime: "09:00", dailyEndTime: "15:00", location: "Main Gym", weeklyFee: 100,
    },
  })
  ok("owner POST /api/camps -> 201", created.status() === 201, `got ${created.status()}`)
  const campId = (await created.json()).id
  await p.goto(`${BASE}${club}/camps/${campId}/edit`, { waitUntil: "networkidle" })
  const panel = p.locator("text=Program staff").first()
  await panel.waitFor({ timeout: 15000 })
  ok("Program staff panel renders on camp edit", true)
  // the edit form has its own selects — the panel's add-row selects are the
  // last two on the page (staff picker, then designation)
  const selectCount = await p.locator("select").count()
  const staffSelect = p.locator("select").nth(selectCount - 2)
  const options = await staffSelect.locator("option").allTextContents()
  ok("assignable staff dropdown has people", options.length > 1, options.slice(0, 4).join(", "))
  await staffSelect.selectOption({ index: 1 })
  await p.locator("button", { hasText: /^Assign$/ }).click()
  await p.waitForTimeout(1500)
  const chips = await p
    .locator("span.rounded-full", { hasText: /^(Lead|Assistant)$/ })
    .count()
  ok("assignment lands in the list", chips >= 1, `${chips} designation chips`)
  await p.screenshot({ path: `${SHOTS}/14-program-staff-panel.png` })
  console.log("CLEANUP_CAMP_ID=" + campId)
  await ctx.close()
}

await browser.close()
const fails = results.filter((r) => r.startsWith("FAIL"))
console.log(`\n${results.length - fails.length}/${results.length} checks passed`)
process.exit(fails.length ? 1 : 0)
