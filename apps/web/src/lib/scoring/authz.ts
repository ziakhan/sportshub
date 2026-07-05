import { prisma } from "@youthbasketballhub/db"

/**
 * Who may run the scoring console for a game (docs/live-scoring-design.md,
 * owner-confirmed v1 access): the league owner, a platform admin, or staff
 * (ClubOwner/ClubManager/Staff) of EITHER competing club. Scorekeeper
 * assignment (Game.scorekeepers) is deferred — when it ships, assigned
 * scorekeepers join this list.
 */

export interface ScorableGame {
  id: string
  homeTeamId: string
  awayTeamId: string
  seasonId: string | null
}

export async function canScoreGame(
  userId: string,
  isPlatformAdmin: boolean,
  game: ScorableGame
): Promise<boolean> {
  if (isPlatformAdmin) return true

  const [teams, season] = await Promise.all([
    prisma.team.findMany({
      where: { id: { in: [game.homeTeamId, game.awayTeamId] } },
      select: { tenantId: true },
    }),
    game.seasonId
      ? (prisma as any).season.findUnique({
          where: { id: game.seasonId },
          select: { league: { select: { ownerId: true } } },
        })
      : Promise.resolve(null),
  ])

  if (season?.league?.ownerId === userId) return true

  const tenantIds = Array.from(new Set(teams.map((t: any) => t.tenantId)))
  if (tenantIds.length === 0) return false
  const staffRole = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId: { in: tenantIds },
      role: { in: ["ClubOwner", "ClubManager", "Staff"] },
    },
  })
  return !!staffRole
}
