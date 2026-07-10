import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { isPublicPath } from "@/lib/public-paths"
import { bearerToken, verifyAccessToken } from "@/lib/native-auth-tokens"

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Auth check for protected routes. Method-aware: public API namespaces
  // are readable anonymously, but their mutating methods still require auth.
  if (!isPublicPath(pathname, req.method)) {
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

  // Handle tenant routing
  const hostname = req.headers.get("host") || ""

  let tenantSlug: string | null = null
  let isCustomDomain = false

  if (
    hostname === "app.youthbasketballhub.com" ||
    hostname === "localhost:3000" ||
    hostname.startsWith("localhost:")
  ) {
    tenantSlug = null
  } else if (hostname.endsWith(".youthbasketballhub.com")) {
    tenantSlug = hostname.split(".")[0]
  } else {
    isCustomDomain = true
  }

  const requestHeaders = new Headers(req.headers)
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
