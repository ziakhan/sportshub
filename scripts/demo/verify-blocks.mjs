// Drive the venue model v2 board on step 3 (owner rulings 2026-08-03: home gym
// first, spill becomes rental blocks, two modes for filling them, and the ask
// sheet an operator reads down the phone to a gym).
//
// Extended 2026-08-04 for the full-bleed workspace: the sticky work rail, the
// weekend at its own altitude, and the four verbs (place, add a weekend,
// correct, break).
//
// SAFE ON THE OWNER'S LIVE INSTANCE. Everything it does lives on the WORKING
// COPY: it moves grades with the tap-and-tap path, fills the gaps from the pool,
// corrects a gym's courts, prices a split, undoes, and places a gym by hand. It
// never presses Keep, never activates, never saves a plan, and it never CREATES
// a weekend — the add-a-weekend card is opened, read and dismissed. It captures
// the season's saved calendar before it starts and byte-compares it at the end.
//
// Env (defaults = the 2026-08-02 local world):
//   BASE_URL, SEASON_ID, LEAGUE_ID, SHOT_DIR
// Run from scripts/demo (its node_modules has Playwright):
//   node verify-blocks.mjs
import { chromium } from "playwright"
import { openBoard } from "./plan-board-lib.mjs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SEASON = process.env.SEASON_ID ?? "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = process.env.LEAGUE_ID ?? "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SHOTS =
  process.env.SHOT_DIR ??
  "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/4eadfbff-644b-4ed7-a799-a1ea780f28c6/scratchpad/shots-v2"
const USER = "owner-nph@sportshub.demo"
const PASS = "TestPass123!"

const results = []
const ok = (name, pass, extra = "") => {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`)
}

const fs = await import("node:fs")
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } })
const PLAN_URL = `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`

// This drive should never meet a dialog. If one appears, dismiss it: every
// confirm on this screen guards a write.
page.on("dialog", async (dialog) => {
  console.log(`      dialog DISMISSED: ${dialog.message()}`)
  await dialog.dismiss()
})

for (const p of ["/sign-in", `/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`]) {
  await page.request.get(`${BASE}${p}`).catch(() => {})
}

await page.goto(`${BASE}/sign-in`)
let user = null
// Three attempts, not one: under load a single try can fail outright (the
// callback answers but authorize()'s own DB query never got a load-free
// moment), and that reads exactly like invalid credentials from here. A fresh
// page and a fresh attempt is the honest retry, not a longer wait on the same
// stuck one.
for (let attempt = 0; attempt < 3 && !user; attempt++) {
  if (attempt > 0) {
    await page.goto(`${BASE}/sign-in`)
  }
  await page.waitForTimeout(2500)
  await page.fill('input[type="email"]', USER)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  for (let i = 0; i < 40; i++) {
    const s = await page.request
      .get(`${BASE}/api/auth/session`)
      .then((r) => r.json())
      .catch(() => null)
    if (s?.user) {
      user = s.user
      break
    }
    await page.waitForTimeout(500)
  }
}
ok("signed in as the league owner", Boolean(user))
if (!user) {
  await browser.close()
  process.exit(1)
}

/* ------------------- the calendar the season runs, before ---------------- */
const savedCalendar = async () => {
  const data = await page.request
    .get(`${BASE}/api/seasons/${SEASON}/planner`)
    .then((r) => r.json())
    .catch(() => null)
  return JSON.stringify(
    (data?.state?.windows ?? [])
      .flatMap((w) => w.weekends)
      .map((w) => ({ id: w.sessionId, assigned: w.assigned, gyms: w.assignedVenues ?? {} }))
  )
}
const listPlans = async () =>
  (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json()))?.plans ?? []

const before = await savedCalendar()
const plansBefore = (await listPlans()).map((p) => `${p.name}${p.isActive ? "*" : ""}`).join(", ")
ok("captured the season's saved calendar", before.length > 2, `${before.length} bytes`)

/* ------------------- the APIs carry blocks and the ask ------------------- */
// A propose is read-only: it solves in memory and writes nothing. It is also
// how this drive learns what a fresh proposal rents.
// A generous timeout, not Playwright's 30s default: this solves the whole
// season and a concurrent seed on the same box can push it well past that.
const proposal = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/planner/propose`, {
    data: { lever: "balance" },
    timeout: 90000,
  })
  .then((r) => r.json())
  .catch(() => null)
ok(
  "propose returns the rental blocks and the ask alongside the calendar",
  Array.isArray(proposal?.blocks) &&
    Boolean(proposal?.ask?.season) &&
    Array.isArray(proposal?.ask?.months),
  proposal
    ? `${proposal.blocks?.length ?? 0} blocks · ${proposal.ask?.season?.courtDays ?? "?"} court-days · ${
        proposal.ask?.months?.length ?? 0
      } months`
    : "no proposal"
)
const plannerRes = await page.request
  .get(`${BASE}/api/seasons/${SEASON}/planner`)
  .then((r) => r.json())
  .catch(() => null)
ok(
  "the saved calendar reports its own rentals too",
  Array.isArray(plannerRes?.blocks) && Boolean(plannerRes?.ask?.season),
  `${plannerRes?.blocks?.length ?? 0} blocks · ${plannerRes?.ask?.season?.courtDays ?? "?"} court-days`
)

/* ---- ONE BIG BOOKING, and no back-to-back weekends (owner rulings 2026-08-05).
        Both read off the proposal the solver just made on the owner's own world,
        which has several chosen weekends a month and Six Park free on most of
        them: exactly the case that used to come back as a 2-court session on
        every Saturday. Read-only — a propose writes nothing. ---- */
const askMonths = proposal?.ask?.months ?? []
const spreadMonths = askMonths.filter((m) => (m.weekendsNeedingRent ?? 0) > 1)
ok(
  "a month's rental lands on ONE weekend, as big as the rooms allow",
  askMonths.length > 0 && spreadMonths.length === 0,
  askMonths.map((m) => `${m.label}: ${m.chunks}`).join(" · ") || "no months in the ask"
)

const weekendDates = new Map()
for (const win of plannerRes?.state?.windows ?? []) {
  for (const w of win.weekends ?? []) weekendDates.set(w.sessionId, w.dateISO)
}
const playedBy = new Map()
for (const [sessionId, keys] of Object.entries(proposal?.assignment ?? {})) {
  const dateISO = weekendDates.get(sessionId)
  if (!dateISO) continue
  for (const key of keys) playedBy.set(key, [...(playedBy.get(key) ?? []), dateISO])
}
const backToBack = []
for (const [key, dates] of playedBy) {
  const sorted = [...dates].sort()
  for (let i = 1; i < sorted.length; i++) {
    const days = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000
    if (days <= 8) backToBack.push(`${key} ${sorted[i - 1].slice(5, 10)}→${sorted[i].slice(5, 10)}`)
  }
}
ok(
  "no grade plays two Saturdays running, month boundaries included",
  playedBy.size > 0 && backToBack.length === 0,
  backToBack.length ? backToBack.join(" · ") : `${playedBy.size} grades, every gap over a week`
)

/* ------------------------------- the board ------------------------------- */
// RE-PINNED 2026-08-05 (owner rulings #1 and #2): step 3 opens on the chooser
// with nothing selected, so the drive opens the season's own plan by hand.
const entry = await openBoard(page, PLAN_URL)
ok(
  "the board opens on nothing until a plan is opened",
  entry.empty && entry.weekends === 0 && /None open/.test(entry.picker),
  `${entry.picker} · ${entry.weekends} weekends drawn`
)

const summaryText = async () => {
  const el = page.locator('[data-testid="block-summary"]')
  return (await el.count()) > 0 ? (await el.innerText()).trim() : ""
}
const noticeText = async () => {
  const el = page.locator('[data-testid="board-notice"]')
  return (await el.count()) > 0 ? (await el.innerText()).replace(/\n/g, " ").trim() : ""
}
const countOf = (sel) => page.locator(sel).count()
const assumedIn = (text) => {
  const hit = /(\d+) assumed/.exec(text)
  return hit ? Number(hit[1]) : 0
}
const neededIn = (text) => {
  const hit = /(\d+) still need a building/.exec(text)
  return hit ? Number(hit[1]) : 0
}

/* ---- RE-PINNED 2026-08-06 (owner ruling #6): the mode toggle is GONE.
       "Assign gyms for me" / "I will place them" was a setting standing in front
       of two verbs, and it decided whether the pool was even drawn. Both verbs
       are buttons now, always there. ---- */
ok(
  "the assign-mode toggle is gone: filling and placing are verbs, not a mode",
  (await countOf('[data-testid="assign-mode"]')) === 0 &&
    (await countOf('[data-testid="assign-mode-solve"]')) === 0 &&
    (await countOf('[data-testid="assign-mode-place"]')) === 0
)
ok(
  "filling the gaps is one always-visible button beside Redraw, and it names the pool",
  (await countOf('[data-testid="assign-from-pool"]')) === 1 &&
    (await page.locator('[data-testid="assign-from-pool"]').innerText()) ===
      "Fill the gaps from my pool"
)
ok(
  "and Redraw carries the one alternative shape next to it",
  (await countOf('[data-testid="redraw-spread"]')) === 1 &&
    (await page.locator('[data-testid="redraw-spread"]').innerText()) ===
      "Redraw, spread out instead",
  await page.locator('[data-testid="redraw-spread"]').innerText().catch(() => "")
)
/* ---- and the three disclosures under the board are gone with it ---- */
const boardText = await page.locator("main").innerText()
ok(
  "the three disclosures under the board are gone: rules, hours and compare",
  (await countOf('[data-testid="hours-toggle"]')) === 0 &&
    (await countOf('[data-testid="compare-toggle"]')) === 0 &&
    (await countOf('[data-testid="compare-banner"]')) === 0 &&
    !/Adjust grouping rules/.test(boardText) &&
    !/Change the hours/.test(boardText) &&
    !/Compare with the kept/.test(boardText)
)

const homeMarks = await countOf('[data-testid="home-mark"]')
const rentalMarks = await countOf('[data-testid="rental-mark"]')
ok(
  "the gym you own wears a quiet home mark, and a rented gym says how many courts it takes",
  homeMarks > 0 && rentalMarks > 0,
  `${homeMarks} home sections · ${rentalMarks} rented sections`
)
/**
 * RE-PINNED 2026-08-05: the first weekend the season HAS is not necessarily a
 * weekend it has a gym on — turning one off in step 2 is an ordinary thing to do,
 * and a weekend with no gym has no sections to order. The contract is about
 * weekends that have one: the gym the league OWNS is drawn first.
 */
const firstMark = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-session-id]")]
  const card = cards.find((c) => c.querySelector('[data-testid="weekend-gym-section"]'))
  const sections = [...(card?.querySelectorAll('[data-testid="weekend-gym-section"]') ?? [])]
  const roles = sections.map((s) => s.getAttribute("data-role"))
  return {
    weekend: card?.querySelector('[data-testid="weekend-open"]')?.textContent?.trim() ?? null,
    roles,
    first: roles[0] ?? null,
    hasHome: roles.includes("home"),
  }
})
ok(
  "the home gym section comes first on a weekend that has one",
  firstMark.first !== null && (firstMark.hasHome ? firstMark.first === "home" : firstMark.first === "pool"),
  JSON.stringify(firstMark)
)
const rentalWords = await page.locator('[data-testid="rental-mark"]').first().innerText()
// RE-PINNED 2026-08-05 (owner ruling #4): a rented section says how much of the
// building it takes, because the section is now measured in the courts we rent
// rather than in the whole gym.
ok(
  "a rented section is labelled with the courts it takes, out of the building",
  /^rented \d+ of \d+ courts?$/.test(rentalWords),
  rentalWords
)

const baseSummary = await summaryText()
ok(
  "the plan line counts the rentals behind this calendar",
  /rental blocks?:/.test(baseSummary),
  baseSummary
)

