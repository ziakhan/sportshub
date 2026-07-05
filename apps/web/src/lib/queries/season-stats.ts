import { prisma } from "@youthbasketballhub/db"
import { cache } from "./request-cache"
import {
  aggregateSeasonStats,
  computeLeaders,
  LEADER_CATEGORIES,
  type LeaderCategory,
  type SeasonStatLine,
} from "@/lib/stats/season"
import type { MediaConsentValue } from "@/lib/privacy/names"

/**
 * Season stats assembly (plan §7): pulls PlayerStat lines from COMPLETED
 * games, maps players to teams (frozen season rosters first, live TeamPlayer
 * as fallback), and runs the pure aggregation/leaders lib. Display naming is
 * left to the caller — it's viewer-dependent (plan §11.1).
 */

export interface LeaderPlayerInfo {
  playerId: string
  firstName: string
  lastName: string
  mediaConsent: MediaConsentValue
  teamId: string
  teamName: string
  gamesPlayed: number
  value: number
  total: number
}

export interface SeasonLeaders {
  season: { id: string; label: string; leagueId: string; leagueName: string }
  categories: Array<{ key: LeaderCategory; label: string; rows: LeaderPlayerInfo[] }>
  completedGames: number
}

export const getSeasonLeaders = cache(
  async (seasonId: string, limit = 10): Promise<SeasonLeaders | null> => {
    const season = await (prisma as any).season.findUnique({
      where: { id: seasonId },
      select: { id: true, label: true, league: { select: { id: true, name: true } } },
    })
    if (!season) return null

    const games = await (prisma as any).game.findMany({
      where: { seasonId, status: "COMPLETED" },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    })
    const teamGamesPlayed: Record<string, number> = {}
    for (const g of games) {
      teamGamesPlayed[g.homeTeamId] = (teamGamesPlayed[g.homeTeamId] ?? 0) + 1
      teamGamesPlayed[g.awayTeamId] = (teamGamesPlayed[g.awayTeamId] ?? 0) + 1
    }

    const statRows = await (prisma as any).playerStat.findMany({
      where: { game: { seasonId, status: "COMPLETED" } },
      select: {
        gameId: true,
        playerId: true,
        points: true,
        rebounds: true,
        assists: true,
        steals: true,
        blocks: true,
        turnovers: true,
        fouls: true,
        player: { select: { firstName: true, lastName: true, mediaConsent: true } },
      },
    })
    if (statRows.length === 0) {
      return {
        season: {
          id: season.id,
          label: season.label,
          leagueId: season.league.id,
          leagueName: season.league.name,
        },
        categories: [],
        completedGames: games.length,
      }
    }

    // Player → team: frozen season rosters first, live rosters as fallback
    const playerTeam: Record<string, string> = {}
    const rosters = await (prisma as any).seasonRoster.findMany({
      where: { seasonId },
      select: {
        teamSubmission: { select: { teamId: true } },
        players: { select: { playerId: true } },
      },
    })
    for (const r of rosters) {
      for (const p of r.players) playerTeam[p.playerId] = r.teamSubmission.teamId
    }
    const unmapped = [...new Set(statRows.map((s: any) => s.playerId))].filter(
      (id) => !playerTeam[id as string]
    ) as string[]
    if (unmapped.length > 0) {
      const teamIds = Object.keys(teamGamesPlayed)
      const memberships = await (prisma as any).teamPlayer.findMany({
        where: { playerId: { in: unmapped }, teamId: { in: teamIds } },
        select: { playerId: true, teamId: true },
      })
      for (const m of memberships) {
        if (!playerTeam[m.playerId]) playerTeam[m.playerId] = m.teamId
      }
    }

    const teams = await (prisma as any).team.findMany({
      where: { id: { in: Object.keys(teamGamesPlayed) } },
      select: { id: true, name: true },
    })
    const teamNames: Record<string, string> = Object.fromEntries(
      teams.map((t: any) => [t.id, t.name])
    )
    const playerInfo = new Map<string, { firstName: string; lastName: string; mediaConsent: MediaConsentValue }>()
    for (const row of statRows) playerInfo.set(row.playerId, row.player)

    const lines: SeasonStatLine[] = statRows.map((r: any) => ({
      playerId: r.playerId,
      gameId: r.gameId,
      points: r.points,
      rebounds: r.rebounds,
      assists: r.assists,
      steals: r.steals,
      blocks: r.blocks,
      turnovers: r.turnovers,
      fouls: r.fouls,
    }))
    const aggregates = aggregateSeasonStats(lines)

    const categories = LEADER_CATEGORIES.map((cat) => ({
      key: cat.key,
      label: cat.label,
      rows: computeLeaders(aggregates, {
        category: cat.key,
        playerTeam,
        teamGamesPlayed,
        limit,
      }).map((row) => {
        const info = playerInfo.get(row.playerId)!
        return {
          playerId: row.playerId,
          firstName: info.firstName,
          lastName: info.lastName,
          mediaConsent: info.mediaConsent,
          teamId: row.teamId,
          teamName: teamNames[row.teamId] ?? "Unknown team",
          gamesPlayed: row.gamesPlayed,
          value: row.value,
          total: row.total,
        }
      }),
    })).filter((c) => c.rows.length > 0)

    return {
      season: {
        id: season.id,
        label: season.label,
        leagueId: season.league.id,
        leagueName: season.league.name,
      },
      categories,
      completedGames: games.length,
    }
  }
)

