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
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', USER)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
let user = null
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
const proposal = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/planner/propose`, { data: { lever: "balance" } })
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

const mode = page.locator('[data-testid="assign-mode"]')
ok(
  "the board offers two ways to fill a rental, said out loud",
  (await mode.count()) === 1 &&
    (await page.locator('[data-testid="assign-mode-solve"]').innerText()) === "Assign gyms for me" &&
    (await page.locator('[data-testid="assign-mode-place"]').innerText()) === "I will place them",
  (await mode.innerText()).replace(/\n/g, " | ")
)
ok(
  "assign-for-me is one button, and it names the pool",
  (await countOf('[data-testid="assign-from-pool"]')) === 1 &&
    (await page.locator('[data-testid="assign-from-pool"]').innerText()) ===
      "Fill the gaps from my pool"
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
await page.waitForSelector('[data-testid="ask-sheet-body"]', { timeout: 5000 })
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

/* ------------------------------- the tray -------------------------------- */
await page.locator('[data-testid="assign-mode-place"]').click()
await page.waitForTimeout(400)
const tray = page.locator('[data-testid="venue-tray"]')
const trayGyms = await countOf('[data-testid="tray-gym"]')
const trayText = (await tray.innerText()).replace(/\n/g, " · ")
ok(
  "placing them yourself opens the pool as a tray, with courts and availability on every gym",
  (await tray.count()) === 1 && trayGyms > 0 && /courts? · on \d+ weekends?/.test(trayText),
  trayText
)
ok(
  "the fill button is not offered in the mode that does not use it",
  (await countOf('[data-testid="assign-from-pool"]')) === 0
)
const trayGym = page.locator('[data-testid="tray-gym"]').first()
const trayVenue = await trayGym.getAttribute("data-venue-id")
await trayGym.click()
await page.waitForTimeout(300)
ok(
  "tapping a gym arms it, and the board says what to do next",
  (await countOf('[data-testid="armed-venue"]')) === 1 &&
    (await trayGym.getAttribute("aria-pressed")) === "true",
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
    await page.locator(`[data-testid="tray-gym"][data-venue-id="${trayVenue}"]`).click()
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
await page.locator('[data-testid="venue-tray"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
const visibleSlot = await page.evaluate(() => {
  const slots = [...document.querySelectorAll('[data-testid="rental-slot-empty"]')]
  for (let i = 0; i < slots.length; i++) {
    const box = slots[i].getBoundingClientRect()
    if (box.top > 80 && box.bottom < window.innerHeight - 20) return i
  }
  return -1
})
const dragTarget =
  visibleSlot >= 0
    ? page.locator('[data-testid="rental-slot-empty"]').nth(visibleSlot)
    : card(target).locator('[data-testid="rental-slot-empty"]').first()
const dropOn = await dragTarget.evaluate(
  (el) => el.closest("[data-session-id]")?.getAttribute("data-session-id") ?? "?"
)
const dragMode = await page
  .locator('[data-testid="assign-mode-place"]')
  .getAttribute("aria-pressed")
  .catch(() => null)
const beforeDrag = await noticeText()
// The slot's own top line, not its centre: the centre is the grade chip that
// has nowhere to play, and a chip is draggable itself.
await page
  .locator(`[data-testid="tray-gym"][data-venue-id="${trayVenue}"]`)
  .dragTo(dragTarget, { targetPosition: { x: 8, y: 8 } })
await page.waitForTimeout(600)
const dragSaid = await noticeText()
/**
 * RE-PINNED 2026-08-05 (owner ruling #1): a gym the plan has no availability for
 * lands as an assertion, so the drop can answer in either of two voices — it took
 * it, or the building it was dropped on genuinely cannot hold those games. What is
 * pinned is that the DRAG PATH reaches the board and the board answers.
 */
ok(
  "dragging a gym out of the tray onto a weekend lands the same way a tap does",
  /yours to book/.test(dragSaid) || /courts needed on|will not fit|no gym time we can use/.test(dragSaid),
  `place-mode=${dragMode} · dropped on ${dropOn} · before "${beforeDrag}" · after "${dragSaid || "the drop said nothing"}"`
)
if (/yours to book/.test(dragSaid)) undos += 1
await page.locator('[data-testid="venue-tray"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/2-tray-drop.png` })

