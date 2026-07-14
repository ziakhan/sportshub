import { prisma } from "@youthbasketballhub/db"

/**
 * LIGHT navigation shape for layout chrome (badge menu, bottom tabs, header
 * icons). Runs on every page render for signed-in users, so: three cheap
 * indexed queries, NO calendar/chat work — unread badges hydrate client-side
 * from /api/chat/summary. The heavy resolver (getMyContexts) is reserved for
 * the Home personal band. site-ia-plan §5.6.
 */
export interface NavShape {
  coachTeams: Array<{ teamId: string; name: string }>
  hasKids: boolean
  isRefereeing: boolean
  isClubStaff: boolean
  isLeagueOwner: boolean
  isPlatformAdmin: boolean
  isOperator: boolean
  isParticipant: boolean
}

export const EMPTY_NAV_SHAPE: NavShape = {
  coachTeams: [],
  hasKids: false,
  isRefereeing: false,
  isClubStaff: false,
  isLeagueOwner: false,
  isPlatformAdmin: false,
  isOperator: false,
  isParticipant: false,
}

export async function getNavShape(userId: string | null): Promise<NavShape> {
  if (!userId) return EMPTY_NAV_SHAPE
  try {
    const [roles, kidTeam] = await Promise.all([
      prisma.userRole.findMany({
        where: { userId },
        select: { role: true, teamId: true, team: { select: { id: true, name: true } } },
      }),
      prisma.teamPlayer.findFirst({
        where: { status: "ACTIVE", player: { parentId: userId, deletedAt: null } },
        select: { id: true },
      }),
    ])
    const roleNames = new Set(roles.map((r: any) => r.role as string))
    const coachSeen = new Set<string>()
    const coachTeams: NavShape["coachTeams"] = []
    for (const r of roles as any[]) {
      if ((r.role === "Staff" || r.role === "TeamManager") && r.team && !coachSeen.has(r.team.id)) {
        coachSeen.add(r.team.id)
        coachTeams.push({ teamId: r.team.id, name: r.team.name })
      }
    }
    const isClubStaff = roleNames.has("ClubOwner") || roleNames.has("ClubManager")
    const isLeagueOwner = roleNames.has("LeagueOwner")
    const isPlatformAdmin = roleNames.has("PlatformAdmin")
    const isRefereeing = roleNames.has("Referee")
    const hasKids = !!kidTeam
    return {
      coachTeams,
      hasKids,
      isRefereeing,
      isClubStaff,
      isLeagueOwner,
      isPlatformAdmin,
      isOperator: isClubStaff || isLeagueOwner || isPlatformAdmin,
      isParticipant: hasKids || coachTeams.length > 0 || isRefereeing,
    }
  } catch {
    return EMPTY_NAV_SHAPE
  }
}
