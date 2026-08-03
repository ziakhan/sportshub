/**
 * Buildings (owner ruling 2026-08-03, venue model v2):
 *   1. The HOME gym packs first — the building the league owns is free, so its
 *      courts fill before anything is rented. The rented pool is unordered and
 *      tie-breaks on capacity, biggest first.
 *   2. A grade with a gym for the weekend plays there, and leaves it only
 *      when that gym has nothing left to give (never a dropped game).
 *
 * Fixtures use two gyms on the same days so both laws are observable in one
 * run. Day dates come from the shared fixture helpers (local datetime
 * strings, TZ-portable).
 */

import { describe, expect, it } from "vitest"
import { buildSlots, generateSchedule, venueRanks, type SchedulerInput } from "./generate"
import { localDayString, makeTeams } from "./fixtures"

const GYM_A = "va"
const GYM_B = "vb"

interface TwoGymOptions {
  days?: number
  /** Split those days evenly across N weekends (session ids s1, s2, …). */
  sessionCount?: number
  courtsA?: number
  courtsB?: number
  openA?: string
  closeA?: string
  openB?: string
  closeB?: string
  divisions?: SchedulerInput["divisions"]
  gamesGuaranteed?: number
  venueRoles?: SchedulerInput["venueRoles"]
  venueAssignments?: SchedulerInput["venueAssignments"]
}

