// Runtime verification for My Calendar (docs/roadmap/my-calendar-plan.md).
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

const browser = await chromium.launch()
const parentSession = `${SHOTS}/session-parent_sportshub_demo.json`
const coachSession = `${SHOTS}/session-coach_force_gr10_sportshub_demo.json`

// ---- parent: sidebar entry + cross-team agenda + colored control ----
{
  const ctx = await browser.newContext({ storageState: parentSession, viewport: { width: 1280, height: 950 } })
  const p = await ctx.newPage()
  p.on("pageerror", (e) => ok(`pageerror ${p.url()}`, false, e.message))
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  const navLink = p.locator('a[href="/calendar"]', { hasText: "My Calendar" }).first()
  ok("sidebar has My Calendar", (await navLink.count()) > 0)
  await navLink.click()
  await p.waitForURL("**/calendar", { timeout: 10000 })
  await p.locator("text=Every game, practice and event").waitFor({ timeout: 15000 })

  const body = await (await p.request.get(`${BASE}/api/calendar/mine`)).json()
  ok("feed spans both kids' teams", body.teams.length === 2, body.teams.map((t) => t.teamName).join(" + "))
  const kinds = new Set(body.items.map((i) => i.kind))
  ok("feed carries games+practices+events", kinds.has("game") && kinds.has("practice") && kinds.has("event"), [...kinds].join(","))

  // colored control: click Going on the first upcoming card
  const going = p.locator("button", { hasText: /^✓ ?Going$|^Going$/ }).first()
  await going.waitFor({ timeout: 10000 })
  await going.click()
  await p.waitForTimeout(1200)
  const cls = (await going.getAttribute("class")) || ""
  ok("Going turns solid green when selected", /bg-court-600/.test(cls))
  await p.screenshot({ path: `${SHOTS}/6-mycal-parent-agenda.png` })

  // grid popover: switch to grid, click a chip, RSVP inside the popover
  await p.locator("button", { hasText: /^Grid$/ }).click()
  await p.waitForTimeout(400)
  const chip = p.locator("button", { hasText: /practice/i }).first()
  await chip.click()
  await p.locator('[role="dialog"]').waitFor({ timeout: 5000 })
  const dlgCant = p.locator('[role="dialog"] button', { hasText: "Can't go" }).first()
  const hasControls = (await dlgCant.count()) > 0
  ok("grid chip opens popover with RSVP controls", hasControls)
  if (hasControls) {
    await dlgCant.click()
    await p.waitForTimeout(1000)
    ok("popover Can't-go selects (red)", /bg-red-600/.test((await dlgCant.getAttribute("class")) || ""))
  }
  await p.screenshot({ path: `${SHOTS}/7-mycal-grid-popover.png` })
  await ctx.close()
}

// ---- coach: My Calendar shows roll-ups ----
{
  const ctx = await browser.newContext({ storageState: coachSession, viewport: { width: 1280, height: 950 } })
  const p = await ctx.newPage()
  p.on("pageerror", (e) => ok(`pageerror ${p.url()}`, false, e.message))
  await p.goto(`${BASE}/calendar`, { waitUntil: "networkidle" })
  // pure-staff account defaults to grid on desktop — check, then use agenda
  await p.locator("button", { hasText: /^Agenda$/ }).click()
  await p.waitForTimeout(600)
  const rollup = p.locator("button", { hasText: /no reply/ }).first()
  await rollup.waitFor({ timeout: 10000 })
  const summary = (await rollup.textContent()) || ""
  ok("coach sees roll-up on My Calendar", /going/.test(summary), summary.trim())
  await rollup.click()
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${SHOTS}/8-mycal-coach.png` })
  await ctx.close()
}

// ---- team calendar grid is now interactive too ----
{
  const ctx = await browser.newContext({ storageState: parentSession, viewport: { width: 1280, height: 950 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/teams/12faf7fd-0cc1-4103-9374-89c3b12c9bb3/calendar`, { waitUntil: "networkidle" })
  await p.locator("button", { hasText: /^Grid$/ }).click()
  await p.waitForTimeout(500)
  const chip = p.locator("button", { hasText: /practice/i }).first()
  await chip.waitFor({ timeout: 10000 })
  await chip.click()
  const dlg = p.locator('[role="dialog"]')
  await dlg.waitFor({ timeout: 5000 })
  ok("team-calendar grid chip opens RSVP popover", (await dlg.locator("button", { hasText: "Going" }).count()) > 0)
  await p.screenshot({ path: `${SHOTS}/9-teamcal-grid-popover.png` })
  await ctx.close()
}

await browser.close()
const fails = results.filter((r) => r.startsWith("FAIL"))
console.log(`\n${results.length - fails.length}/${results.length} checks passed`)
process.exit(fails.length ? 1 : 0)
