import { prisma } from "@youthbasketballhub/db"
import { seasonProgress, type SeasonProgressSummary } from "./season-progress"

/**
 * Server side of the shared season pipeline (2026-08-14): load one season's
 * raw facts and run the SAME derivation the console's Season checklist runs
 * in the browser, so the dashboard hero and the checklist always agree.
 *
 * Read-only and additive: every query here is a count or a narrow select on
 * data the console already reads through its own API routes.
 *
 * One deliberate difference from the checklist: scheduler capacity is not
 * loaded (it needs the full scheduler input). Capacity only ever separates
 * "blocked" from "actionable" on the already-not-done Schedule step, so the
 * done count and the step names are identical either way. The checklist
 * itself renders that step the same way until its capacity fetch lands.
 */
export interface SeasonProgress extends SeasonProgressSummary {
  seasonId: string
  seasonLabel: string
  leagueId: string
  leagueName: string
  status: string
}

export async function loadSeasonProgress(seasonId: string): Promise<SeasonProgress | null> {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      label: true,
      status: true,
      leagueId: true,
      startDate: true,
      endDate: true,
      teamFee: true,
      depositPct: true,
      applicationQuestions: true,
      gamesGuaranteed: true,
      periodLengthMinutes: true,
      tiebreakerOrder: true,
      league: { select: { id: true, name: true } },
      teamSubmissions: { select: { status: true } },
    },
  })
  if (!season) return null

  const [divisions, sessions, venueCount, games, draftGames, completedGames, pendingEntries, brackets] =
    await Promise.all([
      (prisma as any).division.findMany({
        where: { seasonId },
        select: { _count: { select: { teamSubmissions: true } } },
      }),
      (prisma as any).seasonSession.findMany({
        where: { seasonId },
        select: {
          days: { select: { dayVenues: { select: { courts: { select: { courtId: true } } } } } },
        },
      }),
      (prisma as any).seasonVenue.count({ where: { seasonId } }),
      (prisma as any).game.count({ where: { seasonId } }),
      (prisma as any).game.count({ where: { seasonId, publishedAt: null } }),
      (prisma as any).game.count({ where: { seasonId, status: "COMPLETED" } }),
      (prisma as any).clubSeasonEntry.count({ where: { seasonId, status: "SUBMITTED" } }),
      (prisma as any).seasonSession.count({ where: { seasonId, phase: "PLAYOFF" } }),
    ])

  const summary = seasonProgress({
    status: season.status,
    startDate: season.startDate,
    endDate: season.endDate,
    teamFee: season.teamFee,
    depositPct: season.depositPct,
    applicationQuestions: season.applicationQuestions,
    gamesGuaranteed: season.gamesGuaranteed,
    periodLengthMinutes: season.periodLengthMinutes,
    tiebreakerOrder: season.tiebreakerOrder,
    divisionTeamCounts: divisions.map((d: any) => d._count?.teamSubmissions ?? 0),
    sessions,
    venueCount,
    submissionStatuses: season.teamSubmissions.map((t: any) => t.status),
    pendingEntries,
    games: { total: games, draft: draftGames, completed: completedGames },
    bracketCount: brackets,
    capacity: null,
  })

  return {
    ...summary,
    seasonId: season.id,
    seasonLabel: season.label,
    leagueId: season.leagueId,
    leagueName: season.league?.name ?? "League",
    status: season.status,
  }
}
