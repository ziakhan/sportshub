import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { intraOrgConflictMessage } from "@/lib/venues/conflicts"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

export const dynamic = "force-dynamic"

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const createSchema = z
  .object({
    tenantId: z.string(),
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().max(2000).optional(),
    sessionType: z
      .enum(["GROUP_TRAINING", "CLINIC", "STRENGTH_CONDITIONING", "OPEN_WORKOUT"])
      .default("GROUP_TRAINING"),
    ageGroup: z.string().trim().max(50).optional(),
    agePolicy: z.enum(["STRICT", "PREFERRED", "OPEN"]).optional(),
    gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
    scheduleType: z.enum(["ONE_TIME", "RECURRING"]).default("ONE_TIME"),
    startAt: z.string().datetime().optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: z.string().regex(timeRegex).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    durationMinutes: z.number().int().min(15).max(360).default(60),
    capacity: z.number().int().min(1).max(500).optional().nullable(),
    fee: z.number().min(0),
    venueId: z.string().optional().nullable(),
    location: z.string().trim().max(200).optional(),
  })
  .refine((d) => (d.scheduleType === "ONE_TIME" ? !!d.startAt : true), {
    message: "Pick a date and time",
  })
  .refine(
    (d) =>
      d.scheduleType === "RECURRING"
        ? d.dayOfWeek !== undefined && !!d.startTime && !!d.startDate && !!d.endDate
        : true,
    { message: "Recurring sessions need a weekday, time, and date range" }
  )

/** GET /api/training-sessions?tenantId=... — operator list (admin only) */
export async function GET(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenantId = request.nextUrl.searchParams.get("tenantId")
    if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 })
    if (!(await isClubAdmin(auth.userId, tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sessions = await (prisma as any).trainingSession.findMany({
      where: { tenantId },
      include: { _count: { select: { signups: { where: ACTIVE_SIGNUPS } } } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({
      sessions: sessions.map((s: any) => ({ ...s, fee: Number(s.fee) })),
    })
  } catch (error) {
    console.error("Training sessions list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/training-sessions — trainer (or club admin) creates a training
 * program: group training, clinic, S&C, open workout. One-time or weekly
 * recurring, with capacity + fee (batch-backlog §5 P1).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const data = createSchema.parse(body)

    if (!(await isClubAdmin(auth.userId, data.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let location = data.location || null
    if (data.venueId) {
      const venue = await (prisma as any).venue.findUnique({
        where: { id: data.venueId },
        select: { id: true, name: true },
      })
      if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 400 })
      if (!location) location = venue.name

      // Intra-org HARD block for point-in-time sessions.
      if (data.scheduleType === "ONE_TIME" && data.startAt) {
        const conflict = await intraOrgConflictMessage({
          venueId: venue.id,
          startAt: new Date(data.startAt),
          durationMinutes: data.durationMinutes,
          tenantId: data.tenantId,
        })
        if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
      }
    }

    const session = await (prisma as any).trainingSession.create({
      data: {
        tenantId: data.tenantId,
        title: data.title,
        description: data.description || null,
        sessionType: data.sessionType,
        ageGroup: data.ageGroup || null,
        agePolicy: data.agePolicy ?? "PREFERRED",
        gender: data.gender || null,
        scheduleType: data.scheduleType,
        startAt: data.scheduleType === "ONE_TIME" && data.startAt ? new Date(data.startAt) : null,
        dayOfWeek: data.scheduleType === "RECURRING" ? data.dayOfWeek : null,
        startTime: data.scheduleType === "RECURRING" ? data.startTime : null,
        startDate:
          data.scheduleType === "RECURRING" && data.startDate ? new Date(data.startDate) : null,
        endDate: data.scheduleType === "RECURRING" && data.endDate ? new Date(data.endDate) : null,
        durationMinutes: data.durationMinutes,
        capacity: data.capacity ?? null,
        fee: data.fee,
        venueId: data.venueId || null,
        location,
        isPublished: false,
      },
      select: { id: true, title: true },
    })

    return NextResponse.json({ success: true, id: session.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation error" },
        { status: 400 }
      )
    }
    console.error("Training session create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
