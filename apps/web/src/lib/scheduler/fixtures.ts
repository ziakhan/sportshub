/**
 * Input builders for scheduler unit tests (generate.test.ts).
 *
 * All day dates are LOCAL datetime strings ("YYYY-MM-DDT00:00:00", no
 * timezone suffix) derived from a fixed base date — fully deterministic,
 * no Date.now().
 *
 * PINNED GENERATOR BEHAVIOR: buildSlots does `new Date(day.date)` followed
 * by `setHours(open.h, open.m)`. A date-ONLY string ("2026-07-06") parses as
 * UTC midnight, which on machines west of UTC is the *previous* local
 * calendar day — setHours would then land slots on the wrong day. Fixtures
 * therefore always pass local datetime strings (T00:00:00, no Z) so the
 * local calendar day always matches the intended one, on any machine TZ.
 */

import type { SchedulerInput, SchedulerPhilosophy, SchedulerTeam } from "./generate"

/** Fixed base date (a Monday). All relative day math starts here. */
export const BASE_DATE = "2026-07-06"

const pad = (n: number): string => String(n).padStart(2, "0")

/**
 * Local-midnight datetime string for `base + dayOffset` days.
 * e.g. localDayString(1) === "2026-07-07T00:00:00"
 */
export function localDayString(dayOffset: number, base: string = BASE_DATE): string {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + dayOffset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`
}

/**
 * The instant the generator produces for a slot: local wall-clock `hhmm`
 * on the local calendar day of `dayDate`. Mirrors atTimeOnDate in
 * generate.ts (new Date + setHours) so expectations are TZ-portable.
 */
export function atLocalTime(dayDate: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date(dayDate)
  d.setHours(h, m, 0, 0)
  return d
}

/** N teams for a division: teamIds `${divisionId}-t1..tN`, names "Team D1-1"… */
export function makeTeams(count: number, divisionId: string): SchedulerTeam[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1
    return {
      submissionId: `sub-${divisionId}-${n}`,
      teamId: `${divisionId}-t${n}`,
      divisionId,
      name: `Team ${divisionId.toUpperCase()}-${n}`,
    }
  })
}

export interface MakeInputOptions {
  gamesGuaranteed?: number
  gameSlotMinutes?: number
  gameLengthMinutes?: number
  idealGamesPerDayPerTeam?: number
  schedulingPhilosophy?: SchedulerPhilosophy
  allowCrossDivisionScheduling?: boolean
  /** Shorthand: single division "d1" named "Division 1" with N teams. Default 4. */
  teams?: number
  /** Full override of divisions (wins over `teams`). */
  divisions?: SchedulerInput["divisions"]
  schedulingGroups?: SchedulerInput["schedulingGroups"]
  /** Number of consecutive session days starting at baseDate. Default 2. */
  days?: number
  /** Courts per day-venue. Default 1. Court ids are stable across days. */
  courts?: number
  /** Day-venue window, "HH:MM". Defaults 09:00–17:00 (8 hourly slots/court/day). */
  open?: string
  close?: string
  baseDate?: string
  /** Full override of sessions (wins over days/courts/open/close). */
  sessions?: SchedulerInput["sessions"]
  defaultVenueOpenTime?: string
  defaultVenueCloseTime?: string
}

export function makeInput(opts: MakeInputOptions = {}): SchedulerInput {
  const {
    gamesGuaranteed = 3,
    gameSlotMinutes = 60,
    gameLengthMinutes = 50,
    idealGamesPerDayPerTeam = 2,
    schedulingPhilosophy = "FAMILY_FRIENDLY",
    allowCrossDivisionScheduling = false,
    teams = 4,
    schedulingGroups = [],
    days = 2,
    courts = 1,
    open = "09:00",
    close = "17:00",
    baseDate = BASE_DATE,
    defaultVenueOpenTime = "09:00",
    defaultVenueCloseTime = "20:00",
  } = opts

  const divisions =
    opts.divisions ?? [{ id: "d1", name: "Division 1", teams: makeTeams(teams, "d1") }]

  const sessions: SchedulerInput["sessions"] =
    opts.sessions ??
    [
      {
        id: "s1",
        phase: "REGULAR",
        days: Array.from({ length: days }, (_, i) => ({
          id: `day-${i + 1}`,
          date: localDayString(i, baseDate),
          dayVenues: [
            {
              id: `dv-${i + 1}`,
              venueId: "v1",
              startTime: open,
              endTime: close,
              courts: Array.from({ length: courts }, (_, c) => ({ id: `court-${c + 1}` })),
            },
          ],
        })),
      },
    ]

  return {
    gamesGuaranteed,
    gameSlotMinutes,
    gameLengthMinutes,
    idealGamesPerDayPerTeam,
    schedulingPhilosophy,
    allowCrossDivisionScheduling,
    defaultVenueOpenTime,
    defaultVenueCloseTime,
    divisions,
    schedulingGroups,
    sessions,
  }
}
