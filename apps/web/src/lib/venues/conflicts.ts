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

export interface VenueConflictQuery {
  venueId: string
  startAt: Date
  durationMinutes: number
  tenantId?: string | null
  /** Exclude the row being edited so a booking never conflicts with itself. */
  excludeTryoutId?: string
  excludeTeamEventId?: string
  excludePracticeId?: string
}

export async function findVenueConflicts(opts: VenueConflictQuery): Promise<VenueConflictResult> {
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
        ...(opts.excludePracticeId ? { id: { not: opts.excludePracticeId } } : {}),
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
        ...(opts.excludeTeamEventId ? { id: { not: opts.excludeTeamEventId } } : {}),
        startAt: { gte: windowStart, lt: end },
      },
      select: {
        startAt: true,
        durationMinutes: true,
        title: true,
        teams: { select: { team: { select: { tenantId: true } } } },
      },
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
    const same =
      !!opts.tenantId &&
      (ev as any).teams?.some((l: any) => l.team?.tenantId === opts.tenantId)
    push(same, "event", ev.title, s, e)
  }

  return { sameOrg, otherOrgCount, hasAny: sameOrg.length > 0 || otherOrgCount > 0 }
}

const KIND_LABEL: Record<VenueConflict["kind"], string> = {
  game: "game",
  practice: "practice",
  tryout: "tryout",
  event: "event",
}

/**
 * Intra-org HARD block (owner ruling 2026-07-21: an org must not double-book
 * its own venue slot). Returns a human-readable message when the org already
 * has an overlapping booking at this venue — callers reject with 409.
 * Cross-org overlaps stay a soft, generic advisory and never block.
 */
export async function intraOrgConflictMessage(
  opts: VenueConflictQuery
): Promise<string | null> {
  if (!opts.venueId || !opts.tenantId) return null
  const result = await findVenueConflicts(opts)
  if (result.sameOrg.length === 0) return null
  const first = result.sameOrg[0]
  const when = new Date(first.startAt).toLocaleString("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  return `Your organization already has a ${KIND_LABEL[first.kind]} at this venue then — "${first.title}" (${when}). Pick a different time or venue.`
}
