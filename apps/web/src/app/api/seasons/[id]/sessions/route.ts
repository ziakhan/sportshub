import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const sessionDaySchema = z.object({
  date: z.string(),
  startTime: z.string().min(3),
  endTime: z.string().min(3),
})

const createSessionSchema = z.object({
  label: z.string().optional(),
  venueId: z.string().optional(),
  days: z.array(sessionDaySchema).min(1),
})

/**
 * Phase 0 compat: incoming shape is still { label, venueId, days: [{ date, startTime, endTime }] }.
 * We persist it as SeasonSession + SeasonSessionDay + SeasonSessionDayVenue rows so the UI keeps
 * working before Phase 3 rewrites this API to expose the day-venue-court substrate directly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = createSessionSchema.parse(body)

    const result = await prisma.$transaction(async (tx: any) => {
      const seasonSession = await tx.seasonSession.create({
        data: {
          seasonId: params.id,
          label: data.label || null,
          phase: "REGULAR",
        },
      })

      for (const d of data.days) {
        const day = await tx.seasonSessionDay.create({
          data: {
            sessionId: seasonSession.id,
            date: new Date(d.date),
          },
        })
        if (data.venueId) {
          await tx.seasonSessionDayVenue.create({
            data: {
              dayId: day.id,
              venueId: data.venueId,
              startTime: d.startTime,
              endTime: d.endTime,
            },
          })
        }
      }

      return seasonSession
    })

    return NextResponse.json({ success: true, id: result.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessions = await (prisma as any).seasonSession.findMany({
      where: { seasonId: params.id },
      include: {
        days: {
          orderBy: { date: "asc" },
          include: {
            dayVenues: {
              include: {
                venue: { select: { id: true, name: true, address: true, city: true } },
                courts: { select: { id: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
    // Flatten back to the legacy { venue, days: [{ date, startTime, endTime }] } shape
    // so existing UI reads continue to work until Phase 3. Also expose an
    // `isUsable` flag for the expanded finalize preflight.
    const flattened = sessions.map((s: any) => {
      const firstDayVenue = s.days[0]?.dayVenues[0]
      const isUsable = s.days.some((d: any) =>
        (d.dayVenues ?? []).some((dv: any) => (dv.courts ?? []).length > 0)
      )
      return {
        id: s.id,
        label: s.label,
        leagueId: params.id,
        venueId: firstDayVenue?.venueId ?? null,
        venue: firstDayVenue?.venue ?? null,
        isUsable,
        days: s.days.map((d: any) => {
          const dv = d.dayVenues[0]
          return {
            id: d.id,
            sessionId: s.id,
            date: d.date,
            startTime: dv?.startTime ?? "",
            endTime: dv?.endTime ?? "",
            dayVenues: (d.dayVenues ?? []).map((x: any) => ({
              id: x.id,
              venueId: x.venueId,
              startTime: x.startTime,
              endTime: x.endTime,
              courts: x.courts ?? [],
            })),
          }
        }),
        createdAt: s.createdAt,
      }
    })
    return NextResponse.json({ sessions: flattened })
  } catch (error) {
    console.error("Get sessions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    await prisma.seasonSession.delete({ where: { id: sessionId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
