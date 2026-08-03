import { describe, expect, it } from "vitest"
import {
  assignBlocksFromPool,
  courtDaysNeeded,
  courtsNeeded,
  packPlanVenues,
  packShownPlacements,
  packShownVenues,
  packWeekendVenues,
  planningSource,
  planRentalBlocks,
  proposePlan,
  reasonPhrase,
  rentalAsk,
  resolveWeekendGyms,
  weekendDemand,
  weekendStory,
  type PlannerState,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
} from "./planner-core"

/**
 * WHICH BUILDING A GRADE PLAYS IN — venue model v2 (owner ruling 2026-08-03,
 * evidence in docs/research/nph-operations-intel-2026-08.md §waste analysis).
 *
 * The rules these tests hold the packer to:
 *  1. ONE home gym, always fills first, costs nothing.
 *  2. The rest is an unordered POOL, rented by the court-day, and what spills
 *     out of the home gym becomes cohort-atomic, demand-sized rental blocks.
 *  3. CONSOLIDATION OUTRANKS RESIDENCY. A grade keeping the building it has
 *     been playing is a tiebreak, never worth another rented court-day. The
 *     old GYM_VIOLATION_COST 25,000 dominance is gone, and one test below
 *     exists purely to prove it.
 *
 * Every weekend here runs 2 games per team, so a grade's games equal its team
 * count and the numbers read straight off the page. Every gym runs 2 days of
 * 6 games a court unless a test says otherwise, so "1 court" is 12 games and
 * a court-day is 6.
 */

const GAMES_PER_COURT_DAY = 6
const DAYS = 2

/** A gym as buildPlannerState hands one over: capacity, and the courts and
 *  days behind it, which is what a rental is actually quoted in. */
function gymOf(
  venueId: string,
  name: string,
  courts: number,
  role: "home" | "pool"
): PlannerVenue {
  return {
    venueId,
    name,
    capacityGames: courts * DAYS * GAMES_PER_COURT_DAY,
    role,
    fillOrder: 0,
    courts,
    days: DAYS,
    courtDays: courts * DAYS,
    hoursPerCourtDay: 9,
  }
}

/** A gym stated in GAMES, for the tests that care about capacity and not
 *  about courts. Its courts are whatever that capacity is worth. */
function gym(
  venueId: string,
  name: string,
  capacityGames: number,
  role: "home" | "pool" = "pool"
): PlannerVenue {
  const courts = Math.max(1, Math.round(capacityGames / (DAYS * GAMES_PER_COURT_DAY)))
  return {
    venueId,
    name,
    capacityGames,
    role,
    fillOrder: 0,
    courts,
    days: DAYS,
    courtDays: courts * DAYS,
    hoursPerCourtDay: 9,
  }
}

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

