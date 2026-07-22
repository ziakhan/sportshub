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
 * PUT /api/seasons/[id]/venues/[seasonVenueId]/hours — Bulk upsert THIS
 * season's scheduling hours at a venue (batch-backlog §2b). Scoped to the
 * SeasonVenue link row; the global VenueHours table is never touched.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; seasonVenueId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // The link row must belong to THIS season (IDOR guard).
    const seasonVenue = await prisma.seasonVenue.findFirst({
      where: { id: params.seasonVenueId, seasonId: params.id },
      select: { id: true },
    })
    if (!seasonVenue) {
      return NextResponse.json({ error: "Season venue not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = putHoursSchema.parse(body)

    await (prisma as any).$transaction(
      data.hours.map((h) =>
        (prisma as any).seasonVenueHours.upsert({
          where: {
            seasonVenueId_dayOfWeek: {
              seasonVenueId: params.seasonVenueId,
              dayOfWeek: h.dayOfWeek,
            },
          },
          create: {
            seasonVenueId: params.seasonVenueId,
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime,
            closeTime: h.closeTime,
          },
          update: { openTime: h.openTime, closeTime: h.closeTime },
        })
      )
    )

    const hours = await (prisma as any).seasonVenueHours.findMany({
      where: { seasonVenueId: params.seasonVenueId },
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
    console.error("Put season venue hours error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
