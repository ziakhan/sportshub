import { describe, expect, it } from "vitest"
import {
  activateConfirmText,
  DRIFT_LIMIT,
  isReferencePlan,
  PLAN_NAME_MAX,
  planDrift,
  planMarkers,
  planStateLine,
  suggestPlanName,
  type PlanRow,
  type PlanWorld,
  type PlanWorldVenue,
} from "./plan-documents"

/**
 * The pure half of plans as documents: what the dropdown says about a row, the
 * name it offers when you save, and the one line that tells the operator
 * whether the thing on their screen is saved and whether the season runs it.
 */

const row = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "p1",
  name: "Our plan",
  source: "manual",
  isActive: false,
  updatedAt: "2026-08-02T00:00:00.000Z",
  ...over,
})

describe("planMarkers", () => {
  it("says active and reference, and nothing about an ordinary plan", () => {
    expect(planMarkers(row())).toEqual([])
    expect(planMarkers(row({ isActive: true }))).toEqual(["active"])
    expect(planMarkers(row({ source: "imported" }))).toEqual(["reference"])
    // The season's own published calendar is both, and says both.
    expect(planMarkers(row({ source: "imported", isActive: true }))).toEqual([
      "active",
      "reference",
    ])
  })

  it("knows which plan the board may never write onto", () => {
    expect(isReferencePlan(row({ source: "imported" }))).toBe(true)
    expect(isReferencePlan(row({ source: "proposed" }))).toBe(false)
    expect(isReferencePlan(null)).toBe(false)
  })
})

describe("suggestPlanName", () => {
  it("offers the plain name when it is free", () => {
    expect(suggestPlanName([])).toBe("Our plan")
    expect(suggestPlanName([row({ name: "NPH plan" })])).toBe("Our plan")
  })

  it("counts up past the names already taken, ignoring case and padding", () => {
    expect(suggestPlanName([row({ name: "Our plan" })])).toBe("Our plan 2")
    expect(suggestPlanName([row({ name: " our PLAN " }), row({ name: "Our plan 2" })])).toBe(
      "Our plan 3"
    )
  })

  it("copies a plan by name", () => {
    expect(suggestPlanName([row({ name: "NPH plan" })], "NPH plan copy")).toBe("NPH plan copy")
    expect(
      suggestPlanName([row({ name: "NPH plan" }), row({ name: "NPH plan copy" })], "NPH plan copy")
    ).toBe("NPH plan copy 2")
  })

  it("never suggests a name the API would reject", () => {
    const long = "x".repeat(80)
    expect(suggestPlanName([], long)).toHaveLength(PLAN_NAME_MAX)
    const taken = [row({ name: "x".repeat(PLAN_NAME_MAX) })]
    const next = suggestPlanName(taken, long)
    expect(next.length).toBeLessThanOrEqual(PLAN_NAME_MAX)
    expect(next.endsWith(" 2")).toBe(true)
  })
})

/* ---------------------------- the plan's world ---------------------------- */

const PARK = "v-park"
const PLAYGROUND = "v-playground"

const gym = (venueId: string, capacityGames: number, fillOrder = 0): PlanWorldVenue => ({
  venueId,
  name: venueId === PARK ? "Six Park" : "The Playground",
  capacityGames,
  fillOrder,
})

/** The same gym under venue model v2, which names what the league OWNS
 *  (owner ruling 2026-08-03). A world built from these carries roles, so the
 *  drift sentence talks about the home gym instead of fill order. */
const roled = (venueId: string, capacityGames: number, role: "home" | "pool"): PlanWorldVenue => ({
  ...gym(venueId, capacityGames),
  role,
})

/** Three weekends across two months, both gyms open, the shape the board
 *  actually hands around. */