/** Venues arrive the way buildPlannerState hands them over: home first. */
function weekend(
  sessionId: string,
  dateISO: string,
  venues: PlannerVenue[],
  targetGamesPerTeam = 2
): PlannerWeekend {
  const ordered = [...venues].sort(
    (a, b) =>
      (a.role === "home" ? 0 : 1) - (b.role === "home" ? 0 : 1) ||
      b.capacityGames - a.capacityGames ||
      a.name.localeCompare(b.name, "en")
  )
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

/** The NPH shape: the building they own is the SMALL one, the rented hub is
 *  the big one. Two courts of home, six courts of rental. */
const HOME = gymOf("playground", "The Playground", 2, "home") // 24 games
const RENTAL = gymOf("sixpark", "Six Park East", 6, "pool") // 72 games

describe("courts a rental needs", () => {
  it("is the demand rounded up to whole courts, and priced in court-days", () => {
    // One court of Six Park holds 12 games across the weekend.
    expect(courtsNeeded(RENTAL, 1)).toBe(1)
    expect(courtsNeeded(RENTAL, 12)).toBe(1)
    expect(courtsNeeded(RENTAL, 13)).toBe(2)
    expect(courtsNeeded(RENTAL, 0)).toBe(0)
    // Court-days are courts × the days of the weekend.
    expect(courtDaysNeeded(RENTAL, 13)).toBe(4)
  })

  it("asks for more courts than are wired rather than hide the shortfall", () => {
    // Six courts hold 72 games. 84 games is an eight-court ask, and saying
    // "six" would be how a season ends up short of courts in February.
    expect(courtsNeeded(RENTAL, 84)).toBe(7)
  })
})

describe("packWeekendVenues: the home gym fills first", () => {
  it("keeps everything in the building the league owns while it holds", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 8), unit("Gr8", 9)],
      weekend("s1", "2026-10-24", [gymOf("playground", "The Playground", 3, "home"), RENTAL]),
      {}
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "playground", "age:Gr8": "playground" })
    expect(packed.opened).toEqual(["playground"])
    expect(packed.rentedCourtDays).toBe(0)
    expect(packed.blocks).toEqual([])
    expect(packed.overflow).toBe(0)
  })

  it("rents for the whole cohorts the home gym cannot hold, and nothing more", () => {
    // Home holds 24. Gr10 (30 games) cannot fit, Gr7 (12) and Gr8 (12) can.
    const packed = packWeekendVenues(
      [unit("Gr7", 12), unit("Gr8", 12), unit("Gr10", 30)],
      weekend("s1", "2026-10-24", [HOME, RENTAL]),
      {}
    )
    expect(packed.byUnit).toEqual({
      "age:Gr7": "playground",
      "age:Gr8": "playground",
      "age:Gr10": "sixpark",
    })
    // 30 games at 12 a court = 3 courts, over 2 days = 6 court-days.
    expect(packed.blocks).toHaveLength(1)
    expect(packed.blocks[0]).toMatchObject({
      venueId: "sixpark",
      courts: 3,
      days: 2,
      courtDays: 6,
      games: 30,
      unitKeys: ["age:Gr10"],
    })
    expect(packed.rentedCourtDays).toBe(6)
    expect(packed.reasonByUnit).toEqual({
      "age:Gr7": "home",
      "age:Gr8": "home",
      "age:Gr10": "rented",
    })
  })

  it("puts the biggest cohort in the home gym first, so the rental is small", () => {
    // Home holds 24. Placed smallest-first, Gr7 (8) would take the room and
    // the 22-game cohort would rent two courts; biggest-first rents one.
    const packed = packWeekendVenues(
      [unit("Small", 8), unit("Big", 22)],
      weekend("s1", "2026-10-24", [HOME, RENTAL]),
      {}
    )
    expect(packed.byUnit).toEqual({ "age:Big": "playground", "age:Small": "sixpark" })
    expect(packed.blocks[0]).toMatchObject({ venueId: "sixpark", courts: 1, courtDays: 2 })
    expect(packed.rentedCourtDays).toBe(2)
  })

  it("adds a second cohort to a building it is already renting for nothing", () => {
    // Two cohorts of 30 and 12 both spill. Three courts hold 36 games, so the
    // 12-game cohort rides along on courts we are already paying for; a
    // fourth court appears only when the two together pass 36.
    const cheap = packWeekendVenues(
      [unit("Gr10", 30), unit("Gr9", 6)],
      weekend("s1", "2026-10-24", [gymOf("playground", "The Playground", 0, "home"), RENTAL]),
      {}
    )
    expect(cheap.blocks).toHaveLength(1)
    expect(cheap.blocks[0]).toMatchObject({ courts: 3, courtDays: 6, games: 36 })

    const dearer = packWeekendVenues(
      [unit("Gr10", 30), unit("Gr9", 12)],
      weekend("s1", "2026-10-24", [gymOf("playground", "The Playground", 0, "home"), RENTAL]),
      {}
    )
    expect(dearer.blocks[0]).toMatchObject({ courts: 4, courtDays: 8, games: 42 })
  })

  it("rents the cheaper building when two are in the pool, then keeps to it", () => {
    // A 12-game cohort is one court either way, but the small hall's day is
    // one day, so its court-day bill is half. Nothing about the order of the
    // array decides this: it is the money.
    const small = {
      ...gymOf("hall", "Village Hall", 2, "pool"),
      days: 1,
      courtDays: 2,
      capacityGames: 24,
    }
    const packed = packWeekendVenues(
      [unit("Gr7", 12)],
      weekend("s1", "2026-10-24", [gymOf("playground", "The Playground", 0, "home"), RENTAL, small]),
      {}
    )
    expect(packed.byUnit["age:Gr7"]).toBe("hall")
    expect(packed.rentedCourtDays).toBe(1)
  })

  it("a grade with no teams claims no gym at all", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 0), unit("Gr8", 5)],
      weekend("s1", "2026-10-24", [HOME, RENTAL]),
      {}
    )
    expect(packed.byUnit).toEqual({ "age:Gr8": "playground" })
    expect(packed.opened).toEqual(["playground"])
  })

  it("a weekend with no gym asks for the courts it would take", () => {
    const packed = packWeekendVenues([unit("Gr7", 12)], weekend("s1", "2026-10-24", []), {}, undefined, {
      gamesPerCourt: 12,
      days: 2,
      hoursPerCourtDay: 9,
    })
    expect(packed.byUnit).toEqual({})
    expect(packed.opened).toEqual([])
    expect(packed.overflow).toBe(12)
    expect(packed.blocks).toEqual([
      {
        sessionId: "s1",
        venueId: null,
        courts: 1,
        days: 2,
        courtDays: 2,
        hoursNeeded: 18,
        games: 12,
        unitKeys: ["age:Gr7"],
      },
    ])
    // An empty slot is a hole in the season, not a rental we are paying for.
    expect(packed.rentedCourtDays).toBe(0)
  })

  it("keeps a cohort whole: what fits nowhere becomes an empty slot", () => {
    // 40 games, home holds 24 and the only pool gym holds 24. Half a grade
    // cannot play, so the WHOLE cohort is demand with nowhere to go — and the
    // rooms it could not use stay free for the small cohort behind it.
    const packed = packWeekendVenues(
      [unit("Gr10", 40), unit("Gr7", 10)],
      weekend("s1", "2026-10-24", [HOME, gymOf("hall", "Village Hall", 2, "pool")]),
      {}
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "playground" })
    expect(packed.reasonByUnit["age:Gr10"]).toBe("overflow")
    expect(packed.overflow).toBe(40)
    const empty = packed.blocks.find((b) => b.venueId === null)
    expect(empty).toMatchObject({ games: 40, unitKeys: ["age:Gr10"] })
  })
})

describe("packWeekendVenues: consolidation outranks residency", () => {
  it("brings a grade home off a rented court, and calls the switch cheap", () => {
    // Gr7 has been playing the rented hub. The home gym has room. Under the
    // OLD rule (GYM_VIOLATION_COST 25,000) residency won and we kept renting.
    const packed = packWeekendVenues(
      [unit("Gr7", 10)],
      weekend("s1", "2026-11-14", [HOME, RENTAL]),
      { "age:Gr7": "sixpark" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "playground" })
    expect(packed.reasonByUnit["age:Gr7"]).toBe("home")
    expect(packed.rentedCourtDays).toBe(0)
    // The switch is counted, because the sentences read it — it is just no
    // longer worth anything next to a court-day.
    expect(packed.violations).toBe(1)
  })

  it("uses residency only to break a tie between equal rentals", () => {
    // Two pool gyms, identical courts and days, so the money is the same
    // either way. THEN the building the grade has been playing wins.
    const west = gymOf("west", "West Arena", 6, "pool")
    const east = gymOf("east", "East Arena", 6, "pool")
    const home = gymOf("playground", "The Playground", 0, "home")
    const stays = packWeekendVenues(
      [unit("Gr7", 12)],
      weekend("s1", "2026-11-14", [home, west, east]),
      { "age:Gr7": "west" }
    )
    expect(stays.byUnit["age:Gr7"]).toBe("west")
    expect(stays.reasonByUnit["age:Gr7"]).toBe("resident")
    expect(stays.violations).toBe(0)

    // With no history, the same weekend is decided by name, so the answer
    // never wobbles between two runs.
    const fresh = packWeekendVenues([unit("Gr7", 12)], weekend("s1", "2026-11-14", [home, west, east]), {})
    expect(fresh.byUnit["age:Gr7"]).toBe("east")
  })

  it("a home gym that is not open this weekend is nobody's promise", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10)],
      weekend("s1", "2026-11-14", [RENTAL]),
      { "age:Gr7": "north" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "sixpark" })
    expect(packed.violations).toBe(0)
  })
})

describe("packWeekendVenues: grades that alternate buildings", () => {
  it("sends an alternating grade to the gym it did not just play", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10, true)],
      weekend("s1", "2026-11-14", [HOME, RENTAL]),
      { "age:Gr7": "playground" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "sixpark" })
    expect(packed.reasonByUnit["age:Gr7"]).toBe("avoided")
    expect(packed.violations).toBe(0)
  })

  it("repeats a building rather than split the grade, and says it cost something", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 10, true)],
      weekend("s1", "2026-11-14", [gym("home", "The Playground", 24, "home")]),
      { "age:Gr7": "home" }
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "home" })
    expect(packed.reasonByUnit["age:Gr7"]).toBe("bumped")
    expect(packed.violations).toBe(1)
    expect(packed.overflow).toBe(0)
  })
})

