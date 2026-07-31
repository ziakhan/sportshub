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
    // Diagnostics (owner 2026-08-01): reasons name the actual blocker and
    // the fix, not a generic shrug. Here every court hour is consumed.
    for (const u of result.unscheduled) {
      expect(u.reason).toMatch(/add a court|court time|add court time/i)
    }
    // All four teams under their guarantee + the summary diagnosis line
    expect(result.warnings.filter((w) => w.includes("target"))).toHaveLength(4)
    expect(result.warnings.some((w) => w.includes("could not be placed"))).toBe(true)
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
      // Above the fixture default so the (now hard) per-day cap never binds
      // here — this test isolates the philosophy scoring, not the cap.
      idealGamesPerDayPerTeam: 3,
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

// ---------- variety + time rotation (owner 2026-07-31) ----------

describe("generateSchedule — seeded variety + time-of-day rotation", () => {
  it("varietySeed rotates WHICH matchups repeat, keeping counts fair", () => {
    // 8 teams × 10 games = 40 games: full round robin (28) + 12 rematches.
    const base = {
      teams: 8,
      gamesGuaranteed: 10,
      days: 10,
      // Rematches are hard-blocked within a session (owner 2026-08-01), so
      // the 10 days are 5 weekend sessions like the real worlds.
      sessionCount: 5,
      courts: 4,
      open: "09:00",
      close: "18:00",
    }
    const runA = generateSchedule(makeInput({ ...base }))
    const runB = generateSchedule({ ...makeInput({ ...base }), varietySeed: 5 })
    const repeats = (games: ProposedGame[]) => {
      const counts = new Map<string, number>()
      for (const g of games) {
        const k = [g.homeTeamId, g.awayTeamId].sort().join("|")
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
      return counts
    }
    for (const run of [runA, runB]) {
      // Zero-slack season (10 games = 5 sessions × 2 share): the greedy
      // endgame can corner; the repair ladder then trades PRECISION for
      // COMPLETENESS — a bonus game (guarantee+1) beats a team ending
      // short, always warned. A swap-chain solver (Studio P2) will retire
      // the ladder. Structural guarantees pinned here:
      expect(run.games.length).toBeGreaterThanOrEqual(39)
      expect(run.games.length).toBeLessThanOrEqual(41)
      const counts = repeats(run.games)
      expect(counts.size).toBe(28) // every pair really meets
      expect([...counts.values()].filter((c) => c > 2).length).toBeLessThanOrEqual(1)
      expect([...counts.values()].every((c) => c <= 3)).toBe(true)
      const perTeam = Object.values(gameCounts(run.games))
      for (const count of perTeam) {
        expect(count).toBeGreaterThanOrEqual(9)
        expect(count).toBeLessThanOrEqual(11)
      }
      if (perTeam.some((c) => c > 10)) {
        expect(run.tradeoffs.some((w) => w.includes("bonus game beyond the guarantee"))).toBe(true)
      }
    }
    const rematchesA = [...repeats(runA.games).entries()].filter(([, c]) => c > 1).map(([k]) => k)
    const rematchesB = [...repeats(runB.games).entries()].filter(([, c]) => c > 1).map(([k]) => k)
    expect(rematchesA.sort()).not.toEqual(rematchesB.sort())
  })

  it("the morning slot goes to the pairing whose history skews latest", () => {
    // History (one prior day, three tip-offs): t1 early+midday (load 0.25),
    // t2 late (1.0), t3 early (0), t4 midday+late (0.75). The pool that's
    // left holds (t2,t3) [0.5], (t1,t2) [0.625], (t3,t4) [0.375] — today's
    // 09:00 must go to (t1,t2), the pair that has been playing latest.
    // Without rotation, pool order decided and never changed week to week.
    const input = makeInput({
      teams: 4,
      gamesGuaranteed: 3,
      days: 1,
      courts: 1,
      open: "09:00",
      close: "15:00",
    })
    input.existingGames = [
      { homeTeamId: "d1-t1", awayTeamId: "d1-t3", scheduledAt: "2026-06-28T09:00:00" },
      { homeTeamId: "d1-t1", awayTeamId: "d1-t4", scheduledAt: "2026-06-28T10:30:00" },
      { homeTeamId: "d1-t2", awayTeamId: "d1-t4", scheduledAt: "2026-06-28T12:00:00" },
    ]
    const result = generateSchedule(input)
    expect(result.games).toHaveLength(3)
    const nine = result.games.filter((g) => new Date(g.scheduledAt).getHours() === 9)
    expect(nine).toHaveLength(1)
    expect([nine[0].homeTeamId, nine[0].awayTeamId].sort()).toEqual(["d1-t1", "d1-t2"])
  })
})

// ---------- hard fairness tier (owner rule: play everyone before repeats)
// + pinned survivors (Studio P0) ----------

describe("generateSchedule — first meetings before rematches (hard)", () => {
  it("chronologically, every pair meets once before any pair meets twice", () => {
    // 4 teams × 4 games = 8 games: 6 unique pairs + 2 rematches. The first
    // 6 games in time order must be 6 DISTINCT pairs — no rematch may jump
    // the queue however good its slot looks to the soft scoring. (4 sessions
    // so the season has slack — at zero slack the repair endgame may
    // legitimately reorder; that corner is pinned by the variety test.)
    const result = generateSchedule(
      makeInput({
        teams: 4,
        gamesGuaranteed: 4,
        days: 8,
        sessionCount: 4,
        courts: 2,
        idealGamesPerDayPerTeam: 2,
      })
    )
    expect(result.games).toHaveLength(8)
    const ordered = [...result.games].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime() ||
        a.courtId.localeCompare(b.courtId)
    )
    const firstSix = new Set(
      ordered.slice(0, 6).map((g) => [g.homeTeamId, g.awayTeamId].sort().join("|"))
    )
    expect(firstSix.size).toBe(6)
  })
})