function world(
  over: {
    capacity?: Record<string, number>
    venues?: (label: string) => PlanWorldVenue[]
    teams?: Record<string, number>
    units?: Array<{ key: string; label: string; teams: number }>
    target?: (label: string) => number
    gamesPerTeam?: number
    weekends?: string[]
  } = {}
): PlanWorld {
  const labels = over.weekends ?? ["Oct 24–25", "Nov 7–8", "Dec 19–20"]
  const venuesFor = over.venues ?? (() => [gym(PARK, 108, 0), gym(PLAYGROUND, 48, 1)])
  const units = over.units ?? [
    { key: "age:Grade 11", label: "Grade 11", teams: 18 },
    { key: "age:Grade 12", label: "Grade 12", teams: 27 },
  ]
  return {
    units: units.map((u) => ({ ...u, teams: over.teams?.[u.label] ?? u.teams })),
    gamesPerTeam: over.gamesPerTeam ?? 20,
    windows: [
      {
        label: "Oct 2026",
        weekends: labels.slice(0, 2).map((label) => ({
          sessionId: `s-${label}`,
          label,
          capacityGames: over.capacity?.[label] ?? venuesFor(label).reduce((s, v) => s + v.capacityGames, 0),
          targetGamesPerTeam: over.target?.(label) ?? 2,
          venues: venuesFor(label),
        })),
      },
      {
        label: "Dec 2026",
        weekends: labels.slice(2).map((label) => ({
          sessionId: `s-${label}`,
          label,
          capacityGames: over.capacity?.[label] ?? venuesFor(label).reduce((s, v) => s + v.capacityGames, 0),
          targetGamesPerTeam: over.target?.(label) ?? 2,
          venues: venuesFor(label),
        })),
      },
    ],
  }
}