describe("packWeekendVenues: a hand-picked gym", () => {
  it("wins outright, and the rental follows it", () => {
    const w = weekend("s1", "2026-10-24", [HOME, RENTAL])
    const packed = packWeekendVenues([unit("Gr7", 10)], w, { "age:Gr7": "sixpark" }, new Set(["age:Gr7"]))
    expect(packed.byUnit).toEqual({ "age:Gr7": "sixpark" })
    expect(packed.reasonByUnit["age:Gr7"]).toBe("decided")
    expect(packed.blocks[0]).toMatchObject({ venueId: "sixpark", courts: 1 })
  })

  it("wins even where it puts a building over its courts, and says what has no room", () => {
    const w = weekend("s1", "2026-10-24", [HOME, RENTAL])
    const packed = packWeekendVenues(
      [unit("Gr7", 30)],
      w,
      { "age:Gr7": "playground" },
      new Set(["age:Gr7"])
    )
    expect(packed.byUnit).toEqual({ "age:Gr7": "playground" })
    // Home holds 24 of the 30, and the 6 that have nowhere to go are an ask.
    expect(packed.overflow).toBe(6)
    expect(packed.blocks.find((b) => b.venueId === null)).toMatchObject({ games: 6, courts: 1 })
  })
})

describe("resolveWeekendGyms", () => {
  const UNITS = [unit("Gr7", 12), unit("Gr8", 12), unit("Gr9", 0)]
  /** One court of home: it holds one of the two cohorts, so the weekend has a
   *  home section AND a rented one. */
  const SMALL_HOME = gymOf("playground", "The Playground", 1, "home")

  it("groups the weekend's grades under their buildings, home first", () => {
    const gyms = resolveWeekendGyms(UNITS, weekend("s1", "2026-10-24", [SMALL_HOME, RENTAL]), [
      "age:Gr7",
      "age:Gr8",
    ])
    expect(gyms.sections.map((s) => s.venueId)).toEqual(["playground", "sixpark"])
    expect(gyms.sections[0]).toMatchObject({
      role: "home",
      games: 12,
      capacityGames: 12,
      rentedCourts: 0,
      rentedCourtDays: 0,
    })
    expect(gyms.sections[1]).toMatchObject({ role: "pool", games: 12, rentedCourts: 1, rentedCourtDays: 2 })
    expect(gyms.rentedCourtDays).toBe(2)
    expect(gyms.overflow).toBe(0)
    expect(gyms.unplaced).toEqual([])
  })

  it("a hand-picked gym wins, even when it puts that gym over its courts", () => {
    const gyms = resolveWeekendGyms(
      UNITS,
      weekend("s1", "2026-10-24", [HOME, RENTAL]),
      ["age:Gr7", "age:Gr8"],
      { "age:Gr7": "playground", "age:Gr8": "playground" }
    )
    expect(gyms.byUnit).toEqual({ "age:Gr7": "playground", "age:Gr8": "playground" })
    expect(gyms.sections).toHaveLength(1)
    expect(gyms.sections[0].games).toBe(24)
    expect(gyms.sections[0].over).toBe(0)
    expect(gyms.overflow).toBe(0)
  })

  it("ignores a gym that is not on this weekend, and never loses a grade", () => {
    const gyms = resolveWeekendGyms(UNITS, weekend("s1", "2026-10-24", [HOME]), ["age:Gr7"], {
      "age:Gr7": "sixpark",
    })
    expect(gyms.byUnit).toEqual({ "age:Gr7": "playground" })

    // A grade with no teams yet still has to be somewhere the board can draw,
    // and the home gym is where a grade with nothing to place belongs.
    const quiet = resolveWeekendGyms(UNITS, weekend("s1", "2026-10-24", [HOME, RENTAL]), ["age:Gr9"])
    expect(quiet.byUnit).toEqual({ "age:Gr9": "playground" })
    expect(quiet.sections[0].games).toBe(0)
  })

  it("a weekend with no gym leaves its grades unplaced, and counts every game", () => {
    const gyms = resolveWeekendGyms(UNITS, weekend("s1", "2026-10-24", []), ["age:Gr7"])
    expect(gyms.sections).toEqual([])
    expect(gyms.unplaced).toEqual(["age:Gr7"])
    expect(gyms.overflow).toBe(12)
  })
})

describe("why a grade is in the building it is in", () => {
  it("names the home gym, and the rental", () => {
    const packed = packWeekendVenues(
      [unit("Gr7", 12), unit("Gr8", 24)],
      weekend("s1", "2026-10-24", [HOME, RENTAL]),
      {}
    )
    expect(packed.reasonByUnit).toEqual({ "age:Gr8": "home", "age:Gr7": "rented" })
  })

  it("names residency when a grade keeps a rented building", () => {
    const west = gymOf("west", "West Arena", 6, "pool")
    const east = gymOf("east", "East Arena", 6, "pool")
    const packed = packWeekendVenues(
      [unit("Gr7", 12)],
      weekend("s1", "2026-11-14", [gymOf("playground", "The Playground", 0, "home"), west, east]),
      { "age:Gr7": "west" }
    )
    expect(packed.reasonByUnit["age:Gr7"]).toBe("resident")
  })

  it("names the bump when the gym it was in could not hold it", () => {
    // Only one building, the home gym, and an alternating grade forced back
    // into the one it just played.
    const packed = packWeekendVenues(
      [unit("Gr7", 10, true)],
      weekend("s1", "2026-11-14", [gym("home", "The Playground", 24, "home")]),
      { "age:Gr7": "home" }
    )
    expect(packed.reasonByUnit["age:Gr7"]).toBe("bumped")
  })

  it("names the overflow, gym or no gym", () => {
    const oversize = packWeekendVenues(
      [unit("Gr10", 40)],
      weekend("s1", "2026-10-24", [gymOf("playground", "The Playground", 1, "home")]),
      {}
    )
    expect(oversize.reasonByUnit["age:Gr10"]).toBe("overflow")

    const nowhere = packWeekendVenues([unit("Gr7", 12)], weekend("s1", "2026-10-24", []), {})
    expect(nowhere.reasonByUnit["age:Gr7"]).toBe("overflow")
  })

  it("a picked gym is the reason, whatever the packing had to do to honour it", () => {
    const gyms = resolveWeekendGyms(
      [unit("Gr7", 12), unit("Gr8", 12)],
      weekend("s1", "2026-10-24", [HOME, RENTAL]),
      ["age:Gr7", "age:Gr8"],
      { "age:Gr7": "playground", "age:Gr8": "playground" }
    )
    expect(gyms.reasonByUnit).toEqual({ "age:Gr7": "decided", "age:Gr8": "decided" })
  })

  it("lets the caller's own reasons win, because the board already knows them", () => {
    const gyms = resolveWeekendGyms(
      [unit("Gr7", 10)],
      weekend("s1", "2026-11-14", [HOME, RENTAL]),
      ["age:Gr7"],
      { "age:Gr7": "sixpark" },
      { "age:Gr7": "resident" }
    )
    expect(gyms.reasonByUnit["age:Gr7"]).toBe("resident")
    expect(gyms.byUnit["age:Gr7"]).toBe("sixpark")
  })

  it("says it in a few words for the strip, and says nothing for the legacy case", () => {
    expect(reasonPhrase("home")).toBe("home gym")
    expect(reasonPhrase("rented")).toBe("rented, home gym full")
    expect(reasonPhrase("resident")).toBe("same gym as last time")
    expect(reasonPhrase("bumped")).toBe("moved, its gym was full")
    expect(reasonPhrase("decided")).toBe("your pick")
    expect(reasonPhrase("fill")).toBeNull()
  })
})

