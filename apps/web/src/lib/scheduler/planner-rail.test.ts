import { describe, expect, it } from "vitest"
import {
  assignmentWithMove,
  gradeGymStrip,
  gradeHomeGym,
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

/** One court, one day, so a court-day is the whole building and a rental of
 *  any size reads as "1 court" — these tests are about which building, not
 *  about how many courts of it. */
const gym = (
  venueId: string,
  name: string,
  capacityGames: number,
  role: "home" | "pool"
): PlannerVenue => ({ venueId, name, capacityGames, role, fillOrder: 0 })

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
  const ordered = [...venues].sort(
    (a, b) => (a.role === "home" ? 0 : 1) - (b.role === "home" ? 0 : 1)
  )
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

/** The Playground is the building the league OWNS and it is the small one;
 *  Six Park is the big rented hub. The shape of the owner's real season. */
const PLAYGROUND = gym("playground", "The Playground", 32, "home")
const SIXPARK = gym("sixpark", "Six Park East", 96, "pool")
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

describe("gradeHomeGym: the building a grade calls home", () => {
  it("is the one it plays most, whatever the last weekend does", () => {
    // A hand pick on the final weekend, and only that weekend: five weekends of
    // The Playground still decide where Grade 8 lives.
    const cells = gradeGymStrip(season(), calendar(), { b5: { "age:Gr8": "sixpark" } }, "age:Gr8")
    expect(cells.map((c) => c.venueId)).toEqual([
      "playground",
      "playground",
      "playground",
      "playground",
      "playground",
      "sixpark",
    ])
    expect(gradeHomeGym(cells)).toBe("playground")
  })

  it("is nothing at all for a grade the calendar never places", () => {
    expect(gradeHomeGym([])).toBeNull()
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
    // Grade 8 has to be rented a court at Six Park for THAT weekend. Every
    // weekend after it, the building the league owns has room again, and
    // consolidation brings Grade 8 straight back home (owner ruling
    // 2026-08-03: residency is never worth a rented court-day). Under the old
    // rule the grade stayed at Six Park for the rest of the season.
    expect(now.map((c) => c.venueId)).toEqual([
      "playground",
      "playground",
      "sixpark",
      "playground",
      "playground",
      "playground",
    ])
    expect(now.map((c) => c.sessionId)).toEqual(["b0", "b1", "a2", "b3", "b4", "b5"])
  })

  it("says the same thing in words", () => {
    const before = gradeGymStrip(season(), calendar(), {}, "age:Gr8")
    expect(gymCountsSentence(before, after(), nameOf)).toBe(
      "Playground 6 weekends becomes Playground 5, Six Park 1."
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
    text: "a3 fills Playground and rents 2 courts at Six Park, 80 games in all.",
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
    // One weekend, all three grades: the owned building fills and a court is
    // rented at Six Park, and no other weekend that month can take the spill —
    // so the recap has no move on it. The API still composes it; the rail
    // simply does not show it.
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

/**
 * A tidy-up move must not quietly cost a grade the building it plays in, so a
 * rental note only carries a button when the move leaves the grade somewhere
 * it already belongs. What the 2026-08-03 ruling changed is what "belongs"
 * means: landing in the building the league OWNS is always allowed, because it
 * takes the grade off a rented court and costs nobody anything. Landing on
 * some OTHER rented building is still vetoed.
 *
 * Feasibility outranks both: a shortage move ships whatever it costs the
 * grade's residency, and says what it costs.
 *
 * The shape below is the owner's: Grade 8 plays The Playground from October,
 * December shrinks it, Grade 10 takes what is left and Grade 8 is rented a
 * court at Six Park. December's first weekend now rents, and the only grade
 * whose leaving would end that rental is Grade 8.
 */
describe("suggestFor: what a tidy-up move is allowed to cost", () => {
  const SMALL_PLAYGROUND = gym("playground", "The Playground", 24, "home")

  /** `second` is what December's other weekend has open, which is what decides
   *  where the move would stand Grade 8. */
  function december(second: PlannerVenue[]): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr8", 10), unit("Gr10", 20)],
      errors: [],
      windows: [
        { label: "Oct 2026", weekends: [weekend("oct", "2026-10-03", [PLAYGROUND, SIXPARK])] },
        { label: "Nov 2026", weekends: [weekend("nov", "2026-11-07", [PLAYGROUND, SIXPARK])] },
        {
          label: "Dec 2026",
          weekends: [
            weekend("dec1", "2026-12-05", [SMALL_PLAYGROUND, SIXPARK]),
            weekend("dec2", "2026-12-19", second),
          ],
        },
      ],
    }
  }

  const CALENDAR: Record<string, string[]> = {
    oct: ["age:Gr8", "age:Gr10"],
    nov: ["age:Gr8", "age:Gr10"],
    dec1: ["age:Gr8", "age:Gr10"],
    dec2: [],
  }

  it("says nothing to press when the move would park the grade in ANOTHER rental", () => {
    // December's other weekend has no home gym at all, only a rented hall, so
    // the move would trade one rented court for another and take Grade 8 off
    // the building it plays. Nothing to press.
    const all = suggestFor(december([gym("north", "North Arena", 32, "pool")]), CALENDAR, {})
    const two = all.find((s) => s.kind === "two-building" && s.sessionId === "dec1")
    expect(two).toBeDefined()
    expect(two?.move).toBeUndefined()
    // The recap still ships, and it still says what December is doing.
    expect(two?.text).toContain("rents 1 court at Six Park")
    expect(two?.text).not.toContain("Move Gr8")
    expect(railSuggestions(all).some((s) => s.kind === "two-building")).toBe(false)
  })

  /**
   * RE-PINNED 2026-08-05 (owner ruling #5). Bringing the grade home is still the
   * right shape of move, but December's other weekend is EMPTY in this calendar,
   * so taking it would run one more Saturday to save one rented court. A weekend
   * is 100,000 and the booking it closes is 25,000: the rail may not offer that.
   */
  it("refuses even a come-home move when the destination weekend is not running yet", () => {
    const all = suggestFor(december([gym("playground", "The Playground", 32, "home")]), CALENDAR, {})
    const two = all.find((s) => s.kind === "two-building" && s.sessionId === "dec1")
    expect(two).toBeDefined()
    expect(two?.move).toBeUndefined()
    expect(railSuggestions(all).some((s) => s.kind === "two-building")).toBe(false)
  })

  /**
   * And the move the ruling leaves standing: the same tidy-up onto a Saturday
   * the month is ALREADY running. No new weekend, no new booking, one rental
   * closed. That is the consolidation compact-first wants, and it still ships.
   */
  it("keeps the move when the destination weekend is already in use", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr7", 6), unit("Gr8", 10), unit("Gr10", 20)],
      errors: [],
      windows: [
        { label: "Oct 2026", weekends: [weekend("oct", "2026-10-03", [PLAYGROUND, SIXPARK])] },
        {
          label: "Dec 2026",
          weekends: [
            weekend("dec1", "2026-12-05", [SMALL_PLAYGROUND, SIXPARK]),
            weekend("dec2", "2026-12-19", [gym("playground", "The Playground", 32, "home")]),
          ],
        },
      ],
    }
    // dec1 fills its 24-court home gym with Grade 10 and rents Six Park for
    // Grade 8; dec2 is already running Grade 7 in the building the league owns.
    const calendarWithBoth: Record<string, string[]> = {
      oct: ["age:Gr7", "age:Gr8", "age:Gr10"],
      dec1: ["age:Gr8", "age:Gr10"],
      dec2: ["age:Gr7"],
    }
    const all = suggestFor(state, calendarWithBoth, {})
    const two = all.find((s) => s.kind === "two-building" && s.sessionId === "dec1")
    expect(two?.move?.unitKey).toBe("age:Gr8")
    expect(two?.move?.toSessionId).toBe("dec2")
    expect(two?.move?.resolves).toBe("two-building")
    // Home again, so there is no landing to warn anybody about.
    expect(two?.move?.lands).toBe("")
    expect(railSuggestions(all).some((s) => s.kind === "two-building")).toBe(true)
  })

  it("ships a shortage move even when it lands the grade off its gym", () => {
    // November's first weekend cannot hold Grade 8 at all. Moving it is the
    // only way the weekend gets played, and the row has to say the cost.
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr8", 10)],
      errors: [],
      windows: [
        { label: "Oct 2026", weekends: [weekend("oct", "2026-10-03", [PLAYGROUND, SIXPARK])] },
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov1", "2026-11-07", [gym("playground", "The Playground", 8, "home")]),
            weekend("nov2", "2026-11-21", [
              gym("playground", "The Playground", 6, "home"),
              SIXPARK,
            ]),
          ],
        },
      ],
    }
    const all = suggestFor(state, { oct: ["age:Gr8"], nov1: ["age:Gr8"], nov2: [] }, {})
    const move = all.find((s) => s.kind === "move-unit")
    expect(move?.move?.unitKey).toBe("age:Gr8")
    expect(move?.move?.toSessionId).toBe("nov2")
    // The cost the rail has to state out loud: Grade 8 does not keep its gym.
    expect(move?.move?.lands).toContain("Lands at Six Park")
  })
})

