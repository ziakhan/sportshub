/**
 * Season stat aggregation + leaders (docs/public-site-content-plan.md §7).
 *
 * Pure — same contract style as scoring/fold and standings/compute: takes
 * plain rows (PlayerStat lines from COMPLETED games), returns plain results;
 * the server assembles inputs and attaches names/teams for display.
 *
 * Eligibility for leader boards follows the MaxPreps convention: a player
 * must have appeared in at least `minGamesFraction` (default 50%) of their
 * TEAM's completed games, so a two-game hot streak can't top a 12-game
 * season. Players with no team mapping can't establish a denominator and
 * are excluded.
 */

export interface SeasonStatLine {
  playerId: string
  gameId: string
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fouls: number
  minutesPlayed?: number | null
}

export interface PlayerSeasonAggregate {
  playerId: string
  gamesPlayed: number
  // Season totals
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fouls: number
  // Per-game averages, rounded to 1 decimal
  ppg: number
  rpg: number
  apg: number
  spg: number
  bpg: number
  topg: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Fold per-game stat lines into one aggregate row per player. */
export function aggregateSeasonStats(lines: SeasonStatLine[]): PlayerSeasonAggregate[] {
  const byPlayer = new Map<string, { games: Set<string>; totals: number[] }>()
  for (const l of lines) {
    let acc = byPlayer.get(l.playerId)
    if (!acc) {
      acc = { games: new Set(), totals: [0, 0, 0, 0, 0, 0, 0] }
      byPlayer.set(l.playerId, acc)
    }
    // PlayerStat is unique per (game, player); the Set guards against a
    // caller accidentally passing duplicate rows.
    if (acc.games.has(l.gameId)) continue
    acc.games.add(l.gameId)
    acc.totals[0] += l.points
    acc.totals[1] += l.rebounds
    acc.totals[2] += l.assists
    acc.totals[3] += l.steals
    acc.totals[4] += l.blocks
    acc.totals[5] += l.turnovers
    acc.totals[6] += l.fouls
  }

  const out: PlayerSeasonAggregate[] = []
  for (const [playerId, acc] of byPlayer) {
    const gp = acc.games.size
    const [points, rebounds, assists, steals, blocks, turnovers, fouls] = acc.totals
    out.push({
      playerId,
      gamesPlayed: gp,
      points,
      rebounds,
      assists,
      steals,
      blocks,
      turnovers,
      fouls,
      ppg: round1(points / gp),
      rpg: round1(rebounds / gp),
      apg: round1(assists / gp),
      spg: round1(steals / gp),
      bpg: round1(blocks / gp),
      topg: round1(turnovers / gp),
    })
  }
  return out
}

export type LeaderCategory = "ppg" | "rpg" | "apg" | "spg" | "bpg"

export const LEADER_CATEGORIES: Array<{ key: LeaderCategory; label: string; totalKey: keyof PlayerSeasonAggregate }> = [
  { key: "ppg", label: "Points", totalKey: "points" },
  { key: "rpg", label: "Rebounds", totalKey: "rebounds" },
  { key: "apg", label: "Assists", totalKey: "assists" },
  { key: "spg", label: "Steals", totalKey: "steals" },
  { key: "bpg", label: "Blocks", totalKey: "blocks" },
]

export interface LeaderboardOptions {
  category: LeaderCategory
  /** playerId → teamId (season roster / current roster mapping) */
  playerTeam: Record<string, string>
  /** teamId → number of COMPLETED games — the eligibility denominator */
  teamGamesPlayed: Record<string, number>
  /** Fraction of team games a player must have appeared in (default 0.5) */
  minGamesFraction?: number
  limit?: number
}

export interface LeaderRow {
  playerId: string
  teamId: string
  gamesPlayed: number
  /** Per-game average for the category, rounded to 1 decimal */
  value: number
  /** Season total for the category */
  total: number
}

const CATEGORY_TOTAL: Record<LeaderCategory, (a: PlayerSeasonAggregate) => number> = {
  ppg: (a) => a.points,
  rpg: (a) => a.rebounds,
  apg: (a) => a.assists,
  spg: (a) => a.steals,
  bpg: (a) => a.blocks,
}

/** Rank eligible players by per-game average in a category. */
export function computeLeaders(
  aggregates: PlayerSeasonAggregate[],
  opts: LeaderboardOptions
): LeaderRow[] {
  const { category, playerTeam, teamGamesPlayed } = opts
  const minFraction = opts.minGamesFraction ?? 0.5
  const limit = opts.limit ?? 10
  const total = CATEGORY_TOTAL[category]

  const rows: Array<LeaderRow & { raw: number }> = []
  for (const agg of aggregates) {
    const teamId = playerTeam[agg.playerId]
    if (!teamId) continue
    const teamGames = teamGamesPlayed[teamId] ?? 0
    if (teamGames <= 0) continue
    if (agg.gamesPlayed < Math.ceil(minFraction * teamGames)) continue
    const t = total(agg)
    const raw = t / agg.gamesPlayed
    rows.push({
      playerId: agg.playerId,
      teamId,
      gamesPlayed: agg.gamesPlayed,
      value: round1(raw),
      total: t,
      raw,
    })
  }

  rows.sort(
    (a, b) =>
      b.raw - a.raw ||
      b.total - a.total ||
      a.playerId.localeCompare(b.playerId) // deterministic final tiebreak
  )

  return rows.slice(0, limit).map(({ raw: _raw, ...row }) => row)
}
