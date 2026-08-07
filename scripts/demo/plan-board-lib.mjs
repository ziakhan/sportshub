/**
 * Landing on the planner board, after the 2026-08-05 entry rulings AND the
 * 2026-08-06 wave's B1 ruling on top of them.
 *
 * Three things a drive that touches step 3 (or step 2) has to account for:
 *
 *  1. THE WIZARD OPENS AT STEP 1. A launch from outside goes to teams, and the
 *     plan document is chosen there.
 *  2. NOTHING IS SELECTED ON ARRIVAL. A cold visit to any step draws no plan
 *     until one is chosen.
 *  3. THE CHOOSER LIVES ON STEP 1 ONLY (B1, 2026-08-06). Steps 2 and 3 with
 *     nothing open no longer draw their own picker — they draw a pointer card
 *     (step2-plan-pointer / board-plan-pointer) that sends the operator back
 *     to step 1. So opening a plan for the board means: land on the target
 *     step cold (to prove nothing auto-opens), open the plan at step 1, then
 *     follow the URL — which now carries ?plan=<id> (B1) — back to the target
 *     step.
 *
 * `openBoard` walks that whole path and hands back what the target step
 * looked like BEFORE anything was chosen, so each suite can still pin "nothing
 * is selected on arrival" in its own words.
 */
export async function openBoard(page, planUrl, { source = null, active = true } = {}) {
  const target = new URL(planUrl)
  const step = target.searchParams.get("step") ?? "3"
  const pointerTestId = step === "2" ? "step2-plan-pointer" : "board-plan-pointer"

  // 1. A cold visit to the target step, no ?plan= on it: nothing auto-opens,
  //    so the step draws its pointer card instead of a calendar.
  const cleanUrl = new URL(target)
  cleanUrl.searchParams.delete("plan")
  await page.goto(cleanUrl.toString(), { timeout: 90000 })
  await page.waitForSelector(`[data-testid="${pointerTestId}"]`, { timeout: 120000 })
  const entry = {
    /** Nothing auto-opened: the pointer card is what a cold visit sees. */
    empty: (await page.locator(`[data-testid="${pointerTestId}"]`).count()) === 1,
    /** The pointer card's own words, for a caller that wants to pin them. */
    pointerText: (
      await page
        .locator(`[data-testid="${pointerTestId}"]`)
        .innerText()
        .catch(() => "")
    )
      .replace(/\n/g, " ")
      .trim(),
    /** Zero: no plan was auto-opened, so nothing is drawn under it either. */
    sections: await page.locator('[data-testid="weekend-gym-section"]').count(),
    weekends: await page.locator("[data-session-id]").count(),
  }

  // 2. The chooser lives on step 1 only (B1): go there and open the plan.
  const step1Url = new URL(target)
  step1Url.searchParams.set("step", "1")
  step1Url.searchParams.delete("plan")
  await page.goto(step1Url.toString(), { timeout: 90000 })
  await page.waitForSelector('[data-testid="step1-plan-empty"]', { timeout: 120000 })
  const chooser = page.locator('[data-testid="plan-open"]')
  await chooser.click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
  const wanted = source
    ? `[data-testid="plan-option"][data-source="${source}"]`
    : active
      ? '[data-testid="plan-option"][data-active="true"]'
      : '[data-testid="plan-option"]'
  await page.locator(wanted).first().click()
  await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 30000 })

  // 3. The URL now carries the plan (B1): follow it back to the target step.
  const boardUrl = new URL(page.url())
  boardUrl.searchParams.set("step", step)
  await page.goto(boardUrl.toString(), { timeout: 90000 })
  if (step === "3") {
    await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 120000 })
  } else {
    await page.waitForSelector(`[data-testid="step${step}-plan-line"]`, { timeout: 120000 })
  }
  await page.waitForTimeout(900)
  return entry
}

/**
 * Swapping which plan is open, now that the chooser lives on step 1 only
 * (B1). Used after a plan is already open on the board: hop to step 1 (the
 * URL already carries the current plan, so the header chooser is what draws),
 * pick a different one there, then follow the URL back to the step the caller
 * started on.
 */
