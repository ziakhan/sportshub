import { prisma } from "@youthbasketballhub/db"
import { PUBLISHED_GAME } from "@/lib/games/visibility"

/**
 * THE referee's assigned games (QA T-012). One shared module, so the referee
 * dashboard (/referee) and My Calendar's refereeing lens can never disagree
 * about which games a referee holds — the parity law's one-data-source rule.
 *
 * Assignment is a per-game UserRole (role=Referee, gameId set), written by
 * the shift-accept flow and by schedule publish (lib/referees/shift-assign).
 * Only PUBLISHED games are ever returned: a draft is the operator's private
 * working copy, and telling a referee about a game nobody else can see is
 * exactly the ghost booking T-013 killed.
 */

export interface RefereeGame {
  id: string
  at: Date
  durationMinutes: number
  status: string
  homeTeam: string
  awayTeam: string
  venue: string | null
  /** Court within the venue when the schedule pinned one ("Court 2"). */
  court: string | null
  leagueName: string | null
  seasonLabel: string | null
  homeScore: number | null
  awayScore: number | null
  /** Agreed per-game rate from the shift this game belongs to, when there is one. */
  ratePerGame: number | null
}

export interface RefereeGamesPayload {
  upcoming: RefereeGame[]
  past: RefereeGame[]
}

/** A game that started more than this long ago has been played. */
const JUST_PLAYED_MS = 3 * 60 * 60 * 1000

/** Game ids this user is assigned to officiate (published or not). */
export async function getRefereeAssignedGameIds(userId: string): Promise<string[]> {
  const roles = await prisma.userRole.findMany({
    where: { userId, role: "Referee", gameId: { not: null } },
    select: { gameId: true },
  })
  return [...new Set(roles.map((r: any) => r.gameId as string))]
}

export async function getRefereeGames(userId: string): Promise<RefereeGamesPayload> {
  const gameIds = await getRefereeAssignedGameIds(userId)
  if (gameIds.length === 0) return { upcoming: [], past: [] }

  const games = (await (prisma as any).game.findMany({
    where: { id: { in: gameIds }, ...PUBLISHED_GAME },
    select: {
      id: true,
      dayId: true,
      scheduledAt: true,
      duration: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      venue: { select: { name: true } },
      court: { select: { name: true } },
      season: { select: { label: true, league: { select: { name: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  })) as any[]

  // The rate the referee agreed to lives on the shift, not the game — read it
  // per session day so each card can say what it pays (QA T-012 asked for
  // dates, venues AND rates).
  const dayIds = [...new Set(games.map((g) => g.dayId).filter(Boolean))] as string[]
  const rateByDay = new Map<string, number>()
  if (dayIds.length > 0) {
    const shifts = (await prisma.refereeSessionRequest.findMany({
      where: { sessionDayId: { in: dayIds }, acceptedById: userId, status: "ACCEPTED" },
      select: { sessionDayId: true, agreedRatePerGame: true, offeredRatePerGame: true },
    })) as any[]
    for (const s of shifts) {
      const rate = s.agreedRatePerGame ?? s.offeredRatePerGame
      // Decimals must cross the server/client line as numbers.
      if (rate != null) rateByDay.set(s.sessionDayId, Number(rate))
    }
  }

  const cutoff = Date.now() - JUST_PLAYED_MS
  const shape = (g: any): RefereeGame => ({
    id: g.id,
    at: g.scheduledAt,
    durationMinutes: g.duration,
    status: g.status,
    homeTeam: g.homeTeam.name,
    awayTeam: g.awayTeam.name,
    venue: g.venue?.name ?? null,
    court: g.court?.name ?? null,
    leagueName: g.season?.league?.name ?? null,
    seasonLabel: g.season?.label ?? null,
    homeScore: g.homeScore ?? null,
    awayScore: g.awayScore ?? null,
    ratePerGame: g.dayId ? (rateByDay.get(g.dayId) ?? null) : null,
  })

  const upcoming: RefereeGame[] = []
  const past: RefereeGame[] = []
  for (const g of games) {
    // A game still on the clock stays "upcoming" for its first few hours so a
    // referee mid-shift never loses the card they are working from.
    if (new Date(g.scheduledAt).getTime() >= cutoff || g.status === "LIVE") {
      upcoming.push(shape(g))
    } else {
      past.push(shape(g))
    }
  }
  past.reverse() // most recently played first

  return { upcoming, past }
}
