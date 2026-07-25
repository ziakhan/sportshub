/**
 * Standings-movement MILESTONE cards (business-model-v2.md §12/§16 S1):
 * "Lords jump to 2nd in U12 East" — fired at finalize when a team's
 * division rank IMPROVES as a result of this game's result.
 *
 * Reuses standings/compute.ts (the same pure engine the public standings
 * page and API use) twice: once over the season's COMPLETED/DEFAULTED games
 * EXCLUDING this game ("before"), once including it ("after"). No snapshot
 * needed — this game is already COMPLETED in the DB by the time finalize
 * calls this, so "after" is just "the current standings" and "before" is
 * "the current standings minus one game".
 */

import { prisma } from "@youthbasketballhub/db"
import {
  computeStandings,
  type DivisionStandings,
  type StandingsGame,
  type TiebreakerKey,
} from "../standings/compute"

/** "1st" / "2nd" / "3rd" / "4th" / "11th" / "21st" ... */
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`
}

export interface RankChange {
  teamId: string
  teamName: string
  divisionId: string
  divisionName: string
  rankBefore: number | null
  rankAfter: number
}

function rankOf(
  divisions: DivisionStandings[],
  teamId: string
): { rank: number; divisionId: string; divisionName: string; gamesPlayed: number } | null {
  for (const d of divisions) {
    const idx = d.rows.findIndex((r) => r.teamId === teamId)
    if (idx >= 0)
      return {
        rank: idx + 1,
        divisionId: d.divisionId,
        divisionName: d.divisionName,
        gamesPlayed: d.rows[idx].gamesPlayed,
      }
  }
  return null
}

/**
 * Pure: given the season's team-by-division roster and its COMPLETED game
 * list, return the teams (of the two passed in) whose rank IMPROVED once
 * `gameId` is included. Exported standalone so it's unit-testable without a
 * database — the DB-touching wrapper below is a thin fetch-and-call.
 */
export function computeRankChanges(input: {
  gameId: string
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
  tiebreakerOrder: TiebreakerKey[]
  teamsByDivision: Array<{ divisionId: string; divisionName: string; teams: { teamId: string; name: string; divisionId: string }[] }>
  games: StandingsGame[]
}): RankChange[] {
  const { gameId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, tiebreakerOrder, teamsByDivision, games } = input
  const gamesBefore = games.filter((g) => g.id !== gameId)
  const before = computeStandings({ tiebreakerOrder, teamsByDivision, games: gamesBefore })
  const after = computeStandings({ tiebreakerOrder, teamsByDivision, games })

  const out: RankChange[] = []
  for (const [teamId, teamName] of [
    [homeTeamId, homeTeamName],
    [awayTeamId, awayTeamName],
  ] as const) {
    const a = rankOf(after, teamId)
    if (!a) continue
    const b = rankOf(before, teamId)
    // No meaningful "before" baseline (the team's first game of the season) —
    // every team ties at 0-0 pre-season, and that tie order is an array-
    // insertion artifact, not a real rank. Skip rather than fire a false
    // "jump" off a season opener.
    if (!b || b.gamesPlayed === 0) continue
    if (a.rank >= b.rank) continue // unchanged or worse — not a "jump"
    out.push({
      teamId,
      teamName,
      divisionId: a.divisionId,
      divisionName: a.divisionName,
      rankBefore: b.rank,
      rankAfter: a.rank,
    })
  }
  return out
}

/**
 * Fetch this game's season standings context, compute rank changes, and
 * publish a MILESTONE Post per team that jumped. Best-effort — the caller
 * (finalize) wraps this in try/catch.
 */
export async function detectAndPublishStandingsMovement(gameId: string): Promise<{ created: number }> {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      seasonId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })
  if (!game || !game.seasonId) return { created: 0 }

  const season = await (prisma as any).season.findUnique({
    where: { id: game.seasonId },
    select: {
      tiebreakerOrder: true,
      divisions: {
        select: {
          id: true,
          name: true,
          teamSubmissions: {
            where: { status: "APPROVED" },
            select: { teamId: true, team: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })
  if (!season) return { created: 0 }

  // Only divisions the two teams could actually be in need standings computed,
  // but computing the whole season is simpler and still cheap (one season's
  // worth of games, not the whole league).
  const teamsByDivision = season.divisions.map((d: any) => ({
    divisionId: d.id,
    divisionName: d.name,
    teams: d.teamSubmissions.map((ts: any) => ({
      teamId: ts.teamId,
      name: ts.team?.name ?? ts.teamId,
      divisionId: d.id,
    })),
  }))
  const inAnyDivision = teamsByDivision.some((d: any) =>
    d.teams.some((t: any) => t.teamId === game.homeTeamId || t.teamId === game.awayTeamId)
  )
  if (!inAnyDivision) return { created: 0 }

  const games = await (prisma as any).game.findMany({
    where: { seasonId: game.seasonId, status: { in: ["COMPLETED", "DEFAULTED"] } },
    select: { id: true, status: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, defaultedBy: true },
  })

  const changes = computeRankChanges({
    gameId,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeTeamName: game.homeTeam.name,
    awayTeamName: game.awayTeam.name,
    tiebreakerOrder: (season.tiebreakerOrder ?? []) as TiebreakerKey[],
    teamsByDivision,
    games,
  })

  let created = 0
  for (const c of changes) {
    const slug = `milestone-standings-${c.teamId}-${gameId}`
    const title = `${c.teamName} jump${c.teamName.endsWith("s") ? "" : "s"} to ${ordinal(c.rankAfter)} in ${c.divisionName}`
    const body =
      c.rankBefore != null
        ? `${c.teamName} moved from ${ordinal(c.rankBefore)} to ${ordinal(c.rankAfter)} in ${c.divisionName} after tonight's result.`
        : `${c.teamName} is now ${ordinal(c.rankAfter)} in ${c.divisionName}.`
    await (prisma as any).post.upsert({
      where: { slug },
      create: {
        kind: "MILESTONE",
        title,
        slug,
        body,
        status: "PUBLISHED",
        publishedAt: new Date(),
        visibility: "PUBLIC",
        tags: { create: [{ gameId }, { teamId: c.teamId }] },
      },
      update: { title, body, status: "PUBLISHED" },
    })
    created++
  }
  return { created }
}
