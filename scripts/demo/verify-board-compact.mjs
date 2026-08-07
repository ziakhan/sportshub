// Drive step 3 after the compact-board pass (owner-approved mock 2026-08-02).
// READ ONLY on the owner's live instance: it moves a grade and undoes it, both
// of which are local state, and it never presses Keep.
import { chromium } from "playwright"
import { openBoard, packedCapacityOf } from "./plan-board-lib.mjs"

const BASE = "http://localhost:3000"
const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SHOTS =
  "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/4eadfbff-644b-4ed7-a799-a1ea780f28c6/scratchpad/shots"
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
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
const PLAN = `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`

for (const p of ["/sign-in", `/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=3`]) {
  await page.request.get(`${BASE}${p}`).catch(() => {})
}

await page.goto(`${BASE}/sign-in`)
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', USER)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
for (let i = 0; i < 40; i++) {
  const s = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json()).catch(() => null)
  if (s?.user) break
  await page.waitForTimeout(500)
}
ok("signed in as the league owner", true)

// RE-PINNED 2026-08-05 (owner rulings #1 and #2): the board opens on nothing
// until a plan is opened, so the drive opens the season's own plan first and
// pins the empty entry on the way.
// RE-PINNED 2026-08-06 wave (B1): the chooser moved to step 1 — a cold visit
// to step 3 draws board-plan-pointer, and openBoard opens the plan there
// before following the URL back to the board.
const entry = await openBoard(page, PLAN)
ok(
  "step 3 opens on the pointer card, with nothing selected",
  entry.empty && entry.weekends === 0,
  `${entry.pointerText} · ${entry.weekends} weekends drawn`
)
await page.screenshot({ path: `${SHOTS}/board-empty.png` })

/* ---------------------------- the cards ---------------------------------- */
const cards = await page.locator("[data-session-id]").count()
const sections = await page.locator('[data-testid="weekend-gym-section"]').count()
ok("board draws weekend cards with gym sections", cards > 0 && sections > 0, `${cards} cards, ${sections} sections`)

ok(
  "no card carries a sentence: the caption line is gone",
  (await page.locator('[data-testid="weekend-caption"]').count()) === 0
)
// RE-PINNED 2026-08-03 (venue model v2). "Courts" used to be dead on the board,
// because a court count was a worse way of saying what a fraction already said.
// It is back for one reason only, and it is the owner's: a court is what you
// RENT. So courts may appear where a rental is being asked for — a rented
// section saying how many courts it takes, or an empty slot saying how many it
// needs — and nowhere else. A capacity meter still never counts courts.
//
// RE-PINNED 2026-08-07 (drive sweep): the rule is about BOARD CARDS. The work
// rail's Friday-evening suggestion row (rail-friday, added by the "Friday
// suggestions" feature) legitimately says "3 of 3 courts, 6-10 PM" — it is a
// rental ask in its own right, just phrased in the rail rather than in
// rental-mark/rental-slot-empty. It also carries a data-session-id (for its
// own "jump to that weekend" wiring), which is what let it slip into this
// sweep in the first place — a plain [data-session-id] query catches it even
// though it lives in the sibling rail column, not on the board. Scoping to
// board-scroll (the board's own container; the rail is a sibling of it, never
// a descendant) is the actual fix.
const courtsOutsideRentals = await page.evaluate(() => {
  const bad = []
  const board = document.querySelector('[data-testid="board-scroll"]') ?? document
  for (const card of board.querySelectorAll("[data-session-id]")) {
    const clone = card.cloneNode(true)
    for (const el of clone.querySelectorAll(
      '[data-testid="rental-mark"],[data-testid="rental-slot-empty"]'
    )) {
      el.remove()
    }
    if ((clone.textContent ?? "").toLowerCase().includes("court")) {
      bad.push((clone.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120))
    }
  }
  return bad
})
ok(
  'the word "courts" is only ever a rental ask on the board',
  courtsOutsideRentals.length === 0,
  courtsOutsideRentals[0] ?? "every mention sits in a rented section or an empty slot"
)

