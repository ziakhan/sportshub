import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { isPublicPath } from "@/lib/public-paths"
import { bearerToken, verifyAccessToken } from "@/lib/native-auth-tokens"
import { siteUrl } from "@/lib/site"
import { isOurHost, tenantSlugFromHost } from "@/lib/domains"

// Subdomains that serve the platform itself — never treated as club slugs.
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "mail",
  "smtp",
  "admin",
  "staging",
  "dev",
  "clubs", // the CNAME target for custom domains (seo-strategy §6c)
])

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Host-based routing FIRST — a vanity URL must resolve to the public club
  // page regardless of auth state (an anonymous visitor on a club subdomain
  // should never be bounced to sign-in on the way).
  const hostname = req.headers.get("host") || ""

  // lib/domains.ts is the single domain registry (2026-07-23): both live
  // apexes serve the main site; their subdomains are club vanity hosts; a
  // host we don't own at all is (potentially) a custom club domain.
  const tenantSlug: string | null = tenantSlugFromHost(hostname)
  const isCustomDomain = !isOurHost(hostname)

  // Club subdomains are vanity front doors, not duplicate sites: 301 to the
  // canonical path URL (seo-strategy §6c — one URL per club). Reserved
  // subdomains fall through (www serves the main site, not /club/www).
  if (tenantSlug && !RESERVED_SUBDOMAINS.has(tenantSlug)) {
    return NextResponse.redirect(new URL(`/club/${tenantSlug}`, siteUrl()), 301)
  }

  // Custom club domains (Pro tier) — inert until CUSTOM_DOMAINS_ENABLED=1.
  // Only the root path is routed; the resolver page (DB lookup lives there,
  // not in edge middleware) redirects to the club page in mirror mode.
  // Unknown hosts (e.g. *.vercel.app) pass through untouched either way.
  if (
    isCustomDomain &&
    process.env.CUSTOM_DOMAINS_ENABLED === "1" &&
    pathname === "/"
  ) {
    const rewriteUrl = req.nextUrl.clone()
    rewriteUrl.pathname = `/domains/${hostname.split(":")[0].toLowerCase()}`
    return NextResponse.rewrite(rewriteUrl)
  }

  // Guest scorekeepers (2026-07-15): a one-time game-scoped token in this
  // header stands in for a session ONLY on the game-scoring APIs — the
  // route handlers validate the token against the game; the middleware just
  // lets the request reach them.
  const guestScoreToken = req.headers.get("x-guest-score-token")
  const guestScorePath = guestScoreToken && /^\/api\/games\/[^/]+\/(scoring|events|finalize)/.test(pathname)

  // Auth check for protected routes. Method-aware: public API namespaces
  // are readable anonymously, but their mutating methods still require auth.
  if (!isPublicPath(pathname, req.method) && !guestScorePath) {
    // Native-app requests authenticate with a Bearer access token (M2). The
    // JWT is verified here at the edge so the middleware stays a real second
    // line of defense; route handlers re-verify via getSessionUserId. An
    // explicit-but-invalid Bearer never falls back to the session cookie.
    const bearer = bearerToken(req.headers.get("authorization"))
    const authed = bearer
      ? (await verifyAccessToken(bearer)) !== null
      : !!(await getToken({ req, secret: process.env.NEXTAUTH_SECRET }))

    if (!authed) {
      if (pathname.startsWith("/api/")) {
        // API callers get a JSON 401, not a redirect to an HTML sign-in page.
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const signInUrl = new URL("/sign-in", req.url)
      // Keep the query string — deep links like /score?date=… must survive
      signInUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search)
      return NextResponse.redirect(signInUrl)
    }
  }

  const requestHeaders = new Headers(req.headers)
  // Expose the path to server components (Next.js doesn't). The club layout
  // reads it to gate team-only coaches out of club-wide pages (2026-07-20).
  requestHeaders.set("x-pathname", pathname)
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug)
    requestHeaders.set("x-is-custom-domain", isCustomDomain.toString())
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
