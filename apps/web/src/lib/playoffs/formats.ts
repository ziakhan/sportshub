/**
 * Playoff formats — pure math, no DB (owner design session 2026-07-18).
 * GUIDED FLOW: the league says how many teams qualify; we offer only the
 * formats that make sense for that count. Single games everywhere — no
 * best-of series in youth basketball (owner ruling).
 *
 * A plan is a list of rounds; each round is matchups of SLOTS. A slot is
 * either a seed (S1 = standings #1) or a reference to a prior result
 * (W:r:i = winner of round r matchup i, L:r:i = loser). Round-1 games are
 * created immediately; later rounds materialize as results arrive.
 */

export type Slot = { seed: number } | { winnerOf: [number, number] } | { loserOf: [number, number] }
export interface Matchup {
  round: number
  slot: number
  home: Slot
  away: Slot
  /** e.g. "Final", "Semifinal 1", "3rd-place game", "Pool A", "Play-in" */
  label: string
  /** pool tag for round-robin/pool formats */
  pool?: string
}
export interface PlayoffPlan {
  format: PlayoffFormatKey
  qualifying: number
  matchups: Matchup[]
  /** rounds beyond which advancement is computed (RR/pool formats resolve by table) */
  notes?: string
}

export type PlayoffFormatKey =
  | "SINGLE_ELIM"
  | "SINGLE_ELIM_THIRD"
  | "PLAY_IN_ELIM"
  | "ROUND_ROBIN"
  | "POOLS_CROSSOVER"
  | "ELIM_CONSOLATION"

export interface FormatOption {
  key: PlayoffFormatKey
  label: string
  description: string
  games: number
  rounds: number
  recommended?: boolean
}

const isPow2 = (n: number) => (n & (n - 1)) === 0 && n > 0

/** The guided menu: which formats make sense for Q qualifiers out of N teams. */
export function playoffOptionsFor(teamCount: number, qualifying: number): FormatOption[] {
  const q = qualifying
  const out: FormatOption[] = []
  if (q < 2 || q > teamCount) return out

  if (isPow2(q)) {
    out.push({
      key: "SINGLE_ELIM",
      label: `Bracket of ${q}`,
      description: `Straight knockout — ${q} teams, seeded from standings.`,
      games: q - 1,
      rounds: Math.log2(q),
      recommended: q >= 4,
    })
    out.push({
      key: "SINGLE_ELIM_THIRD",
      label: `Bracket of ${q} + 3rd-place game`,
      description: "Knockout plus a bronze game between the semifinal losers.",
      games: q,
      rounds: Math.log2(q),
    })
    if (q >= 4) {
      out.push({
        key: "ELIM_CONSOLATION",
        label: `Bracket of ${q} with consolation`,
        description:
          "Every team keeps playing — losers drop into a placement bracket settling every position.",
        games: q === 4 ? 4 : (q * Math.log2(q)) / 2,
        rounds: Math.log2(q),
      })
    }
  } else {
    // Non-power-of-2: play-in games trim to the next power of 2 down
    const bracket = 2 ** Math.floor(Math.log2(q))
    const playIns = q - bracket
    out.push({
      key: "PLAY_IN_ELIM",
      label: `${playIns} play-in game${playIns > 1 ? "s" : ""} → bracket of ${bracket}`,
      description: `Seeds ${bracket - playIns + 1}–${q} play in (${bracket - playIns + 1} hosts ${q}, etc.); winners join the top ${bracket - playIns} seeds in the bracket.`,
      games: playIns + bracket - 1,
      rounds: Math.floor(Math.log2(bracket)) + 1,
      recommended: true,
    })
  }

  if (q <= 6) {
    out.push({
      key: "ROUND_ROBIN",
      label: `Round-robin of ${q}`,
      description: `Everyone plays everyone (${(q * (q - 1)) / 2} games); the table crowns the champion — every team gets ${q - 1} games.`,
      games: (q * (q - 1)) / 2,
      rounds: q - 1,
      recommended: q <= 4 && !isPow2(q),
    })
  }

  if (q >= 8 && q % 4 === 0) {
    const pools = q / 4
    out.push({
      key: "POOLS_CROSSOVER",
      label: `${pools} pools of 4 → top 2 advance`,
      description: `Tournament style: pool round-robin (3 games each), then the top two per pool cross into a bracket of ${pools * 2}.`,
      games: pools * 6 + pools * 2 - 1,
      rounds: 3 + Math.log2(pools * 2),
      recommended: q >= 12,
    })
  }
  if (q >= 6 && q % 3 === 0 && q % 4 !== 0) {
    const pools = q / 3
    if (isPow2(pools * 2))
      out.push({
        key: "POOLS_CROSSOVER",
        label: `${pools} pools of 3 → top 2 advance`,
        description: `Pool round-robin (2 games each), then the top two per pool cross into a bracket of ${pools * 2}.`,
        games: pools * 3 + pools * 2 - 1,
        rounds: 2 + Math.log2(pools * 2),
      })
  }
  return out
}

/** Standard bracket seeding order (1v8, 4v5, 3v6, 2v7 for 8 etc.). */
function bracketPairs(q: number): Array<[number, number]> {
  let order = [1, 2]
  while (order.length < q) {
    const next: number[] = []
    const size = order.length * 2
    for (const s of order) {
      next.push(s)
      next.push(size + 1 - s)
    }
    order = next
  }
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]])
  return pairs
}

