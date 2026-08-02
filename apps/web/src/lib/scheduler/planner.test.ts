import { describe, expect, it } from "vitest"
import {
  proposePlan,
  suggestFor,
  weekendDemand,
  type PlannerState,
  type PlannerUnit,
  type PlannerWeekend,
} from "./planner"

/**
 * Pins the planner against the shape it was validated on: NPH's official
 * 2026-27 calendar (scripts/analysis/validate-nph-calendar.ts). Real census
 * team counts, real weekend capacities (NJC weekends = Burlington-only 80,
 * full weekends = 176), 2 games per team per weekend.
 */

const UNITS: PlannerUnit[] = [
  { key: "age:Gr7", label: "Gr7", divisionIds: ["d7"], teams: 12, source: "approved" },
  { key: "age:Gr8", label: "Gr8", divisionIds: ["d8"], teams: 9, source: "approved" },
  { key: "age:Gr9", label: "Gr9", divisionIds: ["d9"], teams: 25, source: "approved" },
  { key: "age:Gr10", label: "Gr10", divisionIds: ["d10"], teams: 42, source: "approved" },
  { key: "age:Gr11", label: "Gr11", divisionIds: ["d11"], teams: 24, source: "approved" },
  { key: "age:Gr12", label: "Gr12", divisionIds: ["d12"], teams: 26, source: "approved" },
  { key: "age:JrGirls", label: "JrGirls", divisionIds: ["dj"], teams: 8, source: "approved" },
]

let seq = 0
function wk(
  label: string,
  dateISO: string,
  capacityGames: number,
  largestVenueCapacity = capacityGames
): PlannerWeekend {
  return {
    sessionId: `s${++seq}`,
    label,
    dateISO,
    capacityGames,
    largestVenueCapacity,
    venues: [
      { venueId: "v1", name: "Six Park East", capacityGames: largestVenueCapacity },
      ...(capacityGames > largestVenueCapacity
        ? [{ venueId: "v2", name: "Playground", capacityGames: capacityGames - largestVenueCapacity }]
        : []),
    ],
    targetGamesPerTeam: 2,
    assigned: [],
  }
}

/** The official 2026-27 window structure: NJC weekends are capped at 80. */
function nphState(): PlannerState {
  seq = 0
  return {
    seasonId: "season",
    units: UNITS,
    errors: [],
    windows: [
      { label: "Oct 2026", weekends: [wk("Oct 24–25", "2026-10-24", 176, 96), wk("Oct 31–Nov 1", "2026-10-31", 176, 96)] },
      { label: "Nov 2026", weekends: [wk("Nov 14–15", "2026-11-14", 80, 48), wk("Nov 21–22", "2026-11-21", 176, 96), wk("Nov 28–29", "2026-11-28", 176, 96)] },
      { label: "Dec 2026", weekends: [wk("Dec 12–13", "2026-12-12", 80, 48), wk("Dec 19–20", "2026-12-19", 176, 96)] },
      { label: "Jan 2027", weekends: [wk("Jan 9–10", "2027-01-09", 176, 96), wk("Jan 16–17", "2027-01-16", 80, 48), wk("Jan 30–31", "2027-01-30", 176, 96)] },
      { label: "Feb 2027", weekends: [wk("Feb 6–7", "2027-02-06", 176, 96), wk("Feb 13–14", "2027-02-13", 80, 48), wk("Feb 20–21", "2027-02-20", 176, 96)] },
    ],
  }
}

const demandAt = (state: PlannerState, plan: Record<string, string[]>) => {
  const rows: Array<{ label: string; demand: number; capacity: number }> = []
  for (const win of state.windows)
    for (const w of win.weekends)
      rows.push({
        label: w.label,
        demand: weekendDemand(state.units, w, plan[w.sessionId] ?? []),
        capacity: w.capacityGames,
      })
  return rows
}

