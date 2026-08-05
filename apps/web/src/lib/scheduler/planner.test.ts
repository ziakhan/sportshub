import { describe, expect, it } from "vitest"
import {
  buildingCapacityAt,
  courtsCapacityAt,
  diffAssignments,
  expectedTeamUpdates,
  gradeAbbrev,
  gradeLine,
  overPlanSentence,
  packedCapacity,
  packedWeekendLoad,
  planRentalBlocks,
  planSummary,
  planningSource,
  planningTeams,
  proposePlan,
  registrationBars,
  seasonCalendarMonths,
  suggestFor,
  weekendDays,
  weekendShortDays,
  weekendsNeedingAttention,
  TIGHT_RATIO,
  weekendDemand,
  weekendLoad,
  type PlannerState,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
} from "./planner"

/**
 * Pins the planner against the shape it was validated on: NPH's official
 * 2026-27 calendar (scripts/analysis/validate-nph-calendar.ts). Real census
 * team counts, real weekend capacities (NJC weekends = Burlington-only 80,
 * full weekends = 176), 2 games per team per weekend.
 */

/** A registered grade: the teams are really in, and the estimate matched
 *  unless a test says otherwise. `teams` is what the board plans on, built
 *  the one way the server builds it — the estimate alone since the 2026-08-02
 *  ruling, so a test that passes a different `expected` is testing the gap
 *  between the plan and reality, not a bigger plan. */
function registered(label: string, approved: number, expected = approved): PlannerUnit {
  return {
    key: `age:${label}`,
    label,
    divisionIds: [`d${label}`],
    teams: planningTeams(approved, expected),
    approved,
    expected,
    source: planningSource(approved, expected),
  }
}

/** A grade nobody has registered for yet: the estimate IS the plan. */
function estimated(label: string, expected: number): PlannerUnit {
  return {
    key: `age:${label}`,
    label,
    divisionIds: [`d${label}`],
    teams: planningTeams(0, expected),
    approved: 0,
    expected,
    source: planningSource(0, expected),
  }
}

const UNITS: PlannerUnit[] = [
  registered("Gr7", 12),
  registered("Gr8", 9),
  registered("Gr9", 25),
  registered("Gr10", 42),
  registered("Gr11", 24),
  registered("Gr12", 26),
  registered("JrGirls", 8),
]

let seq = 0
function wk(
  label: string,
  dateISO: string,
  capacityGames: number,
  largestVenueCapacity = capacityGames
): PlannerWeekend {
  return {
    sessionId: `s${++seq}`,
    label,
    dateISO,
    capacityGames,
    largestVenueCapacity,
    // Venue model v2 (owner ruling 2026-08-03): the big building is the one
    // the league OWNS, so it fills first and costs nothing, and the second is
    // rented by the court-day. One court a day each, so a court-day is the
    // whole building and "1 court" is its whole capacity.
    venues: [
      {
        venueId: "v1",
        name: "Six Park East",
        capacityGames: largestVenueCapacity,
        role: "home" as const,
        fillOrder: 0,
      },
      ...(capacityGames > largestVenueCapacity
        ? [
            {
              venueId: "v2",
              name: "Playground",
              capacityGames: capacityGames - largestVenueCapacity,
              role: "pool" as const,
              fillOrder: 1,
            },
          ]
        : []),
    ],
    targetGamesPerTeam: 2,
    assigned: [],
    assignedVenues: {},
  }
}

/** The official 2026-27 window structure: NJC weekends are capped at 80. */
function nphState(): PlannerState {
  seq = 0
  return {
    seasonId: "season",
    units: UNITS,
    errors: [],
    windows: [
      {
        label: "Oct 2026",
        weekends: [
          wk("Oct 24–25", "2026-10-24", 176, 96),
          wk("Oct 31–Nov 1", "2026-10-31", 176, 96),
        ],
      },
      {
        label: "Nov 2026",
        weekends: [
          wk("Nov 14–15", "2026-11-14", 80, 48),
          wk("Nov 21–22", "2026-11-21", 176, 96),
          wk("Nov 28–29", "2026-11-28", 176, 96),
        ],
      },
      {
        label: "Dec 2026",
        weekends: [wk("Dec 12–13", "2026-12-12", 80, 48), wk("Dec 19–20", "2026-12-19", 176, 96)],
      },
      {
        label: "Jan 2027",
        weekends: [
          wk("Jan 9–10", "2027-01-09", 176, 96),
          wk("Jan 16–17", "2027-01-16", 80, 48),
          wk("Jan 30–31", "2027-01-30", 176, 96),
        ],
      },
      {
        label: "Feb 2027",
        weekends: [
          wk("Feb 6–7", "2027-02-06", 176, 96),
          wk("Feb 13–14", "2027-02-13", 80, 48),
          wk("Feb 20–21", "2027-02-20", 176, 96),
        ],
      },
    ],
  }
}

const demandAt = (state: PlannerState, plan: Record<string, string[]>) => {
  const rows: Array<{ label: string; demand: number; capacity: number }> = []
  for (const win of state.windows)
    for (const w of win.weekends)
      rows.push({
        label: w.label,
        demand: weekendDemand(state.units, w, plan[w.sessionId] ?? []),
        capacity: w.capacityGames,
      })
  return rows
}

