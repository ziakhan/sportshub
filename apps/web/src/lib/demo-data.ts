/**
 * Simulator/e2e worlds create tenants with slugs like "wvzi8ep-club-373"
 * (w + 6 random alphanumerics incl. a digit + "-"). Public BROWSE surfaces
 * filter them out so test data never outranks the 188 real imported clubs.
 * Detail pages still render them by direct URL (harmless, and tests rely on
 * it). Proper fix later: a Tenant.isTestData flag set by the world seeders.
 */
export function isTestWorldSlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  const m = slug.match(/^w([a-z0-9]{6})-/)
  return !!m && /[0-9]/.test(m[1]) // real slugs like "windsor-suns" have no digit
}
