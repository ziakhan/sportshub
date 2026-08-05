import { describe, expect, it } from "vitest"
import { computeSessionCapacity } from "./capacity"
import { buildSlots, generateSchedule } from "./generate"
import { makeInput, makeTeams } from "./fixtures"

/**
 * Session capacity math + the planner's two generator hooks:
 * the sessionUnitFilter hard constraint and same-unit clustering preference.
 */

describe("computeSessionCapacity", () => {
  it("supply = courts × window ÷ slot; demand = ceil(teams × gamesPerTeam / 2)", () => {
    // 2 days × 1 court × 8 hourly slots = 16 slots; one session ⇒
    // gamesPerTeam = gamesGuaranteed = 3; 6 teams ⇒ ceil(6×3/2) = 9 games.
    const input = makeInput({ teams: 6, gamesGuaranteed: 3 })
    const [report] = computeSessionCapacity(input)
    expect(report.slotsTotal).toBe(16)
    expect(report.gamesPerTeam).toBe(3)
    expect(report.units).toHaveLength(1)
    expect(report.units[0].gamesNeeded).toBe(9)
    expect(report.gamesNeededAll).toBe(9)
    expect(report.surplusSlots).toBe(7)
    // 16 slots × 2 team-slots ÷ 3 games each = 10 teams
    expect(report.maxTeamsSupportable).toBe(10)
  })

  it("splits gamesGuaranteed across sessions unless targetGamesPerTeam overrides", () => {
    const base = makeInput({ teams: 4, gamesGuaranteed: 6 })
    const twoSessions = {
      ...base,
      sessions: [
        { ...base.sessions[0], id: "s1" },
        {
          ...base.sessions[0],
          id: "s2",
          targetGamesPerTeam: 1,
          days: base.sessions[0].days.map((d, i) => ({
            ...d,
            id: `s2-day-${i}`,
            dayVenues: d.dayVenues.map((dv, j) => ({ ...dv, id: `s2-dv-${i}-${j}` })),
          })),
        },
      ],
    }
    const [s1, s2] = computeSessionCapacity(twoSessions)
    expect(s1.gamesPerTeam).toBe(3) // ceil(6 / 2 sessions)
    expect(s2.gamesPerTeam).toBe(1) // explicit target wins
    expect(s2.units[0].gamesNeeded).toBe(2) // ceil(4×1/2)
  })

  it("reports per-unit demand for multiple divisions", () => {
    const input = makeInput({
      gamesGuaranteed: 4,
      divisions: [
        { id: "u11", name: "U11", teams: makeTeams(6, "u11") },
        { id: "u13", name: "U13", teams: makeTeams(4, "u13") },
      ],
    })
    const [report] = computeSessionCapacity(input)
    expect(report.units.map((u) => u.gamesNeeded)).toEqual([12, 8])
    expect(report.gamesNeededAll).toBe(20)
    expect(report.surplusSlots).toBe(16 - 20) // 4 short — the owner must choose
  })
})

describe("sessionUnitFilter", () => {
  it("keeps an excluded unit out of a session and schedules it in its own", () => {
    const base = makeInput({
      gamesGuaranteed: 2,
      divisions: [
        { id: "u11", name: "U11", teams: makeTeams(4, "u11") },
        { id: "u13", name: "U13", teams: makeTeams(4, "u13") },
      ],
      days: 1,
    })
    const input = {
      ...base,
      sessions: [
        { ...base.sessions[0], id: "s1" },
        {
          ...base.sessions[0],
          id: "s2",
          days: base.sessions[0].days.map((d, i) => ({
            ...d,
            id: `s2-day-${i}`,
            date: "2026-08-08", // a later weekend
            dayVenues: d.dayVenues.map((dv, j) => ({ ...dv, id: `s2-dv-${i}-${j}` })),
          })),
        },
      ],
      sessionUnitFilter: {
        s1: ["division:u11"],
        s2: ["division:u13"],
      },
    }
    const result = generateSchedule(input)
    expect(result.games.length).toBeGreaterThan(0)
    for (const g of result.games) {
      if (g.sessionId === "s1") expect(g.unitKey).toBe("division:u11")
      if (g.sessionId === "s2") expect(g.unitKey).toBe("division:u13")
    }
  })

  it("a unit excluded from every session yields a warning, not unscheduled noise", () => {
    const input = {
      ...makeInput({
        gamesGuaranteed: 2,
        divisions: [
          { id: "u11", name: "U11", teams: makeTeams(4, "u11") },
          { id: "u13", name: "U13", teams: makeTeams(4, "u13") },
        ],
      }),
      sessionUnitFilter: { s1: ["division:u11"] },
    }
    const result = generateSchedule(input)
    expect(result.games.every((g) => g.unitKey === "division:u11")).toBe(true)
    expect(result.unscheduled).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes("U13") && w.includes("not included"))).toBe(true)
  })
})

