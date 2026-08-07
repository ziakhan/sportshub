import { describe, expect, it } from "vitest"
import type { PlanWorld, PlanWorldGym } from "./plan-documents"
import {
  courtCapKey,
  packPlanVenues,
  planRentalBlocks,
  proposePlan,
  rentalAsk,
  type PlannerState,
  type PlannerWeekend,
} from "./planner-core"
import {
  bookingStatusFor,
  drawnGyms,
  gymRanks,
  withGymOrder,
  fencedWindowLabels,
  windowFenced,
  withWindowPhase,
  withWindowPhases,
  withWindowPhasesInWorld,
  homeGymCapacity,
  homeGymOf,
  weekendSolvable,
  worldReadiness,
  weekendGymHours,
  withWeekendHours,
  withWeekendHoursInWorld,
  bareWeekend,
  boardColumns,
  freshWorld,
  gamesPerCourtDay,
  isGhostWeekend,
  monthColumnLabel,
  planGridFrom,
  planStateFrom,
  solvableState,
  strandedPlacements,
  strandedSentence,
  unitIncluded,
  usableCourtCount,
  weekendChosen,
  weekendRooms,
  withAssertedGyms,
  withAssertedGymsInWorld,
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
  withWeekendInState,
  worldFromState,
  worldGyms,
  worldWeekends,
  type BuildingRoom,
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

  it("choosing a weekend attaches no gym at all: the board places buildings", () => {
    const next = withWeekendChosen(world(), "w-nov", true)
    const nov = weekendOf(next, "w-nov")
    expect(weekendChosen(nov as never)).toBe(true)
    // A preference, not a booking: nothing is claimed anywhere.
    expect(nov?.venues).toEqual([])
    expect(nov?.capacityGames).toBe(0)
    // And the weekend that already had the home gym on it keeps it.
    expect(weekendOf(next, "w-oct")?.venues.map((v) => v.venueId)).toEqual(["v-home"])
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

describe("the weekends the solver is allowed to fill", () => {
  it("keeps only the weekends the plan runs, and drops a month with none", () => {
    const state = planStateFrom("s1", {
      settings: { capturedAt: "x", state: world() },
    }) as PlannerState
    const runs = solvableState(state)
    // The world still shows the November weekend the plan did not take; the
    // solve does not, and November had nothing else, so the month goes with it.
    expect(state.windows[0].weekends.map((w) => w.sessionId)).toEqual(["w-oct", "w-nov"])
    expect(runs.windows).toHaveLength(1)
    expect(runs.windows[0].weekends.map((w) => w.sessionId)).toEqual(["w-oct"])
    // Everything else about the world is untouched: same grades, same gyms.
    expect(runs.units).toBe(state.units)
    expect(runs.gyms).toBe(state.gyms)
  })

  /**
   * RE-PINNED 2026-08-06 (availability is no longer a restriction ANYWHERE). A
   * chosen weekend whose HOME gym is shut used to be dropped from the solve. It
   * is not: the plan has a pool gym, and the draw may book it as assumed. What
   * still holds is that the weekend has to have SOMETHING to be filled from.
   */
  it("fills a chosen weekend from the pool when the home gym is shut", () => {
    const shut = withGymHours(world(), "v-home", "09:00", "09:00")
    const state = planStateFrom("s1", { settings: { capturedAt: "x", state: shut } }) as PlannerState
    expect(state.windows[0].weekends[0].capacityGames).toBe(0)
    const runs = solvableState(state)
    expect(runs.windows[0].weekends.map((w) => w.sessionId)).toEqual(["w-oct"])
    // The pool gym is the room: 6 courts × 2 days × 12 games (08:00–20:00).
    expect(runs.windows[0].weekends[0].capacityGames).toBe(144)
  })

  it("drops a chosen weekend only when no gym has a court to give", () => {
    // Courts are the one thing left that can make a weekend genuinely empty:
    // hours are not a refusal any more, and neither is an unattached gym.
    const none = withGymCourts(withGymCourts(world(), "v-home", 0), "v-pool", 0)
    const state = planStateFrom("s1", { settings: { capturedAt: "x", state: none } }) as PlannerState
    expect(solvableState(state).windows).toEqual([])
  })

  /**
   * RE-PINNED 2026-08-06: the identity shortcut now needs every gym to be on
   * every weekend already, because the solve puts the whole roster on the table.
   * A world with a gym left off a weekend is a world the solve has something to
   * add to, which is the point of the ruling.
   */
  it("hands a world with nothing left to offer straight back, unchanged", () => {
    const all = withGymEveryWeekend(
      withWeekendChosen(withGymOnWeekend(world(), "w-nov", "v-home", true), "w-nov", true),
      "v-pool",
      true
    )
    const state = planStateFrom("s1", { settings: { capturedAt: "x", state: all } }) as PlannerState
    expect(solvableState(state)).toBe(state)
  })
})

/**
 * THE OWNER'S OWN PATH, 2026-08-06 (the blocking bug, and the ruling that fixed
 * it: "the draw fills your chosen weekends from your gyms").
 *
 * New plan, teams estimated on step 1, weekends chosen on step 2, step 3. Wave B
 * made choosing a weekend attach NO gym, which was right, but three consumers
 * still demanded gym time up front: the hero, the solve, and the draw. Step 2 had
 * no control left for attaching any, so the operator went round in a circle.
 *
 * These pin the way out of it end to end: a plan whose weekends are BARE is
 * usable, the solve fills exactly those weekends from the building the league
 * owns, and the draw records that building so the board draws it.
 */
describe("the draw fills your chosen weekends from your gyms", () => {
  /** Three months of two weekends each, none of them chosen and none of them
   *  carrying a gym: a fresh plan, exactly as freshWorld leaves one. */
  function fresh(): PlanWorld {
    const weekend = (sessionId: string, label: string, dateISO: string) => ({
      sessionId,
      label,
      dateISO,
      dayCount: 2,
      chosen: false,
      targetGamesPerTeam: 2,
      capacityGames: 0,
      largestVenueCapacity: 0,
      venues: [],
    })
    return {
      seasonId: "s1",
      gameSlotMinutes: 60,
      courtBuffer: 0,
      gamesPerTeam: 10,
      gyms: [HOME, POOL],
      units: [
        { key: "age:Grade 7", label: "Grade 7", divisionIds: ["d7"], teams: 10, included: true },
        { key: "age:Grade 8", label: "Grade 8", divisionIds: ["d8"], teams: 8, included: true },
      ],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekend("w-oct-1", "Oct 3–4", "2026-10-03"),
            weekend("w-oct-2", "Oct 24–25", "2026-10-24"),
          ],
        },
        {
          label: "Nov 2026",
          weekends: [
            weekend("w-nov-1", "Nov 7–8", "2026-11-07"),
            weekend("w-nov-2", "Nov 21–22", "2026-11-21"),
          ],
        },
        {
          label: "Dec 2026",
          weekends: [
            weekend("w-dec-1", "Dec 5–6", "2026-12-05"),
            weekend("w-dec-2", "Dec 19–20", "2026-12-19"),
          ],
        },
      ],
    }
  }

  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState
  const chooseAll = (w: PlanWorld, sessionIds: string[]) =>
    sessionIds.reduce((acc, id) => withWeekendChosen(acc, id, true), w)
  /** Every weekend of a state, flat, so a test can ask about the ones it did
   *  not choose as easily as the ones it did. */
  const flat = (s: PlannerState) => s.windows.flatMap((win) => win.weekends)

  it("is usable the moment weekends are chosen, with no gym time on them", () => {
    const chosen = chooseAll(fresh(), ["w-oct-1", "w-nov-2", "w-dec-1"])
    const state = stateOf(chosen)
    // The premise: the weekends really are bare. Wave B's ruling, not an oversight.
    expect(
      flat(state)
        .filter((w) => w.chosen)
        .every((w) => w.venues.length === 0 && w.capacityGames === 0)
    ).toBe(true)
    expect(worldReadiness(state)).toEqual({ usable: true, gap: null })
  })

  it("names the missing half when there is one, and never both at once", () => {
    // Nothing chosen: the plan has its gyms and no dates to run them on.
    expect(worldReadiness(stateOf(fresh()))).toEqual({ usable: false, gap: "weekends" })
    /**
     * RE-PINNED 2026-08-06: a league with no building of its OWN can still draw
     * a calendar. The draw books its pool gyms as assumed, so a plan with pool
     * gyms and a chosen weekend is usable; "gym" is now about having no gym at
     * all, and a gym somebody left shut is still a gym.
     */
    const homeless = { ...fresh(), gyms: [POOL] }
    expect(worldReadiness(stateOf(chooseAll(homeless, ["w-oct-1"])))).toEqual({
      usable: true,
      gap: null,
    })
    const shut = withGymHours(fresh(), "v-home", "09:00", "09:00")
    expect(worldReadiness(stateOf(chooseAll(shut, ["w-oct-1"])))).toEqual({
      usable: true,
      gap: null,
    })
    // No gyms at all, and no weekend either: a season nobody has set up.
    const bare = { ...fresh(), gyms: [] }
    expect(worldReadiness(stateOf(bare))).toEqual({ usable: false, gap: "both" })
    // Weekends chosen and still no building anywhere to put them in.
    expect(worldReadiness(stateOf(chooseAll(bare, ["w-oct-1"])))).toEqual({
      usable: false,
      gap: "gym",
    })
    expect(worldReadiness(null)).toEqual({ usable: false, gap: "both" })
  })

  it("puts the home gym on every chosen weekend of the solve, at its usable capacity", () => {
    const state = stateOf(chooseAll(fresh(), ["w-oct-1", "w-nov-2", "w-dec-1"]))
    const runs = solvableState(state)
    expect(flat(runs).map((w) => w.sessionId)).toEqual(["w-oct-1", "w-nov-2", "w-dec-1"])
    for (const w of flat(runs)) {
      // RE-PINNED 2026-08-06: the whole roster is on the table, home FIRST. The
      // objective is what decides which of them get booked, not availability.
      expect(w.venues.map((v) => v.venueId)).toEqual(["v-home", "v-pool"])
      expect(w.venues[0].role).toBe("home")
      // 3 × 2 × 12 at the home gym, plus 6 × 2 × 12 at the pool gym.
      expect(w.capacityGames).toBe(72 + 144)
    }
    expect(homeGymOf(state)?.venueId).toBe("v-home")
    expect(homeGymCapacity(state)).toBe(72)
    // The buffer is honoured, because it is the same arithmetic.
    expect(homeGymCapacity(stateOf(withCourtBuffer(fresh(), 1)))).toBe(48)
  })

  it("draws games onto the chosen weekends and nowhere else", () => {
    const chosenIds = ["w-oct-1", "w-nov-2", "w-dec-1"]
    const state = stateOf(chooseAll(fresh(), chosenIds))
    const runs = solvableState(state)
    const assignment = proposePlan(runs, "balance")
    const played = Object.entries(assignment)
      .filter(([, keys]) => keys.length > 0)
      .map(([sessionId]) => sessionId)
      .sort()
    expect(played).toEqual([...chosenIds].sort())
    // Every grade plays every month, which is the whole point of choosing three.
    for (const id of chosenIds) expect(assignment[id]).toEqual(["age:Grade 7", "age:Grade 8"])
    // And the packer puts them in the building the solve was given.
    const venues = packPlanVenues(runs, assignment)
    for (const id of chosenIds) {
      expect(venues[id]).toEqual({ "age:Grade 7": "v-home", "age:Grade 8": "v-home" })
    }
    // The draw records the buildings it used, so the board can draw them. The
    // home gym holds this world on its own, so nothing is assumed.
    const drawn = drawnGyms(state, assignment, venues)
    expect(drawn.added).toEqual({
      "w-oct-1": ["v-home"],
      "w-nov-2": ["v-home"],
      "w-dec-1": ["v-home"],
    })
    expect(drawn.assumed).toEqual([])
  })

  /**
   * THE MONTH FALLBACK IS DEAD. It used to be that a chosen-but-bare weekend was
   * dropped from the solve, so the month it was in went with it and the solver
   * defaulted that month's grades onto whichever structural session it could
   * find. One chosen weekend in October came back as games in five months, most
   * of them on Saturdays the plan never took and with zero capacity behind them.
   */
  it("kills the month fallback: one chosen weekend takes the games, and no other", () => {
    const state = stateOf(chooseAll(fresh(), ["w-nov-1"]))
    const runs = solvableState(state)
    // October and December have no chosen weekend, so those months are gone from
    // the solve whole. They are still on the BOARD, which is what the operator
    // needs to see, but nothing may be placed on them.
    expect(runs.windows.map((win) => win.label)).toEqual(["Nov 2026"])
    expect(flat(runs).map((w) => w.sessionId)).toEqual(["w-nov-1"])
    expect(flat(state)).toHaveLength(6)

    const assignment = proposePlan(runs, "balance")
    expect(Object.keys(assignment)).toEqual(["w-nov-1"])
    expect(assignment["w-nov-1"]).toEqual(["age:Grade 7", "age:Grade 8"])
    // Said the other way round, because this is the bug: not one game on a
    // weekend this plan did not choose.
    const unchosen = flat(state)
      .filter((w) => !w.chosen)
      .map((w) => w.sessionId)
    for (const id of unchosen) expect(assignment[id] ?? []).toEqual([])
    expect(drawnGyms(state, assignment, packPlanVenues(runs, assignment)).added).toEqual({
      "w-nov-1": ["v-home"],
    })
  })

  it("records the home gym only where the draw really put games", () => {
    const state = stateOf(chooseAll(fresh(), ["w-oct-1", "w-oct-2"]))
    // One month, two chosen weekends: compact-first puts both grades on one of
    // them, so the other is a weekend the league chose and did not need.
    const runs = solvableState(state)
    const assignment = proposePlan(runs, "balance")
    const used = Object.entries(assignment).filter(([, keys]) => keys.length > 0)
    expect(used).toHaveLength(1)
    const venues = packPlanVenues(runs, assignment)
    expect(drawnGyms(state, assignment, venues).added).toEqual({ [used[0][0]]: ["v-home"] })
    // A building on a date nobody plays on is a booking the league never made.
    expect(Object.keys(drawnGyms(state, {}, {}).added)).toEqual([])
  })

  it("leaves a weekend that already has its own gyms alone", () => {
    // The Saturday the operator placed a pool gym on by hand keeps it, and the
    // home gym is not pushed in beside it.
    const painted = withGymOnWeekend(chooseAll(fresh(), ["w-oct-1"]), "w-oct-1", "v-pool", true)
    const runs = solvableState(stateOf(painted))
    // The pool gym it already has stays first; the home gym joins it as a room
    // the draw MAY book, which is the 2026-08-06 availability ruling.
    expect(flat(runs)[0].venues.map((v) => v.venueId)).toEqual(["v-home", "v-pool"])
    // Nothing was placed in the home gym, so nothing is recorded for it.
    expect(
      drawnGyms(stateOf(painted), { "w-oct-1": ["age:Grade 7"] }, {
        "w-oct-1": { "age:Grade 7": "v-pool" },
      }).added
    ).toEqual({})
  })

  it("reads the season's own board the way it always did", () => {
    // The season's state carries no `chosen` at all: every weekend it has is a
    // weekend it runs, and the ones with gym time on them are the solvable ones.
    const seasonBoard: PlannerState = {
      ...stateOf(fresh()),
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            { ...flat(stateOf(world()))[0], chosen: undefined },
            { ...flat(stateOf(fresh()))[1], chosen: undefined },
          ],
        },
      ],
    }
    expect(seasonBoard.windows[0].weekends.map(weekendSolvable)).toEqual([true, false])
    const runs = solvableState(seasonBoard)
    expect(flat(runs).map((w) => w.sessionId)).toEqual(["w-oct"])
    // Nothing was synthesized onto the bare one: a season weekend nobody
    // attached a gym to is not a weekend anybody chose.
    expect(worldReadiness(seasonBoard)).toEqual({ usable: true, gap: null })
  })
})

