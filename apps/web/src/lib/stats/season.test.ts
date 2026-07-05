import { describe, it, expect } from "vitest"
import {
  aggregateSeasonStats,
  computeLeaders,
  type SeasonStatLine,
} from "./season"

const line = (
  playerId: string,
  gameId: string,
  points = 0,
  rebounds = 0,
  assists = 0,
  steals = 0,
  blocks = 0,
  turnovers = 0,
  fouls = 0
): SeasonStatLine => ({ playerId, gameId, points, rebounds, assists, steals, blocks, turnovers, fouls })

describe("aggregateSeasonStats", () => {
  it("returns empty for no lines", () => {
    expect(aggregateSeasonStats([])).toEqual([])
  })

  it("totals and averages across games", () => {
    const aggs = aggregateSeasonStats([
      line("p1", "g1", 10, 5, 2),
      line("p1", "g2", 21, 4, 3),
      line("p1", "g3", 8, 6, 1),
    ])
    expect(aggs).toHaveLength(1)
    const a = aggs[0]
    expect(a.gamesPlayed).toBe(3)
    expect(a.points).toBe(39)
    expect(a.ppg).toBe(13)
    expect(a.rpg).toBe(5)
    expect(a.apg).toBe(2)
  })

  it("rounds averages to one decimal", () => {
    const aggs = aggregateSeasonStats([line("p1", "g1", 11), line("p1", "g2", 12), line("p1", "g3", 12)])
    expect(aggs[0].ppg).toBe(11.7)
  })

  it("ignores duplicate rows for the same game", () => {
    const aggs = aggregateSeasonStats([line("p1", "g1", 10), line("p1", "g1", 10)])
    expect(aggs[0].gamesPlayed).toBe(1)
    expect(aggs[0].points).toBe(10)
  })

  it("keeps players separate", () => {
    const aggs = aggregateSeasonStats([line("p1", "g1", 10), line("p2", "g1", 4)])
    expect(aggs).toHaveLength(2)
  })
})

describe("computeLeaders", () => {
  const teamGamesPlayed = { tA: 4, tB: 4 }
  const playerTeam = { p1: "tA", p2: "tA", p3: "tB" }

  it("ranks by per-game average, descending", () => {
    const aggs = aggregateSeasonStats([
      line("p1", "g1", 10),
      line("p1", "g2", 10),
      line("p2", "g1", 15),
      line("p2", "g2", 5),
      line("p3", "g3", 30),
      line("p3", "g4", 2),
    ])
    const rows = computeLeaders(aggs, { category: "ppg", playerTeam, teamGamesPlayed })
    expect(rows.map((r) => r.playerId)).toEqual(["p3", "p1", "p2"])
    expect(rows[0].value).toBe(16)
    expect(rows[0].total).toBe(32)
  })

  it("breaks average ties by season total", () => {
    const aggs = aggregateSeasonStats([
      line("p1", "g1", 10),
      line("p1", "g2", 10),
      line("p1", "g3", 10),
      line("p2", "g1", 10),
      line("p2", "g2", 10),
    ])
    const rows = computeLeaders(aggs, { category: "ppg", playerTeam, teamGamesPlayed })
    expect(rows.map((r) => r.playerId)).toEqual(["p1", "p2"])
  })

  it("excludes players under the min-games threshold", () => {
    // Team played 4; default threshold ceil(0.5*4)=2 games
    const aggs = aggregateSeasonStats([
      line("p1", "g1", 40), // 1 game only — hot streak, ineligible
      line("p2", "g1", 8),
      line("p2", "g2", 8),
    ])
    const rows = computeLeaders(aggs, { category: "ppg", playerTeam, teamGamesPlayed })
    expect(rows.map((r) => r.playerId)).toEqual(["p2"])
  })

  it("excludes players with no team mapping", () => {
    const aggs = aggregateSeasonStats([line("ghost", "g1", 50), line("ghost", "g2", 50)])
    const rows = computeLeaders(aggs, { category: "ppg", playerTeam, teamGamesPlayed })
    expect(rows).toEqual([])
  })

  it("respects category and limit", () => {
    const aggs = aggregateSeasonStats([
      line("p1", "g1", 0, 12),
      line("p1", "g2", 0, 8),
      line("p2", "g1", 0, 6),
      line("p2", "g2", 0, 6),
      line("p3", "g3", 0, 2),
      line("p3", "g4", 0, 2),
    ])
    const rows = computeLeaders(aggs, {
      category: "rpg",
      playerTeam,
      teamGamesPlayed,
      limit: 2,
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].playerId).toBe("p1")
    expect(rows[0].value).toBe(10)
  })

  it("treats a team with zero completed games as ineligible", () => {
    const aggs = aggregateSeasonStats([line("p1", "g1", 20)])
    const rows = computeLeaders(aggs, {
      category: "ppg",
      playerTeam: { p1: "tX" },
      teamGamesPlayed: { tX: 0 },
    })
    expect(rows).toEqual([])
  })
})
