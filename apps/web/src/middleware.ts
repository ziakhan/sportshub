import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { isPublicPath } from "@/lib/public-paths"

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Auth check for protected routes. Method-aware: public API namespaces
  // are readable anonymously, but their mutating methods still require auth.
  if (!isPublicPath(pathname, req.method)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (!token) {
      if (pathname.startsWith("/api/")) {
        // API callers get a JSON 401, not a redirect to an HTML sign-in page.
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const signInUrl = new URL("/sign-in", req.url)
      signInUrl.searchParams.set("callbackUrl", pathname)
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
