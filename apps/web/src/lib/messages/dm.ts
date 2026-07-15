import { prisma } from "@youthbasketballhub/db"
import { getTeamStaffUserIds } from "@/lib/teams/chat-access"

/**
 * Direct messages (owner 2026-07-15): 1:1 threads inside a team context.
 * Safeguarding: adult-to-adult (staff↔parent, staff↔staff, parent↔parent);
 * a 13+ self-managed PLAYER account may only DM team staff — no private
 * adult-to-minor channels.
 */

export type DmRole = "staff" | "parent" | "self-player" | null

/** The user's adult-membership category on a team (null = not a member). */
export async function dmRoleOnTeam(teamId: string, userId: string): Promise<DmRole> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, tenantId: true },
  })
  if (!team) return null

  const staffIds = await getTeamStaffUserIds(team.id, team.tenantId)
  if (staffIds.has(userId)) return "staff"

  const familyLinks = await prisma.teamPlayer.findMany({
    where: { teamId, status: "ACTIVE", player: { parentId: userId, deletedAt: null } },
    select: {
      player: {
        select: {
          firstName: true,
          lastName: true,
          parent: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
  if (familyLinks.length === 0) return null

  // Self-managed 13+ players use parentId = own user id and share the
  // account's name (same heuristic as chat sender contexts).
  const allSelf = familyLinks.every(
    (l: any) =>
      `${l.player.firstName} ${l.player.lastName}`.trim().toLowerCase() ===
      `${l.player.parent?.firstName ?? ""} ${l.player.parent?.lastName ?? ""}`.trim().toLowerCase()
  )
  return allSelf ? "self-player" : "parent"
}

export function dmPairAllowed(a: DmRole, b: DmRole): boolean {
  if (!a || !b) return false
  if (a === "self-player" || b === "self-player") {
    // players only talk to staff (and staff to players)
    return (a === "self-player" && b === "staff") || (b === "self-player" && a === "staff")
  }
  return true // staff↔staff, staff↔parent, parent↔parent
}

export function dmPairKey(userA: string, userB: string, teamId: string): string {
  return [...[userA, userB].sort(), teamId].join(":")
}

export async function userDisplayName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  })
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "Member"
}
