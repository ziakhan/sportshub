import { describe, expect, it } from "vitest"
import {
  resolveWeekendVenues,
  seasonVenueOrder,
  venueHueSlots,
  venueLine,
  venueShortName,
  type VenueGridLike,
} from "./venue-strip"

/**
 * The season strip's gym row (plan step 3, owner 2026-08-02). Names here are
 * the demo world's real ones: "Six Park East" in Toronto and "The Playground"
 * in Burlington, which the owner reads as "Six Park + Playground".
 */

const SIX = "venue-six"
const PLAY = "venue-playground"

const grid = (cells: Record<string, Array<"on" | "off" | "custom">>): VenueGridLike => ({
  venues: [
    {
      venueId: SIX,
      name: "Six Park East",
      city: "Toronto",
      cells: cells[SIX].map((state, i) => ({ sessionId: `s${i + 1}`, state })),
    },
    {
      venueId: PLAY,
      name: "The Playground",
      city: "Burlington",
      cells: cells[PLAY].map((state, i) => ({ sessionId: `s${i + 1}`, state })),
    },
  ],
})

const weekend = (sessionId: string, venueIds: string[] = []) => ({
  sessionId,
  venues: venueIds.map((venueId) => ({
    venueId,
    name: venueId === SIX ? "Six Park East" : "The Playground",
  })),
})

describe("venueShortName", () => {
  it("keeps the words a gym is actually called by", () => {
    expect(venueShortName("Six Park East", "Toronto")).toBe("Six Park")
    expect(venueShortName("The Playground", "Burlington")).toBe("Playground")
  })

  it("drops a city the name repeats", () => {
    expect(venueShortName("The Playground Burlington", "Burlington")).toBe("Playground")
    // Not a repeat: the city is the gym's first word, so it stays.
    expect(venueShortName("Burlington Sports Complex", "Burlington")).toBe("Burlington")
  })

  it("drops building words, never the name itself", () => {
    expect(venueShortName("Six Nations Sports Complex")).toBe("Six Nations")
    expect(venueShortName("Oakville Trafalgar High School")).toBe("Oakville")
    expect(venueShortName("Gym")).toBe("Gym")
  })

  it("fits a weekend column", () => {
    expect(venueShortName("Mississauga Valleys Community Centre").length).toBeLessThanOrEqual(14)
    expect(venueShortName("Northumberland Regional Fieldhouse").length).toBeLessThanOrEqual(14)
  })

  it("is total", () => {
    expect(venueShortName("")).toBe("")
    expect(venueShortName("   ")).toBe("")
  })
})

describe("resolveWeekendVenues", () => {
  it("reads the operator's own on/off answer, in season order", () => {
    const map = resolveWeekendVenues(
      grid({ [SIX]: ["on", "on", "off"], [PLAY]: ["on", "off", "off"] }),
      [weekend("s1"), weekend("s2"), weekend("s3")]
    )
    expect(map.get("s1")?.map((v) => v.short)).toEqual(["Six Park", "Playground"])
    expect(map.get("s2")?.map((v) => v.short)).toEqual(["Six Park"])
    expect(map.get("s3")).toEqual([])
  })

  it("counts a custom-hours weekend as on", () => {
    const map = resolveWeekendVenues(grid({ [SIX]: ["custom"], [PLAY]: ["off"] }), [weekend("s1")])
    expect(map.get("s1")?.map((v) => v.short)).toEqual(["Six Park"])
  })

  it("never fills a weekend the operator emptied", () => {
    // The planner still has capacity cached on the weekend; the grid says both
    // gyms are released. The grid wins, because that is the operator's answer.
    const map = resolveWeekendVenues(grid({ [SIX]: ["off"], [PLAY]: ["off"] }), [
      weekend("s1", [SIX, PLAY]),
    ])
    expect(map.get("s1")).toEqual([])
  })

  it("falls back to the planner for a weekend the grid has never seen", () => {
    const map = resolveWeekendVenues(grid({ [SIX]: ["on"], [PLAY]: ["on"] }), [
      weekend("s1"),
      weekend("s9", [PLAY]),
    ])
    expect(map.get("s9")?.map((v) => v.short)).toEqual(["Playground"])
  })

  it("works with no grid at all", () => {
    const map = resolveWeekendVenues(null, [weekend("s1", [SIX, PLAY])])
    expect(map.get("s1")?.map((v) => v.short)).toEqual(["Six Park", "Playground"])
  })
})

describe("seasonVenueOrder and venueHueSlots", () => {
  it("puts the grid's order first and adds planner-only gyms after", () => {
    const order = seasonVenueOrder(grid({ [SIX]: ["on"], [PLAY]: ["on"] }), [
      weekend("s1", [PLAY]),
      { sessionId: "s2", venues: [{ venueId: "venue-third", name: "Third Gym" }] },
    ])
    expect(order.map((v) => v.venueId)).toEqual([SIX, PLAY, "venue-third"])
  })

  it("gives every gym its own colour until the palette runs out", () => {
    const slots = venueHueSlots([SIX, PLAY, "c", "d", "e"], 4)
    expect(slots.get(SIX)).toBe(0)
    expect(slots.get(PLAY)).toBe(1)
    expect(slots.get("e")).toBe(0)
    // Same list, same colours, every render.
    expect([...venueHueSlots([SIX, PLAY], 4)]).toEqual([...venueHueSlots([SIX, PLAY], 4)])
  })
})

describe("venueLine", () => {
  const six = { venueId: SIX, name: "Six Park East", short: "Six Park" }
  const play = { venueId: PLAY, name: "The Playground", short: "Playground" }

  it("says what is open that weekend", () => {
    expect(venueLine([six, play], 2)).toBe("Six Park + Playground")
    expect(venueLine([six], 2)).toBe("Six Park only")
    expect(venueLine([six], 1)).toBe("Six Park")
    expect(venueLine([], 2)).toBe("no gym")
  })
})
