import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const signupSchema = z.object({
  playerId: z.string(),
  notes: z.string().optional(),
})

/**
 * POST /api/house-leagues/[id]/signup — Parent signs up player
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = signupSchema.parse(body)

    // Verify player belongs to this parent
    const player = await prisma.player.findFirst({
      where: { id: data.playerId, parentId: session.user.id },
    })
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 403 })
    }

    // Get league and check availability
    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
      include: { _count: { select: { signups: true } } },
    })

    if (!league || !league.isPublished) {
      return NextResponse.json({ error: "House league not found" }, { status: 404 })
    }

    if (new Date(league.endDate) < new Date()) {
      return NextResponse.json({ error: "This program has ended" }, { status: 400 })
    }

    if (league.maxParticipants && league._count.signups >= league.maxParticipants) {
      return NextResponse.json({ error: "This program is full" }, { status: 400 })
    }

    // Check for duplicate
    const existing = await (prisma as any).houseLeagueSignup.findUnique({
      where: { houseLeagueId_playerId: { houseLeagueId: params.id, playerId: data.playerId } },
    })
    if (existing && existing.status !== "CANCELLED") {
      return NextResponse.json({ error: "This player is already registered" }, { status: 409 })
    }

    const signup = await (prisma as any).houseLeagueSignup.create({
      data: {
        houseLeagueId: params.id,
        userId: session.user.id,
        playerId: data.playerId,
        notes: data.notes || null,
      },
    })

    return NextResponse.json({ success: true, id: signup.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("House league signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
