/**
 * Season planner — PURE core (no DB imports): types, demand math, the
 * deterministic per-window search, and the suggestion rail. The client
 * board imports THIS module; planner.ts adds the prisma-backed load/apply.
 * Deterministic by owner ruling (2026-08-02): no model call in the solve
 * path — validated against NPH's official 2026-27 calendar
 * (scripts/analysis/validate-nph-calendar.ts).
 */

export interface PlannerUnit {
  key: string // "age:<ageGroup>"
  label: string
  divisionIds: string[]
  teams: number
  source: "approved" | "expected" | "none"
}

export interface PlannerWeekend {
  sessionId: string
  label: string
  dateISO: string
  capacityGames: number
  largestVenueCapacity: number
  venues: Array<{ venueId: string; name: string; capacityGames: number }>
  targetGamesPerTeam: number
  assigned: string[] // unit keys
}

export interface PlannerWindow {
  label: string
  weekends: PlannerWeekend[]
}

export interface PlannerState {
  seasonId: string
  units: PlannerUnit[]
  windows: PlannerWindow[]
  errors: string[]
}

export type PlannerLever = "balance" | "compact" | "spread"

export interface PlannerSuggestion {
  kind: "overflow" | "extend-hours" | "move-unit" | "idle-weekend" | "two-building"
  sessionId: string
  text: string
}

/** Weekend demand in games for a set of assigned units. */
export function weekendDemand(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam">,
  assigned: string[]
): number {
  let games = 0
  for (const key of assigned) {
    const u = units.find((x) => x.key === key)
    if (u) games += Math.ceil((u.teams * weekend.targetGamesPerTeam) / 2)
  }
  return games
}

/**
 * Deterministic per-window search. Every unit appears exactly once per
 * window (NPH's real rule: each grade plays one weekend per monthly
 * session). Overflow is forbidden when any overflow-free assignment
 * exists; ties break toward the two largest units on different weekends
 * and single-building weekends. Levers:
 *  - balance: flattest peak utilization
 *  - compact: fewest weekends used, then flattest
 *  - spread: every weekend used, then flattest
 */
export function proposePlan(
  state: PlannerState,
  lever: PlannerLever
): Record<string, string[]> {
  const units = state.units.filter((u) => u.teams > 0)
  const out: Record<string, string[]> = {}
  const giants = [...units].sort((a, b) => b.teams - a.teams).slice(0, 2).map((u) => u.key)

  for (const win of state.windows) {
    const n = win.weekends.length
    if (n === 0) continue
    if (n === 1) {
      out[win.weekends[0].sessionId] = units.map((u) => u.key)
      continue
    }
    let best: number[] | null = null
    let bestScore = Infinity
    const assign = new Array(units.length).fill(0)
    const combos = Math.pow(n, units.length)
    if (combos > 300_000) {
      // Too many units for exact search: largest-first greedy onto the
      // weekend with most remaining capacity (utilization-aware).
      const loads = new Array(n).fill(0)
      const greedy = new Array(units.length).fill(0)
      const order = units
        .map((u, i) => ({ i, teams: u.teams }))
        .sort((a, b) => b.teams - a.teams)
      for (const { i } of order) {
        let pick = 0
        let pickUtil = Infinity
        for (let k = 0; k < n; k++) {
          const cap = win.weekends[k].capacityGames || 1
          const add = Math.ceil((units[i].teams * win.weekends[k].targetGamesPerTeam) / 2)
          const util = (loads[k] + add) / cap
          if (util < pickUtil) {
            pickUtil = util
            pick = k
          }
        }
        greedy[i] = pick
        loads[pick] += Math.ceil(
          (units[i].teams * win.weekends[pick].targetGamesPerTeam) / 2
        )
      }
      win.weekends.forEach((w, k) => {
        out[w.sessionId] = units.filter((_, i) => greedy[i] === k).map((u) => u.key)
      })
      continue
    }
    for (let mask = 0; mask < combos; mask++) {
      let m = mask
      for (let i = 0; i < units.length; i++) {
        assign[i] = m % n
        m = Math.floor(m / n)
      }
      const loads = new Array(n).fill(0)
      for (let i = 0; i < units.length; i++) {
        loads[assign[i]] += Math.ceil(
          (units[i].teams * win.weekends[assign[i]].targetGamesPerTeam) / 2
        )
      }
      let overflow = 0
      let peakGames = 0
      let used = 0
      let multiBuilding = 0
      for (let k = 0; k < n; k++) {
        const cap = win.weekends[k].capacityGames
        if (loads[k] > 0) used++
        if (cap <= 0) {
          if (loads[k] > 0) overflow += loads[k]
          continue
        }
        if (loads[k] > cap) overflow += loads[k] - cap
        peakGames = Math.max(peakGames, loads[k])
        if (loads[k] > win.weekends[k].largestVenueCapacity) multiBuilding++
      }
      // Courts are the cost: rank by ABSOLUTE peak games (a flat 42% of a
      // huge weekend still rents more courts than a flat 74-game one).
      // Availability stays hard via overflow.
      let score = overflow * 1_000_000 + peakGames * 100
      if (lever === "compact") score += used * 50_000
      if (lever === "spread") score += (n - used) * 50_000
      const gi = units.findIndex((u) => u.key === giants[0])
      const gj = units.findIndex((u) => u.key === giants[1])
      if (gi >= 0 && gj >= 0 && assign[gi] === assign[gj]) score += 40
      score += multiBuilding * 150 // NPH runs one building per weekend
      if (score < bestScore) {
        bestScore = score
        best = [...assign]
      }
    }
    win.weekends.forEach((w, k) => {
      out[w.sessionId] = units.filter((_, i) => best![i] === k).map((u) => u.key)
    })
  }
  return out
}