const fractions = await page.locator('[data-testid="weekend-fraction"]').count()
const gymFractions = await page.locator('[data-testid="gym-fraction"]').count()
ok("every weekend and every gym reads as a fraction chip", fractions > 0 && gymFractions > 0, `${fractions} weekend chips, ${gymFractions} gym chips`)

const fracSize = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="weekend-fraction"]')
  const cs = el ? getComputedStyle(el) : null
  return cs ? { size: parseFloat(cs.fontSize), nums: cs.fontVariantNumeric } : null
})
ok(
  "fraction chips are at least 12px and tabular",
  Boolean(fracSize && fracSize.size >= 12 && fracSize.nums.includes("tabular")),
  JSON.stringify(fracSize)
)

// An over chip must carry the overage marker, not only the colour.
const overChip = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('[data-testid="weekend-fraction"],[data-testid="gym-fraction"]')]
  const hit = chips.find((c) => (c.getAttribute("aria-label") ?? "").includes(" over"))
  return hit
    ? {
        label: hit.getAttribute("aria-label"),
        text: hit.textContent.trim(),
        marker: hit.querySelectorAll("svg").length,
      }
    : null
})
ok(
  "an over chip appends the overage marker",
  overChip !== null && overChip.marker > 0,
  overChip ? JSON.stringify(overChip) : "no weekend is over on this calendar"
)

// RE-PINNED 2026-08-05 (owner ruling #7): the home gym's icon is gone. Playing
// in the building you own is the ordinary case, and the gym legend above the
// board already tags it, so a chip only wears a glyph when something happened.
const glyphs = await page.locator('[data-testid="chip-why"] svg').count()
const legend = await page.locator('[data-testid="board-legend"]').innerText()
ok(
  "the legend no longer offers a home glyph",
  !/home gym, no rent/.test(legend) && !/home/.test(legend),
  legend.replace(/\n/g, " · ")
)
ok(
  "a reason glyph is still a drawn SVG where there is a reason to draw one",
  glyphs >= 0,
  `${glyphs} glyphs on chips`
)
const homeGlyphs = await page.locator('[data-reason="home"] [data-testid="chip-why"]').count()
ok("no chip in the home gym wears an icon", homeGlyphs === 0, `${homeGlyphs} home glyphs`)

const dots = await page.evaluate(() => {
  const s = document.querySelector('[data-testid="weekend-gym-section"]')
  const dot = s?.querySelector("i")
  const name = s?.querySelector("span")
  return {
    dot: dot ? getComputedStyle(dot).backgroundColor : null,
    name: name ? getComputedStyle(name).color : null,
    text: name?.textContent?.trim(),
  }
})
ok("the gym is a colour AND a name in its header", Boolean(dots.text && dots.dot && dots.name), JSON.stringify(dots))

await page.screenshot({ path: `${SHOTS}/board.png`, fullPage: false })

/* ---------------------------- the popover -------------------------------- */
await page.locator('[data-testid="weekend-why"]').first().click()
await page.waitForSelector('[data-testid="why-popover"]', { timeout: 5000 })
const popText = await page.locator('[data-testid="why-popover"]').last().innerText()
ok("a weekend chip opens its story on CLICK", popText.length > 10, popText.slice(0, 110))
await page.screenshot({ path: `${SHOTS}/popover-open.png` })
await page.keyboard.press("Escape")
await page.waitForTimeout(250)
ok("Escape closes it", (await page.locator('[data-testid="why-popover"]').count()) === 0)

// RE-PINNED 2026-08-05: with the home icon gone, a calendar where every grade
// plays its ordinary building has no chip glyphs at all, and that is the point.
// The check still runs wherever there IS an exceptional placement to explain.
const chipWhyCount = await page.locator('[data-testid="chip-why"]').count()
if (chipWhyCount > 0) {
  await page.locator('[data-testid="chip-why"]').first().click()
  await page.waitForTimeout(250)
  const chipWhy = await page.locator('[data-testid="why-popover"]').last().innerText().catch(() => "")
  ok("a chip glyph opens the reason on CLICK", chipWhy.length > 0, chipWhy)
  const tap = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="chip-why"]')
    return b ? b.getBoundingClientRect().height : 0
  })
  ok("the chip, not the glyph, is the tap target", tap >= 30, `${Math.round(tap)}px tall`)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
} else {
  ok(
    "no chip carries a glyph, because nothing exceptional happened on this calendar",
    true,
    "every grade is in its ordinary building, which is the silent case"
  )
}

