import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "@youthbasketballhub/db"
import { defineAbilitiesFor } from "./permissions"

/**
 * Get current user from database with roles
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
