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

export interface ChatMemberStaff {
  userId: string
  name: string
  /** Coaches are the chat admins by default; owners/managers ride along. */
  label: "Head Coach" | "Assistant Coach" | "Team Manager" | "Staff" | "Club"
}

export interface ChatMemberFamily {
  userId: string
  name: string
  playerNames: string[]
}

export interface ChatMembers {
  staff: ChatMemberStaff[]
  families: ChatMemberFamily[]
  /** All member user ids (staff + family parents) — notification fan-out. */
  userIds: string[]
}

/** Everyone in a team's chat, grouped for the members panel. */
export async function getChatMembers(teamId: string, tenantId: string): Promise<ChatMembers> {
  const [roles, roster] = await Promise.all([
    prisma.userRole.findMany({
      where: {
        tenantId,
        OR: [
          { role: { in: ["ClubOwner", "ClubManager"] } },
          { role: { in: ["Staff", "TeamManager"] }, teamId },
        ],
      },
      select: {
        userId: true,
        role: true,
        teamId: true,
        designation: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.teamPlayer.findMany({
      where: { teamId, status: "ACTIVE" },
      select: {
        player: {
          select: {
            firstName: true,
            lastName: true,
            parent: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
  ])

  // Team-scoped coaching roles outrank a tenant-wide row for the same person
  const staffByUser = new Map<string, ChatMemberStaff>()
  const labelFor = (r: (typeof roles)[number]): ChatMemberStaff["label"] => {
    if (r.designation === "HeadCoach") return "Head Coach"
    if (r.designation === "AssistantCoach") return "Assistant Coach"
    if (r.role === "TeamManager") return "Team Manager"
    if (r.role === "Staff") return "Staff"
    return "Club"
  }
  const rank = (label: ChatMemberStaff["label"]) =>
    ["Head Coach", "Assistant Coach", "Team Manager", "Staff", "Club"].indexOf(label)
  for (const r of roles) {
    const label = labelFor(r)
    const existing = staffByUser.get(r.userId)
    if (!existing || rank(label) < rank(existing.label)) {
      staffByUser.set(r.userId, {
        userId: r.userId,
        name: [r.user.firstName, r.user.lastName].filter(Boolean).join(" "),
        label,
      })
    }
  }
  const staff = [...staffByUser.values()].sort((a, b) => rank(a.label) - rank(b.label))

  const familyByParent = new Map<string, ChatMemberFamily>()
  for (const tp of roster) {
    const parent = tp.player.parent
    const playerName = [tp.player.firstName, tp.player.lastName].filter(Boolean).join(" ")
    const existing = familyByParent.get(parent.id)
    if (existing) {
      existing.playerNames.push(playerName)
    } else {
      familyByParent.set(parent.id, {
        userId: parent.id,
        name: [parent.firstName, parent.lastName].filter(Boolean).join(" "),
        playerNames: [playerName],
      })
    }
  }
  const families = [...familyByParent.values()].sort((a, b) => a.name.localeCompare(b.name))

  return {
    staff,
    families,
    userIds: [...new Set([...staffByUser.keys(), ...familyByParent.keys()])],
  }
}

/**
 * Unread message count per team for badges. Messages from others, newer
 * than the member's read cursor (everything counts if they've never opened
 * the chat).
 */
export async function getUnreadChatCounts(
  userId: string,
  teamIds: string[]
): Promise<Map<string, number>> {
  if (teamIds.length === 0) return new Map()
  const cursors = await prisma.teamChatRead.findMany({
    where: { userId, teamId: { in: teamIds } },
    select: { teamId: true, lastReadAt: true },
  })
  const cursorByTeam = new Map(
    cursors.map((c: (typeof cursors)[number]) => [c.teamId, c.lastReadAt])
  )
  const counts = new Map<string, number>()
  await Promise.all(
    teamIds.map(async (teamId) => {
      const lastReadAt = cursorByTeam.get(teamId)
      const count = await prisma.teamMessage.count({
        where: {
          teamId,
          deletedAt: null,
          senderId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      })
      if (count > 0) counts.set(teamId, count)
    })
  )
  return counts
}

export interface ChatTeamSummary {
  teamId: string
  teamName: string
  clubName: string
  unread: number
}

/**
 * Every team chat this user belongs to (staff side + family side), with
 * unread counts — powers the floating chat dock.
 */
export async function getChatTeamSummaries(userId: string): Promise<ChatTeamSummary[]> {
  const [roles, children] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId, role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] } },
      select: { role: true, tenantId: true, teamId: true },
    }),
    prisma.teamPlayer.findMany({
      where: { status: "ACTIVE", player: { parentId: userId, deletedAt: null } },
      select: { teamId: true },
    }),
  ])

  const teamIds = new Set<string>(children.map((c: { teamId: string }) => c.teamId))
  const ownerTenantIds = roles
    .filter((r: any) => (r.role === "ClubOwner" || r.role === "ClubManager") && r.tenantId)
    .map((r: any) => r.tenantId as string)
  for (const r of roles) {
    if ((r.role === "Staff" || r.role === "TeamManager") && r.teamId) teamIds.add(r.teamId)
  }
  if (ownerTenantIds.length > 0) {
    const clubTeams = await prisma.team.findMany({
      where: { tenantId: { in: ownerTenantIds } },
      select: { id: true },
    })
    for (const t of clubTeams) teamIds.add(t.id)
  }
  if (teamIds.size === 0) return []

  const [teams, unread] = await Promise.all([
    prisma.team.findMany({
      where: { id: { in: [...teamIds] } },
      select: { id: true, name: true, tenant: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    getUnreadChatCounts(userId, [...teamIds]),
  ])
  return teams
    .map((t: any) => ({
      teamId: t.id,
      teamName: t.name,
      clubName: t.tenant.name,
      unread: unread.get(t.id) ?? 0,
    }))
    .sort((a: ChatTeamSummary, b: ChatTeamSummary) => b.unread - a.unread)
}

/** Advance the read cursor and clear this chat's bell notifications. */
export async function markChatRead(userId: string, teamId: string): Promise<void> {
  await Promise.all([
    prisma.teamChatRead.upsert({
      where: { userId_teamId: { userId, teamId } },
      create: { userId, teamId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    }),
    prisma.notification.updateMany({
      where: { userId, type: "team_chat", referenceId: teamId, isRead: false },
      data: { isRead: true },
    }),
  ])
}
