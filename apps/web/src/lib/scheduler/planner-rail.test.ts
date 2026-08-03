import { describe, expect, it } from "vitest"
import {
  assignmentWithMove,
  gradeGymStrip,
  gymCountsSentence,
  planningSource,
  railSuggestions,
  suggestFor,
  venuesWithoutUnit,
  type PlannerState,
  type PlannerSuggestion,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
} from "./planner-core"

/**
 * The suggestions rail, as step 3 draws it after the 2026-08-02 mock: one row
 * per suggestion, with the grade's season in miniature before and after the
 * move. These are the pure pieces behind that row — which weekends a grade
 * plays and in which building, what a move does to that, and which suggestions
 * belong in the rail at all.
 *
 * Every weekend runs 2 games per team, so a grade's games equal its team
 * count and the numbers read straight off the page.
 */

const gym = (
  venueId: string,
  name: string,
  capacityGames: number,
  fillOrder: number
): PlannerVenue => ({ venueId, name, capacityGames, fillOrder })

function unit(label: string, teams: number): PlannerUnit {
  return {
    key: `age:${label}`,
    label,
    divisionIds: [`d${label}`],
    teams,
    approved: teams,
    expected: teams,
    source: planningSource(teams, teams),
  }
}

function weekend(sessionId: string, dateISO: string, venues: PlannerVenue[]): PlannerWeekend {
  const ordered = [...venues].sort((a, b) => a.fillOrder - b.fillOrder)
  return {
    sessionId,
    label: sessionId,
    dateISO,
    capacityGames: ordered.reduce((sum, v) => sum + v.capacityGames, 0),
    largestVenueCapacity: Math.max(0, ...ordered.map((v) => v.capacityGames)),
    venues: ordered,
    targetGamesPerTeam: 2,
    assigned: [],
    assignedVenues: {},
  }
}

/** The Playground fills first and is the small building; Six Park is the big
 *  one. The shape of the owner's real season. */
const PLAYGROUND = gym("playground", "The Playground", 32, 0)
const SIXPARK = gym("sixpark", "Six Park East", 96, 1)
const SHORT: Record<string, string> = { playground: "Playground", sixpark: "Six Park" }
const nameOf = (venueId: string) => SHORT[venueId] ?? venueId

const MONTHS = [
  ["Oct 2026", "2026-10-03", "2026-10-17"],
  ["Nov 2026", "2026-11-07", "2026-11-21"],
  ["Dec 2026", "2026-12-05", "2026-12-19"],
  ["Jan 2027", "2027-01-09", "2027-01-23"],
  ["Feb 2027", "2027-02-06", "2027-02-20"],
  ["Mar 2027", "2027-03-06", "2027-03-20"],
]

/**
 * Six months, two weekends each. Grade 7 and Grade 10 fill The Playground to
 * the brim on the first weekend of every month (12 + 20 = 32 of 32); Grade 8
 * has the second weekend to itself, and plays The Playground every time.
 */
function season(): PlannerState {
  return {
    seasonId: "season",
    units: [unit("Gr7", 12), unit("Gr8", 10), unit("Gr10", 20)],
    errors: [],
    windows: MONTHS.map(([label, first, second], i) => ({
      label,
      weekends: [
        weekend(`a${i}`, first, [PLAYGROUND, SIXPARK]),
        weekend(`b${i}`, second, [PLAYGROUND, SIXPARK]),
      ],
    })),
  }
}

function calendar(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  MONTHS.forEach((_, i) => {
    out[`a${i}`] = ["age:Gr7", "age:Gr10"]
    out[`b${i}`] = ["age:Gr8"]
  })
  return out
}

describe("gradeGymStrip: a grade's season in miniature", () => {
  it("is one cell per weekend the grade plays, in date order", () => {
    const cells = gradeGymStrip(season(), calendar(), {}, "age:Gr8")
    expect(cells.map((c) => c.sessionId)).toEqual(["b0", "b1", "b2", "b3", "b4", "b5"])
    expect(cells.map((c) => c.dateISO)).toEqual([...cells.map((c) => c.dateISO)].sort())
    expect(new Set(cells.map((c) => c.venueId))).toEqual(new Set(["playground"]))
  })

  it("leaves out the weekends a grade does not play", () => {
    const cells = gradeGymStrip(season(), calendar(), {}, "age:Gr10")
    expect(cells.map((c) => c.sessionId)).toEqual(["a0", "a1", "a2", "a3", "a4", "a5"])
  })

  it("says where a hand pick put the grade, not where fill order would have", () => {
    const cells = gradeGymStrip(
      season(),
      calendar(),
      { b0: { "age:Gr8": "sixpark" } },
      "age:Gr8"
    )
    expect(cells[0].venueId).toBe("sixpark")
  })

  it("is deterministic: the same calendar draws the same strip twice", () => {
    expect(gradeGymStrip(season(), calendar(), {}, "age:Gr8")).toEqual(
      gradeGymStrip(season(), calendar(), {}, "age:Gr8")
    )
  })
})

