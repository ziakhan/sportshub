import { describe, it, expect } from "vitest"
import { computeRankChanges, ordinal } from "./standings-movement"
import type { StandingsGame } from "../standings/compute"

describe("ordinal", () => {
  it("formats common cases", () => {
    expect(ordinal(1)).toBe("1st")
    expect(ordinal(2)).toBe("2nd")
    expect(ordinal(3)).toBe("3rd")
    expect(ordinal(4)).toBe("4th")
    expect(ordinal(11)).toBe("11th")
    expect(ordinal(12)).toBe("12th")
    expect(ordinal(13)).toBe("13th")
    expect(ordinal(21)).toBe("21st")
    expect(ordinal(22)).toBe("22nd")
    expect(ordinal(23)).toBe("23rd")
  })
})

const division = [
  { divisionId: "d1", divisionName: "U12 East", teams: [
    { teamId: "lords", name: "Lords", divisionId: "d1" },
    { teamId: "kings", name: "Kings", divisionId: "d1" },
    { teamId: "suns", name: "Suns", divisionId: "d1" },
    { teamId: "heat", name: "Heat", divisionId: "d1" },
  ] },
]

const game = (
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
): StandingsGame => ({
  id,
  status: "COMPLETED",
  homeTeamId,
  awayTeamId,
  homeScore,
  awayScore,
  defaultedBy: null,
})

describe("computeRankChanges", () => {
  it("reports a team that jumps up after winning", () => {
    // Before g5: kings/suns/heat all 2-0/1-1 mix that puts Lords 4th; g5 is
    // Lords beating Kings, which should push Lords up.
    const games: StandingsGame[] = [
      game("g1", "kings", "suns", 40, 20), // kings 1-0
      game("g2", "suns", "heat", 30, 25), // suns 1-1(vs kings loss)... just needs some prior record
      game("g3", "heat", "lords", 35, 20), // heat beats lords; lords 0-1
      game("g4", "kings", "heat", 30, 28), // kings 2-0
      game("g5", "lords", "kings", 50, 45), // lords beats kings (the game we're evaluating)
    ]
    const changes = computeRankChanges({
      gameId: "g5",
      homeTeamId: "lords",
      awayTeamId: "kings",
      homeTeamName: "Lords",
      awayTeamName: "Kings",
      tiebreakerOrder: [],
      teamsByDivision: division,
      games,
    })
    const lords = changes.find((c) => c.teamId === "lords")
    expect(lords).toBeTruthy()
    expect(lords!.rankAfter).toBeLessThan(lords!.rankBefore ?? Infinity)
    expect(lords!.divisionName).toBe("U12 East")
  })

  it("a season-opener never fires — no real 'before' baseline to jump from", () => {
    // Pre-season, every team ties 0-0; that tie order is array-insertion
    // arbitrary, not a real rank. A single game with no other history on
    // record must not manufacture a false "jump" for the winner.
    const games: StandingsGame[] = [game("g1", "lords", "kings", 40, 30)]
    const changes = computeRankChanges({
      gameId: "g1",
      homeTeamId: "lords",
      awayTeamId: "kings",
      homeTeamName: "Lords",
      awayTeamName: "Kings",
      tiebreakerOrder: [],
      teamsByDivision: division,
      games,
    })
    expect(changes).toEqual([])
  })

  it("reports nothing when rank is unchanged or worsens (with real prior history)", () => {
    const games: StandingsGame[] = [
      game("g0", "lords", "suns", 40, 10), // lords already has a prior win on record
      game("g1", "lords", "kings", 10, 50), // this game: lords loses big
    ]
    const changes = computeRankChanges({
      gameId: "g1",
      homeTeamId: "lords",
      awayTeamId: "kings",
      homeTeamName: "Lords",
      awayTeamName: "Kings",
      tiebreakerOrder: [],
      teamsByDivision: division,
      games,
    })
    expect(changes.find((c) => c.teamId === "lords")).toBeUndefined()
  })
})
