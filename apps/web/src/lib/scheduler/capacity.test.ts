import { describe, expect, it } from "vitest"
import { computeSessionCapacity } from "./capacity"
import { generateSchedule } from "./generate"
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
    // Perfect clustering = 1 switch; alternating = ordered.length - 1.
    expect(switches).toBeLessThanOrEqual(2)
  })
})
