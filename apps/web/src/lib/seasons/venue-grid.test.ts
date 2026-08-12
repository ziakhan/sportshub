import { describe, expect, it } from "vitest"
import { enumerateSeasonWeekends, venueCellState } from "./venue-grid"

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
  it("gives a season with dates and no sessions every weekend INSIDE its dates", () => {
    // The season's own start and end define the supply (owner 2026-08-07):
    // no weekend is offered before the start or after the end. A weekend
    // counts as inside when any of it touches the span — Nov 14-15 stays,
    // because its Sunday IS the start date.
    const cols = enumerateSeasonWeekends({
      start: day("2026-11-15"),
      end: day("2026-12-15"),
      sessions: [],
    })

    expect(sats(cols)).toEqual([
      "2026-11-14",
      "2026-11-21",
      "2026-11-28",
      "2026-12-05",
      "2026-12-12",
    ])
    expect(cols.every((c) => c.sessionId === null)).toBe(true)
    expect(cols.every((c) => c.dayCount === 2)).toBe(true)
    expect(cols.map((c) => c.month)).toEqual(["Nov", "Nov", "Nov", "Dec", "Dec"])
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

  it("keeps a real session outside the dates, but offers no bare weekend there", () => {
    const cols = enumerateSeasonWeekends({
      // The declared season starts in November, but October is already played.
      start: day("2026-11-01"),
      end: day("2026-12-31"),
      sessions: [{ id: "s1", days: weekend("2026-10-24") }],
    })

    // The played weekend keeps its column wherever it falls; the empty
    // October Saturdays around it are not supply this season declares.
    expect(sats(cols)[0]).toBe("2026-10-24")
    expect(cols[0].sessionId).toBe("s1")
    // Oct 31 stays: its Sunday is Nov 1, which touches the declared span.
    expect(sats(cols)[1]).toBe("2026-10-31")
    expect(sats(cols).at(-1)).toBe("2026-12-26")
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

  /** RE-PINNED for QA T-015 (tester ruling 2026-08-11): league days are
   *  Fri/Sat/Sun ONLY. A midweek session used to keep its own column
   *  ("nothing the season already has disappears"); it is not planning
   *  supply and never a runnable option now, so it gets no column at all.
   *  Its days still widen the span like any real dates. */
  it("drops a midweek session from planning supply (league days are Fri-Sun)", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [
        { id: "wed", days: [day("2026-10-21")] },
        { id: "sat", days: weekend("2026-10-24") },
      ],
    })

    expect(cols.find((c) => c.sessionId === "wed")).toBeUndefined()
    expect(sats(cols)).toEqual([
      "2026-10-03",
      "2026-10-10",
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
    ])
    expect(cols.find((c) => c.satDateISO === day("2026-10-24").toISOString())?.sessionId).toBe(
      "sat"
    )
  })

  it("keeps a Friday-to-Sunday session: all three are league days (QA T-015)", () => {
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [
        { id: "fss", days: [day("2026-10-23"), day("2026-10-24"), day("2026-10-25")] },
      ],
    })
    const col = cols.find((c) => c.sessionId === "fss")!
    expect(col).toBeDefined()
    expect(col.dayCount).toBe(3)
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

  it("excludes a playoff weekend entirely, without letting its date reopen", () => {
    // Playoff weekends are a season setting and never planning supply
    // (owner's 2026-08-06 analysis, C1): the finals session gets NO column,
    // and its Saturday stays claimed so it does not come back as a virtual
    // weekend the plan could quietly choose.
    const cols = enumerateSeasonWeekends({
      start: null,
      end: null,
      sessions: [
        { id: "reg", phase: "REGULAR", days: weekend("2026-10-24") },
        { id: "fin", phase: "PLAYOFF", days: weekend("2026-10-31") },
      ],
    })
    expect(cols.find((c) => c.sessionId === "fin")).toBeUndefined()
    expect(cols.some((c) => c.satDateISO === day("2026-10-31").toISOString())).toBe(false)
    expect(cols.find((c) => c.sessionId === "reg")?.phase).toBe("REGULAR")
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

/**
 * A gym the season does NOT have on a weekend, with the reason (owner ruling
 * 2026-08-02: Six Park East is taken by the NJC/NSC circuits on six known
 * 2026-27 weekends). The one rule worth pinning: the operator outranks the
 * default, so an attachment beats a mark every time.
 */
describe("venueCellState", () => {
  it("reads taken when the weekend is marked and the gym is not on it", () => {
    expect(venueCellState({ attachedDays: 0, custom: false, marked: true })).toBe("taken")
  })

  it("reads off when nobody marked it and the gym is not on it", () => {
    expect(venueCellState({ attachedDays: 0, custom: false, marked: false })).toBe("off")
  })

  it("reads on when the operator took a marked weekend anyway", () => {
    expect(venueCellState({ attachedDays: 2, custom: false, marked: true })).toBe("on")
  })

  it("still reads custom on a marked weekend running its own hours", () => {
    expect(venueCellState({ attachedDays: 2, custom: true, marked: true })).toBe("custom")
    expect(venueCellState({ attachedDays: 1, custom: true, marked: false })).toBe("custom")
  })

  it("counts one day of a weekend as on, not off", () => {
    expect(venueCellState({ attachedDays: 1, custom: false, marked: true })).toBe("on")
  })
})
