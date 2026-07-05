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
  kidLines: Array<{ name: string; points: number; rebounds: number; assists: number }>
}

export const getYourTeams = cache(async (userId: string): Promise<YourTeamCard[]> => {
  const [follows, children] = await Promise.all([
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
  ])

  const teamIds = new Set<string>(follows.map((f: any) => f.teamId))
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

  const now = new Date()
  const cards = await Promise.all(
    teams.map(async (team: any): Promise<YourTeamCard> => {
      const [last, next] = await Promise.all([
        (prisma as any).game.findFirst({
          where: {
            status: "COMPLETED",
            OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
          },
          orderBy: { scheduledAt: "desc" },
          select: {
            id: true,
            scheduledAt: true,
            homeScore: true,
            awayScore: true,
            homeTeamId: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        }),
        (prisma as any).game.findFirst({
          where: {
            status: "SCHEDULED",
            scheduledAt: { gte: now },
            OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
          },
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            scheduledAt: true,
            homeTeamId: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
            venue: { select: { name: true } },
          },
        }),
      ])

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
        const lines = await (prisma as any).playerStat.findMany({
          where: { gameId: lastGame.gameId, playerId: { in: kids.map((k) => k.id) } },
          select: { playerId: true, points: true, rebounds: true, assists: true },
        })
        const nameOf = new Map(kids.map((k) => [k.id, k.firstName]))
        kidLines = lines.map((l: any) => ({
          name: nameOf.get(l.playerId) ?? "Player",
          points: l.points,
          rebounds: l.rebounds,
          assists: l.assists,
        }))
      }

      return {
        teamId: team.id,
        teamName: team.name,
        ageGroup: team.ageGroup,
        clubName: team.tenant?.name ?? null,
        color: team.tenant?.branding?.primaryColor ?? null,
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
  )

  return cards
})
