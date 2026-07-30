import { prisma } from "@youthbasketballhub/db"

/**
 * Games played per player, from the scorekeeper's ATTENDANCE roll call
 * (owner 2026-07-29: eligibility is settled by the attendance record taken
 * at the start of every scored game, not by memory). Counts COMPLETED
 * season games only; games with no attendance recorded count for nobody.
 */
export async function getGamesPlayed(
  seasonId: string,
  teamId: string
): Promise<Map<string, number>> {
  const events = await (prisma as any).gameEvent.findMany({
    where: {
      eventType: "ATTENDANCE",
      teamId,
      voided: false,
      game: { seasonId, status: "COMPLETED" },
    },
    select: { gameId: true, sequence: true, metadata: true },
    orderBy: { sequence: "asc" },
  })
  // Last attendance event per game wins (re-taken roll call replaces).
  const perGame = new Map<string, string[]>()
  for (const e of events) {
    const present = Array.isArray(e.metadata?.presentIds) ? e.metadata.presentIds : []
    perGame.set(e.gameId, present)
  }
  const counts = new Map<string, number>()
  for (const present of perGame.values()) {
    for (const playerId of present) {
      counts.set(playerId, (counts.get(playerId) ?? 0) + 1)
    }
  }
  return counts
}

export interface EligibilityRow {
  gamesPlayed: number
  /** null when the season has no playoffMinGames rule */
  eligible: boolean | null
  overridden: boolean
  overrideNote: string | null
}

/** Merge GP counts, the season rule, and commissioner overrides. */
export function computeEligibility(
  playerIds: string[],
  gamesPlayed: Map<string, number>,
  playoffMinGames: number | null,
  overrides: Map<string, { eligible: boolean; note: string }>
): Map<string, EligibilityRow> {
  const out = new Map<string, EligibilityRow>()
  for (const id of playerIds) {
    const gp = gamesPlayed.get(id) ?? 0
    const o = overrides.get(id)
    out.set(id, {
      gamesPlayed: gp,
      eligible:
        playoffMinGames == null ? null : o ? o.eligible : gp >= playoffMinGames,
      overridden: !!o,
      overrideNote: o?.note ?? null,
    })
  }
  return out
}
