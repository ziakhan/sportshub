import { prisma } from "@youthbasketballhub/db"

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
