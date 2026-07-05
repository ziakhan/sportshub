import { prisma } from "@youthbasketballhub/db"
import { cache } from "./request-cache"
import {
  computeStandings,
  type DivisionStandings,
  type StandingsGame,
  type TiebreakerKey,
} from "@/lib/standings/compute"

/**
 * Season standings, computed on read. Shared by the public league hub page
 * and GET /api/seasons/[id]/standings so both surfaces always agree.
 */
export interface SeasonStandings {
  seasonId: string
  seasonLabel: string
  tiebreakerOrder: TiebreakerKey[]
  divisions: DivisionStandings[]
}

export const getSeasonStandings = cache(async (seasonId: string): Promise<SeasonStandings | null> => {
  const season = (await (prisma as any).season.findUnique({
    where: { id: seasonId },
    include: {
      divisions: {
        include: {
          teamSubmissions: {
            where: { status: "APPROVED" },
            include: { team: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })) as any
  if (!season) return null

  const games = (await (prisma as any).game.findMany({
    where: { seasonId },
    select: {
      id: true,
      status: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      defaultedBy: true,
    },
  })) as StandingsGame[]

  const teamsByDivision = (season.divisions ?? []).map((d: any) => ({
    divisionId: d.id,
    divisionName: d.name,
    teams: (d.teamSubmissions ?? []).map((ts: any) => ({
      teamId: ts.teamId,
      name: ts.team?.name ?? ts.teamId,
      divisionId: d.id,
    })),
  }))

  const tiebreakerOrder: TiebreakerKey[] = Array.isArray(season.tiebreakerOrder)
    ? (season.tiebreakerOrder as TiebreakerKey[])
    : []

  return {
    seasonId,
    seasonLabel: season.label,
    tiebreakerOrder,
    divisions: computeStandings({ tiebreakerOrder, teamsByDivision, games }),
  }
})
