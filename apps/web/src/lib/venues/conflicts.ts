import { prisma } from "@youthbasketballhub/db"

/**
 * Venue booking conflict detection (owner ruling 2026-07-21).
 *
 * Layer-3 "actual bookings" overlap check at a single venue. Point-in-time
 * entities only (Game, Practice, Tryout, TeamEvent — each has a start + a
 * duration). Camps and house-leagues are date-range / recurring and are not
 * point-checked here.
 *
 * Two audiences, one privacy rule:
 *  - sameOrg: bookings we can cheaply prove belong to the querying tenant
 *    (Tryout.tenantId, Practice.team.tenantId). Safe to show specifics — it's
 *    their own calendar.
 *  - otherOrgCount: everything else (other clubs/leagues, or bookings whose
 *    org isn't cheap to attribute). The caller shows a GENERIC "this venue may
 *    already be booked — please confirm" nudge that NEVER reveals whose booking
 *    it is or their hours. This is a soft, non-blocking advisory: off-platform
 *    bookings are invisible, so it's a helpful check, not a guarantee. Becomes
 *    an enforceable check once a venue-operator owns the master calendar.
 */

export interface VenueConflict {
  kind: "game" | "practice" | "tryout" | "event"
  title: string
  startAt: string
  endAt: string
}

export interface VenueConflictResult {
  sameOrg: VenueConflict[]
  otherOrgCount: number
  hasAny: boolean
}

const EMPTY: VenueConflictResult = { sameOrg: [], otherOrgCount: 0, hasAny: false }

export async function findVenueConflicts(opts: {
  venueId: string
  startAt: Date
  durationMinutes: number
  tenantId?: string | null
  /** Exclude a row being edited so a program never conflicts with itself. */
  excludeTryoutId?: string
}): Promise<VenueConflictResult> {
  if (!opts.venueId || Number.isNaN(opts.startAt.getTime())) return EMPTY

  const start = opts.startAt
  const end = new Date(start.getTime() + Math.max(15, opts.durationMinutes || 60) * 60000)
  // Widen the lower bound so a booking that STARTS earlier but runs into our
  // window is still fetched (assume no single booking exceeds 6h).
  const windowStart = new Date(start.getTime() - 6 * 3600 * 1000)
  const overlaps = (s: Date, e: Date) => s < end && start < e

  const [games, practices, tryouts, events] = await Promise.all([
    prisma.game.findMany({
      where: {
        venueId: opts.venueId,
        status: { in: ["SCHEDULED", "LIVE", "POSTPONED"] },
        scheduledAt: { gte: windowStart, lt: end },
      },
      select: {
        scheduledAt: true,
        duration: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
    prisma.practice.findMany({
      where: {
        venueId: opts.venueId,
        status: "SCHEDULED",
        scheduledAt: { gte: windowStart, lt: end },
      },
      select: {
        scheduledAt: true,
        duration: true,
        team: { select: { tenantId: true, name: true } },
      },
    }),
    prisma.tryout.findMany({
      where: {
        venueId: opts.venueId,
        ...(opts.excludeTryoutId ? { id: { not: opts.excludeTryoutId } } : {}),
        scheduledAt: { gte: windowStart, lt: end },
      },
      select: { scheduledAt: true, duration: true, title: true, tenantId: true },
    }),
    prisma.teamEvent.findMany({
      where: {
        venueId: opts.venueId,
        status: "SCHEDULED",
        startAt: { gte: windowStart, lt: end },
      },
      select: { startAt: true, durationMinutes: true, title: true },
    }),
  ])

  const sameOrg: VenueConflict[] = []
  let otherOrgCount = 0
  const push = (
    isSame: boolean,
    kind: VenueConflict["kind"],
    title: string,
    s: Date,
    e: Date
  ) => {
    if (isSame) sameOrg.push({ kind, title, startAt: s.toISOString(), endAt: e.toISOString() })
    else otherOrgCount++
  }

  for (const g of games) {
    const s = g.scheduledAt
    const e = new Date(s.getTime() + (g.duration ?? 90) * 60000)
    if (!overlaps(s, e)) continue
    // Game org attribution (season -> league tenant) isn't cheap — generic.
    push(false, "game", `${g.homeTeam?.name ?? "Game"} vs ${g.awayTeam?.name ?? ""}`.trim(), s, e)
  }
  for (const p of practices) {
    const s = p.scheduledAt
    const e = new Date(s.getTime() + (p.duration ?? 60) * 60000)
    if (!overlaps(s, e)) continue
    const same = !!opts.tenantId && p.team?.tenantId === opts.tenantId
    push(same, "practice", `${p.team?.name ?? "Team"} practice`, s, e)
  }
  for (const t of tryouts) {
    const s = t.scheduledAt
    const e = new Date(s.getTime() + (t.duration ?? 90) * 60000)
    if (!overlaps(s, e)) continue
    const same = !!opts.tenantId && t.tenantId === opts.tenantId
    push(same, "tryout", t.title, s, e)
  }
  for (const ev of events) {
    const s = ev.startAt
    const e = new Date(s.getTime() + (ev.durationMinutes ?? 60) * 60000)
    if (!overlaps(s, e)) continue
    // TeamEvent org attribution is many-to-many — generic.
    push(false, "event", ev.title, s, e)
  }

  return { sameOrg, otherOrgCount, hasAny: sameOrg.length > 0 || otherOrgCount > 0 }
}