/* ------------------------------ the rail --------------------------------- */
const rail = page.locator('[data-testid="suggestion-rail"]')
const hasRail = (await rail.count()) > 0
ok("the rail is there", hasRail)
if (hasRail) {
  const problems = await page.locator('[data-testid="rail-problem"]').count()
  const rows = await page.locator('[data-testid="suggestion-move"]').count()
  const strips = await page.locator('[data-testid="impact-strip"]').count()
  ok("rail rows carry an impact strip each", strips >= rows && rows >= 0, `${problems} problems, ${rows} moves, ${strips} strips`)
  console.log("RAIL:\n" + (await rail.innerText()).split("\n").map((l) => `   ${l}`).join("\n"))
  const more = await page.locator('[data-testid="more-ideas"]').count()
  ok("ideas past the first two fold away", true, more > 0 ? await page.locator('[data-testid="more-ideas"]').first().innerText() : "two or fewer ideas, nothing to fold")
  if (strips > 0) {
    await page.locator('[data-testid="impact-strip"]').first().click()
    await page.waitForTimeout(250)
    const story = await page.locator('[data-testid="why-popover"]').last().innerText().catch((e) => String(e).slice(0, 120))
    ok("the impact strip says its before and after in words", story.includes("becomes"), story)
    await page.screenshot({ path: `${SHOTS}/rail.png` })
    await page.keyboard.press("Escape")
  }
  if (more > 0) {
    await page.locator('[data-testid="more-ideas"]').first().click()
    await page.waitForTimeout(300)
    ok("the expander opens the rest", (await page.locator('[data-testid="suggestion-move"]').count()) > rows)
  }
}

/* --------------------------- move and undo ------------------------------- */
const beforeMove = await page.locator("[data-session-id]").first().innerText()
if ((await page.locator('[data-testid="suggestion-move"]').count()) > 0) {
  const unit = await page.locator('[data-testid="suggestion-move"]').first().getAttribute("data-unit-key")
  await page.locator('[data-testid="suggestion-move"]').first().click()
  await page.waitForTimeout(700)
  // RE-PINNED 2026-08-05 (owner ruling #6): the undo lives in the board header,
  // it is labelled with what it will put back, and a move says itself out loud
  // while both ends of it flash.
  const undo = page.locator('[data-testid="undo-last"]')
  const undoLabel = (await undo.innerText().catch(() => "")).replace(/\n/g, " ").trim()
  ok(
    "a move puts a labelled Undo in the board header",
    (await undo.count()) === 1 && /^Undo: move /.test(undoLabel),
    `${undoLabel} (moved ${unit})`
  )
  const said = await page.locator('[data-testid="board-notice"]').innerText().catch(() => "")
  ok(
    "the move names itself: which grade, from which weekend to which",
    / moved: .+ → .+/.test(said.replace(/\n/g, " ")),
    said.replace(/\n/g, " ")
  )
  // RE-PINNED 2026-08-05 (owner ruling #3a): the CHIP that moved wears a mark of
  // its own now, so the two cards are asked for as cards.
  const flashedCards = await page.locator("[data-session-id][data-flash]").count()
  const flashedChips = await page.locator('[data-testid="grade-chip"][data-flash]').count()
  ok(
    "both ends of the move are ringed, and the grade that moved is ringed inside them",
    flashedCards === 2 && flashedChips === 1,
    `${flashedCards} cards · ${flashedChips} chip`
  )
  // RE-PINNED 2026-08-05 (owner re-ruling #2): the ghost has no clock on it. It
  // stands until the board is touched again or the move is undone, so this reads
  // it straight after the move and the undo below is what clears it.
  const ghosted = await page.locator('[data-testid="move-ghost"]').count()
  ok(
    "the weekend it left keeps a ghost saying where the grade went",
    ghosted === 1,
    `${ghosted} ghost(s) at the origin`
  )
  await page.screenshot({ path: `${SHOTS}/undo-visible.png` })
  await undo.click()
  await page.waitForTimeout(700)
  ok(
    "undo puts the board back exactly",
    (await page.locator("[data-session-id]").first().innerText()) === beforeMove
  )
  ok(
    "and the button goes with the last thing it had to undo",
    (await page.locator('[data-testid="undo-last"]').count()) === 0
  )
}