/**
 * WHERE A GRADE COULD ACTUALLY GO (owner rulings 2026-08-05, #2 and #1).
 *
 * The contract the ⇄ affordance and every group move are guarded by:
 *
 *  - a destination is measured against what the BUILDING could hold, never
 *    against the courts this calendar happens to rent there. Rentals are
 *    demand-sized, so the old reading made every destination full after one move
 *    and the affordance vanished.
 *  - a pool gym this plan has not asked about is still a destination, marked
 *    `backup`, because taking it is the operator asserting they have it.
 *  - a court correction is a real ceiling, and a gym with no hours is no room.
 */
describe("where a grade could go on a weekend", () => {
  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState
  const oct = (s: PlannerState) => s.windows[0].weekends[0]

  it("measures the home gym as its own capacity less what is in it", () => {
    const state = stateOf(world())
    const rooms = weekendRooms(state, oct(state), { "v-home": 60 })
    const home = rooms.find((r) => r.venueId === "v-home") as BuildingRoom
    // 3 courts × 2 days × 12 games.
    expect(home.capacityGames).toBe(72)
    expect(home.usedGames).toBe(60)
    expect(home.freeGames).toBe(12)
    expect(home.backup).toBe(false)
  })

  it("reads an attached pool gym as the WHOLE building, not the courts we rent", () => {
    // Six Park attached with 2 of its 6 courts: 48 games attached, and a rental
    // that size is exactly what the old guard called full.
    const base = world()
    const octWeekend = base.windows[0].weekends[0]
    const rentedThin: PlanWorld = {
      ...base,
      windows: [
        {
          ...base.windows[0],
          weekends: [
            {
              ...octWeekend,
              venues: [
                ...octWeekend.venues,
                {
                  venueId: "v-pool",
                  name: "Six Park East",
                  capacityGames: 48,
                  role: "pool" as const,
                  fillOrder: 1,
                  courts: 2,
                  courtsHeld: 0,
                  courtDays: 4,
                  days: 2,
                  hoursPerCourtDay: 12,
                },
              ],
            },
            base.windows[0].weekends[1],
          ],
        },
      ],
    }
    const state = stateOf(rentedThin)
    const rooms = weekendRooms(state, oct(state), { "v-pool": 48 })
    const pool = rooms.find((r) => r.venueId === "v-pool") as BuildingRoom
    expect(pool.courts).toBe(6)
    // 24 games a court over the weekend × 6 courts.
    expect(pool.capacityGames).toBe(144)
    // Full on the rental, and still 96 games of room in the building.
    expect(pool.freeGames).toBe(96)
    expect(pool.backup).toBe(false)
  })

  it("offers a gym the plan has never asked about, and says it is a backup", () => {
    const state = stateOf(world())
    const rooms = weekendRooms(state, oct(state))
    const pool = rooms.find((r) => r.venueId === "v-pool") as BuildingRoom
    expect(pool.backup).toBe(true)
    // 6 courts × 2 days × 12 games at its own 08:00–20:00 hours.
    expect(pool.capacityGames).toBe(144)
    expect(pool.freeGames).toBe(144)
    // The gyms the plan HAS come first, so the ⇄ walks them before a backup.
    expect(rooms.map((r) => r.venueId)).toEqual(["v-home", "v-pool"])
  })

  it("honours a court correction as the ceiling, on an attached gym and a backup", () => {
    const state = stateOf(withGymEveryWeekend(world(), "v-pool", true))
    const attached = weekendRooms(state, oct(state), {}, { "w-oct|v-pool": 3 })
    expect((attached.find((r) => r.venueId === "v-pool") as BuildingRoom).courts).toBe(3)
    expect((attached.find((r) => r.venueId === "v-pool") as BuildingRoom).capacityGames).toBe(72)
    const backup = stateOf(world())
    const capped = weekendRooms(backup, oct(backup), {}, { "w-oct|v-pool": 1 })
    const pool = capped.find((r) => r.venueId === "v-pool") as BuildingRoom
    expect(pool.backup).toBe(true)
    expect(pool.capacityGames).toBe(24)
  })

  /**
   * RE-PINNED 2026-08-06 (the overriding ruling: availability is no longer a
   * restriction ANYWHERE). This used to leave a gym with no usable hours out of
   * the rooms entirely, on the grounds that it was a true impossibility. Hours
   * are availability, and availability stopped being a refusal: putting games
   * there IS the claim, for the full day and every court. So the gym is a room,
   * priced at the ordinary day.
   */
  it("offers a gym somebody left shut: hours are not a refusal any more", () => {
    const shut = withGymHours(world(), "v-pool", "10:00", "10:00")
    const state = stateOf(shut)
    const rooms = weekendRooms(state, oct(state))
    expect(rooms.map((r) => r.venueId)).toEqual(["v-home", "v-pool"])
    const pool = rooms.find((r) => r.venueId === "v-pool") as BuildingRoom
    // 6 courts × 2 days × 12 games on the default 09:00–21:00 day.
    expect(pool.capacityGames).toBe(144)
    expect(pool.backup).toBe(true)
  })

  it("leaves out only a building with no courts at all", () => {
    const none = withGymCourts(world(), "v-pool", 0)
    const state = stateOf(none)
    expect(weekendRooms(state, oct(state)).map((r) => r.venueId)).toEqual(["v-home"])
  })

  /**
   * NEW 2026-08-06: an hours EXCEPTION on one date is a fact about this
   * calendar, not a ceiling on the building. A gym running a short Saturday is
   * still a room at its full day, because a move may claim the whole day.
   */
  it("prices an attached gym at its full day, not at the slice this date rents", () => {
    const short = withWeekendGymHours(
      withGymEveryWeekend(world(), "v-pool", true),
      "w-oct",
      "v-pool",
      { startTime: "09:00", endTime: "12:00" }
    )
    const state = stateOf(short)
    // The weekend really does run three hours there...
    const attached = oct(state).venues.find((v) => v.venueId === "v-pool")
    expect(attached?.capacityGames).toBe(36)
    // ...and the ROOM is still the whole building: 6 courts × 2 days × 12.
    const pool = weekendRooms(state, oct(state)).find(
      (r) => r.venueId === "v-pool"
    ) as BuildingRoom
    expect(pool.capacityGames).toBe(144)
  })
})

