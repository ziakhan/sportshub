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

/**
 * Per-club feature gate over TenantFeatures (owner decision 2026-07-09:
 * wire the helper, don't enforce yet). Everything is ON until pricing tiers
 * launch — flipping ENFORCE_FEATURE_GATES makes the stored flags live.
 * New gated surfaces should call this from day one so enforcement is a
 * policy change here, not a refactor.
 */
export type TenantFeatureFlag = "tournaments" | "reviews" | "chat" | "analytics"

const ENFORCE_FEATURE_GATES = false

const FLAG_COLUMN: Record<TenantFeatureFlag, "enableTournaments" | "enableReviews" | "enableChat" | "enableAnalytics"> = {
  tournaments: "enableTournaments",
  reviews: "enableReviews",
  chat: "enableChat",
  analytics: "enableAnalytics",
}

export async function hasFeature(tenantId: string, flag: TenantFeatureFlag): Promise<boolean> {
  if (!ENFORCE_FEATURE_GATES) return true
  const { prisma } = await import("@youthbasketballhub/db")
  const features = await (prisma as any).tenantFeatures.findUnique({ where: { tenantId } })
  if (!features) return flag === "reviews" // schema defaults: only reviews on
  return Boolean(features[FLAG_COLUMN[flag]])
}