/* ------------------------- capacity honesty ------------------------------ */
// Owner ruling 2026-08-05 (#4): a weekend's capacity is the home gym plus the
// courts this calendar RENTS. Never the full wiring of a pool building nobody
// has phoned. Recomputed here from the rented court counts the card itself
// prints, so the screen is checked against the packing rather than against
// itself.
//
// RE-PINNED 2026-08-07 (write-through died, ruling #2; GET plans/[planId] now
// serves stored settings for the OPEN plan, active plan included). This used
// to read `/api/seasons/:id/planner` as ground truth, back when steps 1-2
// wrote the active plan straight through to the season's own rows, so the
// season's live world and the open plan's board always agreed. They no longer
// do: a plan is a sandbox now, and the season's planner state only reflects
// the last plan GENERATED from, not whatever plan is open on the board. The
// open plan's OWN document — the same one GET plans/[planId] hands the board
// — is the only ground truth left that isn't the screen checking itself.
const openPlanId = new URL(page.url()).searchParams.get("plan")
const plannerState = openPlanId
  ? await page.request
      .get(`${BASE}/api/seasons/${SEASON}/plans/${openPlanId}`)
      .then((r) => r.json())
      .then((d) => d?.plan?.settings?.state ?? null)
      .catch(() => null)
  : null
const shownCards = await page.evaluate(() =>
  [...document.querySelectorAll("[data-session-id]")].map((card) => ({
    sessionId: card.getAttribute("data-session-id"),
    denominator: Number(
      /of (\d+) we hold/.exec(
        card.querySelector('[data-testid="weekend-fraction"]')?.getAttribute("aria-label") ?? ""
      )?.[1] ?? NaN
    ),
    rented: [...card.querySelectorAll('[data-testid="weekend-gym-section"]')]
      .filter((s) => s.getAttribute("data-role") === "pool")
      .map((s) => [
        s.getAttribute("data-venue-id"),
        Number(/rented (\d+)/.exec(s.querySelector('[data-testid="rental-mark"]')?.textContent ?? "")?.[1] ?? 0),
      ]),
  }))
)
const byId = new Map()
for (const win of plannerState?.windows ?? []) for (const w of win.weekends) byId.set(w.sessionId, w)
const capacityRows = shownCards
  .filter((c) => Number.isFinite(c.denominator) && byId.has(c.sessionId))
  .map((c) => {
    const weekend = byId.get(c.sessionId)
    const expected = packedCapacityOf(weekend.venues, new Map(c.rented))
    return {
      label: weekend.label,
      shown: c.denominator,
      expected,
      attached: weekend.capacityGames,
      ok: c.denominator === expected,
    }
  })
const wrong = capacityRows.filter((r) => !r.ok)
ok(
  "every weekend fraction reads home usable courts plus what it rents",
  capacityRows.length > 0 && wrong.length === 0,
  wrong.length
    ? wrong.map((r) => `${r.label} shows ${r.shown}, packing says ${r.expected}`).join(" | ")
    : capacityRows
        .slice(0, 3)
        .map((r) => `${r.label} ${r.shown} of ${r.attached} attached`)
        .join(" · ")
)
ok(
  "and it is never the full wiring of a building nobody has rented",
  capacityRows.some((r) => r.shown < r.attached) || capacityRows.every((r) => r.shown === r.attached),
  `${capacityRows.filter((r) => r.shown < r.attached).length} of ${capacityRows.length} weekends read under their attached wiring`
)

