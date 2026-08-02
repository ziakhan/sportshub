/**
 * Plan wizard step 4 drive (wave 4, 2026-08-02). Two runs, no world damage:
 *
 *   node verify-plan-step4.mjs locked
 *     The NPH journey season (FINALIZED, official calendar saved): step 4
 *     renders the real card off the saved plan, the operator can preview and
 *     download it, and BOTH publish and unpublish refuse with 409 — the whole
 *     wizard is read-only once a season is finalized. Nothing is written.
 *
 *   node verify-plan-step4.mjs drive
 *     A scratch season built through the API as the platform admin (grades, a
 *     gym, four weekends across two months), planned and kept, then driven for
 *     real: the card 404s for a signed-out visitor, step 4 shows the operator
 *     their preview anyway, Publish makes the card public AND puts the living
 *     calendar on the public league page, and taking it down removes both.
 *     The scratch world is torn down afterwards.
 *
 * Screenshots to /tmp/plan-step4-*.png.
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
// step 3 drive uses, built and emptied by this script.
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
// A second context with no session at all: the public's view of the card.
const anon = await browser.newContext()

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

const cardUrl = `${BASE}/api/seasons/${target.seasonId}/planner/card`
const publishUrl = `${BASE}/api/seasons/${target.seasonId}/planner/publish`
const plannerUrl = `${BASE}/api/seasons/${target.seasonId}/planner`

const plannerState = async () => {
  const res = await page.request.get(plannerUrl)
  if (!res.ok()) fail(`GET planner ${res.status()}`)
  return res.json()
}

/** The card as the operator sees it: a real PNG, not an error page. */
const operatorCard = async () => {
  const res = await page.request.get(cardUrl)
  const body = res.ok() ? await res.body() : Buffer.alloc(0)
  return { status: res.status(), type: res.headers()["content-type"] ?? "", bytes: body.length }
}

const anonCardStatus = async () => (await anon.request.get(cardUrl)).status()

const openStep4 = async () => {
  await page.goto(`${BASE}/manage/leagues/${target.leagueId}/seasons/${target.seasonId}/plan?step=4`)
  await page.waitForSelector("text=Publish your season", { timeout: 20000 })
  await page.waitForTimeout(800)
}

const statePill = async () =>
  (await page.locator("text=/Published |Not published yet/").first().textContent())?.trim()

/** Does the public league page show the living calendar right now? */
const publicCalendar = async () => {
  await page.goto(`${BASE}/league/${target.seasonId}`)
  await page.waitForSelector("h1", { timeout: 20000 })
  await page.waitForTimeout(500)
  const section = page.locator("#season-calendar")
  if ((await section.count()) === 0) return null
  const chips = await section.locator("span.rounded-lg").count()
  const months = await section.locator("h3").count()
  return { months, chips }
}

