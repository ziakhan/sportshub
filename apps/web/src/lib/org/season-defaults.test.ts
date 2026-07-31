import { describe, expect, it } from "vitest"
import { effectiveSeasonConfig, applyEffectiveConfig } from "./season-defaults"

/** Phase A resolver: season override → org rulebook → system default. */
describe("effectiveSeasonConfig", () => {
  const org = {
    gamesGuaranteed: 6,
    gameSlotMinutes: 75,
    depositPct: 25,
    balanceDueDaysBeforeStart: 21,
    tiebreakerOrder: ["WINS"],
    allowGuestPlayers: false,
    teamFee: 1000,
  }

  it("season value wins over org and system", () => {
    const { values, sources } = effectiveSeasonConfig(
      { gamesGuaranteed: 12, gameSlotMinutes: null },
      org
    )
    expect(values.gamesGuaranteed).toBe(12)
    expect(sources.gamesGuaranteed).toBe("season")
    expect(values.gameSlotMinutes).toBe(75)
    expect(sources.gameSlotMinutes).toBe("org")
  })

  it("org fills season nulls; system fills the rest", () => {
    const { values, sources } = effectiveSeasonConfig({}, org)
    expect(values.depositPct).toBe(25)
    expect(sources.depositPct).toBe("org")
    expect(values.allowGuestPlayers).toBe(false)
    // org doesn't define these → system defaults
    expect(values.gameLengthMinutes).toBe(40)
    expect(sources.gameLengthMinutes).toBe("system")
    expect(values.balanceDueDaysBeforeStart).toBe(21)
  })

  it("empty arrays count as unset (tiebreakers/questions inherit)", () => {
    const { values, sources } = effectiveSeasonConfig({ tiebreakerOrder: [] }, org)
    expect(values.tiebreakerOrder).toEqual(["WINS"])
    expect(sources.tiebreakerOrder).toBe("org")
    // a season with its OWN order keeps it
    const own = effectiveSeasonConfig({ tiebreakerOrder: ["HEAD_TO_HEAD"] }, org)
    expect(own.values.tiebreakerOrder).toEqual(["HEAD_TO_HEAD"])
    expect(own.sources.tiebreakerOrder).toBe("season")
  })

  it("false is a real value, not unset", () => {
    const { values, sources } = effectiveSeasonConfig({ allowGuestPlayers: false }, {
      allowGuestPlayers: true,
    })
    expect(values.allowGuestPlayers).toBe(false)
    expect(sources.allowGuestPlayers).toBe("season")
  })

  it("a malformed org blob is dropped, never thrown", () => {
    const { values, sources } = effectiveSeasonConfig({}, { gamesGuaranteed: "twelve", junk: 1 })
    expect(sources.gamesGuaranteed).toBe("system")
    expect(values.gameSlotMinutes).toBe(90)
  })

  it("season dates inherit from the org cycle keys (owner 2026-07-31)", () => {
    const { values, sources } = effectiveSeasonConfig(
      { startDate: null, endDate: null, registrationDeadline: null },
      {
        cycleStartDate: "2026-10-03T00:00:00.000Z",
        cycleEndDate: "2027-03-14T00:00:00.000Z",
        cycleRegistrationDeadline: "2026-10-01T00:00:00.000Z",
      }
    )
    expect(values.startDate).toBe("2026-10-03T00:00:00.000Z")
    expect(sources.startDate).toBe("org")
    expect(sources.registrationDeadline).toBe("org")
    // a season with its own dates keeps them
    const own = effectiveSeasonConfig(
      { startDate: "2026-11-01T00:00:00.000Z" },
      { cycleStartDate: "2026-10-03T00:00:00.000Z" }
    )
    expect(own.values.startDate).toBe("2026-11-01T00:00:00.000Z")
    expect(own.sources.startDate).toBe("season")
  })

  it("no org at all → pure system defaults", () => {
    const { values, sources } = effectiveSeasonConfig({}, null)
    expect(values.gamePeriods).toBe("HALVES")
    expect(sources.gamePeriods).toBe("system")
    expect(values.allowGuestPlayers).toBe(true)
  })

  it("applyEffectiveConfig spreads values and attaches configSources", () => {
    const out = applyEffectiveConfig({ id: "s1", gamesGuaranteed: null } as any, org)
    expect(out.id).toBe("s1")
    expect(out.gamesGuaranteed).toBe(6)
    expect(out.configSources.gamesGuaranteed).toBe("org")
  })
})
