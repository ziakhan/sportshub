/**
 * Landing on the planner board, after the 2026-08-05 entry rulings.
 *
 * Two things changed for every drive that touches step 3:
 *
 *  1. THE WIZARD OPENS AT STEP 1. A launch from outside goes to teams, and the
 *     plan document is chosen there.
 *  2. NOTHING IS SELECTED ON ARRIVAL. Step 3 with no plan open draws the
 *     chooser, not the league's active calendar, so a drive has to open a plan
 *     the way an operator does before there is a board to assert anything about.
 *
 * `openBoard` does exactly that and hands back what the entry looked like
 * BEFORE anything was chosen, so each suite can pin rule 2 in its own words.
 */
export async function openBoard(page, planUrl, { source = null, active = true } = {}) {
  await page.goto(planUrl)
  await page.waitForSelector('[data-testid="plan-empty"]', { timeout: 120000 })
  const entry = {
    /** The fresh working state: two buttons and no calendar. */
    empty: (await page.locator('[data-testid="plan-empty"]').count()) === 1,
    /** What the head's picker says with nothing open. */
    picker: (await page.locator('[data-testid="plan-picker"]').innerText().catch(() => ""))
      .replace(/\n/g, " ")
      .trim(),
    /** Zero: no plan was auto-opened. */
    sections: await page.locator('[data-testid="weekend-gym-section"]').count(),
    weekends: await page.locator("[data-session-id]").count(),
  }
  const chooser = page.locator('[data-testid="plan-open"]')
  await chooser.click()
  await page.waitForSelector('[data-testid="plan-menu"]', { timeout: 10000 })
  const wanted = source
    ? `[data-testid="plan-option"][data-source="${source}"]`
    : active
      ? '[data-testid="plan-option"][data-active="true"]'
      : '[data-testid="plan-option"]'
  await page.locator(wanted).first().click()
  await page.waitForSelector('[data-testid="weekend-gym-section"]', { timeout: 120000 })
  await page.waitForTimeout(900)
  return entry
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