/* ------------------------------ the ask sheet ---------------------------- */
const sheet = page.locator('[data-testid="ask-sheet"]')
ok("the ask sheet sits above the rail, quiet", (await sheet.count()) === 1)
const seasonLine = await page.locator('[data-testid="ask-season"]').innerText()
ok(
  "it leads with the season total in court-days and court-hours",
  /court-days/.test(seasonLine) && /court-hours/.test(seasonLine),
  seasonLine
)
await page.locator('[data-testid="ask-sheet-toggle"]').click()
await page.waitForSelector('[data-testid="ask-sheet-body"]', { timeout: 15000 })
const months = await countOf('[data-testid="ask-month"]')
const askBlocks = await countOf('[data-testid="ask-block"]')
const monthRow = months > 0 ? await page.locator('[data-testid="ask-month"]').first().innerText() : ""
ok(
  "it opens on a row per month, with the shape of the need in words",
  months > 0 && /court-days/.test(monthRow) && /weekend/.test(monthRow),
  monthRow.replace(/\n/g, " · ")
)
ok(
  "every rental is there with a standing on it",
  askBlocks > 0 &&
    (await page.locator('[data-testid="ask-block"]').first().getAttribute("data-status")) !== null,
  `${askBlocks} blocks · first is ${await page
    .locator('[data-testid="ask-block"]')
    .first()
    .getAttribute("data-status")}`
)
await page.locator('[data-testid="ask-sheet"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/3-ask-sheet.png` })
await page.locator('[data-testid="ask-sheet-toggle"]').click()
await page.waitForTimeout(250)

/* ---- a benched grade chip carries the games it would bring (owner ruling
       2026-08-05). Working copy only: a grade is taken off its weekend so the
       bench definitely has one, read, and put straight back with Undo. ---- */
const benchTexts = async () =>
  page.evaluate(() => {
    const group = document.querySelector('[data-testid="bench-group"]')
    if (!group) return []
    return [...group.querySelectorAll("button[aria-pressed]")].map((b) =>
      (b.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim()
    )
  })
let benched = await benchTexts()
let benchUndos = 0
if (benched.length === 0) {
  const take = page.locator('button[aria-label^="Take "]').first()
  if ((await take.count()) > 0) {
    await take.click()
    await page.waitForTimeout(400)
    benchUndos += 1
    benched = await benchTexts()
  }
}
ok(
  "a chip on the bench says how many games it would bring, like a placed one",
  benched.length > 0 && benched.every((t) => /\d/.test(t)),
  benched.slice(0, 4).join(" · ") || "no bench chip to read"
)
for (let i = 0; i < benchUndos; i++) {
  const undo = page.locator('[data-testid="undo-last"]')
  if ((await undo.count()) === 0) break
  await undo.click()
  await page.waitForTimeout(350)
}

/* --------------- make a weekend that has nowhere to play ----------------- */
// Working copy only: a month's grades tapped onto one of its weekends. That is
// exactly the spill an operator creates by hand, and it is what an empty rental
// slot is for.
// The weekend to crowd is chosen off the planner's own state: the one with the
// MOST capacity in its month, which on this world is a weekend that has both the
// gym the league owns and a gym in the pool. That matters: the pool can only
// answer a gap on a weekend it is actually free on, and a home-only weekend
// crowded to breaking point is a true "there is nothing to rent here" rather
// than the fill this drive is reading.
const stateWindows = plannerRes?.state?.windows ?? []
let target = null
let column = []
let widest = -1
for (const win of stateWindows) {
  for (const w of win.weekends ?? []) {
    if (!(w.venues ?? []).some((v) => v.role === "pool")) continue
    if (w.capacityGames <= widest) continue
    widest = w.capacityGames
    target = w.sessionId
    column = (win.weekends ?? []).map((x) => x.sessionId)
  }
}
ok(
  "found a weekend with a gym in the pool to crowd",
  Boolean(target),
  target ? `${column.length} weekends in its month, ${widest} games of capacity` : "no weekend qualifies"
)
if (!target) {
  await browser.close()
  process.exit(1)
}

const slotOn = (sessionId) =>
  page.locator(`[data-session-id="${sessionId}"] [data-testid="rental-slot-empty"]`).count()
const card = (sessionId) => page.locator(`[data-session-id="${sessionId}"]`)
/** Arm a grade chip, then tell the target weekend to take it. */
const sendTo = async (chip) => {
  await chip.click()
  await page.waitForTimeout(200)
  const here = card(target).locator('[data-testid="move-here"]')
  if ((await here.count()) === 0) {
    await page.keyboard.press("Escape")
    return false
  }
  await here.click()
  await page.waitForTimeout(350)
  return true
}

let moves = 0
// The month's own weekends first, then the grades the month is not playing at
// all: between them a weekend can be given more games than its buildings hold,
// which is the only honest way to make an empty slot without touching step 2.
for (const source of column.filter((id) => id !== target)) {
  for (let i = 0; i < 10; i++) {
    if ((await slotOn(target)) > 0) break
    // RE-PINNED 2026-08-05 (owner ruling #4): a gym SECTION now has an armable
    // grip of its own, so a grade chip is asked for by name rather than as
    // "the first toggle in the card".
    const chip = card(source).locator('[data-testid="grade-chip"] button[aria-pressed]').first()
    if ((await chip.count()) === 0) break
    if (!(await sendTo(chip))) break
    moves += 1
  }
  if ((await slotOn(target)) > 0) break
}
const bench = card(target)
  .locator("xpath=ancestor::section[1]")
  .locator('[data-testid="bench-group"] button[aria-pressed]')
for (let i = 0; i < 6; i++) {
  if ((await slotOn(target)) > 0) break
  if ((await bench.count()) === 0) break
  if (!(await sendTo(bench.first()))) break
  moves += 1
}
const slots = await countOf('[data-testid="rental-slot-empty"]')
ok(
  "crowding a month onto one weekend leaves games with no building, and the board draws the empty slot",
  (await slotOn(target)) > 0,
  `${moves} moves · ${slots} empty slot(s) on the board`
)

const slotText = await page
  .locator(`[data-session-id="${target}"] [data-testid="rental-slot-empty"]`)
  .first()
  .innerText()
ok(
  "the empty slot asks in the units a gym quotes on",
  /Needs \d+ courts? · \d+ games? · ~\d+ hours/.test(slotText.replace(/\n/g, " ")),
  slotText.replace(/\n/g, " · ")
)
const slotChips = await page
  .locator(`[data-session-id="${target}"] [data-testid="rental-slot-empty"] span[data-reason]`)
  .count()
ok(
  "the grades with nowhere to play sit inside the slot",
  slotChips > 0,
  `${slotChips} grade chip(s) in the slot`
)
const crowdedSummary = await summaryText()
ok(
  "the plan line says how many rentals still need a building",
  neededIn(crowdedSummary) > 0,
  crowdedSummary
)
await page.locator(`[data-session-id="${target}"]`).scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/1-board-empty-slot.png` })

/* ----------------------- fill the gaps from the pool --------------------- */
const assumedBefore = assumedIn(crowdedSummary)
await page.locator('[data-testid="assign-from-pool"]').click()
await page.waitForTimeout(700)
const filledSummary = await summaryText()
const fillNotice = await noticeText()
ok(
  "one button fills the gaps from the pool and the count moves to assumed",
  assumedIn(filledSummary) > assumedBefore,
  `${crowdedSummary}  →  ${filledSummary}`
)
ok(
  "it says in plain words that nothing is booked",
  /Nothing is booked yet/.test(fillNotice) && /assumed/.test(fillNotice),
  fillNotice
)
const assumedSections = await countOf('[data-testid="weekend-gym-section"][data-status="assumed"]')
const assumedMarks = await page
  .locator('[data-testid="block-status"][data-status="assumed"]')
  .first()
  .innerText()
  .catch(() => "")
// RE-PINNED 2026-08-05 (owner ruling #7): the only status ever drawn is the one
// that is not the default, and it says what it means in full.
ok(
  "the weekend it filled wears the assumed mark, in words",
  assumedSections > 0 && assumedMarks === "assumed, not booked yet",
  `${assumedSections} assumed section(s) · mark "${assumedMarks}"`
)
ok(
  "and no section anywhere says 'confirmed', because silence means confirmed",
  (await countOf('[data-testid="block-status"][data-status="confirmed"]')) === 0 &&
    !/confirmed/i.test(await page.locator('[data-testid="board-scroll"]').innerText())
)
await page.locator(`[data-session-id="${target}"]`).scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/4-assumed-chips.png` })

/* --------------------------------- undo ---------------------------------- */
await page.locator('[data-testid="undo-last"]').click()
await page.waitForTimeout(700)
const undoneSummary = await summaryText()
ok(
  "one undo puts the gyms and the statuses back together",
  undoneSummary === crowdedSummary &&
    (await slotOn(target)) > 0 &&
    (await countOf('[data-testid="weekend-gym-section"][data-status="assumed"]')) === 0,
  `${filledSummary}  →  ${undoneSummary}`
)

/* ------------------------------ the gym list ------------------------------ */
/**
 * RE-PINNED 2026-08-06 (owner ruling #1). There used to be two rows: a colour key
 * that could not be touched, and a tray of the same gyms that could. One row now,
 * and every card does both jobs: the grip picks the gym up, the card spotlights
 * it.
 */
const gymList = page.locator('[data-testid="gym-list"]')
const gymCards = await countOf('[data-testid="gym-card"]')
const gymListText = (await gymList.innerText()).replace(/\n/g, " · ")
ok(
  "one gym list above the board, with courts and weekends on every card",
  (await gymList.count()) === 1 && gymCards > 0 && /courts? · on \d+ weekends?/.test(gymListText),
  gymListText
)
ok(
  "and the legend and the tray are gone: no second row saying the same thing",
  (await countOf('[data-testid="gym-legend"]')) === 0 &&
    (await countOf('[data-testid="venue-tray"]')) === 0 &&
    (await countOf('[data-testid="tray-gym"]')) === 0 &&
    (await countOf('[data-testid="legend-backup"]')) === 0
)
ok(
  "the gym the league OWNS is on the list too, tagged for what it is",
  (await countOf('[data-testid="gym-home-tag"]')) === 1,
  `${await countOf('[data-testid="gym-home-tag"]')} home tag(s)`
)
/** One gym card, and the grip that picks it up. */
const gymCard = (venueId) => page.locator(`[data-testid="gym-card"][data-venue-id="${venueId}"]`)
const poolCard = page.locator('[data-testid="gym-card"][data-role="pool"]').first()
const trayVenue = await poolCard.getAttribute("data-venue-id")
await gymCard(trayVenue).locator('[data-testid="gym-grab"]').click()
await page.waitForTimeout(300)
ok(
  "tapping a gym's grip arms it, and the board says what to do next",
  (await countOf('[data-testid="armed-venue"]')) === 1 &&
    (await gymCard(trayVenue).locator('[data-testid="gym-grab"]').getAttribute("aria-pressed")) ===
      "true",
  await page.locator('[data-testid="armed-venue"]').innerText().catch(() => "")
)
await page.screenshot({ path: `${SHOTS}/2-tray-armed.png` })

/* --------- a gym dropped where the plan has none is an ASSERTION ---------- */
/**
 * RE-PINNED 2026-08-05 (owner ruling #1). This used to hunt for a refusal, and
 * "that gym is not on this weekend" was one of the two it accepted. That refusal
 * is gone on purpose: a pool gym with no availability on a weekend is a legitimate
 * overflow backup, and dropping it there IS the operator asserting they have it
 * (his standing rule — a drag means they checked). What is pinned now is that the
 * drop LANDS and says so, and that the only refusals left are true impossibilities.
 *
 * The tap-arm path is the drag without the mouse. Everything it lands is undone
 * immediately, so the saved calendar is untouched either way.
 */
let asserted = ""
let refusal = ""
const everyWeekend = stateWindows.flatMap((win) => (win.weekends ?? []).map((w) => w.sessionId))
const weekendVenues = new Map(
  stateWindows.flatMap((win) =>
    (win.weekends ?? []).map((w) => [w.sessionId, (w.venues ?? []).map((v) => v.venueId)])
  )
)
for (const sessionId of everyWeekend) {
  if (asserted) break
  // The point of this check is a weekend the armed gym is NOT on.
  if ((weekendVenues.get(sessionId) ?? []).includes(trayVenue)) continue
  const armed = (await countOf('[data-testid="armed-venue"]')) === 1
  if (!armed) {
    await gymCard(trayVenue).locator('[data-testid="gym-grab"]').click()
    await page.waitForTimeout(200)
  }
  const slot = page.locator(`[data-session-id="${sessionId}"] [data-testid="rental-slot-empty"]`)
  // Only a rented section or an empty slot takes a gym, so those are the only
  // places worth tapping.
  const section = page.locator(
    `[data-session-id="${sessionId}"] [data-testid="weekend-gym-section"][data-role="pool"]`
  )
  const spot = (await slot.count()) > 0 ? slot.first() : section.first()
  if ((await spot.count()) === 0) continue
  await spot.click({ position: { x: 6, y: 6 } })
  await page.waitForTimeout(400)
  const said = await noticeText()
  if (/You said you have it that weekend/.test(said)) {
    asserted = said
    // The gym really is on that weekend now, as a rental the operator owns.
    const madeSection = await countOf(
      `[data-session-id="${sessionId}"] [data-testid="weekend-gym-section"][data-venue-id="${trayVenue}"]`
    )
    ok(
      "the assertion becomes a rented block on that weekend, confirmed because they placed it",
      madeSection === 1,
      `${madeSection} section(s) at that gym on the weekend it was not on`
    )
    await page.screenshot({ path: `${SHOTS}/5-drop-asserted.png` })
    await page.locator('[data-testid="undo-last"]').click()
    await page.waitForTimeout(400)
    ok(
      "and one undo takes the assertion back out with the placement",
      (await countOf(
        `[data-session-id="${sessionId}"] [data-testid="weekend-gym-section"][data-venue-id="${trayVenue}"]`
      )) === 0
    )
    break
  }
  if (/courts needed on|will not fit|no gym time we can use/.test(said)) {
    refusal = said
    break
  }
  if (/You placed it/.test(said)) {
    await page.locator('[data-testid="undo-last"]').click()
    await page.waitForTimeout(400)
  }
}
ok(
  "a gym dropped on a weekend the plan has no availability for lands as an assertion",
  asserted.length > 0 || refusal.length > 0,
  asserted || refusal || "no weekend took the armed gym, and none refused it"
)

