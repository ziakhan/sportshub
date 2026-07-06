import { prisma } from "@youthbasketballhub/db"

/**
 * Team chat membership — who's in a team's family chat and with what powers.
 *
 * staff  — club owners/managers (tenant-wide) or Staff/TeamManager assigned
 *          to THIS team. Can delete any message (moderation).
 * family — parent of an ACTIVE rostered player (self-registered 13+ players
 *          are their own parent, so they're covered).
 * admin  — platform admin; same powers as staff.
 */
export type ChatRole = "staff" | "family" | "admin"

export interface ChatMembership {
  role: ChatRole
  teamId: string
  teamName: string
  tenantId: string
  clubName: string
}

export async function getChatMembership(
  teamId: string,
  userId: string,
  isPlatformAdmin = false
): Promise<ChatMembership | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } },
  })
  if (!team) return null

  const base = {
    teamId: team.id,
    teamName: team.name,
    tenantId: team.tenantId,
    clubName: team.tenant.name,
  }

  if (isPlatformAdmin) return { role: "admin", ...base }

  const staffRole = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId: team.tenantId,
      OR: [
        { role: { in: ["ClubOwner", "ClubManager"] } },
        { role: { in: ["Staff", "TeamManager"] }, teamId: team.id },
      ],
    },
    select: { id: true },
  })
  if (staffRole) return { role: "staff", ...base }

  const rosteredChild = await prisma.teamPlayer.findFirst({
    where: { teamId: team.id, status: "ACTIVE", player: { parentId: userId } },
    select: { id: true },
  })
  if (rosteredChild) return { role: "family", ...base }

  return null
}

/** Staff-level user ids for a team — used to badge senders as Coach/Club. */
export async function getTeamStaffUserIds(
  teamId: string,
  tenantId: string
): Promise<Set<string>> {
  const roles = await prisma.userRole.findMany({
    where: {
      tenantId,
      OR: [
        { role: { in: ["ClubOwner", "ClubManager"] } },
        { role: { in: ["Staff", "TeamManager"] }, teamId },
      ],
    },
    select: { userId: true },
  })
  return new Set(roles.map((r: { userId: string }) => r.userId))
}
