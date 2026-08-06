import { describe, expect, it } from "vitest"
import {
  applyCourtCaps,
  courtCapKey,
  courtsWiredAt,
  lightestWeekendIn,
  planCost,
  planPrice,
  planPriceSentence,
  planRentalBlocks,
  splitAcrossGyms,
  splitPriceSentence,
  splitAcrossWeekends,
  withRentedCourts,
  type PlannerState,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
  type RentalBlock,
} from "./planner"

/**
 * THE FOUR VERBS (owner ruling 2026-08-04). Placing already had its tests;
 * these pin the three that were added with it — correcting a gym's courts,
 * pricing an edit, and breaking a run of games up on either axis.
 *
 * The shape is deliberately small and hand-built rather than the NPH fixture:
 * every number here should be arithmetic a reader can do in their head, so a
 * failure says which rule broke rather than which season changed.
 */

function unit(label: string, teams: number): PlannerUnit {
  return {
    key: `age:${label}`,
    label,
    divisionIds: [`d${label}`],
    teams,
    approved: teams,
    expected: teams,
    source: "expected",
  }
}

/** A building: 4 courts over 2 days, 12 games a court, 6 hours a court-day. */
function venue(
  venueId: string,
  name: string,
  role: "home" | "pool",
  courts: number
): PlannerVenue {
  return {
    venueId,
    name,
    capacityGames: courts * 12,
    role,
    fillOrder: role === "home" ? 0 : 1,
    courts,
    courtDays: courts * 2,
    days: 2,
    hoursPerCourtDay: 6,
  }
}

function weekend(sessionId: string, label: string, dateISO: string, venues: PlannerVenue[]): PlannerWeekend {
  return {
    sessionId,
    label,
    dateISO,
    capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
    largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
    venues,
    targetGamesPerTeam: 2,
    assigned: [],
    assignedVenues: {},
  }
}

/** One month, two weekends, a home gym of 4 courts and a pool gym of 4.
 *  Two grades of 12 teams: 12 games each at 2 games a team. */
function world(): PlannerState {
  return {
    seasonId: "season",
    units: [unit("Gr9", 12), unit("Gr10", 12)],
    errors: [],
    windows: [
      {
        label: "Nov 2026",
        weekends: [
          weekend("w1", "Nov 7–8", "2026-11-07", [
            venue("home", "The Playground", "home", 4),
            venue("pool", "Six Park East", "pool", 4),
          ]),
          weekend("w2", "Nov 14–15", "2026-11-14", [
            venue("home", "The Playground", "home", 4),
            venue("pool", "Six Park East", "pool", 4),
          ]),
        ],
      },
    ],
  }
}

/** Both grades on the first weekend, nothing decided. */
const BOTH_ON_W1 = { w1: ["age:Gr9", "age:Gr10"], w2: [] }

describe("applyCourtCaps", () => {
  it("hands back the very same state when nobody has corrected anything", () => {
    const state = world()
    expect(applyCourtCaps(state, {})).toBe(state)
  })

  it("cuts a gym's courts and its capacity at the rate that gym runs at", () => {
    const capped = applyCourtCaps(world(), { [courtCapKey("w1", "pool")]: 2 })
    const w1 = capped.windows[0].weekends[0]
    const pool = w1.venues.find((v) => v.venueId === "pool") as PlannerVenue
    expect(pool.courts).toBe(2)
    // 12 games a court, so half the courts is half the games.
    expect(pool.capacityGames).toBe(24)
    expect(pool.courtDays).toBe(4)
    // The weekend's own total follows: 48 at home, 24 rented.
    expect(w1.capacityGames).toBe(72)
    expect(w1.largestVenueCapacity).toBe(48)
  })

  it("leaves every other weekend alone", () => {
    const capped = applyCourtCaps(world(), { [courtCapKey("w1", "pool")]: 2 })
    expect(capped.windows[0].weekends[1].capacityGames).toBe(96)
  })

  it("takes zero for an answer: a gym can say no", () => {
    const capped = applyCourtCaps(world(), { [courtCapKey("w1", "pool")]: 0 })
    const pool = capped.windows[0].weekends[0].venues.find(
      (v) => v.venueId === "pool"
    ) as PlannerVenue
    expect(pool.courts).toBe(0)
    expect(pool.capacityGames).toBe(0)
    expect(capped.windows[0].weekends[0].capacityGames).toBe(48)
  })

  it("never invents courts: a cap at or above the wiring is not a correction", () => {
    const state = world()
    expect(applyCourtCaps(state, { [courtCapKey("w1", "pool")]: 4 })).toBe(state)
    const over = applyCourtCaps(state, { [courtCapKey("w1", "pool")]: 9 })
    const pool = over.windows[0].weekends[0].venues.find(
      (v) => v.venueId === "pool"
    ) as PlannerVenue
    expect(pool.courts).toBe(4)
  })

  it("courtsWiredAt reads the ceiling a correction is capped at", () => {
    expect(courtsWiredAt(venue("pool", "Six Park East", "pool", 6))).toBe(6)
  })
})