/* ---------------------- the drag, with a real mouse ---------------------- */
// The tray is dragged as well as tapped, so the drop path gets driven too. This
// one lands: the rented gym has courts enough for the block it is dropped on.
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
let undos = 0
// The empty slot on the crowded weekend: the gym has courts enough for the
// games with nowhere to play, so this one lands.
/**
 * THE TRAY AND THE DROP POINT HAVE TO BE ON SCREEN TOGETHER. An HTML5 drag does
 * not survive a page scroll — the pointer does not move with the page — so the
 * drive puts the tray in view and then drops on whichever empty slot is visible
 * beside it, rather than insisting on one particular weekend.
 */
/**
 * AND THE DROP POINT HAS TO BE ONE THE BOARD OFFERS (owner ruling 2026-08-05,
 * #1). A slot whose gym could not hold those games no longer accepts a drop at
 * all — that is the ruling — so the drive arms the gym first, reads which slots
 * the board is offering, and drags onto one of those. Dropping on a refused
 * target is not a test of the drag path; it is a test of the browser.
 */
await gymList.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await gymCard(trayVenue).locator('[data-testid="gym-grab"]').click()
await page.waitForTimeout(350)
/**
 * RE-PINNED 2026-08-06 (wave B, whole-season board): a ghost date is a real
 * drop target for an armed gym too (see the ghost-date suite above), and now
 * that most unused Saturdays are thin ghost rows rather than dashed cards, a
 * ghost is often the ONLY [data-target="1"] element actually on screen once
 * the gym list has been scrolled into view — searching just rental slots and
 * pool sections was starving this drag test of a candidate that genuinely
 * exists. Ghosts are checked last, after the two card-level targets, so the
 * drive still prefers a real card's slot or section when one is visible.
 *
 * SAFE GHOSTS ONLY: a ghost with no session yet (`ghost.sessionId === null`)
 * lazily POSTs a brand new SeasonSession the moment it is dropped on — a real,
 * permanent addition to the season's calendar with no delete-a-weekend API to
 * take it back. This bit the drive once (Oct 3's ghost got a session it never
 * had before, cleaned up by hand via DELETE /sessions?sessionId=). The ghost
 * candidates here are filtered to `[data-session-id]` present, exactly the
 * same safety constraint the ghost-date suite above already uses.
 */
const dropSpot = await page.evaluate(() => {
  const on = (el) => {
    const box = el.getBoundingClientRect()
    return box.top > 80 && box.bottom < window.innerHeight - 20
  }
  const slots = [...document.querySelectorAll('[data-testid="rental-slot-empty"][data-target="1"]')]
  const at = slots.findIndex(on)
  if (at >= 0) return { what: "slot", index: at }
  const sections = [
    ...document.querySelectorAll(
      '[data-testid="weekend-gym-section"][data-role="pool"][data-target="1"]'
    ),
  ]
  const s = sections.findIndex(on)
  if (s >= 0) return { what: "section", index: s }
  const ghosts = [
    ...document.querySelectorAll('[data-testid="ghost-date"][data-target="1"][data-session-id]'),
  ]
  const g = ghosts.findIndex(on)
  return g >= 0 ? { what: "ghost", index: g } : null
})
const dragTargetSelector = {
  slot: '[data-testid="rental-slot-empty"][data-target="1"]',
  section: '[data-testid="weekend-gym-section"][data-role="pool"][data-target="1"]',
  ghost: '[data-testid="ghost-date"][data-target="1"][data-session-id]',
}
const dragTarget = dropSpot
  ? page.locator(dragTargetSelector[dropSpot.what]).nth(dropSpot.index)
  : null
const dropOn = dragTarget
  ? await dragTarget.evaluate(
      (el) => el.closest("[data-session-id]")?.getAttribute("data-session-id") ?? "?"
    )
  : "nothing on screen offered the gym a home"
const beforeDrag = await noticeText()
let dragSaid = ""
if (dragTarget) {
  // The target's own top line, not its centre: the centre is a grade chip, and a
  // chip is draggable itself.
  await gymCard(trayVenue)
    .dragTo(dragTarget, {
      // From the grip: the middle of a card is the lens toggle now.
      sourcePosition: { x: 8, y: 18 },
      targetPosition: { x: 8, y: 8 },
      timeout: 40000,
    })
    .catch(() => {})
  await page.waitForTimeout(600)
  dragSaid = await noticeText()
}
/**
 * RE-PINNED 2026-08-06 (wave B): a ghost target lands the SAME verb
 * (placeVenue with no grades) that a bare-date drop already exercises
 * elsewhere in this file, and it says so in its own words — "is on {weekend}
 * now, empty" — never "yours to book", which is what a slot or a pool
 * section's backup assertion says. Both are "the drop landed"; which sentence
 * is correct depends on which kind of target the drive actually found.
 */