/**
 * The season powering the homepage leaders rail: the most recently active
 * season that actually has completed games (density-graceful — returns null
 * on a cold platform and the rail simply doesn't render).
 */
export const getFeaturedSeasonId = cache(async (): Promise<string | null> => {
  const game = await (prisma as any).game.findFirst({
    where: { status: "COMPLETED", seasonId: { not: null } },
    orderBy: { scheduledAt: "desc" },
    select: { seasonId: true },
  })
  return game?.seasonId ?? null
})

export interface PlayerGameLogRow {
  gameId: string
  dateISO: string
  opponent: string | null
  homeName: string
  awayName: string
  result: "W" | "L" | "T" | null
  teamScore: number | null
  opponentScore: number | null
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fouls: number
}

export const getPlayerSeasonData = cache(async (playerId: string) => {
  const player = await (prisma as any).player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mediaConsent: true,
      deletedAt: true,
      position: true,
      teams: {
        where: { status: "ACTIVE" },
        select: {
          jerseyNumber: true,
          team: {
            select: {
              id: true,
              name: true,
              ageGroup: true,
              tenantId: true,
              tenant: { select: { id: true, name: true, slug: true, branding: { select: { primaryColor: true } } } },
            },
          },
        },
      },
    },
  })
  if (!player || player.deletedAt) return null

  const statRows = await (prisma as any).playerStat.findMany({
    where: { playerId, game: { status: "COMPLETED" } },
    select: {
      gameId: true,
      points: true,
      rebounds: true,
      assists: true,
      steals: true,
      blocks: true,
      turnovers: true,
      fouls: true,
      game: {
        select: {
          id: true,
          scheduledAt: true,
          homeScore: true,
          awayScore: true,
          seasonId: true,
          season: { select: { leagueId: true } },
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { game: { scheduledAt: "desc" } },
  })

  const rosterTeamIds = new Set<string>(player.teams.map((t: any) => t.team.id))
  const rosterEntries = await (prisma as any).seasonRosterPlayer.findMany({
    where: { playerId },
    select: { roster: { select: { teamSubmission: { select: { teamId: true } } } } },
  })
  for (const e of rosterEntries) rosterTeamIds.add(e.roster.teamSubmission.teamId)

  const gameLog: PlayerGameLogRow[] = statRows.map((row: any) => {
    const g = row.game
    const onHome = rosterTeamIds.has(g.homeTeam.id)
    const onAway = rosterTeamIds.has(g.awayTeam.id)
    const side = onHome && !onAway ? "home" : onAway && !onHome ? "away" : null
    const teamScore = side ? (side === "home" ? g.homeScore : g.awayScore) : null
    const oppScore = side ? (side === "home" ? g.awayScore : g.homeScore) : null
    return {
      gameId: g.id,
      dateISO: new Date(g.scheduledAt).toISOString(),
      opponent: side ? (side === "home" ? g.awayTeam.name : g.homeTeam.name) : null,
      homeName: g.homeTeam.name,
      awayName: g.awayTeam.name,
      result:
        teamScore == null || oppScore == null
          ? null
          : teamScore > oppScore
            ? "W"
            : teamScore < oppScore
              ? "L"
              : "T",
      teamScore,
      opponentScore: oppScore,
      points: row.points,
      rebounds: row.rebounds,
      assists: row.assists,
      steals: row.steals,
      blocks: row.blocks,
      turnovers: row.turnovers,
      fouls: row.fouls,
    }
  })

  const aggregate =
    aggregateSeasonStats(
      statRows.map((r: any) => ({
        playerId,
        gameId: r.gameId,
        points: r.points,
        rebounds: r.rebounds,
        assists: r.assists,
        steals: r.steals,
        blocks: r.blocks,
        turnovers: r.turnovers,
        fouls: r.fouls,
      }))
    )[0] ?? null

  const leagueIds = [
    ...new Set(statRows.map((r: any) => r.game.season?.leagueId).filter(Boolean)),
  ] as string[]

  return { player, gameLog, aggregate, rosterTeamIds: [...rosterTeamIds], leagueIds }
})

export const getTeamPublicData = cache(async (teamId: string) => {
  const team = await (prisma as any).team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      gender: true,
      season: true,
      description: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          state: true,
          branding: { select: { primaryColor: true, logoUrl: true } },
        },
      },
      players: {
        where: { status: "ACTIVE", player: { deletedAt: null } },
        select: {
          jerseyNumber: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mediaConsent: true,
              position: true,
            },
          },
        },
      },
    },
  })
  if (!team) return null

  const games = await (prisma as any).game.findMany({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
      awayTeam: { select: { id: true, name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
      venue: { select: { name: true } },
      season: { select: { id: true, label: true, league: { select: { id: true, name: true } } } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 40,
  })

  let wins = 0
  let losses = 0
  let ties = 0
  for (const g of games) {
    if (g.status !== "COMPLETED" || g.homeScore == null || g.awayScore == null) continue
    const us = g.homeTeamId === teamId ? g.homeScore : g.awayScore
    const them = g.homeTeamId === teamId ? g.awayScore : g.homeScore
    if (us > them) wins++
    else if (us < them) losses++
    else ties++
  }

  // Per-player season averages across this team's completed games
  const rosterIds = team.players.map((tp: any) => tp.player.id)
  const completedGameIds = games
    .filter((g: any) => g.status === "COMPLETED")
    .map((g: any) => g.id)
  let playerAverages: Array<{ playerId: string; gamesPlayed: number; ppg: number; rpg: number; apg: number; spg: number; bpg: number }> = []
  if (rosterIds.length > 0 && completedGameIds.length > 0) {
    const rows = await (prisma as any).playerStat.findMany({
      where: { playerId: { in: rosterIds }, gameId: { in: completedGameIds } },
      select: {
        gameId: true,
        playerId: true,
        points: true,
        rebounds: true,
        assists: true,
        steals: true,
        blocks: true,
        turnovers: true,
        fouls: true,
      },
    })
    playerAverages = aggregateSeasonStats(rows)
      .sort((a, b) => b.ppg - a.ppg)
      .map((a) => ({
        playerId: a.playerId,
        gamesPlayed: a.gamesPlayed,
        ppg: a.ppg,
        rpg: a.rpg,
        apg: a.apg,
        spg: a.spg,
        bpg: a.bpg,
      }))
  }

  const posts = await (prisma as any).post.findMany({
    where: { status: "PUBLISHED", tags: { some: { teamId } } },
    select: {
      id: true,
      title: true,
      slug: true,
      body: true,
      publishedAt: true,
      kind: true,
      media: {
        select: { type: true, url: true, posterUrl: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
    orderBy: { publishedAt: "desc" },
    take: 6,
  })

  return { team, games, record: { wins, losses, ties }, playerAverages, posts }
})
