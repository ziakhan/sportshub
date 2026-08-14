import { describe, it, expect } from "vitest"
import { hasOpenSeason, isSeasonOpen, renewableSeason } from "./renewal"

const season = (status: string, label = status) => ({ id: label, label, status })

describe("isSeasonOpen", () => {
  it("counts every non-completed status as open", () => {
    for (const s of ["DRAFT", "REGISTRATION", "REGISTRATION_CLOSED", "FINALIZED", "IN_PROGRESS"]) {
      expect(isSeasonOpen(s)).toBe(true)
    }
  })

  it("treats COMPLETED and missing statuses as closed", () => {
    expect(isSeasonOpen("COMPLETED")).toBe(false)
    expect(isSeasonOpen(null)).toBe(false)
    expect(isSeasonOpen(undefined)).toBe(false)
  })
})

describe("hasOpenSeason", () => {
  it("is false for a league with no seasons", () => {
    expect(hasOpenSeason([])).toBe(false)
  })

  it("is true when any season is still on the calendar", () => {
    expect(hasOpenSeason([season("COMPLETED"), season("DRAFT")])).toBe(true)
  })
})

describe("renewableSeason", () => {
  it("hides renewal while a season is in progress", () => {
    expect(renewableSeason([season("IN_PROGRESS"), season("COMPLETED")])).toBeNull()
  })

  it("hides renewal while a next season is already drafted or registering", () => {
    expect(renewableSeason([season("DRAFT"), season("COMPLETED")])).toBeNull()
    expect(renewableSeason([season("REGISTRATION"), season("COMPLETED")])).toBeNull()
    expect(renewableSeason([season("REGISTRATION_CLOSED"), season("COMPLETED")])).toBeNull()
    expect(renewableSeason([season("FINALIZED"), season("COMPLETED")])).toBeNull()
  })

  it("hides renewal for a league with no seasons at all", () => {
    expect(renewableSeason([])).toBeNull()
  })

  it("offers the newest completed season once nothing is open", () => {
    const seasons = [season("COMPLETED", "Summer 2026"), season("COMPLETED", "Summer 2025")]
    expect(renewableSeason(seasons)?.label).toBe("Summer 2026")
  })
})
