import { describe, expect, it } from "vitest"
import {
  packPlanVenues,
  packWeekendVenues,
  planningSource,
  proposePlan,
  resolveWeekendGyms,
  weekendDemand,
  type PlannerState,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
} from "./planner-core"

/**
 * Which BUILDING a grade plays in (owner ruling 2026-08-02): gyms fill in
 * order, a grade is never split across two of them, and a grade keeps the
 * same gym all season unless capacity forces a move — or is flagged to
 * alternate buildings on purpose.
 *
 * Every weekend here runs 2 games per team, so a grade's games equal its
 * team count and the numbers in these tests read straight off the page.
 */

const gym = (
  venueId: string,
  name: string,
  capacityGames: number,
  fillOrder: number
): PlannerVenue => ({ venueId, name, capacityGames, fillOrder })

function unit(label: string, teams: number, alternate = false): PlannerUnit {
  return {
    key: `age:${label}`,
    label,
    divisionIds: [`d${label}`],
    teams,
    approved: teams,
    expected: teams,
    source: planningSource(teams, teams),
    alternate,
  }
}

/** Venues arrive the way buildPlannerState hands them over: fill order first. */
function weekend(
  sessionId: string,
  dateISO: string,
  venues: PlannerVenue[],
  targetGamesPerTeam = 2
): PlannerWeekend {
  const ordered = [...venues].sort((a, b) => a.fillOrder - b.fillOrder)
  return {
    sessionId,
    label: sessionId,
    dateISO,
    capacityGames: ordered.reduce((sum, v) => sum + v.capacityGames, 0),
    largestVenueCapacity: Math.max(0, ...ordered.map((v) => v.capacityGames)),
    venues: ordered,
    targetGamesPerTeam,
    assigned: [],
    assignedVenues: {},
  }
}

const EAST = gym("east", "Six Park East", 20, 0)
const WEST = gym("west", "Playground West", 20, 1)

describe("packWeekendVenues: gyms fill in order", () => {
  it("puts everything in the top gym while it still holds the whole load", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 8), unit("Gr8", 9)],
      weekend("s1", "2026-10-24", [EAST, WEST]),
      {}
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "east", "age:Gr8": "east" })
    expect(packed.opened).toEqual(["east"])
    expect(packed.overflow).toBe(0)
    expect(packed.violations).toBe(0)
  })

  it("opens the second gym only for the grade the first one cannot hold", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 12), unit("Gr8", 12)],
      weekend("s1", "2026-10-24", [EAST, WEST]),
      {}
    )
    // 12 + 12 = 24 games against a 20-slot first gym: one grade moves whole,
    // neither is split.
    expect(packed.opened).toEqual(["east", "west"])
    expect(Object.values(packed.byUnit).sort()).toEqual(["east", "west"])
    expect(packed.overflow).toBe(0)

    // Same two grades, a first gym big enough for both: one building.
    const roomy = packWeekendVenues(
      [unit("Gr7", 12), unit("Gr8", 12)],
      weekend("s1", "2026-10-24", [gym("east", "Six Park East", 30, 0), WEST]),
      {}
    )
    expect(roomy.opened).toEqual(["east"])
  })

  it("places the biggest grade first, so a late giant never opens a gym alone", () => {
    const packed = packWeekendVenues(
      [unit("Small", 4), unit("Big", 18)],
      weekend("s1", "2026-10-24", [EAST, WEST]),
      {}
    )
    // Big (18) takes the first gym; Small (4) has 2 slots left there, so it
    // moves. Placed small-first the pair would have wasted the top gym.
    expect(packed.byUnit).toEqual({ "age:Big": "east", "age:Small": "west" })
    expect(packed.overflow).toBe(0)
  })

  it("a grade with no teams claims no gym at all", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 0), unit("Gr8", 5)],
      weekend("s1", "2026-10-24", [EAST, WEST]),
      {}
    )
    expect(packed.byUnit).toEqual({ "age:Gr8": "east" })
    expect(packed.opened).toEqual(["east"])
  })

  it("a weekend with no gym strands every game it was given", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 12)],
      weekend("s1", "2026-10-24", []),
      {}
    )
    expect(packed.byUnit).toEqual({})
    expect(packed.opened).toEqual([])
    expect(packed.overflow).toBe(12)
  })
})

