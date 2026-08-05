import { describe, expect, it } from "vitest"
import type { PlanWorld, PlanWorldGym } from "./plan-documents"
import type { PlannerState } from "./planner-core"
import {
  freshWorld,
  gamesPerCourtDay,
  planGridFrom,
  planStateFrom,
  strandedPlacements,
  strandedSentence,
  unitIncluded,
  usableCourtCount,
  weekendChosen,
  withCourtBuffer,
  withGym,
  withGymCourts,
  withGymEveryWeekend,
  withGymHours,
  withGymOnWeekend,
  withGymRole,
  withUnitIncluded,
  withUnitTeams,
  withWeekendChosen,
  withWeekendGymHours,
  worldFromState,
  worldGyms,
  worldWeekends,
} from "./plan-world"

/**
 * A PLAN OWNS ITS WORLD (owner ruling 2026-08-05, the architecture). These are
 * the contracts every one of the three steps depends on:
 *
 *   - capacity is DERIVED from courts × days × floor(window ÷ slot), minus the
 *     buffer, which is exactly what buildSlots does. An editor that got this
 *     wrong would put a plan's numbers quietly out of step with the season it
 *     eventually becomes.
 *   - a fresh plan has its grades and NO gym time at all.
 *   - a plan the season stopped agreeing with strands its own placements loudly
 *     rather than drawing games in a building it no longer has.
 */

const HOME: PlanWorldGym = {
  venueId: "v-home",
  name: "The Playground",
  role: "home",
  courts: 3,
  openTime: "09:00",
  closeTime: "21:00",
  seasonVenueId: "sv-home",
}
const POOL: PlanWorldGym = {
  venueId: "v-pool",
  name: "Six Park East",
  role: "pool",
  courts: 6,
  openTime: "08:00",
  closeTime: "20:00",
  seasonVenueId: "sv-pool",
}

/** A two-weekend world: October is chosen with the home gym on it, November is
 *  not chosen at all. */
function world(): PlanWorld {
  return {
    seasonId: "s1",
    gameSlotMinutes: 60,
    courtBuffer: 0,
    gamesPerTeam: 10,
    gyms: [HOME, POOL],
    units: [
      { key: "age:Grade 7", label: "Grade 7", divisionIds: ["d7"], teams: 12, included: true },
      { key: "age:Grade 8", label: "Grade 8", divisionIds: ["d8"], teams: 0, included: false },
    ],
    windows: [
      {
        label: "Oct 2026",
        weekends: [
          {
            sessionId: "w-oct",
            label: "Oct 24–25",
            dateISO: "2026-10-24",
            dayCount: 2,
            chosen: true,
            targetGamesPerTeam: 2,
            capacityGames: 72,
            largestVenueCapacity: 72,
            venues: [
              {
                venueId: "v-home",
                name: "The Playground",
                capacityGames: 72,
                role: "home",
                fillOrder: 0,
                courts: 3,
                courtsHeld: 0,
                courtDays: 6,
                days: 2,
                hoursPerCourtDay: 12,
              },
            ],
          },
          {
            sessionId: "w-nov",
            label: "Nov 7–8",
            dateISO: "2026-11-07",
            dayCount: 2,
            chosen: false,
            targetGamesPerTeam: 2,
            capacityGames: 0,
            largestVenueCapacity: 0,
            venues: [],
          },
        ],
      },
    ],
  }
}

const weekendOf = (w: PlanWorld, sessionId: string) =>
  worldWeekends(w).find((x) => x.sessionId === sessionId)

describe("the arithmetic capacity is made of", () => {
  it("counts games per court-day the way buildSlots floors them", () => {
    expect(gamesPerCourtDay("09:00", "21:00", 60)).toBe(12)
    // 90-minute slots over 12 hours is eight games, not eight and a bit.
    expect(gamesPerCourtDay("09:00", "21:00", 90)).toBe(8)
    // A gym that is shut holds nothing, and a backwards window is shut.
    expect(gamesPerCourtDay("21:00", "09:00", 60)).toBe(0)
    expect(gamesPerCourtDay(null, "21:00", 60)).toBe(0)
  })

  it("holds back courts the way usableCourts does, and never past zero", () => {
    expect(usableCourtCount(6, 0)).toBe(6)
    expect(usableCourtCount(6, 2)).toBe(4)
    expect(usableCourtCount(2, 5)).toBe(0)
  })
})

