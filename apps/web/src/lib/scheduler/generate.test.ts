import { describe, expect, it } from "vitest"
import {
  buildSlots,
  generateSchedule,
  type ProposedGame,
  type SchedulerInput,
} from "./generate"
import { atLocalTime, localDayString, makeInput, makeTeams } from "./fixtures"

// ---------- assertion helpers ----------

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Hard-constraint sweep: no court hosts two overlapping games, no team plays
 * two overlapping games. Occupancy is the slot window (slotMinutes), matching
 * the generator's own booking model.
 */
function expectNoDoubleBookings(games: ProposedGame[], slotMinutes: number) {
  for (let i = 0; i < games.length; i++) {
    for (let j = i + 1; j < games.length; j++) {
      const a = games[i]
      const b = games[j]
      const aStart = new Date(a.scheduledAt).getTime()
      const bStart = new Date(b.scheduledAt).getTime()
      const overlap = intervalsOverlap(
        aStart,
        aStart + slotMinutes * 60000,
        bStart,
        bStart + slotMinutes * 60000
      )
      if (!overlap) continue
      expect(a.courtId, `court ${a.courtId} double-booked at ${a.scheduledAt}`).not.toBe(b.courtId)
      const aTeams = [a.homeTeamId, a.awayTeamId]
      const bTeams = [b.homeTeamId, b.awayTeamId]
      const shared = aTeams.filter((t) => bTeams.includes(t))
      expect(shared, `team(s) ${shared.join(",")} double-booked at ${a.scheduledAt}`).toEqual([])
    }
  }
}

function gameCounts(games: ProposedGame[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const g of games) {
    counts[g.homeTeamId] = (counts[g.homeTeamId] ?? 0) + 1
    counts[g.awayTeamId] = (counts[g.awayTeamId] ?? 0) + 1
  }
  return counts
}

/** Count of distinct (team, day) pairs — lower = more clustered schedule. */
function teamDayCount(games: ProposedGame[]): number {
  const pairs = new Set<string>()
  for (const g of games) {
    pairs.add(`${g.homeTeamId}|${g.dayId}`)
    pairs.add(`${g.awayTeamId}|${g.dayId}`)
  }
  return pairs.size
}

function divisionOf(teamId: string): string {
  return teamId.split("-t")[0]
}

// ---------- buildSlots (I12: windows, closed days, edges) ----------

describe("buildSlots — windows and edges", () => {
  it("generates hourly slots per court within the window, sorted chronologically", () => {
    const input = makeInput({ days: 2, courts: 1, open: "09:00", close: "17:00" })
    const slots = buildSlots(input)
    expect(slots).toHaveLength(16)
    expect(slots[0].startAt).toEqual(atLocalTime(localDayString(0), "09:00"))
    expect(slots[0].endAt).toEqual(atLocalTime(localDayString(0), "10:00"))
    expect(slots[15].startAt).toEqual(atLocalTime(localDayString(1), "16:00"))
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startAt.getTime()).toBeGreaterThanOrEqual(slots[i - 1].startAt.getTime())
    }
  })

  it("truncates a partial trailing window to whole slots", () => {
    const input = makeInput({ days: 1, open: "09:00", close: "10:30" })
    expect(buildSlots(input)).toHaveLength(1)
  })

  it("yields no slots when the window is smaller than one slot", () => {
    const input = makeInput({ days: 1, open: "09:00", close: "09:45" })
    expect(buildSlots(input)).toHaveLength(0)
  })

  it("skips a day-venue whose window is zero or inverted", () => {
    expect(buildSlots(makeInput({ days: 1, open: "17:00", close: "17:00" }))).toHaveLength(0)
    expect(buildSlots(makeInput({ days: 1, open: "17:00", close: "09:00" }))).toHaveLength(0)
  })

  it("falls back to default venue hours when day-venue times are null", () => {
    const input = makeInput({
      defaultVenueOpenTime: "10:00",
      defaultVenueCloseTime: "14:00",
      sessions: [
        {
          id: "s1",
          phase: "REGULAR",
          days: [
            {
              id: "day-1",
              date: localDayString(0),
              dayVenues: [
                { id: "dv-1", venueId: "v1", startTime: null, endTime: null, courts: [{ id: "c1" }] },
              ],
            },
          ],
        },
      ],
    })
    const slots = buildSlots(input)
    expect(slots).toHaveLength(4)
    expect(slots[0].startAt).toEqual(atLocalTime(localDayString(0), "10:00"))
  })

  it("falls back when a time string is malformed", () => {
    // "9:00" fails the HH:MM regex → default open (10:00) applies
    const input = makeInput({
      days: 1,
      open: "9:00",
      close: "14:00",
      defaultVenueOpenTime: "10:00",
    })
    const slots = buildSlots(input)
    expect(slots).toHaveLength(4)
    expect(slots[0].startAt).toEqual(atLocalTime(localDayString(0), "10:00"))
  })

  it("ignores PLAYOFF sessions", () => {
    const regular = makeInput({ days: 1 }).sessions[0]
    const playoff: SchedulerInput["sessions"][number] = {
      ...makeInput({ days: 1, baseDate: "2026-07-13" }).sessions[0],
      id: "s2",
      phase: "PLAYOFF",
    }
    const input = makeInput({ sessions: [regular, playoff] })
    const slots = buildSlots(input)
    expect(slots).toHaveLength(8)
    expect(slots.every((s) => s.sessionId === "s1")).toBe(true)
  })

  it("multiplies slots across courts", () => {
    const input = makeInput({ days: 1, courts: 3 })
    expect(buildSlots(input)).toHaveLength(24)
  })

  it("sizes slots by gameSlotMinutes", () => {
    const input = makeInput({ days: 1, gameSlotMinutes: 90 })
    // 480-minute window / 90 → 5 whole slots
    expect(buildSlots(input)).toHaveLength(5)
  })
})