describe("packWeekendVenues: a grade keeps its gym", () => {
  it("a resident goes back to its own gym even when another fills first", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10)],
      weekend("s1", "2026-11-14", [EAST, WEST]),
      { "age:Gr7": "west" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "west" })
    expect(packed.opened).toEqual(["west"])
    expect(packed.violations).toBe(0)
  })

  it("a resident is bumped only when its gym cannot hold it, and that counts", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10)],
      weekend("s1", "2026-11-14", [gym("east", "Six Park East", 40, 0), gym("west", "Playground West", 8, 1)]),
      { "age:Gr7": "west" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "east" })
    expect(packed.violations).toBe(1)
    expect(packed.overflow).toBe(0)
  })

  it("a home gym that is not open this weekend is no broken promise", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10)],
      weekend("s1", "2026-11-14", [EAST]),
      { "age:Gr7": "north" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "east" })
    expect(packed.violations).toBe(0)
  })

  it("residents are seated before anyone else competes for the room", () => {
    // Gr8 lives in the small gym and fits it exactly; Gr7 is bigger and would
    // have taken that room had it been packed first.
    const packed = packWeekendVenues(
      [unit("Gr7", 14), unit("Gr8", 8)],
      weekend("s1", "2026-11-14", [gym("east", "Six Park East", 14, 0), gym("west", "Playground West", 8, 1)]),
      { "age:Gr8": "west" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "east", "age:Gr8": "west" })
    expect(packed.violations).toBe(0)
    expect(packed.overflow).toBe(0)
  })
})

describe("packWeekendVenues: grades that alternate buildings", () => {
  it("sends an alternating grade to the gym it did not just play", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10, true)],
      weekend("s1", "2026-11-14", [EAST, WEST]),
      { "age:Gr7": "east" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "west" })
    expect(packed.violations).toBe(0)
  })

  it("repeats a building rather than split the grade, and says it cost something", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10, true)],
      weekend("s1", "2026-11-14", [EAST, gym("west", "Playground West", 4, 1)]),
      { "age:Gr7": "east" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "east" })
    expect(packed.violations).toBe(1)
    expect(packed.overflow).toBe(0)
  })
})

describe("packWeekendVenues: more games than the building holds", () => {
  it("gives an oversize grade the roomiest gym and counts the rest as overflow", () => {
    const packed = packWeekendVenues(
      [unit("Gr10", 40)],
      weekend("s1", "2026-10-24", [
        gym("east", "Six Park East", 10, 0),
        gym("west", "Playground West", 30, 1),
      ]),
      {}
    )
    expect(packed.byUnit).toEqual({ "age:Gr10": "west" })
    expect(packed.opened).toEqual(["west"])
    expect(packed.overflow).toBe(10)
  })
})

