import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { intraOrgConflictMessage } from "@/lib/venues/conflicts"

export const dynamic = "force-dynamic"

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const patchSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sessionType: z
    .enum(["GROUP_TRAINING", "CLINIC", "STRENGTH_CONDITIONING", "OPEN_WORKOUT"])
    .optional(),
  ageGroup: z.string().trim().max(50).nullable().optional(),
  agePolicy: z.enum(["STRICT", "PREFERRED", "OPEN"]).optional(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).nullable().optional(),
  scheduleType: z.enum(["ONE_TIME", "RECURRING"]).optional(),
  startAt: z.string().datetime().nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  // Multi-day recurrence (QA-203) — wins over dayOfWeek when >1 selected.
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  // Group-size tier families filter by (QA-202).
  groupTier: z.enum(["PRIVATE", "SMALL_GROUP", "LARGE_GROUP"]).nullable().optional(),
  startTime: z.string().regex(timeRegex).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(15).max(360).optional(),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  fee: z.number().min(0).optional(),
  venueId: z.string().nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  isPublished: z.boolean().optional(),
})

async function loadForAdmin(sessionId: string, userId: string) {
  const session = await (prisma as any).trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      venue: { select: { id: true, name: true } },
      _count: { select: { signups: true } },
    },
  })
  if (!session) return { error: "Not found", status: 404 as const }
  if (!(await isClubAdmin(userId, session.tenantId))) {
    return { error: "Forbidden", status: 403 as const }
  }
  return { session }
}

/** GET /api/training-sessions/[id] — operator detail (admin only) */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const result = await loadForAdmin(params.id, auth.userId)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      session: { ...result.session, fee: Number(result.session.fee) },
    })
  } catch (error) {
    console.error("Training session get error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** PATCH /api/training-sessions/[id] — edit / publish / unpublish */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const result = await loadForAdmin(params.id, auth.userId)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const existing = result.session

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid update" },
        { status: 400 }
      )
    }
    const data = parsed.data

    let venuePatch: Record<string, unknown> = {}
    if (data.venueId !== undefined) {
      if (data.venueId) {
        const venue = await (prisma as any).venue.findUnique({
          where: { id: data.venueId },
          select: { id: true, name: true },
        })
        if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 400 })
        venuePatch = {
          venueId: venue.id,
          ...(data.location === undefined ? { location: venue.name } : {}),
        }
      } else {
        venuePatch = { venueId: null }
      }
    }

    // Intra-org HARD block for one-time sessions when venue/time changes.
    const effectiveVenueId = data.venueId !== undefined ? data.venueId || null : existing.venueId
    const effectiveScheduleType = data.scheduleType ?? existing.scheduleType
    const effectiveStartAt =
      data.startAt !== undefined
        ? data.startAt
          ? new Date(data.startAt)
          : null
        : existing.startAt
    const touchesBooking =
      data.venueId !== undefined || data.startAt !== undefined || data.durationMinutes !== undefined
    if (
      touchesBooking &&
      effectiveVenueId &&
      effectiveScheduleType === "ONE_TIME" &&
      effectiveStartAt
    ) {
      const conflict = await intraOrgConflictMessage({
        venueId: effectiveVenueId,
        startAt: new Date(effectiveStartAt),
        durationMinutes: data.durationMinutes ?? existing.durationMinutes ?? 60,
        tenantId: existing.tenantId,
      })
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
    }

    const updated = await (prisma as any).trainingSession.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.sessionType !== undefined ? { sessionType: data.sessionType } : {}),
        ...(data.ageGroup !== undefined ? { ageGroup: data.ageGroup || null } : {}),
        ...(data.agePolicy !== undefined ? { agePolicy: data.agePolicy } : {}),
        ...(data.gender !== undefined ? { gender: data.gender || null } : {}),
        ...(data.scheduleType !== undefined ? { scheduleType: data.scheduleType } : {}),
        ...(data.startAt !== undefined
          ? { startAt: data.startAt ? new Date(data.startAt) : null }
          : {}),
        ...(data.dayOfWeek !== undefined ? { dayOfWeek: data.dayOfWeek } : {}),
        ...(data.daysOfWeek !== undefined ? { daysOfWeek: data.daysOfWeek } : {}),
        ...(data.groupTier !== undefined ? { groupTier: data.groupTier } : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.startDate !== undefined
          ? { startDate: data.startDate ? new Date(data.startDate) : null }
          : {}),
        ...(data.endDate !== undefined
          ? { endDate: data.endDate ? new Date(data.endDate) : null }
          : {}),
        ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.fee !== undefined ? { fee: data.fee } : {}),
        ...(data.location !== undefined ? { location: data.location || null } : {}),
        ...venuePatch,
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      },
      select: { id: true, isPublished: true },
    })

    return NextResponse.json({ success: true, session: updated })
  } catch (error) {
    console.error("Training session update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/training-sessions/[id] — only when nobody has signed up */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const result = await loadForAdmin(params.id, auth.userId)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    if (result.session._count.signups > 0) {
      return NextResponse.json(
        { error: "Players are registered — unpublish it instead of deleting" },
        { status: 409 }
      )
    }
    await (prisma as any).trainingSession.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Training session delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