/**
 * THE OWNER'S CASE, PINNED (owner ruling 2026-08-05, #5).
 *
 * He was looking at a month bundled onto one Saturday: the gym the league owns,
 * full to the brim and not one game over, with the month's other chosen weekend
 * sitting empty. That is compact-first getting the answer exactly right, and the
 * rail was offering to take it apart — "put the empty weekend to work" — on a
 * board with nothing wrong with it.
 *
 * A weekend costs 100,000 on the price list and a booking 25,000, so no rail row
 * may add either. These pin the whole of that: the full home weekend, the same
 * weekend once it rents a court, and the one exception the ruling keeps.
 */
describe("suggestFor: the rail speaks the same economics as the solver", () => {
  const BIG_HOME = gym("playground", "The Playground", 54, "home")

  /** 12 + 10 + 12 + 20 = 54 teams, two games each, so 54 games exactly. */
  const FULL_HOUSE = [unit("Gr7", 12), unit("Gr8", 10), unit("Gr9", 12), unit("Gr10", 20)]
  const EVERYBODY = FULL_HOUSE.map((u) => u.key)

  /** One month, two chosen weekends: the first holds the whole month, the second
   *  is running and empty. `first` is what the busy weekend has to play in. */
  function november(first: PlannerVenue[]): PlannerState {
    return {
      seasonId: "season",
      units: FULL_HOUSE,
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov1", "2026-11-07", first),
            weekend("nov2", "2026-11-21", [BIG_HOME]),
          ],
        },
      ],
    }
  }

  it("says nothing to press when the home gym is full to the brim and not over", () => {
    const state = november([BIG_HOME])
    const all = suggestFor(state, { nov1: EVERYBODY, nov2: [] }, {})
    // 54 of 54 is a weekend that fits, so there is no shortage and no second
    // building to close.
    expect(all.some((s) => s.kind === "overflow")).toBe(false)
    expect(all.some((s) => s.kind === "two-building")).toBe(false)
    // The empty Saturday is still worth SAYING, and it is not worth a button.
    expect(all.filter((s) => s.kind === "idle-weekend").map((s) => s.sessionId)).toEqual(["nov2"])
    expect(all.filter((s) => s.move)).toEqual([])
    expect(railSuggestions(all)).toEqual([])
  })

  it("says nothing to press when that full weekend also rents a court", () => {
    // The same 54 games, but the owned building is small now, so the month fills
    // it and rents Six Park for the rest. Moving a grade onto the empty Saturday
    // would close that rental and run one more weekend, which is a loss.
    const state = november([gym("playground", "The Playground", 24, "home"), SIXPARK])
    const all = suggestFor(state, { nov1: EVERYBODY, nov2: [] }, {})
    const two = all.find((s) => s.kind === "two-building" && s.sessionId === "nov1")
    expect(two).toBeDefined()
    expect(two?.text).toContain("rents")
    expect(all.filter((s) => s.move)).toEqual([])
    expect(railSuggestions(all)).toEqual([])
  })

  it("still ships the move when the weekend genuinely cannot be played", () => {
    // The owned building shrinks below the month's demand: 54 games against 40,
    // and no building on that Saturday can hold the rest. Feasibility is the one
    // thing allowed to run another weekend.
    const state = november([gym("playground", "The Playground", 40, "home")])
    const all = suggestFor(state, { nov1: EVERYBODY, nov2: [] }, {})
    expect(all.some((s) => s.kind === "overflow" && s.sessionId === "nov1")).toBe(true)
    const move = all.find((s) => s.kind === "move-unit")
    expect(move?.move?.fromSessionId).toBe("nov1")
    expect(move?.move?.toSessionId).toBe("nov2")
    expect(move?.move?.resolves).toBe("shortage")
    expect(railSuggestions(all).some((s) => s.kind === "move-unit")).toBe(true)
  })
})