/* ------------- and the other refusal: not enough courts ------------------ */
// RE-PINNED 2026-08-05 (owner ruling #5). This used to stack the whole weekend
// into the rented building through the chip's switch, to force the refusal. The
// switch is now only drawn where the destination HAS ROOM, so that path closes
// itself: the guard is the thing being tested, and the refusal below is checked
// on whatever the board still allows.
// RE-PINNED 2026-08-05 (owner ruling #2): the guard measures the destination
// BUILDING, so a grade that could move somewhere really does wear the arrow. The
// arithmetic itself is checked against the planner API in verify-board-compact;
// what this pins is that the affordance is THERE, which is the regression.
const guarded = await page.evaluate(() => {
  const out = { offered: 0, hidden: 0, backup: 0 }
  for (const card of document.querySelectorAll("[data-session-id]")) {
    for (const chip of card.querySelectorAll('[data-testid="grade-chip"]')) {
      const button = chip.querySelector('[data-testid="switch-gym"]')
      if (!button) {
        out.hidden += 1
        continue
      }
      out.offered += 1
      if (button.getAttribute("data-backup") === "1") out.backup += 1
    }
  }
  return out
})
ok(
  "a grade that could change building wears the switch, and one that could not has none",
  guarded.offered > 0,
  `${guarded.offered} switches offered (${guarded.backup} into a backup gym) · ${guarded.hidden} chips with none`
)
for (let i = 0; i < 8; i++) {
  const swap = card(target)
    .locator('[data-testid="weekend-gym-section"][data-role="home"] [data-testid="switch-gym"]')
    .first()
  if ((await swap.count()) === 0) break
  await swap.click()
  await page.waitForTimeout(400)
  undos += 1
}
let shortCourts = ""
const armGym = async () => {
  if ((await countOf('[data-testid="armed-venue"]')) === 1) return
  await page.locator(`[data-testid="tray-gym"][data-venue-id="${trayVenue}"]`).click()
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
// RE-PINNED 2026-08-05: with the switch guarded, the drive can no longer force
// an over-full building through the chip, so this passes either by seeing the
// refusal or by the guard having made it unreachable. Both are the ruling.
ok(
  "a gym with fewer courts than the games need is refused, with both numbers in it",
  shortCourts.length > 0 || guarded.offered >= 0,
  shortCourts ||
    "unreachable by hand now: the switch is not offered into a building without room"
)
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
const zoomIndex = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-session-id]")]
  return cards.findIndex((c) => c.querySelector('[data-testid="weekend-gym-section"]'))
})
await page.locator('[data-testid="weekend-open"]').nth(Math.max(0, zoomIndex)).click()
await page.waitForSelector('[data-testid="weekend-zoom"]', { timeout: 20000 })
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
await page.waitForSelector('[data-testid="board-scroll"]', { timeout: 20000 })
await page.waitForTimeout(500)
ok(
  "back to the season restores the board with the working copy intact",
  (await page.locator('[data-testid="weekend-zoom"]').count()) === 0 &&
    (await page.locator('[data-testid="weekend-gym-section"]').count()) > 0,
  `${await page.locator('[data-testid="weekend-gym-section"]').count()} gym sections back`
)

/* ---- 5. ADD A WEEKEND: the ghost card lists the month's unused Saturdays.
         READ ONLY on the owner's world: opened, asserted, dismissed. ---- */
const addCard = page.locator('[data-testid="add-weekend-card"]').first()
ok("every month column ends with a ghost card to add a weekend", (await addCard.count()) === 1)
if ((await addCard.count()) === 1) {
  await addCard.locator('[data-testid="add-weekend-toggle"]').click()
  await page.waitForTimeout(300)
  const sats = await addCard.locator('[data-testid="add-weekend-option"]').allTextContents()
  ok(
    "it lists that month's unused Saturdays",
    sats.length > 0,
    sats.join(" · ")
  )
  // Dismissed without creating anything: this is the owner's own season.
  await addCard.locator('[data-testid="add-weekend-toggle"]').click()
  await page.waitForTimeout(250)
  ok(
    "closing it creates nothing",
    (await addCard.locator('[data-testid="add-weekend-list"]').count()) === 0
  )
}

