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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league || (league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = createSessionSchema.parse(body)

    const result = await prisma.$transaction(async (tx) => {
      const leagueSession = await (tx as any).leagueSession.create({
        data: {
          leagueId: params.id,
          label: data.label || null,
          venueId: data.venueId || null,
        },
      })

      await (tx as any).leagueSessionDay.createMany({
        data: data.days.map((d) => ({
          sessionId: leagueSession.id,
          date: new Date(d.date),
          startTime: d.startTime,
          endTime: d.endTime,
        })),
      })

      return leagueSession
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
    const sessions = await (prisma as any).leagueSession.findMany({
      where: { leagueId: params.id },
      include: {
        venue: { select: { id: true, name: true, address: true, city: true } },
        days: { orderBy: { date: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json({ sessions })
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

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league || (league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    // Delete session days first, then session (cascade should handle but be explicit)
    await (prisma as any).leagueSessionDay.deleteMany({ where: { sessionId } })
    await (prisma as any).leagueSession.delete({ where: { id: sessionId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
