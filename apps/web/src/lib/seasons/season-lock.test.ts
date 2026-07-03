import { describe, expect, it } from "vitest"
import {
  canCommitSchedule,
  canSubmitTeams,
  isSeasonLocked,
  LOCKED_SEASON_STATUSES,
} from "./season-lock"

describe("isSeasonLocked", () => {
  it("locks structure for FINALIZED, IN_PROGRESS and COMPLETED", () => {
    for (const status of LOCKED_SEASON_STATUSES) {
      expect(isSeasonLocked(status)).toBe(true)
    }
  })

  it("leaves pre-finalize statuses editable", () => {
    expect(isSeasonLocked("DRAFT")).toBe(false)
    expect(isSeasonLocked("REGISTRATION")).toBe(false)
  })

  it("treats missing status as unlocked", () => {
    expect(isSeasonLocked(null)).toBe(false)
    expect(isSeasonLocked(undefined)).toBe(false)
    expect(isSeasonLocked("")).toBe(false)
  })
})

describe("canSubmitTeams", () => {
  it("allows submissions only while registration is open", () => {
    expect(canSubmitTeams("REGISTRATION")).toBe(true)
    for (const status of ["DRAFT", "FINALIZED", "IN_PROGRESS", "COMPLETED", null, undefined]) {
      expect(canSubmitTeams(status)).toBe(false)
    }
  })
})

describe("canCommitSchedule", () => {
  it("enables scheduling from finalize until completion", () => {
    expect(canCommitSchedule("FINALIZED")).toBe(true)
    expect(canCommitSchedule("IN_PROGRESS")).toBe(true)
  })

  it("blocks scheduling before finalize and after completion", () => {
    for (const status of ["DRAFT", "REGISTRATION", "COMPLETED", null, undefined]) {
      expect(canCommitSchedule(status)).toBe(false)
    }
  })

  it("scheduling window is a subset of the structural lock", () => {
    // Any status where the schedule can be committed must also be one where
    // the season structure is locked — otherwise a schedule could be built
    // on divisions that are still mutable.
    for (const status of ["DRAFT", "REGISTRATION", "FINALIZED", "IN_PROGRESS", "COMPLETED"]) {
      if (canCommitSchedule(status)) expect(isSeasonLocked(status)).toBe(true)
    }
  })
})
