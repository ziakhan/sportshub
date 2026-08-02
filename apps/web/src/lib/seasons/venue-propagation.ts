import { prisma } from "@youthbasketballhub/db"
import { weekendLabel } from "@/lib/scheduler/planner-core"

/**
 * Venue → session propagation (owner 2026-07-31): a venue added to the
 * season should reach every session automatically — nobody should have to
 * open each session and tick courts on. Each session DAY that doesn't
 * already use the venue gets a dayVenue (window = the day's existing window
 * from its sibling venues, else the venue's default hours) plus the given
 * courts in preferred order. Sessions that already use the venue are left
 * exactly as the operator configured them.
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
  const sessions = await (prisma as any).seasonSession.findMany({
    where: { seasonId },
    select: {
      id: true,
      days: {
        select: {
          id: true,
          dayVenues: { select: { id: true, venueId: true, startTime: true, endTime: true } },
        },
      },
    },
  })

  const touched = new Set<string>()
  for (const session of sessions) {
    for (const day of session.days) {
      if (day.dayVenues.some((dv: any) => dv.venueId === venueId)) continue
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
      await tx.seasonSessionDay.create({ data: { sessionId: session.id, date } })
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
  fallbackHours: { startTime: string; endTime: string } = { startTime: "09:00", endTime: "18:00" }
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