describe("packShownPlacements: reasons, homes and blocks across the season", () => {
  function season(): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr6", 6), unit("Gr8", 6), unit("Gr10", 30)],
      errors: [],
      windows: [
        { label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME, RENTAL])] },
        { label: "Dec 2026", weekends: [weekend("dec19", "2026-12-19", [HOME, RENTAL])] },
      ],
    }
  }

  const shown = {
    nov21: ["age:Gr6", "age:Gr8"],
    dec19: ["age:Gr6", "age:Gr8", "age:Gr10"],
  }

  it("carries where each grade WAS, so a sentence can name the gym it left", () => {
    const placed = packShownPlacements(season(), shown)
    expect(placed.homes.nov21).toEqual({})
    expect(placed.homes.dec19).toEqual({
      "age:Gr6": "playground",
      "age:Gr8": "playground",
    })
    expect(placed.reasons.nov21).toEqual({ "age:Gr6": "home", "age:Gr8": "home" })
    // December: the two small grades stay home and the giant is the rental.
    expect(placed.reasons.dec19).toEqual({
      "age:Gr6": "home",
      "age:Gr8": "home",
      "age:Gr10": "rented",
    })
    expect(placed.venues).toEqual(packShownVenues(season(), shown))
  })

  it("hands back the season's rentals, weekend by weekend", () => {
    const placed = packShownPlacements(season(), shown)
    expect(placed.blocks).toEqual([
      {
        sessionId: "dec19",
        venueId: "sixpark",
        courts: 3,
        days: 2,
        courtDays: 6,
        hoursNeeded: 54,
        games: 30,
        unitKeys: ["age:Gr10"],
      },
    ])
    // planRentalBlocks is the same walk, so it cannot say anything different.
    expect(planRentalBlocks(season(), shown)).toEqual(placed.blocks)
  })

  it("marks a hand pick as decided, and moves the rental with it", () => {
    const placed = packShownPlacements(season(), shown, { dec19: { "age:Gr8": "sixpark" } })
    expect(placed.reasons.dec19["age:Gr8"]).toBe("decided")
    expect(placed.venues.dec19["age:Gr8"]).toBe("sixpark")
    const block = placed.blocks.find((b) => b.sessionId === "dec19" && b.venueId === "sixpark")
    expect(block?.unitKeys.sort()).toEqual(["age:Gr10", "age:Gr8"])
    expect(block?.games).toBe(36)
  })
})

describe("planRentalBlocks: the empty slot", () => {
  /** A season whose December has the rented hub released: the demand is real
   *  and there is nothing to put it in. */
  function releasedDecember(): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr10", 30)],
      errors: [],
      windows: [
        { label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME, RENTAL])] },
        { label: "Dec 2026", weekends: [weekend("dec19", "2026-12-19", [HOME])] },
      ],
    }
  }

  it("computes the demand and leaves the venue null", () => {
    const state = releasedDecember()
    const blocks = planRentalBlocks(state, { nov21: ["age:Gr10"], dec19: ["age:Gr10"] })
    const nov = blocks.find((b) => b.sessionId === "nov21")
    expect(nov).toMatchObject({ venueId: "sixpark", courts: 3, courtDays: 6 })
    const dec = blocks.find((b) => b.sessionId === "dec19")
    // Home holds 24 of 30, so the cohort cannot go there whole: the whole 30
    // is an ask, sized at the league's own rate of 12 games a court.
    expect(dec).toMatchObject({ venueId: null, games: 30, courts: 3, days: 2 })
  })

  it("says nothing at all when the home gym holds the whole weekend", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr7", 10)],
      errors: [],
      windows: [{ label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME, RENTAL])] }],
    }
    expect(planRentalBlocks(state, { nov21: ["age:Gr7"] })).toEqual([])
  })
})

describe("assignBlocksFromPool", () => {
  /** Two pool gyms on the first weekend, none on the second. */
  function state(): PlannerState {
    const cheap = { ...gymOf("hall", "Village Hall", 3, "pool"), days: 1, courtDays: 3, capacityGames: 36 }
    return {
      seasonId: "season",
      units: [unit("Gr10", 30)],
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov21", "2026-11-21", [
              gymOf("playground", "The Playground", 0, "home"),
              RENTAL,
              cheap,
            ]),
            weekend("nov28", "2026-11-28", [gymOf("playground", "The Playground", 0, "home")]),
          ],
        },
      ],
    }
  }

  const emptyBlock = (sessionId: string, games: number) => ({
    sessionId,
    venueId: null,
    courts: 0,
    days: 1,
    courtDays: 0,
    hoursNeeded: 0,
    games,
    unitKeys: ["age:Gr10"],
  })

  it("takes the pool gym with the fewest court-days, and quotes the courts", () => {
    const chosen = assignBlocksFromPool(state(), [emptyBlock("nov21", 30)])
    // Six Park: 3 courts × 2 days = 6 court-days. The hall: 3 courts × 1 day.
    expect(chosen.nov21).toEqual({
      venueId: "hall",
      courts: 3,
      days: 1,
      courtDays: 3,
      hoursNeeded: 27,
    })
  })

  it("honours availability: a weekend with no pool gym gets no answer", () => {
    const chosen = assignBlocksFromPool(state(), [emptyBlock("nov28", 30)])
    expect(chosen.nov28).toBeUndefined()
  })

  it("skips a gym the operator has ruled out", () => {
    const chosen = assignBlocksFromPool(state(), [emptyBlock("nov21", 30)], {
      excludeVenueIds: ["hall"],
    })
    expect(chosen.nov21?.venueId).toBe("sixpark")
  })

  it("leaves a block that already names a building alone", () => {
    const chosen = assignBlocksFromPool(state(), [
      { ...emptyBlock("nov21", 30), venueId: "sixpark", courts: 3 },
    ])
    expect(chosen).toEqual({})
  })

  it("is deterministic: the same blocks are answered the same way twice", () => {
    expect(assignBlocksFromPool(state(), [emptyBlock("nov21", 30)])).toEqual(
      assignBlocksFromPool(state(), [emptyBlock("nov21", 30)])
    )
  })
})