/**
 * THE OTHER WAY UP (owner ruling 2026-08-06, #5). The same per-date number, read
 * as "the courts we hold there": below the demand-sized rental it is the
 * correction above, above it the operator rented more of the building than the
 * games needed and the ask has to say so.
 */
describe("withRentedCourts", () => {
  /** The rental a weekend of 24 games at a 4-court gym is sized at. */
  const blocks = (): RentalBlock[] =>
    planRentalBlocks(world(), BOTH_ON_W1, { w1: { "age:Gr9": "pool", "age:Gr10": "pool" } })

  it("hands back the very same blocks when nobody has rented more", () => {
    const base = blocks()
    expect(withRentedCourts(base, {})).toBe(base)
    // A number at or under the demand-sized rental changes nothing: that is the
    // correction's job, and the correction has already made the block smaller.
    const rented = base.find((b) => b.venueId === "pool") as RentalBlock
    expect(withRentedCourts(base, { [courtCapKey("w1", "pool")]: rented.courts })).toBe(base)
  })

  it("bills the courts the operator says they rented, hours and all", () => {
    const base = blocks()
    const before = base.find((b) => b.venueId === "pool") as RentalBlock
    expect(before.courts).toBe(2)
    const after = withRentedCourts(base, { [courtCapKey("w1", "pool")]: 4 }).find(
      (b) => b.venueId === "pool"
    ) as RentalBlock
    expect(after.courts).toBe(4)
    expect(after.courtDays).toBe(8)
    // 6 court-hours a court-day at this gym, so the ask doubles with the courts.
    expect(after.hoursNeeded).toBe(48)
    // The games are what they always were: renting more does not play more.
    expect(after.games).toBe(before.games)
  })

  it("leaves the block with no building alone: there is nothing rented to bill", () => {
    const homeless: RentalBlock[] = [
      {
        sessionId: "w1",
        venueId: null,
        courts: 1,
        days: 2,
        courtDays: 2,
        hoursNeeded: 12,
        games: 6,
        unitKeys: ["age:Gr9"],
      },
    ]
    expect(withRentedCourts(homeless, { [courtCapKey("w1", "pool")]: 4 })).toBe(homeless)
  })
})

describe("planCost and the price of an edit", () => {
  it("counts the buildings opened, the court-days rented and the weekends used", () => {
    // Both grades on one weekend: 24 games, and the home gym holds 48, so
    // nothing is rented at all.
    const cheap = planCost(world(), BOTH_ON_W1, {})
    expect(cheap.buildingsOpened).toBe(0)
    expect(cheap.courtDaysRented).toBe(0)
    expect(cheap.weekendsUsed).toBe(1)
    expect(cheap.gamesUnhoused).toBe(0)
  })

  it("charges a second weekend when the month spreads out", () => {
    const spread = planCost(world(), { w1: ["age:Gr9"], w2: ["age:Gr10"] }, {})
    expect(spread.weekendsUsed).toBe(2)
  })

  it("charges the rented building when somebody puts a grade in the pool gym", () => {
    const rented = planCost(world(), BOTH_ON_W1, { w1: { "age:Gr10": "pool" } })
    expect(rented.buildingsOpened).toBe(1)
    // 12 games, 12 games a court, 2 days: one court-day each way.
    expect(rented.courtDaysRented).toBe(2)
  })

  it("says the price in the three units an operator pays in", () => {
    const before = planCost(world(), BOTH_ON_W1, {})
    const after = planCost(world(), BOTH_ON_W1, { w1: { "age:Gr10": "pool" } })
    const price = planPrice(before, after)
    expect(price.buildingsOpened).toBe(1)
    expect(price.courtDaysRented).toBe(2)
    expect(price.weekendsAdded).toBe(0)
    expect(planPriceSentence(price)).toBe(
      "1 more building to open and 2 more court-days to rent."
    )
  })

  it("leaves the zero terms out, and says so when an edit is free", () => {
    const same = planCost(world(), BOTH_ON_W1, {})
    expect(planPriceSentence(planPrice(same, same))).toBe(
      "Costs nothing: same buildings, same court-days."
    )
  })
})

describe("splitPriceSentence", () => {
  const nothing = { buildingsOpened: 0, courtDaysRented: 0, weekendsAdded: 0, gamesUnhoused: 0 }

  it("leads with the season when the season has something to say", () => {
    expect(
      splitPriceSentence({ ...nothing, courtDaysRented: 4 }, { ...nothing, courtDaysRented: 4 })
    ).toBe("4 more court-days to rent across the season.")
  })

  it("lets the weekend speak when the season comes out even", () => {
    // Two courts in October paid back in January is a real answer, but a bare
    // "costs nothing" under "Grade 9 moves to Six Park" reads like a bug.
    expect(splitPriceSentence(nothing, { ...nothing, courtDaysRented: 4 })).toBe(
      "4 more court-days to rent that weekend, and the season comes out even."
    )
  })

  it("says so plainly when nothing moves at either scope", () => {
    expect(splitPriceSentence(nothing, nothing)).toBe(
      "Costs nothing: same buildings, same court-days."
    )
  })
})

