import { describe, expect, it } from "vitest"
import { consolidate, evaluatorDeviations, type CategoryWeight, type RatingInput } from "./scoring"

const CATS: CategoryWeight[] = [
  { key: "shooting", label: "Shooting", weight: 2 },
  { key: "defense", label: "Defense", weight: 1 },
]

const r = (playerId: string, evaluatorId: string, categoryKey: string, score: number): RatingInput => ({
  playerId,
  evaluatorId,
  categoryKey,
  score,
})

describe("consolidate", () => {
  it("weights categories rather than averaging them flat", () => {
    // Shooting counts double, so 5/2 must land at 4, not at 3.5.
    const [rep] = consolidate([r("p1", "e1", "shooting", 5), r("p1", "e1", "defense", 2)], CATS)
    expect(rep.overall).toBe(4)
  })

  it("counts evaluators, not ratings", () => {
    const [rep] = consolidate(
      [
        r("p1", "e1", "shooting", 4),
        r("p1", "e1", "defense", 4),
        r("p1", "e2", "shooting", 3),
        r("p1", "e2", "defense", 3),
      ],
      CATS
    )
    expect(rep.evaluatorCount).toBe(2)
  })

  it("flags a player only one coach saw, and does not dress it as a score", () => {
    const [rep] = consolidate([r("p1", "e1", "shooting", 5)], CATS)
    expect(rep.lowConfidence).toBe(true)
  })

  it("reports the spread and flags real disagreement", () => {
    const rows = [
      r("p1", "e1", "shooting", 5),
      r("p1", "e1", "defense", 5),
      r("p1", "e2", "shooting", 2),
      r("p1", "e2", "defense", 2),
      r("p1", "e3", "shooting", 4),
      r("p1", "e3", "defense", 4),
    ]
    const [rep] = consolidate(rows, CATS)
    expect(rep.spreadLow).toBe(2)
    expect(rep.spreadHigh).toBe(5)
    expect(rep.contested).toBe(true)
  })

  it("does not flag agreement as contested", () => {
    const rows = [
      r("p1", "e1", "shooting", 4),
      r("p1", "e1", "defense", 4),
      r("p1", "e2", "shooting", 4),
      r("p1", "e2", "defense", 3),
    ]
    const [rep] = consolidate(rows, CATS)
    expect(rep.contested).toBe(false)
  })

  it("corrects a harsh evaluator so their player is not punished for who saw them", () => {
    // The core failure this exists to prevent. Two players are genuinely
    // equal: each is the BEST player their own evaluator saw. But e_kind
    // scores 3-5 and e_harsh scores 1-3, so the raw table ranks p_kind above
    // p_harsh purely on which coach happened to be at their station.
    const rows: RatingInput[] = []
    const kind = [5, 4, 4, 3, 5, 4]
    const harsh = [3, 2, 2, 1, 3, 2]
    const players = ["a", "b", "c"]
    players.forEach((p, i) => {
      rows.push(r(`k_${p}`, "e_kind", "shooting", kind[i * 2]))
      rows.push(r(`k_${p}`, "e_kind", "defense", kind[i * 2 + 1]))
      rows.push(r(`h_${p}`, "e_harsh", "shooting", harsh[i * 2]))
      rows.push(r(`h_${p}`, "e_harsh", "defense", harsh[i * 2 + 1]))
    })

    const reports = consolidate(rows, CATS)
    const kindTop = reports.find((x) => x.playerId === "k_a")!
    const harshTop = reports.find((x) => x.playerId === "h_a")!

    // Raw: the harsh coach's best player looks worse than the kind coach's.
    expect(harshTop.overall!).toBeLessThan(kindTop.overall!)
    // Adjusted: the gap closes substantially, because each is measured
    // against the scale their own evaluator actually used.
    const rawGap = kindTop.overall! - harshTop.overall!
    const adjGap = Math.abs(kindTop.adjusted! - harshTop.adjusted!)
    expect(adjGap).toBeLessThan(rawGap)
  })

  it("leaves scores alone when an evaluator has too few to have a scale", () => {
    // One rating cannot establish a personal mean. Adjusting on it would
    // manufacture confidence out of nothing.
    const [rep] = consolidate([r("p1", "e1", "shooting", 5), r("p1", "e1", "defense", 5)], CATS)
    expect(rep.adjusted).toBe(rep.overall)
  })

  it("ranks by adjusted score", () => {
    const rows = [
      r("low", "e1", "shooting", 2),
      r("low", "e1", "defense", 2),
      r("high", "e1", "shooting", 5),
      r("high", "e1", "defense", 5),
    ]
    const reports = consolidate(rows, CATS)
    expect(reports[0].playerId).toBe("high")
  })
})

describe("evaluatorDeviations", () => {
  const consistent = (playerId: string, evaluatorId: string, score: number): RatingInput[] => [
    r(playerId, evaluatorId, "shooting", score),
    r(playerId, evaluatorId, "defense", score),
  ]

  it("does not flag an evaluator who is simply harsh across the board", () => {
    // e3 is a full point below everyone on EVERY player. That is systematic
    // bias, which normalisation already handles, and it must not be reported
    // as suspicious behaviour.
    const rows: RatingInput[] = []
    for (const [p, base] of [["p1", 4], ["p2", 3], ["p3", 5], ["p4", 4]] as const) {
      rows.push(...consistent(p, "e1", base))
      rows.push(...consistent(p, "e2", base))
      rows.push(...consistent(p, "e3", base - 1))
    }
    const flags = evaluatorDeviations(consolidate(rows, CATS))
    expect(flags.filter((f) => f.evaluatorId === "e3")).toHaveLength(0)
  })

  it("flags the shape the owner described: normal everywhere, then one player buried", () => {
    // e3 tracks consensus on three players and then drops one player by three
    // points. Mean and spread stay unremarkable, so normalisation cannot see
    // it. This is what must surface.
    const rows: RatingInput[] = []
    for (const [p, base] of [["p1", 4], ["p2", 3], ["p3", 5]] as const) {
      rows.push(...consistent(p, "e1", base))
      rows.push(...consistent(p, "e2", base))
      rows.push(...consistent(p, "e3", base))
    }
    rows.push(...consistent("target", "e1", 5))
    rows.push(...consistent("target", "e2", 5))
    rows.push(...consistent("target", "e3", 2))

    const flags = evaluatorDeviations(consolidate(rows, CATS))
    const hit = flags.find((f) => f.evaluatorId === "e3" && f.playerId === "target")
    expect(hit).toBeDefined()
    expect(hit!.delta).toBeLessThan(0)
  })

  it("stays quiet when there is no consensus to differ from", () => {
    const rows = [...consistent("p1", "e1", 5), ...consistent("p1", "e2", 2)]
    expect(evaluatorDeviations(consolidate(rows, CATS))).toHaveLength(0)
  })
})
