import { describe, it, expect } from "vitest"
import {
  analyzeGame,
  buildTemplateRecap,
  type RecapInput,
  type RecapScoreEvent,
} from "./recap"

const HOME = { id: "tH", name: "Raptors" }
const AWAY = { id: "tA", name: "Hawks" }

let seq = 0
const score = (teamId: string, points: number, period = 1): RecapScoreEvent => ({
  teamId,
  points,
  period,
  sequence: ++seq,
})

const base = (over: Partial<RecapInput> = {}): RecapInput => ({
  homeTeam: HOME,
  awayTeam: AWAY,
  homeScore: 50,
  awayScore: 40,
  scoreEvents: [],
  playerLines: [],
  ...over,
})

describe("analyzeGame", () => {
  it("identifies winner and margin", () => {
    const s = analyzeGame(base({ homeScore: 61, awayScore: 58 }))
    expect(s.winner.id).toBe("tH")
    expect(s.margin).toBe(3)
  })

  it("counts lead changes", () => {
    const s = analyzeGame(
      base({
        scoreEvents: [
          score("tH", 2), // H leads
          score("tA", 3), // A leads (change 1)
          score("tH", 2), // H leads (change 2)
          score("tH", 2),
          score("tA", 2), // still H lead — no change
        ],
      })
    )
    expect(s.leadChanges).toBe(2)
  })

  it("finds the biggest unanswered run and its period", () => {
    const s = analyzeGame(
      base({
        scoreEvents: [
          score("tA", 2, 1),
          score("tH", 2, 2),
          score("tH", 3, 2),
          score("tH", 2, 3),
          score("tA", 2, 3),
        ],
      })
    )
    expect(s.biggestRun).toEqual({ teamId: "tH", points: 7, period: 2 })
  })

  it("handles no score events", () => {
    const s = analyzeGame(base())
    expect(s.leadChanges).toBe(0)
    expect(s.biggestRun).toBeNull()
  })
})

describe("buildTemplateRecap", () => {
  it("is deterministic", () => {
    const input = base({
      scoreEvents: [score("tH", 2), score("tA", 2), score("tH", 3)],
      playerLines: [
        { playerId: "p1", teamId: "tH", name: "Maya K.", points: 12, rebounds: 5, assists: 2 },
      ],
    })
    expect(buildTemplateRecap(input)).toEqual(buildTemplateRecap(input))
  })

  it("titles a blowout as a rout", () => {
    const { title } = buildTemplateRecap(base({ homeScore: 70, awayScore: 40 }))
    expect(title).toBe("Raptors rolls past Hawks 70–40")
  })

  it("titles a close game as an edge and away winners correctly", () => {
    const { title } = buildTemplateRecap(base({ homeScore: 55, awayScore: 57 }))
    expect(title).toBe("Hawks edges Raptors 57–55")
  })

  it("names top performers with privacy-safe names and stat lines", () => {
    const { body } = buildTemplateRecap(
      base({
        playerLines: [
          { playerId: "p1", teamId: "tH", name: "Maya K.", points: 18, rebounds: 7, assists: 1 },
          { playerId: "p2", teamId: "tH", name: "Liam O.", points: 10, rebounds: 2, assists: 0 },
          { playerId: "p3", teamId: "tA", name: "Ava R.", points: 14, rebounds: 3, assists: 5 },
        ],
      })
    )
    expect(body).toContain("Maya K. led Raptors with 18 points and 7 rebounds.")
    expect(body).toContain("Ava R. paced Hawks with 14 points and 5 assists.")
    expect(body).not.toContain("Liam O.")
  })

  it("mentions a game-breaking run by the winner", () => {
    const { body } = buildTemplateRecap(
      base({
        scoreEvents: [
          score("tA", 2, 1),
          score("tH", 2, 3),
          score("tH", 2, 3),
          score("tH", 3, 3),
          score("tH", 2, 3),
        ],
      })
    )
    expect(body).toContain("9-0 run in the third quarter broke the game open for Raptors")
  })

  it("includes league and season context in the lead", () => {
    const { body } = buildTemplateRecap(
      base({ leagueName: "Metro League", seasonLabel: "Spring 2026" })
    )
    expect(body).toContain("in Metro League Spring 2026 action")
  })

  it("uses halves language when configured", () => {
    const { body } = buildTemplateRecap(
      base({
        periodType: "HALVES",
        scoreEvents: [
          score("tA", 2, 1),
          score("tH", 2, 2),
          score("tH", 2, 2),
          score("tH", 2, 2),
        ],
      })
    )
    expect(body).toContain("second half")
  })

  it("keeps the body a reasonable recap length", () => {
    const { body } = buildTemplateRecap(
      base({
        leagueName: "Metro League",
        seasonLabel: "Spring 2026",
        dateLabel: "Saturday, July 4",
        scoreEvents: [score("tH", 2), score("tA", 3), score("tH", 2), score("tH", 2)],
        playerLines: [
          { playerId: "p1", teamId: "tH", name: "Maya K.", points: 18, rebounds: 7, assists: 4 },
          { playerId: "p3", teamId: "tA", name: "Ava R.", points: 14, rebounds: 3, assists: 5 },
        ],
      })
    )
    const words = body.split(/\s+/).length
    expect(words).toBeGreaterThan(30)
    expect(words).toBeLessThan(220)
  })
})
