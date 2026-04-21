import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const dayHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(timeRegex).nullable(),
  closeTime: z.string().regex(timeRegex).nullable(),
})

const putHoursSchema = z.object({
  hours: z.array(dayHoursSchema),
})

/**
 * GET /api/venues/[id]/hours — List VenueHours rows for a venue (one per dayOfWeek present)
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const hours = await (prisma as any).venueHours.findMany({
      where: { venueId: params.id },
      orderBy: { dayOfWeek: "asc" },
    })
    return NextResponse.json({ hours })
  } catch (error) {
    console.error("Get venue hours error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/venues/[id]/hours — Bulk upsert venue hours (one row per provided dayOfWeek).
 * If openTime + closeTime are both null, the day is treated as closed.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const data = putHoursSchema.parse(body)

    await (prisma as any).$transaction(
      data.hours.map((h) =>
        (prisma as any).venueHours.upsert({
          where: { venueId_dayOfWeek: { venueId: params.id, dayOfWeek: h.dayOfWeek } },
          create: {
            venueId: params.id,
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime,
            closeTime: h.closeTime,
          },
          update: { openTime: h.openTime, closeTime: h.closeTime },
        })
      )
    )

    const hours = await (prisma as any).venueHours.findMany({
      where: { venueId: params.id },
      orderBy: { dayOfWeek: "asc" },
    })
    return NextResponse.json({ success: true, hours })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Put venue hours error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
