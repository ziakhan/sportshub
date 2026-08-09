/**
 * Scheduler v2 — L2 Season Matchup Layer. Decides WHO plays WHOM on WHICH
 * weekend, per grade; never a time or a court. The Berger (circle-method)
 * sequence is the coverage prior; each weekend round is instantiated as an
 * exact minimum-cost perfect matching so blackouts, pins and stickiness
 * bend the structure without breaking coverage-before-repeat.
 */
import { effectiveHosting } from "./audit"
import type { CellGame, MatchupCell, SnapGrade, WorldSnapshot } from "./types"

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Canonical Berger sequence for ids (sorted): returns each round as pairs.
 * Odd counts get a ghost; pairing with the ghost = that team's bye.
 */
export function bergerRounds(ids: string[]): string[][][] {
  const teams = [...ids].sort()
  const ghost = teams.length % 2 === 1
  if (ghost) teams.push("__ghost__")
  const n = teams.length
  const rounds: string[][][] = []
  const fixed = teams[0]
  let rest = teams.slice(1)
  for (let r = 0; r < n - 1; r++) {
    const lineup = [fixed, ...rest]
    const pairs: string[][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i]
      const b = lineup[n - 1 - i]
      if (a === "__ghost__" || b === "__ghost__") continue
      pairs.push(a < b ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)]
  }
  return rounds
}

/** bergerRank: pair -> position in the canonical cycle (round index). */
function bergerRankMap(ids: string[]): Map<string, number> {
  const map = new Map<string, number>()
  const rounds = bergerRounds(ids)
  rounds.forEach((pairs, r) => {
    for (const [a, b] of pairs) map.set(pairKey(a, b), r)
  })
  return map
}

/**
 * Exact min-cost perfect matching over an even set (n ≤ 16) by bitmask DP:
 * always match the lowest-indexed unmatched team, O(2^n · n). Deterministic:
 * on cost ties the earlier partner (canonical order) wins.
 */
export function minCostMatching(
  ids: string[],
  cost: (a: string, b: string) => number
): Array<[string, string]> {
  const teams = [...ids].sort()
  const n = teams.length
  if (n === 0) return []
  if (n % 2 === 1) throw new Error("minCostMatching needs an even count")
  const FULL = (1 << n) - 1
  const dp = new Float64Array(1 << n).fill(Number.POSITIVE_INFINITY)
  const choice = new Int32Array(1 << n).fill(-1)
  dp[0] = 0
  for (let mask = 0; mask < FULL; mask++) {
    if (!Number.isFinite(dp[mask])) continue
    let i = 0
    while (mask & (1 << i)) i++
    for (let j = i + 1; j < n; j++) {
      if (mask & (1 << j)) continue
      const next = mask | (1 << i) | (1 << j)
      const c = dp[mask] + cost(teams[i], teams[j])
      if (c < dp[next] - 1e-9) {
        dp[next] = c
        choice[next] = i * 32 + j
      }
    }
  }
  const pairs: Array<[string, string]> = []
  let mask = FULL
  while (mask !== 0) {
    const ch = choice[mask]
    const i = Math.floor(ch / 32)
    const j = ch % 32
    pairs.push([teams[i], teams[j]])
    mask &= ~((1 << i) | (1 << j))
  }
  pairs.sort((p, q) => (p[0] < q[0] ? -1 : 1))
  return pairs
}

/**
 * Greedy fallback for n > 16: sorted-edge greedy (cost, then canonical pair
 * key), which always completes because every team subset of even size has
 * some perfect matching over a complete graph.
 */
function greedyMatching(
  ids: string[],
  cost: (a: string, b: string) => number
): Array<[string, string]> {
  const teams = [...ids].sort()
  const edges: Array<{ a: string; b: string; c: number }> = []
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      edges.push({ a: teams[i], b: teams[j], c: cost(teams[i], teams[j]) })
  edges.sort((x, y) => x.c - y.c || (pairKey(x.a, x.b) < pairKey(y.a, y.b) ? -1 : 1))
  const used = new Set<string>()
  const pairs: Array<[string, string]> = []
  for (const e of edges) {
    if (used.has(e.a) || used.has(e.b)) continue
    used.add(e.a)
    used.add(e.b)
    pairs.push([e.a, e.b])
  }
  pairs.sort((p, q) => (p[0] < q[0] ? -1 : 1))
  return pairs
}

