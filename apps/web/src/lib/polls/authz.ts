import { prisma } from "@youthbasketballhub/db"

/**
 * "May create/manage polls at this scope" checks — three-tier polls ruling
 * (owner 2026-07-24). Mirrors the canManage check already used by
 * `api/clubs/[id]/announcements` (club) and the owner/manager check in
 * `api/leagues/[id]` PATCH (league).
 */

/** ClubOwner/ClubManager at the tenant, or PlatformAdmin. */
export async function canManageClubPolls(
  userId: string,
  tenantId: string,
  isPlatformAdmin = false
): Promise<boolean> {
  if (isPlatformAdmin) return true
  const role = await prisma.userRole.findFirst({
    where: { userId, tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
    select: { id: true },
  })
  return !!role
}

/** League owner, LeagueOwner/LeagueManager at the league, or PlatformAdmin. */
export async function canManageLeaguePolls(
  userId: string,
  leagueId: string,
  isPlatformAdmin = false
): Promise<boolean> {
  if (isPlatformAdmin) return true
  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } })
  if (!league) return false
  if (league.ownerId === userId) return true
  const role = await prisma.userRole.findFirst({
    where: { userId, leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
    select: { id: true },
  })
  return !!role
}
