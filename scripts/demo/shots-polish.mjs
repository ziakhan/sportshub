// EVIDENCE, NOT A SUITE (owner law 2026-08-06: any UI-affecting claim needs a
// screenshot). It signs in, opens a plan, walks steps 1 to 5, and photographs
// each control this batch changed. It writes nothing except its own throwaway
// plan, which it deletes; the season's calendar is never touched.
//
//   node shots-polish.mjs
import { chromium } from "playwright"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SEASON = process.env.SEASON_ID ?? "160b2f09-a95a-4a64-9b90-03793cae105b"
const LEAGUE = process.env.LEAGUE_ID ?? "e48a0464-33a8-4be2-b4bc-75b78c3889f4"
const SHOTS =
  process.env.SHOT_DIR ??
  "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/4eadfbff-644b-4ed7-a799-a1ea780f28c6/scratchpad/shots-polish"
const PLAN_URL = `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/plan?step=1`
const PLAN_NAME = "Polish shots plan"

const fs = await import("node:fs")
fs.mkdirSync(SHOTS, { recursive: true })
const say = (m) => process.stdout.write(`${m}\n`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
page.on("dialog", (d) => d.accept())

/** Sign in the way every drive in this repo does. */
let user = null
for (let attempt = 0; attempt < 3 && !user; attempt++) {
  await page.goto(`${BASE}/sign-in`, { timeout: 180000 })
  await page.waitForTimeout(2500)
  await page.fill('input[type="email"]', "owner-nph@sportshub.demo")
  await page.fill('input[type="password"]', "TestPass123!")
  await page.click('button[type="submit"]')
  for (let i = 0; i < 60; i++) {
    const s = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json()).catch(() => null)
    if (s?.user) { user = s.user; break }
    await page.waitForTimeout(500)
  }
}
say(`signed in: ${Boolean(user)}`)

/** A throwaway plan of our own, so nothing the owner keeps is touched. */
const created = await page.request
  .post(`${BASE}/api/seasons/${SEASON}/plans`, {
    data: { name: PLAN_NAME, fresh: true, source: "manual" },
  })
  .then((r) => r.json())
const planId = created.plan?.id
say(`plan: ${planId ?? "FAILED"}`)

const shot = async (name, locator) => {
  const path = `${SHOTS}/${name}.png`
  if (locator) {
    await locator.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(250)
    await locator.screenshot({ path }).catch(async () => page.screenshot({ path }))
  } else {
    await page.screenshot({ path })
  }
  say(`  shot ${name}.png`)
}

/* ------------------------------- step 1 --------------------------------- */
await page.goto(PLAN_URL, { timeout: 180000 })
await page.waitForSelector('[data-testid="plan-open"], [data-testid="grade-row"]', { timeout: 180000 })
await page.waitForTimeout(1200)
// Open our plan from step 1's own chooser.
const open1 = page.locator('[data-testid="plan-open"], [data-testid="step1-plan-chooser"]').first()
if (await open1.count()) {
  await open1.click().catch(() => {})
  await page.waitForTimeout(800)
  const option = page.locator(`[data-testid="plan-option"][data-plan-id="${planId}"]`)
  if (await option.count()) await option.click()
}
await page.waitForSelector('[data-testid="grade-row"]', { timeout: 120000 }).catch(() => {})
await page.waitForTimeout(1200)
await shot("1-step1-full")
const pill = page.locator('[data-testid="not-planned"]').first()
if (await pill.count()) await shot("1-step1-not-planned-pill", pill)
await shot("1-step1-wizard-nav", page.locator('[data-testid="wizard-nav"]'))

/* ------------------------------- step 2 --------------------------------- */
await page.locator('[data-testid="wizard-next"]').click()
// The step fetches its gyms; wait for a CARD, not for the clock. A fixed pause
// on a cold dev server photographs "Loading your gyms…" and proves nothing.
await page.waitForSelector('[data-testid="venue-role-chip"]', { timeout: 120000 })
await page.waitForTimeout(1200)
await shot("2-step2-full")
await shot("2-step2-plan-badge", page.locator('[data-testid="step2-plan-badge"]'))
const rankUp = page.locator('[data-testid="gym-rank-up"]').first()
if (await rankUp.count()) {
  await shot("2-step2-rank-arrows", rankUp.locator("xpath=.."))
} else {
  say("  NOTE: no rank arrows on screen")
}

