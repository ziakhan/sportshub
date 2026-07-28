import { describe, it, expect } from "vitest"
import { detectPlayerMilestones, isDoubleDouble, type PriorLine, type StatLine } from "./milestones"

const line = (points: number, rebounds = 0, assists = 0, steals = 0, blocks = 0): StatLine => ({
  points,
  rebounds,
  assists,
  steals,
  blocks,
})

const prior = (gameId: string, points: number, rebounds = 0, assists = 0, steals = 0, blocks = 0): PriorLine => ({
  gameId,
  points,
  rebounds,
  assists,
  steals,
  blocks,
})

describe("isDoubleDouble", () => {
  it("requires two categories at 10+", () => {
    expect(isDoubleDouble(line(12, 11))).toBe(true)
    expect(isDoubleDouble(line(12, 9))).toBe(false)
    expect(isDoubleDouble(line(4, 10, 10))).toBe(true)
  })
})

describe("detectPlayerMilestones", () => {
  it("no candidates for an unremarkable game with history", () => {
    const out = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(8, 3, 1),
      priorSeasonGames: [prior("g1", 10), prior("g2", 12)],
      priorCareerGames: [prior("g1", 10), prior("g2", 12)],
    })
    expect(out).toEqual([])
  })

  it("fires SEASON_HIGH only when it beats the prior season max, never on game 1", () => {
    const gameOne = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(30),
      priorSeasonGames: [],
      priorCareerGames: [],
    })
    expect(gameOne.some((c) => c.type === "SEASON_HIGH")).toBe(false)

    const newHigh = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(25),
      priorSeasonGames: [prior("g1", 10), prior("g2", 20)],
      priorCareerGames: [prior("g1", 10), prior("g2", 20)],
    })
    expect(newHigh).toContainEqual({ type: "SEASON_HIGH", playerId: "p1", value: 25 })

    const notAHigh = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(15),
      priorSeasonGames: [prior("g1", 10), prior("g2", 20)],
      priorCareerGames: [prior("g1", 10), prior("g2", 20)],
    })
    expect(notAHigh.some((c) => c.type === "SEASON_HIGH")).toBe(false)
  })

  it("fires FIRST_20 once, career-scoped", () => {
    const first = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(22),
      priorSeasonGames: [prior("g1", 8)],
      priorCareerGames: [prior("g1", 8), prior("g0", 5)],
    })
    expect(first).toContainEqual({ type: "FIRST_20", playerId: "p1", value: 22 })

    const second = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(24),
      priorSeasonGames: [prior("g1", 22)],
      priorCareerGames: [prior("g1", 22)],
    })
    expect(second.some((c) => c.type === "FIRST_20")).toBe(false)
  })

  it("fires FIRST_DOUBLE_DOUBLE once, career-scoped", () => {
    const first = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(14, 11),
      priorSeasonGames: [],
      priorCareerGames: [prior("g0", 8, 6)],
    })
    expect(first).toContainEqual({ type: "FIRST_DOUBLE_DOUBLE", playerId: "p1", value: 14 })

    const second = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(16, 12),
      priorSeasonGames: [],
      priorCareerGames: [prior("g0", 14, 11)],
    })
    expect(second.some((c) => c.type === "FIRST_DOUBLE_DOUBLE")).toBe(false)
  })

  it("fires CAREER_100 exactly when the threshold is crossed", () => {
    const crosses = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(15),
      priorSeasonGames: [],
      priorCareerGames: [prior("g0", 90)],
    })
    expect(crosses).toContainEqual({ type: "CAREER_100", playerId: "p1", value: 105 })

    const alreadyPast = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(15),
      priorSeasonGames: [],
      priorCareerGames: [prior("g0", 120)],
    })
    expect(alreadyPast.some((c) => c.type === "CAREER_100")).toBe(false)

    const stillShort = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(5),
      priorSeasonGames: [],
      priorCareerGames: [prior("g0", 50)],
    })
    expect(stillShort.some((c) => c.type === "CAREER_100")).toBe(false)
  })

  it("fires SCORE_STREAK at 5 and again at 10, not in between", () => {
    const fourPrior = Array.from({ length: 4 }, (_, i) => prior(`g${i}`, 5))
    const atFive = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(3),
      priorSeasonGames: fourPrior,
      priorCareerGames: fourPrior,
    })
    expect(atFive).toContainEqual({ type: "SCORE_STREAK", playerId: "p1", value: 5 })

    const sixPrior = Array.from({ length: 6 }, (_, i) => prior(`g${i}`, 5))
    const atSeven = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(3),
      priorSeasonGames: sixPrior,
      priorCareerGames: sixPrior,
    })
    expect(atSeven.some((c) => c.type === "SCORE_STREAK")).toBe(false)

    const ninePrior = Array.from({ length: 9 }, (_, i) => prior(`g${i}`, 5))
    const atTen = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(3),
      priorSeasonGames: ninePrior,
      priorCareerGames: ninePrior,
    })
    expect(atTen).toContainEqual({ type: "SCORE_STREAK", playerId: "p1", value: 10 })
  })

  it("a zero-point game immediately before resets the streak, even with scoring games further back", () => {
    // 4 consecutive scoring games sit right before a zero — the zero breaks
    // the chain, so the streak walk must stop there (not count all 4).
    const withGap = [prior("g1", 5), prior("g2", 5), prior("g3", 5), prior("g4", 5), prior("g5", 0)]
    const out = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(5),
      priorSeasonGames: withGap,
      priorCareerGames: withGap,
    })
    expect(out.some((c) => c.type === "SCORE_STREAK")).toBe(false)
  })

  it("a zero-point CURRENT game never fires a streak, regardless of history", () => {
    const allScoring = Array.from({ length: 6 }, (_, i) => prior(`g${i}`, 5))
    const out = detectPlayerMilestones({
      playerId: "p1",
      thisGame: line(0),
      priorSeasonGames: allScoring,
      priorCareerGames: allScoring,
    })
    expect(out.some((c) => c.type === "SCORE_STREAK")).toBe(false)
  })
})