export async function switchPlan(page, { source = null, active = null } = {}) {
  const current = new URL(page.url())
  const step = current.searchParams.get("step") ?? "3"
  const step1Url = new URL(current)
  step1Url.searchParams.set("step", "1")
  await page.goto(step1Url.toString(), { timeout: 90000 })
  await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 60000 })
  await page.locator('[data-testid="plan-picker"]').click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
  const wanted = source
    ? `[data-testid="plan-option"][data-source="${source}"]`
    : active
      ? '[data-testid="plan-option"][data-active="true"]'
      : '[data-testid="plan-option"]'
  await page.locator(wanted).first().click()
  await page.waitForTimeout(500)
  const back = new URL(page.url())
  back.searchParams.set("step", step)
  await page.goto(back.toString(), { timeout: 90000 })
  if (step === "3") {
    await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 120000 })
  } else {
    await page.waitForSelector(`[data-testid="step${step}-plan-line"]`, { timeout: 120000 })
  }
  await page.waitForTimeout(900)
}

/**
 * Opening a SPECIFIC plan by id, the way an operator does post-B1: land on
 * step 1 with nothing open (or the plan already open — either draws the
 * chooser somewhere), pick it out by its id, then follow the URL — which now
 * carries ?plan=<id> — to whichever step the caller wants. Used wherever a
 * drive needs a NAMED plan rather than "the active one" or "the imported one"
 * (openBoard covers those two by source/active).
 */
export async function openPlanFromStep1(page, targetUrl, planId) {
  const target = new URL(targetUrl)
  const step = target.searchParams.get("step") ?? "1"
  const step1Url = new URL(target)
  step1Url.searchParams.set("step", "1")
  step1Url.searchParams.delete("plan")
  await page.goto(step1Url.toString(), { timeout: 90000 })
  await page.waitForSelector('[data-testid="step1-plan-empty"]', { timeout: 90000 })
  await page.locator('[data-testid="plan-open"]').click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 30000 })
  await page.locator(`[data-testid="plan-option"][data-plan-id="${planId}"]`).click()
  await page.waitForSelector('[data-testid="step1-plan-chooser"]', { timeout: 30000 })
  if (step === "1") return
  const back = new URL(page.url())
  back.searchParams.set("step", step)
  await page.goto(back.toString(), { timeout: 90000 })
  if (step === "3") {
    // A fresh plan has no chosen weekend, so weekend-gym-section never shows.
    // And on a plan where NOTHING is used anywhere (C2, 2026-08-06 wave), every
    // month's whole leading run of ghosts collapses into one summary row, so
    // [data-session-id] itself can be genuinely absent — ghost-collapse is the
    // one thing guaranteed to appear once the board is up, whatever the plan's
    // own world looks like.
    await page.waitForSelector('[data-session-id], [data-testid="ghost-collapse"]', {
      timeout: 90000,
    })
  } else if (step === "2") {
    await page.waitForSelector('[data-testid="step2-plan-line"]', { timeout: 90000 })
  }
  await page.waitForTimeout(700)
}

/**
 * THE PACKED TRUTH, computed independently of the screen (owner ruling
 * 2026-08-05, capacity honesty): the home gym's usable courts plus the courts
 * the calendar rents, for one weekend, read off the planner API and the rented
 * court counts the card itself prints.
 */
export function packedCapacityOf(weekendVenues, rentedCourtsByVenue) {
  let capacity = 0
  for (const venue of weekendVenues) {
    if (venue.role === "home") {
      capacity += venue.capacityGames
      continue
    }
    const courts = rentedCourtsByVenue.get(venue.venueId)
    if (!courts) continue
    const wired = Math.max(1, venue.courts ?? venue.courtDays ?? 1)
    capacity += Math.min(venue.capacityGames, Math.round(courts * (venue.capacityGames / wired)))
  }
  return capacity
}