/** One session, `days` consecutive days, the SAME two gyms on every day. */
function twoGymInput(opts: TwoGymOptions = {}): SchedulerInput {
  const {
    days = 2,
    sessionCount = 1,
    courtsA = 2,
    courtsB = 2,
    openA = "09:00",
    closeA = "17:00",
    openB = "09:00",
    closeB = "17:00",
    gamesGuaranteed = 3,
    divisions = [{ id: "d1", name: "Division 1", teams: makeTeams(4, "d1") }],
  } = opts
  const courts = (venueId: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${venueId}-c${i + 1}`, order: i }))
  return {
    gamesGuaranteed,
    gameSlotMinutes: 60,
    gameLengthMinutes: 50,
    idealGamesPerDayPerTeam: 2,
    schedulingPhilosophy: "FAMILY_FRIENDLY",
    allowCrossDivisionScheduling: false,
    defaultVenueOpenTime: "09:00",
    defaultVenueCloseTime: "20:00",
    divisions,
    schedulingGroups: [],
    sessions: Array.from({ length: sessionCount }, (_, si) => {
      const perSession = Math.ceil(days / sessionCount)
      return {
        id: `s${si + 1}`,
        phase: "REGULAR" as const,
        days: Array.from({ length: Math.min(perSession, days - si * perSession) }, (_, di) => {
          // A week between weekends, so sessions never share a calendar day.
          const i = si * perSession + di
          return {
            id: `day-${i + 1}`,
            date: localDayString(si * 7 + di),
            dayVenues: [
              {
                id: `dv-a-${i + 1}`,
                venueId: GYM_A,
                startTime: openA,
                endTime: closeA,
                courts: courts(GYM_A, courtsA),
              },
              {
                id: `dv-b-${i + 1}`,
                venueId: GYM_B,
                startTime: openB,
                endTime: closeB,
                courts: courts(GYM_B, courtsB),
              },
            ],
          }
        }),
      }
    }),
    venueRoles: opts.venueRoles,
    venueAssignments: opts.venueAssignments,
  }
}

const hhmm = (d: Date): string =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

const venuesOf = (games: Array<{ venueId: string }>): Set<string> =>
  new Set(games.map((g) => g.venueId))

// ---------- slot order ----------

describe("buildSlots — gyms fill in the league's order", () => {
  it("lays the home gym's whole inventory before anything is rented", () => {
    const input = twoGymInput({
      days: 1,
      courtsA: 2,
      courtsB: 2,
      openA: "09:00",
      closeA: "12:00",
      openB: "09:00",
      closeB: "12:00",
      venueRoles: { [GYM_A]: "home", [GYM_B]: "pool" },
    })
    const slots = buildSlots(input)
    expect(slots.map((s) => `${s.courtId}@${hhmm(s.startAt)}`)).toEqual([
      "va-c1@09:00",
      "va-c1@10:00",
      "va-c1@11:00",
      "va-c2@09:00",
      "va-c2@10:00",
      "va-c2@11:00",
      "vb-c1@09:00",
      "vb-c1@10:00",
      "vb-c1@11:00",
      "vb-c2@09:00",
      "vb-c2@10:00",
      "vb-c2@11:00",
    ])
    expect(slots[0].venueRank).toBe(0)
    expect(slots[slots.length - 1].venueRank).toBe(1)
  })

  it("follows the home gym, not the plan order", () => {
    const input = twoGymInput({
      days: 1,
      courtsA: 1,
      courtsB: 1,
      openA: "09:00",
      closeA: "11:00",
      openB: "09:00",
      closeB: "11:00",
      venueRoles: { [GYM_A]: "pool", [GYM_B]: "home" },
    })
    const slots = buildSlots(input)
    expect(slots.map((s) => s.courtId)).toEqual(["vb-c1", "vb-c1", "va-c1", "va-c1"])
    expect(venueRanks(input).get(GYM_B)).toBe(0)
    expect(venueRanks(input).get(GYM_A)).toBe(1)
  })

  it("treats a gym nobody named as pool, so the home gym still leads", () => {
    const input = twoGymInput({
      days: 1,
      courtsA: 1,
      courtsB: 1,
      openA: "09:00",
      closeA: "11:00",
      openB: "09:00",
      closeB: "11:00",
      // Only the SECOND gym is named, and it is the one they own.
      venueRoles: { [GYM_B]: "home" },
    })
    expect(venueRanks(input).get(GYM_B)).toBe(0)
    expect(venueRanks(input).get(GYM_A)).toBe(1)
    expect(buildSlots(input).map((s) => s.courtId)).toEqual([
      "vb-c1",
      "vb-c1",
      "va-c1",
      "va-c1",
    ])
  })

  it("ranks a league that owns nothing by capacity, then by id", () => {
    // No home gym: both are rented, equal capacity, so the id decides and the
    // answer never wobbles between two runs.
    const input = twoGymInput({ days: 1, courtsA: 1, courtsB: 1, closeA: "11:00", closeB: "11:00" })
    expect(buildSlots(input).map((s) => s.courtId)).toEqual([
      "va-c1",
      "va-c1",
      "vb-c1",
      "vb-c1",
    ])

    // The bigger rented building leads when they differ.
    const uneven = twoGymInput({
      days: 1,
      courtsA: 1,
      courtsB: 2,
      closeA: "11:00",
      closeB: "11:00",
    })
    expect(venueRanks(uneven).get(GYM_B)).toBe(0)
    expect(venueRanks(uneven).get(GYM_A)).toBe(1)
  })
})

// ---------- packing ----------

describe("generateSchedule — the home gym fills first", () => {
  it("rents nothing when the season fits in the building they own", () => {
    const input = twoGymInput({
      days: 2,
      courtsA: 2,
      courtsB: 2,
      gamesGuaranteed: 3,
      venueRoles: { [GYM_A]: "home", [GYM_B]: "pool" },
    })
    const result = generateSchedule(input)
    expect(result.unscheduled).toHaveLength(0)
    expect(result.games.length).toBeGreaterThan(0)
    expect(venuesOf(result.games)).toEqual(new Set([GYM_A]))
    expect(result.venueFallbacks).toBe(0)
  })

  it("packs into whichever gym the league OWNS", () => {
    const input = twoGymInput({
      days: 2,
      courtsA: 2,
      courtsB: 2,
      gamesGuaranteed: 3,
      venueRoles: { [GYM_A]: "pool", [GYM_B]: "home" },
    })
    const result = generateSchedule(input)
    expect(result.unscheduled).toHaveLength(0)
    expect(venuesOf(result.games)).toEqual(new Set([GYM_B]))
  })
})

// ---------- per-weekend gym assignment ----------

describe("generateSchedule — a grade plays in the gym its weekend was given", () => {
  const twoDivisions: SchedulerInput["divisions"] = [
    { id: "d1", name: "Division 1", teams: makeTeams(4, "d1") },
    { id: "d2", name: "Division 2", teams: makeTeams(4, "d2") },
  ]

  it("sends the assigned division to its gym while the rest packs the first one", () => {
    const input = twoGymInput({
      days: 2,
      courtsA: 2,
      courtsB: 2,
      gamesGuaranteed: 3,
      divisions: twoDivisions,
      venueRoles: { [GYM_A]: "home", [GYM_B]: "pool" },
      venueAssignments: { s1: { d2: GYM_B } },
    })
    const result = generateSchedule(input)
    expect(result.unscheduled).toHaveLength(0)
    const d1 = result.games.filter((g) => g.unitKey === "division:d1")
    const d2 = result.games.filter((g) => g.unitKey === "division:d2")
    expect(d1.length).toBeGreaterThan(0)
    expect(d2.length).toBeGreaterThan(0)
    // The assigned grade is in its building even though gym A fills first…
    expect(venuesOf(d2)).toEqual(new Set([GYM_B]))
    // …and the unassigned grade still packs the priority gym.
    expect(venuesOf(d1)).toEqual(new Set([GYM_A]))
    expect(result.venueFallbacks).toBe(0)
    expect(result.warnings.join(" ")).not.toContain("another gym")
  })

  it("is a per-WEEKEND decision: the same grade moves gyms between sessions", () => {
    const input = twoGymInput({
      days: 4,
      sessionCount: 2,
      courtsA: 2,
      courtsB: 2,
      gamesGuaranteed: 4,
      divisions: [twoDivisions[0]],
      venueRoles: { [GYM_A]: "home", [GYM_B]: "pool" },
      // Weekend 1 in the second gym, weekend 2 wherever the plan packs.
      venueAssignments: { s1: { d1: GYM_B } },
    })
    const result = generateSchedule(input)
    expect(result.unscheduled).toHaveLength(0)
    const first = result.games.filter((g) => g.sessionId === "s1")
    const second = result.games.filter((g) => g.sessionId === "s2")
    expect(first.length).toBeGreaterThan(0)
    expect(second.length).toBeGreaterThan(0)
    expect(venuesOf(first)).toEqual(new Set([GYM_B]))
    expect(venuesOf(second)).toEqual(new Set([GYM_A]))
    expect(result.venueFallbacks).toBe(0)
  })

  it("honors an assignment that points at the gym the league fills last", () => {
    const input = twoGymInput({
      days: 2,
      courtsA: 2,
      courtsB: 2,
      gamesGuaranteed: 3,
      divisions: [twoDivisions[0]],
      venueRoles: { [GYM_A]: "home", [GYM_B]: "pool" },
      venueAssignments: { s1: { d1: GYM_B } },
    })
    const result = generateSchedule(input)
    expect(result.unscheduled).toHaveLength(0)
    expect(venuesOf(result.games)).toEqual(new Set([GYM_B]))
    expect(result.venueFallbacks).toBe(0)
  })
})

// ---------- fallback ----------

describe("generateSchedule — a gym too small for its grade", () => {
  /** Gym B holds 2 games a day; the division needs 6 games over 2 days. */
  const tightInput = (withAssignment: boolean): SchedulerInput =>
    twoGymInput({
      days: 2,
      courtsA: 2,
      courtsB: 1,
      openB: "09:00",
      closeB: "11:00",
      gamesGuaranteed: 3,
      venueRoles: { [GYM_A]: "home", [GYM_B]: "pool" },
      venueAssignments: withAssignment ? { s1: { d1: GYM_B } } : undefined,
    })

  it("spills the overflow into another gym, counts it, and drops nothing", () => {
    const blind = generateSchedule(tightInput(false))
    const result = generateSchedule(tightInput(true))

    // Nothing a venue-blind run could place is lost to the preference.
    expect(result.games.length).toBe(blind.games.length)
    expect(result.unscheduled).toHaveLength(0)

    const atB = result.games.filter((g) => g.venueId === GYM_B)
    const offB = result.games.filter((g) => g.venueId !== GYM_B)
    // The small gym is used first (the blind run never opens it at all),
    // and only what does not fit goes next door.
    expect(blind.games.filter((g) => g.venueId === GYM_B)).toHaveLength(0)
    expect(atB.length).toBeGreaterThan(0)
    expect(offB.length).toBeGreaterThan(0)
    expect(result.venueFallbacks).toBe(offB.length)
    expect(result.warnings.some((w) => w.includes("placed in another gym"))).toBe(true)
  })

  it("reports no fallbacks when nothing was assigned", () => {
    expect(generateSchedule(tightInput(false)).venueFallbacks).toBe(0)
  })
})

// ---------- determinism ----------

describe("generateSchedule — buildings are deterministic", () => {
  it("produces byte-identical games across runs of the same input", () => {
    const build = (): SchedulerInput =>
      twoGymInput({
        days: 2,
        courtsA: 2,
        courtsB: 1,
        openB: "09:00",
        closeB: "13:00",
        gamesGuaranteed: 3,
        divisions: [
          { id: "d1", name: "Division 1", teams: makeTeams(4, "d1") },
          { id: "d2", name: "Division 2", teams: makeTeams(6, "d2") },
        ],
        venueRoles: { [GYM_A]: "home", [GYM_B]: "pool" },
        venueAssignments: { s1: { d2: GYM_B } },
      })
    const first = generateSchedule(build())
    const second = generateSchedule(build())
    expect(second.games).toEqual(first.games)
    expect(second.venueFallbacks).toBe(first.venueFallbacks)
    expect(second.warnings).toEqual(first.warnings)
    expect(second.unscheduled).toEqual(first.unscheduled)
  })
})