describe("rentalAsk: the ask with no dates in it", () => {
  /** One month, three weekends, home gym too small for the two cohorts. */
  function twoSpills(): PlannerState {
    const home = gymOf("playground", "The Playground", 1, "home") // 12 games
    return {
      seasonId: "season",
      units: [unit("Gr7", 12), unit("Gr8", 12)],
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov7", "2026-11-07", [home, RENTAL]),
            weekend("nov21", "2026-11-21", [home, RENTAL]),
          ],
        },
      ],
    }
  }

  it("adds up from the blocks, and groups by month", () => {
    const state = twoSpills()
    const blocks = planRentalBlocks(state, { nov7: ["age:Gr7"], nov21: ["age:Gr8"] })
    // Each weekend puts its whole cohort in the home gym: 12 games fits 12.
    expect(blocks).toEqual([])

    // Now both cohorts land on one weekend, so one of them rents.
    const together = planRentalBlocks(state, { nov7: ["age:Gr7", "age:Gr8"] })
    const ask = rentalAsk(state, together)
    expect(ask.season.courtDays).toBe(
      together.reduce((sum, b) => sum + b.courtDays, 0)
    )
    expect(ask.season.courtHours).toBe(
      together.reduce((sum, b) => sum + b.hoursNeeded, 0)
    )
    expect(ask.season.gamesUnhoused).toBe(0)
    expect(ask.months).toHaveLength(1)
    expect(ask.months[0]).toMatchObject({ label: "Nov 2026", weekendsNeedingRent: 1 })
  })

  it("says one weekend of N courts when that is the whole shape", () => {
    const state = twoSpills()
    const blocks = planRentalBlocks(state, { nov7: ["age:Gr7", "age:Gr8"] })
    expect(rentalAsk(state, blocks).months[0].chunks).toBe("one weekend of 1 court")
  })

  it("says two weekends of the same size as one clause", () => {
    const home = gymOf("playground", "The Playground", 0, "home")
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr7", 12), unit("Gr8", 12)],
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov7", "2026-11-07", [home, RENTAL]),
            weekend("nov21", "2026-11-21", [home, RENTAL]),
          ],
        },
      ],
    }
    const blocks = planRentalBlocks(state, { nov7: ["age:Gr7"], nov21: ["age:Gr8"] })
    const month = rentalAsk(state, blocks).months[0]
    expect(month.weekendsNeedingRent).toBe(2)
    // Two cohorts of 12 games, one court each. Co-located they are 24 games,
    // which is still two courts, so there is nothing cheaper to offer.
    expect(month.chunks).toBe("two weekends of 1 court")
  })

  it("offers the co-located alternative only when it really is fewer courts", () => {
    // Two cohorts of 7 games. Apart: one court each, two courts in all.
    // Together: 14 games is still two courts at 12 a court — no saving, so
    // nothing is offered. Two cohorts of 5: apart two courts, together one.
    const home = gymOf("playground", "The Playground", 0, "home")
    const build = (teams: number): PlannerState => ({
      seasonId: "season",
      units: [unit("Gr7", teams), unit("Gr8", teams)],
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov7", "2026-11-07", [home, RENTAL]),
            weekend("nov21", "2026-11-21", [home, RENTAL]),
          ],
        },
      ],
    })
    const noSaving = build(7)
    expect(
      rentalAsk(noSaving, planRentalBlocks(noSaving, { nov7: ["age:Gr7"], nov21: ["age:Gr8"] }))
        .months[0].chunks
    ).toBe("two weekends of 1 court")

    const saving = build(5)
    expect(
      rentalAsk(saving, planRentalBlocks(saving, { nov7: ["age:Gr7"], nov21: ["age:Gr8"] })).months[0]
        .chunks
    ).toBe("two weekends of 1 court, or one weekend of 1 court")
  })

  it("counts the games nothing can house, and only those", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr10", 30)],
      errors: [],
      windows: [{ label: "Dec 2026", weekends: [weekend("dec19", "2026-12-19", [HOME])] }],
    }
    const ask = rentalAsk(state, planRentalBlocks(state, { dec19: ["age:Gr10"] }))
    expect(ask.season.gamesUnhoused).toBe(30)
    expect(ask.months[0].weekendsNeedingRent).toBe(1)
  })
})

