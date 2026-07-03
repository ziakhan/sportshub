import { describe, expect, it } from "vitest"
import {
  computeStandings,
  type StandingsGame,
  type StandingsInput,
  type TiebreakerKey,
} from "./compute"

// ---------- builders ----------

let gameSeq = 0

function completed(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
): StandingsGame {
  return {
    id: `g${++gameSeq}`,
    status: "COMPLETED",
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    defaultedBy: null,
  }
}

function defaulted(homeTeamId: string, awayTeamId: string, defaultedBy: string | null): StandingsGame {
  return {
    id: `g${++gameSeq}`,
    status: "DEFAULTED",
    homeTeamId,
    awayTeamId,
    homeScore: null,
    awayScore: null,
    defaultedBy,
  }
}

function withStatus(g: StandingsGame, status: StandingsGame["status"]): StandingsGame {
  return { ...g, status }
}

function division(divisionId: string, teamIds: string[]) {
  return {
    divisionId,
    divisionName: `Division ${divisionId}`,
    teams: teamIds.map((teamId) => ({ teamId, name: `Team ${teamId}`, divisionId })),
  }
}

function input(
  teamIds: string[],
  games: StandingsGame[],
  tiebreakerOrder: TiebreakerKey[] = []
): StandingsInput {
  return { tiebreakerOrder, teamsByDivision: [division("d1", teamIds)], games }
}

function rowsOf(inp: StandingsInput) {
  return computeStandings(inp)[0].rows
}

function row(inp: StandingsInput, teamId: string) {
  const r = rowsOf(inp).find((r) => r.teamId === teamId)
  if (!r) throw new Error(`row ${teamId} missing`)
  return r
}

function order(inp: StandingsInput) {
  return rowsOf(inp).map((r) => r.teamId)
}

// ---------- basic aggregation ----------

describe("computeStandings — aggregation", () => {
  it("credits a simple win/loss with points and differential", () => {
    const inp = input(["A", "B"], [completed("A", "B", 60, 50)])
    const a = row(inp, "A")
    const b = row(inp, "B")
    expect(a).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      ties: 0,
      pointsFor: 60,
      pointsAgainst: 50,
      differential: 10,
      winPct: 1,
    })
    expect(b).toMatchObject({
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
      pointsFor: 50,
      pointsAgainst: 60,
      differential: -10,
      winPct: 0,
    })
    expect(order(inp)).toEqual(["A", "B"])
  })

  it("aggregates multiple games and computes winPct", () => {
    const inp = input(
      ["A", "B", "C"],
      [
        completed("A", "B", 50, 40),
        completed("C", "A", 30, 45),
        completed("B", "A", 55, 50), // A loses one
      ]
    )
    const a = row(inp, "A")
    expect(a.gamesPlayed).toBe(3)
    expect(a.wins).toBe(2)
    expect(a.losses).toBe(1)
    expect(a.winPct).toBeCloseTo(2 / 3)
    expect(a.pointsFor).toBe(50 + 45 + 50)
    expect(a.pointsAgainst).toBe(40 + 30 + 55)
  })

  it("credits both teams a tie on an equal score (winPct counts ties as half)", () => {
    const inp = input(["A", "B"], [completed("A", "B", 44, 44)])
    for (const id of ["A", "B"]) {
      expect(row(inp, id)).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 0, ties: 1, winPct: 0.5 })
    }
  })

  it("returns all-zero rows for a division with no games", () => {
    const inp = input(["A", "B"], [])
    for (const r of rowsOf(inp)) {
      expect(r).toMatchObject({
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        differential: 0,
        winPct: 0,
        appliedTiebreakers: [],
      })
    }
  })

  it("returns an empty rows array for a division with no teams", () => {
    const out = computeStandings({ tiebreakerOrder: [], teamsByDivision: [division("d1", [])], games: [] })
    expect(out[0].rows).toEqual([])
  })

  it("includes a team with 0 games among teams with games, ranked below winners", () => {
    const inp = input(["A", "B", "C"], [completed("A", "B", 50, 40)])
    const c = row(inp, "C")
    expect(c).toMatchObject({ gamesPlayed: 0, wins: 0, winPct: 0 })
    expect(order(inp)[0]).toBe("A")
    expect(rowsOf(inp)).toHaveLength(3)
  })

  it("ignores COMPLETED games with null scores", () => {
    const g = { ...completed("A", "B", 0, 0), homeScore: null, awayScore: null }
    const inp = input(["A", "B"], [g])
    expect(row(inp, "A").gamesPlayed).toBe(0)
    expect(row(inp, "B").gamesPlayed).toBe(0)
  })
})

// ---------- DEFAULTED ----------

