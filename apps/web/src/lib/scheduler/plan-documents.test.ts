import { describe, expect, it } from "vitest"
import {
  isReferencePlan,
  PLAN_NAME_MAX,
  planMarkers,
  planStateLine,
  suggestPlanName,
  type PlanRow,
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