describe("weekendStory: the weekend in numbers", () => {
  /** The story for one weekend, packed the way the board packs it. */
  function story(
    units: PlannerUnit[],
    w: PlannerWeekend,
    keys: string[],
    decided: Record<string, string> = {},
    homes: Record<string, string> = {},
    reasons?: Record<string, ReturnType<typeof reasonOf>>
  ) {
    const gyms = resolveWeekendGyms(units, w, keys, decided, reasons)
    return weekendStory(units, w, gyms, homes)
  }
  const reasonOf = (
    r: "decided" | "home" | "rented" | "resident" | "fill" | "bumped" | "avoided" | "overflow"
  ) => r

  it("says what the home gym holds and what the weekend rents", () => {
    const units = [unit("Grade 9", 24), unit("Grade 8", 10)]
    const w = weekend("dec19", "2026-12-19", [HOME, RENTAL])
    const { caption } = story(units, w, ["age:Grade 9", "age:Grade 8"])
    expect(caption).toBe(
      "Playground full at 24 of 24 · Grade 8 (10 games) rented: 1 court at Six Park (10 of 72)"
    )
  })

  it("agrees with itself when two grades share the rental", () => {
    const units = [unit("Grade 9", 24), unit("Grade 8", 3), unit("Grade 7", 4)]
    const w = weekend("dec19", "2026-12-19", [HOME, RENTAL])
    const { caption } = story(units, w, units.map((u) => u.key))
    expect(caption).toBe(
      "Playground full at 24 of 24 · Grade 8 (3 games) and Grade 7 (4 games) rented: 1 court at Six Park (7 of 72)"
    )
  })

  it("says a weekend that never leaves the home gym is exactly that", () => {
    const units = [unit("Grade 8", 10)]
    const w = weekend("dec19", "2026-12-19", [HOME, RENTAL])
    expect(story(units, w, ["age:Grade 8"]).caption).toBe(
      "fits in Playground alone, 10 of 24"
    )
  })

  it("names the grade that was moved, and the gym that was full", () => {
    // November holds all three in the rented hub, so that is where they have
    // been. December's hub is one court and the small home gym takes two of
    // them; the third is the one capacity moves.
    const units = [unit("Grade 6", 6), unit("Grade 8", 6), unit("Grade 9", 12)]
    const keys = units.map((u) => u.key)
    const state: PlannerState = {
      seasonId: "season",
      units,
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov21", "2026-11-21", [
              gymOf("playground", "The Playground", 0, "home"),
              gymOf("sixpark", "Six Park East", 6, "pool"),
            ]),
          ],
        },
        {
          label: "Dec 2026",
          weekends: [
            weekend("dec19", "2026-12-19", [
              gymOf("playground", "The Playground", 1, "home"),
              gymOf("sixpark", "Six Park East", 6, "pool"),
            ]),
          ],
        },
      ],
    }
    const placed = packShownPlacements(state, { nov21: keys, dec19: keys })
    expect(placed.reasons.nov21).toEqual({
      "age:Grade 6": "rented",
      "age:Grade 8": "rented",
      "age:Grade 9": "rented",
    })
    // Consolidation: the home gym takes the biggest cohort it can hold, and
    // the two that do not fit keep the building they were renting.
    expect(placed.venues.dec19).toEqual({
      "age:Grade 9": "playground",
      "age:Grade 6": "sixpark",
      "age:Grade 8": "sixpark",
    })
    const w = state.windows[1].weekends[0]
    const gyms = resolveWeekendGyms(units, w, keys, placed.venues.dec19, placed.reasons.dec19)
    const { caption } = weekendStory(units, w, gyms, placed.homes.dec19)
    expect(caption).toBe(
      "Playground full at 12 of 12 · Grade 6 (6 games) and Grade 8 (6 games) rented: 1 court at Six Park (12 of 72)"
    )
  })

  it("leads with the shortage, in games", () => {
    const units = [unit("Grade 10", 30)]
    const w = weekend("dec12", "2026-12-12", [gym("home", "The Playground", 24, "home")])
    const { caption, chipCaptions } = story(units, w, ["age:Grade 10"])
    expect(caption).toContain("Playground over by 6 (30 of 24)")
    expect(chipCaptions["age:Grade 10"]).toBe("no room")
  })

  it("says an empty weekend is spare, and a full one is a full house", () => {
    const units = [unit("Grade 8", 4), unit("Grade 9", 17)]
    const w = weekend("dec12", "2026-12-12", [gym("home", "The Playground", 24, "home")])
    expect(story(units, w, []).caption).toBe("spare capacity")
    // 21 of 24 is past the tight line, and nothing else happened.
    expect(story(units, w, ["age:Grade 8", "age:Grade 9"]).caption).toBe("full house")
  })

  it("writes no em-dash anywhere an operator can read", () => {
    const units = [unit("Grade 9", 24), unit("Grade 8", 10)]
    const w = weekend("dec19", "2026-12-19", [HOME, RENTAL])
    const { caption, chipCaptions } = story(units, w, units.map((u) => u.key))
    for (const line of [caption, ...Object.values(chipCaptions)]) {
      expect(line).not.toContain("—")
    }
  })
})

describe("packPlanVenues", () => {
  /** Two months, one weekend each, the same two gyms both times. */
  function twoMonths(second: PlannerVenue[]): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr7", 12), unit("Gr8", 12)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("oct", "2026-10-24", [
              gymOf("playground", "The Playground", 1, "home"),
              RENTAL,
            ]),
          ],
        },
        { label: "Nov 2026", weekends: [weekend("nov", "2026-11-14", second)] },
      ],
    }
  }

  const both = { oct: ["age:Gr7", "age:Gr8"], nov: ["age:Gr7", "age:Gr8"] }

  it("brings a grade home the moment the home gym can hold it", () => {
    // October's home gym holds one of them (two cohorts of the same size, so
    // the key breaks the tie and Gr7 gets the room); November's holds both,
    // and the consolidation ruling says both come home rather than keep the
    // rental going.
    const venues = packPlanVenues(
      twoMonths([gymOf("playground", "The Playground", 2, "home"), RENTAL]),
      both
    )
    expect(venues.oct).toEqual({ "age:Gr7": "playground", "age:Gr8": "sixpark" })
    expect(venues.nov).toEqual({ "age:Gr7": "playground", "age:Gr8": "playground" })
  })

  it("keeps a grade in the rental while the home gym has no room for it", () => {
    const venues = packPlanVenues(
      twoMonths([gymOf("playground", "The Playground", 1, "home"), RENTAL]),
      both
    )
    expect(venues.oct).toEqual({ "age:Gr7": "playground", "age:Gr8": "sixpark" })
    expect(venues.nov).toEqual(venues.oct)
  })

  it("leaves out weekends that place nobody", () => {
    const state = twoMonths([gymOf("playground", "The Playground", 3, "home")])
    const venues = packPlanVenues(state, { oct: ["age:Gr7", "age:Gr8"], nov: [] })
    expect(Object.keys(venues)).toEqual(["oct"])
  })

  it("ignores grades this season does not have", () => {
    const state = twoMonths([gymOf("playground", "The Playground", 3, "home")])
    const venues = packPlanVenues(state, { oct: ["age:Gr7", "age:Deleted"] })
    expect(venues.oct).toEqual({ "age:Gr7": "playground" })
  })

  it("is deterministic: the same season packs the same way twice", () => {
    const second = () => [gymOf("playground", "The Playground", 2, "home"), RENTAL]
    expect(packPlanVenues(twoMonths(second()), both)).toEqual(
      packPlanVenues(twoMonths(second()), both)
    )
  })
})