describe("same-unit clustering (soft)", () => {
  it("groups a unit's games into contiguous court blocks instead of interleaving", () => {
    // One day, one court, plenty of slots; two divisions of 4 teams needing
    // 2 games each ⇒ 4 + 4 games. With the clustering bonus the court should
    // run one division's block before switching, not alternate every slot.
    const result = generateSchedule(
      makeInput({
        gamesGuaranteed: 2,
        days: 1,
        open: "09:00",
        close: "18:00",
        divisions: [
          { id: "u11", name: "U11", teams: makeTeams(4, "u11") },
          { id: "u13", name: "U13", teams: makeTeams(4, "u13") },
        ],
      })
    )
    const ordered = [...result.games].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
    let switches = 0
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].unitKey !== ordered[i - 1].unitKey) switches++
    }
    // Perfect blocks would be 1 switch, but the no-back-to-back law
    // (owner 2026-08-01) forces a breather after a 4-team division has
    // cycled its teams — the unit returns after a gap instead of running
    // b2b. Alternating every slot would be ordered.length - 1 (= 7).
    expect(switches).toBeLessThanOrEqual(4)
  })
})

/**
 * COURTS THE LEAGUE HOLDS BACK (Season.courtBuffer, owner ruling 2026-08-03).
 * Games overrun and teams still arrive in September, so an operator plans a
 * court short on purpose. It is applied in ONE place — buildSlots — so every
 * number downstream counts the same courts: this report, the planner's weekend
 * capacity, the rental blocks, the ask sheet, and the generator itself.
 */
describe("the court buffer", () => {
  it("takes the held courts out of the supply, per gym per day", () => {
    // 2 days × 3 courts × 8 hourly slots = 48. Hold one court back at every
    // gym every day and the season plans on 32, not 48.
    const full = computeSessionCapacity(makeInput({ teams: 6, courts: 3 }))[0]
    const held = computeSessionCapacity(makeInput({ teams: 6, courts: 3, courtBuffer: 1 }))[0]
    expect(full.slotsTotal).toBe(48)
    expect(full.courts).toBe(3)
    expect(held.slotsTotal).toBe(32)
    expect(held.courts).toBe(2)
  })

  it("holds back the LAST courts, so the preferred ones keep filling first", () => {
    const held = buildSlots(makeInput({ teams: 6, courts: 3, courtBuffer: 1 }))
    expect([...new Set(held.map((s) => s.courtId))].sort()).toEqual(["court-1", "court-2"])
  })

  it("never goes negative: a buffer past the building leaves it with no room", () => {
    const none = computeSessionCapacity(makeInput({ teams: 6, courts: 2, courtBuffer: 5 }))[0]
    expect(none.slotsTotal).toBe(0)
    expect(none.surplusSlots).toBeLessThan(0)
  })

  it("the generator cannot book a court that is being held", () => {
    const result = generateSchedule(makeInput({ teams: 6, courts: 3, courtBuffer: 2 }))
    expect(result.games.length).toBeGreaterThan(0)
    expect([...new Set(result.games.map((g) => g.courtId))]).toEqual(["court-1"])
  })

  it("0 is the default, and plans to the whole building", () => {
    expect(computeSessionCapacity(makeInput({ teams: 6, courts: 3 }))[0].slotsTotal).toBe(
      computeSessionCapacity(makeInput({ teams: 6, courts: 3, courtBuffer: 0 }))[0].slotsTotal
    )
  })
})