describe("planDrift", () => {
  it("says nothing when the world has not moved", () => {
    expect(planDrift(world(), world())).toEqual([])
  })

  it("aggregates a gym that changed everywhere into one all-season line", () => {
    const live = world({ venues: () => [gym(PARK, 54, 0), gym(PLAYGROUND, 48, 1)] })
    const drift = planDrift(world(), live)
    expect(drift).toEqual([
      "Six Park holds 108 games all season in this plan; the season now gives it 54.",
    ])
  })

  it("names the weekend when only one of them changed", () => {
    const live = world({
      venues: (label) =>
        label === "Dec 19–20" ? [gym(PARK, 54, 0), gym(PLAYGROUND, 48, 1)] : [gym(PARK, 108, 0), gym(PLAYGROUND, 48, 1)],
    })
    expect(planDrift(world(), live)).toEqual([
      "Six Park holds 108 games on Dec 19–20 in this plan; the season now gives it 54.",
    ])
  })

  it("says every weekend it is open for a gym the season does not open all season", () => {
    // The Playground is open on the first two weekends only, and lost half its
    // courts on both. "on 2 weekends" would make the operator go and count.
    const parkOnly = [gym(PARK, 108, 0)]
    const saved = world({
      venues: (label) => (label === "Dec 19–20" ? parkOnly : [gym(PARK, 108, 0), gym(PLAYGROUND, 48, 1)]),
    })
    const live = world({
      venues: (label) => (label === "Dec 19–20" ? parkOnly : [gym(PARK, 108, 0), gym(PLAYGROUND, 24, 1)]),
    })
    expect(planDrift(saved, live)).toEqual([
      "The Playground holds 48 games every weekend it is open in this plan; the season now gives it 24.",
    ])
  })

  it("counts the weekends when a gym moved more than one way", () => {
    const live = world({
      venues: (label) =>
        label === "Oct 24–25"
          ? [gym(PARK, 54, 0), gym(PLAYGROUND, 48, 1)]
          : label === "Dec 19–20"
            ? [gym(PARK, 72, 0), gym(PLAYGROUND, 48, 1)]
            : [gym(PARK, 108, 0), gym(PLAYGROUND, 48, 1)],
    })
    expect(planDrift(world(), live)).toEqual([
      "Six Park holds a different number of games on Oct 24–25 and Dec 19–20 now (Oct 24–25: 108 in this plan, 54 in the season).",
    ])
  })

  it("says a gym came or went, in one line either way", () => {
    const oneGym = world({ venues: () => [gym(PARK, 108, 0)] })
    expect(planDrift(world(), oneGym)).toEqual([
      "The season does not open The Playground any more, and this plan uses it all season.",
    ])
    expect(planDrift(oneGym, world())).toEqual([
      "The season now opens The Playground every weekend, and this plan never uses it.",
    ])
  })

  it("says which gym the league fills first when a PRE-ROLES plan flips it", () => {
    // Neither world names what the league owns, so the honest comparison is
    // the one the plan was saved under: which gym filled first.
    const flipped = world({ venues: () => [gym(PARK, 108, 1), gym(PLAYGROUND, 48, 0)] })
    expect(planDrift(world(), flipped)).toEqual([
      "This plan fills Six Park, then The Playground; the season now fills The Playground, then Six Park.",
    ])
  })

  it("says the home gym moved, which is what a weekend now costs", () => {
    const owned = (home: string) =>
      world({
        venues: () => [
          roled(PARK, 108, home === PARK ? "home" : "pool"),
          roled(PLAYGROUND, 48, home === PLAYGROUND ? "home" : "pool"),
        ],
      })
    expect(planDrift(owned(PARK), owned(PLAYGROUND))).toEqual([
      "This plan treats Six Park as the home gym; the season now owns The Playground.",
    ])
    // And a season that used to own a building and now rents everything.
    const rented = world({ venues: () => [roled(PARK, 108, "pool"), roled(PLAYGROUND, 48, "pool")] })
    expect(planDrift(owned(PARK), rented)).toEqual([
      "This plan treats Six Park as the home gym; the season now rents every gym.",
    ])
    expect(planDrift(rented, owned(PARK))).toEqual([
      "The season now owns Six Park; this plan rents every gym.",
    ])
  })

  it("says what a grade was planned at and what the season expects now", () => {
    const drift = planDrift(world(), world({ teams: { "Grade 12": 30 } }))
    expect(drift).toEqual(["Grade 12 planned at 27 teams; the season now expects 30."])
  })

  it("says grades that arrived or left, in one line each", () => {
    const fewer = world({ units: [{ key: "age:Grade 11", label: "Grade 11", teams: 18 }] })
    expect(planDrift(world(), fewer)).toEqual([
      "Grade 12 is in this plan but is not in the season any more.",
    ])
    expect(planDrift(fewer, world())).toEqual([
      "The season has added Grade 12, which this plan never placed.",
    ])
  })

  it("says when a weekend of the plan is not part of the season any more", () => {
    const shorter = world({ weekends: ["Oct 24–25", "Nov 7–8"] })
    expect(planDrift(world(), shorter)[0]).toBe(
      "Dec 19–20 is not a weekend of this season any more, and this plan uses it."
    )
    expect(planDrift(shorter, world())[0]).toBe(
      "Dec 19–20 is a new weekend the season did not have when this plan was saved."
    )
  })

  it("says the games each team gets, weekend by weekend and for the season", () => {
    expect(planDrift(world(), world({ target: () => 3 }))).toEqual([
      "Each team played 2 games a weekend all season in this plan; the season now plans 3.",
    ])
    expect(planDrift(world(), world({ gamesPerTeam: 24 }))).toEqual([
      "Every team was promised 20 games this season in the plan; the season now promises 24.",
    ])
  })

  it("falls back to the weekend total when a world carries no per-gym detail", () => {
    const bare = (capacity: number): PlanWorld => ({
      units: [{ key: "age:Grade 11", label: "Grade 11", teams: 18 }],
      windows: [
        {
          label: "Oct 2026",
          weekends: [
            { sessionId: "s1", label: "Oct 24–25", capacityGames: capacity, targetGamesPerTeam: 2, venues: [] },
          ],
        },
      ],
    })
    expect(planDrift(bare(120), bare(90))).toEqual([
      "Oct 24–25 holds 120 games in this plan; the season now gives it 90.",
    ])
  })

  it("never says the same weekend twice: a gym line silences the hours fallback", () => {
    // Six Park loses half its courts, so the weekend total moves with it.
    const live = world({
      venues: () => [gym(PARK, 54, 0), gym(PLAYGROUND, 48, 1)],
      capacity: { "Oct 24–25": 102, "Nov 7–8": 102, "Dec 19–20": 102 },
    })
    const drift = planDrift(world(), live)
    expect(drift).toHaveLength(1)
    expect(drift[0]).toContain("Six Park holds 108 games all season")
  })

  it("stops at six differences and counts the rest", () => {
    const many = world({
      venues: () => [gym(PARK, 54, 2), gym(PLAYGROUND, 24, 0)],
      units: [
        { key: "age:Grade 11", label: "Grade 11", teams: 20 },
        { key: "age:Grade 9", label: "Grade 9", teams: 12 },
      ],
      target: () => 3,
      gamesPerTeam: 24,
      weekends: ["Oct 24–25", "Nov 7–8", "Jan 9–10"],
    })
    const drift = planDrift(world(), many)
    expect(drift).toHaveLength(DRIFT_LIMIT + 1)
    expect(drift[DRIFT_LIMIT]).toMatch(/^and \d+ more differences\.$/)
    // The structural news leads: the plan's weekend is gone.
    expect(drift[0]).toContain("Dec 19–20 is not a weekend")
  })

  it("says one more difference in the singular", () => {
    // Seven differences exactly: six shown, one counted.
    const base = world({
      units: [
        { key: "age:Grade 7", label: "Grade 7", teams: 10 },
        { key: "age:Grade 8", label: "Grade 8", teams: 11 },
        { key: "age:Grade 9", label: "Grade 9", teams: 12 },
        { key: "age:Grade 10", label: "Grade 10", teams: 13 },
        { key: "age:Grade 11", label: "Grade 11", teams: 14 },
        { key: "age:Grade 12", label: "Grade 12", teams: 15 },
      ],
    })
    const moved = world({
      units: [
        { key: "age:Grade 7", label: "Grade 7", teams: 20 },
        { key: "age:Grade 8", label: "Grade 8", teams: 21 },
        { key: "age:Grade 9", label: "Grade 9", teams: 22 },
        { key: "age:Grade 10", label: "Grade 10", teams: 23 },
        { key: "age:Grade 11", label: "Grade 11", teams: 24 },
        { key: "age:Grade 12", label: "Grade 12", teams: 25 },
      ],
      gamesPerTeam: 24,
    })
    const drift = planDrift(base, moved)
    expect(drift[DRIFT_LIMIT]).toBe("and 1 more difference.")
  })
})