describe("reading a plan as a board", () => {
  it("draws the plan's own weekends, gyms and calendar", () => {
    const state = planStateFrom("s1", {
      settings: { capturedAt: "x", state: world() },
      assignment: { "w-oct": ["age:Grade 7"] },
      venues: { "w-oct": { "age:Grade 7": "v-home" } },
    }) as PlannerState
    expect(state.seasonId).toBe("s1")
    const oct = state.windows[0].weekends[0]
    expect(oct.capacityGames).toBe(72)
    expect(oct.assigned).toEqual(["age:Grade 7"])
    expect(oct.assignedVenues).toEqual({ "age:Grade 7": "v-home" })
    // The unchosen weekend keeps its place in the month and holds nothing.
    const nov = state.windows[0].weekends[1]
    expect(nov.chosen).toBe(false)
    expect(nov.venues).toEqual([])
    expect(nov.capacityGames).toBe(0)
  })

  it("drops a grade the plan holds OUT, calendar and all", () => {
    const state = planStateFrom("s1", {
      settings: { capturedAt: "x", state: world() },
      assignment: { "w-oct": ["age:Grade 7", "age:Grade 8"] },
      venues: { "w-oct": { "age:Grade 8": "v-home" } },
    }) as PlannerState
    expect(state.units.map((u) => u.key)).toEqual(["age:Grade 7"])
    expect(state.windows[0].weekends[0].assigned).toEqual(["age:Grade 7"])
    expect(state.windows[0].weekends[0].assignedVenues).toEqual({})
  })

  it("is null for a plan that never remembered a world", () => {
    expect(planStateFrom("s1", { settings: null })).toBeNull()
  })

  it("reads roles and chosen-ness off an OLDER snapshot that carries neither", () => {
    const old: PlanWorld = {
      units: [{ key: "age:Grade 7", label: "Grade 7", teams: 8 }],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            {
              sessionId: "w1",
              label: "Oct 24–25",
              capacityGames: 40,
              targetGamesPerTeam: 2,
              venues: [
                { venueId: "v1", name: "Old Home", capacityGames: 40, fillOrder: 0 },
                { venueId: "v2", name: "Old Pool", capacityGames: 20, fillOrder: 1 },
              ],
            },
          ],
        },
      ],
    }
    const state = planStateFrom("s1", { settings: { capturedAt: "x", state: old } }) as PlannerState
    // fillOrder 0 meant "fills first", which is what owning a building means.
    expect(state.windows[0].weekends[0].venues[0].role).toBe("home")
    // A weekend with gyms on it was a weekend the plan ran.
    expect(state.windows[0].weekends[0].chosen).toBe(true)
    expect(unitIncluded(old.units[0])).toBe(true)
    expect(worldGyms(old).map((g) => g.role)).toEqual(["home", "pool"])
  })
})

