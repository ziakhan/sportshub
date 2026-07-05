/**
 * Middleware auth allowlist.
 *
 * Design: PAGE prefixes are public as a whole (they only serve GETs), but API
 * namespaces are public for READ methods only. Before this split, allowlisting
 * a namespace like `/api/seasons` removed the middleware safety net from every
 * mutating sub-route under it (commit, submit, divisions…) — those routes
 * re-check auth internally, but one forgotten check meant silent exposure.
 * With method-awareness the middleware stays a real second line of defense.
 */

/** Unauthenticated marketing/browse pages (and their sub-pages). */
const PUBLIC_PAGE_PREFIXES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/marketplace",
  "/club",
  "/tryout",
  "/house-league",
  "/camp",
  "/events",
  "/league",
  "/invitations",
  "/live",
  "/scoresheet",
  "/news",
  "/team",
  "/player",
  "/for-clubs",
  "/for-leagues",
] as const

/** API namespaces where anonymous READ access is intended (GET/HEAD only). */
const PUBLIC_API_READ_PREFIXES = [
  "/api/house-leagues",
  "/api/camps",
  "/api/tryouts",
  "/api/leagues",
  "/api/seasons",
  "/api/venues",
  "/api/clubs/public",
  "/api/clubs/search",
  "/api/reviews",
  "/api/settings",
  "/api/health",
  "/api/live",
  "/api/scoresheet",
] as const

/** API namespaces public for ALL methods (NextAuth flows + signup are POSTs;
 * Stripe webhooks authenticate via signature, not session). */
const PUBLIC_API_ANY_METHOD_PREFIXES = ["/api/auth", "/api/webhooks/stripe"] as const

/** Dev-only utilities — never public in production. */
const DEV_ONLY_PREFIXES = ["/api/dev", "/api/create-test-users"] as const

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/"
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isPublicPath(pathname: string, method: string = "GET"): boolean {
  const upperMethod = method.toUpperCase()

  if (DEV_ONLY_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return process.env.NODE_ENV !== "production"
  }

  if (PUBLIC_API_ANY_METHOD_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return true
  }

  if (PUBLIC_API_READ_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return READ_METHODS.has(upperMethod)
  }

  if (pathname.startsWith("/api/")) {
    return false
  }

  return PUBLIC_PAGE_PREFIXES.some((p) => matchesPrefix(pathname, p))
}