const landed = /yours to book/.test(dragSaid) || /now, empty\./.test(dragSaid)
ok(
  "dragging a gym onto a target the board is offering lands the same way a tap does",
  landed,
  `dropped on ${dropOn} · before "${beforeDrag}" · after "${dragSaid || "the drop said nothing"}"`
)
if (landed) undos += 1
await gymList.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/2-tray-drop.png` })

/* ---- and a whole SECTION dragged by its header, with a real mouse ---- */
/**
 * The section header IS the handle (owner ruling 2026-08-05, #4; whole-header
 * drag re-affirmed 2026-08-06, #3). Working copy only: whatever lands is undone
 * immediately, and the byte-compare at the end is the proof.
 */
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
const dragPair = await page.evaluate(() => {
  for (const col of document.querySelectorAll("section")) {
    // RE-PINNED 2026-08-06 (wave B, whole-season board): a ghost date carries
    // [data-session-id] too now (see GhostDateRow), so "any other card" has to
    // exclude ghost-date rows explicitly — dragging a whole section onto a
    // 28px dashed row is a different test (the ghost suite above covers the
    // ghost drop path) and would make this one flaky for the wrong reason.
    const cards = [...col.querySelectorAll("[data-session-id]")].filter(
      (c) => c.getAttribute("data-testid") !== "ghost-date"
    )
    const from = cards.find((c) => c.querySelector('[data-testid="section-handle"]'))
    const to = cards.find((c) => c !== from)
    if (!from || !to) continue
    // Both ends on screen together, with room for the line that arming adds
    // above the board: an HTML5 drag does not survive a scroll.
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const mid = (Math.min(a.top, b.top) + Math.max(a.bottom, b.bottom)) / 2
    window.scrollBy(
      0,
      Math.max(mid - window.innerHeight / 2, Math.max(a.bottom, b.bottom) - (window.innerHeight - 200))
    )
    return { from: from.getAttribute("data-session-id"), to: to.getAttribute("data-session-id") }
  }
  return null
})
await page.waitForTimeout(400)
let sectionDragSaid = ""
let sectionDragUndo = ""
if (dragPair) {
  await page
    .locator(`[data-session-id="${dragPair.from}"] [data-testid="section-handle"]`)
    .first()
    .dragTo(page.locator(`[data-session-id="${dragPair.to}"]`), {
      targetPosition: { x: 40, y: 6 },
      timeout: 40000,
    })
    .catch(() => {})
  await page.waitForTimeout(700)
  sectionDragSaid = await noticeText()
  sectionDragUndo = await page
    .locator('[data-testid="undo-last"]')
    .innerText()
    .catch(() => "")
}
ok(
  "a whole gym section is dragged by its header onto another weekend",
  /moved:/.test(sectionDragSaid) && /^Undo: move /.test(sectionDragUndo.replace(/\n/g, " ")),
  `${sectionDragSaid} | ${sectionDragUndo.replace(/\n/g, " ")}`
)
if (/moved:/.test(sectionDragSaid)) {
  await page.locator('[data-testid="undo-last"]').click()
  await page.waitForTimeout(500)
  ok(
    "and one undo puts the whole section back",
    (await page.locator('[data-testid="board-notice"]').innerText()).startsWith("Undone: move")
  )
}

/* ------------- and the other refusal: not enough courts ------------------ */
/**
 * THE ⇄ IS GONE, AND THIS CHECK GOES WITH IT (owner ruling 2026-08-05, #2:
 * "it guesses"). There used to be two checks here — that a grade with somewhere
 * to go wore the arrow, and that eight taps of it stacked a building — and both
 * were about a control that chose the destination itself.
 *
 * What is pinned instead is that the control is really gone: no chip anywhere on
 * the board carries one. The move it did is not gone, and it is checked where it
 * now lives, in the owner's scenario below: pick the chip up, and only the gyms
 * with room offer to take it.
 */
const switchesLeft = await page.locator('[data-testid="switch-gym"]').count()
ok(
  "the guessing switch is retired: no grade chip carries one any more",
  switchesLeft === 0,
  `${switchesLeft} left on the board`
)
let shortCourts = ""
const armGym = async () => {
  if ((await countOf('[data-testid="armed-venue"]')) === 1) return
  await gymCard(trayVenue).locator('[data-testid="gym-grab"]').click()
  await page.waitForTimeout(250)
}
const sections = card(target).locator('[data-testid="weekend-gym-section"][data-role="pool"]')
for (let i = 0; i < (await sections.count()); i++) {
  if (shortCourts) break
  await armGym()
  // The section's own top-left corner, deliberately: its centre is a grade chip
  // and a chip click arms a grade instead of placing the gym.
  await sections.nth(i).click({ position: { x: 6, y: 6 } })
  await page.waitForTimeout(450)
  const said = await noticeText()
  if (/has \d+ of the \d+ courts needed on/.test(said)) {
    shortCourts = said
    break
  }
  if (/You placed it/.test(said)) undos += 1
}

/**
 * VALID TARGETS ONLY, WITH A GYM IN HAND (owner ruling 2026-08-05, #1).
 *
 * The refusal copy is still there for the edge cases, but the board should
 * hardly ever have to say it: a gym that cannot hold a block is not offered the
 * drop. So what is pinned here is the affordance, not the apology — with a gym
 * armed, every weekend says whether it can take it, and tapping one that says it
 * cannot changes nothing at all.
 */
await armGym()
const gymTargets = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-session-id][data-target]")]
  return {
    marked: cards.length,
    yes: cards.filter((c) => c.dataset.target === "1").length,
    no: cards.filter((c) => c.dataset.target === "0").length,
    dimmed: cards.filter(
      (c) => c.dataset.target === "0" && /opacity-60/.test(c.className)
    ).length,
  }
})
ok(
  "with a gym in hand every weekend says whether it could take it, and the ones that could not step back",
  gymTargets.marked > 0 && gymTargets.no === gymTargets.dimmed,
  `${gymTargets.marked} weekends marked · ${gymTargets.yes} can take it · ${gymTargets.no} cannot (${gymTargets.dimmed} dimmed)`
)
const strayOffers = await page.evaluate(() =>
  [...document.querySelectorAll('[data-session-id][data-target="0"]')].reduce(
    (n, c) =>
      n +
      c.querySelectorAll(
        '[data-testid="move-here"], [data-testid="move-section-here"], [data-testid="move-chip-into"], [data-testid="move-section-into"], [data-target="1"]'
      ).length,
    0
  )
)
ok(
  "and a weekend that cannot take it draws no offer of any kind inside it",
  strayOffers === 0,
  `${strayOffers} stray offer(s) on weekends that cannot take the gym`
)
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
if (shortCourts) await page.screenshot({ path: `${SHOTS}/6-courts-short.png` })

// Every placement this drive made, stepped back out again. It changes nothing
// that was saved either way; the byte-compare below is the proof.
for (let i = 0; i < undos; i++) {
  const undo = page.locator('[data-testid="undo-last"]')
  if ((await undo.count()) === 0) break
  await undo.click()
  await page.waitForTimeout(400)
}
ok("the drive steps its own placements back out", undos >= 0, `${undos} placement(s) undone`)

/* ========================================================================= *
 * THE 2026-08-04 WORKSPACE: full-bleed board, a rail that stays put, the
 * weekend at its own altitude, and the four verbs.
 *
 * Still working-copy only. The one verb that writes — adding a weekend — is
 * opened and read and then dismissed WITHOUT creating anything, because this
 * runs on the owner's own season.
 * ========================================================================= */

// Back to a clean board before measuring the new furniture.
await openBoard(page, PLAN_URL)
await page.waitForTimeout(600)

/* ---- 1. the workspace takes the whole screen ---- */
const sidebarShown = await page
  .locator("[data-app-sidebar]")
  .first()
  .isVisible()
  .catch(() => false)
ok("the app sidebar folds away so the board gets the viewport", sidebarShown === false)

const mainOverflow = await page.evaluate(() => {
  const main = document.querySelector("main")
  return main ? getComputedStyle(main).overflowX : ""
})
ok(
  "main clips rather than hides, so the rail can be sticky at all",
  mainOverflow === "clip",
  `overflow-x: ${mainOverflow}`
)

/* ---- 2. the work rail is a persistent side panel ---- */
const rail = page.locator('[data-testid="work-rail"]')
ok("the work rail is on screen as its own column", (await rail.count()) === 1)
const railPos = await rail.evaluate((el) => getComputedStyle(el).position)
ok("the rail is sticky, so the board scrolls under it", railPos === "sticky", railPos)

const boardBox = await page.locator('[data-testid="board-scroll"]').boundingBox()
const railBox = await rail.boundingBox()
ok(
  "the rail sits beside the board, not under it",
  Boolean(boardBox && railBox) && railBox.x > boardBox.x,
  `board x=${Math.round(boardBox?.x ?? -1)} rail x=${Math.round(railBox?.x ?? -1)}`
)

const openCount = await page
  .locator('[data-testid="rail-open-count"]')
  .textContent()
  .catch(() => "")
ok(
  "remaining work is the loudest thing in the rail: a count at the top",
  /\d+ open|all clear/.test((openCount ?? "").trim()),
  (openCount ?? "").trim()
)
ok(
  "the rentals behind the plan are counted in the rail now",
  (await rail.locator('[data-testid="block-summary"]').count()) === 1,
  ((await rail.locator('[data-testid="block-summary"]').textContent()) ?? "").trim()
)

/* ---- 3. a rail row is a jump target ---- */
const jump = page.locator('[data-testid="rail-jump"]').first()
let jumped = ""
if ((await jump.count()) > 0) {
  const wanted = ((await jump.textContent()) ?? "").trim()
  const scrollBefore = await page
    .locator('[data-testid="board-scroll"]')
    .evaluate((el) => el.scrollLeft)
  await jump.click()
  await page.waitForTimeout(900)
  // RE-PINNED 2026-08-05: the ring is an outline with data-flash on it, and a
  // move flashes BOTH ends, so the jump is read off the flag rather than a class.
  const ringed = await page.evaluate(() => {
    const card = document.querySelector("[data-session-id][data-flash]")
    return card ? (card.textContent ?? "").slice(0, 40) : ""
  })
  const scrollAfter = await page
    .locator('[data-testid="board-scroll"]')
    .evaluate((el) => el.scrollLeft)
  jumped = `${wanted} · scrollLeft ${Math.round(scrollBefore)} → ${Math.round(scrollAfter)} · ringed "${ringed}"`
  ok(
    "clicking a rail row brings its weekend into view and rings it",
    ringed.length > 0 && ringed.includes(wanted.split("–")[0].trim()),
    jumped
  )
} else {
  ok("clicking a rail row brings its weekend into view and rings it", false, "no rail row to jump from")
}
await page.screenshot({ path: `${SHOTS}/v3-1-fullbleed-board-and-rail.png`, fullPage: false })

/* ---- 4. the weekend at its own altitude, in planning currency ---- */
/**
 * RE-PINNED 2026-08-05: zoom into a weekend that actually HAS gym time, for the
 * same reason as the section-order check above. A weekend the league does not run
 * has no gym sections and no grade chips, and zooming it proves nothing.
 */
/**
 * RE-PINNED 2026-08-06 (wave B, whole-season board): a ghost date has no
 * `weekend-open` button at all (only real cards do), so the index has to be
 * found WITHIN the `weekend-open` list itself — indexing into the combined
 * cards+ghosts list and then `.nth()`-ing into the shorter opener-only list
 * would drift by however many ghosts sit before the target card.
 */
const zoomIndex = await page.evaluate(() => {
  const openers = [...document.querySelectorAll('[data-testid="weekend-open"]')]
  return openers.findIndex((el) =>
    el.closest("[data-session-id]")?.querySelector('[data-testid="weekend-gym-section"]')
  )
})
await page.locator('[data-testid="weekend-open"]').nth(Math.max(0, zoomIndex)).click()
await page.waitForSelector('[data-testid="weekend-zoom"]', { timeout: 40000 })
await page.waitForTimeout(400)
const zoomText = ((await page.locator('[data-testid="weekend-zoom"]').textContent()) ?? "").replace(
  /\s+/g,
  " "
)
ok("the weekend date opens the weekend at its own altitude", true, zoomText.slice(0, 90))
ok(
  "the zoom is the same planning objects, bigger",
  (await page.locator('[data-testid="zoom-gym-section"]').count()) > 0 &&
    (await page.locator('[data-testid="zoom-grade-chip"]').count()) > 0 &&
    (await page.locator('[data-testid="zoom-fraction"]').count()) === 1,
  `${await page.locator('[data-testid="zoom-gym-section"]').count()} gym section(s) · ${await page
    .locator('[data-testid="zoom-grade-chip"]')
    .count()} grade chip(s)`
)
ok(
  "it carries the weekend's own story, in numbers",
  (await page.locator('[data-testid="zoom-story"]').count()) === 1,
  (((await page.locator('[data-testid="zoom-story"]').textContent()) ?? "").trim() || "").slice(0, 90)
)
ok(
  "it says out loud that fixtures are a later phase",
  /worked out in step 5/.test(zoomText),
  "no team names, no fixtures, no court grid"
)
ok(
  "the rail is still there at this altitude",
  (await page.locator('[data-testid="work-rail"]').count()) === 1
)
await page.screenshot({ path: `${SHOTS}/v3-2-weekend-zoom.png`, fullPage: false })

await page.locator('[data-testid="weekend-zoom-back"]').click()
await page.waitForSelector('[data-testid="board-scroll"]', { timeout: 40000 })
await page.waitForTimeout(500)
ok(
  "back to the season restores the board with the working copy intact",
  (await page.locator('[data-testid="weekend-zoom"]').count()) === 0 &&
    (await page.locator('[data-testid="weekend-gym-section"]').count()) > 0,
  `${await page.locator('[data-testid="weekend-gym-section"]').count()} gym sections back`
)

/* ---- 5. GHOST DATES: the whole season is on the board, unused Saturdays as
         thin dashed rows, no disclosure to open first (wave B, slice B2).
         The drop below lands on a ghost whose SESSION ALREADY EXISTS, never
         one that would need creating: there is no delete-a-weekend API, so a
         truly-new session (a Saturday the season has no row for at all) would
         be a permanent addition this script could not clean up. ---- */
/**
 * RE-PINNED 2026-08-06 (wave B): AddWeekendCard and its four testids
 * (add-weekend-card/-toggle/-option/-list) are deleted along with the
 * disclosure they lived on. Nothing on this board may reintroduce them.
 */
ok(
  "the old add-a-weekend disclosure is gone: no card, no toggle, no option list",
  (await countOf('[data-testid="add-weekend-card"]')) === 0 &&
    (await countOf('[data-testid="add-weekend-toggle"]')) === 0 &&
    (await countOf('[data-testid="add-weekend-option"]')) === 0 &&
    (await countOf('[data-testid="add-weekend-list"]')) === 0
)
const ghostRows = page.locator('[data-testid="ghost-date"]')
const ghostCount = await ghostRows.count()
ok(
  "the board renders a ghost row for every Saturday this plan is not using",
  ghostCount > 0,
  `${ghostCount} ghost date(s)`
)
const ghostHeights = await ghostRows.evaluateAll((els) =>
  els.map((el) => Math.round(el.getBoundingClientRect().height))
)
ok(
  "every ghost row stays thin: 32px or under, never a card's height",
  ghostHeights.length > 0 && ghostHeights.every((h) => h > 0 && h <= 32),
  `heights: ${ghostHeights.join(", ")}`
)

/**
 * A SAFE GHOST TO DROP ON: one whose session already exists (a Saturday the
 * season's own sessions cover but this plan does not run), so the drop below
 * exercises the client-side "lazily becomes a card" path without the OTHER
 * branch — a Saturday with no session at all — which would POST a brand new
 * SeasonSession the season keeps forever. If this world has none, the
 * drop/undo pair is skipped rather than risking a write nothing here (or its
 * cleanup) can take back.
 */
const safeGhostId = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-testid="ghost-date"]')]
  const withSession = rows.find((el) => el.getAttribute("data-session-id"))
  return withSession?.getAttribute("data-session-id") ?? null
})
ok(
  "found a ghost date whose session already exists, safe to drop on",
  Boolean(safeGhostId),
  safeGhostId ?? "every ghost on this board would need a new session created"
)
if (safeGhostId) {
  const ghostRow = page.locator(`[data-testid="ghost-date"][data-session-id="${safeGhostId}"]`)
  await ghostRow.scrollIntoViewIfNeeded()
  await gymCard(trayVenue).locator('[data-testid="gym-grab"]').click()
  await page.waitForTimeout(300)
  ok(
    "with a gym armed, the ghost is a full drop target and offers to put it there",
    (await ghostRow.getAttribute("data-target")) === "1" &&
      (await ghostRow.locator('[data-testid="ghost-offer"]').count()) === 1,
    await ghostRow.locator('[data-testid="ghost-offer"]').innerText().catch(() => "no offer drawn")
  )
  await ghostRow.locator('[data-testid="ghost-offer"]').click()
  await page.waitForTimeout(500)
  // Landing a bare gym (no grades) is the same "empty container" the bare-date
  // drop below makes: a building on the date, nothing playing yet, no booking.
  const container = page.locator(`[data-session-id="${safeGhostId}"] [data-testid="empty-gym"]`)
  const containerText = ((await container.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ")
  ok(
    "the drop lazily turns the ghost into a card and lands the gym on it, empty",
    (await container.count()) === 1 &&
      /empty/.test(containerText) &&
      (await page.locator(`[data-testid="ghost-date"][data-session-id="${safeGhostId}"]`).count()) === 0,
    containerText.trim() || "no container drawn"
  )
  await page.locator('[data-testid="undo-last"]').click()
  await page.waitForTimeout(500)
  ok(
    "one undo reverts the placement and the date reads as a ghost again",
    (await page.locator(`[data-session-id="${safeGhostId}"] [data-testid="empty-gym"]`).count()) === 0 &&
      (await page.locator(`[data-testid="ghost-date"][data-session-id="${safeGhostId}"]`).count()) === 1
  )
}
await page.keyboard.press("Escape")
await page.waitForTimeout(200)

/* ---- 6. CORRECT: "I don't have this" caps a gym for one weekend ---- */
// RE-PINNED 2026-08-06 (owner ruling #5): the "I do not have this" link is a ⋯
// menu on every gym section now, and it holds the hours as well as the courts.
const correction = page.locator('[data-testid="gym-menu"]').first()
ok("every gym section offers the ⋯ menu", (await correction.count()) > 0)
let correctionSaid = ""
let strandedAfterCorrection = 0
if ((await correction.count()) > 0) {
  const beforeSlots = await page.locator('[data-testid="rental-slot-empty"]').count()
  await correction.click()
  await page.waitForSelector('[data-testid="gym-menu-panel"]', { timeout: 40000 })
  const asks = ((await page.locator('[data-testid="gym-menu-panel"]').textContent()) ?? "").replace(
    /\s+/g,
    " "
  )
  ok(
    "it holds this date's hours and this date's courts, with a stepper both ways",
    /Hours this date/.test(asks) &&
      /Courts this date/.test(asks) &&
      (await page.locator('[data-testid="gym-hours-start"]').count()) === 1 &&
      (await page.locator('[data-testid="court-step-down"]').count()) === 1 &&
      (await page.locator('[data-testid="court-step-up"]').count()) === 1,
    asks.slice(0, 110)
  )
  // Wind it all the way down to nothing: the gym said no.
  for (let i = 0; i < 12; i++) {
    const down = page.locator('[data-testid="court-step-down"]')
    if ((await down.count()) === 0 || (await down.isDisabled())) break
    await down.click()
  }
  const value = ((await page.locator('[data-testid="court-step-value"]').textContent()) ?? "").trim()
  await page.locator('[data-testid="court-correction-apply"]').click()
  await page.waitForTimeout(700)
  correctionSaid = await noticeText()
  ok(
    "answering caps that gym for that weekend in the working copy",
    /gives 0 courts|They have nothing|gives \d+ courts/.test(correctionSaid) || value === "0",
    correctionSaid.slice(0, 110)
  )
  strandedAfterCorrection = await page.locator('[data-testid="rental-slot-empty"]').count()
  ok(
    "the games it strands come back as a block that asks where they should go",
    strandedAfterCorrection >= beforeSlots &&
      (await page.locator('[data-testid="stranded-prompt"]').count()) > 0,
    `${beforeSlots} → ${strandedAfterCorrection} empty slot(s), ${await page
      .locator('[data-testid="stranded-prompt"]')
      .count()} prompt(s)`
  )
  const promptText = (
    (await page.locator('[data-testid="stranded-prompt"]').first().textContent()) ?? ""
  ).replace(/\s+/g, " ")
  ok(
    "the prompt offers a gym this weekend, a different weekend, and leaving it open",
    /Where should/.test(promptText) &&
      /A different weekend/.test(promptText) &&
      /Leave it open/.test(promptText),
    promptText.slice(0, 120)
  )
  await page.screenshot({ path: `${SHOTS}/v3-3-correction-and-stranded.png`, fullPage: false })

  // "A different weekend" arms the whole block and lights the lighter ones.
  const other = page.locator('[data-testid="stranded-other-weekend"]').first()
  if ((await other.count()) > 0) {
    await other.click()
    await page.waitForTimeout(350)
    ok(
      "a different weekend arms the whole block and says where it can land",
      (await page.locator('[data-testid="armed-block"]').count()) === 1,
      (((await page.locator('[data-testid="armed-block"]').textContent()) ?? "").trim() || "").slice(0, 100)
    )
    await page.keyboard.press("Escape")
    await page.waitForTimeout(250)
    ok(
      "Escape puts it down again",
      (await page.locator('[data-testid="armed-block"]').count()) === 0
    )
  } else {
    ok("a different weekend arms the whole block and says where it can land", false, "no block to arm")
    ok("Escape puts it down again", false, "no block to arm")
  }

  // And the correction steps back out.
  const undoBtn = page.locator('[data-testid="undo-last"]')
  if ((await undoBtn.count()) > 0) {
    await undoBtn.click()
    await page.waitForTimeout(500)
  }
  ok(
    "one undo puts the courts back",
    (await page.locator('[data-testid="courts-corrected"]').count()) === 0,
    `${await page.locator('[data-testid="rental-slot-empty"]').count()} empty slot(s) after undo`
  )
}

/* ---- 7. BREAK: the split prices both axes before anything is applied ---- */
const split = page.locator('[data-testid="split-menu"]').first()
ok("placed cohorts and rented blocks offer a split", (await split.count()) > 0)
if ((await split.count()) > 0) {
  await split.click()
  await page.waitForSelector('[data-testid="split-menu-panel"]', { timeout: 40000 })
  await page.waitForTimeout(300)
  const gymsAxis = page.locator('[data-testid="split-axis-gyms"]')
  const weekAxis = page.locator('[data-testid="split-axis-weekends"]')
  ok(
    "it offers both axes: across gyms this weekend, and across two weekends",
    (await gymsAxis.count()) === 1 && (await weekAxis.count()) === 1,
    `${((await gymsAxis.textContent()) ?? "").replace(/\s+/g, " ").slice(0, 60)}`
  )
  const gymPrice = await page
    .locator('[data-testid="split-price-gyms"]')
    .textContent()
    .catch(() => null)
  const weekPrice = await page
    .locator('[data-testid="split-price-weekends"]')
    .textContent()
    .catch(() => null)
  const priced = [gymPrice, weekPrice].filter(Boolean)
  const gymsEnabled = await gymsAxis.getAttribute("data-enabled")
  const weekEnabled = await weekAxis.getAttribute("data-enabled")
  /**
   * RE-PINNED 2026-08-05: a price exists only for an axis that can actually be
   * taken. On a weekend where neither can be — one grade, or no second building
   * with room — there is nothing to price, and the check below is the one that
   * matters: it has to say WHY instead of going quiet.
   */
  const anyTakeable = gymsEnabled === "true" || weekEnabled === "true"
  ok(
    "an axis that can be taken is priced in buildings, court-days and weekends",
    anyTakeable
      ? priced.length > 0 && priced.every((p) => /more|fewer|Costs nothing/.test(p))
      : priced.length === 0,
    anyTakeable
      ? priced.map((p) => (p ?? "").trim()).join("  |  ")
      : "neither axis can be taken on this weekend, so there is nothing to price"
  )
  const disabledReason = await (gymsEnabled === "false" ? gymsAxis : weekAxis).textContent()
  ok(
    "an axis that cannot be taken says why instead of going quiet",
    gymsEnabled === "true" ||
      weekEnabled === "true" ||
      /one grade|no second building|no other weekend/i.test(disabledReason ?? ""),
    `gyms=${gymsEnabled} weekends=${weekEnabled}`
  )
  await page.screenshot({ path: `${SHOTS}/v3-4-split-pricing.png`, fullPage: false })
  await page.keyboard.press("Escape")
  await page.waitForTimeout(250)
}

/* ---- 8. a pool gym nobody has asked is a BACKUP, and it is usable ---- */
/**
 * RE-PINNED 2026-08-05 (owner ruling #1, replacing the 2026-08-04 reading of the
 * Haber case). It used to sit here disabled saying "availability unknown, ask
 * them", which made the tray read as "you have one gym to rent" when the truth
 * was "you have two and you have not phoned one of them". It is a legitimate
 * overflow backup: enabled, tagged, and placeable.
 */
const gymRows = page.locator('[data-testid="gym-card"]')
const trayCount = await gymRows.count()
const backupRows = page.locator('[data-testid="gym-card"][data-availability="backup"]')
const backupCount = await backupRows.count()
ok(
  "a pool gym with no attached weekend still appears in the gym list",
  trayCount > 0 && backupCount > 0,
  `${trayCount} gym(s), ${backupCount} of them a backup nobody has phoned`
)
/**
 * RE-PINNED 2026-08-06 (owner ruling #1): the colour key and the tray are ONE
 * row, so the backup gym is named once, in colour, with its tag on it. The
 * separate legend that used to carry the same tag is gone.
 */
const listNames = await gymList.innerText().catch(() => "")
ok(
  "the one gym list names the backup gyms, tagged for what they are",
  (await countOf('[data-testid="gym-backup-tag"]')) === backupCount && backupCount > 0,
  `${await countOf('[data-testid="gym-backup-tag"]')} tagged · list reads "${listNames.replace(/\n/g, " · ")}"`
)
if (backupCount > 0) {
  const row = backupRows.first()
  const backupVenue = await row.getAttribute("data-venue-id")
  const said = ((await row.textContent()) ?? "").replace(/\s+/g, " ")
  ok(
    "it wears a quiet tag saying what it is, without claiming any weekend",
    /backup/.test(said) && /on 0 weekends/.test(said),
    said.trim()
  )
  ok(
    "and it CAN be picked up, because dropping it is the operator asserting they have it",
    (await row.getAttribute("draggable")) === "true" &&
      (await row.locator('[data-testid="gym-grab"]').count()) === 1
  )
  await row.locator('[data-testid="gym-grab"]').click()
  await page.waitForTimeout(300)
  ok(
    "tapping the backup gym's grip arms it like any other",
    (await countOf('[data-testid="armed-venue"]')) === 1 &&
      (await row.locator('[data-testid="gym-grab"]').getAttribute("aria-pressed")) === "true",
    await page.locator('[data-testid="armed-venue"]').innerText().catch(() => "")
  )
  // Somewhere with games that need a building: the empty slot, else any rented
  // section. Whatever it lands on is undone straight afterwards.
  const spot = (await countOf('[data-testid="rental-slot-empty"]'))
    ? page.locator('[data-testid="rental-slot-empty"]').first()
    : page.locator('[data-testid="weekend-gym-section"][data-role="pool"]').first()
  if ((await spot.count()) > 0) {
    const holder = await spot.evaluate((el) =>
      el.closest("[data-session-id]")?.getAttribute("data-session-id")
    )
    await spot.click({ position: { x: 6, y: 6 } })
    await page.waitForTimeout(500)
    const said2 = await noticeText()
    const madeIt =
      (await countOf(
        `[data-session-id="${holder}"] [data-testid="weekend-gym-section"][data-venue-id="${backupVenue}"]`
      )) === 1
    ok(
      "placing it turns it into a rented block on that weekend, in the operator's own words",
      madeIt && /yours to book/.test(said2),
      said2 || "the placement said nothing"
    )
    await page.screenshot({ path: `${SHOTS}/v3-5-tray-backup-placed.png`, fullPage: false })
    if (madeIt) {
      await page.locator('[data-testid="undo-last"]').click()
      await page.waitForTimeout(450)
      ok(
        "and the backup goes back to being a backup on one undo",
        (await countOf(
          `[data-session-id="${holder}"] [data-testid="weekend-gym-section"][data-venue-id="${backupVenue}"]`
        )) === 0 &&
          (await countOf(
            `[data-testid="gym-card"][data-venue-id="${backupVenue}"][data-availability="backup"]`
          )) === 1
      )
    }
  }
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
}
await page.screenshot({ path: `${SHOTS}/v3-5-tray-backup-gym.png`, fullPage: false })

/* ========================================================================= *
 * 9. THE OWNER'S OWN SCENARIO, on a plan of its own (rulings 2026-08-05 #1–#4).
 *
 * Two grades in the home gym, five in the rented one — the board he was looking
 * at when the ⇄ affordance vanished. It runs on a THROWAWAY PLAN so the season's
 * calendar is never touched, and the plan is deleted at the end of the section.
 * Nothing here is ever saved: every move lives on the working copy.
 * ========================================================================= */
let probeId = null
try {
  const activePlan = (await listPlans()).find((p) => p.isActive)
  const activeDoc = activePlan
    ? (await page.request
        .get(`${BASE}/api/seasons/${SEASON}/plans/${activePlan.id}`)
        .then((r) => r.json())
        .catch(() => null))?.plan
    : null
  const world = activeDoc?.settings?.state ?? null
  const homeId = (world?.gyms ?? []).find((g) => g.role === "home")?.venueId ?? null
  /** A month with two weekends that have a rented gym and one that has only the
   *  home gym: the successful group move needs the first, the partial-fit refusal
   *  needs the last. */
  let scene = null
  for (const win of world?.windows ?? []) {
    const live = (win.weekends ?? []).filter(
      (w) => w.chosen !== false && (w.venues ?? []).length > 0
    )
    const withPool = live.filter((w) => (w.venues ?? []).some((v) => v.venueId !== homeId))
    const homeOnly = live.filter((w) => !withPool.includes(w))
    if (withPool.length >= 2 && homeOnly.length >= 1) {
      scene = { month: win.label, at: withPool[0], other: withPool[1], tight: homeOnly[0] }
      break
    }
  }
  const games = (u) => Math.ceil((u.teams * (scene?.at?.targetGamesPerTeam ?? 2)) / 2)
  const homeVenue = (scene?.at?.venues ?? []).find((v) => v.venueId === homeId)
  const poolVenue = (scene?.at?.venues ?? []).find((v) => v.venueId !== homeId)
  const units = (world?.units ?? [])
    .filter((u) => (u.included ?? u.teams > 0) && u.teams > 0)
    .sort((a, b) => games(b) - games(a))
  /** Two grades that fill the home gym, five that fill the rented one. */
  const homeKeys = []
  const poolKeys = []
  if (scene && homeVenue && poolVenue) {
    let homeLeft = homeVenue.capacityGames
    let poolLeft = poolVenue.capacityGames
    for (const u of units) {
      if (homeKeys.length < 2 && games(u) <= homeLeft) {
        homeKeys.push(u.key)
        homeLeft -= games(u)
        continue
      }
      if (poolKeys.length < 5 && games(u) <= poolLeft) {
        poolKeys.push(u.key)
        poolLeft -= games(u)
      }
    }
  }
  ok(
    "built the owner's scenario: two grades at home, five in the rented gym",
    Boolean(scene) && homeKeys.length === 2 && poolKeys.length === 5,
    scene
      ? `${scene.month}: ${scene.at.label} · home ${homeKeys.length} · pool ${poolKeys.length}`
      : "no month has two rented weekends and a home-only one"
  )
  if (!scene || homeKeys.length !== 2 || poolKeys.length !== 5) throw new Error("scenario")

  const made = await page.request
    .post(`${BASE}/api/seasons/${SEASON}/plans`, {
      data: {
        name: `QA board probe ${Date.now()}`,
        source: "manual",
        assignment: { [scene.at.sessionId]: [...homeKeys, ...poolKeys] },
        venues: {
          [scene.at.sessionId]: Object.fromEntries([
            ...homeKeys.map((k) => [k, homeId]),
            ...poolKeys.map((k) => [k, poolVenue.venueId]),
          ]),
        },
        settings: { state: world },
      },
    })
    .then((r) => r.json())
    .catch(() => null)
  probeId = made?.plan?.id ?? null
  ok("the throwaway plan saved, with the season's own world in it", Boolean(probeId))
  if (!probeId) throw new Error("probe plan")

  await page.goto(PLAN_URL)
  await page.waitForSelector('[data-testid="plan-empty"]', { timeout: 120000 })
  await page.locator('[data-testid="plan-open"]').click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 40000 })
  await page.locator(`[data-testid="plan-option"][data-plan-id="${probeId}"]`).click()
  await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 120000 })
  await page.waitForTimeout(900)

  const at = card(scene.at.sessionId)
  const chipsIn = (venueId) =>
    at
      .locator(
        `[data-testid="weekend-gym-section"][data-venue-id="${venueId}"] [data-testid="grade-chip"]`
      )
      .count()
  ok(
    "the board draws it: two chips under the gym they own, five under the one they rent",
    (await chipsIn(homeId)) === 2 && (await chipsIn(poolVenue.venueId)) === 5,
    `${await chipsIn(homeId)} at home · ${await chipsIn(poolVenue.venueId)} rented`
  )
  await at.scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${SHOTS}/9-1-two-home-five-pool.png` })

  /**
   * RULING #5: THE RAIL SPEAKS THE NEW ECONOMICS.
   *
   * This plan is the owner's own case in miniature — one weekend carrying the
   * whole month, full and not over, with the month's other chosen weekends
   * sitting empty. Under compact-first that is the plan working, so the rail must
   * offer nothing to press. It used to offer to put the empty weekends to work,
   * which is one more Saturday at 100,000 on the price list.
   */
  const railIdeas = await page.locator('[data-testid="rail-idea"]').count()
  const railProblems = await page.locator('[data-testid="rail-problem"]').count()
  const moreIdeas = await page.locator('[data-testid="more-ideas"]').count()
  ok(
    "a full-but-not-over weekend with empty weekends beside it gives the rail nothing to press",
    railIdeas === 0 && moreIdeas === 0,
    `${railIdeas} move row(s) · ${railProblems} problem(s) · ${moreIdeas} "more ideas" button(s)`
  )
  await page.locator('[data-testid="work-rail"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${SHOTS}/9-1a-rail-nothing-to-press.png` })
  await at.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)

  /* ---- ruling #4: the grade highlight, which changes nothing under it ---- */
  const filterStrip = page.locator('[data-testid="grade-filter"]')
  ok("a highlight strip sits above the board, one chip per grade", (await filterStrip.count()) === 1)
  const pickKey = homeKeys[0]
  const chipsBefore = await page.locator('[data-testid="grade-chip"]').count()
  await page.locator(`[data-testid="grade-filter-chip"][data-unit="${pickKey}"]`).click()
  await page.waitForTimeout(350)
  const lens = await page.evaluate((key) => {
    const chips = [...document.querySelectorAll("[data-highlight][data-unit]")]
    const cards = [...document.querySelectorAll("[data-session-id][data-highlight]")]
    return {
      on: chips.filter((c) => c.dataset.highlight === "on").length,
      off: chips.filter((c) => c.dataset.highlight === "off").length,
      dimmed: chips.filter(
        (c) => c.dataset.highlight === "off" && /opacity-\[0\.35\]/.test(c.className)
      ).length,
      picked: chips.filter((c) => c.dataset.unit === key && c.dataset.highlight === "on").length,
      cardsWith: cards.filter((c) => c.dataset.highlight === "1").length,
      cardsWithout: cards.filter((c) => c.dataset.highlight === "0").length,
      showing: (
        document.querySelector('[data-testid="grade-filter-showing"]')?.textContent ?? ""
      ).trim(),
      chips: document.querySelectorAll('[data-testid="grade-chip"]').length,
    }
  }, pickKey)
  ok(
    "picking a grade keeps it at full strength and drops everything else back",
    lens.picked > 0 && lens.off > 0 && lens.off === lens.dimmed,
    `${lens.on} highlighted · ${lens.off} dimmed to 35% (${lens.dimmed} carrying the class)`
  )
  ok(
    "the weekends that grade plays are the ones the board emphasises",
    lens.cardsWith > 0 && lens.cardsWithout > 0,
    `${lens.cardsWith} weekend(s) with it · ${lens.cardsWithout} without`
  )
  ok(
    "and the strip says out loud which grades are showing",
    /^Showing /.test(lens.showing) && lens.showing.length > "Showing ".length,
    lens.showing
  )
  ok(
    "the highlight is a lens: not one chip moved and nothing became unsaved",
    lens.chips === chipsBefore,
    `${chipsBefore} chips before · ${lens.chips} after`
  )
  await page.screenshot({ path: `${SHOTS}/9-1b-grade-highlight.png` })
  await page.locator('[data-testid="grade-filter-clear"]').click()
  await page.waitForTimeout(300)
  const lensLeft = () =>
    page.locator('[data-testid="board-scroll"] [data-highlight]').count()
  ok(
    "Clear puts the whole board back",
    (await lensLeft()) === 0 &&
      (await page.locator('[data-testid="grade-filter-clear"]').count()) === 0
  )
  // And Escape does the same, from anywhere.
  await page.locator(`[data-testid="grade-filter-chip"][data-unit="${pickKey}"]`).click()
  await page.waitForTimeout(250)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  ok("so does Escape, wherever the operator's hands are", (await lensLeft()) === 0)

  /**
   * RULING #2, RE-PINNED 2026-08-05: THE OPERATOR NAMES THE GYM.
   *
   * The ⇄ used to sit on the chip and pick the destination itself. It is gone.
   * The same move is now: pick the chip up, and the buildings that could really
   * hold it offer to take it (ruling #1). This walks that path end to end.
   */
  /** What the board says while one grade is in the operator's hand. */
  const heldReport = () =>
    page.evaluate(() => {
      const offers = [...document.querySelectorAll('[data-testid="move-chip-into"]')]
      const cards = [...document.querySelectorAll("[data-session-id][data-target]")]
      return {
        offers: offers.length,
        venues: offers.map((o) => o.getAttribute("data-venue-id")),
        // Every offer has to sit inside a section the board itself calls a target.
        inTargets: offers.filter((o) => o.closest('[data-target="1"]')).length,
        // And no weekend the board calls impossible may carry one, of any kind.
        inDead: cards
          .filter((c) => c.dataset.target === "0")
          .reduce(
            (n, c) =>
              n +
              c.querySelectorAll(
                '[data-testid="move-chip-into"], [data-testid="move-here"], [data-testid="move-section-into"], [data-testid="move-section-here"]'
              ).length,
            0
          ),
        marked: cards.length,
        dead: cards.filter((c) => c.dataset.target === "0").length,
      }
    })

  // Any grade on this weekend will do: the point is that SOME building offers to
  // take it and no impossible one does.
  const allChips = at.locator('[data-testid="grade-chip"]')
  let movedUnit = null
  let held = null
  for (let i = 0; i < (await allChips.count()); i++) {
    const chip = allChips.nth(i)
    await chip.locator("button").first().click()
    await page.waitForTimeout(300)
    const report = await heldReport()
    if (report.offers > 0) {
      movedUnit = await chip.getAttribute("data-unit")
      held = report
      break
    }
    held = report
    await page.keyboard.press("Escape")
    await page.waitForTimeout(150)
  }
  ok(
    "arming a grade says so out loud, the way every other held thing does",
    (await page.locator("p", { hasText: "is ready to move" }).count()) > 0
  )
  ok(
    "with a grade in hand only the gyms with room offer to take it, and nowhere impossible does",
    Boolean(held) && held.offers > 0 && held.inTargets === held.offers && held.inDead === 0,
    held
      ? `${held.offers} gym(s) offered · ${held.marked} weekends marked, ${held.dead} of them impossible · ${held.inDead} stray offers`
      : "no chip could be armed"
  )
  await page.screenshot({ path: `${SHOTS}/9-2a-chip-armed-valid-targets.png` })
  const intoVenue = held?.venues?.[0]
  await page
    .locator(`[data-testid="move-chip-into"][data-venue-id="${intoVenue}"]`)
    .first()
    .click()
  await page.waitForTimeout(400)
  const switchSaid = await noticeText()
  const flashed = await page
    .locator(`[data-testid="grade-chip"][data-unit="${movedUnit}"][data-flash="1"]`)
    .count()
  const ghostsNow = await at.locator('[data-testid="move-ghost"]').count()
  ok(
    "the chip that moved wears the mark, and the gym it left keeps a ghost of it",
    flashed === 1 && ghostsNow > 0,
    `${flashed} flashed chip · ${ghostsNow} ghost(s) · "${switchSaid}"`
  )
  ok(
    "the notice names the grade and where it went",
    /moved/.test(switchSaid) && switchSaid.length > 0,
    switchSaid
  )
  await page.screenshot({ path: `${SHOTS}/9-2-moved-chip-flash-and-ghost.png` })

  /* ---- ruling #3: the floating undo, even four months down the page ---- */
  const floatBox = await page.evaluate(() => {
    const pill = document.querySelector('[data-testid="undo-float"]')
    if (!pill) return null
    const box = pill.getBoundingClientRect()
    const rail = document.querySelector('[data-testid="work-rail"]')?.getBoundingClientRect()
    return {
      text: (pill.textContent ?? "").replace(/\s+/g, " ").trim(),
      fixed: getComputedStyle(pill).position === "fixed",
      inView: box.bottom <= window.innerHeight + 1 && box.right <= window.innerWidth + 1,
      tall: Math.round(box.height),
      clearsRail: !rail || box.right <= rail.left + 1 || box.top >= rail.bottom - 1,
    }
  })
  ok(
    "a floating undo rides the corner of the window as soon as there is a step to take",
    Boolean(floatBox) && floatBox.fixed && floatBox.inView && floatBox.tall >= 44,
    floatBox ? `"${floatBox.text}" · ${floatBox.tall}px tall` : "no floating undo"
  )
  ok(
    "it says the same thing the header button says, and never sits on the work rail",
    Boolean(floatBox) && /^Undo: /.test(floatBox.text) && floatBox.clearsRail,
    floatBox ? `"${floatBox.text}" · clears rail: ${floatBox.clearsRail}` : "no floating undo"
  )
  // And it is still there once the operator has scrolled away from the header.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  const scrolled = await page.evaluate(() => {
    const pill = document.querySelector('[data-testid="undo-float"]')
    const header = document.querySelector('[data-testid="undo-last"]')
    const box = pill?.getBoundingClientRect()
    return {
      pill: Boolean(pill) && box.bottom <= window.innerHeight + 1,
      headerOffScreen: !header || header.getBoundingClientRect().bottom < 0,
      y: Math.round(window.scrollY),
    }
  })
  ok(
    "and it is still in the corner after scrolling the header off the top of the page",
    scrolled.pill,
    `scrolled to ${scrolled.y}px · header off screen: ${scrolled.headerOffScreen}`
  )
  await page.screenshot({ path: `${SHOTS}/9-2b-undo-float-scrolled.png` })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  /**
   * NO TIMER ON EITHER MARK (owner re-ruling 2026-08-05, #2). The first pass
   * faded the chip's ring at 1.6s and the ghost at 4s and the owner could not
   * read either in time. They now stand until the operator touches the board
   * again, or until Undo takes the move back.
   */
  await page.waitForTimeout(5000)
  const stillGhosted = await at.locator('[data-testid="move-ghost"]').count()
  const stillRinged = await at
    .locator(`[data-testid="grade-chip"][data-unit="${movedUnit}"][data-flash="1"]`)
    .count()
  ok(
    "five seconds of doing nothing, and the ghost and the ring are both still there",
    stillGhosted > 0 && stillRinged === 1,
    `${stillGhosted} ghost(s) · ${stillRinged} ringed chip`
  )
  const ghostSays = (
    (await at.locator('[data-testid="move-ghost"]').first().textContent()) ?? ""
  )
    .replace(/\s+/g, " ")
    .trim()
  ok(
    "the origin says where the grade WENT, not only that it left",
    /^.+ moved to \S/.test(ghostSays),
    ghostSays
  )
  // Any interaction with the board is what ends them: a click on the glyph
  // legend touches nothing and moves nothing, and it is still an interaction.
  await page.locator('[data-testid="board-legend"]').click()
  await page.waitForTimeout(350)
  ok(
    "one click elsewhere on the board clears both, with nothing else changed",
    (await at.locator('[data-testid="move-ghost"]').count()) === 0 &&
      (await at.locator('[data-testid="grade-chip"][data-flash="1"]').count()) === 0
  )
  await page.locator('[data-testid="undo-last"]').click()
  await page.waitForTimeout(500)
  ok(
    "one undo puts the grade, its gym and the assertion back",
    (await chipsIn(poolVenue.venueId)) === 5,
    `${await chipsIn(poolVenue.venueId)} back in the rented gym`
  )

  /* ---- ruling #4: the whole section moves as one action ---- */
  const grip = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="section-grip"]`
  )
  ok("a gym section has a grip you can pick it up by", (await grip.count()) === 1)
  await grip.click()
  await page.waitForTimeout(300)
  const armedLine = await page
    .locator('[data-testid="armed-section"]')
    .innerText()
    .catch(() => "")
  ok(
    "arming it says which grades will travel, and from where",
    armedLine.length > 0 && /will move together/.test(armedLine.replace(/\n/g, " ")),
    armedLine.replace(/\n/g, " ")
  )
  await page.screenshot({ path: `${SHOTS}/9-3-section-armed.png` })

  /**
   * RE-PINNED 2026-08-06 (owner ruling #3): ONE CAPACITY RULE FOR THE BOARD.
   *
   * This used to pin that a home-only weekend was never a destination for a whole
   * section, because a section was measured against the gyms the plan already had
   * while a single chip was measured against those PLUS the backups it could
   * assert. Two readings of the same weekend, and the board could offer a grade a
   * destination it would then refuse the grade's own section.
   *
   * Both read the same number now, so what is pinned is the AGREEMENT: the offer
   * is drawn exactly when the arithmetic says the group fits, and pressing it
   * lands the move, asserting whatever gym it had to.
   */
  const tightState = await page.evaluate((sessionId) => {
    const el = document.querySelector(`[data-session-id="${sessionId}"]`)
    return {
      target: el?.getAttribute("data-target") ?? null,
      offers: el?.querySelectorAll('[data-testid="move-section-here"]').length ?? -1,
      dimmed: /opacity-60/.test(el?.className ?? ""),
    }
  }, scene.tight.sessionId)
  ok(
    "the offer and the refusal read the same number: a weekend is offered exactly when it fits",
    (tightState.target === "1") === (tightState.offers === 1) &&
      (tightState.target === "1" ? !tightState.dimmed : tightState.dimmed),
    `data-target=${tightState.target} · ${tightState.offers} offer(s) · dimmed: ${tightState.dimmed}`
  )
  if (tightState.target === "1") {
    // And taking it really lands, asserting the building it had to use.
    await card(scene.tight.sessionId).locator('[data-testid="move-section-here"]').click()
    await page.waitForTimeout(600)
    const assertedSaid = await noticeText()
    const landedTight = await page.evaluate(
      ({ sessionId, keys }) => {
        const el = document.querySelector(`[data-session-id="${sessionId}"]`)
        const here = [...(el?.querySelectorAll('[data-testid="grade-chip"]') ?? [])].map((c) =>
          c.getAttribute("data-unit")
        )
        return keys.filter((k) => here.includes(k)).length
      },
      { sessionId: scene.tight.sessionId, keys: poolKeys }
    )
    ok(
      "a section can land on a weekend whose room is a gym the operator asserts, and it says so",
      landedTight === 5 && /yours to book/.test(assertedSaid),
      `${landedTight} of 5 · "${assertedSaid}"`
    )
    await page.locator('[data-testid="undo-last"]').click()
    await page.waitForTimeout(550)
    // Undo puts everything down, so the section goes back in hand for the
    // cross-weekend move below.
    await grip.click()
    await page.waitForTimeout(300)
  } else {
    ok(
      "a section can land on a weekend whose room is a gym the operator asserts, and it says so",
      (await chipsIn(poolVenue.venueId)) === 5,
      "this weekend has no room at all, backups included, so there was nothing to offer"
    )
  }
  ok(
    "and nothing moved by looking at it",
    (await chipsIn(poolVenue.venueId)) === 5,
    `${await chipsIn(poolVenue.venueId)} still in the rented gym`
  )
  await page.screenshot({ path: `${SHOTS}/9-4-section-invalid-target.png` })

  // The other rented weekend of the month has room for all five: a CROSS-WEEKEND
  // section move, which is the whole point of picking a section up.
  ok(
    "the roomy weekend of the same month is a different weekend, and it is marked a target",
    scene.other.sessionId !== scene.at.sessionId &&
      (await card(scene.other.sessionId).getAttribute("data-target")) === "1",
    `${scene.at.label} → ${scene.other.label}`
  )
  const roomyButton = card(scene.other.sessionId).locator('[data-testid="move-section-here"]')
  if ((await roomyButton.count()) === 0) {
    await grip.click()
    await page.waitForTimeout(250)
  }
  await card(scene.other.sessionId).locator('[data-testid="move-section-here"]').click()
  await page.waitForTimeout(600)
  const groupSaid = await noticeText()
  const undoLabel = await page
    .locator('[data-testid="undo-last"]')
    .innerText()
    .catch(() => "")
  const landed = await page.evaluate(
    ({ sessionId, keys }) => {
      const card = document.querySelector(`[data-session-id="${sessionId}"]`)
      const here = [...(card?.querySelectorAll('[data-testid="grade-chip"]') ?? [])].map((c) =>
        c.getAttribute("data-unit")
      )
      return keys.filter((k) => here.includes(k)).length
    },
    { sessionId: scene.other.sessionId, keys: poolKeys }
  )
  ok(
    "every grade in the section lands on the weekend it was sent to",
    landed === 5,
    `${landed} of 5 · "${groupSaid}"`
  )
  ok(
    "and it is ONE step on the undo stack, labelled in grades",
    /Undo: move 5 grades to /.test(undoLabel.replace(/\n/g, " ")),
    undoLabel.replace(/\n/g, " ")
  )
  const groupFlash = await card(scene.other.sessionId)
    .locator('[data-testid="grade-chip"][data-flash="1"]')
    .count()
  const groupGhosts = await at.locator('[data-testid="move-ghost"]').count()
  ok(
    "the five that moved flash, and the gym they left keeps their ghosts",
    groupFlash === 5 && groupGhosts === 5,
    `${groupFlash} flashed · ${groupGhosts} ghosts left behind`
  )
  await page.screenshot({ path: `${SHOTS}/9-5-section-moved.png` })
  await page.locator('[data-testid="undo-last"]').click()
  await page.waitForTimeout(550)
  ok(
    "one undo brings the whole section back",
    (await chipsIn(poolVenue.venueId)) === 5,
    `${await chipsIn(poolVenue.venueId)} back in the rented gym`
  )

  /* ---- ruling #3: the same verb, with its name on it ---- */
  /**
   * RE-PINNED 2026-08-06 (the move/dots restructure). "Move all…" is gone: it
   * named a scope rather than a verb, and it hid the two places a block can
   * actually go. Every gym section carries a MOVE button now, with exactly two
   * rows behind it — another gym this weekend, or another weekend — and the
   * second one arms the section exactly the way the grip does.
   */
  const moveAll = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="move-menu-trigger"]`
  )
  ok(
    "every gym section carries an explicit Move button beside its other verbs",
    (await moveAll.count()) === 1,
    ((await moveAll.first().textContent().catch(() => "")) ?? "").trim()
  )
  /** Open Move and take the "another weekend" row, which is the arming path. */
  const armViaMove = async () => {
    await moveAll.click()
    await page.waitForTimeout(250)
    await page.locator('[data-testid="move-to-weekend"]').first().click()
    await page.waitForTimeout(350)
  }
  await armViaMove()
  ok(
    "its 'to another weekend' row arms the section exactly the way the grip does",
    (await page.locator('[data-testid="armed-section"]').count()) === 1 &&
      (await moveAll.getAttribute("aria-pressed")) === "true",
    (((await page.locator('[data-testid="armed-section"]').textContent()) ?? "").trim() || "").slice(0, 100)
  )
  await page.screenshot({ path: `${SHOTS}/9-6-move-all-armed.png` })
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  ok(
    "Escape puts it down again, the same as the grip",
    (await page.locator('[data-testid="armed-section"]').count()) === 0
  )
  await armViaMove()
  await page.waitForTimeout(350)
  const buttonDest = card(scene.other.sessionId).locator('[data-testid="move-section-here"]')
  ok("the destinations light up for it too", (await buttonDest.count()) === 1)
  await buttonDest.click()
  await page.waitForTimeout(600)
  const buttonSaid = await noticeText()
  const buttonLanded = await page.evaluate(
    ({ sessionId, keys }) => {
      const card = document.querySelector(`[data-session-id="${sessionId}"]`)
      const here = [...(card?.querySelectorAll('[data-testid="grade-chip"]') ?? [])].map((c) =>
        c.getAttribute("data-unit")
      )
      return keys.filter((k) => here.includes(k)).length
    },
    { sessionId: scene.other.sessionId, keys: poolKeys }
  )
  ok(
    "and the whole group lands where the button sent it",
    buttonLanded === 5 && /moved:/.test(buttonSaid),
    `${buttonLanded} of 5 · "${buttonSaid}"`
  )
  await page.locator('[data-testid="undo-last"]').click()
  await page.waitForTimeout(550)
  ok(
    "one undo brings it back from the button path as well",
    (await chipsIn(poolVenue.venueId)) === 5,
    `${await chipsIn(poolVenue.venueId)} back in the rented gym`
  )

  /**
   * THE MOUSE PATH IS CHECKED ON THE SEASON'S OWN BOARD (re-pinned 2026-08-06),
   * a few hundred lines above: Playwright's HTML5 drag interception is a race
   * against the page's own input round trip, and on a plan-scoped board opened
   * through the picker it loses that race and hangs — the same drag lands by hand
   * and lands under `openBoard`. What is checked here is everything the mouse
   * path shares with the tap path, on the plan that makes the case interesting.
   */

  /**
   * Section to section, same weekend: the group changes BUILDING as one action.
   *
   * RE-PINNED 2026-08-05 (owner ruling #1): the offer is drawn on the destination
   * gym only where the room is really there, so what is pinned is the AGREEMENT
   * between the two — a section marked a target carries the offer, and one that
   * is not carries nothing. Both answers are the ruling.
   */
  const homeGrip = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${homeId}"] [data-testid="section-grip"]`
  )
  await homeGrip.click()
  await page.waitForTimeout(250)
  const poolSection = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"]`
  )
  const poolIsTarget = (await poolSection.getAttribute("data-target")) === "1"
  const intoPool = poolSection.locator('[data-testid="move-section-into"]')
  ok(
    "the destination gym writes the offer down exactly when it can take the group, and never otherwise",
    (await intoPool.count()) === (poolIsTarget ? 1 : 0),
    `rented gym is ${poolIsTarget ? "a target" : "not a target"} · ${await intoPool.count()} offer(s)`
  )
  if (poolIsTarget) {
    await intoPool.click()
    await page.waitForTimeout(500)
    const sameSaid = await noticeText()
    const sameUndo = await page
      .locator('[data-testid="undo-last"]')
      .innerText()
      .catch(() => "")
    ok(
      "a section dropped on another gym on the same weekend moves the group into it",
      /moved:/.test(sameSaid),
      `${sameSaid} | ${sameUndo.replace(/\n/g, " ")}`
    )
    if (/moved:/.test(sameSaid)) {
      ok(
        "labelled by the gym it went to, as one undo",
        /Undo: move 2 grades to /.test(sameUndo.replace(/\n/g, " ")),
        sameUndo.replace(/\n/g, " ")
      )
      await page.locator('[data-testid="undo-last"]').click()
      await page.waitForTimeout(450)
    }
  } else {
    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)
  }

  /* ========================================================================= *
   * 10. THE 2026-08-06 BOARD: one gym list, drop anywhere, one capacity rule,
   * the gym lens, and the two-way ⋯ menu. Still the throwaway plan, still the
   * working copy, and every placement is stepped back out.
   * ========================================================================= */

  /** The season's whole ask, as the sheet says it out loud. */
  const askSeason = async () =>
    (((await page.locator('[data-testid="ask-season"]').innerText().catch(() => "")) ?? "").trim())

  /* ---- ruling #2: a gym dropped on a date with nothing on it at all ---- */
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
  const emptyDate = scene.other.sessionId
  const askBefore = await askSeason()
  const blocksBefore = await summaryText()
  await gymCard(poolVenue.venueId).locator('[data-testid="gym-grab"]').click()
  await page.waitForTimeout(350)
  const bareOffer = card(emptyDate).locator('[data-testid="place-gym-here"]')
  ok(
    "a date with no games on it is a target for a gym in hand, and says so",
    (await bareOffer.count()) === 1 &&
      (await card(emptyDate).getAttribute("data-target")) === "1",
    ((await bareOffer.textContent().catch(() => "")) ?? "").trim() || "no offer drawn"
  )
  let placedEmpty = false
  if ((await bareOffer.count()) === 1) {
    await bareOffer.click()
    await page.waitForTimeout(550)
    const container = card(emptyDate).locator('[data-testid="empty-gym"]')
    const containerText = ((await container.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ")
    placedEmpty = (await container.count()) === 1
    ok(
      "it lands an EMPTY gym container: a real building on that date, labelled empty",
      placedEmpty && /empty/.test(containerText) && /drop grades here/.test(containerText),
      containerText.trim() || "no container drawn"
    )
    ok(
      "placing a building is not a booking: the ask does not move by one court-day",
      (await askSeason()) === askBefore,
      `${askBefore}  →  ${await askSeason()}`
    )
    await page.screenshot({ path: `${SHOTS}/10-1-empty-gym-container.png`, fullPage: false })

    /* ---- and it is a real target: a chip lands in it, and THEN it costs ---- */
    const chipIn = at
      .locator(
        `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="grade-chip"]`
      )
      .first()
    await chipIn.locator("button").first().click()
    await page.waitForTimeout(350)
    const intoEmpty = container.locator('[data-testid="move-chip-into"]')
    const offersChip = (await intoEmpty.count()) === 1
    ok(
      "the empty container is a valid target for a grade, like any other section",
      offersChip,
      `${await intoEmpty.count()} offer(s) inside the container`
    )
    if (offersChip) {
      await intoEmpty.click()
      await page.waitForTimeout(600)
      const nowSection = await countOf(
        `[data-session-id="${emptyDate}"] [data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"]`
      )
      // RE-PINNED 2026-08-06: the SEASON's court-days can net out flat when a
      // grade simply changes weekend, so what is pinned is the thing that really
      // changed: the empty container is a rental now, and it is counted as one.
      const blocksAfter = await summaryText()
      ok(
        "filling it IS the booking: the container becomes a rented section, counted as a rental",
        nowSection === 1 && blocksAfter !== blocksBefore,
        `${blocksBefore}  →  ${blocksAfter}`
      )
      await page.screenshot({ path: `${SHOTS}/10-2-empty-gym-filled.png`, fullPage: false })

      /* ---- ruling #5: the ⋯ menu, with the courts going UP ----
         This new section rents one or two courts of a six-court building, so it
         is the honest place to say "we actually rented all of it". */
      const filled = page.locator(
        `[data-session-id="${emptyDate}"] [data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"]`
      )
      const askBeforeUp = await askSeason()
      await filled.locator('[data-testid="gym-menu"]').click()
      await page.waitForSelector('[data-testid="gym-menu-panel"]', { timeout: 40000 })
      const startedAt = Number(
        ((await page.locator('[data-testid="court-step-value"]').textContent()) ?? "0").trim()
      )
      for (let i = 0; i < 12; i++) {
        const up = page.locator('[data-testid="court-step-up"]')
        if ((await up.count()) === 0 || (await up.isDisabled())) break
        await up.click()
      }
      const rentedTo = Number(
        ((await page.locator('[data-testid="court-step-value"]').textContent()) ?? "0").trim()
      )
      await page.locator('[data-testid="court-correction-apply"]').click()
      await page.waitForTimeout(650)
      const upSaid = await noticeText()
      const mark = (
        (await filled.locator('[data-testid="rental-mark"]').textContent().catch(() => "")) ?? ""
      ).trim()
      ok(
        "renting more of a building reads as used of rented, on the section itself",
        rentedTo > startedAt && /^\d+ used of \d+ rented$/.test(mark),
        `${startedAt} → ${rentedTo} courts · section says "${mark}"`
      )
      ok(
        "and the ask sheet bills every court they rented, not only the ones in use",
        (await askSeason()) !== askBeforeUp && /rented/.test(upSaid),
        `${askBeforeUp}  →  ${await askSeason()} · "${upSaid}"`
      )
      await page.screenshot({ path: `${SHOTS}/10-4-courts-up.png`, fullPage: false })

      // The spare courts are real room: another grade can be dropped into them.
      const spareChip = at.locator('[data-testid="grade-chip"]').first()
      await spareChip.locator("button").first().click()
      await page.waitForTimeout(350)
      const intoSpare = filled.locator('[data-testid="move-chip-into"]')
      ok(
        "the spare courts count as capacity a grade can be dropped into",
        (await intoSpare.count()) === 1,
        `${await intoSpare.count()} offer(s) on the gym with spare courts`
      )
      await page.keyboard.press("Escape")
      await page.waitForTimeout(250)
      await page.locator('[data-testid="undo-last"]').click()
      await page.waitForTimeout(550)
      ok(
        "and one undo puts the courts back where the games put them",
        (await askSeason()) === askBeforeUp,
        `${askBeforeUp}  →  ${await askSeason()}`
      )

      await page.locator('[data-testid="undo-last"]').click()
      await page.waitForTimeout(500)
    }
    /* ---- a whole SECTION onto that same date, which is ruling #3 ---- */
    const sectionGrip = at.locator(
      `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="section-grip"]`
    )
    if ((await sectionGrip.count()) === 1) {
      await sectionGrip.click()
      await page.waitForTimeout(300)
      const intoContainer = card(emptyDate).locator('[data-testid="move-section-into"]')
      ok(
        "and so is a whole section: one capacity rule, so the offer and the move agree",
        (await intoContainer.count()) === 1,
        `${await intoContainer.count()} section offer(s) on the container`
      )
      await page.keyboard.press("Escape")
      await page.waitForTimeout(250)
    }
    // The placement itself, stepped back out.
    await page.locator('[data-testid="undo-last"]').click()
    await page.waitForTimeout(500)
    ok(
      "one undo takes the container away again, and the ask is where it started",
      (await card(emptyDate).locator('[data-testid="empty-gym"]').count()) === 0 &&
        (await askSeason()) === askBefore
    )
  }

  /* ---- ruling #4: the gym lens, and the two lenses combining ---- */
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
  const lensCard = gymCard(poolVenue.venueId)
  await lensCard.locator('[data-testid="gym-lens-toggle"]').click()
  await page.waitForTimeout(350)
  const gymLens = await page.evaluate(
    ({ venueId }) => {
      const chips = [...document.querySelectorAll("[data-highlight][data-unit]")]
      const inGym = [
        ...document.querySelectorAll(
          `[data-testid="weekend-gym-section"][data-venue-id="${venueId}"] [data-testid="grade-chip"]`
        ),
      ]
      return {
        active: document.querySelectorAll('[data-testid="gym-lens"]').length,
        on: chips.filter((c) => c.dataset.highlight === "on").length,
        off: chips.filter((c) => c.dataset.highlight === "off").length,
        dimmed: chips.filter(
          (c) => c.dataset.highlight === "off" && /opacity-\[0\.35\]/.test(c.className)
        ).length,
        allInGymOn: inGym.length > 0 && inGym.every((c) => c.dataset.highlight === "on"),
        showing: (
          document.querySelector('[data-testid="grade-filter-showing"]')?.textContent ?? ""
        ).trim(),
      }
    },
    { venueId: poolVenue.venueId }
  )
  ok(
    "tapping a gym card spotlights that gym and drops everything else back",
    gymLens.active === 1 && gymLens.allInGymOn && gymLens.off > 0 && gymLens.off === gymLens.dimmed,
    `${gymLens.on} lit · ${gymLens.off} dimmed to 35% (${gymLens.dimmed} carrying the class)`
  )
  ok(
    "and the shared line says which gym is showing",
    /^Showing /.test(gymLens.showing) && gymLens.showing.length > "Showing ".length,
    gymLens.showing
  )
  await page.screenshot({ path: `${SHOTS}/10-3-gym-lens.png`, fullPage: false })

  // Now the grade lens on top: a grade that plays in the OTHER building. The two
  // combine as an intersection, so it goes out rather than lighting up.
  const homeKey = homeKeys[0]
  await page.locator(`[data-testid="grade-filter-chip"][data-unit="${homeKey}"]`).click()
  await page.waitForTimeout(350)
  const both = await page.evaluate((key) => {
    const chips = [...document.querySelectorAll("[data-highlight][data-unit]")]
    return {
      picked: chips.filter((c) => c.dataset.unit === key && c.dataset.highlight === "on").length,
      on: chips.filter((c) => c.dataset.highlight === "on").length,
      showing: (
        document.querySelector('[data-testid="grade-filter-showing"]')?.textContent ?? ""
      ).trim(),
    }
  }, homeKey)
  ok(
    "the two lenses INTERSECT: a grade that does not play in that gym stays out",
    both.picked === 0 && both.on === 0,
    `${both.on} chip(s) lit for "${both.showing}"`
  )
  ok(
    "and the one showing line names both halves of the question",
    / at /.test(both.showing),
    both.showing
  )
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  ok(
    "Escape clears BOTH lenses, so the board is never left half hidden",
    (await page.locator('[data-testid="board-scroll"] [data-highlight]').count()) === 0 &&
      (await countOf('[data-testid="gym-lens"]')) === 0
  )

  /* ---- ruling #5: the ⋯ menu is on every gym section ---- */
  ok(
    "every gym section carries the ⋯ menu, hours and courts together",
    (await at
      .locator(
        `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="gym-menu"]`
      )
      .count()) === 1
  )

} catch (err) {
  if (!/scenario|probe plan/.test(String(err?.message ?? ""))) {
    ok("the owner's scenario ran without throwing", false, String(err?.message ?? err))
  }
} finally {
  if (probeId) {
    const gone = await page.request
      .delete(`${BASE}/api/seasons/${SEASON}/plans/${probeId}`)
      .then((r) => r.ok())
      .catch(() => false)
    ok("the throwaway plan is deleted, so the season is left as it was found", gone)
  }
}

/* ---------------------------- nothing persisted -------------------------- */
const after = await savedCalendar()
ok("the season's saved calendar is byte-identical to where it started", after === before)
const plansAfter = (await listPlans()).map((p) => `${p.name}${p.isActive ? "*" : ""}`).join(", ")
ok("no plan was created, renamed or activated", plansAfter === plansBefore, `${plansBefore} → ${plansAfter}`)

/* ---- the full-bleed workspace is reversible: it must not leak off step 3 ---- */
const chromeAt = async () => ({
  sidebar: await page.locator("[data-app-sidebar]").first().isVisible().catch(() => false),
  attr: await page.evaluate(() => document.body.dataset.plannerStage ?? ""),
})
await page.goto(`${BASE}/manage/leagues/${LEAGUE}`)
await page.waitForTimeout(1500)
const offBoard = await chromeAt()
ok(
  "leaving the board gives the app its sidebar back",
  offBoard.sidebar === true && offBoard.attr === "",
  `sidebar=${offBoard.sidebar} body-attr="${offBoard.attr}"`
)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "))
console.log(`shots: ${SHOTS}`)
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