describe("editing a plan's world", () => {
  it("recomputes capacity when courts move", () => {
    const next = withGymCourts(world(), "v-home", 6)
    // 6 courts × 2 days × 12 games = 144.
    expect(weekendOf(next, "w-oct")?.capacityGames).toBe(144)
    expect(weekendOf(next, "w-oct")?.venues[0].courts).toBe(6)
  })

  it("recomputes capacity when the hours move", () => {
    const next = withGymHours(world(), "v-home", "09:00", "15:00")
    // 3 courts × 2 days × 6 games = 36.
    expect(weekendOf(next, "w-oct")?.capacityGames).toBe(36)
  })

  it("takes the buffer out of every weekend at once", () => {
    const next = withCourtBuffer(world(), 1)
    const oct = weekendOf(next, "w-oct")
    expect(next.courtBuffer).toBe(1)
    expect(oct?.venues[0].courts).toBe(2)
    expect(oct?.venues[0].courtsHeld).toBe(1)
    expect(oct?.capacityGames).toBe(48)
  })

  it("keeps home exclusive: naming one sends the other to the pool", () => {
    const next = withGymRole(world(), "v-pool", "home")
    const roles = Object.fromEntries(worldGyms(next).map((g) => [g.venueId, g.role]))
    expect(roles).toEqual({ "v-home": "pool", "v-pool": "home" })
  })

  it("puts a gym on a weekend, and turning a gym on turns the weekend on", () => {
    const next = withGymOnWeekend(world(), "w-nov", "v-pool", true)
    const nov = weekendOf(next, "w-nov")
    expect(weekendChosen(nov as never)).toBe(true)
    // 6 courts × 2 days × 12 games (08:00–20:00) = 144.
    expect(nov?.capacityGames).toBe(144)
    expect(nov?.venues.map((v) => v.venueId)).toEqual(["v-pool"])
  })

  it("choosing a weekend attaches the HOME gym and leaves the pool alone", () => {
    const next = withWeekendChosen(world(), "w-nov", true)
    const nov = weekendOf(next, "w-nov")
    expect(nov?.venues.map((v) => v.venueId)).toEqual(["v-home"])
    expect(nov?.capacityGames).toBe(72)
  })

  it("un-choosing a weekend takes every gym off it", () => {
    const next = withWeekendChosen(world(), "w-oct", false)
    const oct = weekendOf(next, "w-oct")
    expect(oct?.chosen).toBe(false)
    expect(oct?.venues).toEqual([])
    expect(oct?.capacityGames).toBe(0)
  })

  it("one weekend can run its own hours without moving the others", () => {
    const on = withGymOnWeekend(world(), "w-nov", "v-home", true)
    const next = withWeekendGymHours(on, "w-nov", "v-home", {
      startTime: "12:00",
      endTime: "18:00",
    })
    // 3 courts × 2 days × 6 games = 36 on November; October keeps its 72.
    expect(weekendOf(next, "w-nov")?.capacityGames).toBe(36)
    expect(weekendOf(next, "w-oct")?.capacityGames).toBe(72)
    const reset = withWeekendGymHours(next, "w-nov", "v-home", null)
    expect(weekendOf(reset, "w-nov")?.capacityGames).toBe(72)
  })

  it("on-all-weekends never invents a weekend the plan does not run", () => {
    const next = withGymEveryWeekend(world(), "v-pool", true)
    expect(weekendOf(next, "w-oct")?.venues.map((v) => v.venueId)).toContain("v-pool")
    // November is not a weekend this plan runs, so nothing was claimed there.
    expect(weekendOf(next, "w-nov")?.venues).toEqual([])
  })

  it("adds a gym with no availability at all", () => {
    const next = withGym(world(), {
      venueId: "v-haber",
      name: "Haber Recreation Centre",
      role: "pool",
      courts: 0,
      openTime: null,
      closeTime: null,
    })
    expect(worldGyms(next).map((g) => g.venueId)).toContain("v-haber")
    // It is on no weekend, which is the honest state of a gym nobody phoned.
    for (const w of worldWeekends(next)) {
      expect(w.venues.some((v) => v.venueId === "v-haber")).toBe(false)
    }
  })

  it("takes a grade in and out without losing its number", () => {
    const out = withUnitIncluded(withUnitTeams(world(), "age:Grade 7", 14), "age:Grade 7", false)
    expect(out.units.find((u) => u.key === "age:Grade 7")?.teams).toBe(14)
    expect(unitIncluded(out.units[0])).toBe(false)
    const back = withUnitIncluded(out, "age:Grade 7", true)
    expect(back.units.find((u) => u.key === "age:Grade 7")?.teams).toBe(14)
  })
})

