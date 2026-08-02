import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

/** Why publishing refuses an empty board. Lives here for the same reason the
 *  gate does: a route file may export nothing but HTTP handlers, and the
 *  publish tests assert the operator reads this exact sentence. */
export const NO_PLAN_MESSAGE =
  "There is no kept calendar to publish yet. Build one in step 3 and keep it first."

/** Shared gate for the planner routes: league owner or platform admin.
 *  (Lives outside the route files — routes may export only HTTP handlers.) */
export async function seasonPlannerAuth(seasonId: string) {
  const auth = await getSessionUserId()
  if (!auth) return { status: 401 as const, error: "Unauthorized" }
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: {
      status: true,
      label: true,
      leagueId: true,
      planPublishedAt: true,
      league: { select: { ownerId: true, name: true } },
    },
  })
  if (!season) return { status: 404 as const, error: "Not found" }
  if (season.league.ownerId !== auth.userId && !auth.isPlatformAdmin)
    return { status: 403 as const, error: "Forbidden" }
  // seasonStatus (not `status`, which is the HTTP code) so structural routes
  // can run the isSeasonLocked check without a second season lookup. Label,
  // league name and the publish timestamp ride along for the same reason:
  // the plan wizard's header and step 4 need them and this row is already
  // loaded.
  return {
    status: 200 as const,
    auth,
    seasonStatus: season.status as string,
    seasonLabel: season.label as string,
    leagueId: season.leagueId as string,
    leagueName: season.league.name as string,
    planPublishedAt: (season.planPublishedAt ?? null) as Date | null,
  }
}
