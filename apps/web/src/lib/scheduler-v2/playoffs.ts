/**
 * Scheduler v2 — playoffs. "Schedule the structure now, name the teams
 * later" (owner 2026-08-08): the generator builds every playoff game with
 * placeholder slots (SEED:3, WINNER:g1, POOL:A:1), places them onto the
 * booked playoff weekend deterministically, and real Game rows materialize
 * only as slots resolve — no public surface ever meets a null team.
 *
 * Format research (docs/roadmap/scheduler-v2-audit-2026-08-08.md §4):
 * byes = next-power-of-2 − field, top seeds, round 1 only; recursive
 * 1-8-4-5 seed pairing; fixed brackets (no reseeding — youth practice);
 * pools of 4-5 with snake seeding for everybody-plays fields; placement
 * rounds as the no-elimination format. Back-to-backs stay forbidden even
 * on tournament days; the playoff exception is games-per-day (default 3)
 * with at least one empty slot between a team's games.
 */
import { buildGrid, type GridPosition } from "./cell"
import type { SnapWeekend } from "./types"

/* --------------------------------- config --------------------------------- */

export type PlayoffFormat = "BRACKET" | "POOLS" | "PLACEMENT"

export interface PlayoffDivisionConfig {
  /** "all" or a number ≤ team count. */
  qualifiers: number | "all"
  /** The promise: every qualifier plays at least this many games. The
   *  format DERIVES from it (1 = bracket; 2 = bracket + consolation
   *  round, the modern NPH shape; 3+ = pools or placement) unless
   *  formatOverride pins one (the Advanced control). */
  guaranteedGames: number
  formatOverride: PlayoffFormat | null
  thirdPlace: boolean
  /** Playoff-weekend exception to the season's 2-game cap. */
  maxGamesPerDay: number
  /** Which booked PLAYOFF weekend (SeasonSession id) hosts this grade. */
  weekendId: string | null
}

export function defaultConfig(_teamCount: number): Omit<PlayoffDivisionConfig, "weekendId"> {
  return {
    qualifiers: "all",
    guaranteedGames: 2,
    formatOverride: null,
    thirdPlace: true,
    maxGamesPerDay: 3,
  }
}

export function deriveFormat(field: number, cfg: PlayoffDivisionConfig): PlayoffFormat {
  if (cfg.formatOverride) return cfg.formatOverride
  if (cfg.guaranteedGames <= 2) return "BRACKET"
  return field >= 8 ? "POOLS" : "PLACEMENT"
}

/* -------------------------------- structure ------------------------------- */

export interface SlotRef {
  type: "SEED" | "WINNER" | "LOSER" | "POOL" | "BEST2ND"
  /** SEED: "3" · WINNER/LOSER: structural game id · POOL: "A:1" (pool,
   *  finishing position) · BEST2ND: "1" (best runner-up across pools). */
  ref: string
}

export interface StructGame {
  id: string
  round: string
  /** Dependency tier: games in tier t may only start after tier t-1 can be
   *  known (pool games are tier 0; gold QF tier 1; SF tier 2; ...). */
  tier: number
  home: SlotRef
  away: SlotRef
}

export interface PlayoffStructure {
  games: StructGame[]
  byes: number
  notes: string[]
  /** Minimum games any qualifier is guaranteed under this structure. */
  guaranteedGames: number
}

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(1, n)))

/** Canonical bracket seed order for a power-of-2 field: 1-8-4-5-3-6-2-7. */
export function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const doubled: number[] = []
    const target = order.length * 2 + 1
    for (const s of order) {
      doubled.push(s, target - s)
    }
    order = doubled
  }
  return order
}

const roundName = (remaining: number): string =>
  remaining === 2
    ? "Final"
    : remaining === 4
      ? "Semifinal"
      : remaining === 8
        ? "Quarterfinal"
        : `Round of ${remaining}`

/** Single-elimination with byes by the universal formula. With
 *  `consolation`, round-1 losers pair off for one more game (the modern
 *  NPH shape: everyone who plays round 1 gets at least 2 games). */
