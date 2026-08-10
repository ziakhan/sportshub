import { describe, expect, it } from "vitest"
import {
  buildBracket,
  buildPlacement,
  buildPools,
  poolSizes,
  seedOrder,
  divisionFirstRound1,
} from "./playoffs"

describe("seedOrder — the canonical 1-8-4-5-3-6-2-7 bracket order", () => {
  it("produces the universal 8-team pairings (1v8, 4v5, 3v6, 2v7)", () => {
    const order = seedOrder(8)
    const pairs = [0, 2, 4, 6].map((i) => [order[i], order[i + 1]].sort((a, b) => a - b).join("v"))
    expect(pairs.sort()).toEqual(["1v8", "2v7", "3v6", "4v5"])
  })
  it("top 2 seeds always land in opposite halves", () => {
    for (const size of [4, 8, 16, 32]) {
      const order = seedOrder(size)
      const half = size / 2
      const i1 = order.indexOf(1)
      const i2 = order.indexOf(2)
      expect(i1 < half !== i2 < half).toBe(true)
    }
  })
})

describe("buildBracket — byes by the universal formula", () => {
  it("8 teams: clean bracket, 7 games + 3rd place", () => {
    const b = buildBracket(8, true)
    expect(b.byes).toBe(0)
    expect(b.games).toHaveLength(8) // 4 QF + 2 SF + F + 3rd
    expect(b.games.filter((g) => g.round === "Quarterfinal")).toHaveLength(4)
  })
  it("6 teams: top 2 byes into the semifinal (owner's exact question)", () => {
    const b = buildBracket(6, false)
    expect(b.byes).toBe(2)
    // Round 1: only 3v6 and 4v5 (2 games); semis include seeds 1 and 2 direct.
    const r1 = b.games.filter((g) => g.tier === 0)
    expect(r1).toHaveLength(2)
    const semiSeeds = b.games
      .filter((g) => g.round === "Semifinal")
      .flatMap((g) => [g.home, g.away])
      .filter((s) => s.type === "SEED")
      .map((s) => s.ref)
    expect(semiSeeds.sort()).toEqual(["1", "2"])
    expect(b.games).toHaveLength(5) // 2 + 2 + final
  })
  it("10 teams: top 6 byes, seeds 7-10 play in", () => {
    const b = buildBracket(10, false)
    expect(b.byes).toBe(6)
    const r1 = b.games.filter((g) => g.tier === 0)
    expect(r1).toHaveLength(2)
    const r1Seeds = r1.flatMap((g) => [g.home.ref, g.away.ref]).map(Number).sort((x, y) => x - y)
    expect(r1Seeds).toEqual([7, 8, 9, 10])
    expect(b.games).toHaveLength(9) // N-1
  })
  it("N-team bracket always has N-1 games (no 3rd place)", () => {
    for (const n of [3, 5, 6, 7, 8, 10, 12, 14, 19, 24]) {
      expect(buildBracket(n, false).games).toHaveLength(n - 1)
    }
  })
  it("NPH's real Grade 8 case: 14 teams, top-2 byes", () => {
    const b = buildBracket(14, true)
    expect(b.byes).toBe(2)
    expect(b.games.filter((g) => g.tier === 0)).toHaveLength(6) // 12 teams play R1
    expect(b.games).toHaveLength(14) // 13 + 3rd place
  })
})

describe("poolSizes — pools of 4 and 5 only", () => {
  it("splits every field 8..30 into 4s and 5s (one 3 only where math forces it)", () => {
    for (let n = 8; n <= 30; n++) {
      const sizes = poolSizes(n)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
      const threes = sizes.filter((s) => s === 3)
      // 11 is the only field in range that cannot be written as 4a+5b.
      expect(threes.length).toBeLessThanOrEqual(n === 11 ? 1 : 0)
      for (const s of sizes) expect([3, 4, 5]).toContain(s)
    }
  })
  it("24 teams -> 6 pools of 4 (the owner's example)", () => {
    expect(poolSizes(24)).toEqual([4, 4, 4, 4, 4, 4])
  })
})