describe("a backup gym the operator asserted", () => {
  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState

  it("puts the gym on the weekend the board is computing on, and moves capacity with it", () => {
    const state = stateOf(world())
    const next = withAssertedGyms(state, { "w-oct": ["v-pool"] })
    const oct = next.windows[0].weekends[0]
    expect(oct.venues.map((v) => v.venueId)).toEqual(["v-home", "v-pool"])
    // 72 the league owns plus 144 it has just said it can have.
    expect(oct.capacityGames).toBe(216)
    expect(oct.largestVenueCapacity).toBe(144)
    // The original is untouched: the board's world is derived, never mutated.
    expect(state.windows[0].weekends[0].venues).toHaveLength(1)
  })

  it("turns the weekend on, because a weekend with a gym is a weekend that runs", () => {
    const state = stateOf(world())
    const next = withAssertedGyms(state, { "w-nov": ["v-pool"] })
    const nov = next.windows[0].weekends[1]
    expect(nov.chosen).toBe(true)
    expect(nov.venues.map((v) => v.venueId)).toEqual(["v-pool"])
    expect(nov.capacityGames).toBe(144)
  })

  it("costs nothing and changes nothing when there is nothing asserted", () => {
    const state = stateOf(world())
    expect(withAssertedGyms(state, {})).toBe(state)
    expect(withAssertedGyms(state, { "w-oct": [] })).toBe(state)
    // A gym this plan does not have at all, and a gym already on the weekend.
    expect(withAssertedGyms(state, { "w-oct": ["v-nobody"] })).toBe(state)
    expect(withAssertedGyms(state, { "w-oct": ["v-home"] })).toBe(state)
  })

  it("is written into the plan's own world when the plan is saved", () => {
    const next = withAssertedGymsInWorld(world(), { "w-oct": ["v-pool"], "w-nov": ["v-pool"] })
    const oct = weekendOf(next, "w-oct") as NonNullable<ReturnType<typeof weekendOf>>
    const nov = weekendOf(next, "w-nov") as NonNullable<ReturnType<typeof weekendOf>>
    expect((oct.venues ?? []).map((v) => v.venueId).sort()).toEqual(["v-home", "v-pool"])
    expect(oct.capacityGames).toBe(216)
    // The weekend the plan was not running is running now, with that gym on it.
    expect(nov.chosen).toBe(true)
    expect((nov.venues ?? []).map((v) => v.venueId)).toEqual(["v-pool"])
    // And the board reads the saved world exactly the way it read the assertion.
    const saved = planStateFrom("s1", {
      settings: { capturedAt: "x", state: next },
    }) as PlannerState
    expect(saved.windows[0].weekends[0].capacityGames).toBe(216)
  })

  /**
   * PLACING A BUILDING IS NOT A BOOKING (owner ruling 2026-08-06, #2). A gym
   * dropped on a date with nothing on it is availability the operator asserted,
   * and availability is free: nobody phones a gym to say "we may need you". The
   * bill starts when games land in it.
   */
  it("costs nothing until games land in it", () => {
    const state = stateOf(world())
    const placed = withAssertedGyms(state, { "w-nov": ["v-pool"] })
    // The weekend runs and the gym is on it...
    expect(placed.windows[0].weekends[1].venues.map((v) => v.venueId)).toEqual(["v-pool"])
    // ...and the calendar rents nothing, because nothing plays there.
    const empty = planRentalBlocks(placed, { "w-nov": [] })
    expect(empty).toEqual([])
    expect(rentalAsk(placed, empty).season).toEqual({
      courtDays: 0,
      courtHours: 0,
      gamesUnhoused: 0,
    })
    // One grade into it, and the same gym on the same date is a rental.
    const filled = planRentalBlocks(
      placed,
      { "w-nov": ["age:Grade 7"] },
      { "w-nov": { "age:Grade 7": "v-pool" } }
    )
    expect(filled).toHaveLength(1)
    expect(filled[0].venueId).toBe("v-pool")
    expect(filled[0].courts).toBeGreaterThan(0)
    expect(rentalAsk(placed, filled).season.courtDays).toBeGreaterThan(0)
  })
})