describe("planCost, scoped to one weekend", () => {
  it("counts only the weekends it is asked about", () => {
    const spread = { w1: ["age:Gr9"], w2: ["age:Gr10"] }
    expect(planCost(world(), spread, {}).weekendsUsed).toBe(2)
    expect(planCost(world(), spread, {}, new Set(["w1"])).weekendsUsed).toBe(1)
  })
})

describe("splitAcrossGyms", () => {
  it("refuses to break one grade up: a family drives to one address", () => {
    expect(splitAcrossGyms(world(), BOTH_ON_W1, {}, "w1", ["age:Gr10"])).toBeNull()
  })

  it("deals whole cohorts into the second building", () => {
    const out = splitAcrossGyms(world(), BOTH_ON_W1, {}, "w1", ["age:Gr9", "age:Gr10"])
    expect(out).not.toBeNull()
    expect(out?.toVenueId).toBe("pool")
    expect(out?.moved).toHaveLength(1)
    // The side that stays is pinned too, or the packer would simply undo it.
    expect(out?.venues.w1["age:Gr9"]).toBeDefined()
    expect(out?.venues.w1["age:Gr10"]).toBeDefined()
    const moved = out?.moved[0] as string
    expect(out?.venues.w1[moved]).toBe("pool")
  })

  it("costs a building and its court-days, and says so", () => {
    const state = world()
    const before = planCost(state, BOTH_ON_W1, {})
    const out = splitAcrossGyms(state, BOTH_ON_W1, {}, "w1", ["age:Gr9", "age:Gr10"])
    const price = planPrice(before, planCost(state, out!.assignment, out!.venues))
    expect(price.buildingsOpened).toBe(1)
    expect(price.courtDaysRented).toBeGreaterThan(0)
  })

  it("is null when the weekend has no second building with room", () => {
    const state = world()
    state.windows[0].weekends[0].venues = [venue("home", "The Playground", "home", 4)]
    state.windows[0].weekends[0].capacityGames = 48
    expect(splitAcrossGyms(state, BOTH_ON_W1, {}, "w1", ["age:Gr9", "age:Gr10"])).toBeNull()
  })

  it("is null when the cohorts do not all start in one building", () => {
    const apart = { w1: { "age:Gr10": "pool" } }
    expect(splitAcrossGyms(world(), BOTH_ON_W1, apart, "w1", ["age:Gr9", "age:Gr10"])).toBeNull()
  })
})

describe("splitAcrossWeekends", () => {
  it("refuses to break one grade up", () => {
    expect(splitAcrossWeekends(world(), BOTH_ON_W1, {}, "w1", ["age:Gr10"])).toBeNull()
  })

  it("sends part of the load to the emptiest weekend of the same month", () => {
    const out = splitAcrossWeekends(world(), BOTH_ON_W1, {}, "w1", ["age:Gr9", "age:Gr10"])
    expect(out?.toSessionId).toBe("w2")
    expect(out?.moved).toHaveLength(1)
    const moved = out?.moved[0] as string
    expect(out?.assignment.w2).toContain(moved)
    expect(out?.assignment.w1).not.toContain(moved)
  })

  it("prices as a weekend added, not a building opened", () => {
    const state = world()
    const before = planCost(state, BOTH_ON_W1, {})
    const out = splitAcrossWeekends(state, BOTH_ON_W1, {}, "w1", ["age:Gr9", "age:Gr10"])
    const price = planPrice(before, planCost(state, out!.assignment, out!.venues))
    expect(price.weekendsAdded).toBe(1)
    expect(price.buildingsOpened).toBe(0)
    expect(planPriceSentence(price)).toBe("1 more weekend in use.")
  })

  it("is null when the month has nowhere else to go", () => {
    const state = world()
    state.windows[0].weekends = [state.windows[0].weekends[0]]
    expect(splitAcrossWeekends(state, BOTH_ON_W1, {}, "w1", ["age:Gr9", "age:Gr10"])).toBeNull()
  })
})

describe("lightestWeekendIn", () => {
  it("picks the emptiest weekend that is not the one we are standing on", () => {
    const state = world()
    const win = state.windows[0]
    expect(lightestWeekendIn(state, win, BOTH_ON_W1, "w1")?.sessionId).toBe("w2")
    expect(lightestWeekendIn(state, win, BOTH_ON_W1, "w2")?.sessionId).toBe("w1")
  })

  it("skips a weekend the season has no gym on", () => {
    const state = world()
    state.windows[0].weekends[1].venues = []
    state.windows[0].weekends[1].capacityGames = 0
    expect(lightestWeekendIn(state, state.windows[0], BOTH_ON_W1, "w1")).toBeNull()
  })
})