export function buildBracket(field: number, thirdPlace: boolean, consolation = false): PlayoffStructure {
  const size = nextPow2(field)
  const byes = size - field
  const order = seedOrder(size)
  const notes: string[] = []
  if (byes > 0) notes.push(`${byes} bye${byes === 1 ? "" : "s"} — top ${byes} seed${byes === 1 ? "" : "s"} skip round 1.`)

  const games: StructGame[] = []
  // Entry column: seeds in canonical slots; seeds > field are ghosts (byes).
  let column: Array<{ slot: SlotRef; fromGame: string | null }> = order.map((seed) => ({
    slot: seed <= field ? { type: "SEED", ref: String(seed) } : { type: "SEED", ref: `BYE` },
    fromGame: null,
  }))
  let tier = 0
  let g = 0
  while (column.length > 2) {
    const next: typeof column = []
    const name = roundName(column.length)
    for (let i = 0; i < column.length; i += 2) {
      const a = column[i]
      const b = column[i + 1]
      const aBye = a.slot.type === "SEED" && a.slot.ref === "BYE"
      const bBye = b.slot.type === "SEED" && b.slot.ref === "BYE"
      if (aBye && bBye) {
        next.push({ slot: { type: "SEED", ref: "BYE" }, fromGame: null })
        continue
      }
      if (aBye || bBye) {
        next.push(aBye ? b : a) // free pass, no game
        continue
      }
      const id = `g${++g}`
      games.push({ id, round: name, tier, home: a.slot, away: b.slot })
      next.push({ slot: { type: "WINNER", ref: id }, fromGame: id })
    }
    column = next
    tier++
  }
  if (consolation) {
    // Round-1 losers, paired in bracket order, one consolation game each.
    const r1 = games.filter((x) => x.tier === 0)
    for (let i = 0; i + 1 < r1.length; i += 2) {
      games.push({
        id: `g${++g}`,
        round: "Consolation",
        tier: 1,
        home: { type: "LOSER", ref: r1[i].id },
        away: { type: "LOSER", ref: r1[i + 1].id },
      })
    }
  }
  const finalId = `g${++g}`
  games.push({ id: finalId, round: "Final", tier, home: column[0].slot, away: column[1].slot })
  if (thirdPlace) {
    const semis = games.filter((x) => x.round === "Semifinal")
    if (semis.length === 2) {
      games.push({
        id: `g${++g}`,
        round: "3rd place",
        tier,
        home: { type: "LOSER", ref: semis[0].id },
        away: { type: "LOSER", ref: semis[1].id },
      })
    }
  }
  if (consolation && field > byes + 1) {
    notes.push("Round-1 losers get a consolation game — everyone who plays round 1 plays at least twice.")
  }
  return { games, byes, notes, guaranteedGames: consolation ? 2 : 1 }
}

/** Pool sizes of 4 and 5 (research: avoid pools of 3). Number theory
 *  forces exceptions: 6, 7 and 11 cannot be written as 4a+5b, so exactly
 *  one pool of 3 appears there — never more, never elsewhere. */
export function poolSizes(n: number): number[] {
  if (n <= 5) return [n]
  const fourFive = (m: number): number[] | null => {
    for (let fives = 0; fives * 5 <= m; fives++) {
      const rest = m - fives * 5
      if (rest % 4 === 0) return [...Array(rest / 4).fill(4), ...Array(fives).fill(5)]
    }
    return null
  }
  const clean = fourFive(n)
  if (clean) return clean
  const withThree = fourFive(n - 3)
  if (withThree) return [...withThree, 3]
  return [n]
}

const POOL_LETTERS = "ABCDEFGHJK"

/** Snake-seeded pools + medal Sunday (gold bracket from pool winners +
 *  best runners-up; silver/bronze crossovers so everyone plays). */