describe("computeStandings — defaulted games", () => {
  it("defaultedBy home: away gets a 0-0 win, home a 0-0 loss", () => {
    const inp = input(["A", "B"], [defaulted("A", "B", "A")])
    expect(row(inp, "B")).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0, pointsFor: 0, pointsAgainst: 0 })
    expect(row(inp, "A")).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1, pointsFor: 0, pointsAgainst: 0 })
  })

  it("defaultedBy away: home gets the win", () => {
    const inp = input(["A", "B"], [defaulted("A", "B", "B")])
    expect(row(inp, "A")).toMatchObject({ wins: 1, losses: 0 })
    expect(row(inp, "B")).toMatchObject({ wins: 0, losses: 1 })
  })

  it("DEFAULTED with no defaultedBy contributes nothing", () => {
    const inp = input(["A", "B"], [defaulted("A", "B", null)])
    expect(row(inp, "A").gamesPlayed).toBe(0)
    expect(row(inp, "B").gamesPlayed).toBe(0)
  })

  it("cross-division default: only the present team is credited", () => {
    const inp = input(["A"], [defaulted("A", "OUTSIDE", "OUTSIDE")])
    expect(row(inp, "A")).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0 })
  })

  it("head-to-head counts a defaulted meeting as +1/-1", () => {
    // A and B end 1-1: A won by B's default; balance via X (beats A) and Y (loses to B).
    const inp = input(
      ["A", "B", "X", "Y"],
      [
        defaulted("A", "B", "B"), // A 1-0, B 0-1
        completed("X", "A", 50, 40), // A 1-1, X 1-0
        completed("B", "Y", 60, 30), // B 1-1, Y 0-1
      ],
      ["HEAD_TO_HEAD"]
    )
    const ids = order(inp)
    // A above B despite B's far better differential (+30 vs -10)
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"))
    expect(row(inp, "A").appliedTiebreakers).toContain("HEAD_TO_HEAD")
  })
})

// ---------- tiebreakers ----------

describe("computeStandings — tiebreakers", () => {
  /** Two teams at 1-1 with configurable points, padded by fodder X (0-2) and Y (2-0). */
  function tiedPair(
    aScores: { win: [number, number]; loss: [number, number] },
    bScores: { win: [number, number]; loss: [number, number] },
    tiebreakerOrder: TiebreakerKey[]
  ) {
    return input(
      ["A", "B", "X", "Y"],
      [
        completed("A", "X", aScores.win[0], aScores.win[1]),
        completed("Y", "A", aScores.loss[1], aScores.loss[0]),
        completed("B", "X", bScores.win[0], bScores.win[1]),
        completed("Y", "B", bScores.loss[1], bScores.loss[0]),
      ],
      tiebreakerOrder
    )
  }

  it("WINS never differentiates a group already tied on wins; falls through to the next rule", () => {
    // Both 1-1; B has better differential.
    const inp = tiedPair(
      { win: [50, 45], loss: [40, 60] }, // A diff -15
      { win: [70, 40], loss: [40, 50] }, // B diff +20
      ["WINS", "POINT_DIFFERENTIAL"]
    )
    const ids = order(inp)
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("A"))
    expect(row(inp, "A").appliedTiebreakers).toEqual(["POINT_DIFFERENTIAL"])
    expect(row(inp, "B").appliedTiebreakers).toEqual(["POINT_DIFFERENTIAL"])
  })

  it("POINT_DIFFERENTIAL breaks a two-way tie", () => {
    const inp = tiedPair(
      { win: [80, 60], loss: [50, 60] }, // A diff +10
      { win: [55, 50], loss: [30, 60] }, // B diff -25
      ["POINT_DIFFERENTIAL"]
    )
    const ids = order(inp)
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"))
    expect(row(inp, "A").appliedTiebreakers).toEqual(["POINT_DIFFERENTIAL"])
  })

  it("POINTS_SCORED breaks a tie when differentials are equal", () => {
    const inp = tiedPair(
      { win: [90, 80], loss: [70, 80] }, // A diff 0, pF 160
      { win: [50, 40], loss: [30, 40] }, // B diff 0, pF 80
      ["POINT_DIFFERENTIAL", "POINTS_SCORED"]
    )
    const ids = order(inp)
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"))
    expect(row(inp, "A").appliedTiebreakers).toEqual(["POINTS_SCORED"])
  })

  it("POINTS_ALLOWED ranks the team that allowed fewer points first", () => {
    const inp = tiedPair(
      { win: [50, 40], loss: [40, 50] }, // A diff 0, pA 90
      { win: [80, 70], loss: [70, 80] }, // B diff 0, pA 150
      ["POINTS_ALLOWED"]
    )
    const ids = order(inp)
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"))
  })

  it("HEAD_TO_HEAD ranks the head-to-head winner first even with a worse differential", () => {
    const inp = input(
      ["A", "B", "X", "Y"],
      [
        completed("A", "B", 50, 40), // A beat B
        completed("X", "A", 60, 40), // A 1-1, diff -10
        completed("B", "Y", 70, 30), // B 1-1, diff +30
        completed("X", "Y", 50, 40), // X 2-0, Y 0-2
      ],
      ["HEAD_TO_HEAD", "POINT_DIFFERENTIAL"]
    )
    const ids = order(inp)
    expect(ids[0]).toBe("X")
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"))
    expect(row(inp, "A").appliedTiebreakers).toEqual(["HEAD_TO_HEAD"])
  })

  it("COIN_FLIP is deterministic: smaller teamId first, identical across runs", () => {
    const make = () =>
      tiedPair(
        { win: [50, 40], loss: [40, 50] },
        { win: [50, 40], loss: [40, 50] },
        ["COIN_FLIP"]
      )
    const first = order(make())
    const second = order(make())
    expect(first).toEqual(second)
    expect(first.indexOf("A")).toBeLessThan(first.indexOf("B"))
    // Pinned behavior: the coin flip is the terminal deterministic fallback —
    // compute does NOT record it in appliedTiebreakers (only rules that
    // resolved a tie by comparison are recorded).
    expect(row(make(), "A").appliedTiebreakers).toEqual([])
  })

  it("three-way tie: first rule peels one team off, sub-tie resolved recursively by the next rule", () => {
    // A, B, C all 1-1. Diffs: A +20/pF 130, B +20/pF 110, C -20/pF 80.
    const inp = input(
      ["A", "B", "C", "X", "Y"],
      [
        completed("A", "X", 80, 60), // A +20
        completed("Y", "A", 60, 50), // A -10 → diff +10... adjust below
        completed("B", "X", 70, 50), // B +20
        completed("Y", "B", 50, 40), // B -10
        completed("C", "X", 50, 45), // C +5
        completed("Y", "C", 55, 30), // C -25
      ],
      ["POINT_DIFFERENTIAL", "POINTS_SCORED"]
    )
    // A: diff +10, pF 130 | B: diff +10, pF 110 | C: diff -20, pF 80
    const ids = order(inp)
    expect(ids).toEqual(["Y", "A", "B", "C", "X"])
    expect(row(inp, "A").appliedTiebreakers).toEqual(["POINT_DIFFERENTIAL", "POINTS_SCORED"])
    expect(row(inp, "B").appliedTiebreakers).toEqual(["POINT_DIFFERENTIAL", "POINTS_SCORED"])
    expect(row(inp, "C").appliedTiebreakers).toEqual(["POINT_DIFFERENTIAL"])
    expect(row(inp, "Y").appliedTiebreakers).toEqual([])
  })

  it("no tiebreakers configured: tied teams keep primary-sort order without crashing", () => {
    const inp = tiedPair(
      { win: [50, 40], loss: [40, 50] },
      { win: [50, 40], loss: [40, 50] },
      []
    )
    const ids = order(inp)
    expect(ids).toHaveLength(4)
    expect(row(inp, "A").appliedTiebreakers).toEqual([])
  })

  it("unknown tiebreaker key is skipped gracefully (value 0 for everyone → falls through)", () => {
    // Pins current behavior: tiebreakerValue's default branch returns 0, so an
    // unknown key never differentiates and the next configured rule applies.
    const inp = tiedPair(
      { win: [80, 60], loss: [50, 60] }, // A diff +10
      { win: [55, 50], loss: [30, 60] }, // B diff -25
      ["BOGUS_RULE" as TiebreakerKey, "POINT_DIFFERENTIAL"]
    )
    const ids = order(inp)
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"))
    expect(row(inp, "A").appliedTiebreakers).toEqual(["POINT_DIFFERENTIAL"])
  })
})

