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
  "/forgot-password",
  "/reset-password",
  // Magic sign-in landing (emailed tokenized link — 2026-07-15)
  "/magic-link",
  "/marketplace",
  "/club",
  "/tryout",
  "/house-league",
  "/camp",
  "/tournament",
  "/events",
  "/league",
  "/leagues",
  "/invitations",
  "/player-invitations",
  "/live",
  // Guest scorekeeper landing (one-time tokenized link — 2026-07-15); the
  // console page itself is opened WITH the token in sessionStorage
  "/score-guest",
  "/games",
  "/news",
  "/team",
  "/player",
  // Public player handle pages (/p/<handle> → resolves to /player/<id>).
  // Missing from this list until 2026-07-12 — crawlers and logged-out parents
  // were 302'd to /sign-in, killing the shareable player URL.
  "/p",
  // Custom-domain resolver target (middleware rewrite; seo-strategy §6c)
  "/domains",
  "/scores",
  "/for-clubs",
  "/for-leagues",
  "/unsubscribed",
] as const

/** API namespaces where anonymous READ access is intended (GET/HEAD only). */
const PUBLIC_API_READ_PREFIXES = [
  // One-click unsubscribe must work signed-out (CASL); token-authenticated.
  "/api/comms/unsubscribe",
  // Public tournament browsing (/events) — GET-only; ?mine + mutations stay guarded.
  "/api/tournaments",
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
  // Native-app boot handshake (min version + publishable key) — public by design
  "/api/mobile/config",
  // Native Browse layer (anonymous, GET-only): clubs, leagues, programs,
  // news, season detail — the app's public content (audit v2 §3)
  "/api/mobile/browse",
  // Guest scorekeeper token endpoints (GET info; claim/scoring guarded by
  // the token itself server-side)
  "/api/score-invites",
  // Caddy on-demand-TLS "ask" endpoint — must answer before any cert exists,
  // so it can't require a session (GET-only; returns 200/404 by design).
  "/api/domains",
  // Personal iCal feed (GET only) — the unguessable token IS the auth
  // (phones fetch it without a session); the route 404s unknown tokens.
  "/api/calendar",
] as const

/** API namespaces public for ALL methods (NextAuth flows + signup are POSTs;
 * Stripe webhooks authenticate via signature, not session). */
const PUBLIC_API_ANY_METHOD_PREFIXES = [
  "/api/auth",
  "/api/webhooks/stripe",
  // Guest scorekeeper: claim + token-authenticated scoring pass-through —
  // each route validates the game-scoped token itself
  "/api/score-invites",
] as const

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