describe("a fresh plan", () => {
  const live: PlannerState = {
    seasonId: "s1",
    units: [
      {
        key: "age:Grade 7",
        label: "Grade 7",
        divisionIds: ["d7"],
        teams: 12,
        approved: 9,
        expected: 12,
        source: "expected",
      },
      // No estimate, but nine teams really registered: the number to prefill.
      {
        key: "age:Grade 9",
        label: "Grade 9",
        divisionIds: ["d9"],
        teams: 0,
        approved: 9,
        expected: 0,
        source: "none",
      },
    ],
    windows: [
      {
        label: "Oct 2026",
        weekends: [
          {
            sessionId: "w-oct",
            label: "Oct 24–25",
            dateISO: "2026-10-24",
            dayCount: 2,
            capacityGames: 72,
            largestVenueCapacity: 72,
            targetGamesPerTeam: 2,
            assigned: ["age:Grade 7"],
            assignedVenues: { "age:Grade 7": "v-home" },
            venues: [
              {
                venueId: "v-home",
                name: "The Playground",
                capacityGames: 72,
                role: "home",
                fillOrder: 0,
                courts: 3,
                days: 2,
                courtDays: 6,
              },
            ],
          },
        ],
      },
    ],
    errors: [],
    gamesPerTeam: 10,
    courtBuffer: 0,
    gameSlotMinutes: 60,
    gyms: [HOME, POOL],
  }

  it("prefills the grades from estimates, or from the teams already in", () => {
    const fresh = freshWorld(live)
    const byKey = Object.fromEntries(fresh.units.map((u) => [u.key, u]))
    expect(byKey["age:Grade 7"].teams).toBe(12)
    // Registration is where a grade with no estimate starts, not zero.
    expect(byKey["age:Grade 9"].teams).toBe(9)
    expect(byKey["age:Grade 9"].included).toBe(true)
  })

  it("assumes NO gym time: no weekend chosen, no gym attached", () => {
    const fresh = freshWorld(live)
    for (const w of worldWeekends(fresh)) {
      expect(weekendChosen(w)).toBe(false)
      expect(w.venues).toEqual([])
      expect(w.capacityGames).toBe(0)
    }
  })

  it("still LISTS the gyms the league has, home role included", () => {
    const gyms = worldGyms(freshWorld(live))
    expect(gyms.map((g) => g.venueId).sort()).toEqual(["v-home", "v-pool"])
    expect(gyms.find((g) => g.venueId === "v-home")?.role).toBe("home")
    // The pool is named and its availability is unknown, which is the point.
    expect(gyms.find((g) => g.venueId === "v-pool")?.name).toBe("Six Park East")
  })

  it("carries no calendar: the plan's own columns are the calendar", () => {
    const snapshot = worldFromState(live)
    // worldFromState is the snapshot every save takes; the assignment is NOT in
    // it, because a plan must never hold two answers to where a grade plays.
    expect(JSON.stringify(snapshot)).not.toContain("assignedVenues")
    expect(snapshot.courtBuffer).toBe(0)
    expect(snapshot.gameSlotMinutes).toBe(60)
  })
})

describe("the world moved under the calendar", () => {
  /** October now runs the POOL gym only: the home gym came off it on step 2. */
  const movedOn = withGymOnWeekend(
    withGymOnWeekend(world(), "w-oct", "v-home", false),
    "w-oct",
    "v-pool",
    true
  )

  it("strands a placement whose gym the plan no longer has, and drops it", () => {
    const state = planStateFrom("s1", {
      settings: { capturedAt: "x", state: movedOn },
    }) as PlannerState
    const result = strandedPlacements(
      state,
      { "w-oct": ["age:Grade 7"] },
      { "w-oct": { "age:Grade 7": "v-home" } }
    )
    expect(result.stranded).toHaveLength(1)
    expect(result.stranded[0]).toMatchObject({
      sessionId: "w-oct",
      unitKey: "age:Grade 7",
      venueId: "v-home",
      venueName: "The Playground",
      weekendGone: false,
    })
    // The stale decision is GONE, which is what sends those games into the
    // dashed block that needs a building.
    expect(result.venues["w-oct"]).toBeUndefined()
    // The grade still plays that weekend; it just has nowhere decided.
    expect(result.assignment["w-oct"]).toEqual(["age:Grade 7"])
    expect(strandedSentence(result.stranded)).toContain("The Playground")
    expect(strandedSentence(result.stranded)).toContain("needs a building")
  })

  it("strands everything on a weekend the plan stopped running", () => {
    const off = withWeekendChosen(world(), "w-oct", false)
    const state = planStateFrom("s1", { settings: { capturedAt: "x", state: off } }) as PlannerState
    const result = strandedPlacements(state, { "w-oct": ["age:Grade 7"] }, {})
    expect(result.stranded).toHaveLength(1)
    expect(result.stranded[0].weekendGone).toBe(true)
    // Nothing plays on a weekend the plan does not run.
    expect(result.assignment["w-oct"]).toBeUndefined()
    expect(strandedSentence(result.stranded)).toContain("Oct 24–25")
  })

  it("says nothing when the world still holds the calendar", () => {
    const state = planStateFrom("s1", { settings: { capturedAt: "x", state: world() } }) as PlannerState
    const result = strandedPlacements(
      state,
      { "w-oct": ["age:Grade 7"] },
      { "w-oct": { "age:Grade 7": "v-home" } }
    )
    expect(result.stranded).toEqual([])
    expect(strandedSentence([])).toBeNull()
    expect(result.venues).toEqual({ "w-oct": { "age:Grade 7": "v-home" } })
  })
})

