import { prisma } from "@youthbasketballhub/db"

/**
 * Who may manually manage a team's roster (add players, release, edit
 * jerseys, send player invitations)? Club owners/managers get full authority;
 * coaches/team managers ONLY for the team their role row references.
 *
 * SECURITY FIX 2026-07-20: the old check also matched a `teamId: null` staff
 * row (a staff-pool membership with no team yet), so any staff-pool member —
 * or a coach carrying the legacy unscoped tenant row — could manage EVERY
 * team's roster in the club. That is the same class of privilege escalation
 * as the coach-scope report; a null-team staff row now grants NO roster power.
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
        // Staff/TeamManager: ONLY a row scoped to THIS team.
        { role: { in: ["Staff", "TeamManager"] }, teamId: team.id },
      ],
    },
    select: { id: true },
  })
  return !!role
}