describe("buildPools — everybody plays", () => {
  it("24 teams: 36 pool games + gold 8 + silver/bronze, everyone guaranteed 4", () => {
    const p = buildPools(24, true)
    const poolGames = p.games.filter((g) => g.tier === 0)
    expect(poolGames).toHaveLength(36) // 6 pools x C(4,2)
    const gold = p.games.filter((g) => g.round.startsWith("Gold"))
    expect(gold).toHaveLength(8) // QF4 + SF2 + F + 3rd
    expect(p.guaranteedGames).toBe(4)
    // Every seed 1..24 appears in exactly 3 pool games.
    const count = new Map<string, number>()
    for (const g of poolGames)
      for (const s of [g.home, g.away]) count.set(s.ref, (count.get(s.ref) ?? 0) + 1)
    for (let seed = 1; seed <= 24; seed++) expect(count.get(String(seed))).toBe(3)
    // Everyone who misses gold has a Sunday game: silver+bronze cover
    // 24 - 8 = 16 teams -> 8 crossover games.
    const cross = p.games.filter((g) => g.round === "Silver" || g.round === "Bronze")
    expect(cross.length).toBe(8)
  })
  it("snake seeding: no pool holds two top-6 seeds (24 teams)", () => {
    const p = buildPools(24, false)
    const byPool = new Map<string, number[]>()
    for (const g of p.games.filter((x) => x.tier === 0)) {
      if (!byPool.has(g.round)) byPool.set(g.round, [])
      for (const s of [g.home, g.away]) {
        const seed = Number(s.ref)
        if (!byPool.get(g.round)!.includes(seed)) byPool.get(g.round)!.push(seed)
      }
    }
    for (const seeds of byPool.values()) {
      expect(seeds.filter((s) => s <= 6)).toHaveLength(1)
    }
  })
})

describe("buildPlacement — NPH Gr 9-12 style, no elimination", () => {
  it("18 teams x 4 rounds: everyone exactly 4 games, no rematches", () => {
    const p = buildPlacement(18, 4)
    expect(p.games).toHaveLength(36) // 18*4/2
    const count = new Map<string, number>()
    const pairs = new Set<string>()
    for (const g of p.games) {
      for (const s of [g.home, g.away]) count.set(s.ref, (count.get(s.ref) ?? 0) + 1)
      const pk = `${g.home.ref}|${g.away.ref}`
      expect(pairs.has(pk)).toBe(false)
      pairs.add(pk)
    }
    for (let seed = 1; seed <= 18; seed++) expect(count.get(String(seed))).toBe(4)
    expect(p.guaranteedGames).toBe(4)
  })
})

describe("divisionFirstRound1 — NPH day-1 pairing (division-first opening round)", () => {
  const divOf = (groups: Record<string, number[]>) => (seed: number) => {
    for (const [d, seeds] of Object.entries(groups)) if (seeds.includes(seed)) return d
    return null
  }

  it("pairs the opening round within divisions where possible, keeping ids and later rounds intact", () => {
    // 16 teams, two divisions of 8 interleaved by seed.
    const st = buildBracket(16, false, true)
    const before = st.games.map((g) => g.id).join(",")
    const A = [1, 3, 5, 7, 9, 11, 13, 15]
    const B = [2, 4, 6, 8, 10, 12, 14, 16]
    divisionFirstRound1(st.games, divOf({ A, B }))
    expect(st.games.map((g) => g.id).join(",")).toBe(before)
    const opening = st.games.filter((g) => g.tier === 0)
    // Every opening game is same-division (8v8 splits cleanly).
    for (const g of opening) {
      const d1 = divOf({ A, B })(Number(g.home.ref))
      const d2 = divOf({ A, B })(Number(g.away.ref))
      expect(d1).toBe(d2)
    }
    // Every seed 1..16 appears exactly once in the opening round.
    const seen = opening.flatMap((g) => [Number(g.home.ref), Number(g.away.ref)]).sort((a, b) => a - b)
    expect(seen).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
    // Non-opening rounds only reference winners/losers — untouched shape.
    for (const g of st.games.filter((x) => x.tier > 0)) {
      expect(["WINNER", "LOSER"]).toContain(g.home.type)
    }
  })

  it("odd division counts: leftovers cross, everyone still plays exactly once", () => {
    const st = buildBracket(12, false, true) // 4 byes: seeds 1-4 skip round 1 (seeds 5..12 play)
    const groups = { A: [1, 5, 6, 9, 10], B: [2, 7, 8, 11], C: [3, 4, 12] }
    divisionFirstRound1(st.games, divOf(groups))
    const opening = st.games.filter((g) => g.tier === 0 && g.home.type === "SEED")
    const seen = opening.flatMap((g) => [Number(g.home.ref), Number(g.away.ref)]).sort((a, b) => a - b)
    expect(seen).toEqual([5, 6, 7, 8, 9, 10, 11, 12]) // byes untouched
    // A's playing seeds {5,6,9,10} pair internally; B's {7,8,11} yields one internal pair + leftover; C {12} leftover crosses.
    const sameCount = opening.filter((g) => {
      const f = divOf(groups)
      return f(Number(g.home.ref)) === f(Number(g.away.ref))
    }).length
    expect(sameCount).toBe(3) // (5v10)(6v9) in A, (7v11) in B; 8 crosses 12
  })

  it("no-op when every team is in one division", () => {
    const st = buildBracket(8, true)
    const snapshot = JSON.stringify(st.games)
    divisionFirstRound1(st.games, () => "ONLY")
    const opening = st.games.filter((g) => g.tier === 0)
    const seen = opening.flatMap((g) => [Number(g.home.ref), Number(g.away.ref)]).sort((a, b) => a - b)
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(JSON.stringify(st.games).length).toBe(snapshot.length)
  })
})