describe("generateSchedule — pinned/played survivors occupy their slots", () => {
  it("never books the pinned game's court time or its teams' time", () => {
    const input = makeInput({
      teams: 4,
      gamesGuaranteed: 1,
      days: 1,
      courts: 1,
      open: "09:00",
      close: "12:00",
    })
    const day = input.sessions[0].days[0]
    const courtId = day.dayVenues[0].courts[0].id
    // A locked survivor at 09:00 on the only court: (t1,t4) already booked.
    input.existingGames = [
      {
        homeTeamId: "d1-t1",
        awayTeamId: "d1-t4",
        scheduledAt: atLocalTime(day.date, "09:00").toISOString(),
        courtId,
        sessionId: input.sessions[0].id,
      },
    ]
    const result = generateSchedule(input)
    // Pool consumed (t1,t4); only (t2,t3) left — it cannot land at 09:00
    // (court busy) so it takes the next slot.
    expect(result.games).toHaveLength(1)
    const g = result.games[0]
    expect([g.homeTeamId, g.awayTeamId].sort()).toEqual(["d1-t2", "d1-t3"])
    expect(new Date(g.scheduledAt).getHours()).toBeGreaterThan(9)
  })
})

// ---------- shared venues (owner 2026-07-31: schedule AROUND other
// leagues' games, warn, never double-book) ----------

describe("generateSchedule — busyCourtBookings (shared venues)", () => {
  it("never places a game on court time another league booked, and says so", () => {
    // 1 court, 09:00-12:00 (60-min slots: 9, 10, 11). Another league holds
    // 09:00-10:30 — that blocks the 9:00 AND the overlapping 10:00 slot, so
    // our only game lands at 11:00 with a warning, never on top of them.
    const input = makeInput({
      teams: 2,
      gamesGuaranteed: 1,
      days: 1,
      courts: 1,
      open: "09:00",
      close: "12:00",
    })
    const day = input.sessions[0].days[0].date
    input.busyCourtBookings = [
      {
        courtId: input.sessions[0].days[0].dayVenues[0].courts[0].id,
        start: atLocalTime(day, "09:00").toISOString(),
        end: atLocalTime(day, "10:30").toISOString(),
      },
    ]
    const result = generateSchedule(input)
    expect(result.games).toHaveLength(1)
    expect(new Date(result.games[0].scheduledAt).getHours()).toBe(11)
    expect(result.tradeoffs.some((w) => w.includes("booked by other leagues"))).toBe(true)
  })
})

// ---------- per-day cap (owner 2026-07-31: a weekend session = one game
// Saturday, one Sunday when idealGamesPerDayPerTeam is 1) ----------

describe("generateSchedule — idealGamesPerDayPerTeam as a hard cap", () => {
  it("ideal=1 over a 2-day span gives each team at most one game per day", () => {
    const result = generateSchedule(
      makeInput({
        teams: 4,
        gamesGuaranteed: 2,
        days: 2,
        courts: 2,
        idealGamesPerDayPerTeam: 1,
      })
    )
    expect(result.games).toHaveLength(4)
    const perTeamDay: Record<string, number> = {}
    for (const g of result.games) {
      for (const t of [g.homeTeamId, g.awayTeamId]) {
        const k = `${t}|${g.dayId}`
        perTeamDay[k] = (perTeamDay[k] ?? 0) + 1
      }
    }
    for (const count of Object.values(perTeamDay)) expect(count).toBe(1)
  })

  it("relaxed pass fills games the cap would otherwise strand on a single-day span", () => {
    const result = generateSchedule(
      makeInput({
        teams: 4,
        gamesGuaranteed: 2,
        days: 1,
        courts: 2,
        open: "09:00",
        close: "17:00",
        idealGamesPerDayPerTeam: 1,
      })
    )
    // One day can't honor 1 game/day for 2 games/team — filling wins.
    expect(result.games).toHaveLength(4)
    expectNoDoubleBookings(result.games, 60)
  })
})
