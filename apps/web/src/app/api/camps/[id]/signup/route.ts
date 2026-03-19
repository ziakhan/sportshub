import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const signupSchema = z.object({
  playerId: z.string(),
  weeksSelected: z.number().min(1),
  notes: z.string().optional(),
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

    const body = await request.json()
    const data = signupSchema.parse(body)

    const player = await prisma.player.findFirst({
      where: { id: data.playerId, parentId: session.user.id },
    })
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 403 })
    }

    const camp = await (prisma as any).camp.findUnique({
      where: { id: params.id },
      include: { _count: { select: { signups: true } } },
    })

    if (!camp || !camp.isPublished) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 })
    }

    if (new Date(camp.endDate) < new Date()) {
      return NextResponse.json({ error: "This camp has ended" }, { status: 400 })
    }

    if (camp.maxParticipants && camp._count.signups >= camp.maxParticipants) {
      return NextResponse.json({ error: "This camp is full" }, { status: 400 })
    }

    if (data.weeksSelected > camp.numberOfWeeks) {
      return NextResponse.json({ error: "Cannot select more weeks than available" }, { status: 400 })
    }

    const existing = await (prisma as any).campSignup.findUnique({
      where: { campId_playerId: { campId: params.id, playerId: data.playerId } },
    })
    if (existing && existing.status !== "CANCELLED") {
      return NextResponse.json({ error: "This player is already registered" }, { status: 409 })
    }

    // Calculate fee
    const weeklyFee = Number(camp.weeklyFee)
    const fullCampFee = camp.fullCampFee ? Number(camp.fullCampFee) : null
    let totalFee: number

    if (data.weeksSelected >= camp.numberOfWeeks && fullCampFee !== null) {
      totalFee = fullCampFee // Full camp discount
    } else {
      totalFee = weeklyFee * data.weeksSelected
    }

    const signup = await (prisma as any).campSignup.create({
      data: {
        campId: params.id,
        userId: session.user.id,
        playerId: data.playerId,
        weeksSelected: data.weeksSelected,
        totalFee,
        notes: data.notes || null,
      },
    })

    return NextResponse.json({ success: true, id: signup.id, totalFee }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Camp signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
