import { prisma } from "@youthbasketballhub/db"
import type {
  ScheduleBlackout,
  ScheduleWindow,
  SchedulerInput,
  SchedulerPhilosophy,
} from "./generate"
// Relative (not "@/") import: scripts/seed-nph-demo.ts pulls this module
// straight through tsx without the app's path alias.
import { effectiveSeasonConfig } from "../org/season-defaults"

export interface LoadSchedulerOptions {
  /**
   * Simulation only (owner 2026-08-01): treat this one PENDING schedule
   * request as if the league had approved it — nothing is written. The
   * approval UI uses this to show the cost of approving before deciding.
   */
  includePendingRequestId?: string
  /**
   * Org planner (owner 2026-08-01): extra hard court bookings injected by
   * the cross-league simulation (earlier seasons' placed games).
   */
  extraBusyBookings?: Array<{ courtId: string; start: string; end: string }>
}

/** Blackout DATE columns are date-only (UTC midnight) — key them by their
 *  UTC calendar day so they match the engine's local-date slot keys. */
const utcDateKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`

const hhmmToMin = (t: string | null | undefined): number | undefined => {
  if (!t) return undefined
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return undefined
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Load a Season + its substrate and shape it as SchedulerInput.
 * Only APPROVED team submissions feed the generator.
 */
export async function loadSchedulerInput(
  seasonId: string,
  options?: LoadSchedulerOptions
): Promise<{
  input: SchedulerInput | null
  errors: string[]
}> {
  const errors: string[] = []
  const season = (await (prisma as any).season.findUnique({
    where: { id: seasonId },
    include: {
      // Deterministic ordering EVERYWHERE (owner bug 2026-08-01): without
      // orderBy, Postgres row order varies by insertion/vacuum history, so
      // the SAME season with the SAME seed scheduled differently on the box
      // than anywhere else. The engine's determinism starts here.
      divisions: {
        orderBy: { id: "asc" },
        include: {
          teamSubmissions: {
            where: { status: "APPROVED" },
            orderBy: { id: "asc" },
            include: {
              team: { select: { id: true, name: true } },
              division: { select: { id: true } },
              blackouts: { orderBy: { id: "asc" } },
              scheduleRequests: { where: { status: "APPROVED" }, orderBy: { id: "asc" } },
            },
          },
        },
      },
      sessions: {
        orderBy: { id: "asc" },
        include: {
          days: {
            orderBy: { date: "asc" },
            include: {
              dayVenues: {
                orderBy: { id: "asc" },
                include: {
                  // Preferred fill order (owner 2026-07-30): court 1 packs
                  // first, the rest are overflow.
                  courts: {
                    select: { courtId: true, order: true },
                    orderBy: [{ order: "asc" }, { courtId: "asc" }],
                  },
                },
              },
            },
          },
        },
      },
      schedulingGroups: {
        orderBy: { id: "asc" },
        include: {
          divisions: { select: { divisionId: true } },
        },
      },
      // What each gym IS to the league (owner ruling 2026-08-03): the home
      // building it owns, or one of the pool it rents by the court-day.
      seasonVenues: {
        select: { venueId: true, role: true },
        orderBy: [{ venueId: "asc" }],
      },
      league: {
        select: { organization: { select: { seasonDefaults: true } } },
      },
    },
  })) as any

  if (!season) {
    errors.push("Season not found")
    return { input: null, errors }
  }

  // Season → org rulebook → system (Phase A): the scheduler runs off the
  // same effective config every other surface reads.
  const { values: cfg } = effectiveSeasonConfig(
    season,
    season.league?.organization?.seasonDefaults
  )

  if (!cfg.gamesGuaranteed) {
    errors.push("gamesGuaranteed must be set before generating a schedule")
  }

  // Weekend style resolution (owner 2026-08-01): the TEAM's own preference
  // wins; otherwise the league's declared default (season → org rulebook);
  // legacy philosophy maps as the default's source; system fallback SAME_DAY.
  const leagueDefaultStyle: "SAME_DAY" | "SPLIT_DAYS" =
    (cfg.defaultWeekendStyle as "SAME_DAY" | "SPLIT_DAYS" | null | undefined) ??
    ((cfg.schedulingPhilosophy ?? "FAMILY_FRIENDLY") === "SPREAD_DAYS"
      ? "SPLIT_DAYS"
      : "SAME_DAY")
  const resolveStyle = (ts: any): "SAME_DAY" | "SPLIT_DAYS" =>
    ts.weekendStyle && ts.weekendStyle !== "NO_PREFERENCE"
      ? ts.weekendStyle
      : leagueDefaultStyle

  // Approved schedule requests + blackouts (owner 2026-08-01). A simulated
  // pending request (approval-cost preview) folds in as if approved.
  const requestToWindow = (r: any): ScheduleWindow => ({
    dayOfWeek: r.dayOfWeek ?? undefined,
    dateKey: r.date ? utcDateKey(new Date(r.date)) : undefined,
    earliestMin: hhmmToMin(r.earliestStart),
    latestMin: hhmmToMin(r.latestStart),
  })
  const constraintsFor = (ts: any): { blackouts?: ScheduleBlackout[]; windows?: ScheduleWindow[] } => {
    const blackouts: ScheduleBlackout[] = (ts.blackouts ?? []).map((b: any) => ({
      dateKey: utcDateKey(new Date(b.date)),
      startMin: hhmmToMin(b.startTime),
      endMin: hhmmToMin(b.endTime),
    }))
    const windows: ScheduleWindow[] = (ts.scheduleRequests ?? [])
      .filter((r: any) => r.kind === "WINDOW")
      .map(requestToWindow)
    const pending = pendingRequest && pendingRequest.submissionId === ts.id ? pendingRequest : null
    if (pending) {
      if (pending.kind === "WINDOW") {
        windows.push(requestToWindow(pending))
      } else if (pending.date) {
        blackouts.push({
          dateKey: utcDateKey(new Date(pending.date)),
          startMin: hhmmToMin(pending.startTime),
          endMin: hhmmToMin(pending.endTime),
        })
      } else if (pending.dayOfWeek !== null && pending.dayOfWeek !== undefined) {
        // Recurring blackout: expand against the season's playing days.
        for (const sess of season.sessions ?? []) {
          for (const d of sess.days ?? []) {
            const day = new Date(d.date)
            if (day.getUTCDay() === pending.dayOfWeek) {
              blackouts.push({
                dateKey: utcDateKey(day),
                startMin: hhmmToMin(pending.startTime),
                endMin: hhmmToMin(pending.endTime),
              })
            }
          }
        }
      }
    }
    return {
      blackouts: blackouts.length > 0 ? blackouts : undefined,
      windows: windows.length > 0 ? windows : undefined,
    }
  }
  let pendingRequest: any = null
  if (options?.includePendingRequestId) {
    pendingRequest = await (prisma as any).teamScheduleRequest.findUnique({
      where: { id: options.includePendingRequestId },
    })
    if (pendingRequest && pendingRequest.status !== "PENDING") pendingRequest = null
  }

  const input: SchedulerInput = {
    gamesGuaranteed: (cfg.gamesGuaranteed as number) ?? 0,
    gameSlotMinutes: (cfg.gameSlotMinutes as number) ?? 90,
    gameLengthMinutes: (cfg.gameLengthMinutes as number) ?? 40,
    idealGamesPerDayPerTeam: (cfg.idealGamesPerDayPerTeam as number) ?? 2,
    // Stable per-season variety: rotates repeat matchups + time assignments
    // between seasons while keeping preview == commit within one.
    varietySeed: Array.from(seasonId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7),
    schedulingPhilosophy: (cfg.schedulingPhilosophy ?? "FAMILY_FRIENDLY") as SchedulerPhilosophy,
    allowCrossDivisionScheduling: !!season.allowCrossDivisionScheduling,
    defaultVenueOpenTime: (cfg.defaultVenueOpenTime as string) ?? "09:00",
    defaultVenueCloseTime: (cfg.defaultVenueCloseTime as string) ?? "20:00",
    divisions: (season.divisions ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      teams: (d.teamSubmissions ?? []).map((ts: any) => ({
        submissionId: ts.id,
        teamId: ts.teamId,
        divisionId: ts.divisionId,
        name: ts.team?.name ?? ts.teamId,
        weekendStyle: resolveStyle(ts),
        ...constraintsFor(ts),
      })),
    })),
    schedulingGroups: (season.schedulingGroups ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      divisionIds: (g.divisions ?? []).map((l: any) => l.divisionId),
    })),
    sessions: (season.sessions ?? []).map((s: any) => ({
      id: s.id,
      phase: s.phase,
      label: s.label ?? null,
      targetGamesPerTeam: s.targetGamesPerTeam ?? null,
      // (unitKeys folded into sessionUnitFilter below)
      days: (s.days ?? []).map((d: any) => ({
        id: d.id,
        date: new Date(d.date).toISOString(),
        dayVenues: (d.dayVenues ?? []).map((dv: any) => ({
          id: dv.id,
          venueId: dv.venueId,
          startTime: dv.startTime ?? null,
          endTime: dv.endTime ?? null,
          courts: (dv.courts ?? []).map((c: any) => ({ id: c.courtId, order: c.order ?? 0 })),
        })),
      })),
    })),
  }

  // Shared venues (owner 2026-07-31): leagues each get their own windows,
  // but when a second league lands on the same courts by mistake, we don't
  // double-book and we don't hard-stop — other leagues' games become busy
  // bookings the generator schedules AROUND, and the capacity card says how
  // many slots they took so the operator can add hours or courts.
  const courtIds = [
    ...new Set(
      input.sessions.flatMap((s) =>
        s.days.flatMap((d) => d.dayVenues.flatMap((dv) => dv.courts.map((c) => c.id)))
      )
    ),
  ]
  const dayDates = input.sessions.flatMap((s) => s.days.map((d) => new Date(d.date).getTime()))
  if (courtIds.length > 0 && dayDates.length > 0) {
    const from = new Date(Math.min(...dayDates) - 24 * 3600_000)
    const to = new Date(Math.max(...dayDates) + 48 * 3600_000)
    const busyGames = await (prisma as any).game.findMany({
      where: {
        courtId: { in: courtIds },
        OR: [{ seasonId: null }, { seasonId: { not: seasonId } }],
        status: { not: "CANCELLED" },
        scheduledAt: { gte: from, lte: to },
      },
      select: { courtId: true, scheduledAt: true, duration: true },
    })
    if (busyGames.length > 0) {
      input.busyCourtBookings = busyGames.map((g: any) => ({
        courtId: g.courtId,
        start: new Date(g.scheduledAt).toISOString(),
        end: new Date(new Date(g.scheduledAt).getTime() + (g.duration ?? 90) * 60000).toISOString(),
      }))
    }
  }
  if (options?.extraBusyBookings?.length) {
    input.busyCourtBookings = [...(input.busyCourtBookings ?? []), ...options.extraBusyBookings]
  }

  // Persisted per-session unit assignments (owner 2026-08-01: NPH's real
  // calendar gives every grade its own weekends). A session with unitKeys
  // hosts ONLY those units; sessions with none host any unit.
  const unitFilter: Record<string, string[]> = {}
  for (const sess of season.sessions ?? []) {
    if (Array.isArray(sess.unitKeys) && sess.unitKeys.length > 0) {
      unitFilter[sess.id] = sess.unitKeys
    }
  }
  if (Object.keys(unitFilter).length > 0) {
    input.sessionUnitFilter = { ...unitFilter, ...(input.sessionUnitFilter ?? {}) }
  }

  // The plan's BUILDINGS (owner ruling 2026-08-03). The home gym is the one
  // the league owns and the one the engine packs into first; the pool is
  // rented, so nothing about it is a ranking. unitVenues then says which gym
  // each grade plays in that weekend — a preference the engine honors while
  // it can.
  const venueRoles: Record<string, "home" | "pool"> = {}
  for (const sv of season.seasonVenues ?? []) {
    venueRoles[sv.venueId] = sv.role === "home" ? "home" : "pool"
  }
  if (Object.keys(venueRoles).length > 0) input.venueRoles = venueRoles

  // unitVenues is keyed by unit key ("division:<id>"); the engine wants plain
  // division ids. Anything else in there is stale and simply ignored.
  const venueAssignments: Record<string, Record<string, string>> = {}
  for (const sess of season.sessions ?? []) {
    const raw = sess.unitVenues
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const perSession: Record<string, string> = {}
    for (const [key, venueId] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof venueId !== "string" || venueId.length === 0) continue
      if (!key.startsWith("division:")) continue
      const divisionId = key.slice("division:".length)
      if (divisionId.length > 0) perSession[divisionId] = venueId
    }
    if (Object.keys(perSession).length > 0) venueAssignments[sess.id] = perSession
  }
  if (Object.keys(venueAssignments).length > 0) input.venueAssignments = venueAssignments

  return { input, errors }
}