function roundLabel(teamsLeft: number, slot: number): string {
  if (teamsLeft === 2) return "Final"
  if (teamsLeft === 4) return `Semifinal ${slot + 1}`
  if (teamsLeft === 8) return `Quarterfinal ${slot + 1}`
  return `Round of ${teamsLeft} — Game ${slot + 1}`
}

export function buildPlan(format: PlayoffFormatKey, qualifying: number): PlayoffPlan {
  const q = qualifying
  const matchups: Matchup[] = []

  const addElimRounds = (entrants: Slot[], startRound: number, withThird: boolean) => {
    let current = entrants
    let round = startRound
    while (current.length > 1) {
      const nextRound: Slot[] = []
      for (let i = 0; i < current.length; i += 2) {
        const slot = i / 2
        matchups.push({
          round,
          slot,
          home: current[i],
          away: current[i + 1],
          label: roundLabel(current.length, slot),
        })
        nextRound.push({ winnerOf: [round, slot] })
      }
      if (current.length === 4 && withThird) {
        matchups.push({
          round: round + 1,
          slot: 1,
          home: { loserOf: [round, 0] },
          away: { loserOf: [round, 1] },
          label: "3rd-place game",
        })
      }
      current = nextRound
      round++
    }
    return round
  }

  if (format === "SINGLE_ELIM" || format === "SINGLE_ELIM_THIRD" || format === "ELIM_CONSOLATION") {
    const entrants: Slot[] = bracketPairs(q).flatMap(([a, b]) => [{ seed: a }, { seed: b }])
    addElimRounds(entrants, 1, format === "SINGLE_ELIM_THIRD")
    if (format === "ELIM_CONSOLATION") {
      // consolation: round-1 losers play a mirror bracket for placement
      const losers: Slot[] = bracketPairs(q).map((_, i) => ({ loserOf: [1, i] }))
      let current = losers
      let round = 2
      while (current.length > 1) {
        const next: Slot[] = []
        for (let i = 0; i < current.length; i += 2) {
          const slot = 100 + i / 2 // slot offset avoids clashing with main bracket
          matchups.push({
            round,
            slot,
            home: current[i],
            away: current[i + 1],
            label: `Consolation — Round ${round - 1}, Game ${i / 2 + 1}`,
          })
          next.push({ winnerOf: [round, slot] })
        }
        current = next
        round++
      }
    }
  } else if (format === "PLAY_IN_ELIM") {
    const bracket = 2 ** Math.floor(Math.log2(q))
    const playIns = q - bracket
    // lowest 2*playIns seeds fight for the last playIns bracket spots
    for (let i = 0; i < playIns; i++) {
      matchups.push({
        round: 1,
        slot: i,
        home: { seed: bracket - playIns + 1 + i },
        away: { seed: q - i },
        label: `Play-in ${i + 1}`,
      })
    }
    const entrants: Slot[] = bracketPairs(bracket).flatMap(([a, b]) => {
      const resolve = (s: number): Slot =>
        s > bracket - playIns ? { winnerOf: [1, s - (bracket - playIns) - 1] } : { seed: s }
      return [resolve(a), resolve(b)]
    })
    addElimRounds(entrants, 2, false)
  } else if (format === "ROUND_ROBIN") {
    // circle method; each "round" is a set of simultaneous games
    const teams = Array.from({ length: q }, (_, i) => i + 1)
    if (teams.length % 2 === 1) teams.push(0) // bye marker
    const n = teams.length
    for (let r = 0; r < n - 1; r++) {
      let slot = 0
      for (let i = 0; i < n / 2; i++) {
        const a = teams[i]
        const b = teams[n - 1 - i]
        if (a === 0 || b === 0) continue
        matchups.push({
          round: r + 1,
          slot: slot++,
          home: { seed: Math.min(a, b) },
          away: { seed: Math.max(a, b) },
          label: `Round-robin — Round ${r + 1}`,
        })
      }
      teams.splice(1, 0, teams.pop()!) // rotate all but first
    }
  } else if (format === "POOLS_CROSSOVER") {
    const poolSize = q % 4 === 0 ? 4 : 3
    const pools = q / poolSize
    // snake-seed pools: pool p gets seeds p, 2P+1-p, 2P+p, ...
    const poolSeeds: number[][] = Array.from({ length: pools }, () => [])
    let dir = 1
    let p = 0
    for (let seed = 1; seed <= q; seed++) {
      poolSeeds[p].push(seed)
      p += dir
      if (p === pools) {
        p = pools - 1
        dir = -1
      } else if (p === -1) {
        p = 0
        dir = 1
      }
    }
    poolSeeds.forEach((seeds, pi) => {
      const poolName = String.fromCharCode(65 + pi)
      let slot = 0
      for (let i = 0; i < seeds.length; i++)
        for (let j = i + 1; j < seeds.length; j++)
          matchups.push({
            round: 1,
            slot: pi * 100 + slot++,
            home: { seed: seeds[i] },
            away: { seed: seeds[j] },
            label: `Pool ${poolName}`,
            pool: poolName,
          })
    })
    // crossover bracket is built AFTER pool play from pool tables — the
    // plan records intent; generation happens via advancePlayoffs when all
    // pool games complete.
  }

  return {
    format,
    qualifying: q,
    matchups,
    notes:
      format === "POOLS_CROSSOVER"
        ? "Crossover bracket generates when pool play completes (A1 vs B2, B1 vs A2, …)."
        : format === "ROUND_ROBIN"
          ? "Champion = playoff round-robin table (H2H tiebreak first)."
          : undefined,
  }
}
