import { describe, expect, it } from "vitest"
import { calculateAge, COPPA_MIN_AGE, isCoppaMinor } from "./coppa"

// All boundary cases use explicit `at` dates — the calendar math must be
// exact around birthdays, which is why this module replaced the old
// 365.25-day float formulas.

const dob = (iso: string) => new Date(`${iso}T00:00:00`)

describe("calculateAge", () => {
  it("is calendar-accurate around the 13th birthday", () => {
    const born = dob("2013-06-15")
    expect(calculateAge(born, dob("2026-06-14"))).toBe(12)
    expect(calculateAge(born, dob("2026-06-15"))).toBe(13)
    expect(calculateAge(born, dob("2026-06-16"))).toBe(13)
  })

  it("handles earlier-month and later-month evaluation dates", () => {
    const born = dob("2013-06-15")
    expect(calculateAge(born, dob("2026-05-31"))).toBe(12)
    expect(calculateAge(born, dob("2026-07-01"))).toBe(13)
  })

  it("is 0 on the day of birth and through the first year", () => {
    const born = dob("2026-01-10")
    expect(calculateAge(born, dob("2026-01-10"))).toBe(0)
    expect(calculateAge(born, dob("2026-12-31"))).toBe(0)
    expect(calculateAge(born, dob("2027-01-10"))).toBe(1)
  })

  it("a Feb 29 leap-year birthday completes in a common year on Mar 1", () => {
    const born = dob("2012-02-29")
    expect(calculateAge(born, dob("2025-02-28"))).toBe(12)
    expect(calculateAge(born, dob("2025-03-01"))).toBe(13)
    // In a leap year the real anniversary exists
    expect(calculateAge(born, dob("2024-02-28"))).toBe(11)
    expect(calculateAge(born, dob("2024-02-29"))).toBe(12)
  })
})

describe("isCoppaMinor", () => {
  it("exports 13 as the COPPA minimum age", () => {
    expect(COPPA_MIN_AGE).toBe(13)
  })

  it("flips exactly on the 13th birthday", () => {
    const born = dob("2013-06-15")
    expect(isCoppaMinor(born, dob("2026-06-14"))).toBe(true)
    expect(isCoppaMinor(born, dob("2026-06-15"))).toBe(false)
  })

  it("a leap-day child stays a minor through Feb 28 of their 13th common year", () => {
    const born = dob("2012-02-29")
    expect(isCoppaMinor(born, dob("2025-02-28"))).toBe(true)
    expect(isCoppaMinor(born, dob("2025-03-01"))).toBe(false)
  })

  it("defaults `at` to now (relative dates only — no fixture time bombs)", () => {
    const twenty = new Date()
    twenty.setFullYear(twenty.getFullYear() - 20)
    const five = new Date()
    five.setFullYear(five.getFullYear() - 5)
    expect(isCoppaMinor(twenty)).toBe(false)
    expect(isCoppaMinor(five)).toBe(true)
  })
})
