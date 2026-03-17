import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "@youthbasketballhub/db"
import { defineAbilitiesFor } from "./permissions"
import { cookies } from "next/headers"

const IMPERSONATE_COOKIE = "admin-impersonate-uid"

/**
 * Get current user from database with roles.
 * Supports admin impersonation via cookie.
 */
export async function getCurrentUser() {
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
}

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
 * Get user's abilities based on their roles
 */
export async function getUserAbilities() {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  const roles = user.roles.map((role) => ({
    role: role.role,
    tenantId: role.tenantId,
    teamId: role.teamId,
    leagueId: role.leagueId,
  }))

  return defineAbilitiesFor(user.id, roles)
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: string) {
  const user = await getCurrentUser()

  if (!user) {
    return false
  }

  return user.roles.some((r) => r.role === role)
}

/**
 * Get user's tenants (clubs they belong to)
 */
export async function getUserTenants() {
  const user = await getCurrentUser()

  if (!user) {
    return []
  }

  const tenantRoles = user.roles.filter((role) => role.tenant !== null)

  return tenantRoles.map((role) => ({
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
  return tenants.some((t) => t.id === tenantId)
}