// ---------- buildSlots (I14: DST boundaries, TZ pinned to America/Toronto) ----------

describe("buildSlots — DST boundaries (America/Toronto)", () => {
  it("fall-back day (Nov 1 2026): a daytime window still yields 8 hourly slots at 09:00–16:00 wall clock", () => {
    const input = makeInput({ days: 1, baseDate: "2026-11-01", open: "09:00", close: "17:00" })
    const slots = buildSlots(input)
    expect(slots).toHaveLength(8)
    expect(slots.map((s) => s.startAt.getHours())).toEqual([9, 10, 11, 12, 13, 14, 15, 16])
  })

  it("fall-back day: a window spanning the 2am repeat contains a real extra hour", () => {
    // 00:00–08:00 wall clock on Nov 1 2026 spans 9 elapsed hours (1am happens twice)
    const input = makeInput({ days: 1, baseDate: "2026-11-01", open: "00:00", close: "08:00" })
    expect(buildSlots(input)).toHaveLength(9)
  })

  it("spring-forward day (Mar 8 2026): a window spanning the 2am skip loses an hour", () => {
    // 00:00–08:00 wall clock spans only 7 elapsed hours (2am doesn't exist)
    const input = makeInput({ days: 1, baseDate: "2026-03-08", open: "00:00", close: "08:00" })
    expect(buildSlots(input)).toHaveLength(7)
  })
})

// ---------- scheduling units ----------