export function buildPools(field: number, thirdPlace: boolean): PlayoffStructure {
  const sizes = poolSizes(field)
  const poolCount = sizes.length
  const pools: number[][] = sizes.map(() => [])
  // Snake deal seeds 1..field.
  let dir = 1
  let p = 0
  for (let seed = 1; seed <= field; seed++) {
    // Skip full pools (sizes differ).
    let guard = 0
    while (pools[p].length >= sizes[p] && guard++ < poolCount * 2) {
      p += dir
      if (p === poolCount || p === -1) {
        dir = -dir
        p += dir
      }
    }
    pools[p].push(seed)
    p += dir
    if (p === poolCount || p === -1) {
      dir = -dir
      p += dir
    }
  }

  const games: StructGame[] = []
  let g = 0
  pools.forEach((seeds, pi) => {
    const letter = POOL_LETTERS[pi]
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        games.push({
          id: `g${++g}`,
          round: `Pool ${letter}`,
          tier: 0,
          home: { type: "SEED", ref: String(seeds[i]) },
          away: { type: "SEED", ref: String(seeds[j]) },
        })
      }
    }
  })

  const notes = [
    `${poolCount} pools (${sizes.join(", ")}), snake-seeded; every team plays ${Math.min(...sizes) - 1}-${Math.max(...sizes) - 1} pool games Saturday.`,
  ]

  /* Medal rounds: gold = pool winners + best 2nds to reach 4 or 8. */
  const goldSize = poolCount >= 5 ? 8 : 4
  const best2 = Math.max(0, goldSize - poolCount)
  const entrants: SlotRef[] = []
  for (let i = 0; i < poolCount && entrants.length < goldSize; i++) {
    entrants.push({ type: "POOL", ref: `${POOL_LETTERS[i]}:1` })
  }
  for (let i = 1; entrants.length < goldSize; i++) {
    entrants.push({ type: "BEST2ND", ref: String(i) })
  }
  notes.push(
    `Gold bracket: ${poolCount >= goldSize ? goldSize + " pool winners" : `${poolCount} pool winners + ${goldSize - poolCount} best runners-up`}.`
  )
  // Pair gold entrants in canonical order (entrants are already strength-ordered).
  const order = seedOrder(goldSize)
  let column: SlotRef[] = order.map((s) => entrants[s - 1])
  let tier = 1
  while (column.length > 2) {
    const next: SlotRef[] = []
    const name = column.length === 8 ? "Gold quarterfinal" : "Gold semifinal"
    for (let i = 0; i < column.length; i += 2) {
      const id = `g${++g}`
      games.push({ id, round: name, tier, home: column[i], away: column[i + 1] })
      next.push({ type: "WINNER", ref: id })
    }
    column = next
    tier++
  }
  games.push({ id: `g${++g}`, round: "Gold final", tier, home: column[0], away: column[1] })
  if (thirdPlace) {
    const semis = games.filter((x) => x.round === "Gold semifinal")
    if (semis.length === 2) {
      games.push({
        id: `g${++g}`,
        round: "Gold 3rd place",
        tier,
        home: { type: "LOSER", ref: semis[0].id },
        away: { type: "LOSER", ref: semis[1].id },
      })
    }
  }

  /* Silver/bronze crossovers: one Sunday placement game for everyone who
   * did not reach gold, paired across neighboring pools. Runners-up
   * consumed by gold (the BEST2ND slots) are skipped at pairing time: the
   * first `best2` runner-up positions belong to gold, so the silver row
   * pairs the remaining 2nds; 3rds and 4ths (and 5ths in pools of 5) pair
   * straight across. */
  const pairAcross = (refs: SlotRef[], label: string) => {
    for (let i = 0; i + 1 < refs.length; i += 2) {
      games.push({ id: `g${++g}`, round: label, tier: 1, home: refs[i], away: refs[i + 1] })
    }
  }
  const seconds: SlotRef[] = []
  for (let i = best2; i < poolCount; i++) {
    // Resolution ranks runners-up 1..poolCount; the first `best2` went to
    // gold, the rest play silver.
    seconds.push({ type: "BEST2ND", ref: String(i + 1) })
  }
  pairAcross(seconds, "Silver")
  for (const position of [3, 4, 5]) {
    const refs: SlotRef[] = []
    for (let i = 0; i < poolCount; i++) {
      if (sizes[i] >= position) refs.push({ type: "POOL", ref: `${POOL_LETTERS[i]}:${position}` })
    }
    pairAcross(refs, "Bronze")
  }
  notes.push("Silver/bronze crossovers: every non-gold team gets a Sunday game.")

  const minPool = Math.min(...sizes) - 1
  return { games, byes: 0, notes, guaranteedGames: minPool + 1 }
}

/** Placement rounds: everyone plays exactly G games, champion by playoff
 *  standings — NPH's own Gr 9-12 format. Circle-method rounds guarantee no
 *  rematch. */
export function buildPlacement(field: number, rounds: number): PlayoffStructure {
  const games: StructGame[] = []
  let g = 0
  // Circle method on seed numbers.
  const teams: number[] = Array.from({ length: field }, (_, i) => i + 1)
  const ghost = field % 2 === 1
  if (ghost) teams.push(0)
  const n = teams.length
  const fixed = teams[0]
  let rest = teams.slice(1)
  const maxRounds = Math.min(rounds, n - 1)
  for (let r = 0; r < maxRounds; r++) {
    const lineup = [fixed, ...rest]
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i]
      const b = lineup[n - 1 - i]
      if (a === 0 || b === 0) continue
      games.push({
        id: `g${++g}`,
        round: `Round ${r + 1}`,
        tier: r,
        home: { type: "SEED", ref: String(Math.min(a, b)) },
        away: { type: "SEED", ref: String(Math.max(a, b)) },
      })
    }
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)]
  }
  return {
    games,
    byes: 0,
    notes: [
      `No elimination: every team plays ${maxRounds} game${maxRounds === 1 ? "" : "s"}; the playoff standings crown the champion.`,
    ],
    guaranteedGames: maxRounds,
  }
}

