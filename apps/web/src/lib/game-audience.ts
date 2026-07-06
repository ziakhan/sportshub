import { prisma } from "@youthbasketballhub/db"

/**
 * Everyone who should hear about a change to a game — the full cascade the
 * platform replaces (league → club front office → team coaches → parents →
 * players), collapsed into one automatic fan-out. Returns deduped userIds:
 *
 *  - both clubs' front office (ClubOwner / ClubManager at the tenant)
 *  - both teams' assigned staff (head/assistant coaches, team managers — any
 *    UserRole scoped to the team)
 *  - both teams' players' accounts (Player.parentId is the parent for minors,
 *    or the player's own account for self-registered 13+; excludes removed
 *    players)
 *
 * This is the difference between "the league notified the club managers" and
 * "one cancellation reached every family automatically" — no phone tree, no
 * WhatsApp forwarding.
 */
export async function getGameAudienceUserIds(
  homeTeamId: string,
  awayTeamId: string
): Promise<string[]> {
  const teamIds = [homeTeamId, awayTeamId]
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { tenantId: true },
  })
  const tenantIds = Array.from(new Set(teams.map((t) => t.tenantId)))

  const [clubRoles, teamRoles, teamPlayers] = await Promise.all([
    prisma.userRole.findMany({
      where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true },
    }),
    prisma.userRole.findMany({
      where: { teamId: { in: teamIds } },
      select: { userId: true },
    }),
    (prisma as any).teamPlayer.findMany({
      where: { teamId: { in: teamIds }, player: { deletedAt: null } },
      select: { player: { select: { parentId: true } } },
    }),
  ])

  const ids = new Set<string>()
  for (const r of clubRoles) ids.add(r.userId)
  for (const r of teamRoles) ids.add(r.userId)
  for (const tp of teamPlayers as Array<{ player: { parentId: string | null } | null }>) {
    if (tp.player?.parentId) ids.add(tp.player.parentId)
  }
  return Array.from(ids)
}
