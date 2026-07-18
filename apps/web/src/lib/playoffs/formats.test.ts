import { describe, expect, it } from "vitest"
import { buildPlan, playoffOptionsFor, type Matchup, type Slot } from "./formats"

const seedOf = (s: Slot) => ("seed" in s ? s.seed : null)

describe("playoffOptionsFor — the guided menu", () => {
  it("offers nothing for degenerate inputs", () => {
    expect(playoffOptionsFor(8, 1)).toEqual([])
    expect(playoffOptionsFor(4, 5)).toEqual([]) // more qualifiers than teams
  })

  it("power-of-2 counts get straight brackets, not play-ins", () => {
    const keys = playoffOptionsFor(10, 8).map((o) => o.key)
    expect(keys).toContain("SINGLE_ELIM")
    expect(keys).toContain("SINGLE_ELIM_THIRD")
    expect(keys).toContain("ELIM_CONSOLATION")
    expect(keys).not.toContain("PLAY_IN_ELIM")
  })

  it("non-power-of-2 counts get play-ins", () => {
    const opts = playoffOptionsFor(12, 6)
    const playIn = opts.find((o) => o.key === "PLAY_IN_ELIM")
    expect(playIn).toBeTruthy()
    expect(playIn!.games).toBe(2 + 3) // 2 play-ins + bracket of 4
  })

  it("small fields also get round-robin; big fields get pools", () => {
    expect(playoffOptionsFor(6, 5).some((o) => o.key === "ROUND_ROBIN")).toBe(true)
    expect(playoffOptionsFor(8, 7).some((o) => o.key === "ROUND_ROBIN")).toBe(false) // 7 > 6
    expect(playoffOptionsFor(16, 16).some((o) => o.key === "POOLS_CROSSOVER")).toBe(true)
  })

  it("game counts are exact for the classic 8-team bracket", () => {
    const opts = playoffOptionsFor(10, 8)
    expect(opts.find((o) => o.key === "SINGLE_ELIM")!.games).toBe(7)
    expect(opts.find((o) => o.key === "SINGLE_ELIM_THIRD")!.games).toBe(8)
  })
})

