import { describe, expect, it } from "vitest"
import { enumerateSeasonWeekends } from "./venue-grid"

/**
 * Every weekend of the season, not just the ones that already exist (owner
 * 2026-08-02: "make it open for every month, all weekends, and people can
 * choose because we currently don't have visibility").
 *
 * Dates here are the real NPH 2026-27 shape: Saturdays are Oct 3, 10, 17, 24,
 * 31; Nov 1 is a Sunday.
 */

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const weekend = (sat: string) => [day(sat), day(nextDay(sat))]

function nextDay(iso: string): string {
  const d = day(iso)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const sats = (cols: Array<{ satDateISO: string | null }>) =>
  cols.map((c) => c.satDateISO?.slice(0, 10) ?? null)

describe("enumerateSeasonWeekends", () => {
  it("gives a season with dates and no sessions every weekend of every month", () => {
    const cols = enumerateSeasonWeekends({
      start: day("2026-11-15"),
      end: day("2026-12-15"),
      sessions: [],
    })

    // Widened to whole months: Nov 1 through Dec 31.
    expect(sats(cols)).toEqual([
      "2026-11-07",
      "2026-11-14",
      "2026-11-21",
      "2026-11-28",
      "2026-12-05",
      "2026-12-12",
      "2026-12-19",
      "2026-12-26",
    ])
    expect(cols.every((c) => c.sessionId === null)).toBe(true)
    expect(cols.every((c) => c.dayCount === 2)).toBe(true)
    expect(cols.map((c) => c.month)).toEqual([
      "Nov", "Nov", "Nov", "Nov", "Dec", "Dec", "Dec", "Dec",
    ])
  })

  it("derives the span from the season's own days when it has no dates", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [{ id: "s1", days: weekend("2026-10-24") }],
    })

    expect(sats(cols)).toEqual([
      "2026-10-03",
      "2026-10-10",
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
    ])
    // Only the weekend that really exists carries a session.
    expect(cols.filter((c) => c.sessionId).map((c) => c.sessionId)).toEqual(["s1"])
    expect(cols[3].label).toBe("Oct 24–25")
    expect(cols[3].dayLabel).toBe("24–25")
  })

  it("spans the widest of the season's dates and the weekends it already plays", () => {
    const cols = enumerateSeasonWeekends({
      // The declared season starts in November, but October is already played.
      start: day("2026-11-01"),
      end: day("2026-12-31"),
      sessions: [{ id: "s1", days: weekend("2026-10-24") }],
    })

    expect(sats(cols)[0]).toBe("2026-10-03")
    expect(sats(cols).at(-1)).toBe("2026-12-26")
    expect(cols.find((c) => c.satDateISO === day("2026-10-24").toISOString())?.sessionId).toBe("s1")
  })

  it("labels a weekend that straddles two months by both", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [{ id: "s1", days: weekend("2026-10-31") }],
    })
    const col = cols.find((c) => c.sessionId === "s1")!
    expect(col.label).toBe("Oct 31–Nov 1")
    expect(col.dayLabel).toBe("31–Nov 1")
    expect(col.month).toBe("Oct")
  })

  it("keeps a session whose days are not a weekend, without inventing a twin", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [
        { id: "wed", days: [day("2026-10-21")] },
        { id: "sat", days: weekend("2026-10-24") },
      ],
    })

    const odd = cols.find((c) => c.sessionId === "wed")!
    expect(odd.satDateISO).toBeNull()
    expect(odd.key).toBe("session:wed")
    expect(odd.dayCount).toBe(1)
    // Still in date order, between Oct 17 and Oct 24.
    expect(sats(cols)).toEqual([
      "2026-10-03",
      "2026-10-10",
      "2026-10-17",
      null,
      "2026-10-24",
      "2026-10-31",
    ])
  })

  it("counts a Friday–Saturday session as owning its Saturday", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [{ id: "fri", days: [day("2026-10-23"), day("2026-10-24")] }],
    })
    // No second, permanently-off column for Oct 24.
    expect(cols.filter((c) => c.satDateISO === day("2026-10-24").toISOString())).toHaveLength(0)
    expect(cols.filter((c) => c.sessionId === "fri")).toHaveLength(1)
    expect(sats(cols)).toEqual(["2026-10-03", "2026-10-10", "2026-10-17", null, "2026-10-31"])
  })

  it("hands a Sunday-only session the weekend it belongs to", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [{ id: "sun", days: [day("2026-11-01")] }],
    })
    const col = cols.find((c) => c.sessionId === "sun")!
    expect(col.satDateISO).toBe(day("2026-10-31").toISOString())
    // The span is November (the day it plays), and the session's own weekend
    // leads the strip even though its Saturday sits in the month before.
    expect(sats(cols)).toEqual([
      "2026-10-31",
      "2026-11-07",
      "2026-11-14",
      "2026-11-21",
      "2026-11-28",
    ])
  })

  it("carries the phase so a finals weekend is never double-booked", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [
        { id: "reg", phase: "REGULAR", days: weekend("2026-10-24") },
        { id: "fin", phase: "PLAYOFF", days: weekend("2026-10-31") },
      ],
    })
    expect(cols.find((c) => c.sessionId === "fin")?.phase).toBe("PLAYOFF")
    expect(cols.find((c) => c.sessionId === "reg")?.phase).toBe("REGULAR")
    expect(cols.find((c) => c.sessionId === null)?.phase).toBeNull()
  })

  it("gives two sessions on one weekend a column each", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [
        { id: "a", days: weekend("2026-10-24") },
        { id: "b", days: weekend("2026-10-24") },
      ],
    })
    const onThatWeekend = cols.filter((c) => c.satDateISO === day("2026-10-24").toISOString())
    expect(onThatWeekend.map((c) => c.sessionId)).toEqual(["a", "b"])
    expect(new Set(cols.map((c) => c.key)).size).toBe(cols.length)
  })

  it("returns nothing for a season with no dates and no sessions", () => {
    expect(enumerateSeasonWeekends({ start: null, end: null, sessions: [] })).toEqual([])
  })

  it("ignores a session with no days at all", () => {
    const cols = enumerateSeasonWeekends({
      start: day("2026-10-01"),
      end: day("2026-10-31"),
      sessions: [{ id: "empty", days: [] }],
    })
    expect(cols).toHaveLength(5)
    expect(cols.every((c) => c.sessionId === null)).toBe(true)
  })

  it("accepts ISO strings as well as dates", () => {
    const cols = enumerateSeasonWeekends({
      start: "2026-10-01T00:00:00.000Z",
      end: "2026-10-31T00:00:00.000Z",
      sessions: [{ id: "s1", days: ["2026-10-24T00:00:00.000Z", "2026-10-25T00:00:00.000Z"] }],
    })
    expect(sats(cols)).toHaveLength(5)
    expect(cols.find((c) => c.sessionId === "s1")?.dayCount).toBe(2)
  })
})