export function buildStructure(field: number, cfg: PlayoffDivisionConfig): PlayoffStructure {
  if (field < 2) return { games: [], byes: 0, notes: ["Fewer than 2 qualifiers."], guaranteedGames: 0 }
  const format = deriveFormat(field, cfg)
  if (format === "POOLS" && field >= 8) return buildPools(field, cfg.thirdPlace)
  if (format === "PLACEMENT") return buildPlacement(field, Math.max(2, cfg.guaranteedGames))
  return buildBracket(field, cfg.thirdPlace, cfg.guaranteedGames >= 2)
}

/* -------------------------------- placement ------------------------------- */

export interface PlacedStructGame extends StructGame {
  dayId: string
  dayVenueId: string
  courtId: string
  gymId: string
  startIso: string
}

/**
 * Deterministic dependency-aware placement onto one booked playoff weekend:
 * tiers run in order (a WINNER cannot play before its source game), every
 * pseudo-participant keeps ≥ 1 empty slot between games (no back-to-backs,
 * ever — stricter than any youth league we found), later tiers prefer later
 * days. Returns null when the weekend cannot hold the structure.
 */
export function placeWeekend(
  structures: Array<{ divisionId: string; games: StructGame[] }>,
  weekend: SnapWeekend,
  slotMinutes: number
): { placed: Array<PlacedStructGame & { divisionId: string }>; unplaced: Array<StructGame & { divisionId: string }> } {
  const grid: GridPosition[] = []
  const gyms = new Set<string>()
  for (const day of weekend.days) for (const v of day.venues) gyms.add(v.gymId)
  for (const g of [...gyms].sort()) grid.push(...buildGrid(weekend, g, slotMinutes))
  grid.sort((a, b) => a.startMs - b.startMs || (a.courtId < b.courtId ? -1 : 1))

  const occupied = new Set<number>()
  const busy = new Map<string, number[]>() // `${divisionId}|${slot}` -> startMs list
  const placed: Array<PlacedStructGame & { divisionId: string }> = []
  const unplaced: Array<StructGame & { divisionId: string }> = []
  const slotMs = slotMinutes * 60000

  // All divisions share the weekend's courts; each division's tiers advance
  // independently (its semifinal follows ITS pool games, not another
  // grade's). Rounds interleave across divisions tier by tier so the
  // building fills evenly.
  const floors = new Map<string, number>()
  const maxTier = Math.max(0, ...structures.flatMap((s) => s.games.map((g) => g.tier)))
  for (let tier = 0; tier <= maxTier; tier++) {
    for (const { divisionId, games } of structures) {
      const tierGames = games.filter((g) => g.tier === tier)
      if (tierGames.length === 0) continue
      const floor = floors.get(divisionId) ?? 0
      let tierMaxEnd = floor
      for (const game of tierGames) {
        const a = `${divisionId}|${game.home.type}:${game.home.ref}`
        const b = `${divisionId}|${game.away.type}:${game.away.ref}`
        let spot: GridPosition | null = null
        for (const pos of grid) {
          if (occupied.has(pos.idx)) continue
          if (pos.startMs < floor) continue
          // No back-to-backs even at a tournament: a participant's games
          // stay ≥ 1 empty slot apart.
          const clash = [a, b].some((id) =>
            (busy.get(id) ?? []).some((t) => Math.abs(t - pos.startMs) < 2 * slotMs)
          )
          if (clash) continue
          spot = pos
          break
        }
        if (!spot) {
          unplaced.push({ ...game, divisionId })
          continue
        }
        occupied.add(spot.idx)
        for (const id of [a, b]) {
          if (!busy.has(id)) busy.set(id, [])
          busy.get(id)!.push(spot.startMs)
        }
        placed.push({
          ...game,
          divisionId,
          dayId: spot.dayId,
          dayVenueId: spot.dayVenueId,
          courtId: spot.courtId,
          gymId: lookupGym(weekend, spot.dayVenueId),
          startIso: spot.startIso,
        })
        tierMaxEnd = Math.max(tierMaxEnd, spot.startMs + slotMs)
      }
      // The division's next tier depends on this one: strictly after, with
      // one slot of rest/turnaround.
      floors.set(divisionId, tierMaxEnd + slotMs)
    }
  }
  return { placed, unplaced }
}

function lookupGym(weekend: SnapWeekend, dayVenueId: string): string {
  for (const day of weekend.days)
    for (const v of day.venues) if (v.dayVenueId === dayVenueId) return v.gymId
  return ""
}
