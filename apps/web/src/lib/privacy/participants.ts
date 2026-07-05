import { prisma } from "@youthbasketballhub/db"
import { cache } from "@/lib/queries/request-cache"

/**
 * Viewer participation scope (plan §11.1): signed-in participants of a
 * league/club see full player names; everyone else gets the public rule
 * (publicPlayerName). Participation = any UserRole scoped there, or being
 * the parent of a player rostered on one of its teams.
 */

export interface ViewerScope {
  tenantIds: Set<string>
  leagueIds: Set<string>
  teamIds: Set<string>
  /** The viewer's own children (always full-name visible to them) */
  playerIds: Set<string>
}

const EMPTY: ViewerScope = {
  tenantIds: new Set(),
  leagueIds: new Set(),
  teamIds: new Set(),
  playerIds: new Set(),
}

export const getViewerScope = cache(async (userId: string | null): Promise<ViewerScope> => {
  if (!userId) return EMPTY

  const scope: ViewerScope = {
    tenantIds: new Set(),
    leagueIds: new Set(),
    teamIds: new Set(),
    playerIds: new Set(),
  }

  const [roles, children] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId },
      select: {
        tenantId: true,
        leagueId: true,
        teamId: true,
        team: { select: { tenantId: true } },
      },
    }),
    (prisma as any).player.findMany({
      where: { parentId: userId, deletedAt: null },
      select: {
        id: true,
        teams: {
          where: { status: "ACTIVE" },
          select: { teamId: true, team: { select: { tenantId: true } } },
        },
      },
    }),
  ])

  for (const r of roles) {
    if (r.tenantId) scope.tenantIds.add(r.tenantId)
    if (r.leagueId) scope.leagueIds.add(r.leagueId)
    if (r.teamId) {
      scope.teamIds.add(r.teamId)
      if (r.team?.tenantId) scope.tenantIds.add(r.team.tenantId)
    }
  }
  for (const child of children) {
    scope.playerIds.add(child.id)
    for (const tp of child.teams) {
      scope.teamIds.add(tp.teamId)
      if (tp.team?.tenantId) scope.tenantIds.add(tp.team.tenantId)
    }
  }

  // League participation flows from the viewer's teams' season submissions
  if (scope.teamIds.size > 0) {
    const subs = await prisma.teamSubmission.findMany({
      where: { teamId: { in: [...scope.teamIds] } },
      select: { season: { select: { leagueId: true } } },
    })
    for (const s of subs) scope.leagueIds.add(s.season.leagueId)
  }

  return scope
})

/** Is the viewer a participant of the given league/club/team context? */
export function isParticipant(
  scope: ViewerScope,
  target: { tenantId?: string | null; leagueId?: string | null; teamId?: string | null }
): boolean {
  return (
    (!!target.tenantId && scope.tenantIds.has(target.tenantId)) ||
    (!!target.leagueId && scope.leagueIds.has(target.leagueId)) ||
    (!!target.teamId && scope.teamIds.has(target.teamId))
  )
}