describe("proposePlan on the NPH shape", () => {
  it("balance: never overflows, and never exceeds the human plan's 84-game peak", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    const rows = demandAt(state, plan)
    for (const r of rows) expect(r.demand).toBeLessThanOrEqual(r.capacity)
    expect(Math.max(...rows.map((r) => r.demand))).toBeLessThanOrEqual(84)
  })

  it("every unit appears exactly once per window", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    for (const win of state.windows) {
      const all = win.weekends.flatMap((w) => plan[w.sessionId] ?? [])
      expect(all.sort()).toEqual(UNITS.map((u) => u.key).sort())
    }
  })

  it("availability-aware: NJC-capped weekends carry loads that fit 80 slots", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    for (const win of state.windows) {
      for (const w of win.weekends) {
        if (w.capacityGames === 80) {
          expect(weekendDemand(state.units, w, plan[w.sessionId] ?? [])).toBeLessThanOrEqual(80)
        }
      }
    }
  })

  it("compact uses no more weekends than balance; spread uses them all", () => {
    const state = nphState()
    const used = (plan: Record<string, string[]>) =>
      Object.values(plan).filter((k) => k.length > 0).length
    const compact = proposePlan(nphState(), "compact")
    const balance = proposePlan(nphState(), "balance")
    const spread = proposePlan(state, "spread")
    expect(used(compact)).toBeLessThanOrEqual(used(balance))
    // 7 units across 13 weekends: spread still can't use more weekends than
    // units-per-window allows, but every window's weekend count ≤ units, so
    // every weekend should host something.
    for (const win of state.windows) {
      for (const w of win.weekends) {
        expect((spread[w.sessionId] ?? []).length).toBeGreaterThan(0)
      }
    }
  })

  it("keeps the two giants (Gr10, Gr9) apart when capacity allows", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    for (const win of state.windows) {
      const together = win.weekends.some(
        (w) =>
          (plan[w.sessionId] ?? []).includes("age:Gr10") &&
          (plan[w.sessionId] ?? []).includes("age:Gr9")
      )
      expect(together).toBe(false)
    }
  })

  it("greedy fallback (large unit count) still assigns every unit once per window", () => {
    seq = 0
    const manyUnits: PlannerUnit[] = Array.from({ length: 13 }, (_, i) => ({
      key: `age:U${i}`,
      label: `U${i}`,
      divisionIds: [`du${i}`],
      teams: 6 + i,
      source: "approved" as const,
    }))
    const state: PlannerState = {
      seasonId: "s",
      units: manyUnits,
      errors: [],
      windows: [
        {
          label: "Nov",
          weekends: [wk("A", "2026-11-07", 200), wk("B", "2026-11-14", 200), wk("C", "2026-11-21", 200)],
        },
      ],
    }
    const plan = proposePlan(state, "balance") // 3^13 > 300k → greedy path
    const all = state.windows[0].weekends.flatMap((w) => plan[w.sessionId] ?? [])
    expect(all.sort()).toEqual(manyUnits.map((u) => u.key).sort())
  })
})

describe("suggestFor", () => {
  it("flags overflow with a move that clears it, and idle weekends", () => {
    const state = nphState()
    const [oct24, oct31] = state.windows[0].weekends
    const assignment: Record<string, string[]> = {
      // Everything piled on Oct 24 (demand 146 > 176? no — 146 ≤ 176; use
      // a tighter cap by piling onto an 80-cap weekend instead)
      [oct24.sessionId]: [],
      [oct31.sessionId]: [],
    }
    const nov14 = state.windows[1].weekends[0] // 80-cap
    assignment[nov14.sessionId] = ["age:Gr10", "age:Gr9", "age:Gr12"] // 93 > 80
    const suggestions = suggestFor(state, assignment)
    expect(suggestions.some((s) => s.kind === "overflow" && s.sessionId === nov14.sessionId)).toBe(true)
    expect(suggestions.some((s) => s.kind === "move-unit")).toBe(true)
    expect(suggestions.some((s) => s.kind === "idle-weekend" && s.sessionId === oct24.sessionId)).toBe(true)
  })

  it("flags a two-building weekend", () => {
    const state = nphState()
    const feb6 = state.windows[4].weekends[0] // 176 cap, largest venue 96
    const assignment: Record<string, string[]> = {
      [feb6.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr11", "age:Gr12"], // 117 > 96
    }
    const suggestions = suggestFor(state, assignment)
    expect(suggestions.some((s) => s.kind === "two-building" && s.sessionId === feb6.sessionId)).toBe(true)
  })
})

describe("weekendDemand", () => {
  it("games = ceil(teams × target / 2) summed over assigned units", () => {
    const w = wk("X", "2026-11-01", 100)
    expect(weekendDemand(UNITS, w, ["age:Gr9"])).toBe(25)
    expect(weekendDemand(UNITS, w, ["age:Gr9", "age:JrGirls"])).toBe(33)
    expect(weekendDemand(UNITS, { targetGamesPerTeam: 3 }, ["age:Gr9"])).toBe(38)
  })
})
