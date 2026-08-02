import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

/** Shared gate for the planner routes: league owner or platform admin.
 *  (Lives outside the route files — routes may export only HTTP handlers.) */
export async function seasonPlannerAuth(seasonId: string) {
  const auth = await getSessionUserId()
  if (!auth) return { status: 401 as const, error: "Unauthorized" }
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { status: true, leagueId: true, league: { select: { ownerId: true } } },
  })
  if (!season) return { status: 404 as const, error: "Not found" }
  if (season.league.ownerId !== auth.userId && !auth.isPlatformAdmin)
    return { status: 403 as const, error: "Forbidden" }
  // seasonStatus (not `status`, which is the HTTP code) so structural routes
  // can run the isSeasonLocked check without a second season lookup.
  return {
    status: 200 as const,
    auth,
    seasonStatus: season.status as string,
    leagueId: season.leagueId as string,
  }
}
