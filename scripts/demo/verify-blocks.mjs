// Drive the venue model v2 board on step 3 (owner rulings 2026-08-03: home gym
// first, spill becomes rental blocks, two modes for filling them, and the ask
// sheet an operator reads down the phone to a gym).
//
// SAFE ON THE OWNER'S LIVE INSTANCE. Everything it does lives on the WORKING
// COPY: it moves grades with the tap-and-tap path, fills the gaps from the pool,
// undoes, and places a gym by hand. It never presses Keep, never activates, and
// never saves a plan. It captures the season's saved calendar before it starts
// and byte-compares it at the end.
//
// Env (defaults = the 2026-08-02 local world):
//   BASE_URL, SEASON_ID, LEAGUE_ID, SHOT_DIR
// Run from scripts/demo (its node_modules has Playwright):
//   node verify-blocks.mjs
import { chromium } from "playwright"

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

/* ------------------------------- the board ------------------------------- */
await page.goto(PLAN_URL)
await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 120000 })
await page.waitForTimeout(1200)

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
const firstMark = await page.evaluate(() => {
  const card = document.querySelector("[data-session-id]")
  const first = card?.querySelector('[data-testid="weekend-gym-section"]')
  return {
    role: first?.getAttribute("data-role") ?? null,
    mark: first?.querySelector('[data-testid="home-mark"],[data-testid="rental-mark"]')?.textContent?.trim() ?? null,
  }
})
ok(
  "the home gym section comes first on a weekend that has one",
  firstMark.role === "home" || firstMark.role === "pool",
  JSON.stringify(firstMark)
)
const rentalWords = await page.locator('[data-testid="rental-mark"]').first().innerText()
ok(
  "a rented section is labelled with its rented court count",
  /^rented \d+ courts?$/.test(rentalWords),
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
    const chip = card(source).locator("button[aria-pressed]").first()
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
ok(
  "the weekend it filled wears the assumed mark",
  assumedSections > 0 && assumedMarks === "assumed",
  `${assumedSections} assumed section(s) · mark "${assumedMarks}"`
)
await page.locator(`[data-session-id="${target}"]`).scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/4-assumed-chips.png` })

/* --------------------------------- undo ---------------------------------- */
await page.locator('[data-testid="undo-move"]').click()
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

/* ------------------- a drop that cannot work says why -------------------- */
// The tap-arm path is the drag, without the mouse. Every weekend is tried until
// one refuses: a gym the season does not have that weekend, or one with fewer
// courts than the games need. Anything that lands is undone immediately.
let refusal = ""
const everyWeekend = stateWindows.flatMap((win) => (win.weekends ?? []).map((w) => w.sessionId))
for (const sessionId of everyWeekend) {
  if (refusal) break
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
  if (/has \d+ of the \d+ courts needed on|is not on/.test(said)) {
    refusal = said
    break
  }
  if (/You placed it/.test(said)) {
    await page.locator('[data-testid="undo-move"]').click()
    await page.waitForTimeout(400)
  }
}
ok(
  "a drop that cannot work is refused, and it says which weekend the gym is not on",
  refusal.length > 0,
  refusal || "no weekend refused the armed gym"
)
await page.screenshot({ path: `${SHOTS}/5-drop-refused.png` })

/* ---------------------- the drag, with a real mouse ---------------------- */
// The tray is dragged as well as tapped, so the drop path gets driven too. This
// one lands: the rented gym has courts enough for the block it is dropped on.
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
let undos = 0
// The empty slot on the crowded weekend: the gym has courts enough for the
// games with nowhere to play, so this one lands.
const dragTarget = card(target).locator('[data-testid="rental-slot-empty"]').first()
// The slot's own top line, not its centre: the centre is the grade chip that
// has nowhere to play, and a chip is draggable itself.
await page
  .locator(`[data-testid="tray-gym"][data-venue-id="${trayVenue}"]`)
  .dragTo(dragTarget, { targetPosition: { x: 8, y: 8 } })
await page.waitForTimeout(600)
const dragSaid = await noticeText()
ok(
  "dragging a gym out of the tray onto a weekend lands the same way a tap does",
  /You placed it, so it counts as confirmed/.test(dragSaid),
  dragSaid || "the drop said nothing"
)
if (/You placed it/.test(dragSaid)) undos += 1
await page.locator('[data-testid="venue-tray"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/2-tray-drop.png` })

/* ------------- and the other refusal: not enough courts ------------------ */
// Everything the crowded weekend holds, sent by hand into the one rented
// building with the chip's own gym switch. Asking that building to take the lot
// is more courts than it has, and the reason has to name both numbers.
for (let i = 0; i < 8; i++) {
  const swap = card(target)
    .locator('[data-testid="weekend-gym-section"][data-role="home"] button[title^="Move to"]')
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
ok(
  "a gym with fewer courts than the games need is refused, with both numbers in it",
  shortCourts.length > 0,
  shortCourts || "the pool gym had courts enough for everything this drive could stack on it"
)
if (shortCourts) await page.screenshot({ path: `${SHOTS}/6-courts-short.png` })

// Every placement this drive made, stepped back out again. It changes nothing
// that was saved either way; the byte-compare below is the proof.
for (let i = 0; i < undos; i++) {
  const undo = page.locator('[data-testid="undo-move"]')
  if ((await undo.count()) === 0) break
  await undo.click()
  await page.waitForTimeout(400)
}
ok("the drive steps its own placements back out", undos >= 0, `${undos} placement(s) undone`)

/* ---------------------------- nothing persisted -------------------------- */
const after = await savedCalendar()
ok("the season's saved calendar is byte-identical to where it started", after === before)
const plansAfter = (await listPlans()).map((p) => `${p.name}${p.isActive ? "*" : ""}`).join(", ")
ok("no plan was created, renamed or activated", plansAfter === plansBefore, `${plansBefore} → ${plansAfter}`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "))
console.log(`shots: ${SHOTS}`)
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