/* --- THE TWO DISPUTED FIXES: the trigger's colour, and the tick round trip --- */
const trigger = page.locator('[data-testid="bookings-open"]').first()
say(`bookings trigger on screen: ${await trigger.count()}`)
if (await trigger.count()) {
  await shot("2-bookings-trigger-closed", trigger)
  say(`  trigger classes: ${await trigger.getAttribute("class")}`)
  await trigger.click()
  await page.waitForTimeout(900)
  await shot("2-bookings-picker-open", page.locator('[data-testid="bookings-picker"]'))

  // Tick two dates, and WAIT for the document to agree each time.
  const cells = page.locator('[data-testid="booking-cell"]')
  const total = await cells.count()
  say(`  booking cells: ${total}`)
  const ticked = []
  for (const i of [0, 1]) {
    if (i >= total) break
    const cell = cells.nth(i)
    const session = await cell.getAttribute("data-session-id")
    await cell.click()
    let on = false
    for (let t = 0; t < 40; t++) {
      on = (await cell.getAttribute("data-on")) === "1"
      if (on) break
      await page.waitForTimeout(500)
    }
    say(`  tick ${i}: ${on ? "ON" : "DID NOT TAKE"} (${session})`)
    if (on) ticked.push(session)
  }
  await shot("2-bookings-ticked", page.locator('[data-testid="bookings-picker"]'))

  /* --- the round trip: reopen the plan and check the ticks survived --- */
  const doc = await page.request
    .get(`${BASE}/api/seasons/${SEASON}/plans/${planId}`)
    .then((r) => r.json())
  const saved = (doc.plan?.settings?.state?.windows ?? [])
    .flatMap((w) => w.weekends ?? [])
    .filter((w) => (w.venues ?? []).length > 0)
    .map((w) => w.sessionId)
  const survived = ticked.every((s) => saved.includes(s)) && ticked.length > 0
  say(`  ROUND TRIP: ticked ${ticked.length}, saved ${saved.length} -> ${survived ? "SURVIVED" : "LOST"}`)

  await page.goto(PLAN_URL, { timeout: 180000 })
  await page.waitForSelector('[data-testid="plan-open"], [data-testid="grade-row"]', { timeout: 180000 })
  await page.waitForTimeout(1200)
  const reopen = page.locator('[data-testid="plan-open"]').first()
  if (await reopen.count()) {
    await reopen.click().catch(() => {})
    await page.waitForTimeout(700)
    const option = page.locator(`[data-testid="plan-option"][data-plan-id="${planId}"]`)
    if (await option.count()) await option.click()
  }
  await page.waitForTimeout(2500)
  await page.locator('[data-testid="wizard-next"]').click()
  await page.waitForSelector('[data-testid="venue-role-chip"]', { timeout: 120000 })
  await page.waitForTimeout(1200)
  const trigger2 = page.locator('[data-testid="bookings-open"]').first()
  if (await trigger2.count()) {
    await trigger2.click()
    await page.waitForTimeout(900)
    const onNow = await page.locator('[data-testid="booking-cell"][data-on="1"]').count()
    say(`  AFTER REOPEN: ${onNow} cell(s) still ticked`)
    await shot("2-bookings-after-reopen", page.locator('[data-testid="bookings-picker"]'))
  }
}

/* ------------------------------- step 3 --------------------------------- */
await page.locator('[data-testid="wizard-next"]').click()
await page.waitForSelector('[data-testid="gym-list"], [data-testid="draw-hero"], [data-testid="plan-empty"]', { timeout: 120000 })
await page.waitForTimeout(1500)
await shot("3-step3-full")
await shot("3-step3-plan-badge", page.locator('[data-testid="board-plan-badge"]'))
const hero = page.locator('[data-testid="draw-hero"]')
if (await hero.count()) await shot("3-step3-draw-hero", hero)
const fence = page.locator('[data-testid="fence-window"]').first()
if (await fence.count()) await shot("3-step3-fence", fence)

/* ------------------------------ steps 4 and 5 ---------------------------- */
await page.locator('[data-testid="wizard-next"]').click()
await page.waitForTimeout(3000)
await shot("4-step4-full")
await page.locator('[data-testid="wizard-next"]').click()
await page.waitForTimeout(3000)
await shot("5-step5-full")

/* -------------------------------- clean up ------------------------------- */
for (const p of (await page.request.get(`${BASE}/api/seasons/${SEASON}/plans`).then((r) => r.json())).plans ?? []) {
  if (p.name === PLAN_NAME) await page.request.delete(`${BASE}/api/seasons/${SEASON}/plans/${p.id}`)
}
say(`cleaned up. shots: ${SHOTS}`)
await browser.close()