export interface MatchupResult {
  cells: MatchupCell[]
  /** teamId -> season game count (pins + new), for the promise gate. */
  totals: Map<string, number>
  /** Same-session rematches emitted (S6 report). */
  sameRoundRematches: number
}

export function buildMatchups(snapshot: WorldSnapshot): MatchupResult {
  const W_REPEAT = 10_000
  const W_SESSION = 500
  const W_ADJ = 200
  const keepBonus = snapshot.config.keepBonus

  const teamById = new Map(snapshot.teams.map((t) => [t.id, t]))
  const hosting = effectiveHosting(snapshot)
  const cellsMap = new Map<string, MatchupCell>()
  const cellOf = (weekendId: string, gymId: string): MatchupCell => {
    const k = `${weekendId}|${gymId}`
    if (!cellsMap.has(k)) cellsMap.set(k, { weekendId, gymId, games: [], dayAllow: {} })
    return cellsMap.get(k)!
  }

  // Draft pairings by (weekendId, pairKey) — stickiness (minimal re-solve).
  const draftAt = new Set<string>()
  for (const g of snapshot.existingGames) {
    if (g.state !== "DRAFT" || !g.weekendId) continue
    draftAt.add(`${g.weekendId}|${pairKey(g.teamAId, g.teamBId)}`)
  }

  const totals = new Map<string, number>()
  for (const t of snapshot.teams) totals.set(t.id, 0)
  let sameRoundRematches = 0

  const gradeSorted: SnapGrade[] = [...snapshot.grades].sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const grade of gradeSorted) {
    const ids = grade.teamIds
    const rank = bergerRankMap(ids)
    const cycleLen = Math.max(1, ids.length % 2 === 0 ? ids.length - 1 : ids.length)

    const pairCount = new Map<string, number>()
    const lastMet = new Map<string, { order: number; roundId: string | null }>()
    const played = new Map<string, number>()
    for (const id of ids) played.set(id, 0)

    // Pins consume history: pair counts, per-team totals, weekend caps.
    const pinnedByWeekend = new Map<string, Set<string>>() // weekendId -> teams already playing (per round accounting below)
    const pinnedGamesByWeekend = new Map<string, number>()
    for (const g of snapshot.existingGames) {
      if (g.state !== "PIN") continue
      const a = teamById.get(g.teamAId)
      if (!a || a.gradeId !== grade.id) continue
      const pk = pairKey(g.teamAId, g.teamBId)
      pairCount.set(pk, (pairCount.get(pk) ?? 0) + 1)
      played.set(g.teamAId, (played.get(g.teamAId) ?? 0) + 1)
      played.set(g.teamBId, (played.get(g.teamBId) ?? 0) + 1)
      totals.set(g.teamAId, (totals.get(g.teamAId) ?? 0) + 1)
      totals.set(g.teamBId, (totals.get(g.teamBId) ?? 0) + 1)
      if (g.weekendId) {
        if (!pinnedByWeekend.has(g.weekendId)) pinnedByWeekend.set(g.weekendId, new Set())
        pinnedByWeekend.get(g.weekendId)!.add(g.teamAId)
        pinnedByWeekend.get(g.weekendId)!.add(g.teamBId)
        pinnedGamesByWeekend.set(g.weekendId, (pinnedGamesByWeekend.get(g.weekendId) ?? 0) + 1)
        const w = snapshot.weekends.find((x) => x.id === g.weekendId)
        if (w) {
          const prev = lastMet.get(pk)
          if (!prev || w.order > prev.order) lastMet.set(pk, { order: w.order, roundId: w.roundId })
        }
        // The pin also lives in a cell so placement blocks its slot.
        if (g.gymId && g.dayId && g.courtId && g.dayVenueId) {
          cellOf(g.weekendId, g.gymId).games.push({
            gradeId: grade.id,
            teamAId: g.teamAId,
            teamBId: g.teamBId,
            occurrence: (pairCount.get(pk) ?? 1) - 1,
            pinned: {
              gameId: g.id,
              dayId: g.dayId,
              startIso: g.startIso,
              courtId: g.courtId,
              dayVenueId: g.dayVenueId,
            },
          })
        }
      }
    }

    const hosted = snapshot.weekends.filter((w) =>
      (hosting.get(w.id) ?? []).some((h) => h.gradeId === grade.id)
    )
    const promise = snapshot.config.promiseDefault

    for (const w of hosted) {
      const gymId = hosting.get(w.id)!.find((h) => h.gradeId === grade.id)!.gymId
      const cell = cellOf(w.id, gymId)

      // Day-locks from partial blackouts (H4 at day granularity).
      for (const id of ids) {
        const t = teamById.get(id)
        if (!t || t.blackouts.length === 0) continue
        const openDays = w.days.filter(
          (d) => !t.blackouts.some((b) => b.dateKey === d.dateKey && !b.startMin && !b.endMin)
        )
        if (openDays.length > 0 && openDays.length < w.days.length) {
          cell.dayAllow[id] = openDays.map((d) => d.id)
        }
      }

      const gamesThisWeekend = new Map<string, number>()
      for (const id of pinnedByWeekend.get(w.id) ?? []) {
        gamesThisWeekend.set(id, (gamesThisWeekend.get(id) ?? 0) + 1)
      }

      const byeTeams: string[] = []
      for (let round = 0; round < w.target; round++) {
        let eligible = ids.filter((id) => {
          const t = teamById.get(id)!
          const fullyOut = w.days.every((d) =>
            t.blackouts.some((b) => b.dateKey === d.dateKey && !b.startMin && !b.endMin)
          )
          if (fullyOut) return false
          if ((gamesThisWeekend.get(id) ?? 0) > round) return false // pins already gave it this round
          if ((played.get(id) ?? 0) >= promise) return false // promise met — no bonus games (Q3)
          return true
        })
        if (eligible.length % 2 === 1) {
          // The bye: the team farthest ahead of pace sits (then highest id) —
          // self-correcting toward equal season totals. Byes are REMEMBERED:
          // an odd grade's weekend must end in a bye-pair makeup game or the
          // grade structurally undershoots its promise (a 3-team grade's
          // weekend is a triangle, not two matchings).
          let bye = eligible[0]
          for (const id of eligible) {
            const p = played.get(id) ?? 0
            const pb = played.get(bye) ?? 0
            if (p > pb || (p === pb && id > bye)) bye = id
          }
          byeTeams.push(bye)
          eligible = eligible.filter((id) => id !== bye)
        }
        if (eligible.length < 2) continue

        const cost = (a: string, b: string): number => {
          const pk = pairKey(a, b)
          let c = W_REPEAT * (pairCount.get(pk) ?? 0)
          // PREFER pooling (Setting A): lean same-division without fencing —
          // the NPH Gr10-12 pattern (~40% same-tag vs 16% random).
          if (grade.poolMode === "PREFER" && grade.divisionOf) {
            if (grade.divisionOf[a] !== grade.divisionOf[b]) c += 250
          }
          const met = lastMet.get(pk)
          if (met) {
            if (met.roundId !== null && met.roundId === w.roundId) c += W_SESSION
            else if (Math.abs(met.order - w.order) <= 1) c += W_ADJ
          }
          if (draftAt.has(`${w.id}|${pk}`)) c -= keepBonus
          c += (rank.get(pk) ?? cycleLen) % cycleLen
          return c
        }
        const pairs =
          eligible.length <= 16 ? minCostMatching(eligible, cost) : greedyMatching(eligible, cost)

        for (const [a, b] of pairs) {
          const pk = pairKey(a, b)
          const met = lastMet.get(pk)
          if (met && met.roundId !== null && met.roundId === w.roundId) sameRoundRematches++
          const occurrence = pairCount.get(pk) ?? 0
          cell.games.push({ gradeId: grade.id, teamAId: a, teamBId: b, occurrence })
          pairCount.set(pk, occurrence + 1)
          lastMet.set(pk, { order: w.order, roundId: w.roundId })
          played.set(a, (played.get(a) ?? 0) + 1)
          played.set(b, (played.get(b) ?? 0) + 1)
          totals.set(a, (totals.get(a) ?? 0) + 1)
          totals.set(b, (totals.get(b) ?? 0) + 1)
          gamesThisWeekend.set(a, (gamesThisWeekend.get(a) ?? 0) + 1)
          gamesThisWeekend.set(b, (gamesThisWeekend.get(b) ?? 0) + 1)
        }
      }
      // Bye-pair makeup: with target 2, the two rounds' byes are distinct
      // teams one game short of the weekend target — pair them so the odd
      // grade's weekend closes whole (n=3 becomes the triangle; n=5 gets
      // its fifth game). Never exceeds the weekend target per team.
      const uniqueByes = [...new Set(byeTeams)].filter(
        (id) => (gamesThisWeekend.get(id) ?? 0) < w.target && (played.get(id) ?? 0) < promise
      )
      uniqueByes.sort()
      for (let i = 0; i + 1 < uniqueByes.length; i += 2) {
        const a = uniqueByes[i]
        const b = uniqueByes[i + 1]
        const pk = pairKey(a, b)
        const occurrence = pairCount.get(pk) ?? 0
        const met = lastMet.get(pk)
        if (met && met.roundId !== null && met.roundId === w.roundId) sameRoundRematches++
        cell.games.push({ gradeId: grade.id, teamAId: a, teamBId: b, occurrence })
        pairCount.set(pk, occurrence + 1)
        lastMet.set(pk, { order: w.order, roundId: w.roundId })
        played.set(a, (played.get(a) ?? 0) + 1)
        played.set(b, (played.get(b) ?? 0) + 1)
        totals.set(a, (totals.get(a) ?? 0) + 1)
        totals.set(b, (totals.get(b) ?? 0) + 1)
        gamesThisWeekend.set(a, (gamesThisWeekend.get(a) ?? 0) + 1)
        gamesThisWeekend.set(b, (gamesThisWeekend.get(b) ?? 0) + 1)
      }
    }

    // Catch-up credits: teams still short of the promise (blackout misses)
    // take an extra game on later hosted weekends with room, deficit teams
    // paired together first (both need it).
    let guard = 0
    while (guard++ < 64) {
      const deficit = ids.filter((id) => (played.get(id) ?? 0) < promise)
      if (deficit.length < 2) break
      let placed = false
      for (const w of hosted) {
        const gymId = hosting.get(w.id)!.find((h) => h.gradeId === grade.id)!.gymId
        const cell = cellOf(w.id, gymId)
        // Capacity truth (H7): a catch-up game only lands where the gym has
        // spare court-slots for ALL grades it hosts that weekend.
        let supply = 0
        for (const day of w.days) {
          for (const v of day.venues) {
            if (v.gymId !== gymId) continue
            const usable = Math.max(0, v.courts.length - snapshot.config.courtBuffer)
            supply += Math.floor((v.closeMin - v.openMin) / snapshot.config.slotMinutes) * usable
          }
        }
        const cellLoad = [...cellsMap.values()]
          .filter((c) => c.weekendId === w.id && c.gymId === gymId)
          .reduce((acc, c) => acc + c.games.length, 0)
        if (cellLoad >= supply) continue
        // Never a 3-game weekend (Q3): both teams must be under the target.
        const weekendGames = new Map<string, number>()
        for (const cg of cell.games) {
          weekendGames.set(cg.teamAId, (weekendGames.get(cg.teamAId) ?? 0) + 1)
          weekendGames.set(cg.teamBId, (weekendGames.get(cg.teamBId) ?? 0) + 1)
        }
        const two = deficit
          .filter((id) => {
            const t = teamById.get(id)!
            const fullyOut = w.days.every((d) =>
              t.blackouts.some((b) => b.dateKey === d.dateKey && !b.startMin && !b.endMin)
            )
            if (fullyOut) return false
            return (weekendGames.get(id) ?? 0) < w.target
          })
          .slice(0, 2)
        if (two.length < 2) continue
        const [a, b] = two[0] < two[1] ? [two[0], two[1]] : [two[1], two[0]]
        const pk = pairKey(a, b)
        const occurrence = pairCount.get(pk) ?? 0
        cell.games.push({ gradeId: grade.id, teamAId: a, teamBId: b, occurrence })
        pairCount.set(pk, occurrence + 1)
        played.set(a, (played.get(a) ?? 0) + 1)
        played.set(b, (played.get(b) ?? 0) + 1)
        totals.set(a, (totals.get(a) ?? 0) + 1)
        totals.set(b, (totals.get(b) ?? 0) + 1)
        placed = true
        break
      }
      if (!placed) break
    }
  }

  const cells = [...cellsMap.values()].sort((a, b) =>
    a.weekendId < b.weekendId ? -1 : a.weekendId > b.weekendId ? 1 : a.gymId < b.gymId ? -1 : 1
  )
  // Canonical game order inside a cell.
  for (const c of cells) {
    c.games.sort((x, y) => {
      const kx = `${x.gradeId}|${pairKey(x.teamAId, x.teamBId)}|${x.occurrence}`
      const ky = `${y.gradeId}|${pairKey(y.teamAId, y.teamBId)}|${y.occurrence}`
      return kx < ky ? -1 : 1
    })
  }
  return { cells, totals, sameRoundRematches }
}
