import { cache } from "./request-cache"
import { prisma } from "@youthbasketballhub/db"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

/**
 * Public read of club tryout EVENTS (docs/roadmap/club-tryouts-and-age-pools).
 *
 * An event is the club-level umbrella; each SESSION is a Tryout row carrying
 * eventId — one row per (age group, time, gym). Two age groups sharing one gym
 * slot are two rows with the same scheduledAt and venue, so a combined session
 * reads as a group here rather than as a special case.
 *
 * One source for every surface (parity law): the public club page, the mobile
 * browse endpoint and the console's public preview all read this module. Only
 * published events and published+public sessions are returned, and Decimals
 * are coerced to Number.
 *
 * What never crosses this boundary (owner ruling 2026-08-20):
 *  - CAPACITY. maxParticipants on a session is the club's gym planning, not a
 *    public number, so neither it nor anything derived from it is returned.
 *  - The crowd, unless the club asked for it. A session's signupCount appears
 *    only when the event carries showSignupCount; otherwise the field is
 *    ABSENT, never a zero that reads as "nobody is coming".
 *  - Names. Signups are counted, never listed.
 *
 * The `club` block (added 2026-08-20 for the public event page and the
 * Instagram poster) carries only fields the club's own public page already
 * prints for anonymous visitors — the same set getClubProfile() returns:
 * identity, place, website, currency and the branding trio. Nothing
 * operational, no contact rows, no counts. Both consumers read the club from
 * HERE rather than re-querying the tenant, so a poster can never say something
 * the page does not.
 */

export interface PublicTryoutEventClub {
  id: string
  slug: string
  name: string
  /** TenantStatus — drives "neutral by default, brand by choice" (brand.ts). */
  status: string
  currency: string
  city: string | null
  state: string | null
  website: string | null
  branding: {
    primaryColor: string | null
    logoUrl: string | null
    /** Same JSON the club page's "Follow us" block renders. */
    socials: unknown
  } | null
}

export interface PublicTryoutSession {
  id: string
  ageGroup: string
  gender: string | null
  scheduledAt: Date
  /** scheduledAt + duration, so every card can print start and end (ruling 10). */
  endsAt: Date | null
  duration: number | null
  location: string
  venue: { id: string; name: string } | null
  fee: number
  /** Present only when the club opted in via TryoutEvent.showSignupCount. */
  signupCount?: number
}

export interface PublicTryoutEvent {
  id: string
  tenantId: string
  /** The club that runs the event, in its public form. */
  club: PublicTryoutEventClub
  title: string
  description: string | null
  seasonLabel: string
  /** Distinct age groups served across the sessions, in schedule order. */
  ageGroups: string[]
  /** Earliest session, for sorting and for a "starts <date>" line. */
  startsAt: Date | null
  sessionCount: number
  sessions: PublicTryoutSession[]
}

/** The club as its own public page shows it, and nothing more. */
const PUBLIC_CLUB_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  currency: true,
  city: true,
  state: true,
  website: true,
  branding: { select: { primaryColor: true, logoUrl: true, socials: true } },
} as const

/**
 * A club with no public page has no public tryouts either: an unreviewed
 * census import and a club merged into another are both unreachable at
 * /club/[slug], so their events must be unreachable too (same gate as
 * getClubProfile).
 */
const PUBLIC_TENANT_WHERE = {
  publishedAt: { not: null },
  mergedIntoId: null,
  status: { in: ["ACTIVE", "UNCLAIMED"] },
} as const

const PUBLIC_SESSION_SELECT = {
  id: true,
  ageGroup: true,
  gender: true,
  scheduledAt: true,
  duration: true,
  location: true,
  fee: true,
  venue: { select: { id: true, name: true } },
  _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
} as const

function shapeSession(row: any, showSignupCount: boolean): PublicTryoutSession {
  return {
    id: row.id,
    ageGroup: row.ageGroup,
    gender: row.gender ?? null,
    scheduledAt: row.scheduledAt,
    endsAt: row.duration ? new Date(row.scheduledAt.getTime() + row.duration * 60000) : null,
    duration: row.duration ?? null,
    location: row.location,
    venue: row.venue ?? null,
    fee: Number(row.fee),
    ...(showSignupCount ? { signupCount: row._count?.signups ?? 0 } : {}),
  }
}

function shapeEvent(row: any): PublicTryoutEvent {
  const sessions: PublicTryoutSession[] = (row.sessions ?? []).map((s: any) =>
    shapeSession(s, row.showSignupCount === true)
  )
  const t = row.tenant ?? {}
  return {
    id: row.id,
    tenantId: row.tenantId,
    club: {
      id: t.id ?? row.tenantId,
      slug: t.slug ?? "",
      name: t.name ?? "",
      status: String(t.status ?? "ACTIVE"),
      currency: t.currency ?? "CAD",
      city: t.city ?? null,
      state: t.state ?? null,
      website: t.website ?? null,
      branding: t.branding
        ? {
            primaryColor: t.branding.primaryColor ?? null,
            logoUrl: t.branding.logoUrl ?? null,
            socials: t.branding.socials ?? null,
          }
        : null,
    },
    title: row.title,
    description: row.description ?? null,
    seasonLabel: row.seasonLabel,
    ageGroups: [...new Set(sessions.map((s: PublicTryoutSession) => s.ageGroup))],
    startsAt: sessions[0]?.scheduledAt ?? null,
    sessionCount: sessions.length,
    sessions,
  }
}

/** Published events for a club, each with its live sessions in schedule order. */
export const listPublishedTryoutEvents = cache(
  async (tenantId: string): Promise<PublicTryoutEvent[]> => {
    const events = await (prisma as any).tryoutEvent.findMany({
      where: { tenantId, isPublished: true, tenant: PUBLIC_TENANT_WHERE },
      select: {
        id: true,
        tenantId: true,
        tenant: { select: PUBLIC_CLUB_SELECT },
        title: true,
        description: true,
        seasonLabel: true,
        showSignupCount: true,
        createdAt: true,
        sessions: {
          where: { isPublished: true, isPublic: true },
          select: PUBLIC_SESSION_SELECT,
          orderBy: [{ scheduledAt: "asc" }, { ageGroup: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    })
    return events
      .map(shapeEvent)
      .filter((e: PublicTryoutEvent) => e.sessions.length > 0)
      .sort((a: PublicTryoutEvent, b: PublicTryoutEvent) => {
        if (!a.startsAt || !b.startsAt) return 0
        return a.startsAt.getTime() - b.startsAt.getTime()
      })
  }
)

/** One published event with its live sessions, or null. */
export const getTryoutEventPublic = cache(
  async (eventId: string): Promise<PublicTryoutEvent | null> => {
    const event = await (prisma as any).tryoutEvent.findFirst({
      where: { id: eventId, isPublished: true, tenant: PUBLIC_TENANT_WHERE },
      select: {
        id: true,
        tenantId: true,
        tenant: { select: PUBLIC_CLUB_SELECT },
        title: true,
        description: true,
        seasonLabel: true,
        showSignupCount: true,
        sessions: {
          where: { isPublished: true, isPublic: true },
          select: PUBLIC_SESSION_SELECT,
          orderBy: [{ scheduledAt: "asc" }, { ageGroup: "asc" }],
        },
      },
    })
    if (!event) return null
    return shapeEvent(event)
  }
)
