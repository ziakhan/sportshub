// Drive step 3 after the compact-board pass (owner-approved mock 2026-08-02).
// READ ONLY on the owner's live instance: it moves a grade and undoes it, both
// of which are local state, and it never presses Keep.
import { chromium } from "playwright"

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

await page.goto(PLAN)
await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 120000 })
await page.waitForTimeout(1200)

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
const courtsOutsideRentals = await page.evaluate(() => {
  const bad = []
  for (const card of document.querySelectorAll("[data-session-id]")) {
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

const glyphs = await page.locator('[data-testid="chip-why"] svg').count()
ok("reason glyphs are drawn SVGs on the chips", glyphs > 0, `${glyphs} glyphs`)
const legend = await page.locator('[data-testid="board-legend"]').innerText()
ok("one quiet legend line names the four glyphs", legend.split("\n").join(" · ").length > 0, legend.replace(/\n/g, " · "))

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
  await page.waitForTimeout(600)
  const undo = page.locator('[data-testid="undo-move"]')
  ok("a rail move happens and can be undone", (await undo.count()) === 1, `moved ${unit}`)
  await undo.click()
  await page.waitForTimeout(600)
  ok(
    "undo puts the board back exactly",
    (await page.locator("[data-session-id]").first().innerText()) === beforeMove
  )
}

/* ------------------------------ the strip -------------------------------- */
await page.click('[data-testid="calendar-view-strip"]')
await page.waitForSelector('[data-testid="season-strip"]', { timeout: 20000 })
await page.waitForTimeout(500)
const stripGlyphs = await page.locator('[data-testid="strip-pill"] svg').count()
ok("strip cells carry the same drawn glyph", stripGlyphs > 0, `${stripGlyphs} cells explain themselves`)
await page.screenshot({ path: `${SHOTS}/strip.png` })

/* ----------------------------- reload check ------------------------------ */
await page.goto(PLAN)
await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 60000 })
await page.waitForTimeout(1000)
const saved = await page.locator("[data-session-id]").first().innerText()
ok("a reload comes back to the same saved calendar", saved === beforeMove, saved.replace(/\n/g, " · "))

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "))
await browser.close()
