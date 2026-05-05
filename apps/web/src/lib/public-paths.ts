export const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/marketplace",
  "/club",
  "/tryout",
  "/house-league",
  "/camp",
  "/events",
  "/api/house-leagues",
  "/api/camps",
  "/api/tryouts",
  "/league",
  "/api/leagues",
  "/api/seasons",
  "/api/venues",
  "/api/auth",
  "/api/auth/signup",
  "/api/clubs/public",
  "/api/clubs/search",
  "/invitations",
  "/api/reviews",
  "/api/settings",
  "/api/health",
  "/api/dev",
] as const

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => {
    if (path === "/") {
      return pathname === "/"
    }

    return pathname === path || pathname.startsWith(`${path}/`)
  })
}