describe("proposePlan on the NPH shape", () => {
  /**
   * RE-PINNED 2026-08-03 (compact-first is the default). The default objective
   * is now "use as few weekends as the month allows", so the flat 84-game peak
   * this used to pin is gone on purpose: a month that fits on one weekend runs
   * on one weekend, at 146 of 176. Overflow is still forbidden, which is the
   * half of the old assertion that was ever a law.
   */
  it("balance: bundles the month onto one weekend and never overflows", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    const rows = demandAt(state, plan)
    for (const r of rows) expect(r.demand).toBeLessThanOrEqual(r.capacity)
    for (const win of state.windows) {
      const busy = win.weekends.filter((w) => (plan[w.sessionId] ?? []).length > 0)
      expect(busy).toHaveLength(1)
      // And the one weekend it picks holds the WHOLE month: 146 games.
      expect(weekendDemand(state.units, busy[0], plan[busy[0].sessionId] ?? [])).toBe(146)
    }
  })

  it("every unit appears exactly once per window", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    for (const win of state.windows) {
      const all = win.weekends.flatMap((w) => plan[w.sessionId] ?? [])
      expect(all.sort()).toEqual(UNITS.map((u) => u.key).sort())
    }
  })

  it("availability-aware: NJC-capped weekends carry loads that fit 80 slots", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    for (const win of state.windows) {
      for (const w of win.weekends) {
        if (w.capacityGames === 80) {
          expect(weekendDemand(state.units, w, plan[w.sessionId] ?? [])).toBeLessThanOrEqual(80)
        }
      }
    }
  })

  it("compact IS balance now; spread still uses every weekend", () => {
    const state = nphState()
    const used = (plan: Record<string, string[]>) =>
      Object.values(plan).filter((k) => k.length > 0).length
    const compact = proposePlan(nphState(), "compact")
    const balance = proposePlan(nphState(), "balance")
    const spread = proposePlan(state, "spread")
    // Since the 2026-08-03 ruling the two names are one objective, so they are
    // not merely comparable — they are the same calendar.
    expect(compact).toEqual(balance)
    expect(used(balance)).toBe(state.windows.length)
    // 7 units across 13 weekends: spread still can't use more weekends than
    // units-per-window allows, but every window's weekend count ≤ units, so
    // every weekend should host something.
    for (const win of state.windows) {
      for (const w of win.weekends) {
        expect((spread[w.sessionId] ?? []).length).toBeGreaterThan(0)
      }
    }
  })

  /**
   * RE-PINNED 2026-08-03. Keeping the two biggest grades on different weekends
   * is a courtesy worth 40, and bundling the month is worth 100,000, so the
   * default now puts them together — that is the ruling, not a regression. The
   * courtesy still decides once the calendar is being spread out, which is the
   * only shape where there is a choice to make.
   */
  it("keeps the two giants (Gr10, Gr9) apart when the month is spread out", () => {
    const state = nphState()
    const plan = proposePlan(state, "spread")
    for (const win of state.windows) {
      const together = win.weekends.some(
        (w) =>
          (plan[w.sessionId] ?? []).includes("age:Gr10") &&
          (plan[w.sessionId] ?? []).includes("age:Gr9")
      )
      expect(together).toBe(false)
    }
  })

  it("greedy fallback (large unit count) still assigns every unit once per window", () => {
    seq = 0
    const manyUnits: PlannerUnit[] = Array.from({ length: 13 }, (_, i) =>
      registered(`U${i}`, 6 + i)
    )
    const state: PlannerState = {
      seasonId: "s",
      units: manyUnits,
      errors: [],
      windows: [
        {
          label: "Nov",
          weekends: [
            wk("A", "2026-11-07", 200),
            wk("B", "2026-11-14", 200),
            wk("C", "2026-11-21", 200),
          ],
        },
      ],
    }
    const plan = proposePlan(state, "balance") // 3^13 > 300k → greedy path
    const all = state.windows[0].weekends.flatMap((w) => plan[w.sessionId] ?? [])
    expect(all.sort()).toEqual(manyUnits.map((u) => u.key).sort())
  })
})

