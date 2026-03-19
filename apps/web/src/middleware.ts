import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/marketplace",
  "/club",
  "/tryout",
  "/api/auth",
  "/api/auth/signup",
  "/api/clubs/public",
  "/api/clubs/search",
  "/api/reviews",
  "/api/settings",
  "/api/health",
]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => {
    if (path === "/") return pathname === "/"
    return pathname.startsWith(path)
  })
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Auth check for protected routes
  if (!isPublicPath(pathname) && !pathname.startsWith("/api/auth")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (!token) {
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