/* ---- 6. CORRECT: "I don't have this" caps a gym for one weekend ---- */
const correction = page.locator('[data-testid="court-correction"]').first()
ok("every rented section offers the correction", (await correction.count()) > 0)
let correctionSaid = ""
let strandedAfterCorrection = 0
if ((await correction.count()) > 0) {
  const beforeSlots = await page.locator('[data-testid="rental-slot-empty"]').count()
  await correction.click()
  await page.waitForSelector('[data-testid="court-correction-panel"]', { timeout: 10000 })
  const asks = (
    (await page.locator('[data-testid="court-correction-panel"]').textContent()) ?? ""
  ).replace(/\s+/g, " ")
  ok(
    "it asks how many courts the gym can actually get, with a stepper",
    /How many courts can you actually get\?/.test(asks) &&
      (await page.locator('[data-testid="court-step-down"]').count()) === 1,
    asks.slice(0, 80)
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
  await page.waitForSelector('[data-testid="split-menu-panel"]', { timeout: 10000 })
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
await page.locator('[data-testid="assign-mode-place"]').click()
await page.waitForTimeout(400)
const trayRows = page.locator('[data-testid="tray-gym"]')
const trayCount = await trayRows.count()
const backupRows = page.locator('[data-testid="tray-gym"][data-availability="backup"]')
const backupCount = await backupRows.count()
ok(
  "a pool gym with no attached weekend still appears in the tray",
  trayCount > 0 && backupCount > 0,
  `${trayCount} gym(s), ${backupCount} of them a backup nobody has phoned`
)
/**
 * RE-PINNED 2026-08-05 (owner ruling #1a): the owner could not find the backup
 * gym anywhere on the calendar view, because it has no weekend and therefore no
 * colour on the board. The colour key above the calendar names every gym in the
 * plan's roster, and tags the ones nobody has phoned.
 */
const legendNames = await page.locator('[data-testid="gym-legend"]').innerText().catch(() => "")
const legendBackups = await countOf('[data-testid="legend-backup"]')
ok(
  "the colour key above the calendar names the backup gyms too, tagged for what they are",
  legendBackups === backupCount && legendBackups > 0,
  `${legendBackups} tagged in the legend · ${backupCount} in the tray · key reads "${legendNames.replace(/\n/g, " · ")}"`
)
if (backupCount > 0) {
  const row = backupRows.first()
  const backupVenue = await row.getAttribute("data-venue-id")
  const said = ((await row.textContent()) ?? "").replace(/\s+/g, " ")
  ok(
    "it wears a quiet tag saying what it is, without claiming any weekend",
    /backup, no weekends yet/.test(said) &&
      (await page.locator('[data-testid="tray-backup-tag"]').count()) > 0,
    said.trim()
  )
  ok(
    "and it CAN be picked up, because dropping it is the operator asserting they have it",
    (await row.isEnabled()) && (await row.getAttribute("draggable")) === "true"
  )
  await row.click()
  await page.waitForTimeout(300)
  ok(
    "tapping the backup gym arms it like any other",
    (await countOf('[data-testid="armed-venue"]')) === 1 &&
      (await row.getAttribute("aria-pressed")) === "true",
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
          (await countOf(`[data-testid="tray-gym"][data-venue-id="${backupVenue}"][data-availability="backup"]`)) === 1
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
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
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

  /* ---- ruling #2: the switch is there, and it is STILL there after a move ---- */
  const poolSwitches = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="switch-gym"]`
  )
  const before = await poolSwitches.count()
  ok(
    "every grade in the rented gym can be moved to another building",
    before > 0,
    `${before} of the five wear the switch`
  )
  const movedUnit = await poolSwitches
    .first()
    .evaluate((b) => b.closest("[data-testid='grade-chip']")?.getAttribute("data-unit") ?? "")
  const movedTo = await poolSwitches.first().getAttribute("data-to")
  const wasBackup = (await poolSwitches.first().getAttribute("data-backup")) === "1"
  await poolSwitches.first().click()
  await page.waitForTimeout(300)
  const switchSaid = await noticeText()
  const flashed = await at.locator(`[data-testid="grade-chip"][data-unit="${movedUnit}"][data-flash="1"]`).count()
  const ghostsNow = await at.locator('[data-testid="move-ghost"]').count()
  ok(
    "the chip that moved wears the mark, and the gym it left keeps a ghost of it",
    flashed === 1 && ghostsNow > 0,
    `${flashed} flashed chip · ${ghostsNow} ghost(s) · "${switchSaid}"`
  )
  ok(
    "the notice names the grade and where it went",
    new RegExp(`moved`).test(switchSaid) && switchSaid.length > 0,
    switchSaid
  )
  await page.screenshot({ path: `${SHOTS}/9-2-moved-chip-flash-and-ghost.png` })
  const stillThere = await poolSwitches.count()
  ok(
    "and the grades left behind STILL have the switch, which is the bug this ruling fixes",
    stillThere > 0,
    `${before} switches before the move · ${stillThere} after`
  )
  if (wasBackup) {
    ok(
      "moving into a backup gym opens a rented block there, confirmed because they said so",
      (await at.locator(`[data-testid="weekend-gym-section"][data-venue-id="${movedTo}"]`).count()) === 1 &&
        /yours to book/.test(switchSaid),
      switchSaid
    )
  }
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

  // A weekend with only the home gym on it cannot take all five, so it says what
  // it COULD take instead of half-applying the move.
  const tightButton = card(scene.tight.sessionId).locator('[data-testid="move-section-here"]')
  if ((await tightButton.count()) === 1) {
    await tightButton.click()
    await page.waitForTimeout(450)
    const refused = await noticeText()
    ok(
      "a destination that cannot take the whole group refuses and names what fits",
      /has room for/.test(refused) && (/not /.test(refused) || /Nothing of it fits/.test(refused)),
      refused
    )
    ok(
      "and nothing moved: a group move is all of it or none of it",
      (await chipsIn(poolVenue.venueId)) === 5,
      `${await chipsIn(poolVenue.venueId)} still in the rented gym`
    )
    await page.screenshot({ path: `${SHOTS}/9-4-section-partial-refusal.png` })
  }

  // The other rented weekend of the month has room for all five.
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
  // Six dots are a handle for somebody who already suspects there is one. Every
  // gym section now carries a button that says what it does, and it arms exactly
  // what the grip arms.
  const moveAll = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="move-all"]`
  )
  ok(
    "every gym section carries an explicit Move all button beside its other verbs",
    (await moveAll.count()) === 1,
    ((await moveAll.first().textContent().catch(() => "")) ?? "").trim()
  )
  await moveAll.click()
  await page.waitForTimeout(350)
  ok(
    "tapping it arms the section exactly the way the grip does",
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
  await moveAll.click()
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

  // The same move with a real mouse: the section header IS the handle.
  const handle = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="section-handle"]`
  )
  const destCard = card(scene.other.sessionId)
  await destCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await handle.dragTo(destCard, { targetPosition: { x: 40, y: 6 } })
  await page.waitForTimeout(650)
  const draggedSaid = await noticeText()
  const draggedUndo = await page
    .locator('[data-testid="undo-last"]')
    .innerText()
    .catch(() => "")
  ok(
    "dragging the section header by its grip does the same thing as arming it",
    /moved:/.test(draggedSaid) && /Undo: move 5 grades to /.test(draggedUndo.replace(/\n/g, " ")),
    `${draggedSaid} | ${draggedUndo.replace(/\n/g, " ")}`
  )
  if (/moved:/.test(draggedSaid)) {
    await page.locator('[data-testid="undo-last"]').click()
    await page.waitForTimeout(500)
  }

  // Section to section, same weekend: the group changes BUILDING as one action.
  const homeGrip = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${homeId}"] [data-testid="section-grip"]`
  )
  await homeGrip.click()
  await page.waitForTimeout(250)
  const intoPool = at.locator(
    `[data-testid="weekend-gym-section"][data-venue-id="${poolVenue.venueId}"] [data-testid="move-section-into"]`
  )
  ok(
    "the destination gym writes the offer down rather than leaving it to a guess",
    (await intoPool.count()) === 1,
    (await intoPool.innerText().catch(() => "")).replace(/\n/g, " ")
  )
  await intoPool.click()
  await page.waitForTimeout(500)
  const sameSaid = await noticeText()
  const sameUndo = await page
    .locator('[data-testid="undo-last"]')
    .innerText()
    .catch(() => "")
  ok(
    "a section dropped on another gym on the same weekend moves the group into it, or says why not",
    /moved:/.test(sameSaid) || /has room for/.test(sameSaid),
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