describe("resolveWeekendGyms", () => {
  const UNITS = [unit("Gr7", 12), unit("Gr8", 12), unit("Gr9", 0)]

  it("groups the weekend's grades under the gyms they play in, in fill order", () => {
    const gyms = resolveWeekendGyms(
      UNITS,
      weekend("s1", "2026-10-24", [EAST, WEST]),
      ["age:Gr7", "age:Gr8"]
    )
    expect(gyms.sections.map((s) => s.venueId)).toEqual(["east", "west"])
    expect(gyms.sections[0].games).toBe(12)
    expect(gyms.sections[0].capacityGames).toBe(20)
    expect(gyms.overflow).toBe(0)
    expect(gyms.unplaced).toEqual([])
  })

  it("a hand-picked gym wins, even when it puts that gym over its courts", () => {
    const gyms = resolveWeekendGyms(
      UNITS,
      weekend("s1", "2026-10-24", [EAST, WEST]),
      ["age:Gr7", "age:Gr8"],
      { "age:Gr7": "east", "age:Gr8": "east" }
    )
    expect(gyms.byUnit).toEqual({ "age:Gr7": "east", "age:Gr8": "east" })
    expect(gyms.sections).toHaveLength(1)
    expect(gyms.sections[0].games).toBe(24)
    expect(gyms.sections[0].over).toBe(4)
    expect(gyms.overflow).toBe(4)
  })

  it("ignores a gym that is not on this weekend, and never loses a grade", () => {
    const gyms = resolveWeekendGyms(UNITS, weekend("s1", "2026-10-24", [EAST]), ["age:Gr7"], {
      "age:Gr7": "west",
    })
    expect(gyms.byUnit).toEqual({ "age:Gr7": "east" })

    // A grade with no teams yet still has to be somewhere the board can draw.
    const quiet = resolveWeekendGyms(UNITS, weekend("s1", "2026-10-24", [EAST, WEST]), ["age:Gr9"])
    expect(quiet.byUnit).toEqual({ "age:Gr9": "east" })
    expect(quiet.sections[0].games).toBe(0)
  })

  it("a weekend with no gym leaves its grades unplaced, and counts every game", () => {
    const gyms = resolveWeekendGyms(UNITS, weekend("s1", "2026-10-24", []), ["age:Gr7"])
    expect(gyms.sections).toEqual([])
    expect(gyms.unplaced).toEqual(["age:Gr7"])
    expect(gyms.overflow).toBe(12)
  })
})

describe("packPlanVenues", () => {
  /** Two months, one weekend each, the same two gyms both times. */
  function twoMonths(second: PlannerVenue[]): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr7", 20), unit("Gr8", 20)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("oct", "2026-10-24", [
              gym("east", "Six Park East", 25, 0),
              gym("west", "Playground West", 25, 1),
            ]),
          ],
        },
        { label: "Nov 2026", weekends: [weekend("nov", "2026-11-14", second)] },
      ],
    }
  }

  const both = { oct: ["age:Gr7", "age:Gr8"], nov: ["age:Gr7", "age:Gr8"] }

  it("carries each grade's gym forward into the next month", () => {
    // November's first gym could hold both grades — but Gr8 has been playing
    // the west gym since October, so it stays there.
    const state = twoMonths([
      gym("east", "Six Park East", 50, 0),
      gym("west", "Playground West", 50, 1),
    ])
    const venues = packPlanVenues(state, both)
    expect(venues.oct).toEqual({ "age:Gr7": "east", "age:Gr8": "west" })
    expect(venues.nov).toEqual(venues.oct)
  })

  it("moves a grade only when its gym has no room, and keeps it moved", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr7", 20), unit("Gr8", 20)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("oct", "2026-10-24", [
              gym("east", "Six Park East", 25, 0),
              gym("west", "Playground West", 25, 1),
            ]),
          ],
        },
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov", "2026-11-14", [
              gym("east", "Six Park East", 45, 0),
              gym("west", "Playground West", 5, 1),
            ]),
          ],
        },
        {
          label: "Dec 2026",
          weekends: [
            weekend("dec", "2026-12-12", [
              gym("east", "Six Park East", 45, 0),
              gym("west", "Playground West", 45, 1),
            ]),
          ],
        },
      ],
    }
    const venues = packPlanVenues(state, {
      oct: ["age:Gr7", "age:Gr8"],
      nov: ["age:Gr7", "age:Gr8"],
      dec: ["age:Gr7", "age:Gr8"],
    })
    expect(venues.oct).toEqual({ "age:Gr7": "east", "age:Gr8": "west" })
    // West is down to 5 slots in November: Gr8 has to move in with Gr7.
    expect(venues.nov).toEqual({ "age:Gr7": "east", "age:Gr8": "east" })
    // And December keeps the gym it actually played, not the one it left.
    expect(venues.dec).toEqual({ "age:Gr7": "east", "age:Gr8": "east" })
  })

  it("leaves out weekends that place nobody", () => {
    const state = twoMonths([gym("east", "Six Park East", 50, 0)])
    const venues = packPlanVenues(state, { oct: ["age:Gr7", "age:Gr8"], nov: [] })
    expect(Object.keys(venues)).toEqual(["oct"])
  })

  it("ignores grades this season does not have", () => {
    const state = twoMonths([gym("east", "Six Park East", 50, 0)])
    const venues = packPlanVenues(state, { oct: ["age:Gr7", "age:Deleted"] })
    expect(venues.oct).toEqual({ "age:Gr7": "east" })
  })

  it("is deterministic: the same season packs the same way twice", () => {
    const state = twoMonths([
      gym("east", "Six Park East", 50, 0),
      gym("west", "Playground West", 50, 1),
    ])
    expect(packPlanVenues(state, both)).toEqual(packPlanVenues(twoMonths([
      gym("east", "Six Park East", 50, 0),
      gym("west", "Playground West", 50, 1),
    ]), both))
  })
})

