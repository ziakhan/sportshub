import { prisma } from "@youthbasketballhub/db"

/**
 * Who may run the scoring console for a game (docs/live-scoring-design.md,
 * owner-confirmed v1 access): the league owner, a platform admin, staff
 * (ClubOwner/ClubManager/Staff) of EITHER competing club, or a user assigned as
 * the game's Scorekeeper (UserRole role=Scorekeeper, gameId scoped) — mirroring
 * how referees are assigned per game.
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

  const [teams, season, gameRole] = await Promise.all([
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
    // A scorekeeper assigned to THIS game.
    prisma.userRole.findFirst({
      where: { userId, gameId: game.id, role: "Scorekeeper" },
      select: { id: true },
    }),
  ])

  if (gameRole) return true
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

/**
 * Who may view the official scoresheet (HTML page and PDF): everyone who can
 * score the game, plus the game's assigned referee(s). League/club people
 * only — the sheet is an operational record (signatures, foul detail), not a
 * public surface; families get the live page and box score instead.
 */
export async function canViewScoresheet(
  userId: string,
  isPlatformAdmin: boolean,
  game: ScorableGame
): Promise<boolean> {
  if (await canScoreGame(userId, isPlatformAdmin, game)) return true
  const refRole = await prisma.userRole.findFirst({
    where: { userId, gameId: game.id, role: "Referee" },
  })
  return !!refRole
}