describe("activateConfirmText", () => {
  it("asks the plain question when nothing drifted", () => {
    expect(activateConfirmText("Our plan", [])).toBe(
      "Use Our plan for the season? The calendar everyone sees becomes this one."
    )
  })

  it("lists the drift and names what activating leaves alone", () => {
    const text = activateConfirmText("Our plan", ["Grade 12 planned at 27 teams; the season now expects 30."])
    expect(text).toContain("Grade 12 planned at 27 teams")
    expect(text).toContain(
      "Activating applies this plan's calendar. The season keeps its current gyms, hours and estimates."
    )
  })
})

describe("planStateLine", () => {
  const active = row({ id: "a", name: "NPH plan", source: "imported", isActive: true })

  it("tells an unsaved board whose changes they are", () => {
    expect(planStateLine({ selected: active, active, dirty: true })).toContain("your own")
    expect(planStateLine({ selected: row({ name: "Ours" }), active, dirty: true })).toBe(
      "Changes to Ours are not saved yet."
    )
  })

  it("says a season with no plans at all has nothing saved", () => {
    expect(planStateLine({ selected: null, active: null, dirty: true })).toContain("Nothing is saved")
  })

  it("separates saved from running the season", () => {
    expect(planStateLine({ selected: active, active, dirty: false })).toBe(
      "NPH plan is the season's calendar."
    )
    expect(planStateLine({ selected: row({ name: "Ours" }), active, dirty: false })).toBe(
      "Saved to Ours. The season still runs NPH plan."
    )
    expect(planStateLine({ selected: row({ name: "Ours" }), active: null, dirty: false })).toBe(
      "Saved to Ours."
    )
  })
})