describe("proposePlan with buildings in the score", () => {
  /** One month, two weekends: one split across three small gyms, one big
   *  single-gym weekend of the same total capacity. */
  function splitVsSingle(): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr7", 20), unit("Gr8", 20), unit("Gr9", 20)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("split", "2026-10-24", [
              gym("a", "Gym A", 20, 0),
              gym("b", "Gym B", 20, 1),
              gym("c", "Gym C", 20, 2),
            ]),
            weekend("single", "2026-10-31", [gym("d", "Gym D", 60, 0)]),
          ],
        },
      ],
    }
  }

  it("prefers the answer that keeps every weekend in one building", () => {
    const state = splitVsSingle()
    const plan = proposePlan(state, "balance")
    const venues = packPlanVenues(state, plan)
    for (const sessionId of Object.keys(venues)) {
      const opened = new Set(Object.values(venues[sessionId]))
      expect(opened.size).toBe(1)
    }
    // Still one weekend each, still every grade placed once.
    expect([...(plan.split ?? []), ...(plan.single ?? [])].sort()).toEqual([
      "age:Gr7",
      "age:Gr8",
      "age:Gr9",
    ])
  })

  it("returns the same shape it always did: sessionId → unit keys", () => {
    const plan = proposePlan(splitVsSingle(), "balance")
    expect(Object.keys(plan).sort()).toEqual(["single", "split"])
    for (const keys of Object.values(plan)) {
      expect(Array.isArray(keys)).toBe(true)
      for (const key of keys) expect(typeof key).toBe("string")
    }
  })

  it("still refuses to overflow a weekend, gyms or no gyms", () => {
    const state = nphTwoGyms()
    const plan = proposePlan(state, "balance")
    for (const win of state.windows) {
      for (const w of win.weekends) {
        expect(weekendDemand(state.units, w, plan[w.sessionId] ?? [])).toBeLessThanOrEqual(
          w.capacityGames
        )
      }
      // One weekend per grade per month, exactly as before.
      const all = win.weekends.flatMap((w) => plan[w.sessionId] ?? [])
      expect(all.sort()).toEqual(state.units.map((u) => u.key).sort())
    }
  })

  it("is deterministic across runs, alternating grades included", () => {
    expect(proposePlan(nphTwoGyms(), "balance")).toEqual(proposePlan(nphTwoGyms(), "balance"))
    expect(proposePlan(nphTwoGyms(), "compact")).toEqual(proposePlan(nphTwoGyms(), "compact"))
    const a = nphTwoGyms()
    const b = nphTwoGyms()
    expect(packPlanVenues(a, proposePlan(a, "balance"))).toEqual(
      packPlanVenues(b, proposePlan(b, "balance"))
    )
  })
})

