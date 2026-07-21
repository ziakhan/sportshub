import { describe, expect, it } from "vitest"
import { parse, compose, formatDisplay } from "./date-time-picker"

describe("DateTimePicker value contract (matches native inputs)", () => {
  it("round-trips datetime → YYYY-MM-DDTHH:mm", () => {
    const v = "2026-07-21T14:30"
    const p = parse(v, "datetime")
    expect([p.y, p.m, p.d, p.hh, p.mm]).toEqual([2026, 6, 21, 14, 30])
    expect(compose("datetime", p)).toBe(v)
  })

  it("date mode → YYYY-MM-DD (no time)", () => {
    const p = parse("2015-03-09", "date")
    expect(compose("date", p)).toBe("2015-03-09")
  })

  it("time mode → HH:mm", () => {
    const p = parse("08:05", "time")
    expect([p.hh, p.mm]).toEqual([8, 5])
    expect(compose("time", p)).toBe("08:05")
  })

  it("formats for display and handles empty", () => {
    expect(formatDisplay("2026-07-21T14:30", "datetime")).toBe("Jul 21, 2026 · 14:30")
    expect(formatDisplay("2015-03-09", "date")).toBe("Mar 9, 2015")
    expect(formatDisplay("", "datetime")).toBe("")
  })
})
