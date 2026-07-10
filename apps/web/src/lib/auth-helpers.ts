import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "@youthbasketballhub/db"
import { cookies, headers } from "next/headers"
import { cache } from "./queries/request-cache"
import { bearerToken, verifyAccessToken } from "./native-auth-tokens"

const IMPERSONATE_COOKIE = "admin-impersonate-uid"

/**
 * Get current user from database with roles.
 * Supports admin impersonation via cookie.
 * Request-memoized: the platform layout and the page it wraps both call
 * this in the same render pass — without cache() that's a duplicated
 * 3-level include query on every authenticated page.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return null
  }

  // Check for impersonation
  let targetUserId = session.user.id
  const impersonateUid = cookies().get(IMPERSONATE_COOKIE)?.value
  if (impersonateUid) {
    // Verify the real user is a PlatformAdmin
    const adminRole = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: "PlatformAdmin" },
    })
    if (adminRole) {
      targetUserId = impersonateUid
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      roles: {
        include: {
          tenant: true,
          team: true,
          league: true,
        },
      },
    },
  })

  return user
})

/**
 * Get the real admin user ID (ignores impersonation)
 */
export async function getRealUserId() {
  const session = await getServerSession(authOptions)
  return session?.user?.id || null
}

/**
 * Check if currently impersonating
 */
export function isImpersonating() {
  return !!cookies().get(IMPERSONATE_COOKIE)?.value
}

/**
 * Get the effective user ID for API routes.
 * Respects admin impersonation — returns impersonated user's ID when active.
 * All API routes that create/own resources should use this.
 */
export async function getSessionUserId(): Promise<{
  userId: string
  /** The real signed-in account — differs from userId during impersonation. */
  realUserId: string
  isPlatformAdmin: boolean
} | null> {
  // Native-app bearer path (M2): an explicit Authorization header wins over
  // any session cookie, and an invalid one fails loudly (null → 401) rather
  // than falling through — the app must know to refresh, not silently ride a
  // stale cookie. Impersonation stays web-only by design.
  let bearer: string | null = null
  try {
    bearer = bearerToken(headers().get("authorization"))
  } catch {
    // headers() throws outside a request scope (direct handler invocation in
    // integration tests) — no bearer.
  }
  if (bearer) {
    const bearerUserId = await verifyAccessToken(bearer)
    if (!bearerUserId) return null
    const bearerAdminRole = await prisma.userRole.findFirst({
      where: { userId: bearerUserId, role: "PlatformAdmin" },
    })
    return {
      userId: bearerUserId,
      realUserId: bearerUserId,
      isPlatformAdmin: !!bearerAdminRole,
    }
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const adminRole = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: "PlatformAdmin" },
  })

  const isPlatformAdmin = !!adminRole

  // Check for impersonation
  if (isPlatformAdmin) {
    let impersonateUid: string | undefined
    try {
      impersonateUid = cookies().get(IMPERSONATE_COOKIE)?.value
    } catch {
      // cookies() throws outside a request scope (e.g. direct handler
      // invocation in integration tests) — treat as "not impersonating".
    }
    if (impersonateUid) {
      return {
        userId: impersonateUid, // Return impersonated user's ID
        realUserId: session.user.id,
        isPlatformAdmin: true,
      }
    }
  }

  return {
    userId: session.user.id,
    realUserId: session.user.id,
    isPlatformAdmin,
  }
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: string) {
  const user = await getCurrentUser()

  if (!user) {
    return false
  }

  return user.roles.some((r: any) => r.role === role)
}

/**
 * Get user's tenants (clubs they belong to)
 */
export async function getUserTenants() {
  const user = await getCurrentUser()

  if (!user) {
    return []
  }

  const tenantRoles = user.roles.filter((role: any) => role.tenant !== null)

  return tenantRoles.map((role: any) => ({
    id: role.tenant!.id,
    slug: role.tenant!.slug,
    name: role.tenant!.name,
    role: role.role,
  }))
}

/**
 * Check if user can access a tenant
 */
export async function canAccessTenant(tenantId: string) {
  const tenants = await getUserTenants()
  return tenants.some((t: any) => t.id === tenantId)
}

/**
 * Venues (and their courts/hours) are GLOBAL — shared across clubs and
 * leagues. Until a venue-ownership model exists, mutating them is limited to
 * org operators (any club/league owner or manager) or PlatformAdmin, so a
 * random signed-in member can't vandalize scheduling data everyone relies on
 * (gap-audit 2026-07-09 §2).
 */
export async function canManageVenues(sessionInfo: {
  userId: string
  isPlatformAdmin: boolean
}): Promise<boolean> {
  if (sessionInfo.isPlatformAdmin) return true
  const role = await prisma.userRole.findFirst({
    where: {
      userId: sessionInfo.userId,
      role: { in: ["ClubOwner", "ClubManager", "LeagueOwner", "LeagueManager"] },
    },
    select: { id: true },
  })
  return !!role
}