// ——————————————————————————————— locked ———————————————————————————————
if (MODE === "locked") {
  const data = await plannerState()
  if (data.seasonStatus !== "FINALIZED") fail("locked mode expects a FINALIZED season")
  if (data.planPublishedAt) fail("the journey season should start unpublished")

  // The card renders off the SAVED plan, for the operator only.
  const card = await operatorCard()
  if (card.status !== 200) fail(`operator card ${card.status}`)
  if (!card.type.includes("image/png")) fail(`operator card is ${card.type}, not a PNG`)
  if (card.bytes < 5000) fail(`operator card is only ${card.bytes} bytes — probably blank`)
  console.log(`operator card: ${card.bytes} bytes of ${card.type}`)

  if ((await anonCardStatus()) !== 404) fail("an unpublished card must 404 for the public")
  console.log("unpublished card 404s for a signed-out visitor")

  await openStep4()
  const pill = await statePill()
  if (pill !== "Not published yet") fail(`expected "Not published yet", got "${pill}"`)
  await page.waitForSelector("text=so the plan can't be published", { timeout: 10000 })
  const publish = page.locator('[data-testid="row-publish"] button')
  if (!(await publish.isDisabled())) fail("a finalized season must not offer to publish")
  if ((await page.locator('[data-testid="unpublish-plan"]').count()) > 0)
    fail("a finalized season must not offer to take it down")
  const preview = page.locator('[data-testid="calendar-card-preview"]')
  if ((await preview.count()) !== 1) fail("the operator should still see the card preview")
  const drawn = await preview.evaluate((img) => img.complete && img.naturalWidth > 0)
  if (!drawn) fail("the preview image never loaded")
  console.log("step 4 renders the card preview and disables publishing")
  await page.screenshot({ path: "/tmp/plan-step4-locked.png", fullPage: true })

  // The lock holds at the API, not just in the client.
  const post = await page.request.post(publishUrl)
  if (post.status() !== 409) fail(`publish on FINALIZED should 409, got ${post.status()}`)
  const del = await page.request.delete(publishUrl)
  if (del.status() !== 409) fail(`unpublish on FINALIZED should 409, got ${del.status()}`)
  console.log("season lock holds at the API: publish 409, unpublish 409")

  if ((await plannerState()).planPublishedAt) fail("nothing should have been published")
  if ((await publicCalendar()) !== null) fail("an unpublished season must not show a calendar")
  console.log("the public league page shows no calendar for an unpublished season")

  await browser.close()
  console.log("PLAN STEP4 LOCKED: PASS")
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
  await page.request.delete(publishUrl)
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

// 1) Build a season worth publishing: a gym, four weekends, three grades.
const venueRes = await page.request.post(venuesUrl, {
  data: {
    venueId: SCRATCH.venueId,
    courtCount: SCRATCH.courtCount,
    openTime: "09:00",
    closeTime: "13:00",
    addToSessions: false,
  },
})
if (!venueRes.ok()) fail(`attach venue ${venueRes.status()} ${await venueRes.text()}`)

for (const [sat, sun] of SCRATCH.weekends) {
  const res = await page.request.post(sessionsUrl, {
    data: {
      days: [
        { date: sat, startTime: "09:00", endTime: "13:00" },
        { date: sun, startTime: "09:00", endTime: "13:00" },
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
const expectedRes = await page.request.patch(plannerUrl, {
  data: { expected: created.map((c) => ({ divisionId: c.id, expectedTeams: c.teams })) },
})
if (!expectedRes.ok()) fail(`expected teams ${expectedRes.status()}`)
console.log(
  `scratch world: ${SCRATCH.weekends.length} weekends, ${created.length} grades ` +
    `(${created.map((c) => `${c.ageGroup} ${c.teams}`).join(", ")})`
)

try {
  // 2) Publishing needs a kept calendar, and says so when there is none.
  const early = await page.request.post(publishUrl)
  if (early.status() !== 409) fail(`publish with no calendar should 409, got ${early.status()}`)
  console.log(`no calendar yet: publish refused (${(await early.json()).error})`)

  await openStep4()
  await page.waitForSelector("text=There is no kept calendar yet", { timeout: 10000 })
  if ((await page.locator('[data-testid="calendar-card-preview"]').count()) > 0)
    fail("there is nothing to preview before a calendar is kept")
  if (!(await page.locator('[data-testid="row-publish"] button').isDisabled()))
    fail("publish should be disabled with no calendar")
  console.log("step 4 with no calendar: one honest sentence, no dead buttons")
  await page.screenshot({ path: "/tmp/plan-step4-noplan.png", fullPage: true })

  // 3) Keep a calendar the way step 3 does: propose, then apply.
  const proposed = await page.request.post(`${plannerUrl}/propose`, { data: { lever: "balance" } })
  if (!proposed.ok()) fail(`propose ${proposed.status()}`)
  const { assignment } = await proposed.json()
  const applied = await page.request.post(`${plannerUrl}/apply`, { data: { assignment } })
  if (!applied.ok()) fail(`apply ${applied.status()}`)
  console.log(`kept a calendar: ${Object.values(assignment).flat().length} chip placements`)

  // 4) The operator sees the real card; the public still gets nothing.
  const preview = await operatorCard()
  if (preview.status !== 200) fail(`operator card ${preview.status}`)
  if (!preview.type.includes("image/png")) fail(`operator card is ${preview.type}`)
  if (preview.bytes < 5000) fail(`operator card is only ${preview.bytes} bytes`)
  if ((await anonCardStatus()) !== 404) fail("an unpublished card must 404 for the public")
  console.log(`operator preview: ${preview.bytes} bytes · public: 404`)

  await openStep4()
  const img = page.locator('[data-testid="calendar-card-preview"]')
  await img.waitFor({ timeout: 20000 })
  const drawn = await img.evaluate((el) => el.complete && el.naturalWidth > 0)
  if (!drawn) fail("the preview image never loaded in the browser")
  const downloadBtn = page.locator('[data-testid="row-download"] button')
  if ((await downloadBtn.count()) === 0) fail("the download action is missing")
  if (await downloadBtn.isDisabled()) fail("download should be live once a calendar exists")
  if ((await statePill()) !== "Not published yet") fail("nothing is published yet")
  console.log("step 4 shows the live preview, Download and Publish")
  await page.screenshot({ path: "/tmp/plan-step4-preview.png", fullPage: true })

  if ((await publicCalendar()) !== null) fail("an unpublished plan must not reach the league page")

  // 5) Publish, from the screen.
  await openStep4()
  await page.locator('[data-testid="row-publish"] button').click()
  await page.waitForSelector("text=Your calendar is live", { timeout: 20000 })
  const pill = await statePill()
  if (!pill?.startsWith("Published ")) fail(`expected a published pill, got "${pill}"`)
  console.log(`published: ${pill}`)
  await page.screenshot({ path: "/tmp/plan-step4-published.png", fullPage: true })

  if ((await plannerState()).planPublishedAt === null) fail("publish did not stick")
  if ((await anonCardStatus()) !== 200) fail("a published card must be public")
  console.log("the card is public now (anonymous fetch 200)")

  // 6) The living calendar is on the league page.
  const live = await publicCalendar()
  if (!live) fail("the published calendar never reached the public league page")
  if (live.months !== 2) fail(`expected 2 month columns on the page, got ${live.months}`)
  if (live.chips < SCRATCH.grades.length) fail(`expected grade chips, got ${live.chips}`)
  console.log(`league page: ${live.months} month columns, ${live.chips} grade chips`)
  await page.screenshot({ path: "/tmp/plan-step4-leaguepage.png", fullPage: true })

  // 7) Take it down: both surfaces go with it.
  await openStep4()
  await page.locator('[data-testid="unpublish-plan"]').click()
  await page.waitForSelector("text=Taken down", { timeout: 20000 })
  if ((await statePill()) !== "Not published yet") fail("the pill still says published")
  if ((await plannerState()).planPublishedAt !== null) fail("unpublish did not stick")
  if ((await anonCardStatus()) !== 404) fail("the card should be private again")
  if ((await publicCalendar()) !== null) fail("the league page still shows the calendar")
  console.log("taken down: card 404s again, league page section gone")
  await page.screenshot({ path: "/tmp/plan-step4-down.png", fullPage: true })

  // The plan itself survived being unpublished.
  const after = await plannerState()
  if (!after.state.windows.flatMap((w) => w.weekends).some((w) => w.assigned.length > 0))
    fail("taking the calendar down must not erase it")
  console.log("the kept calendar itself is untouched")
} finally {
  await teardown()
  console.log("scratch world removed; season is empty again")
}

await browser.close()
console.log("PLAN STEP4 DRIVE: ALL PASS")
