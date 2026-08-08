import { describe, expect, it } from "vitest"
import { audit, hasBlock } from "./audit"
import { bergerRounds, buildMatchups, minCostMatching } from "./matchups"
import { burdenPoints, weekendCounts } from "./ledger"
import { solveSeason } from "./season"
import { buildProposal } from "./proposal"
import { V2_WEIGHTS, type WorldSnapshot } from "./types"

/* ------------------------------ pure functions ----------------------------- */

describe("bergerRounds", () => {
  it("covers every pair exactly once per cycle (even)", () => {
    const ids = ["a", "b", "c", "d", "e", "f"]
    const rounds = bergerRounds(ids)
    expect(rounds).toHaveLength(5)
    const seen = new Set<string>()
    for (const round of rounds) {
      expect(round).toHaveLength(3)
      for (const [x, y] of round) seen.add(`${x}|${y}`)
    }
    expect(seen.size).toBe(15)
  })
  it("odd counts get one bye per round", () => {
    const rounds = bergerRounds(["a", "b", "c"])
    expect(rounds).toHaveLength(3)
    for (const round of rounds) expect(round).toHaveLength(1)
  })
})

describe("minCostMatching", () => {
  it("finds the optimal matching (verified against brute force)", () => {
    const ids = ["a", "b", "c", "d", "e", "f"]
    const cost = (x: string, y: string) => ((x.charCodeAt(0) * 7 + y.charCodeAt(0) * 13) % 17) + 1
    const pairs = minCostMatching(ids, cost)
    const total = pairs.reduce((acc, [x, y]) => acc + cost(x, y), 0)
    // Brute force all perfect matchings of 6.
    let best = Infinity
    const permute = (rest: string[], acc: number) => {
      if (rest.length === 0) {
        best = Math.min(best, acc)
        return
      }
      const [first, ...others] = rest
      for (let i = 0; i < others.length; i++) {
        permute(
          others.filter((_, j) => j !== i),
          acc + cost(first, others[i])
        )
      }
    }
    permute(ids, 0)
    expect(total).toBe(best)
  })
  it("is deterministic", () => {
    const ids = ["t1", "t2", "t3", "t4"]
    const cost = () => 5 // all ties
    expect(minCostMatching(ids, cost)).toEqual(minCostMatching(ids, cost))
  })
})

describe("ledger — the owner's shape ladder (2026-08-08)", () => {
  const team = { style: null as any, windows: [] }
  const slot = 75
  const stop = (dayId: string, hour: number, extra: Partial<Parameters<typeof weekendCounts>[0][0]> = {}) => ({
    dayId,
    startMs: Date.UTC(2026, 9, 10, hour, 0),
    startMin: hour * 60,
    dow: 6,
    dateKey: "2026-9-10",
    first: false,
    last: false,
    ...extra,
  })
  it("gap 2-4 slots is FREE (the preferred breather)", () => {
    // 9:00 and 12:45 at 75-min slots = 2 empty slots.
    const c = weekendCounts([stop("d1", 9), { ...stop("d1", 9), startMs: Date.UTC(2026, 9, 10, 9, 0) + 3 * 75 * 60000 }], team, slot)
    expect(burdenPoints(c, V2_WEIGHTS)).toBe(0)
  })
  it("back-to-back is forbidden-tier", () => {
    const c = weekendCounts(
      [stop("d1", 9), { ...stop("d1", 9), startMs: Date.UTC(2026, 9, 10, 9, 0) + 75 * 60000 }],
      team,
      slot
    )
    expect(c.b2b).toBe(1)
    expect(burdenPoints(c, V2_WEIGHTS)).toBe(V2_WEIGHTS.b2b)
  })
  it("long gap and two dates price EQUALLY (owner: equally bad)", () => {
    const long = weekendCounts(
      [stop("d1", 9), { ...stop("d1", 9), startMs: Date.UTC(2026, 9, 10, 9, 0) + 6 * 75 * 60000 }],
      team,
      slot
    )
    const twoDates = weekendCounts(
      [stop("d1", 9), { ...stop("d2", 9), dateKey: "2026-9-11" }],
      team,
      slot
    )
    expect(burdenPoints(long, V2_WEIGHTS)).toBe(burdenPoints(twoDates, V2_WEIGHTS))
    expect(burdenPoints(long, V2_WEIGHTS)).toBeGreaterThan(0)
  })
})