/** Read the current assignment as sessionId → unit keys (for diffs/UI). */
export function currentAssignment(state: PlannerState): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const win of state.windows)
    for (const w of win.weekends) out[w.sessionId] = w.assigned
  return out
}

/** Plain-language observations about an assignment — the suggestion rail. */
export function suggestFor(
  state: PlannerState,
  assignment: Record<string, string[]>
): PlannerSuggestion[] {
  const suggestions: PlannerSuggestion[] = []
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const assigned = assignment[w.sessionId] ?? []
      const demand = weekendDemand(state.units, w, assigned)
      if (demand > w.capacityGames) {
        const short = demand - w.capacityGames
        suggestions.push({
          kind: "overflow",
          sessionId: w.sessionId,
          text: `${w.label} needs ${demand} games but has ${w.capacityGames} slots (${short} short). Extend hours, add a court, or drag a grade to a lighter weekend.`,
        })
        const smallest = assigned
          .map((k) => state.units.find((u) => u.key === k))
          .filter(Boolean)
          .sort((a, b) => a!.teams - b!.teams)[0]
        const roomier = win.weekends.find(
          (o) =>
            o.sessionId !== w.sessionId &&
            weekendDemand(state.units, o, assignment[o.sessionId] ?? []) +
              Math.ceil((smallest!.teams * o.targetGamesPerTeam) / 2) <=
              o.capacityGames
        )
        if (smallest && roomier) {
          suggestions.push({
            kind: "move-unit",
            sessionId: w.sessionId,
            text: `Moving ${smallest.label} to ${roomier.label} clears the shortage.`,
          })
        }
      } else if (demand > w.largestVenueCapacity && w.venues.length > 1) {
        suggestions.push({
          kind: "two-building",
          sessionId: w.sessionId,
          text: `${w.label} spills past ${
            w.venues.reduce((a, b) => (a.capacityGames >= b.capacityGames ? a : b)).name
          } into a second gym (${demand} games).`,
        })
      }
      if (assigned.length === 0 && w.capacityGames > 0) {
        suggestions.push({
          kind: "idle-weekend",
          sessionId: w.sessionId,
          text: `${w.label} has ${w.capacityGames} open slots and no grades assigned: spare capacity, or another league's weekend.`,
        })
      }
    }
  }
  return suggestions
}