describe("the strip after a move: Grade 8 in December", () => {
  const move = { unitKey: "age:Gr8", fromSessionId: "b2", toSessionId: "a2" }

  function after(): ReturnType<typeof gradeGymStrip> {
    return gradeGymStrip(
      season(),
      assignmentWithMove(calendar(), move.unitKey, move.fromSessionId, move.toSessionId),
      venuesWithoutUnit({}, move.unitKey, [move.fromSessionId, move.toSessionId]),
      move.unitKey
    )
  }

  it("moves Grade 8 out of its building in December, and keeps it out", () => {
    const before = gradeGymStrip(season(), calendar(), {}, "age:Gr8")
    const now = after()
    expect(before.map((c) => c.venueId)).toEqual(Array(6).fill("playground"))
    // December's first weekend is already Grade 7 and Grade 10, 32 of 32, so
    // Grade 8 lands in the other building — and a grade keeps the gym it
    // plays, so Six Park is where the rest of its season is now. That ripple
    // is the whole reason the strip shows the season and not the weekend.
    expect(now.map((c) => c.venueId)).toEqual([
      "playground",
      "playground",
      "sixpark",
      "sixpark",
      "sixpark",
      "sixpark",
    ])
    expect(now.map((c) => c.sessionId)).toEqual(["b0", "b1", "a2", "b3", "b4", "b5"])
  })

  it("says the same thing in words", () => {
    const before = gradeGymStrip(season(), calendar(), {}, "age:Gr8")
    expect(gymCountsSentence(before, after(), nameOf)).toBe(
      "Playground 6 weekends becomes Playground 2, Six Park 4."
    )
  })

  it("says nothing changed when nothing did", () => {
    const before = gradeGymStrip(season(), calendar(), {}, "age:Gr8")
    expect(gymCountsSentence(before, before, nameOf)).toBe(
      "Playground 6 weekends becomes Playground 6."
    )
  })

  it("touches neither the calendar nor the gyms it was handed", () => {
    const assignment = calendar()
    const venues = { b2: { "age:Gr8": "playground" }, a0: { "age:Gr7": "playground" } }
    const assignmentCopy = JSON.parse(JSON.stringify(assignment))
    const venuesCopy = JSON.parse(JSON.stringify(venues))
    const moved = assignmentWithMove(assignment, move.unitKey, move.fromSessionId, move.toSessionId)
    const forgotten = venuesWithoutUnit(venues, move.unitKey, [
      move.fromSessionId,
      move.toSessionId,
    ])
    gradeGymStrip(season(), moved, forgotten, move.unitKey)
    expect(assignment).toEqual(assignmentCopy)
    expect(venues).toEqual(venuesCopy)
    // And the move really did happen, in the copy.
    expect(moved.b2).toEqual([])
    expect(moved.a2).toContain("age:Gr8")
    expect(forgotten.b2).toBeUndefined()
    expect(forgotten.a0).toEqual({ "age:Gr7": "playground" })
  })
})

describe("railSuggestions: what belongs in the rail", () => {
  const problem: PlannerSuggestion = {
    kind: "overflow",
    sessionId: "a2",
    text: "a2 needs 61 games and has 54 slots, 7 short.",
  }
  const recap: PlannerSuggestion = {
    kind: "two-building",
    sessionId: "a3",
    text: "a3 fills The Playground and opens Six Park, 80 games in all.",
  }
  const doable: PlannerSuggestion = {
    kind: "move-unit",
    sessionId: "a2",
    text: "Move Grade 8 …",
    move: {
      unitKey: "age:Gr8",
      unitLabel: "Grade 8",
      games: 10,
      fromSessionId: "a2",
      fromLabel: "a2",
      toSessionId: "b2",
      toLabel: "b2",
      fromBefore: { demand: 61, capacity: 54 },
      toAfter: { demand: 89, capacity: 162 },
      resolves: "shortage",
      lands: "",
    },
  }

  it("drops the recaps that only repeat what a card already draws", () => {
    expect(railSuggestions([recap, doable])).toEqual([doable])
  })

  it("puts the problems first, whatever order they arrived in", () => {
    expect(railSuggestions([doable, problem])).toEqual([problem, doable])
  })

  it("keeps a two-building suggestion that is one tap from being done", () => {
    const actionable = { ...recap, move: doable.move }
    expect(railSuggestions([actionable])).toEqual([actionable])
  })

  it("leaves suggestFor itself alone, because other surfaces read it", () => {
    // One weekend, all three grades: The Playground fills and Six Park opens,
    // and no other weekend that month can take the spill — so the recap has no
    // move on it. The API still composes it; the rail simply does not show it.
    const oneWeekend: PlannerState = {
      seasonId: "season",
      units: [unit("Gr7", 12), unit("Gr8", 10), unit("Gr10", 20)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [weekend("only", "2026-10-03", [PLAYGROUND, SIXPARK])],
        },
      ],
    }
    const all = suggestFor(oneWeekend, { only: ["age:Gr7", "age:Gr8", "age:Gr10"] }, {})
    expect(all.some((s) => s.kind === "two-building" && !s.move)).toBe(true)
    expect(railSuggestions(all)).toEqual([])
  })
})
