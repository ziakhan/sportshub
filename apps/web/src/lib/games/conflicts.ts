import { prisma } from "@youthbasketballhub/db"

/**
 * Shared placement-conflict check (Schedule Studio P0): one source for the
 * game PATCH, swap, validate, and reschedule-suggestion paths — the overlap
 * logic used to live inline in two routes and disagreed with itself.
 *
 * Team double-booking is checked across ALL seasons (a team can't be in two
 * places), and court double-booking across ALL leagues (shared venues —
 * owner 2026-07-31: never double-book another league's court time).
 */
export interface PlacementCheck {
  /** Games to ignore (the game being moved, its swap partner). */
  excludeGameIds?: string[]
  homeTeamId: string
  awayTeamId: string
  courtId?: string | null
  start: Date
  durationMinutes: number
}

export async function findPlacementConflicts(check: PlacementCheck): Promise<string[]> {
  const end = new Date(check.start.getTime() + check.durationMinutes * 60000)
  // Widest plausible other-game window: nothing longer than 6h matters.
  const windowFrom = new Date(check.start.getTime() - 6 * 3600_000)

  const overlappers = await (prisma as any).game.findMany({
    where: {
      ...(check.excludeGameIds?.length ? { id: { notIn: check.excludeGameIds } } : {}),
      status: { in: ["SCHEDULED", "LIVE", "POSTPONED"] },
      scheduledAt: { gte: windowFrom, lt: end },
      OR: [
        { homeTeamId: { in: [check.homeTeamId, check.awayTeamId] } },
        { awayTeamId: { in: [check.homeTeamId, check.awayTeamId] } },
        ...(check.courtId ? [{ courtId: check.courtId }] : []),
      ],
    },
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      homeTeamId: true,
      awayTeamId: true,
      courtId: true,
      season: { select: { league: { select: { name: true } } } },
    },
  })

  const conflicts: string[] = []
  for (const g of overlappers) {
    const gStart = new Date(g.scheduledAt)
    const gEnd = new Date(gStart.getTime() + (g.duration ?? 90) * 60000)
    if (!(gStart < end && check.start < gEnd)) continue
    if (g.homeTeamId === check.homeTeamId || g.awayTeamId === check.homeTeamId)
      conflicts.push(`Home team double-booked against game ${g.id}`)
    if (g.homeTeamId === check.awayTeamId || g.awayTeamId === check.awayTeamId)
      conflicts.push(`Away team double-booked against game ${g.id}`)
    if (check.courtId && g.courtId === check.courtId) {
      const league = g.season?.league?.name
      conflicts.push(
        `Court double-booked against game ${g.id}${league ? ` (${league})` : ""}`
      )
    }
  }
  return conflicts
}
