import { prisma } from "@youthbasketballhub/db"
import { getViewerScope } from "@/lib/privacy/participants"
import { cache } from "./request-cache"

/**
 * "Your games" resolver for the Scores surfaces — shared by the web
 * /scores page and GET /api/live (the native Scores tab's data source), so
 * the two can never disagree (five-tab parity pass 2026-07-24). A game is
 * "yours" when either side is a team you play/coach/manage for (getViewerScope's
 * teamIds — your own roles + your kids' active rosters) or a team you follow.
 */
export const getYourGameTeamIds = cache(async (viewerId: string | null): Promise<Set<string>> => {
  if (!viewerId) return new Set()
  const [scope, follows] = await Promise.all([
    getViewerScope(viewerId),
    (prisma as any).follow.findMany({
      where: { userId: viewerId, teamId: { not: null } },
      select: { teamId: true },
    }),
  ])
  const teamIds = new Set<string>(scope.teamIds)
  for (const f of follows) teamIds.add(f.teamId)
  return teamIds
})

interface GameLike {
  id: string
  homeTeamId?: string | null
  awayTeamId?: string | null
  homeTeam?: { id?: string | null } | null
  awayTeam?: { id?: string | null } | null
}

/**
 * Filters an already-fetched game pool (live + upcoming + finals) down to
 * the ones involving a "your games" team. Order-preserving, no capping —
 * callers decide how many to render vs. how many to count.
 */
export function pickYourGames<T extends GameLike>(games: T[], teamIds: Set<string>): T[] {
  if (teamIds.size === 0) return []
  const isMine = (g: T) => {
    const homeId = g.homeTeamId ?? g.homeTeam?.id ?? null
    const awayId = g.awayTeamId ?? g.awayTeam?.id ?? null
    return (!!homeId && teamIds.has(homeId)) || (!!awayId && teamIds.has(awayId))
  }
  return games.filter(isMine)
}
