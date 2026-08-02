/**
 * Plan wizard step 5 drive (wave 5, 2026-08-02). Two runs, no world damage:
 *
 *   node verify-plan-step5.mjs locked
 *     The NPH journey season (FINALIZED, every grade registered, the official
 *     calendar saved): the watch screen draws one bar per grade off the REAL
 *     registered counts, the header pill agrees with the weekend math computed
 *     independently here, the read-only banner shows, and both buttons point
 *     at the season's scheduling screens. Nothing is written.
 *
 *   node verify-plan-step5.mjs drive
 *     A scratch DRAFT season built through the API as the platform admin: a
 *     gym, four weekends across two months, three grades with expected teams
 *     and nobody approved — so every bar reads "0 of N expected". Then the
 *     calendar is kept and one grade's plan is blown past its gyms, which is
 *     the moment the mock is about: the pill goes amber, the alert panel says
 *     what broke in the planner's own words, and "See options" holds the rest.
 *     Polling is verified for real by watching the browser refetch. The
 *     scratch world is torn down afterwards.
 *
 * Screenshots to /tmp/plan-step5-*.png.
 */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const MODE = process.argv[2] ?? "locked"

// The NPH journey world (locked run).
const NPH = {
  leagueId: "f58ff1a4-80b7-4548-b385-2d335d0f3612",
  seasonId: "1464549a-ad8d-412b-a0c1-b1730e57ae2c",
  email: "owner-nph@sportshub.demo",
}

// A DRAFT season with nothing in it (drive run) — the same scratch season the
// step 3 and step 4 drives use, built and emptied by this script.
const SCRATCH = {
  leagueId: "415d4332-84ae-41e3-927a-5a4832df43f6",
  seasonId: "8d427814-2c4d-4692-b29b-0173224e7aa5",
  email: "admin@sportshub.demo",
  venueId: "9e6b53fa-dc5e-43d0-ab0d-ad4be78529ed",
  courtCount: 2,
  grades: [
    { ageGroup: "Grade 7", teams: 8 },
    { ageGroup: "Grade 8", teams: 6 },
    { ageGroup: "Junior Girls", teams: 4 },
  ],
  // Far more teams than these gyms can hold: the "actuals just broke a
  // weekend" state, in October, while a court can still be booked. Two grades
  // so every weekend breaks and the alert has more to say than it shows.
  blowUp: [
    { ageGroup: "Grade 7", teams: 60 },
    { ageGroup: "Grade 8", teams: 30 },
  ],
  weekends: [
    ["2027-09-11", "2027-09-12"],
    ["2027-09-25", "2027-09-26"],
    ["2027-10-09", "2027-10-10"],
    ["2027-10-23", "2027-10-24"],
  ],
}

const target = MODE === "locked" ? NPH : SCRATCH

const fail = (msg) => {
  console.error("FAIL:", msg)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })

// Every refetch the BROWSER makes of the planner state. page.request.* calls
// are out of band and never land here, so this counts polls and nothing else.
let polls = 0
page.on("request", (r) => {
  if (r.method() === "GET" && r.url() === `${BASE}/api/seasons/${target.seasonId}/planner`) polls++
})

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', target.email)
await page.fill('input[type="password"]', "TestPass123!")
await page.click('button[type="submit"]')
for (let i = 0; i < 30; i++) {
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json())
  if (session?.user) break
  await page.waitForTimeout(1000)
  if (i === 29) fail("never logged in")
}
console.log(`logged in as ${target.email}`)

const plannerUrl = `${BASE}/api/seasons/${target.seasonId}/planner`
const scheduleHref = `/manage/leagues/${target.leagueId}/seasons/${target.seasonId}/manage?tab=schedule`

const plannerState = async () => {
  const res = await page.request.get(plannerUrl)
  if (!res.ok()) fail(`GET planner ${res.status()}`)
  return res.json()
}

const openStep5 = async () => {
  await page.goto(`${BASE}/manage/leagues/${target.leagueId}/seasons/${target.seasonId}/plan?step=5`)
  await page.waitForSelector("text=Registration vs plan", { timeout: 20000 })
  await page.waitForTimeout(800)
}

/** The bars as the browser drew them: the numbers behind each one and the
 *  sentence on the right. */
const readBars = async () =>
  page.$$eval('[data-testid="registration-bar"]', (els) =>
    els.map((el) => ({
      grade: el.dataset.grade,
      approved: Number(el.dataset.approved),
      expected: Number(el.dataset.expected),
      over: el.dataset.over === "1",
      abbrev: el.children[0].textContent.trim(),
      width: el.children[1].firstElementChild.style.width,
      label: el.children[2].textContent.replace(/\s+/g, " ").trim(),
    }))
  )

const pillText = async () =>
  (await page.locator('[data-testid="attention-pill"]').textContent())?.trim()