// ---------- non-counting statuses ----------

describe("computeStandings — non-counting game statuses", () => {
  it.each(["SCHEDULED", "CANCELLED", "POSTPONED", "LIVE"] as const)(
    "%s games contribute nothing",
    (status) => {
      const inp = input(["A", "B"], [withStatus(completed("A", "B", 50, 40), status)])
      expect(row(inp, "A").gamesPlayed).toBe(0)
      expect(row(inp, "B").gamesPlayed).toBe(0)
    }
  )
})

// ---------- cross-division games ----------

describe("computeStandings — cross-division games (one team in roster)", () => {
  it("present home team gets a W on a strict win", () => {
    const inp = input(["A"], [completed("A", "OUTSIDE", 60, 50)])
    expect(row(inp, "A")).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0, ties: 0, pointsFor: 60, pointsAgainst: 50 })
  })

  it("present away team gets an L on a strict loss", () => {
    const inp = input(["A"], [completed("OUTSIDE", "A", 60, 50)])
    expect(row(inp, "A")).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1, ties: 0, pointsFor: 50, pointsAgainst: 60 })
  })

  it("equal score credits neither a win nor a loss (tie), for home or away — the >= bug fix", () => {
    const homeSide = input(["A"], [completed("A", "OUTSIDE", 44, 44)])
    const awaySide = input(["A"], [completed("OUTSIDE", "A", 44, 44)])
    for (const inp of [homeSide, awaySide]) {
      expect(row(inp, "A")).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 0, ties: 1, winPct: 0.5 })
    }
  })

  it("multiple divisions each compute independently and both see a shared game", () => {
    const out = computeStandings({
      tiebreakerOrder: [],
      teamsByDivision: [division("d1", ["A"]), division("d2", ["B"])],
      games: [completed("A", "B", 60, 50)],
    })
    const a = out[0].rows[0]
    const b = out[1].rows[0]
    expect(a).toMatchObject({ divisionId: "d1", wins: 1, losses: 0 })
    expect(b).toMatchObject({ divisionId: "d2", wins: 0, losses: 1 })
  })
})
