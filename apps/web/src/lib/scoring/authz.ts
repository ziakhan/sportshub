import { prisma } from "@youthbasketballhub/db"

/**
 * Who may run the scoring console for a game. Owner ruling 2026-07-20
 * (tightened from the earlier "any staff of either competing club", which let
 * a coach of an UNRELATED team score any game): scoring is limited to the two
 * playing teams' people plus the competition operators —
 *   - platform admin;
 *   - the game's assigned Scorekeeper (UserRole role=Scorekeeper, gameId
 *     scoped — this is how the LEAGUE assigns a scorekeeper);
 *   - the league owner of the game's season;
 *   - a ClubOwner/ClubManager of either competing club (club admins oversee
 *     their own club's games);
 *   - team-scoped Staff/TeamManager of the HOME or AWAY team — i.e. the head
 *     coach, assistant coaches, and team manager of the two teams playing.
 * A Staff row scoped to some OTHER team (or an unscoped staff-pool row) grants
 * nothing here.
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

  // Club admins of either competing club (club-wide by design).
  const adminRole = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId: { in: tenantIds },
      role: { in: ["ClubOwner", "ClubManager"] },
    },
    select: { id: true },
  })
  if (adminRole) return true

  // Team staff of one of the two teams actually playing (owner ruling
  // 2026-07-20): head/assistant coaches (Staff) + team manager (TeamManager),
  // scoped to home/away — NOT staff of an unrelated team in the same club.
  const teamStaff = await prisma.userRole.findFirst({
    where: {
      userId,
      teamId: { in: [game.homeTeamId, game.awayTeamId] },
      role: { in: ["Staff", "TeamManager"] },
    },
    select: { id: true },
  })
  return !!teamStaff
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
