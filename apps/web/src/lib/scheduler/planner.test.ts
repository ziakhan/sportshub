import { describe, expect, it } from "vitest"
import {
  diffAssignments,
  expectedTeamUpdates,
  gradeAbbrev,
  gradeLine,
  overPlanSentence,
  planSummary,
  planningSource,
  planningTeams,
  proposePlan,
  registrationBars,
  seasonCalendarMonths,
  suggestFor,
  weekendDays,
  weekendsNeedingAttention,
  TIGHT_RATIO,
  weekendDemand,
  weekendLoad,
  type PlannerState,
  type PlannerUnit,
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
 *  the one way the server builds it. */
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
    venues: [
      { venueId: "v1", name: "Six Park East", capacityGames: largestVenueCapacity },
      ...(capacityGames > largestVenueCapacity
        ? [{ venueId: "v2", name: "Playground", capacityGames: capacityGames - largestVenueCapacity }]
        : []),
    ],
    targetGamesPerTeam: 2,
    assigned: [],
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
      { label: "Oct 2026", weekends: [wk("Oct 24–25", "2026-10-24", 176, 96), wk("Oct 31–Nov 1", "2026-10-31", 176, 96)] },
      { label: "Nov 2026", weekends: [wk("Nov 14–15", "2026-11-14", 80, 48), wk("Nov 21–22", "2026-11-21", 176, 96), wk("Nov 28–29", "2026-11-28", 176, 96)] },
      { label: "Dec 2026", weekends: [wk("Dec 12–13", "2026-12-12", 80, 48), wk("Dec 19–20", "2026-12-19", 176, 96)] },
      { label: "Jan 2027", weekends: [wk("Jan 9–10", "2027-01-09", 176, 96), wk("Jan 16–17", "2027-01-16", 80, 48), wk("Jan 30–31", "2027-01-30", 176, 96)] },
      { label: "Feb 2027", weekends: [wk("Feb 6–7", "2027-02-06", 176, 96), wk("Feb 13–14", "2027-02-13", 80, 48), wk("Feb 20–21", "2027-02-20", 176, 96)] },
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
  it("balance: never overflows, and never exceeds the human plan's 84-game peak", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
    const rows = demandAt(state, plan)
    for (const r of rows) expect(r.demand).toBeLessThanOrEqual(r.capacity)
    expect(Math.max(...rows.map((r) => r.demand))).toBeLessThanOrEqual(84)
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

  it("compact uses no more weekends than balance; spread uses them all", () => {
    const state = nphState()
    const used = (plan: Record<string, string[]>) =>
      Object.values(plan).filter((k) => k.length > 0).length
    const compact = proposePlan(nphState(), "compact")
    const balance = proposePlan(nphState(), "balance")
    const spread = proposePlan(state, "spread")
    expect(used(compact)).toBeLessThanOrEqual(used(balance))
    // 7 units across 13 weekends: spread still can't use more weekends than
    // units-per-window allows, but every window's weekend count ≤ units, so
    // every weekend should host something.
    for (const win of state.windows) {
      for (const w of win.weekends) {
        expect((spread[w.sessionId] ?? []).length).toBeGreaterThan(0)
      }
    }
  })

  it("keeps the two giants (Gr10, Gr9) apart when capacity allows", () => {
    const state = nphState()
    const plan = proposePlan(state, "balance")
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
          weekends: [wk("A", "2026-11-07", 200), wk("B", "2026-11-14", 200), wk("C", "2026-11-21", 200)],
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
    expect(suggestions.some((s) => s.kind === "overflow" && s.sessionId === nov14.sessionId)).toBe(true)
    expect(suggestions.some((s) => s.kind === "move-unit")).toBe(true)
    expect(suggestions.some((s) => s.kind === "idle-weekend" && s.sessionId === oct24.sessionId)).toBe(true)
  })

  it("flags a two-building weekend", () => {
    const state = nphState()
    const feb6 = state.windows[4].weekends[0] // 176 cap, largest venue 96
    const assignment: Record<string, string[]> = {
      [feb6.sessionId]: ["age:Gr10", "age:Gr9", "age:Gr11", "age:Gr12"], // 117 > 96
    }
    const suggestions = suggestFor(state, assignment)
    expect(suggestions.some((s) => s.kind === "two-building" && s.sessionId === feb6.sessionId)).toBe(true)
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
    expect(weekendLoad(UNITS, wk("One gym", "2026-11-07", 176), [
      "age:Gr10",
      "age:Gr9",
      "age:Gr11",
      "age:Gr12",
    ]).twoBuildings).toBe(false)

    // Fits inside the big gym: no spill even with two venues attached.
    expect(
      weekendLoad(UNITS, wk("Fits", "2026-11-07", 176, 96), ["age:Gr9"]).twoBuildings
    ).toBe(false)
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
 * Owner ruling 2026-08-02: "I need to be able to edit every team count for
 * the planning mode even if teams are registered ... and you should plan
 * according to that number." The operator's number leads; registration is a
 * floor under it, never a ceiling over them.
 */
describe("planningTeams / planningSource", () => {
  it("plans on the operator's number when they planned bigger", () => {
    expect(planningTeams(9, 14)).toBe(14)
    expect(planningSource(9, 14)).toBe("expected")
  })

  it("never plans for fewer teams than have registered", () => {
    expect(planningTeams(30, 27)).toBe(30)
    expect(planningSource(30, 27)).toBe("approved")
  })

  it("falls back to whichever number exists", () => {
    expect(planningTeams(12, 0)).toBe(12)
    expect(planningSource(12, 0)).toBe("approved")
    expect(planningTeams(0, 25)).toBe(25)
    expect(planningSource(0, 25)).toBe("expected")
  })

  it("an equal estimate reads as registration, an empty grade as neither", () => {
    expect(planningSource(8, 8)).toBe("approved")
    expect(planningTeams(0, 0)).toBe(0)
    expect(planningSource(0, 0)).toBe("none")
  })

  it("carries into everything that plans on a unit", () => {
    // 14 expected against 9 registered: the weekend is sized for 14.
    const unit = registered("Gr7", 9, 14)
    expect(unit.teams).toBe(14)
    expect(weekendDemand([unit], { targetGamesPerTeam: 2 }, [unit.key])).toBe(14)
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

describe("seasonCalendarMonths", () => {
  const state = nphState()
  const weekendsOf = (label: string) =>
    state.windows.find((w) => w.label === label)!.weekends

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

  it("the balanced plan on the NPH shape overflows nowhere, and flags its one full house", () => {
    const state = nphState()
    const flagged = weekendsNeedingAttention(state, proposePlan(state, "balance"))
    // Nothing overflows, but Dec 12–13 is a Burlington-only 80-slot weekend
    // carrying 74 games: the one weekend a late entry would break.
    expect(flagged.every((f) => f.load.tone === "tight")).toBe(true)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].label).toBe("Dec 12–13")
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
    const diff = diffAssignments(state, kept, add(drop(kept, octHome, "age:Gr11"), novFree, "age:Gr11"))

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