/* ---------------------------- synthetic world ----------------------------- */

function tinyWorld(): WorldSnapshot {
  const day = (id: string, iso: string, gym: string, courts: number): any => ({
    id,
    date: iso,
    dateKey: (() => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })(),
    dow: new Date(iso).getDay(),
    venues: [
      {
        dayVenueId: `dv-${id}`,
        gymId: gym,
        openMin: 9 * 60,
        closeMin: 9 * 60 + 8 * 75, // 8 slots
        courts: Array.from({ length: courts }, (_, i) => ({ id: `${gym}-c${i + 1}`, order: i })),
      },
    ],
  })
  const teams = ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) => ({
    id,
    name: id,
    gradeId: "g1",
    style: null,
    blackouts: [],
    windows: [],
  }))
  return {
    seasonId: "test",
    config: {
      slotMinutes: 75,
      promiseDefault: 4,
      weights: V2_WEIGHTS,
      keepBonus: 300,
      keepTheta: 3,
      courtBuffer: 0,
    },
    weekends: [
      {
        id: "w1",
        label: "W1",
        order: 0,
        roundId: null,
        target: 2,
        days: [day("w1d1", "2026-10-10T05:00:00.000Z", "gymA", 2), day("w1d2", "2026-10-11T05:00:00.000Z", "gymA", 2)],
        hosting: [{ gradeId: "g1", gymId: "gymA" }],
      },
      {
        id: "w2",
        label: "W2",
        order: 1,
        roundId: null,
        target: 2,
        days: [day("w2d1", "2026-10-17T05:00:00.000Z", "gymA", 2), day("w2d2", "2026-10-18T05:00:00.000Z", "gymA", 2)],
        hosting: [{ gradeId: "g1", gymId: "gymA" }],
      },
    ],
    grades: [{ id: "g1", name: "Grade 1", teamIds: teams.map((t) => t.id) }],
    teams: teams as any,
    existingGames: [],
  }
}

describe("solveSeason on a synthetic world", () => {
  it("audits clean, places everything, zero back-to-backs, exact promises", () => {
    const world = tinyWorld()
    expect(hasBlock(audit(world))).toBe(false)
    const sol = solveSeason(world)
    expect(sol.unplaced).toBe(0)
    // 6 teams x 4 games / 2 = 12 games
    const placed = sol.cells.reduce((acc, c) => acc + c.games.length, 0)
    expect(placed).toBe(12)
    for (const [, n] of sol.totals) expect(n).toBe(4)
    let b2b = 0
    for (const c of sol.countsByTeam.values()) b2b += c.b2b
    expect(b2b).toBe(0)
  })
  it("is deterministic end to end (proposal hash)", () => {
    const p1 = (() => {
      const w = tinyWorld()
      const s = solveSeason(w)
      return buildProposal(w, s.cells, s.countsByTeam, "h")
    })()
    const p2 = (() => {
      const w = tinyWorld()
      const s = solveSeason(w)
      return buildProposal(w, s.cells, s.countsByTeam, "h")
    })()
    expect(p1.proposalHash).toBe(p2.proposalHash)
  })
  it("audit BLOCKS an over-packed gym with real arithmetic, before solving", () => {
    const world = tinyWorld()
    // Shrink the gym to 1 court x 2 slots per day: supply 4 < demand 6.
    for (const w of world.weekends)
      for (const d of w.days)
        for (const v of d.venues) {
          v.closeMin = v.openMin + 2 * 75
          v.courts = v.courts.slice(0, 1)
        }
    const findings = audit(world)
    expect(hasBlock(findings)).toBe(true)
    const f = findings.find((x) => x.code === "grade-does-not-fit")!
    expect(f.arithmetic.demand).toBe(6)
    expect(f.arithmetic.supply).toBe(4)
    expect(f.message).toContain("Short by 2")
  })
  it("matchups: coverage before repeats", () => {
    const world = tinyWorld()
    const { cells } = buildMatchups(world)
    const pairSeen = new Map<string, number>()
    for (const c of cells)
      for (const g of c.games) {
        const k = `${g.teamAId}|${g.teamBId}`
        pairSeen.set(k, (pairSeen.get(k) ?? 0) + 1)
      }
    // 12 games over 15 possible pairs: no pair twice before others once.
    for (const n of pairSeen.values()) expect(n).toBe(1)
  })
})
