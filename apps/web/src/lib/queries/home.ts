import { prisma } from "@youthbasketballhub/db"
import { cache } from "./request-cache"

/**
 * "Your teams" rail (plan §3 signed-in state): the viewer's followed teams
 * UNION their children's teams (parents auto-follow — derived at query time,
 * not materialized). Per team: last result, next game, and the kid's line
 * from the last game (the GameChanger retention loop).
 */

export interface YourTeamCard {
  teamId: string
  teamName: string
  ageGroup: string
  clubName: string | null
  color: string | null
  /** Viewer's kids on this team — empty means it's here via an explicit follow */
  kidNames: string[]
  lastGame: {
    gameId: string
    opponent: string
    us: number
    them: number
    result: "W" | "L" | "T"
    dateISO: string
  } | null
  nextGame: {
    gameId: string
    opponent: string
    dateISO: string
    venue: string | null
  } | null
  kidLines: Array<{ playerId: string; name: string; points: number; rebounds: number; assists: number }>
}

export const getYourTeams = cache(async (userId: string): Promise<YourTeamCard[]> => {
  const [follows, children, staffRoles] = await Promise.all([
    (prisma as any).follow.findMany({
      where: { userId, teamId: { not: null } },
      select: { teamId: true },
    }),
    (prisma as any).player.findMany({
      where: { parentId: userId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        teams: { where: { status: "ACTIVE" }, select: { teamId: true } },
      },
    }),
    // Coached teams belong on the rail too (UX audit 2026-07-18 — native
    // showed them, the web query didn't; same rule as nav-shape.coachTeams)
    (prisma as any).userRole.findMany({
      where: { userId, teamId: { not: null }, role: { in: ["Staff", "TeamManager"] } },
      select: { teamId: true },
    }),
  ])

  const teamIds = new Set<string>(follows.map((f: any) => f.teamId))
  for (const r of staffRoles) teamIds.add(r.teamId)
  const childrenByTeam = new Map<string, Array<{ id: string; firstName: string }>>()
  for (const child of children) {
    for (const tp of child.teams) {
      teamIds.add(tp.teamId)
      const list = childrenByTeam.get(tp.teamId) ?? []
      list.push({ id: child.id, firstName: child.firstName })
      childrenByTeam.set(tp.teamId, list)
    }
  }
  if (teamIds.size === 0) return []

  const ids = [...teamIds].slice(0, 6)
  const teams = await (prisma as any).team.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      tenant: { select: { name: true, branding: { select: { primaryColor: true } } } },
    },
  })

  // Batched (was 2 game.findFirst + 1 playerStat.findMany PER TEAM): pull
  // recent/upcoming games for all cards' teams at once and pick each team's
  // newest/soonest in JS. take-bounds are safety rails, generous vs a youth
  // season (≤6 teams × ~40 games).
  const now = new Date()
  const teamOr = [{ homeTeamId: { in: ids } }, { awayTeamId: { in: ids } }]
  const [completed, upcoming] = await Promise.all([
    (prisma as any).game.findMany({
      where: { status: "COMPLETED", OR: teamOr },
      orderBy: { scheduledAt: "desc" },
      take: 300,
      select: {
        id: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
    (prisma as any).game.findMany({
      where: { status: "SCHEDULED", scheduledAt: { gte: now }, OR: teamOr },
      orderBy: { scheduledAt: "asc" },
      take: 300,
      select: {
        id: true,
        scheduledAt: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        venue: { select: { name: true } },
      },
    }),
  ])

  // Rows are sorted (desc / asc) — first hit per team is its last / next game
  const lastByTeam = new Map<string, (typeof completed)[number]>()
  for (const g of completed) {
    for (const teamId of [g.homeTeamId, g.awayTeamId]) {
      if (teamIds.has(teamId) && !lastByTeam.has(teamId)) lastByTeam.set(teamId, g)
    }
  }
  const nextByTeam = new Map<string, (typeof upcoming)[number]>()
  for (const g of upcoming) {
    for (const teamId of [g.homeTeamId, g.awayTeamId]) {
      if (teamIds.has(teamId) && !nextByTeam.has(teamId)) nextByTeam.set(teamId, g)
    }
  }

  // One stat query for every kid line across all cards
  const statPairs = ids.flatMap((teamId) => {
    const kids = childrenByTeam.get(teamId) ?? []
    const last = lastByTeam.get(teamId)
    return kids.length > 0 && last
      ? [{ gameId: last.id, playerId: { in: kids.map((k) => k.id) } }]
      : []
  })
  const statLines =
    statPairs.length > 0
      ? await (prisma as any).playerStat.findMany({
          where: { OR: statPairs },
          select: { gameId: true, playerId: true, points: true, rebounds: true, assists: true },
        })
      : []

  const cards = teams.map((team: any): YourTeamCard => {
    const last = lastByTeam.get(team.id)
    let lastGame: YourTeamCard["lastGame"] = null
    if (last && last.homeScore != null && last.awayScore != null) {
      const isHome = last.homeTeamId === team.id
      const us = isHome ? last.homeScore : last.awayScore
      const them = isHome ? last.awayScore : last.homeScore
      lastGame = {
        gameId: last.id,
        opponent: isHome ? last.awayTeam.name : last.homeTeam.name,
        us,
        them,
        result: us > them ? "W" : us < them ? "L" : "T",
        dateISO: new Date(last.scheduledAt).toISOString(),
      }
    }

    const kids = childrenByTeam.get(team.id) ?? []
    let kidLines: YourTeamCard["kidLines"] = []
    if (lastGame && kids.length > 0) {
      const kidIds = new Set(kids.map((k) => k.id))
      const nameOf = new Map(kids.map((k) => [k.id, k.firstName]))
      kidLines = statLines
        .filter((l: any) => l.gameId === lastGame!.gameId && kidIds.has(l.playerId))
        .map((l: any) => ({
          playerId: l.playerId,
          name: nameOf.get(l.playerId) ?? "Player",
          points: l.points,
          rebounds: l.rebounds,
          assists: l.assists,
        }))
    }

    const next = nextByTeam.get(team.id)
    return {
      teamId: team.id,
      teamName: team.name,
      ageGroup: team.ageGroup,
      clubName: team.tenant?.name ?? null,
      color: team.tenant?.branding?.primaryColor ?? null,
      kidNames: [...new Set(kids.map((k) => k.firstName))],
      lastGame,
      nextGame: next
        ? {
            gameId: next.id,
            opponent: next.homeTeamId === team.id ? next.awayTeam.name : next.homeTeam.name,
            dateISO: new Date(next.scheduledAt).toISOString(),
            venue: next.venue?.name ?? null,
          }
        : null,
      kidLines,
    }
  })

  return cards
})