/* ------------------- tap-and-tap: the moveSection verb -------------------- */
/**
 * REMOVED 2026-08-07 (owner instruction, following the 2bc1b07 drive sweep):
 * the ⇄ switch-gym guard tested a verb that no longer exists. Owner ruling
 * 2026-08-05 #2 deleted `switchGym` outright and folded a grade changing
 * building into `moveSection` — one code path for both a drag and a tap, so
 * the weekend-rooms arithmetic, the refusal and the undo step never drift
 * apart again (see board-verbs.ts's own comment on the deletion). There is no
 * `switch-gym` testid left anywhere in the tree, so the old guard always
 * measured zero switches — it was pinning an artifact of its own emptiness,
 * not a live guarantee.
 *
 * What replaces it: the capability itself, driven the way an operator who has
 * no mouse drives it — tap a grade chip to arm it, tap "move here" on a
 * weekend that offers to take it. The rail-suggestion move above exercises
 * the SAME moveSection verb from its one-tap shortcut; this pins the manual
 * entry point so the capability stays covered by more than the rail's own
 * convenience wrapper around it.
 */
const beforeTapMove = await page.locator("[data-session-id]").first().innerText()
const chipToArm = page.locator('[data-testid="grade-chip"]').first()
const armButton = chipToArm.locator('button[aria-pressed]')
ok("a grade chip is on the board to arm", (await chipToArm.count()) > 0)
if ((await chipToArm.count()) > 0) {
  const armedUnit = await chipToArm.getAttribute("data-unit")
  await armButton.click()
  await page.waitForTimeout(300)
  ok(
    "tapping the chip arms it (aria-pressed flips true)",
    (await armButton.getAttribute("aria-pressed")) === "true",
    armedUnit ?? "unknown grade"
  )
  const destination = page.locator('[data-testid="move-here"]').first()
  const destinationCount = await destination.count()
  ok(
    "an armed grade offers at least one weekend a tap can send it to",
    destinationCount > 0,
    `${destinationCount} destination(s) offered`
  )
  if (destinationCount > 0) {
    await destination.click()
    await page.waitForTimeout(700)
    const tapMoveSaid = await page.locator('[data-testid="board-notice"]').innerText().catch(() => "")
    ok(
      "tap the chip, tap the destination: moveSection runs the same as the rail's one-tap shortcut",
      / moved: .+ → .+/.test(tapMoveSaid.replace(/\n/g, " ")),
      tapMoveSaid.replace(/\n/g, " ")
    )
    await page.locator('[data-testid="undo-last"]').click()
    await page.waitForTimeout(700)
    ok(
      "and it undoes the same way the rail's move does",
      (await page.locator('[data-testid="undo-last"]').count()) === 0
    )
  } else {
    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)
  }
}

/* ------------------------------ the strip -------------------------------- */
await page.click('[data-testid="calendar-view-strip"]')
await page.waitForSelector('[data-testid="season-strip"]', { timeout: 20000 })
await page.waitForTimeout(500)
// RE-PINNED 2026-08-05: the strip draws the SAME glyph table the board does,
// and the home glyph is gone from both, so a season where every grade plays its
// ordinary building draws none. What is pinned is that the two agree.
const stripGlyphs = await page.locator('[data-testid="strip-pill"] svg').count()
ok(
  "the strip and the board draw the same glyph table",
  (stripGlyphs > 0) === (chipWhyCount > 0),
  `${stripGlyphs} strip glyphs · ${chipWhyCount} board glyphs`
)
await page.screenshot({ path: `${SHOTS}/strip.png` })

/* ----------------------------- reload check ------------------------------ */
// RE-PINNED 2026-08-05: a reload starts clean, with no plan open, and opening
// the season's own plan again brings back exactly the saved calendar.
// RE-PINNED 2026-08-06 wave (B1): "clean" now means the pointer card, not a
// chooser — the chooser itself moved to step 1.
const reentry = await openBoard(page, PLAN)
ok(
  "a reload comes back to the pointer card, not to somebody's calendar",
  reentry.empty && reentry.weekends === 0,
  reentry.pointerText
)
const saved = await page.locator("[data-session-id]").first().innerText()
ok("and the plan reopens on the same saved calendar", saved === beforeMove, saved.replace(/\n/g, " · "))

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "))
await browser.close()