const alertText = async () => {
  const alert = page.locator('[data-testid="attention-alert"]')
  if ((await alert.count()) === 0) return null
  return (await alert.textContent()).replace(/\s+/g, " ").trim()
}

/**
 * The same weekend verdict, computed here from the raw API state rather than
 * from the app's own helper: if the screen and this disagree, one of them is
 * lying. (Mirrors weekendLoad's over/tight rule at TIGHT_RATIO = 0.85.)
 */
const attentionFromApi = (state) => {
  const rows = []
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const demand = (w.assigned ?? []).reduce((sum, key) => {
        const u = state.units.find((x) => x.key === key)
        return sum + (u ? Math.ceil((u.teams * w.targetGamesPerTeam) / 2) : 0)
      }, 0)
      const cap = w.capacityGames
      const tone =
        demand > cap
          ? "over"
          : cap <= 0
            ? "unavailable"
            : demand === 0
              ? "empty"
              : demand / cap >= 0.85
                ? "tight"
                : "roomy"
      if (tone === "over" || tone === "tight") rows.push({ label: w.label, demand, cap, tone })
    }
  }
  return rows
}

const expectedPill = (attention) =>
  attention.length === 0
    ? "On plan"
    : `${attention.length} weekend${attention.length === 1 ? "" : "s"} need${
        attention.length === 1 ? "s" : ""
      } attention`

/** Both buttons are doorways to the same existing scheduling screens. */
const checkButtons = async () => {
  for (const name of ["Generate schedule", "Schedule now with current teams"]) {
    const link = page.getByRole("link", { name, exact: true })
    if ((await link.count()) !== 1) fail(`"${name}" is not on the screen`)
    const href = await link.getAttribute("href")
    if (href !== scheduleHref) fail(`"${name}" points at ${href}, not ${scheduleHref}`)
  }
  console.log(`both buttons open ${scheduleHref}`)
}

// ——————————————————————————————— locked ———————————————————————————————
if (MODE === "locked") {
  const before = await plannerState()
  if (before.seasonStatus !== "FINALIZED") fail("locked mode expects a FINALIZED season")

  const registered = before.state.units.filter((u) => u.approved > 0 || u.expected > 0)
  if (registered.length === 0) fail("the journey season should have registered grades")
  const totalApproved = registered.reduce((sum, u) => sum + u.approved, 0)
  console.log(
    `API: ${registered.length} grades, ${totalApproved} approved teams ` +
      `(${registered.map((u) => `${u.label} ${u.approved}/${u.expected}`).join(", ")})`
  )

  await openStep5()
  const bars = await readBars()
  if (bars.length !== registered.length)
    fail(`expected ${registered.length} bars, got ${bars.length}`)
  for (const u of registered) {
    const bar = bars.find((b) => b.grade === u.label)
    if (!bar) fail(`no bar for ${u.label}`)
    if (bar.approved !== u.approved)
      fail(`${u.label}: bar says ${bar.approved} registered, API says ${u.approved}`)
    if (bar.expected !== u.expected)
      fail(`${u.label}: bar says ${bar.expected} expected, API says ${u.expected}`)
    const wanted =
      u.expected > 0 ? `${u.approved} of ${u.expected} expected` : `${u.approved} registered`
    if (bar.label !== wanted) fail(`${u.label}: label reads "${bar.label}", expected "${wanted}"`)
  }
  console.log(`bars: ${bars.map((b) => `${b.abbrev} ${b.label} (${b.width})`).join(" · ")}`)

  const attention = attentionFromApi(before.state)
  const pill = await pillText()
  if (pill !== expectedPill(attention))
    fail(`pill reads "${pill}", the weekend math says "${expectedPill(attention)}"`)
  console.log(
    `pill: "${pill}"${
      attention.length > 0
        ? ` (${attention.map((a) => `${a.label} ${a.demand}/${a.cap} ${a.tone}`).join(", ")})`
        : ""
    }`
  )

  const alert = await alertText()
  if (attention.length > 0 && !alert) fail("a weekend needs attention but nothing says why")
  if (attention.length === 0 && alert) fail(`nothing needs attention but the alert says: ${alert}`)
  if (alert) console.log(`alert: ${alert}`)

  await page.waitForSelector("text=so the plan behind these bars is read only", { timeout: 10000 })
  console.log("finalized season: read-only banner shows and the bars stay")
  await checkButtons()
  await page.screenshot({ path: "/tmp/plan-step5-locked.png", fullPage: true })

  // A watch screen watches. It must not have written anything.
  const after = await plannerState()
  if (after.seasonStatus !== "FINALIZED") fail("the season status changed")
  if (after.planPublishedAt !== before.planPublishedAt) fail("something published the plan")
  if (JSON.stringify(after.state.units) !== JSON.stringify(before.state.units))
    fail("the grades changed under us")
  console.log("nothing was written: status, units and publish state all unchanged")

  await browser.close()
  console.log("PLAN STEP5 LOCKED: PASS")
  process.exit(0)
}