/**
 * THIS GYM, THIS DATE, THESE HOURS (owner ruling 2026-08-06, #5). The per-date
 * editor's own arithmetic: one gym on one weekend moves, and every capacity
 * downstream of it moves with it. Nothing else in the season is touched.
 */
describe("a gym's hours on one date", () => {
  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState

  it("costs nothing and changes nothing when nobody has edited any", () => {
    const state = stateOf(world())
    expect(withWeekendHours(state, {})).toBe(state)
    // A gym that is not on that weekend has no hours to change.
    expect(
      withWeekendHours(state, { "w-oct|v-pool": { startTime: "09:00", endTime: "12:00" } })
    ).toBe(state)
  })

  it("re-derives capacity from the new window, at the courts that gym gives", () => {
    const state = stateOf(world())
    const next = withWeekendHours(state, {
      "w-oct|v-home": { startTime: "12:00", endTime: "18:00" },
    })
    const home = next.windows[0].weekends[0].venues[0]
    expect(home.startTime).toBe("12:00")
    expect(home.endTime).toBe("18:00")
    // 3 courts × 2 days × 6 games, where the full day held 12 each.
    expect(home.capacityGames).toBe(36)
    expect(home.hoursPerCourtDay).toBe(6)
    expect(next.windows[0].weekends[0].capacityGames).toBe(36)
    // The state it came from is untouched: the board's world is derived.
    expect(state.windows[0].weekends[0].capacityGames).toBe(72)
  })

  it("moves the one date and nothing else", () => {
    const both = withGymEveryWeekend(withWeekendChosen(world(), "w-nov", true), "v-home", true)
    const state = stateOf(both)
    const next = withWeekendHours(state, {
      "w-oct|v-home": { startTime: "09:00", endTime: "10:00" },
    })
    expect(next.windows[0].weekends[0].capacityGames).toBe(6)
    expect(next.windows[0].weekends[1].capacityGames).toBe(
      state.windows[0].weekends[1].capacityGames
    )
  })

  it("reads back the hours the editor should open on", () => {
    const state = stateOf(world())
    // No exception: the gym's own season range.
    expect(weekendGymHours(state, state.windows[0].weekends[0], "v-home")).toEqual({
      startTime: "09:00",
      endTime: "21:00",
    })
    const next = withWeekendHours(state, {
      "w-oct|v-home": { startTime: "13:00", endTime: "17:00" },
    })
    expect(weekendGymHours(next, next.windows[0].weekends[0], "v-home")).toEqual({
      startTime: "13:00",
      endTime: "17:00",
    })
  })

  it("is written into the plan's own world when the plan is saved", () => {
    const saved = withWeekendHoursInWorld(world(), {
      "w-oct|v-home": { startTime: "12:00", endTime: "18:00" },
    })
    const oct = weekendOf(saved, "w-oct") as NonNullable<ReturnType<typeof weekendOf>>
    expect((oct.venues ?? [])[0].startTime).toBe("12:00")
    expect(oct.capacityGames).toBe(36)
    // And the board reads the saved world exactly the way it read the edit.
    const state = planStateFrom("s1", {
      settings: { capturedAt: "x", state: saved },
    }) as PlannerState
    expect(state.windows[0].weekends[0].capacityGames).toBe(36)
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

/**
 * THE BOARD SHOWS THE WHOLE SEASON (owner ruling 2026-08-06, slice B2). Every
 * Saturday the season spans has a place in its month column: the dates this plan
 * uses as cards, the ones it does not as ghosts. Two sources have to agree about
 * which dates exist — the plan's own weekends, and step 2's grid of every
 * Saturday in the span — and these are the contracts that keep them agreeing.
 */
describe("the whole season, month by month", () => {
  const boardState = () =>
    planStateFrom("s1", {
      settings: { capturedAt: "x", state: world() },
      assignment: {},
      venues: {},
    }) as PlannerState

  /** Step 2's grid columns, in the shape the board reads them. */
  const saturdays = [
    { satDateISO: "2026-10-24", sessionId: "w-oct", label: "Oct 24–25" },
    { satDateISO: "2026-11-07", sessionId: "w-nov", label: "Nov 7–8" },
    { satDateISO: "2026-11-21", sessionId: null, label: "Nov 21–22" },
  ]

  it("draws a used date as a card and an unused one as a ghost", () => {
    const columns = boardColumns(boardState(), [])
    expect(columns).toHaveLength(1)
    expect(columns[0].dates.map((d) => d.kind)).toEqual(["weekend", "ghost"])
    const ghost = columns[0].dates[1]
    expect(ghost.kind === "ghost" && ghost.ghost.sessionId).toBe("w-nov")
    expect(ghost.kind === "ghost" && ghost.ghost.label).toBe("Nov 7–8")
  })

  it("keeps a date the operator has put something on as a card", () => {
    // Nothing about the world changed: the working copy has a grade on it, and
    // that alone is what makes it a card again.
    const columns = boardColumns(boardState(), [], (sessionId) => sessionId === "w-nov")
    expect(columns[0].dates.map((d) => d.kind)).toEqual(["weekend", "weekend"])
  })

  it("adds the Saturdays the season has no session for, in date order", () => {
    const columns = boardColumns(boardState(), saturdays)
    // Oct 24 is a card, Nov 7 and the session-less Nov 21 are ghosts, in order.
    expect(columns[0].dates.map((d) => d.dateISO)).toEqual([
      "2026-10-24",
      "2026-11-07",
      "2026-11-21",
    ])
    const grown = columns[0].dates[2]
    // No session behind it: the first drop is what creates one.
    expect(grown.kind === "ghost" && grown.ghost.sessionId).toBeNull()
  })

  it("gives a month with nothing but ghosts its own column, in its place", () => {
    const columns = boardColumns(boardState(), [
      { satDateISO: "2026-09-12", sessionId: null, label: "Sep 12–13" },
      ...saturdays,
      { satDateISO: "2026-12-05", sessionId: null, label: "Dec 5–6" },
    ])
    expect(columns.map((c) => c.label)).toEqual(["Sep 2026", "Oct 2026", "Dec 2026"])
    // A ghost month holds no weekends, so nothing may be counted off it.
    expect(columns[0].weekends).toEqual([])
    expect(columns[0].dates).toHaveLength(1)
  })

  it("never draws the same Saturday twice, whichever source it came from", () => {
    const columns = boardColumns(boardState(), [
      // The grid spells its dates as full ISO timestamps; the plan does not.
      { satDateISO: "2026-10-24T00:00:00.000Z", sessionId: "w-oct", label: "Oct 24–25" },
      ...saturdays,
    ])
    expect(columns[0].dates.map((d) => d.dateISO)).toEqual([
      "2026-10-24",
      "2026-11-07",
      "2026-11-21",
    ])
  })

  it("spells a month column the way a planner window spells it", () => {
    expect(monthColumnLabel("2026-10-24")).toBe("Oct 2026")
    expect(monthColumnLabel("2027-01-02T00:00:00.000Z")).toBe("Jan 2027")
  })

  it("is a ghost only when the plan did not choose it and nothing is on it", () => {
    const bare = { sessionId: "w", chosen: false, venues: [], assigned: [] }
    expect(isGhostWeekend(bare)).toBe(true)
    // Chosen but empty keeps its card: the operator said this plan runs it.
    expect(isGhostWeekend({ ...bare, chosen: true })).toBe(false)
    expect(isGhostWeekend({ ...bare, assigned: ["age:Grade 7"] })).toBe(false)
    expect(isGhostWeekend(bare, () => true)).toBe(false)
    // A snapshot that never carried the question reads it the one way this
    // module always has: a weekend with a gym on it was a weekend that ran.
    expect(isGhostWeekend({ ...bare, chosen: undefined })).toBe(true)
    expect(
      isGhostWeekend({
        ...bare,
        chosen: undefined,
        venues: [{ venueId: "v", name: "A gym", capacityGames: 10, role: "home", fillOrder: 0 }],
      })
    ).toBe(false)
  })
})

/**
 * DROPPING ON A GHOST (owner ruling 2026-08-06, slice B2). A date with no gym on
 * it is a real destination, because what a drop MAY assert is what counts, and
 * the season can grow a weekend the moment somebody drops on one it never had.
 */
describe("a date the plan was not using", () => {
  const boardState = () =>
    planStateFrom("s1", {
      settings: { capturedAt: "x", state: world() },
      assignment: {},
      venues: {},
    }) as PlannerState

  it("is measured against every gym in the roster, as a backup each", () => {
    const rooms = weekendRooms(boardState(), bareWeekend("nothing-here"))
    expect(rooms.map((r) => r.venueId).sort()).toEqual(["v-home", "v-pool"])
    // Nothing is attached, so taking any of them is the operator asserting it.
    expect(rooms.every((r) => r.backup)).toBe(true)
    expect(rooms.every((r) => r.freeGames > 0)).toBe(true)
  })

  it("takes a new weekend into the month it belongs to, in date order", () => {
    const next = withWeekendInState(boardState(), "Oct 2026", {
      sessionId: "w-new",
      label: "Nov 21–22",
      dateISO: "2026-11-21",
      dayCount: 2,
    })
    expect(next.windows[0].weekends.map((w) => w.sessionId)).toEqual([
      "w-oct",
      "w-nov",
      "w-new",
    ])
    const grown = next.windows[0].weekends[2]
    // The date exists; nobody has claimed a building on it.
    expect(grown.venues).toEqual([])
    expect(grown.chosen).toBe(false)
    expect(grown.capacityGames).toBe(0)
    // And it runs at the month's own rate, so a grade brings the same games here.
    expect(grown.targetGamesPerTeam).toBe(2)
  })

  it("opens a month the plan had no weekend in at all", () => {
    const next = withWeekendInState(boardState(), "Dec 2026", {
      sessionId: "w-dec",
      label: "Dec 5–6",
      dateISO: "2026-12-05",
    })
    expect(next.windows.map((w) => w.label)).toEqual(["Oct 2026", "Dec 2026"])
    expect(next.windows[1].weekends.map((w) => w.sessionId)).toEqual(["w-dec"])
  })

  it("hands the same state back when the weekend is already on it", () => {
    const state = boardState()
    expect(
      withWeekendInState(state, "Oct 2026", {
        sessionId: "w-nov",
        label: "Nov 7–8",
        dateISO: "2026-11-07",
      })
    ).toBe(state)
  })
})

/**
 * THE MARCH FENCE (owner ruling 2026-08-06).
 *
 * A league's last month is usually not league games at all: playoffs are drawn
 * from standings that do not exist until the regular season ends. A plan that
 * keeps asking the solver to fill March is permanently short of gym time it
 * never needed, and permanently owing grades sessions nobody will schedule.
 *
 * So a month can be fenced, per plan, and a fenced month is out of the solve
 * entirely while staying on the board as its own band.
 */
describe("a month fenced as playoffs", () => {
  /** Oct and Nov chosen with the home gym on them, plus a bare-chosen March. */
  function threeMonths(): PlanWorld {
    const weekend = (sessionId: string, label: string, dateISO: string) => ({
      sessionId,
      label,
      dateISO,
      dayCount: 2,
      chosen: true,
      targetGamesPerTeam: 2,
      capacityGames: 0,
      largestVenueCapacity: 0,
      venues: [],
    })
    return {
      seasonId: "s1",
      gameSlotMinutes: 60,
      courtBuffer: 0,
      gamesPerTeam: 10,
      gyms: [HOME, POOL],
      units: [
        { key: "age:Grade 7", label: "Grade 7", divisionIds: ["d7"], teams: 10, included: true },
      ],
      windows: [
        { label: "Oct 2026", weekends: [weekend("w-oct", "Oct 24–25", "2026-10-24")] },
        { label: "Nov 2026", weekends: [weekend("w-nov", "Nov 21–22", "2026-11-21")] },
        { label: "Mar 2027", weekends: [weekend("w-mar", "Mar 6–7", "2027-03-06")] },
      ],
    }
  }
  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState

  it("is absent by default: the owner fences his own March", () => {
    const world = threeMonths()
    expect(world.windows.every((win) => !windowFenced(win))).toBe(true)
    expect(fencedWindowLabels(world).size).toBe(0)
    // Every month is in the solve until somebody says otherwise.
    expect(solvableState(stateOf(world)).windows.map((w) => w.label)).toEqual([
      "Oct 2026",
      "Nov 2026",
      "Mar 2027",
    ])
  })

  it("drops the fenced month whole, and leaves the rest of the season alone", () => {
    const fenced = withWindowPhase(threeMonths(), "Mar 2027", "playoffs")
    expect(fencedWindowLabels(fenced)).toEqual(new Set(["Mar 2027"]))
    const state = stateOf(fenced)
    // Still on the board: the league DOES play that month.
    expect(state.windows.map((w) => w.label)).toEqual(["Oct 2026", "Nov 2026", "Mar 2027"])
    expect(state.windows[2].phase).toBe("playoffs")
    // Not in the solve, and no grade is owed a session there.
    const runs = solvableState(state)
    expect(runs.windows.map((w) => w.label)).toEqual(["Oct 2026", "Nov 2026"])
    const assignment = proposePlan(runs, "balance")
    expect(Object.keys(assignment).sort()).toEqual(["w-nov", "w-oct"])
    expect(assignment["w-mar"] ?? []).toEqual([])
    // And the draw never books the home gym there, which would be a rental for
    // games nobody is going to schedule.
    expect(drawnGyms(state, assignment, packPlanVenues(runs, assignment)).added).toEqual({
      "w-oct": ["v-home"],
      "w-nov": ["v-home"],
    })
  })

  it("drops a fenced month even when it has real gym time on it", () => {
    // Fencing March AFTER a gym was attached still takes it out of the solve:
    // what the month is FOR outranks what it happens to have booked.
    const withGym = withGymOnWeekend(threeMonths(), "w-mar", "v-home", true)
    expect(stateOf(withGym).windows[2].weekends[0].capacityGames).toBeGreaterThan(0)
    const fenced = withWindowPhase(withGym, "Mar 2027", "playoffs")
    // The fence clears the month: a month that is not league games is not
    // holding a league booking either.
    expect(stateOf(fenced).windows[2].weekends[0].venues).toEqual([])
    expect(solvableState(stateOf(fenced)).windows.map((w) => w.label)).toEqual([
      "Oct 2026",
      "Nov 2026",
    ])
  })

  it("hands the month back with the same control", () => {
    const fenced = withWindowPhase(threeMonths(), "Mar 2027", "playoffs")
    const back = withWindowPhase(fenced, "Mar 2027", "regular")
    expect(fencedWindowLabels(back).size).toBe(0)
    // The weekends come back unchosen, because fencing let them go: choosing
    // them again is the operator's call, not something a toggle guesses at.
    expect(solvableState(stateOf(back)).windows.map((w) => w.label)).toEqual([
      "Oct 2026",
      "Nov 2026",
    ])
  })

  it("is not a world to draw in when the fence is all that is left", () => {
    const only = {
      ...threeMonths(),
      windows: threeMonths().windows.filter((win) => win.label === "Mar 2027"),
    }
    expect(worldReadiness(stateOf(only))).toEqual({ usable: true, gap: null })
    const fenced = withWindowPhase(only, "Mar 2027", "playoffs")
    // Every weekend this plan chose is inside the fence, so there is nothing to
    // draw and the hero says which step fixes it.
    expect(worldReadiness(stateOf(fenced))).toEqual({ usable: false, gap: "weekends" })
  })

  it("gives the board a column that says it is a band, not a row of dates", () => {
    const fenced = withWindowPhase(threeMonths(), "Mar 2027", "playoffs")
    const columns = boardColumns(stateOf(fenced), [])
    expect(columns.map((c) => c.fenced)).toEqual([false, false, true])
    expect(columns[2].label).toBe("Mar 2027")
  })

  it("round-trips through a saved world", () => {
    const fenced = withWindowPhase(threeMonths(), "Mar 2027", "playoffs")
    const saved = worldFromState(stateOf(fenced))
    expect(fencedWindowLabels(saved)).toEqual(new Set(["Mar 2027"]))
  })

  /**
   * The board holds the fence in its working copy and the SAVE writes it into
   * the plan's world, the same way an asserted gym works. Both halves have to
   * agree, or the month would come back unfenced the moment the plan reopened.
   */
  it("moves the board the instant it is pressed, and the save writes the same thing", () => {
    const state = stateOf(threeMonths())
    const onBoard = withWindowPhases(state, { "Mar 2027": "playoffs" })
    expect(onBoard.windows[2].phase).toBe("playoffs")
    expect(onBoard.windows[2].weekends[0].capacityGames).toBe(0)
    expect(solvableState(onBoard).windows.map((w) => w.label)).toEqual(["Oct 2026", "Nov 2026"])
    // Untouched months keep their own objects, and a board with no fence on it
    // is handed straight back.
    expect(onBoard.windows[0]).toBe(state.windows[0])
    expect(withWindowPhases(state, {})).toBe(state)
    expect(withWindowPhases(state, { "Mar 2027": "regular" })).toBe(state)
    // A month this world has never heard of is not a reason to rebuild it.
    expect(withWindowPhases(state, { "Jul 2027": "playoffs" })).toBe(state)

    const saved = withWindowPhasesInWorld(threeMonths(), { "Mar 2027": "playoffs" })
    expect(fencedWindowLabels(saved)).toEqual(new Set(["Mar 2027"]))
    expect(solvableState(stateOf(saved)).windows.map((w) => w.label)).toEqual([
      "Oct 2026",
      "Nov 2026",
    ])
  })
})

/**
 * AVAILABILITY IS NO LONGER A RESTRICTION ANYWHERE (owner ruling 2026-08-06,
 * the overriding one).
 *
 * The only thing that can stop a placement is the games already in that building
 * that weekend. Placing or moving IS the availability claim, for the whole day
 * and every court. These pin the two halves: what a room is worth now, and what
 * the draw is allowed to book.
 */
describe("availability is not a restriction", () => {
  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState
  const oct = (s: PlannerState) => s.windows[0].weekends[0]

  it("prices every roster gym at its whole building, attached or not", () => {
    const state = stateOf(world())
    const rooms = weekendRooms(state, oct(state))
    // The home gym is attached, the pool gym has never been asked about, and
    // they are priced the same way: courts × days × the full day.
    expect(rooms.map((r) => [r.venueId, r.capacityGames])).toEqual([
      ["v-home", 72],
      ["v-pool", 144],
    ])
    // Only the second is a claim nobody has made yet, and the row says so.
    expect(rooms.map((r) => r.backup)).toEqual([false, true])
  })

  it("counts only the games already there against a room", () => {
    const state = stateOf(world())
    const rooms = weekendRooms(state, oct(state), { "v-pool": 100 })
    const pool = rooms.find((r) => r.venueId === "v-pool") as BuildingRoom
    expect(pool.usedGames).toBe(100)
    expect(pool.freeGames).toBe(44)
    // The one honest refusal: what is in it, not whether anybody phoned it.
    const full = weekendRooms(state, oct(state), { "v-pool": 144 })
    expect((full.find((r) => r.venueId === "v-pool") as BuildingRoom).freeGames).toBe(0)
  })

  it("lets the draw book a pool gym as assumed when the home gym runs out", () => {
    // 40 teams at 2 games each is 40 games; the home gym holds 72, so nothing
    // is rented. Push it past that and the pool gym gets booked.
    const big = withUnitTeams(world(), "age:Grade 7", 100)
    const state = stateOf(big)
    const runs = solvableState(state)
    const assignment = proposePlan(runs, "balance")
    const venues = packPlanVenues(runs, assignment)
    const drawn = drawnGyms(state, assignment, venues)
    expect(Object.values(venues["w-oct"] ?? {})).toContain("v-pool")
    // The home gym is never "assumed": nobody phones their own building.
    expect(drawn.assumed).toEqual([{ sessionId: "w-oct", venueId: "v-pool" }])
    expect(drawn.added["w-oct"]).toEqual(["v-pool"])
  })
})

/**
 * THE ORDER THE LEAGUE RENTS IN (owner ruling 2026-08-06, after he watched a
 * draw book Haber for no reason he could name).
 *
 * The solver used to break equal bookings on the gym's NAME, so "Haber" beat
 * "Six Park" every time regardless of what the league wanted. Rank replaces
 * that: the home gym first, then the pool in the order the operator arranged.
 * It is a preference and never a gate — occupancy is the only gate — and it must
 * never buy a worse booking.
 */
describe("the order the league rents in", () => {
  const HABER: PlanWorldGym = {
    venueId: "v-haber",
    name: "Haber Recreation Centre",
    role: "pool",
    courts: 6,
    openTime: "08:00",
    closeTime: "20:00",
  }
  /** Home, then two pool gyms of IDENTICAL capacity: the owner's own case, where
   *  nothing but the order can decide. */
  function twoPool(): PlanWorld {
    return { ...world(), gyms: [HOME, HABER, { ...POOL, courts: 6 }] }
  }
  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState

  it("ranks the home gym first and the pool in its stored order", () => {
    expect([...gymRanks(twoPool().gyms as PlanWorldGym[]).entries()]).toEqual([
      ["v-home", 0],
      ["v-haber", 1],
      ["v-pool", 2],
    ])
    // Home is never in the ordering: it is first because the league owns it.
    const flipped = { ...twoPool(), gyms: [HABER, { ...POOL, courts: 6 }, HOME] }
    expect(gymRanks(flipped.gyms as PlanWorldGym[]).get("v-home")).toBe(0)
  })

  it("moves a gym up and down the list, and stops at the ends", () => {
    const up = withGymOrder(twoPool(), "v-pool", "up")
    expect(worldGyms(up).map((g) => g.venueId)).toEqual(["v-home", "v-pool", "v-haber"])
    // Already top of the pool: nothing to do, and the same object comes back.
    expect(withGymOrder(up, "v-pool", "up")).toBe(up)
    const down = withGymOrder(up, "v-pool", "down")
    expect(worldGyms(down).map((g) => g.venueId)).toEqual(["v-home", "v-haber", "v-pool"])
    expect(withGymOrder(down, "v-pool", "down")).toBe(down)
    // An absolute seat works too, and the home gym is never displaced.
    expect(worldGyms(withGymOrder(down, "v-pool", 0)).map((g) => g.venueId)).toEqual([
      "v-home",
      "v-pool",
      "v-haber",
    ])
    // A gym this plan does not have is not a move.
    expect(withGymOrder(down, "v-nope", "up")).toBe(down)
  })

  /** THE OWNER'S CASE, pinned both ways round. */
  it("breaks an equal booking on rank, not on the gym's name", () => {
    // 100 teams is 100 games; the home gym holds 72, so exactly one pool gym
    // gets booked and the two of them are worth precisely the same.
    const big = (w: PlanWorld) => withUnitTeams(w, "age:Grade 7", 100)
    const bookedIn = (w: PlanWorld) => {
      const state = stateOf(big(w))
      const runs = solvableState(state)
      const assignment = proposePlan(runs, "balance")
      const venues = packPlanVenues(runs, assignment)
      return drawnGyms(state, assignment, venues).assumed.map((a) => a.venueId)
    }
    // Six Park ranked above Haber: Six Park takes the booking, even though
    // "Haber" sorts first alphabetically.
    expect(bookedIn(withGymOrder(twoPool(), "v-pool", "up"))).toEqual(["v-pool"])
    // And the other way round, so this is the order and not a coincidence.
    expect(bookedIn(twoPool())).toEqual(["v-haber"])
  })

  it("never buys a worse booking for the sake of rank", () => {
    // Six Park is ranked FIRST but holds almost nothing; Haber can take the
    // whole spill in one booking. Money outranks preference, so Haber wins.
    const small = { ...POOL, courts: 1 }
    const w: PlanWorld = { ...world(), gyms: [HOME, small, HABER] }
    const state = stateOf(withUnitTeams(w, "age:Grade 7", 100))
    const runs = solvableState(state)
    const assignment = proposePlan(runs, "balance")
    const venues = packPlanVenues(runs, assignment)
    const booked = new Set(Object.values(venues["w-oct"] ?? {}))
    expect(booked.has("v-haber")).toBe(true)
  })

  it("survives a save and a reopen", () => {
    const ordered = withGymOrder(twoPool(), "v-pool", "up")
    const saved = worldFromState(stateOf(ordered))
    expect(worldGyms(saved).map((g) => g.venueId)).toEqual(["v-home", "v-pool", "v-haber"])
    // And the rank reaches the rows the solver reads.
    const reopened = stateOf(saved)
    expect(reopened.windows[0].weekends[0].venues[0].rank).toBe(0)
  })
})

/**
 * CONFIRMED BOOKINGS ARE OBLIGATIONS (owner ruling 2026-08-06).
 *
 * A weekend the league has already booked is money out of the door whether
 * anybody plays in it or not. So the solve fills what is paid for BEFORE it
 * assumes anything new, and no lever — spread included — may walk away from a
 * booking to use a Saturday the league has not booked.
 */
describe("confirmed bookings are obligations", () => {
  const HABER: PlanWorldGym = {
    venueId: "v-haber",
    name: "Haber Recreation Centre",
    role: "pool",
    courts: 6,
    openTime: "08:00",
    closeTime: "20:00",
  }
  /**
   * Two weekends in one month, both chosen. Six Park is BOOKED on the second
   * one and nowhere else; Haber is in the roster and booked nowhere at all.
   */
  function booked(): PlanWorld {
    const base: PlanWorld = {
      ...world(),
      gyms: [HOME, { ...POOL, courts: 6 }, HABER],
      units: [
        { key: "age:Grade 7", label: "Grade 7", divisionIds: ["d7"], teams: 100, included: true },
      ],
    }
    // Both weekends run; the second carries the confirmed Six Park booking.
    return withGymOnWeekend(withWeekendChosen(base, "w-nov", true), "w-nov", "v-pool", true)
  }
  const stateOf = (w: PlanWorld) =>
    planStateFrom("s1", { settings: { capturedAt: "x", state: w } }) as PlannerState
  const drawWith = (w: PlanWorld, lever: "balance" | "spread") => {
    const state = stateOf(w)
    const runs = solvableState(state)
    const assignment = proposePlan(runs, lever)
    const venues = packPlanVenues(runs, assignment)
    return { state, assignment, venues, drawn: drawnGyms(state, assignment, venues) }
  }

  it("marks what the plan holds as booked, and what the draw may take as not", () => {
    const runs = solvableState(stateOf(booked()))
    const nov = runs.windows[0].weekends.find((w) => w.sessionId === "w-nov") as PlannerWeekend
    const six = nov.venues.find((v) => v.venueId === "v-pool")
    const haber = nov.venues.find((v) => v.venueId === "v-haber")
    expect(six?.booked).toBe(true)
    expect(haber?.booked).toBeFalsy()
  })

  it("fills the booked weekend rather than assuming a new gym beside it", () => {
    const { assignment, venues, drawn } = drawWith(booked(), "balance")
    // The booked weekend is used.
    expect(assignment["w-nov"] ?? []).toContain("age:Grade 7")
    // And Six Park, which is paid for, is where the spill went: Haber is never
    // assumed while booked time sits idle.
    expect(Object.values(venues["w-nov"] ?? {})).toContain("v-pool")
    expect(drawn.assumed.map((a) => a.venueId)).not.toContain("v-haber")
  })

  it("spread never abandons a confirmed booking for an unbooked weekend", () => {
    const { assignment } = drawWith(booked(), "spread")
    // Spread lays the season out flat, and the booked Saturday is not the one
    // it is allowed to drop to do it.
    expect((assignment["w-nov"] ?? []).length).toBeGreaterThan(0)
  })
})

/**
 * THE STATUS INVERSION (owner ruling 2026-08-06). Who put the booking down
 * decides what it is, and the two answers are opposites.
 */
describe("who booked it decides what it is", () => {
  it("marks what the DRAW booked as assumed, and what the OPERATOR did as confirmed", () => {
    expect(bookingStatusFor("draw")).toBe("assumed")
    expect(bookingStatusFor("operator")).toBe("confirmed")
  })

  it("keys a booking the same way the courts and the hours are keyed", () => {
    // One gym, one weekend, one string. courtCapKey is the scheme; the board's
    // blockKey builds the identical thing, so the three working-copy maps can
    // never drift into two vocabularies.
    expect(courtCapKey("w-oct", "v-pool")).toBe("w-oct|v-pool")
  })

  it("never calls the league's own building an assumption", () => {
    // The home gym is not a rental, so a draw that fills it has nobody to phone.
    const state = planStateFrom("s1", {
      settings: { capturedAt: "x", state: world() },
    }) as PlannerState
    const runs = solvableState(state)
    const assignment = proposePlan(runs, "balance")
    const venues = packPlanVenues(runs, assignment)
    const drawn = drawnGyms(state, assignment, venues)
    expect(drawn.assumed.map((a) => a.venueId)).not.toContain("v-home")
  })
})