describe("packShownVenues: the whole calendar a screen is drawing", () => {
  /**
   * The live NPH shape: The Playground is the building they OWN and it is the
   * small one; Six Park is the big rented hub. December is the weekend Grade
   * 10's games turn up.
   */
  function heavyDecember(): PlannerState {
    return {
      seasonId: "season",
      units: [unit("Gr6", 6), unit("Gr8", 6), unit("Gr10", 30)],
      errors: [],
      windows: [
        { label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME, RENTAL])] },
        { label: "Dec 2026", weekends: [weekend("dec19", "2026-12-19", [HOME, RENTAL])] },
      ],
    }
  }

  const shown = {
    nov21: ["age:Gr6", "age:Gr8"],
    dec19: ["age:Gr6", "age:Gr8", "age:Gr10"],
  }

  it("keeps the two small grades at home and rents for the big one", () => {
    const venues = packShownVenues(heavyDecember(), shown)
    expect(venues.nov21).toEqual({ "age:Gr6": "playground", "age:Gr8": "playground" })
    expect(venues.dec19).toEqual({
      "age:Gr6": "playground",
      "age:Gr8": "playground",
      "age:Gr10": "sixpark",
    })
  })

  it("a decided gym beats consolidation, and is the gym carried forward", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr6", 6), unit("Gr8", 6)],
      errors: [],
      windows: [
        { label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME, RENTAL])] },
        { label: "Dec 2026", weekends: [weekend("dec19", "2026-12-19", [HOME, RENTAL])] },
        { label: "Jan 2027", weekends: [weekend("jan16", "2027-01-16", [HOME, RENTAL])] },
      ],
    }
    const keys = ["age:Gr6", "age:Gr8"]
    const venues = packShownVenues(
      state,
      { nov21: keys, dec19: keys, jan16: keys },
      // Somebody switched Grade 8 to Six Park for December, by hand.
      { dec19: { "age:Gr8": "sixpark" } }
    )
    expect(venues.nov21["age:Gr8"]).toBe("playground")
    expect(venues.dec19["age:Gr8"]).toBe("sixpark")
    // January brings it home again: a rented court is not worth keeping when
    // the building we own has room (owner ruling 2026-08-03).
    expect(venues.jan16["age:Gr8"]).toBe("playground")
    expect(venues.jan16["age:Gr6"]).toBe("playground")
  })

  it("ignores a decided gym the weekend does not run", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr6", 6)],
      errors: [],
      windows: [{ label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME])] }],
    }
    const venues = packShownVenues(state, { nov21: ["age:Gr6"] }, {
      nov21: { "age:Gr6": "sixpark" },
    })
    expect(venues.nov21).toEqual({ "age:Gr6": "playground" })
  })

  it("sends a grade that alternates to the building it did not just play", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr11", 6, true)],
      errors: [],
      windows: [
        { label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME, RENTAL])] },
        { label: "Dec 2026", weekends: [weekend("dec19", "2026-12-19", [HOME, RENTAL])] },
        { label: "Jan 2027", weekends: [weekend("jan16", "2027-01-16", [HOME, RENTAL])] },
      ],
    }
    const keys = ["age:Gr11"]
    const venues = packShownVenues(state, { nov21: keys, dec19: keys, jan16: keys })
    expect(venues.nov21["age:Gr11"]).toBe("playground")
    expect(venues.dec19["age:Gr11"]).toBe("sixpark")
    expect(venues.jan16["age:Gr11"]).toBe("playground")
  })

  it("draws a grade with no teams somewhere, and leaves empty weekends out", () => {
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr6", 0)],
      errors: [],
      windows: [
        { label: "Nov 2026", weekends: [weekend("nov21", "2026-11-21", [HOME, RENTAL])] },
        { label: "Dec 2026", weekends: [weekend("dec19", "2026-12-19", [HOME, RENTAL])] },
      ],
    }
    const venues = packShownVenues(state, { nov21: ["age:Gr6"], dec19: [] })
    expect(venues.nov21).toEqual({ "age:Gr6": "playground" })
    expect(Object.keys(venues)).toEqual(["nov21"])
  })

  it("agrees with what Keep would save: the same walk, the same answer", () => {
    const state = nphHomeAndPool()
    const plan = proposePlan(state, "balance")
    expect(packShownVenues(state, plan)).toEqual(packPlanVenues(state, plan))
  })

  it("is deterministic: the same calendar packs the same way twice", () => {
    expect(packShownVenues(heavyDecember(), shown)).toEqual(
      packShownVenues(heavyDecember(), shown)
    )
  })
})

describe("proposePlan with rentals in the score", () => {
  /** One month, two weekends: one that would rent three buildings, one that
   *  is a single big rental of the same total capacity. */
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
              gym("a", "Gym A", 20),
              gym("b", "Gym B", 20),
              gym("c", "Gym C", 20),
            ]),
            weekend("single", "2026-10-31", [gym("d", "Gym D", 60, "home")]),
          ],
        },
      ],
    }
  }

  it("prefers the weekend that costs nothing to the one that rents three gyms", () => {
    const state = splitVsSingle()
    const plan = proposePlan(state, "balance")
    // Everything lands on the owned building: three rented gyms is three
    // rentals, and the home gym is free.
    expect((plan.single ?? []).sort()).toEqual(["age:Gr7", "age:Gr8", "age:Gr9"])
    expect(plan.split).toEqual([])
    expect(planRentalBlocks(state, plan)).toEqual([])
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
    const state = nphHomeAndPool()
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
    expect(proposePlan(nphHomeAndPool(), "balance")).toEqual(
      proposePlan(nphHomeAndPool(), "balance")
    )
    expect(proposePlan(nphHomeAndPool(), "compact")).toEqual(
      proposePlan(nphHomeAndPool(), "compact")
    )
    const a = nphHomeAndPool()
    const b = nphHomeAndPool()
    expect(packPlanVenues(a, proposePlan(a, "balance"))).toEqual(
      packPlanVenues(b, proposePlan(b, "balance"))
    )
  })

  it("takes the heavier home weekend over a flatter one that rents", () => {
    // Two weekends. The first is the owned building, big enough for three of
    // the four grades; the second only has a rented hall. The flat 2/2 split
    // has a peak 12 games lower (2,400 against 3,600) but rents a second
    // court to get it (4,000 against 2,000), so the search takes the heavier
    // home weekend. Under the old weights the peak would have won.
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr7", 12), unit("Gr8", 12), unit("Gr9", 12), unit("Gr10", 12)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("home", "2026-10-24", [gymOf("own", "Home Gym", 3, "home")]),
            weekend("rent", "2026-10-31", [gymOf("hall", "Village Hall", 6, "pool")]),
          ],
        },
      ],
    }
    const plan = proposePlan(state, "balance")
    expect((plan.home ?? []).length).toBe(3)
    expect((plan.rent ?? []).length).toBe(1)
    // And one court over the two days is the whole bill.
    const blocks = planRentalBlocks(state, plan)
    expect(blocks.reduce((sum, b) => sum + b.courtDays, 0)).toBe(2)
  })

  it("still opens a rental rather than strand a game", () => {
    // The owned building holds 24 of the month's 48 games, so the rest must
    // be rented: overflow is a million a game and nothing outranks it.
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr7", 12), unit("Gr8", 12)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("a", "2026-10-24", [gymOf("own", "Home Gym", 1, "home"), RENTAL]),
            weekend("b", "2026-10-31", [gymOf("own", "Home Gym", 1, "home"), RENTAL]),
          ],
        },
      ],
    }
    const plan = proposePlan(state, "balance")
    for (const w of state.windows[0].weekends) {
      expect(weekendDemand(state.units, w, plan[w.sessionId] ?? [])).toBeLessThanOrEqual(
        w.capacityGames
      )
    }
    expect(planRentalBlocks(state, plan)).toEqual([])
  })
})