// ——————————————————————————————— drive ———————————————————————————————
const first = await plannerState()
if (["FINALIZED", "IN_PROGRESS", "COMPLETED"].includes(first.seasonStatus))
  fail("drive mode expects an editable season")

const divisionsUrl = `${BASE}/api/seasons/${target.seasonId}/divisions`
const sessionsUrl = `${BASE}/api/seasons/${target.seasonId}/sessions`
const venuesUrl = `${BASE}/api/seasons/${target.seasonId}/venues`
const scratchGrades = new Set(SCRATCH.grades.map((g) => g.ageGroup))

const listDivisions = async () =>
  (await page.request.get(divisionsUrl).then((r) => r.json())).divisions ?? []

/** Remove everything a drive creates — also the pre-flight for an aborted run. */
const teardown = async () => {
  const state = await plannerState()
  for (const win of state.state.windows) {
    for (const w of win.weekends) {
      const res = await page.request.delete(`${sessionsUrl}?sessionId=${w.sessionId}`)
      if (!res.ok()) console.error(`CLEANUP session ${w.sessionId}: ${res.status()}`)
    }
  }
  for (const d of await listDivisions()) {
    if (!scratchGrades.has(d.ageGroup)) continue
    const res = await page.request.delete(`${divisionsUrl}?divisionId=${d.id}`)
    if (!res.ok()) console.error(`CLEANUP division ${d.id}: ${res.status()}`)
  }
  const venues = await page.request.get(venuesUrl).then((r) => (r.ok() ? r.json() : { venues: [] }))
  for (const v of venues.venues ?? []) {
    if (v.venueId !== SCRATCH.venueId) continue
    const res = await page.request.delete(`${venuesUrl}?seasonVenueId=${v.id}`)
    if (!res.ok()) console.error(`CLEANUP season venue ${v.id}: ${res.status()}`)
  }
}

await teardown()
console.log("pre-flight: scratch season emptied")