describe("step 2's grid, drawn from a plan", () => {
  /** The season's grid shape: two Saturdays, one of which has no session yet. */
  const seasonGrid = {
    seasonId: "s1",
    seasonLabel: "Fall 2026",
    leagueName: "NPH",
    courtBuffer: 0,
    weekends: [
      {
        key: "2026-10-24",
        satDateISO: "2026-10-24",
        sessionId: "w-oct",
        phase: "REGULAR" as const,
        label: "Oct 24–25",
        dayLabel: "24–25",
        month: "Oct",
        dateISO: "2026-10-24",
        dayCount: 2,
      },
      {
        key: "2026-11-07",
        satDateISO: "2026-11-07",
        sessionId: null,
        phase: null,
        label: "Nov 7–8",
        dayLabel: "7–8",
        month: "Nov",
        dateISO: "2026-11-07",
        dayCount: 2,
      },
    ],
    venues: [HOME, POOL].map((gym) => ({
      seasonVenueId: gym.seasonVenueId as string,
      venueId: gym.venueId,
      name: gym.name,
      city: null,
      isPrimary: gym.role === "home",
      role: gym.role,
      fillOrder: null,
      courtsAvailable: gym.courts,
      courtCount: gym.courts,
      courts: [],
      defaultHours: [],
      postedHours: [],
      defaultWindowLabel: null,
      simpleOpen: gym.openTime ?? null,
      simpleClose: gym.closeTime ?? null,
      hoursVary: false,
      cells: [
        {
          sessionId: "w-oct",
          satDateISO: "2026-10-24",
          state: "on" as const,
          daysOn: 2,
          dayCount: 2,
          courts: gym.courts,
          startTime: gym.openTime ?? null,
          endTime: gym.closeTime ?? null,
          hoursLabel: null,
          reason: null,
          bookingStatus: "confirmed" as const,
        },
        {
          sessionId: null,
          satDateISO: "2026-11-07",
          state: "off" as const,
          daysOn: 0,
          dayCount: 2,
          courts: 0,
          startTime: null,
          endTime: null,
          hoursLabel: null,
          reason: null,
          bookingStatus: null,
        },
      ],
    })),
  }

  it("keeps the season's columns and reads the plan's cells", () => {
    const grid = planGridFrom(seasonGrid as never, world())
    expect(grid.weekends.map((w) => w.key)).toEqual(["2026-10-24", "2026-11-07"])
    const home = grid.venues.find((v) => v.venueId === "v-home")
    const pool = grid.venues.find((v) => v.venueId === "v-pool")
    // The plan has the home gym in October and nothing else anywhere.
    expect(home?.cells[0].state).toBe("on")
    expect(pool?.cells[0].state).toBe("off")
    expect(home?.cells[1].state).toBe("off")
    // A plan holds no bookings, so no cell can read as assumed.
    expect(grid.venues.every((v) => v.cells.every((c) => c.bookingStatus === null))).toBe(true)
  })

  it("rows arrive home first, and the buffer is the plan's", () => {
    const grid = planGridFrom(seasonGrid as never, withCourtBuffer(world(), 2))
    expect(grid.venues[0].venueId).toBe("v-home")
    expect(grid.courtBuffer).toBe(2)
  })

  it("folds in a gym the season grew after the plan was made, with nothing on it", () => {
    const thin: PlanWorld = { ...world(), gyms: [HOME] }
    const grid = planGridFrom(seasonGrid as never, thin)
    const pool = grid.venues.find((v) => v.venueId === "v-pool")
    expect(pool).toBeDefined()
    expect(pool?.cells.every((c) => c.state === "off")).toBe(true)
  })

  it("draws a one-weekend exception as custom hours", () => {
    const grid = planGridFrom(
      seasonGrid as never,
      withWeekendGymHours(world(), "w-oct", "v-home", { startTime: "12:00", endTime: "18:00" })
    )
    const home = grid.venues.find((v) => v.venueId === "v-home")
    expect(home?.cells[0].state).toBe("custom")
    expect(home?.cells[0].hoursLabel).toBe("12:00–18:00")
  })
})