describe("suggestFor", () => {
  it("flags overflow with a move that clears it, and idle weekends", () => {
    const state = nphState()
    const [oct24, oct31] = state.windows[0].weekends
    const assignment: Record<string, string[]> = {
      // Everything piled on Oct 24 (demand 146 > 176? no — 146 ≤ 176; use
      // a tighter cap by piling onto an 80-cap weekend instead)
      [oct24.sessionId]: [],
      [oct31.sessionId]: [],
    }
    const nov14 = state.windows[1].weekends[0] // 80-cap
    assignment[nov14.sessionId] = ["age:Gr10", "age:Gr9", "age:Gr12"] // 93 > 80
    const suggestions = suggestFor(state, assignment)
    expect(suggestions.some((s) => s.kind === "overflow" && s.sessionId === nov14.sessionId)).toBe(
      true
    )
    expect(suggestions.some((s) => s.kind === "move-unit")).toBe(true)
    expect(
      suggestions.some((s) => s.kind === "idle-weekend" && s.sessionId === oct24.sessionId)
    ).toBe(true)
  })

  it("flags a two-building weekend", () => {
    const state = nphState()
    const feb6 = state.windows[4].weekends[0] // 176 cap, largest venue 96
    const assignment: Record<string, string[]> = {
      [feb6.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr11", "age:Gr12"], // 117 > 96
    }
    const suggestions = suggestFor(state, assignment)
    expect(
      suggestions.some((s) => s.kind === "two-building" && s.sessionId === feb6.sessionId)
    ).toBe(true)
  })

  it("spells the shortage out, and hands over a move that clears it", () => {
    const state = nphState()
    const nov14 = state.windows[1].weekends[0] // 80 cap
    const nov21 = state.windows[1].weekends[1] // 176 cap, empty
    const assignment = { [nov14.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr12"] } // 93 games
    const suggestions = suggestFor(state, assignment)

    const over = suggestions.find((s) => s.kind === "overflow" && s.sessionId === nov14.sessionId)
    expect(over?.text).toBe(
      "Nov 14–15 needs 93 games and has 80 slots, 13 short. Extend the hours, add a court, or move a grade to a lighter weekend."
    )

    const move = suggestions.find((s) => s.kind === "move-unit")
    // The smallest grade that actually clears it, not simply the smallest.
    expect(move?.text).toBe(
      "Move Gr9 (25 games) from Nov 14–15 (93 of 80, 13 short) to Nov 21–22 (25 of 176 after). Clears the shortage."
    )
    expect(move?.move).toEqual({
      unitKey: "age:Gr9",
      unitLabel: "Gr9",
      games: 25,
      fromSessionId: nov14.sessionId,
      fromLabel: "Nov 14–15",
      toSessionId: nov21.sessionId,
      toLabel: "Nov 21–22",
      fromBefore: { demand: 93, capacity: 80 },
      toAfter: { demand: 25, capacity: 176 },
      resolves: "shortage",
      // Gr9 keeps its own building on the way over, so there is no landing
      // clause to carry — the same quiet case the sentence leaves out.
      lands: "",
    })
  })

  /**
   * RE-PINNED 2026-08-05 (owner ruling #5). This used to hand over the move: 24
   * games off Feb 6 onto the empty Feb 13, saving one rented court-day. Under
   * the price list that trade is a loss and always was — a weekend costs 100,000
   * and the booking it closes is worth 25,000 — so the rail was offering to make
   * the plan four times more expensive to tidy one court.
   *
   * The note still ships with both loads on it, because "Feb 6 rents a court at
   * Playground" is a true thing about the calendar. It just has nothing to press.
   */
  it("gives the two-building note both loads, and refuses a move that would open a weekend", () => {
    const state = nphState()
    const feb6 = state.windows[4].weekends[0]
    const assignment = {
      [feb6.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr11", "age:Gr12"],
    }
    const two = suggestFor(state, assignment).find((s) => s.kind === "two-building")
    expect(two?.text).toBe(
      "Feb 6–7 fills Six Park (93 of 96) and rents 1 court at Playground (24 of 80), 117 games in all."
    )
    expect(two?.move).toBeUndefined()
  })

  it("reads the gyms the caller has on screen, not only the ones saved", () => {
    const state = nphState()
    const feb6 = state.windows[4].weekends[0]
    const assignment = {
      [feb6.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr11", "age:Gr12"],
    }
    // Everybody hand-picked into the first gym: one building on screen, so
    // there is no second building to talk about.
    const decided = {
      [feb6.sessionId]: Object.fromEntries(assignment[feb6.sessionId].map((key) => [key, "v1"])),
    }
    const suggestions = suggestFor(state, assignment, decided)
    expect(suggestions.some((s) => s.kind === "two-building")).toBe(false)
  })

  /**
   * RE-PINNED 2026-08-05 (owner ruling #5). The empty weekend used to come with
   * a grade to put on it. Compact-first made that button backwards: bundling the
   * month onto fewer Saturdays is the plan doing its job, so an idle chosen
   * weekend is a success and the rail no longer asks anybody to undo it.
   *
   * The note stays, because "nothing is on the 14th" is worth seeing.
   */
  it("says an empty weekend is empty, and hands over nothing to press", () => {
    const state = nphState()
    const [nov14, nov21] = state.windows[1].weekends
    const assignment = { [nov21.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr12"] } // 93 games
    const all = suggestFor(state, assignment)
    const idle = all.find((s) => s.kind === "idle-weekend" && s.sessionId === nov14.sessionId)
    expect(idle?.text).toBe(
      "Nov 14–15 has 80 open slots and no grades on it. Spare capacity, or another league's weekend."
    )
    expect(idle?.move).toBeUndefined()
    // And nothing else in the month offers to spread it back out either.
    expect(all.filter((s) => s.move)).toEqual([])
  })

  it("says where the grade would LAND when the move takes it off its home gym", () => {
    // October hands both grades The Playground. November's first weekend is
    // Playground-only and too small; the second still has room for one of
    // them, so the grade that moves ends up in the other building.
    // The Playground is the building the league OWNS; Six Park is rented.
    const gymAt = (
      venueId: string,
      name: string,
      capacityGames: number,
      role: "home" | "pool"
    ): PlannerVenue => ({
      venueId,
      name,
      capacityGames,
      role,
      fillOrder: 0,
    })
    const weekendAt = (
      sessionId: string,
      label: string,
      dateISO: string,
      venues: PlannerVenue[]
    ): PlannerWeekend => ({
      sessionId,
      label,
      dateISO,
      capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
      largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
      venues,
      targetGamesPerTeam: 2,
      assigned: [],
      assignedVenues: {},
    })
    const state: PlannerState = {
      seasonId: "season",
      units: [registered("Gr8", 40), registered("Gr9", 30)],
      errors: [],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            weekendAt("oct1", "Oct 24–25", "2026-10-24", [
              gymAt("playground", "The Playground", 96, "home"),
              gymAt("sixpark", "Six Park East", 96, "pool"),
            ]),
          ],
        },
        {
          label: "Nov 2026",
          weekends: [
            weekendAt("nov1", "Nov 14–15", "2026-11-14", [
              gymAt("playground", "The Playground", 20, "home"),
            ]),
            weekendAt("nov2", "Nov 21–22", "2026-11-21", [
              gymAt("playground", "The Playground", 48, "home"),
              gymAt("sixpark", "Six Park East", 96, "pool"),
            ]),
          ],
        },
      ],
    }
    const assignment = {
      oct1: ["age:Gr8", "age:Gr9"],
      nov1: ["age:Gr9"],
      nov2: ["age:Gr8"],
    }
    const move = suggestFor(state, assignment).find((s) => s.kind === "move-unit")
    expect(move?.text).toBe(
      "Move Gr9 (30 games) from Nov 14–15 (30 of 20, 10 short) to Nov 21–22 (70 of 144 after). " +
        "Clears the shortage. Lands at Six Park (Playground holds Gr8, 40 of 48)."
    )
  })

  it("writes no em-dash into anything an operator reads", () => {
    const state = nphState()
    const [nov14, nov21] = state.windows[1].weekends
    for (const assignment of [
      { [nov14.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr12"] },
      { [nov21.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr11", "age:Gr12"] },
    ]) {
      for (const s of suggestFor(state, assignment)) expect(s.text).not.toContain("—")
    }
  })
})

describe("weekendDemand", () => {
  it("games = ceil(teams × target / 2) summed over assigned units", () => {
    const w = wk("X", "2026-11-01", 100)
    expect(weekendDemand(UNITS, w, ["age:Gr9"])).toBe(25)
    expect(weekendDemand(UNITS, w, ["age:Gr9", "age:JrGirls"])).toBe(33)
    expect(weekendDemand(UNITS, { targetGamesPerTeam: 3 }, ["age:Gr9"])).toBe(38)
  })
})

describe("weekendLoad", () => {
  it("roomy below the tight line, tight exactly on it", () => {
    // Gr9 = 25 teams × 2 games ÷ 2 = 25 games. A 100-slot weekend is 25%.
    const roomy = weekendLoad(UNITS, wk("Roomy", "2026-11-07", 100), ["age:Gr9"])
    expect(roomy.demand).toBe(25)
    expect(roomy.ratio).toBeCloseTo(0.25)
    expect(roomy.tone).toBe("roomy")

    // Exactly TIGHT_RATIO is tight: the boundary belongs to the warning.
    const onTheLine = weekendLoad(UNITS, wk("Line", "2026-11-07", 25 / TIGHT_RATIO), ["age:Gr9"])
    expect(onTheLine.ratio).toBeCloseTo(TIGHT_RATIO)
    expect(onTheLine.tone).toBe("tight")

    // A hair more room and it is comfortable again.
    const justUnder = weekendLoad(UNITS, wk("Under", "2026-11-07", 25 / TIGHT_RATIO + 1), [
      "age:Gr9",
    ])
    expect(justUnder.tone).toBe("roomy")
  })

  it("full to the last court is tight, one game past it is over", () => {
    expect(weekendLoad(UNITS, wk("Full", "2026-11-07", 25), ["age:Gr9"]).tone).toBe("tight")
    const over = weekendLoad(UNITS, wk("Over", "2026-11-07", 24), ["age:Gr9"])
    expect(over.tone).toBe("over")
    expect(over.demand - over.capacity).toBe(1)
  })

  it("no gym that weekend reads unavailable, or over when grades are on it anyway", () => {
    const idle = weekendLoad(UNITS, wk("Released", "2026-11-07", 0), [])
    expect(idle.tone).toBe("unavailable")
    expect(idle.ratio).toBe(0)

    const stranded = weekendLoad(UNITS, wk("Released", "2026-11-07", 0), ["age:Gr7"])
    expect(stranded.tone).toBe("over")
    expect(stranded.ratio).toBe(Infinity)
  })

  it("an available weekend with no grades is empty, not tight", () => {
    expect(weekendLoad(UNITS, wk("Open", "2026-11-07", 176, 96), []).tone).toBe("empty")
  })

  it("twoBuildings only when the load spills past the biggest gym AND a second exists", () => {
    // 176 slots across Six Park (96) + Playground (80).
    const spills = weekendLoad(UNITS, wk("Spill", "2026-11-07", 176, 96), [
      "age:Gr10",
      "age:Gr9",
      "age:Gr11",
      "age:Gr12",
    ])
    expect(spills.demand).toBe(117)
    expect(spills.twoBuildings).toBe(true)

    // Same grades, one building that holds them: no spill.
    expect(
      weekendLoad(UNITS, wk("One gym", "2026-11-07", 176), [
        "age:Gr10",
        "age:Gr9",
        "age:Gr11",
        "age:Gr12",
      ]).twoBuildings
    ).toBe(false)

    // Fits inside the big gym: no spill even with two venues attached.
    expect(weekendLoad(UNITS, wk("Fits", "2026-11-07", 176, 96), ["age:Gr9"]).twoBuildings).toBe(
      false
    )
  })
})

describe("packedCapacity", () => {
  /** A weekend the season really owns 3 courts of and rents 6 more from. */
  const packedState = (): PlannerState => ({
    seasonId: "season",
    errors: [],
    units: [registered("A", 20), registered("B", 16)],
    windows: [
      {
        label: "Nov 2026",
        weekends: [
          {
            sessionId: "w1",
            label: "Nov 14–15",
            dateISO: "2026-11-14",
            capacityGames: 72,
            largestVenueCapacity: 48,
            targetGamesPerTeam: 2,
            assigned: [],
            assignedVenues: {},
            venues: [
              {
                venueId: "home",
                name: "The Playground",
                capacityGames: 24,
                role: "home",
                fillOrder: 0,
                courts: 3,
                days: 2,
                courtDays: 6,
                hoursPerCourtDay: 4,
              },
              {
                venueId: "pool",
                name: "Six Park East",
                capacityGames: 48,
                role: "pool",
                fillOrder: 1,
                courts: 6,
                days: 2,
                courtDays: 12,
                hoursPerCourtDay: 4,
              },
            ],
          },
        ],
      },
    ],
  })

  it("counts the home gym plus the courts the calendar rents, never the whole pool building", () => {
    const state = packedState()
    const weekend = state.windows[0].weekends[0]
    const assignment = { w1: ["age:A", "age:B"] }
    const blocks = planRentalBlocks(state, assignment)
    // B spills out of the 24-game home gym and takes 2 of Six Park's 6 courts.
    expect(blocks.map((b) => [b.venueId, b.courts])).toEqual([["pool", 2]])
    expect(packedCapacity(weekend, blocks)).toBe(40)
    // The attached wiring says 72, which is the number this ruling removes.
    expect(weekendLoad(state.units, weekend, assignment.w1).capacity).toBe(72)
  })

  it("a weekend that rents nothing is worth its home gym alone", () => {
    const state = packedState()
    const weekend = state.windows[0].weekends[0]
    const assignment = { w1: ["age:B"] }
    const blocks = planRentalBlocks(state, assignment)
    expect(blocks).toEqual([])
    expect(packedCapacity(weekend, blocks)).toBe(24)
    const load = packedWeekendLoad(state.units, weekend, assignment.w1, blocks)
    expect(load.demand).toBe(16)
    expect(load.capacity).toBe(24)
    expect(load.tone).toBe("roomy")
  })

  it("games with no building read over the packed capacity", () => {
    const state = packedState()
    const weekend = state.windows[0].weekends[0]
    // One cohort bigger than either building: nothing can house it.
    state.units = [registered("A", 20), registered("Big", 60)]
    const assignment = { w1: ["age:A", "age:Big"] }
    const blocks = planRentalBlocks(state, assignment)
    const load = packedWeekendLoad(state.units, weekend, assignment.w1, blocks)
    expect(load.demand).toBe(80)
    expect(load.capacity).toBeLessThan(load.demand)
    expect(load.tone).toBe("over")
  })
})

/**
 * WHAT A BUILDING COULD HOLD (owner ruling 2026-08-05, #2 — the switch-guard
 * fix). The counterpart to packedCapacity above: that one asks what the calendar
 * HAS, this one asks what a move could buy, and the difference between them is
 * the whole bug. courtsCapacityAt clamps to the courts already attached, which is
 * why every destination read full after one move.
 */
describe("buildingCapacityAt", () => {
  /** Six Park with 2 of its 6 courts rented this weekend: 48 games attached,
   *  24 games a court over the weekend. */
  const rented: PlannerVenue = {
    venueId: "pool",
    name: "Six Park East",
    capacityGames: 48,
    role: "pool",
    fillOrder: 1,
    courts: 2,
    days: 2,
    courtDays: 4,
    hoursPerCourtDay: 12,
  }

  it("is NOT clamped to the courts we already rent, because renting more is the move", () => {
    // The rental is the ceiling courtsCapacityAt keeps…
    expect(courtsCapacityAt(rented, 6)).toBe(48)
    // …and the building is what a move can actually reach: 6 courts at 24 each.
    expect(buildingCapacityAt(rented, 6)).toBe(144)
    expect(buildingCapacityAt(rented, 2)).toBe(48)
  })

  it("holds nothing at no courts, and nothing at a gym that is shut", () => {
    expect(buildingCapacityAt(rented, 0)).toBe(0)
    expect(buildingCapacityAt(rented, -3)).toBe(0)
    expect(buildingCapacityAt({ ...rented, capacityGames: 0 }, 6)).toBe(0)
  })

  it("never invents part of a game", () => {
    // 25 games over 2 courts is 12.5 a court; three courts is 37, not 37.5.
    const odd: PlannerVenue = { ...rented, capacityGames: 25 }
    expect(buildingCapacityAt(odd, 3)).toBe(37)
  })
})

describe("planSummary", () => {
  it("a clean balance proposal fits: nothing over, nothing unplaced", () => {
    const state = nphState()
    const summary = planSummary(state, proposePlan(state, "balance"))
    expect(summary.over).toBe(0)
    expect(summary.unplaced).toBe(0)
    expect(summary.fits).toBe(true)
    // 173 teams × 2 games ÷ 2, once per window, across 5 windows.
    expect(summary.games).toBe(5 * 146)
  })

  it("counts over, tight and unavailable weekends, and the grades left out", () => {
    seq = 0
    const state: PlannerState = {
      seasonId: "s",
      units: UNITS,
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            wk("Over", "2026-11-07", 24), // Gr9 = 25 games
            wk("Tight", "2026-11-14", 12), // Gr7 = 12 games, exactly full
            wk("Released", "2026-11-21", 0), // no gym, no grades
            wk("Roomy", "2026-11-28", 100),
          ],
        },
      ],
    }
    const [over, tight, released, roomy] = state.windows[0].weekends
    const summary = planSummary(state, {
      [over.sessionId]: ["age:Gr9"],
      [tight.sessionId]: ["age:Gr7"],
      [released.sessionId]: [],
      [roomy.sessionId]: ["age:Gr8", "age:JrGirls"],
    })
    expect(summary.over).toBe(1)
    expect(summary.tight).toBe(1)
    expect(summary.unavailable).toBe(1)
    expect(summary.games).toBe(25 + 12 + 0 + 9 + 8)
    // Gr10, Gr11 and Gr12 never got a weekend this month.
    expect(summary.unplaced).toBe(3)
    expect(summary.fits).toBe(false)
  })

  it("a grade missing from ONE window of several is still unplaced", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    const first = state.windows[0].weekends[0].sessionId
    const dropped = (plan[first] ?? [])[0]
    expect(dropped).toBeTruthy()
    const holed = { ...plan, [first]: (plan[first] ?? []).filter((k) => k !== dropped) }
    const summary = planSummary(state, holed)
    expect(summary.unplaced).toBe(1)
    expect(summary.fits).toBe(false)
    expect(summary.over).toBe(0)
  })

  it("grades with no teams yet are not counted as unplaced", () => {
    seq = 0
    const state: PlannerState = {
      seasonId: "s",
      units: [...UNITS, estimated("Gr6", 0)],
      errors: [],
      windows: [{ label: "Nov 2026", weekends: [wk("Only", "2026-11-07", 200)] }],
    }
    const summary = planSummary(state, {
      [state.windows[0].weekends[0].sessionId]: UNITS.map((u) => u.key),
    })
    expect(summary.unplaced).toBe(0)
    expect(summary.fits).toBe(true)
  })

  it("an empty season summarises as fitting rather than throwing", () => {
    const summary = planSummary({ seasonId: "s", units: [], windows: [], errors: [] }, {})
    expect(summary).toEqual({
      fits: true,
      over: 0,
      tight: 0,
      unavailable: 0,
      unplaced: 0,
      games: 0,
    })
  })
})

describe("expectedTeamUpdates", () => {
  it("keeps the grade total exact when it splits across divisions", () => {
    expect(expectedTeamUpdates(["a", "b", "c"], 14)).toEqual([
      { divisionId: "a", expectedTeams: 5 },
      { divisionId: "b", expectedTeams: 5 },
      { divisionId: "c", expectedTeams: 4 },
    ])
    expect(expectedTeamUpdates(["a"], 27)).toEqual([{ divisionId: "a", expectedTeams: 27 }])
    expect(expectedTeamUpdates(["a", "b"], 0)).toEqual([
      { divisionId: "a", expectedTeams: 0 },
      { divisionId: "b", expectedTeams: 0 },
    ])
    expect(expectedTeamUpdates([], 9)).toEqual([])
  })
})

/**
 * Owner ruling 2026-08-02, which SUPERSEDES the earlier max(approved,
 * expected) rule these tests used to pin: "The planning phase should not be
 * looking at the real teams until we get to the real scheduling. The estimate
 * should be the number entered by the human, not what's in the database. If
 * teams sign up below the estimates that's fine. If you go over, maybe a
 * slight warning somewhere."
 */
describe("planningTeams / planningSource", () => {
  it("plans on the operator's number when they planned bigger", () => {
    expect(planningTeams(9, 14)).toBe(14)
    expect(planningSource(9, 14)).toBe("expected")
  })

  it("plans on the estimate even when more teams have registered", () => {
    // Was max() before the 2026-08-02 ruling: registration is now a warning
    // on screen, not a bigger plan.
    expect(planningTeams(30, 27)).toBe(27)
    expect(planningSource(30, 27)).toBe("expected")
  })

  it("registration alone plans nothing", () => {
    expect(planningTeams(12, 0)).toBe(0)
    expect(planningSource(12, 0)).toBe("none")
    expect(planningTeams(0, 25)).toBe(25)
    expect(planningSource(0, 25)).toBe("expected")
  })

  it("an estimate is the plan whatever registration says, an empty grade is neither", () => {
    expect(planningTeams(8, 8)).toBe(8)
    expect(planningSource(8, 8)).toBe("expected")
    expect(planningTeams(0, 0)).toBe(0)
    expect(planningSource(0, 0)).toBe("none")
  })

  it("carries into everything that plans on a unit", () => {
    // 14 expected against 9 registered: the weekend is sized for 14.
    const unit = registered("Gr7", 9, 14)
    expect(unit.teams).toBe(14)
    expect(weekendDemand([unit], { targetGamesPerTeam: 2 }, [unit.key])).toBe(14)

    // 30 registered against 27 expected: the weekend is sized for 27, and the
    // three extra teams are the warning the watch screen draws.
    const outgrown = registered("Gr9", 30, 27)
    expect(outgrown.teams).toBe(27)
    expect(weekendDemand([outgrown], { targetGamesPerTeam: 2 }, [outgrown.key])).toBe(27)
    expect(registrationBars([outgrown])[0].over).toBe(true)
  })

  it("a grade nobody estimated asks for no games, however many teams are in", () => {
    const unplanned = registered("Gr6", 12, 0)
    expect(unplanned.teams).toBe(0)
    expect(weekendDemand([unplanned], { targetGamesPerTeam: 2 }, [unplanned.key])).toBe(0)

    // And it is not on the board at all: proposePlan only places grades the
    // operator planned for.
    const state = nphState()
    state.units = [estimated("Gr7", 10), unplanned]
    const plan = proposePlan(state, "balance")
    expect(Object.values(plan).flat()).not.toContain(unplanned.key)
    expect(Object.values(plan).flat()).toContain("age:Gr7")
  })

  it("a grade with an estimate and nobody registered is planned in full", () => {
    const state = nphState()
    state.units = [estimated("Gr7", 14)]
    const plan = proposePlan(state, "balance")
    // One weekend per window, and the weekend it lands on is sized for 14.
    const placed = Object.entries(plan).filter(([, keys]) => keys.includes("age:Gr7"))
    expect(placed).toHaveLength(state.windows.length)
    // 14 teams at 2 games each: every weekend it lands on is sized for 14.
    for (const win of state.windows) {
      for (const w of win.weekends) {
        expect(weekendDemand(state.units, w, plan[w.sessionId] ?? [])).toBe(
          (plan[w.sessionId] ?? []).includes("age:Gr7") ? 14 : 0
        )
      }
    }
  })
})

describe("gradeAbbrev", () => {
  it("writes grades the way a poster writes them", () => {
    expect(gradeAbbrev("Grade 7")).toBe("Gr7")
    expect(gradeAbbrev("Grade 12")).toBe("Gr12")
    expect(gradeAbbrev("grade10")).toBe("Gr10")
    expect(gradeAbbrev("U14")).toBe("U14")
    expect(gradeAbbrev("u 16")).toBe("U16")
  })

  it("keeps named groups readable and short", () => {
    expect(gradeAbbrev("Junior Girls")).toBe("JrG")
    expect(gradeAbbrev("Senior")).toBe("Sr")
    // Unknown words fall back to a clean truncation, capped so a month
    // column never has to wrap.
    expect(gradeAbbrev("Elite")).toBe("Eli")
    expect(gradeAbbrev("Elite Boys")).toBe("ElB")
    expect(gradeAbbrev("Senior Boys Tier One Extra")).toBe("SrBTO")
  })
})

describe("gradeLine", () => {
  it("says Gr once for a run of numbered grades", () => {
    expect(gradeLine(["Grade 7", "Grade 8", "Grade 9", "Grade 11", "Junior Girls"])).toBe(
      "Gr7 8 9 11 JrG"
    )
  })

  it("says it again after something that is not a numbered grade", () => {
    expect(gradeLine(["Grade 7", "Junior Girls", "Grade 10"])).toBe("Gr7 JrG Gr10")
    expect(gradeLine([])).toBe("")
  })
})

describe("weekendDays", () => {
  it("drops the month a column header already carries", () => {
    expect(weekendDays("Oct 24–25")).toBe("24–25")
    expect(weekendDays("Oct 31–Nov 1")).toBe("31–1")
    expect(weekendDays("Feb 6")).toBe("6")
  })
})

describe("weekendShortDays", () => {
  it("keeps the second month, because 31–1 tells nobody anything", () => {
    expect(weekendShortDays("Oct 24–25")).toBe("24–25")
    expect(weekendShortDays("Oct 31–Nov 1")).toBe("31–Nov 1")
    expect(weekendShortDays("Feb 6")).toBe("Feb 6")
  })
})

describe("seasonCalendarMonths", () => {
  const state = nphState()
  const weekendsOf = (label: string) => state.windows.find((w) => w.label === label)!.weekends

  it("lists only the weekends that actually hold grades", () => {
    const nov = weekendsOf("Nov 2026")
    const months = seasonCalendarMonths(state, {
      [nov[0].sessionId]: ["age:Gr7", "age:Gr9"],
      // nov[1] deliberately empty: an idle weekend is not on the poster.
    })
    expect(months).toHaveLength(1)
    expect(months[0].month).toBe("Nov")
    expect(months[0].weekends).toHaveLength(1)
    expect(months[0].weekends[0].grades).toBe("Gr7 9")
    expect(months[0].weekends[0].gradeList).toEqual(["Gr7", "Gr9"])
  })

  it("orders grades the way the board does, not the way they were dropped", () => {
    const nov = weekendsOf("Nov 2026")
    const months = seasonCalendarMonths(state, {
      [nov[0].sessionId]: ["age:JrGirls", "age:Gr9", "age:Gr7"],
    })
    expect(months[0].weekends[0].gradeList).toEqual(["Gr7", "Gr9", "JrG"])
  })

  it("ignores keys for grades this season does not have", () => {
    const nov = weekendsOf("Nov 2026")
    const months = seasonCalendarMonths(state, {
      [nov[0].sessionId]: ["age:Gr7", "age:GradeNobodyRuns"],
    })
    expect(months[0].weekends[0].gradeList).toEqual(["Gr7"])
  })

  it("returns nothing at all for a season with no kept plan", () => {
    expect(seasonCalendarMonths(state, {})).toEqual([])
    expect(seasonCalendarMonths({ seasonId: "s", units: [], windows: [], errors: [] }, {})).toEqual(
      []
    )
  })
})

describe("registrationBars", () => {
  it("draws registered against expected, and fills the track when a grade beats it", () => {
    const bars = registrationBars([
      registered("Gr7", 9, 14),
      registered("Gr9", 30, 27), // the mock's over-plan grade
      estimated("Gr11", 25),
    ])
    expect(bars.map((b) => [b.label, b.approved, b.expected, b.over])).toEqual([
      ["Gr7", 9, 14, false],
      ["Gr9", 30, 27, true],
      ["Gr11", 0, 25, false],
    ])
    // 9 of 14 is nine fourteenths of the track; 30 of 27 fills it.
    expect(bars[0].fill).toBeCloseTo(9 / 14)
    expect(bars[1].fill).toBe(1)
    expect(bars[2].fill).toBe(0)
  })

  it("leaves out grades nobody expected and nobody registered", () => {
    const bars = registrationBars([registered("Gr7", 9, 14), estimated("Gr6", 0)])
    expect(bars.map((b) => b.label)).toEqual(["Gr7"])
  })

  it("a grade with teams but no estimate is a row, never an alarm", () => {
    const [bar] = registrationBars([registered("Gr7", 12, 0)])
    expect(bar.expected).toBe(0)
    expect(bar.over).toBe(false)
    expect(bar.fill).toBe(1)
  })
})

describe("overPlanSentence", () => {
  it("says exactly what the operator would say out loud", () => {
    expect(overPlanSentence(registrationBars([registered("Grade 9", 30, 27)]))).toBe(
      "Grade 9 is 3 teams over plan."
    )
    expect(overPlanSentence(registrationBars([registered("Grade 9", 28, 27)]))).toBe(
      "Grade 9 is 1 team over plan."
    )
  })

  it("names every grade that outgrew its estimate, and stays quiet otherwise", () => {
    const bars = registrationBars([
      registered("Grade 9", 30, 27),
      registered("Grade 7", 9, 14),
      registered("Grade 10", 46, 44),
    ])
    expect(overPlanSentence(bars)).toBe(
      "Grade 9 is 3 teams over plan and Grade 10 is 2 teams over plan."
    )
    expect(overPlanSentence(registrationBars([registered("Grade 7", 9, 14)]))).toBeNull()
    expect(overPlanSentence([])).toBeNull()
  })
})

describe("weekendsNeedingAttention", () => {
  it("picks up the weekends that are over or tight, and nothing else", () => {
    seq = 0
    const state: PlannerState = {
      seasonId: "s",
      units: UNITS,
      errors: [],
      windows: [
        {
          label: "Nov 2026",
          weekends: [
            wk("Over", "2026-11-07", 24), // Gr9 = 25 games
            wk("Tight", "2026-11-14", 12), // Gr7 = 12 games, exactly full
            wk("Roomy", "2026-11-21", 100),
            wk("Idle", "2026-11-28", 100),
          ],
        },
      ],
    }
    const [over, tight, roomy, idle] = state.windows[0].weekends
    const flagged = weekendsNeedingAttention(state, {
      [over.sessionId]: ["age:Gr9"],
      [tight.sessionId]: ["age:Gr7"],
      [roomy.sessionId]: ["age:Gr8"],
      [idle.sessionId]: [],
    })
    expect(flagged.map((f) => f.label)).toEqual(["Over", "Tight"])
    expect(flagged[0].load.tone).toBe("over")
    expect(flagged[1].load.tone).toBe("tight")
  })

  it("leads with the broken weekend even when a merely full one comes first", () => {
    seq = 0
    const state: PlannerState = {
      seasonId: "s",
      units: UNITS,
      errors: [],
      windows: [
        { label: "Oct 2026", weekends: [wk("Full", "2026-10-24", 12)] }, // Gr7 = 12
        { label: "Nov 2026", weekends: [wk("Short", "2026-11-21", 24)] }, // Gr9 = 25
      ],
    }
    const [full] = state.windows[0].weekends
    const [short] = state.windows[1].weekends
    const flagged = weekendsNeedingAttention(state, {
      [full.sessionId]: ["age:Gr7"],
      [short.sessionId]: ["age:Gr9"],
    })
    expect(flagged.map((f) => f.label)).toEqual(["Short", "Full"])
  })

  it("a weekend holding grades with no gym at all is over, not quietly ignored", () => {
    seq = 0
    const state: PlannerState = {
      seasonId: "s",
      units: UNITS,
      errors: [],
      windows: [{ label: "Nov 2026", weekends: [wk("No gym", "2026-11-07", 0)] }],
    }
    const flagged = weekendsNeedingAttention(state, {
      [state.windows[0].weekends[0].sessionId]: ["age:Gr7"],
    })
    expect(flagged).toHaveLength(1)
    expect(flagged[0].load.tone).toBe("over")
  })

  it("the default plan on the NPH shape has nothing to flag", () => {
    const state = nphState()
    const flagged = weekendsNeedingAttention(state, proposePlan(state, "balance"))
    // RE-PINNED 2026-08-03 (compact-first). The month now lands whole on one
    // 176-slot weekend: 146 games, 83% of the courts, under the 85% line. The
    // old pin was Dec 12–13 at 74 of 80, a weekend the compact plan does not
    // use at all. The tight and over paths are pinned on their own above.
    expect(flagged).toEqual([])
  })
})

describe("diffAssignments", () => {
  const clone = (plan: Record<string, string[]>) =>
    Object.fromEntries(Object.entries(plan).map(([sid, keys]) => [sid, [...keys]]))

  const drop = (plan: Record<string, string[]>, sessionId: string, key: string) => {
    const next = clone(plan)
    next[sessionId] = (next[sessionId] ?? []).filter((k) => k !== key)
    return next
  }

  const add = (plan: Record<string, string[]>, sessionId: string, key: string) => {
    const next = clone(plan)
    next[sessionId] = [...(next[sessionId] ?? []), key]
    return next
  }

  const at = (diff: ReturnType<typeof diffAssignments>, sessionId: string) =>
    diff.weekends.find((w) => w.sessionId === sessionId)!

  /** The weekend a plan puts a grade on inside one window. */
  const homeOf = (state: PlannerState, plan: Record<string, string[]>, win: number, key: string) =>
    state.windows[win].weekends.find((w) => (plan[w.sessionId] ?? []).includes(key))!.sessionId

  it("an identical calendar agrees on every placement", () => {
    const state = nphState()
    const kept = proposePlan(state, "balance")
    const diff = diffAssignments(state, kept, kept)
    const placed = Object.values(kept).reduce((n, keys) => n + keys.length, 0)
    expect(diff.summary.placements).toBe(placed)
    expect(diff.summary.agreedCount).toBe(placed)
    expect(diff.summary.moved).toHaveLength(0)
    expect(diff.summary.missing).toHaveLength(0)
    expect(diff.summary.extra).toHaveLength(0)
    expect(diff.weekends.every((w) => w.added.length === 0 && w.removed.length === 0)).toBe(true)
    // Every weekend of the board is in the diff, quiet ones included.
    expect(diff.weekends).toHaveLength(13)
  })

  it("same month, different weekend, is a move (not a hole and a surprise)", () => {
    const state = nphState()
    const kept = proposePlan(state, "balance")
    const from = homeOf(state, kept, 0, "age:Gr7")
    const to = state.windows[0].weekends.find((w) => w.sessionId !== from)!.sessionId
    const board = add(drop(kept, from, "age:Gr7"), to, "age:Gr7")

    const diff = diffAssignments(state, kept, board)
    expect(diff.summary.moved).toEqual([
      { unitKey: "age:Gr7", fromSessionId: from, toSessionId: to },
    ])
    expect(diff.summary.missing).toHaveLength(0)
    expect(diff.summary.extra).toHaveLength(0)
    expect(diff.summary.agreedCount).toBe(diff.summary.placements - 1)
    expect(at(diff, from).removed).toEqual(["age:Gr7"])
    expect(at(diff, from).agreed).not.toContain("age:Gr7")
    expect(at(diff, to).added).toEqual(["age:Gr7"])
  })

  it("a grade taken off the month with nowhere to land is missing", () => {
    const state = nphState()
    const kept = proposePlan(state, "balance")
    const from = homeOf(state, kept, 1, "age:Gr10")
    const diff = diffAssignments(state, kept, drop(kept, from, "age:Gr10"))

    expect(diff.summary.missing).toEqual(["age:Gr10"])
    expect(diff.summary.moved).toHaveLength(0)
    expect(diff.summary.extra).toHaveLength(0)
    expect(at(diff, from).removed).toEqual(["age:Gr10"])
  })

  it("a placement the kept calendar never made that month is extra", () => {
    const state = nphState()
    const kept = proposePlan(state, "balance")
    const other = state.windows[2].weekends.find(
      (w) => !(kept[w.sessionId] ?? []).includes("age:Gr8")
    )!.sessionId
    const diff = diffAssignments(state, kept, add(kept, other, "age:Gr8"))

    expect(diff.summary.extra).toEqual(["age:Gr8"])
    expect(diff.summary.moved).toHaveLength(0)
    expect(diff.summary.missing).toHaveLength(0)
    expect(diff.summary.agreedCount).toBe(diff.summary.placements)
    expect(at(diff, other).added).toEqual(["age:Gr8"])
  })

  it("a grade that jumps months is missing there and extra here, never a move", () => {
    const state = nphState()
    const kept = proposePlan(state, "balance")
    const octHome = homeOf(state, kept, 0, "age:Gr11")
    const novFree = state.windows[1].weekends.find(
      (w) => !(kept[w.sessionId] ?? []).includes("age:Gr11")
    )!.sessionId
    const diff = diffAssignments(
      state,
      kept,
      add(drop(kept, octHome, "age:Gr11"), novFree, "age:Gr11")
    )

    expect(diff.summary.moved).toHaveLength(0)
    expect(diff.summary.missing).toEqual(["age:Gr11"])
    expect(diff.summary.extra).toEqual(["age:Gr11"])
  })

  it("agreed + moved + missing always accounts for every kept placement", () => {
    const state = nphState()
    const kept = proposePlan(state, "balance")
    let board = drop(kept, homeOf(state, kept, 0, "age:Gr9"), "age:Gr9")
    board = add(board, state.windows[0].weekends[0].sessionId, "age:JrGirls")
    board = drop(board, homeOf(state, kept, 3, "age:Gr12"), "age:Gr12")
    board = add(board, homeOf(state, kept, 3, "age:Gr7"), "age:Gr12")

    const { summary } = diffAssignments(state, kept, board)
    expect(summary.agreedCount + summary.moved.length + summary.missing.length).toBe(
      summary.placements
    )
  })

  it("ignores grades and weekends the board does not know about", () => {
    const state = nphState()
    const kept = proposePlan(state, "balance")
    const noisy = add(clone(kept), state.windows[0].weekends[0].sessionId, "age:Deleted")
    noisy["not-a-weekend-of-this-season"] = ["age:Gr7"]
    const diff = diffAssignments(state, noisy, kept)

    expect(diff.summary.missing).toHaveLength(0)
    expect(diff.summary.extra).toHaveLength(0)
    expect(diff.summary.agreedCount).toBe(diff.summary.placements)
    expect(diff.weekends.some((w) => w.sessionId === "not-a-weekend-of-this-season")).toBe(false)
  })
})