try {
  // 1) Nothing registered, nothing estimated: one honest sentence.
  await openStep5()
  if ((await readBars()).length !== 0) fail("an empty season should draw no bars")
  await page.waitForSelector("text=There is nothing to watch yet", { timeout: 10000 })
  if ((await pillText()) !== "On plan") fail("an empty season is not in trouble")
  console.log("empty season: one honest sentence, no bars, no alarm")
  await page.screenshot({ path: "/tmp/plan-step5-empty.png", fullPage: true })

  // 2) Build a season worth watching: a gym, four weekends, three grades.
  const venueRes = await page.request.post(venuesUrl, {
    data: {
      venueId: SCRATCH.venueId,
      courtCount: SCRATCH.courtCount,
      openTime: "09:00",
      closeTime: "17:00",
      addToSessions: false,
    },
  })
  if (!venueRes.ok()) fail(`attach venue ${venueRes.status()} ${await venueRes.text()}`)

  for (const [sat, sun] of SCRATCH.weekends) {
    const res = await page.request.post(sessionsUrl, {
      data: {
        days: [
          { date: sat, startTime: "09:00", endTime: "17:00" },
          { date: sun, startTime: "09:00", endTime: "17:00" },
        ],
        venueId: SCRATCH.venueId,
        targetGamesPerTeam: 2,
      },
    })
    if (!res.ok()) fail(`create weekend ${sat}: ${res.status()} ${await res.text()}`)
  }

  const created = []
  for (const g of SCRATCH.grades) {
    const res = await page.request.post(divisionsUrl, {
      data: { ageGroup: g.ageGroup, gender: "MALE", tier: 1 },
    })
    if (!res.ok()) fail(`create grade ${g.ageGroup}: ${res.status()} ${await res.text()}`)
    created.push({ id: (await res.json()).id, ...g })
  }
  const patch = async (rows) => {
    const res = await page.request.patch(plannerUrl, { data: { expected: rows } })
    if (!res.ok()) fail(`expected teams ${res.status()} ${await res.text()}`)
  }
  await patch(created.map((c) => ({ divisionId: c.id, expectedTeams: c.teams })))
  console.log(
    `scratch world: ${SCRATCH.weekends.length} weekends, ${created.length} grades ` +
      `(${created.map((c) => `${c.ageGroup} ${c.teams}`).join(", ")}), nobody approved`
  )

  // 3) The pre-registration state the mock is written for: 0 of N, every row.
  await openStep5()
  const bars = await readBars()
  if (bars.length !== SCRATCH.grades.length)
    fail(`expected ${SCRATCH.grades.length} bars, got ${bars.length}`)
  for (const g of SCRATCH.grades) {
    const bar = bars.find((b) => b.grade === g.ageGroup)
    if (!bar) fail(`no bar for ${g.ageGroup}`)
    if (bar.approved !== 0) fail(`${g.ageGroup}: nobody is approved, bar says ${bar.approved}`)
    if (bar.expected !== g.teams)
      fail(`${g.ageGroup}: bar expects ${bar.expected}, step 1 said ${g.teams}`)
    if (bar.label !== `0 of ${g.teams} expected`) fail(`${g.ageGroup}: label "${bar.label}"`)
    if (bar.width !== "0%") fail(`${g.ageGroup}: an empty bar should be 0% wide, got ${bar.width}`)
    if (bar.over) fail(`${g.ageGroup}: nothing registered cannot be over plan`)
  }
  if ((await pillText()) !== "On plan") fail("no calendar is kept yet, so nothing can be over")
  console.log(`bars: ${bars.map((b) => `${b.abbrev} ${b.label}`).join(" · ")}`)
  await checkButtons()
  await page.screenshot({ path: "/tmp/plan-step5-zero.png", fullPage: true })

  // 4) Keep a calendar the way step 3 does, so the weekends carry grades.
  const proposed = await page.request.post(`${plannerUrl}/propose`, { data: { lever: "balance" } })
  if (!proposed.ok()) fail(`propose ${proposed.status()}`)
  const { assignment } = await proposed.json()
  const applied = await page.request.post(`${plannerUrl}/apply`, { data: { assignment } })
  if (!applied.ok()) fail(`apply ${applied.status()}`)
  console.log(`kept a calendar: ${Object.values(assignment).flat().length} chip placements`)

  await openStep5()
  const planned = attentionFromApi((await plannerState()).state)
  if (planned.length > 0)
    fail(
      `the scratch gyms should hold this plan comfortably, but ${planned
        .map((p) => `${p.label} is ${p.demand}/${p.cap}`)
        .join(", ")}`
    )
  if ((await pillText()) !== "On plan") fail(`pill reads "${await pillText()}" on a plan that fits`)
  if ((await alertText()) !== null) fail("a plan that fits has nothing to alert about")
  console.log(`with the plan kept and everything fitting, the pill reads "${await pillText()}"`)
  await page.screenshot({ path: "/tmp/plan-step5-onplan.png", fullPage: true })

  // 5) The moment the screen exists for: the grades blow past the gyms.
  await patch(
    SCRATCH.blowUp.map((b) => ({
      divisionId: created.find((c) => c.ageGroup === b.ageGroup).id,
      expectedTeams: b.teams,
    }))
  )
  const broken = attentionFromApi((await plannerState()).state)
  if (broken.length === 0) fail("blowing the grades up should break at least one weekend")
  console.log(
    `${SCRATCH.blowUp.map((b) => `${b.ageGroup} → ${b.teams}`).join(", ")}: ` +
      `${broken.map((b) => `${b.label} ${b.demand}/${b.cap} ${b.tone}`).join(", ")}`
  )

  await openStep5()
  const brokenPill = await pillText()
  if (brokenPill !== expectedPill(broken))
    fail(`pill reads "${brokenPill}", the weekend math says "${expectedPill(broken)}"`)
  const alert = await alertText()
  if (!alert) fail("a broken weekend must say what broke")
  if (!broken.some((b) => alert.includes(b.label)))
    fail(`the alert never names the weekend that broke: ${alert}`)
  console.log(`pill: "${brokenPill}"`)
  console.log(`alert: ${alert}`)

  const seeOptions = page.locator('[data-testid="see-options"]')
  if ((await seeOptions.count()) === 1) {
    const before = (await alertText()).length
    await seeOptions.click()
    await page.waitForTimeout(300)
    const after = (await alertText()).length
    if (after <= before) fail("See options revealed nothing")
    console.log(`"See options" opened the rest (${before} → ${after} characters)`)
  } else {
    console.log("only a couple of sentences to say, so no See options control (by design)")
  }
  await page.screenshot({ path: "/tmp/plan-step5-attention.png", fullPage: true })

  // 6) "Updating live as teams sign up" is a real refetch, not a claim.
  await openStep5()
  const pollsAtOpen = polls
  const firstStamp = await page.locator("text=/^Checked at /").textContent()
  console.log(`polling: waiting 33s on the open screen (${firstStamp.trim()})`)
  await page.waitForTimeout(33000)
  if (polls <= pollsAtOpen)
    fail(`the screen never refetched: ${polls - pollsAtOpen} extra GETs in 33s`)
  console.log(`polling: ${polls - pollsAtOpen} extra planner GET(s) in 33s`)
} finally {
  await teardown()
  console.log("scratch world removed; season is empty again")
}

await browser.close()
console.log("PLAN STEP5 DRIVE: ALL PASS")
