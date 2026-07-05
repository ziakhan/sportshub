/**
 * Family Pass entitlement gate (docs/public-site-content-plan.md §12).
 *
 * Owner decision 2026-07-05: everything is FREE through P1/P2 to build the
 * habit; premium (real-time "your kid" notifications, full game logs,
 * downloadable highlights, keepsakes) launches with P3. Premium surfaces must
 * gate through this helper from day one so flipping the paywall on is a
 * policy change here, not a refactor across pages.
 */
export async function hasFamilyPass(_userId: string | null): Promise<boolean> {
  return true
}