describe("proposePlan lever: one-gym is now the same objective", () => {
  it("answers exactly like balance, because consolidation is always on", () => {
    const state = nphHomeAndPool()
    expect(proposePlan(state, "one-gym")).toEqual(proposePlan(nphHomeAndPool(), "balance"))
  })

  it("is still accepted and still deterministic", () => {
    expect(proposePlan(nphHomeAndPool(), "one-gym")).toEqual(
      proposePlan(nphHomeAndPool(), "one-gym")
    )
  })
})

describe("proposePlan: the OLD residency dominance is gone", () => {
  /**
   * THE REGRESSION TEST FOR THE 2026-08-03 REVERSAL.
   *
   * October hands out the buildings: the owned gym is small, so the giant
   * rents Six Park and the two small grades live at home. November then offers
   * the search a choice, and under the old weights (GYM_VIOLATION_COST 25,000
   * against a second building at 150) it would keep the giant renting a whole
   * extra weekend rather than move a grade out of its building.
   *
   * Now a rented court-day costs 1,000 and a residency switch costs 5, so the
   * search buys the answer that rents least, and it is allowed to move grades
   * between buildings to get there.
   */
  function homesThenChoice(): PlannerState {
    const home = (courts: number) => gymOf("playground", "The Playground", courts, "home")
    return {
      seasonId: "season",
      units: [unit("Gr6", 6), unit("Gr8", 6), unit("Gr10", 24)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [weekend("oct24", "2026-10-24", [home(1), RENTAL])],
        },
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov14", "2026-11-14", [home(3), RENTAL]),
            weekend("nov21", "2026-11-21", [home(3), RENTAL]),
          ],
        },
      ],
    }
  }

  it("rents nothing in November, and does not care who changed building", () => {
    const state = homesThenChoice()
    const plan = proposePlan(state, "balance")
    const venues = packPlanVenues(state, plan)

    // October: the home gym holds 12 games, so the giant rents.
    expect(venues.oct24).toEqual({
      "age:Gr10": "sixpark",
      "age:Gr6": "playground",
      "age:Gr8": "playground",
    })
    // November: the home gym holds 36, so nothing is rented on either
    // weekend — including by the grade that had been renting all October.
    const blocks = planRentalBlocks(state, plan)
    expect(blocks.filter((b) => b.sessionId.startsWith("nov"))).toEqual([])
    // October's rental is real, and still there.
    expect(blocks.map((b) => b.sessionId)).toEqual(["oct24"])
    for (const byUnit of [venues.nov14, venues.nov21]) {
      for (const venueId of Object.values(byUnit ?? {})) {
        expect(venueId).toBe("playground")
      }
    }
    // The OLD behaviour: Grade 10 would have stayed at Six Park all season
    // because leaving it cost 25,000 and a whole rented weekend cost 150.
    expect(Object.values(venues.nov14 ?? {})).not.toContain("sixpark")
  })

  it("moves a grade out of its building when that is what stops the renting", () => {
    // One November weekend, home gym holds 24 of the month's 36 games. The
    // cheapest answer rents ONE court, and getting there means the two small
    // grades give up the building they were in.
    const state: PlannerState = {
      seasonId: "season",
      units: [unit("Gr6", 6), unit("Gr8", 6), unit("Gr10", 24)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("oct24", "2026-10-24", [
              gymOf("playground", "The Playground", 1, "home"),
              RENTAL,
            ]),
          ],
        },
        {
          label: "Nov 2026",
          weekends: [
            weekend("nov14", "2026-11-14", [
              gymOf("playground", "The Playground", 2, "home"),
              RENTAL,
            ]),
          ],
        },
      ],
    }
    const plan = proposePlan(state, "balance")
    const venues = packPlanVenues(state, plan)
    // The giant takes the whole home gym; the two small grades share one
    // rented court between them.
    expect(venues.nov14["age:Gr10"]).toBe("playground")
    expect(venues.nov14["age:Gr6"]).toBe("sixpark")
    expect(venues.nov14["age:Gr8"]).toBe("sixpark")
    const blocks = planRentalBlocks(state, plan)
    expect(blocks.filter((b) => b.sessionId === "nov14")).toHaveLength(1)
    expect(blocks.find((b) => b.sessionId === "nov14")).toMatchObject({ courts: 1, courtDays: 2 })
  })
})

/** The NPH shape: one owned building, one rented hub, and one grade the league
 *  promised would not sit in the same gym every month. */
function nphHomeAndPool(): PlannerState {
  const pair = (home: number, pool: number) =>
    [
      gymOf("playground", "The Playground", home, "home"),
      gymOf("sixpark", "Six Park East", pool, "pool"),
    ].filter((v) => v.capacityGames > 0)
  const w = (id: string, dateISO: string, home: number, pool: number) =>
    weekend(id, dateISO, pair(home, pool))
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
        weekends: [w("oct24", "2026-10-24", 4, 8), w("oct31", "2026-10-31", 4, 8)],
      },
      {
        label: "Nov 2026",
        weekends: [
          w("nov14", "2026-11-14", 4, 0),
          w("nov21", "2026-11-21", 4, 8),
          w("nov28", "2026-11-28", 4, 8),
        ],
      },
      {
        label: "Dec 2026",
        weekends: [w("dec12", "2026-12-12", 4, 0), w("dec19", "2026-12-19", 4, 8)],
      },
    ],
  }
}
