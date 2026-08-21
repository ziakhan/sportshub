import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

/**
 * Club tryout EVENTS (docs/roadmap/club-tryouts-and-age-pools).
 *
 * An event is the club-level umbrella a club announces; each SESSION is a
 * Tryout row carrying eventId, one row per (age group, time, gym). Two age
 * groups sharing one gym slot are two rows with the same scheduledAt and
 * venue, which is why sessions are never venue-conflict-checked against each
 * other: a combined session is a deliberate double booking, not a mistake.
 *
 * Everything downstream of a session row (signup, check-in, payment, capacity)
 * is the existing tryout machinery, untouched.
 */

export const sessionInputSchema = z.object({
  /** Present when editing an existing session; absent means create. */
  id: z.string().uuid().optional(),
  ageGroup: z.string().trim().min(1).max(20),
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(15).max(600).nullable().optional(),
  venueId: z.string().uuid().nullable().optional(),
  location: z.string().trim().min(3).max(200).optional(),
  fee: z.number().min(0),
  maxParticipants: z.number().int().min(1).max(1000).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).nullable().optional(),
  agePolicy: z.enum(["STRICT", "PREFERRED", "OPEN"]).optional(),
})

export type SessionInput = z.infer<typeof sessionInputSchema>

export class TryoutEventError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message)
  }
}

/** The session's own title, so signup emails and check-in read sensibly. */
export function sessionTitle(eventTitle: string, ageGroup: string): string {
  return `${eventTitle} (${ageGroup})`
}

/**
 * A session needs a printable place. The venue's name is used when the club
 * picked one and typed nothing; free text still wins when both are given.
 */
export async function resolveSessionLocation(
  input: SessionInput,
  tenantId: string
): Promise<string> {
  if (input.location) return input.location
  if (input.venueId) {
    const venue = await prisma.venue.findUnique({
      where: { id: input.venueId },
      select: { name: true },
    })
    if (venue?.name) return venue.name
  }
  throw new TryoutEventError(
    "Every session needs a venue or a location",
    "SESSION_LOCATION_REQUIRED"
  )
}

export async function sessionRowData(
  input: SessionInput,
  event: { id: string; tenantId: string; title: string; isPublished: boolean }
): Promise<Record<string, unknown>> {
  return {
    tenantId: event.tenantId,
    eventId: event.id,
    title: sessionTitle(event.title, input.ageGroup),
    ageGroup: input.ageGroup,
    agePolicy: input.agePolicy ?? "STRICT",
    gender: input.gender ?? null,
    location: await resolveSessionLocation(input, event.tenantId),
    venueId: input.venueId ?? null,
    scheduledAt: new Date(input.scheduledAt),
    duration: input.duration ?? null,
    fee: input.fee,
    maxParticipants: input.maxParticipants ?? null,
    // A session inherits the event's shelf state: publishing the event is the
    // one act that makes every session visible.
    isPublished: event.isPublished,
    isPublic: true,
  }
}

/** Management view of a session: what the console needs, signups counted. */
export const MANAGEMENT_SESSION_SELECT = {
  id: true,
  title: true,
  ageGroup: true,
  agePolicy: true,
  gender: true,
  scheduledAt: true,
  duration: true,
  location: true,
  venueId: true,
  venue: { select: { id: true, name: true } },
  fee: true,
  maxParticipants: true,
  isPublished: true,
  isPublic: true,
  _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
} as const

export function shapeManagementSession(row: any) {
  return {
    ...row,
    fee: Number(row.fee),
    signupCount: row._count?.signups ?? 0,
    _count: undefined,
  }
}