describe("proposePlan lever: one-gym", () => {
  /**
   * One month, two weekends. The first is a single big building; the second
   * pairs two small gyms. Four grades of ten games each, so 20/20 is the
   * flattest split and 30/10 is the one that keeps both weekends inside a
   * single building.
   */
  function oneBigOnePair(bigCapacity = 30): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr7", 10), unit("Gr8", 10), unit("Gr9", 10), unit("Gr10", 10)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("big", "2026-10-24", [gym("north", "North Gym", bigCapacity, 0)]),
            weekend("pair", "2026-10-31", [
              gym("east", "Six Park East", 10, 0),
              gym("west", "Playground West", 10, 1),
            ]),
          ],
        },
      ],
    }
  }

  /** Weekends the plan really has to open a second building on. */
  const twoBuildingWeekends = (state: PlannerState, plan: Record<string, string[]>): number =>
    Object.values(packPlanVenues(state, plan)).filter(
      (byUnit) => new Set(Object.values(byUnit)).size > 1
    ).length

  const fitsEverywhere = (state: PlannerState, plan: Record<string, string[]>) => {
    for (const win of state.windows) {
      for (const w of win.weekends) {
        expect(weekendDemand(state.units, w, plan[w.sessionId] ?? [])).toBeLessThanOrEqual(
          w.capacityGames
        )
      }
      // One weekend per grade per month, exactly as the other levers.
      const all = win.weekends.flatMap((w) => plan[w.sessionId] ?? [])
      expect(all.sort()).toEqual(state.units.map((u) => u.key).sort())
    }
  }

  it("keeps every weekend in one building where balance opens a second", () => {
    // Balance buys the flat 20/20 peak and pays for a second gym to get it.
    const balanced = oneBigOnePair()
    expect(twoBuildingWeekends(balanced, proposePlan(balanced, "balance"))).toBe(1)

    // One-gym takes the heavier 30/10 weekend instead, and every family
    // still drives to one address.
    const packed = oneBigOnePair()
    const plan = proposePlan(packed, "one-gym")
    expect(twoBuildingWeekends(packed, plan)).toBe(0)
    fitsEverywhere(packed, plan)
  })

  it("still refuses overflow: it opens the second gym rather than strand a game", () => {
    // The big weekend now holds 25, so the one-building answer would leave 5
    // games nowhere. Overflow is a million a game and nothing outranks it.
    const state = oneBigOnePair(25)
    const plan = proposePlan(state, "one-gym")
    fitsEverywhere(state, plan)
    expect(twoBuildingWeekends(state, plan)).toBe(1)
  })

  it("is deterministic, and holds the NPH shape without stranding a game", () => {
    expect(proposePlan(nphTwoGyms(), "one-gym")).toEqual(proposePlan(nphTwoGyms(), "one-gym"))
    const state = nphTwoGyms()
    fitsEverywhere(state, proposePlan(state, "one-gym"))
  })
})

/** The NPH shape with two real buildings behind every weekend, and one grade
 *  the league promised would not sit in the same gym every month. */
function nphTwoGyms(): PlannerState {
  // A gym with no slots that weekend is simply not on it, the way
  // buildPlannerState only ever lists buildings that produced slots.
  const pair = (big: number, small: number) =>
    [gym("burlington", "Burlington", big, 0), gym("hamilton", "Hamilton", small, 1)].filter(
      (v) => v.capacityGames > 0
    )
  const w = (id: string, dateISO: string, big: number, small: number) =>
    weekend(id, dateISO, pair(big, small))
  return {
    seasonId: "season",
    units: [
      unit("Gr7", 12),
      unit("Gr8", 9),
      unit("Gr9", 25),
      unit("Gr10", 42),
      unit("Gr11", 24, true),
      unit("Gr12", 26),
      unit("JrGirls", 8),
    ],
    errors: [],
    windows: [
      {
        label: "Oct 2026",
        weekends: [w("oct24", "2026-10-24", 96, 80), w("oct31", "2026-10-31", 96, 80)],
      },
      {
        label: "Nov 2026",
        weekends: [
          w("nov14", "2026-11-14", 80, 0),
          w("nov21", "2026-11-21", 96, 80),
          w("nov28", "2026-11-28", 96, 80),
        ],
      },
      {
        label: "Dec 2026",
        weekends: [w("dec12", "2026-12-12", 80, 0), w("dec19", "2026-12-19", 96, 80)],
      },
    ],
  }
}
