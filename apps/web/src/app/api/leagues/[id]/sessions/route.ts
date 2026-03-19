import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createSessionSchema = z.object({
  sessionDate: z.string().datetime(),
  label: z.string().optional(),
  venueId: z.string().optional(),
})

const bulkCreateSchema = z.object({
  sessions: z.array(createSessionSchema),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league || league.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Support both single and bulk creation
    if (body.sessions) {
      const data = bulkCreateSchema.parse(body)
      await (prisma as any).leagueSession.createMany({
        data: data.sessions.map((s, i) => ({
          leagueId: params.id,
          sessionDate: new Date(s.sessionDate),
          label: s.label || `Session ${i + 1}`,
          venueId: s.venueId || null,
        })),
      })
      return NextResponse.json({ success: true, count: data.sessions.length }, { status: 201 })
    }

    const data = createSessionSchema.parse(body)
    const leagueSession = await (prisma as any).leagueSession.create({
      data: {
        leagueId: params.id,
        sessionDate: new Date(data.sessionDate),
        label: data.label || null,
        venueId: data.venueId || null,
      },
    })

    return NextResponse.json({ success: true, id: leagueSession.id }, { status: 201 })
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
      include: { venue: { select: { id: true, name: true, address: true, city: true } } },
      orderBy: { sessionDate: "asc" },
    })
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error("Get sessions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
