import { prisma } from "@youthbasketballhub/db"
// Relative (not "@/") imports: scripts/seed-journey.ts and
// scripts/demo/apply-njc-defaults.ts pull this module straight through tsx,
// which does not know the app's path alias.
import { weekendLabel } from "../scheduler/planner-core"
import { isSeasonLocked } from "./season-lock"

/**
 * Venue → session propagation (owner 2026-07-31): a venue added to the
 * season should reach every session automatically — nobody should have to
 * open each session and tick courts on. Each session DAY that doesn't
 * already use the venue gets a dayVenue (window = the day's existing window
 * from its sibling venues, else the venue's default hours) plus the given
 * courts in preferred order. Sessions that already use the venue are left
 * exactly as the operator configured them.
 *
 * Weekends this season has marked unavailable for the gym are skipped: a
 * building the NJC/NSC circuits have that weekend does not become ours just
 * because the season added it (owner ruling 2026-08-02).
 *
 * Returns the number of SESSIONS touched (not days).
 */
export async function propagateVenueToSessions(
  seasonId: string,
  venueId: string,
  courtIds: string[],
  fallbackHours: { startTime: string; endTime: string }
): Promise<number> {
  if (courtIds.length === 0) return 0
  const [sessions, unavailable] = await Promise.all([
    (prisma as any).seasonSession.findMany({
      where: { seasonId },
      select: {
        id: true,
        days: {
          select: {
            id: true,
            date: true,
            dayVenues: { select: { id: true, venueId: true, startTime: true, endTime: true } },
          },
        },
      },
    }),
    unavailableWeekendsFor(seasonId, venueId),
  ])

  const touched = new Set<string>()
  for (const session of sessions) {
    for (const day of session.days) {
      if (day.dayVenues.some((dv: any) => dv.venueId === venueId)) continue
      const key = weekendKeyOf(day.date)
      if (key && unavailable.has(key.toISOString())) continue
      const sibling = day.dayVenues[0]
      const dayVenue = await (prisma as any).seasonSessionDayVenue.create({
        data: {
          dayId: day.id,
          venueId,
          startTime: sibling?.startTime ?? fallbackHours.startTime,
          endTime: sibling?.endTime ?? fallbackHours.endTime,
        },
      })
      await (prisma as any).seasonSessionDayVenueCourt.createMany({
        data: courtIds.map((courtId, idx) => ({ dayVenueId: dayVenue.id, courtId, order: idx })),
      })
      touched.add(session.id)
    }
  }
  return touched.size
}

/**
 * The window a day-venue should inherit, resolved per weekday: the season's
 * private scheduling hours at the venue (SeasonVenueHours) first, then the
 * venue's own posted hours (VenueHours). Sibling day-venues win over both —
 * the caller applies that, because it is per-DAY.
 */
async function inheritedWindows(
  seasonId: string,
  venueId: string
): Promise<Map<number, { startTime: string; endTime: string }>> {
  const [seasonVenue, venueHours] = await Promise.all([
    (prisma as any).seasonVenue.findFirst({
      where: { seasonId, venueId },
      select: {
        hours: { select: { dayOfWeek: true, openTime: true, closeTime: true } },
      },
    }),
    (prisma as any).venueHours.findMany({
      where: { venueId },
      select: { dayOfWeek: true, openTime: true, closeTime: true },
    }),
  ])

  const byDow = new Map<number, { startTime: string; endTime: string }>()
  for (const h of venueHours) {
    if (h.openTime && h.closeTime) byDow.set(h.dayOfWeek, { startTime: h.openTime, endTime: h.closeTime })
  }
  for (const h of seasonVenue?.hours ?? []) {
    if (h.openTime && h.closeTime) byDow.set(h.dayOfWeek, { startTime: h.openTime, endTime: h.closeTime })
  }
  return byDow
}