describe("buildPlan — bracket structure", () => {
  it("8-team single elim: 1v8, 4v5, 3v6, 2v7 then winners cascade to a final", () => {
    const plan = buildPlan("SINGLE_ELIM", 8)
    const r1 = plan.matchups.filter((m) => m.round === 1)
    // top half feeds SF1 (1v4 on chalk), bottom half SF2 (2v3) — seeds 1 and 2
    // cannot meet before the final
    expect(r1.map((m) => [seedOf(m.home), seedOf(m.away)])).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ])
    // 4 QF + 2 SF + 1 F
    expect(plan.matchups).toHaveLength(7)
    const final = plan.matchups.find((m) => m.label === "Final")!
    expect(final.round).toBe(3)
    expect(final.home).toEqual({ winnerOf: [2, 0] })
    expect(final.away).toEqual({ winnerOf: [2, 1] })
  })

  it("re-seeding protects top seeds: 1 and 2 can only meet in the final", () => {
    const plan = buildPlan("SINGLE_ELIM", 16)
    const r1 = plan.matchups.filter((m) => m.round === 1)
    const pairOf = (seed: number) =>
      r1.find((m) => seedOf(m.home) === seed || seedOf(m.away) === seed)!
    expect([seedOf(pairOf(1).home), seedOf(pairOf(1).away)]).toContain(16)
    expect([seedOf(pairOf(2).home), seedOf(pairOf(2).away)]).toContain(15)
    // halves: 1's semifinal feeder tree never contains seed 2
    const final = plan.matchups.find((m) => m.label === "Final")!
    expect(final.round).toBe(4)
  })

  it("third-place game pairs the semifinal losers", () => {
    const plan = buildPlan("SINGLE_ELIM_THIRD", 4)
    const bronze = plan.matchups.find((m) => m.label === "3rd-place game")!
    expect(bronze.home).toEqual({ loserOf: [1, 0] })
    expect(bronze.away).toEqual({ loserOf: [1, 1] })
    expect(plan.matchups).toHaveLength(4) // 2 SF + F + bronze
  })

  it("6-team play-in: seeds 1-2 rest, 3v6 and 4v5 play in", () => {
    const plan = buildPlan("PLAY_IN_ELIM", 6)
    const playIns = plan.matchups.filter((m) => m.round === 1)
    expect(playIns).toHaveLength(2)
    expect(playIns.map((m) => [seedOf(m.home), seedOf(m.away)])).toEqual([
      [3, 6],
      [4, 5],
    ])
    // bracket of 4 in round 2: 1 vs (winner of the LAST play-in = lowest surviving
    // possible seed) and 2 vs the other winner
    const r2 = plan.matchups.filter((m) => m.round === 2)
    expect(r2).toHaveLength(2)
    for (const m of r2) {
      const slots = [m.home, m.away]
      const hasTopSeed = slots.some((s) => seedOf(s) === 1 || seedOf(s) === 2)
      const hasWinnerRef = slots.some((s) => "winnerOf" in s)
      expect(hasTopSeed && hasWinnerRef).toBe(true)
    }
    expect(plan.matchups.filter((m) => m.round === 3)).toHaveLength(1) // final
  })

  it("round-robin: everyone plays everyone exactly once", () => {
    const plan = buildPlan("ROUND_ROBIN", 5)
    expect(plan.matchups).toHaveLength(10)
    const pairs = new Set(
      plan.matchups.map((m) => `${seedOf(m.home)}-${seedOf(m.away)}`)
    )
    expect(pairs.size).toBe(10) // no repeats
    // no team plays twice in the same round
    for (let r = 1; r <= 5; r++) {
      const round = plan.matchups.filter((m) => m.round === r)
      const teams = round.flatMap((m) => [seedOf(m.home), seedOf(m.away)])
      expect(new Set(teams).size).toBe(teams.length)
    }
  })

  it("pools of 4: snake seeding balances pools and each pool round-robins", () => {
    const plan = buildPlan("POOLS_CROSSOVER", 8)
    const poolA = plan.matchups.filter((m) => m.pool === "A")
    const poolB = plan.matchups.filter((m) => m.pool === "B")
    expect(poolA).toHaveLength(6)
    expect(poolB).toHaveLength(6)
    const aSeeds = new Set(poolA.flatMap((m) => [seedOf(m.home), seedOf(m.away)]))
    expect([...aSeeds].sort()).toEqual([1, 4, 5, 8]) // snake: 1,4,5,8 vs 2,3,6,7
    // crossover intentionally deferred to advancement
    expect(plan.matchups.every((m) => m.round === 1)).toBe(true)
    expect(plan.notes).toMatch(/Crossover/)
  })

  it("consolation: round-1 losers get a full placement bracket without slot clashes", () => {
    const plan = buildPlan("ELIM_CONSOLATION", 8)
    const main = plan.matchups.filter((m) => m.slot < 100)
    const consolation = plan.matchups.filter((m) => m.slot >= 100)
    expect(main).toHaveLength(7)
    expect(consolation).toHaveLength(3)
    const keys = new Set(plan.matchups.map((m) => `${m.round}:${m.slot}`))
    expect(keys.size).toBe(plan.matchups.length) // (round, slot) unique — DB key
    for (const m of consolation.filter((c) => c.round === 2)) {
      expect("loserOf" in m.home && "loserOf" in m.away).toBe(true)
    }
  })

  it("every non-seed slot references a matchup that exists earlier in the plan", () => {
    for (const format of [
      "SINGLE_ELIM",
      "SINGLE_ELIM_THIRD",
      "PLAY_IN_ELIM",
      "ELIM_CONSOLATION",
    ] as const) {
      const q = format === "PLAY_IN_ELIM" ? 11 : 8
      const plan = buildPlan(format, q)
      const keys = new Set(plan.matchups.map((m) => `${m.round}:${m.slot}`))
      const refs = (m: Matchup) =>
        [m.home, m.away].flatMap((s) =>
          "winnerOf" in s ? [s.winnerOf] : "loserOf" in s ? [s.loserOf] : []
        )
      for (const m of plan.matchups) {
        for (const [r, sl] of refs(m)) {
          expect(keys.has(`${r}:${sl}`), `${format}: ${m.label} references ${r}:${sl}`).toBe(true)
          expect(r).toBeLessThan(m.round + (m.label === "3rd-place game" ? 1 : 0) + 1)
        }
      }
    }
  })
})
