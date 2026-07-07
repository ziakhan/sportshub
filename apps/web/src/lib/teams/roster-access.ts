import { prisma } from "@youthbasketballhub/db"

/**
 * Who may manually manage a team's roster (add players, release, edit
 * jerseys, send player invitations)? Owner decision 2026-07-07: club
 * owners/managers AND coaches/team managers get full authority — clubs
 * run on whoever is in the gym, not on titles.
 */
export async function canManageTeamRoster(
  userId: string,
  isPlatformAdmin: boolean,
  team: { id: string; tenantId: string }
): Promise<boolean> {
  if (isPlatformAdmin) return true
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId: team.tenantId,
      OR: [
        { role: { in: ["ClubOwner", "ClubManager"] } },
        // Staff/TeamManager: team-scoped row or a tenant-wide staff row
        { role: { in: ["Staff", "TeamManager"] }, OR: [{ teamId: team.id }, { teamId: null }] },
      ],
    },
    select: { id: true },
  })
  return !!role
}