/** The session's days, scoped to the season (IDOR guard for every caller). */
async function sessionDays(
  seasonId: string,
  sessionId: string
): Promise<Array<{
  id: string
  date: Date
  dayVenues: Array<{ id: string; venueId: string; startTime: string | null; endTime: string | null }>
}> | null> {
  const session = await (prisma as any).seasonSession.findFirst({
    where: { id: sessionId, seasonId },
    select: {
      days: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          dayVenues: { select: { id: true, venueId: true, startTime: true, endTime: true } },
        },
      },
    },
  })
  return session ? session.days : null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight UTC of a date — session days are stored and read as UTC dates
 *  everywhere in the scheduler, so every weekend key agrees. */
function utcMidnight(value: Date | string): Date {
  const d = new Date(value)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * ── Weekends a gym is NOT available (owner ruling 2026-08-02) ─────────────
 *
 * "Off" and "we cannot have this gym that weekend, because the NJC/NSC
 * circuits have it" are different facts, and only the second one has a
 * reason worth showing. A released weekend leaves no row anywhere, so
 * SeasonVenueUnavailability is where the reason lives: one row per
 * (season, gym, Saturday).
 *
 * Two rules hold everywhere these are read:
 *   - ATTACHMENT WINS. A weekend that is marked AND attached is simply on —
 *     the operator overrode the mark, and turning a cell on deletes it.
 *   - Only defaults and imports create marks. Turning a cell off is plain
 *     off, never a reason nobody typed.
 */

/** The Saturday that owns a session day, UTC midnight — the weekend key.
 *  Null for a Mon–Fri day, which belongs to no weekend. */
export function weekendKeyOf(value: Date | string): Date | null {
  const day = utcMidnight(value)
  if (Number.isNaN(day.getTime())) return null
  const dow = day.getUTCDay()
  if (dow === 6) return day
  if (dow === 0) return new Date(day.getTime() - DAY_MS)
  return null
}

export interface VenueWeekendMark {
  venueId: string
  /** Saturday, UTC midnight ISO — the same key the grid columns use. */
  satDateISO: string
  reason: string | null
}

/** Every weekend this season has marked unavailable, for one gym or all. */
export async function loadVenueUnavailability(
  seasonId: string,
  venueId?: string
): Promise<VenueWeekendMark[]> {
  const rows = await (prisma as any).seasonVenueUnavailability.findMany({
    where: { seasonId, ...(venueId ? { venueId } : {}) },
    orderBy: { satDate: "asc" },
    select: { venueId: true, satDate: true, reason: true },
  })
  return rows.map((r: any) => ({
    venueId: r.venueId,
    satDateISO: utcMidnight(r.satDate).toISOString(),
    reason: r.reason ?? null,
  }))
}

/** Weekend key → reason, for one gym. The value may be null (marked, no
 *  reason given); use `.has()`, never truthiness, to ask if it is marked. */
export async function unavailableWeekendsFor(
  seasonId: string,
  venueId: string
): Promise<Map<string, string | null>> {
  const marks = await loadVenueUnavailability(seasonId, venueId)
  return new Map(marks.map((m) => [m.satDateISO, m.reason]))
}

/** Mark a weekend unavailable, with the reason. Idempotent: re-running an
 *  import re-states the reason rather than piling up rows. */
export async function markVenueUnavailable(
  seasonId: string,
  venueId: string,
  satDate: Date | string,
  reason: string | null
): Promise<{ satDateISO: string; created: boolean } | null> {
  const sat = weekendKeyOf(satDate)
  if (!sat || sat.getUTCDay() !== 6) return null
  const existing = await (prisma as any).seasonVenueUnavailability.findUnique({
    where: { seasonId_venueId_satDate: { seasonId, venueId, satDate: sat } },
    select: { id: true },
  })
  await (prisma as any).seasonVenueUnavailability.upsert({
    where: { seasonId_venueId_satDate: { seasonId, venueId, satDate: sat } },
    create: { seasonId, venueId, satDate: sat, reason },
    update: { reason },
  })
  return { satDateISO: sat.toISOString(), created: !existing }
}

/** The operator's override: putting the gym on a marked weekend drops the
 *  mark, so an attachment and a reason never both stand for one weekend. */
export async function clearVenueUnavailability(
  seasonId: string,
  venueId: string,
  satDates: Array<Date | string>
): Promise<number> {
  const keys = satDates
    .map(weekendKeyOf)
    .filter((d): d is Date => d !== null)
  if (keys.length === 0) return 0
  const { count } = await (prisma as any).seasonVenueUnavailability.deleteMany({
    where: { seasonId, venueId, satDate: { in: keys } },
  })
  return count
}

/** The same override, addressed by session: every weekend the session sits
 *  on. Season-scoped, so a session id from another season clears nothing. */
export async function clearSessionVenueUnavailability(
  seasonId: string,
  sessionId: string,
  venueId: string
): Promise<number> {
  const days = await sessionDays(seasonId, sessionId)
  if (!days) return 0
  return clearVenueUnavailability(seasonId, venueId, days.map((d) => d.date))
}

/** What a new weekend should play: whatever its siblings play (the most
 *  common non-null), else the season's own target, else 2 (the 10/5/2 norm). */
function siblingGamesPerTeam(
  siblings: Array<{ targetGamesPerTeam: number | null }>,
  seasonTarget: number | null
): number {
  const counts = new Map<number, number>()
  for (const s of siblings) {
    if (s.targetGamesPerTeam == null) continue
    counts.set(s.targetGamesPerTeam, (counts.get(s.targetGamesPerTeam) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best ?? seasonTarget ?? 2
}

/**
 * The session behind one weekend, creating it when nobody has (planner step
 * 2, owner 2026-08-02: "make it open for every month, all weekends"). The
 * grid now offers every Sat–Sun of the season, most of which have no session
 * yet — turning a gym on for one of those has to bring the weekend into
 * existence first.
 *
 * Idempotent: a weekend that already has a session (REGULAR preferred, but a
 * finals weekend counts too — we never double-book a date) returns that one
 * untouched. A created session copies its siblings' games-per-team and is
 * named the way the season names its weekends.
 *
 * Returns null when the season or the date is not real, so callers 400/404
 * instead of writing orphan rows.
 */
export async function ensureWeekendSession(
  seasonId: string,
  satDateISO: string
): Promise<{ sessionId: string; created: boolean } | null> {
  const sat = utcMidnight(satDateISO)
  if (Number.isNaN(sat.getTime()) || sat.getUTCDay() !== 6) return null

  const sun = new Date(sat.getTime() + DAY_MS)
  const monday = new Date(sat.getTime() + 2 * DAY_MS)

  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { id: true, targetGamesPerSession: true },
  })
  if (!season) return null

  const onThisWeekend = await (prisma as any).seasonSession.findMany({
    where: { seasonId, days: { some: { date: { gte: sat, lt: monday } } } },
    select: { id: true, phase: true },
    orderBy: { createdAt: "asc" },
  })
  const match =
    onThisWeekend.find((s: any) => s.phase === "REGULAR") ?? onThisWeekend[0] ?? null
  if (match) return { sessionId: match.id, created: false }

  const siblings = await (prisma as any).seasonSession.findMany({
    where: { seasonId, phase: "REGULAR" },
    select: { targetGamesPerTeam: true, days: { orderBy: { date: "asc" }, select: { date: true } } },
  })
  // "Weekend 7 · Nov 14" — the number is the weekend's place in the season.
  const position =
    siblings.filter((s: any) => s.days[0] && new Date(s.days[0].date).getTime() < sat.getTime())
      .length + 1

  const created = await (prisma as any).$transaction(async (tx: any) => {
    const session = await tx.seasonSession.create({
      data: {
        seasonId,
        // Same shape the season's own weekends carry: "Weekend 7 · Nov 14".
        label: `Weekend ${position} · ${weekendLabel([sat])}`,
        phase: "REGULAR",
        targetGamesPerTeam: siblingGamesPerTeam(siblings, season.targetGamesPerSession ?? null),
      },
      select: { id: true },
    })
    for (const date of [sat, sun]) {
      /**
       * Day rows are LOCAL-midnight instants (QA T-015; same law as the
       * national-circuit seed, runbook #81): the engine sets slot times with
       * local setHours, so a UTC-midnight row under TZ=America/Toronto lands
       * games a day early, and every local rendering of the date reads the
       * previous day. The UTC calendar day is the intended one; this pins
       * midnight of that day in the server's own timezone.
       */
      await tx.seasonSessionDay.create({
        data: {
          sessionId: session.id,
          date: new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
        },
      })
    }
    return session
  })

  return { sessionId: created.id, created: true }
}

/**
 * ONE weekend's worth of propagation (planner step 2, owner 2026-08-02: the
 * gyms-and-weekends grid toggles a gym for a single weekend, never the whole
 * season). Sibling of propagateVenueToSessions with the same inheritance —
 * sibling day-venue's window, else that weekday's SeasonVenueHours, else the
 * venue's posted hours, else the caller's fallback — scoped to one session.
 *
 * Days that already use the venue are left exactly as the operator left them.
 */
export async function attachVenueToSession(
  seasonId: string,
  sessionId: string,
  venueId: string,
  courtIds: string[],
  fallbackHours: { startTime: string; endTime: string } = { startTime: "09:00", endTime: "18:00" },
  /** Where the booking stands (owner ruling 2026-08-03). An operator ticking a
   *  cell on is asserting the gym is theirs, so "confirmed" is the default; the
   *  solver assigning a block from the pool passes "assumed". */
  bookingStatus: "assumed" | "confirmed" = "confirmed"
): Promise<{ daysAttached: number; alreadyAttached: number }> {
  const days = await sessionDays(seasonId, sessionId)
  if (!days || courtIds.length === 0) return { daysAttached: 0, alreadyAttached: 0 }

  const byDow = await inheritedWindows(seasonId, venueId)

  let daysAttached = 0
  let alreadyAttached = 0
  for (const day of days) {
    if (day.dayVenues.some((dv) => dv.venueId === venueId)) {
      alreadyAttached++
      continue
    }
    const sibling = day.dayVenues[0]
    const dow = new Date(day.date).getUTCDay()
    const inherited = byDow.get(dow)
    const dayVenue = await (prisma as any).seasonSessionDayVenue.create({
      data: {
        dayId: day.id,
        venueId,
        startTime: sibling?.startTime ?? inherited?.startTime ?? fallbackHours.startTime,
        endTime: sibling?.endTime ?? inherited?.endTime ?? fallbackHours.endTime,
        bookingStatus,
      },
    })
    await (prisma as any).seasonSessionDayVenueCourt.createMany({
      data: courtIds.map((courtId, idx) => ({ dayVenueId: dayVenue.id, courtId, order: idx })),
    })
    daysAttached++
  }
  return { daysAttached, alreadyAttached }
}

/**
 * Release a gym from ONE weekend: drop its day-venue rows (and their courts)
 * for that session's days only. Every other weekend keeps the gym.
 *
 * Games already placed there block the release — Game.dayVenueId is nullable,
 * so deleting underneath a scheduled game would quietly strand it with no
 * venue instead of failing loudly.
 */
export async function detachVenueFromSession(
  seasonId: string,
  sessionId: string,
  venueId: string
): Promise<{ daysReleased: number; courtsReleased: number; gamesBlocking: number }> {
  const days = await sessionDays(seasonId, sessionId)
  if (!days) return { daysReleased: 0, courtsReleased: 0, gamesBlocking: 0 }

  const dayVenueIds = days.flatMap((d) =>
    d.dayVenues.filter((dv) => dv.venueId === venueId).map((dv) => dv.id)
  )
  if (dayVenueIds.length === 0) return { daysReleased: 0, courtsReleased: 0, gamesBlocking: 0 }

  const gamesBlocking = await (prisma as any).game.count({
    where: { dayVenueId: { in: dayVenueIds } },
  })
  if (gamesBlocking > 0) return { daysReleased: 0, courtsReleased: 0, gamesBlocking }

  const courts = await (prisma as any).seasonSessionDayVenueCourt.deleteMany({
    where: { dayVenueId: { in: dayVenueIds } },
  })
  const released = await (prisma as any).seasonSessionDayVenue.deleteMany({
    where: { id: { in: dayVenueIds } },
  })
  return { daysReleased: released.count, courtsReleased: courts.count, gamesBlocking: 0 }
}

/**
 * A one-weekend hours exception, edited on the grid cell itself (owner
 * 2026-08-02: "a one-weekend exception is edited on the cell, never in a
 * settings page"). Writes startTime/endTime straight onto this session's
 * day-venue rows and NEVER touches SeasonVenueHours — the season-wide
 * default stays exactly what it was.
 *
 * Pass `window = null` to put the weekend back on the season default.
 */
export async function setSessionVenueWindow(
  seasonId: string,
  sessionId: string,
  venueId: string,
  window: { startTime: string; endTime: string } | null
): Promise<{ updated: number }> {
  const days = await sessionDays(seasonId, sessionId)
  if (!days) return { updated: 0 }

  const byDow = window === null ? await inheritedWindows(seasonId, venueId) : null

  let updated = 0
  for (const day of days) {
    const dayVenue = day.dayVenues.find((dv) => dv.venueId === venueId)
    if (!dayVenue) continue
    const next = window ?? byDow?.get(new Date(day.date).getUTCDay())
    if (!next) continue
    await (prisma as any).seasonSessionDayVenue.update({
      where: { id: dayVenue.id },
      data: { startTime: next.startTime, endTime: next.endTime },
    })
    updated++
  }
  return { updated }
}

/**
 * Where a rented weekend stands as a BOOKING (owner ruling 2026-08-03): the
 * solver assigns a gym from the pool ("assumed"), and the operator asserts
 * that the gym said yes ("confirmed"). One weekend, one answer — every day of
 * the session at that gym moves together, because a gym does not rent you
 * Saturday and think about Sunday.
 *
 * The home gym is implicitly confirmed: nobody books the building they own.
 * Callers may still set it, and it is harmless.
 */
export async function setSessionVenueBookingStatus(
  seasonId: string,
  sessionId: string,
  venueId: string,
  bookingStatus: "assumed" | "confirmed"
): Promise<{ updated: number }> {
  const days = await sessionDays(seasonId, sessionId)
  if (!days) return { updated: 0 }
  const ids = days
    .flatMap((d) => d.dayVenues.filter((dv) => dv.venueId === venueId))
    .map((dv) => dv.id)
  if (ids.length === 0) return { updated: 0 }
  const { count } = await (prisma as any).seasonSessionDayVenue.updateMany({
    where: { id: { in: ids } },
    data: { bookingStatus },
  })
  return { updated: count }
}

/**
 * The season's DEFAULT courts at a venue: the first `courtsAvailable` courts
 * in display order (all of them when no count was chosen). This is what new
 * sessions start with and what propagation adds.
 */
export async function defaultCourtIdsForVenue(
  venueId: string,
  courtsAvailable: number | null
): Promise<string[]> {
  const courts = await (prisma as any).court.findMany({
    where: { venueId },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  })
  const ids = courts.map((c: any) => c.id)
  return courtsAvailable != null ? ids.slice(0, courtsAvailable) : ids
}

/**
 * Venue-hours edits reach the rows the SCHEDULER reads (owner 2026-08-01:
 * hours were changed to 8:00-20:00 but half the weekends' session-day rows
 * kept the old window — the engine scheduled on mixed hours and the
 * scenario advice read as nonsense). Updates every existing session-day
 * row for the venue whose weekday has non-null hours; returns rows updated.
 */
export async function applyVenueHoursToSessionDays(
  seasonId: string,
  venueId: string,
  hours: Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null }>
): Promise<number> {
  const byDow = new Map(hours.map((h) => [h.dayOfWeek, h]))
  const dayVenues = await (prisma as any).seasonSessionDayVenue.findMany({
    where: { venueId, day: { session: { seasonId } } },
    select: { id: true, day: { select: { date: true } } },
  })
  let updated = 0
  for (const dv of dayVenues) {
    const h = byDow.get(new Date(dv.day.date).getUTCDay())
    if (!h?.openTime || !h?.closeTime) continue
    await (prisma as any).seasonSessionDayVenue.update({
      where: { id: dv.id },
      data: { startTime: h.openTime, endTime: h.closeTime },
    })
    updated++
  }
  return updated
}

export interface CourtRewireResult {
  /** Weekend DAYS whose court set (or fill order) actually changed. */
  daysRewired: number
  /** Days where a court could not be pulled because a game is on it. */
  daysBlocked: number
  courtsAdded: number
  courtsRemoved: number
  /** The courts a game is holding, deduped — for the operator's sentence. */
  blockedCourtIds: string[]
}

/**
 * Court-count edits reach the rows the SCHEDULER reads (owner hit this live
 * 2026-08-02: Six Park was set to 6 courts and The Playground to 3, then the
 * calendar showed heavy red over-scheduling because planner capacity comes
 * from SeasonSessionDayVenueCourt rows that were wired ONCE at attach time).
 * Hours already propagated; courts did not, so every court edit after attach
 * was invisible to capacity.
 *
 * Sibling of applyVenueHoursToSessionDays: for every day-venue of this venue
 * in this season, make the court rows be exactly `courtIds`, in that
 * preferred fill order.
 *
 * The one guard: a court a GAME is already on is never pulled out from under
 * it (Game.courtId, matched on this day-venue — or on the same day at the
 * same venue, for legacy rows written before Game.dayVenueId existed). That
 * court keeps its row on THAT day, sorted after the courts the season wants,
 * and the day is reported in `daysBlocked` so the UI can say so instead of
 * quietly stranding a scheduled game. Adding courts is always safe.
 *
 * An empty `courtIds` is a no-op: a season never means "no courts anywhere".
 *
 * SCOPED TO ONE WEEKEND (owner ruling 2026-08-04, the "I don't have this"
 * correction): pass `scope.sessionId` and only that weekend's day-venues are
 * rewired. A gym giving three of its six courts on one Saturday is a fact about
 * that Saturday, and writing it season-wide would be a different, wrong claim.
 * `scope.allowEmpty` goes with it: on one weekend "no courts" is a real answer
 * a gym can give, even though it never is for a whole season.
 */
export async function applyVenueCourtsToSessionDays(
  seasonId: string,
  venueId: string,
  courtIds: string[],
  scope?: { sessionId?: string; allowEmpty?: boolean }
): Promise<CourtRewireResult> {
  const empty: CourtRewireResult = {
    daysRewired: 0,
    daysBlocked: 0,
    courtsAdded: 0,
    courtsRemoved: 0,
    blockedCourtIds: [],
  }
  const desired = [...new Set(courtIds)]
  if (desired.length === 0 && !scope?.allowEmpty) return empty

  const dayVenues = await (prisma as any).seasonSessionDayVenue.findMany({
    where: {
      venueId,
      day: {
        session: { seasonId, ...(scope?.sessionId ? { id: scope.sessionId } : {}) },
      },
    },
    select: {
      id: true,
      dayId: true,
      courts: { select: { id: true, courtId: true, order: true } },
    },
  })
  if (dayVenues.length === 0) return empty

  const desiredSet = new Set(desired)
  const result: CourtRewireResult = { ...empty, blockedCourtIds: [] }
  const blockedAll = new Set<string>()

  for (const dv of dayVenues) {
    const current = new Map<string, { id: string; order: number }>(
      dv.courts.map((c: any) => [c.courtId, { id: c.id, order: c.order }])
    )
    const toRemove = [...current.keys()].filter((id) => !desiredSet.has(id))
    const toAdd = desired.filter((id) => !current.has(id))

    let blocked: string[] = []
    if (toRemove.length > 0) {
      const games = await (prisma as any).game.findMany({
        where: {
          courtId: { in: toRemove },
          OR: [{ dayVenueId: dv.id }, { dayId: dv.dayId, venueId }],
        },
        select: { courtId: true },
      })
      blocked = [...new Set(games.map((g: any) => g.courtId).filter(Boolean))] as string[]
    }
    const blockedSet = new Set(blocked)
    const removable = toRemove.filter((id) => !blockedSet.has(id))

    if (removable.length > 0) {
      const dropped = await (prisma as any).seasonSessionDayVenueCourt.deleteMany({
        where: { dayVenueId: dv.id, courtId: { in: removable } },
      })
      result.courtsRemoved += dropped.count
    }
    if (toAdd.length > 0) {
      await (prisma as any).seasonSessionDayVenueCourt.createMany({
        data: toAdd.map((courtId) => ({
          dayVenueId: dv.id,
          courtId,
          order: desired.indexOf(courtId),
        })),
      })
      result.courtsAdded += toAdd.length
    }

    // Fill order: the season's courts first, in the season's order, then any
    // court a game is holding on to.
    let reordered = 0
    for (const [i, courtId] of desired.entries()) {
      const row = current.get(courtId)
      if (!row || row.order === i) continue
      await (prisma as any).seasonSessionDayVenueCourt.update({
        where: { id: row.id },
        data: { order: i },
      })
      reordered++
    }
    for (const [i, courtId] of blocked.entries()) {
      const row = current.get(courtId)
      const order = desired.length + i
      if (!row || row.order === order) continue
      await (prisma as any).seasonSessionDayVenueCourt.update({
        where: { id: row.id },
        data: { order },
      })
      reordered++
    }

    if (blocked.length > 0) {
      result.daysBlocked++
      for (const id of blocked) blockedAll.add(id)
    }
    if (removable.length > 0 || toAdd.length > 0 || reordered > 0) result.daysRewired++
  }

  result.blockedCourtIds = [...blockedAll]
  return result
}

/**
 * The same rewire for a court change made on the VENUE itself (a court added
 * or deleted in the venue editor): every season that still has this gym and
 * is not finalized follows, each on its own court count. A locked season is
 * left exactly as it was finalized.
 */
export async function applyVenueCourtsToAllSeasons(venueId: string): Promise<{
  seasonsRewired: number
  daysRewired: number
  daysBlocked: number
}> {
  const seasonVenues = await (prisma as any).seasonVenue.findMany({
    where: { venueId },
    select: { seasonId: true, courtsAvailable: true, season: { select: { status: true } } },
  })
  let seasonsRewired = 0
  let daysRewired = 0
  let daysBlocked = 0
  for (const sv of seasonVenues) {
    if (isSeasonLocked(sv.season?.status)) continue
    const courtIds = await defaultCourtIdsForVenue(venueId, sv.courtsAvailable)
    if (courtIds.length === 0) continue
    const res = await applyVenueCourtsToSessionDays(sv.seasonId, venueId, courtIds)
    if (res.daysRewired > 0) seasonsRewired++
    daysRewired += res.daysRewired
    daysBlocked += res.daysBlocked
  }
  return { seasonsRewired, daysRewired, daysBlocked }
}