describe("generateSchedule — scheduling units", () => {
  it("a lone 1-team division produces no games and a no-units warning", () => {
    const result = generateSchedule(makeInput({ teams: 1 }))
    expect(result.games).toEqual([])
    expect(result.warnings).toContain("No scheduling units with ≥ 2 teams.")
  })

  it("a 1-team division alongside a full division is silently dropped", () => {
    const result = generateSchedule(
      makeInput({
        divisions: [
          { id: "d1", name: "Division 1", teams: makeTeams(1, "d1") },
          { id: "d2", name: "Division 2", teams: makeTeams(4, "d2") },
        ],
      })
    )
    const teams = new Set(result.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(teams.has("d1-t1")).toBe(false)
    expect(result.games.length).toBeGreaterThan(0)
    expect(result.utilization.teamGameCounts["d1-t1"]).toBeUndefined()
  })

  it("cross-division scheduling groups pool teams into one unit", () => {
    const result = generateSchedule(
      makeInput({
        allowCrossDivisionScheduling: true,
        divisions: [
          { id: "d1", name: "Division 1", teams: makeTeams(2, "d1") },
          { id: "d2", name: "Division 2", teams: makeTeams(2, "d2") },
        ],
        schedulingGroups: [{ id: "g1", name: "Group 1", divisionIds: ["d1", "d2"] }],
        gamesGuaranteed: 3,
      })
    )
    // 4 pooled teams × 3 guaranteed → all 6 unique pairs, incl. cross-division ones
    expect(result.games).toHaveLength(6)
    expect(result.games.every((g) => g.unitKey === "group:g1")).toBe(true)
    const crossGames = result.games.filter(
      (g) => divisionOf(g.homeTeamId) !== divisionOf(g.awayTeamId)
    )
    expect(crossGames.length).toBeGreaterThan(0)
    for (const count of Object.values(gameCounts(result.games))) expect(count).toBe(3)
  })

  it("a division outside every group still schedules independently", () => {
    const result = generateSchedule(
      makeInput({
        allowCrossDivisionScheduling: true,
        divisions: [
          { id: "d1", name: "Division 1", teams: makeTeams(2, "d1") },
          { id: "d2", name: "Division 2", teams: makeTeams(2, "d2") },
          { id: "d3", name: "Division 3", teams: makeTeams(2, "d3") },
        ],
        schedulingGroups: [{ id: "g1", name: "Group 1", divisionIds: ["d1", "d2"] }],
        gamesGuaranteed: 3,
      })
    )
    const groupGames = result.games.filter((g) => g.unitKey === "group:g1")
    const d3Games = result.games.filter((g) => g.unitKey === "division:d3")
    expect(groupGames).toHaveLength(6)
    expect(d3Games).toHaveLength(3)
    expect(groupGames.length + d3Games.length).toBe(result.games.length)
    // d3 teams never leak into the group's games and vice versa
    for (const g of d3Games) {
      expect(divisionOf(g.homeTeamId)).toBe("d3")
      expect(divisionOf(g.awayTeamId)).toBe("d3")
    }
    for (const g of groupGames) {
      expect(["d1", "d2"]).toContain(divisionOf(g.homeTeamId))
      expect(["d1", "d2"]).toContain(divisionOf(g.awayTeamId))
    }
  })

  it("groups are ignored when allowCrossDivisionScheduling is false", () => {
    const result = generateSchedule(
      makeInput({
        allowCrossDivisionScheduling: false,
        divisions: [
          { id: "d1", name: "Division 1", teams: makeTeams(2, "d1") },
          { id: "d2", name: "Division 2", teams: makeTeams(2, "d2") },
        ],
        schedulingGroups: [{ id: "g1", name: "Group 1", divisionIds: ["d1", "d2"] }],
      })
    )
    expect(result.games.length).toBeGreaterThan(0)
    for (const g of result.games) {
      expect(g.unitKey.startsWith("division:")).toBe(true)
      expect(divisionOf(g.homeTeamId)).toBe(divisionOf(g.awayTeamId))
    }
  })

  it("a group whose divisions total fewer than 2 teams is dropped", () => {
    const result = generateSchedule(
      makeInput({
        allowCrossDivisionScheduling: true,
        divisions: [{ id: "d1", name: "Division 1", teams: makeTeams(1, "d1") }],
        schedulingGroups: [{ id: "g1", name: "Group 1", divisionIds: ["d1"] }],
      })
    )
    expect(result.games).toEqual([])
    expect(result.warnings).toContain("No scheduling units with ≥ 2 teams.")
  })
})

// ---------- generator core (I9) ----------

describe("generateSchedule — core", () => {
  it("happy path: round robin schedules every team to its guarantee with no double-bookings", () => {
    const input = makeInput({ teams: 4, gamesGuaranteed: 3 })
    const result = generateSchedule(input)
    // 4 teams × 3 games / 2 = 6 games, all unique pairs
    expect(result.games).toHaveLength(6)
    expect(result.unscheduled).toEqual([])
    expect(result.warnings).toEqual([])
    for (const count of Object.values(gameCounts(result.games))) expect(count).toBe(3)
    expectNoDoubleBookings(result.games, input.gameSlotMinutes)
    // Every game sits inside the venue window
    for (const g of result.games) {
      const hour = new Date(g.scheduledAt).getHours()
      expect(hour).toBeGreaterThanOrEqual(9)
      expect(hour).toBeLessThanOrEqual(16)
    }
  })

  it("odd team count: circle-method rounds keep every team on target (rotating bye)", () => {
    // 5 teams × 2 guaranteed → 5-game pool from round-robin rounds with a
    // phantom bye. Rounds hand each team at most one game apiece, so counts
    // stay balanced — the old stride sampling left one team a game short.
    const result = generateSchedule(makeInput({ teams: 5, gamesGuaranteed: 2 }))
    expect(result.games).toHaveLength(5)
    const counts = gameCounts(result.games)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(10)
    for (const count of Object.values(counts)) expect(count).toBe(2)
    expect(result.warnings).toEqual([])
  })

  it("unreachable guarantee: slot exhaustion reports unscheduled pairings and per-team warnings", () => {
    // 2 usable slots vs a 20-game target
    const input = makeInput({
      teams: 4,
      gamesGuaranteed: 10,
      days: 1,
      open: "09:00",
      close: "11:00",
    })
    const result = generateSchedule(input)
    expect(result.games).toHaveLength(2)
    expect(result.unscheduled).toHaveLength(18)
    for (const u of result.unscheduled) {
      expect(u.reason).toBe("no remaining slot satisfies hard constraints")
    }
    // All four teams are under their guarantee
    expect(result.warnings).toHaveLength(4)
    expectNoDoubleBookings(result.games, input.gameSlotMinutes)
  })

  it("no slots at all: warns and returns the whole pool as unscheduled", () => {
    const result = generateSchedule(makeInput({ teams: 4, gamesGuaranteed: 3, sessions: [] }))
    expect(result.games).toEqual([])
    expect(result.warnings).toContain("No usable slots were generated.")
    expect(result.unscheduled).toHaveLength(6)
  })

  it("home/away balance: a repeated pairing flips home advantage across cycles", () => {
    // 2 teams × 4 guaranteed → the single pair cycles with home/away flips
    const result = generateSchedule(makeInput({ teams: 2, gamesGuaranteed: 4 }))
    expect(result.games).toHaveLength(4)
    const homeCounts: Record<string, number> = {}
    for (const g of result.games) homeCounts[g.homeTeamId] = (homeCounts[g.homeTeamId] ?? 0) + 1
    expect(homeCounts["d1-t1"]).toBe(2)
    expect(homeCounts["d1-t2"]).toBe(2)
  })

  it("games carry gameLengthMinutes as duration and the slot start as scheduledAt", () => {
    const result = generateSchedule(makeInput({ teams: 2, gamesGuaranteed: 1, gameLengthMinutes: 50 }))
    expect(result.games).toHaveLength(1)
    expect(result.games[0].duration).toBe(50)
    expect(result.games[0].scheduledAt).toBe(atLocalTime(localDayString(0), "09:00").toISOString())
    expect(result.games[0].venueId).toBe("v1")
    expect(result.games[0].courtId).toBe("court-1")
  })

  it("utilization accounting matches the schedule", () => {
    const input = makeInput({ teams: 4, gamesGuaranteed: 3, days: 2 })
    const result = generateSchedule(input)
    expect(result.utilization.slotsTotal).toBe(16)
    expect(result.utilization.slotsUsed).toBe(6)
    expect(result.utilization.courtMinutesAvailable).toBe(16 * 60)
    expect(result.utilization.courtMinutesUsed).toBe(6 * 60)
    expect(result.utilization.teamGameCounts).toEqual({
      "d1-t1": 3,
      "d1-t2": 3,
      "d1-t3": 3,
      "d1-t4": 3,
    })
  })

  it("is deterministic: identical input produces an identical schedule", () => {
    const a = generateSchedule(makeInput({ teams: 5, gamesGuaranteed: 4, days: 3, courts: 2 }))
    const b = generateSchedule(makeInput({ teams: 5, gamesGuaranteed: 4, days: 3, courts: 2 }))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

// ---------- philosophy A/B (13.6) ----------

describe("generateSchedule — scheduling philosophy", () => {
  // 4 teams, 6 games, 3 slots/day over 3 days: tight enough that the
  // philosophy scoring visibly changes which pairing wins each slot.
  const philosophyInput = (schedulingPhilosophy: "FAMILY_FRIENDLY" | "SPREAD_DAYS") =>
    makeInput({
      teams: 4,
      gamesGuaranteed: 3,
      days: 3,
      courts: 1,
      open: "09:00",
      close: "12:00",
      schedulingPhilosophy,
    })

  it("both philosophies schedule the full round robin", () => {
    for (const p of ["FAMILY_FRIENDLY", "SPREAD_DAYS"] as const) {
      const result = generateSchedule(philosophyInput(p))
      expect(result.games).toHaveLength(6)
      expect(result.unscheduled).toEqual([])
      expectNoDoubleBookings(result.games, 60)
    }
  })

  it("FAMILY_FRIENDLY clusters team games onto fewer distinct days than SPREAD_DAYS", () => {
    const family = generateSchedule(philosophyInput("FAMILY_FRIENDLY"))
    const spread = generateSchedule(philosophyInput("SPREAD_DAYS"))
    expect(teamDayCount(family.games)).toBeLessThan(teamDayCount(spread.games))
  })
})
