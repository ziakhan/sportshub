import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const signupSchema = z.object({
  playerId: z.string(),
  weeksSelected: z.number().min(1),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = signupSchema.parse(body)

    const player = await prisma.player.findFirst({
      where: { id: data.playerId, parentId: sessionInfo.userId },
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
      return NextResponse.json(
        { error: "Cannot select more weeks than available" },
        { status: 400 }
      )
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
        userId: sessionInfo.userId,
        playerId: data.playerId,
        weeksSelected: data.weeksSelected,
        totalFee,
        notes: data.notes || null,
      },
    })

    // Notify the club that a new signup arrived (gap: signups were silent).
    const staff = await prisma.userRole.findMany({
      where: { tenantId: camp.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true },
    })
    await notifyMany(
      prisma,
      staff.map((r) => r.userId),
      {
        type: "signup_received",
        title: "New Camp Signup",
        message: `A new player signed up for "${camp.name}".`,
        link: `/clubs/${camp.tenantId}/camps`,
        referenceId: signup.id,
        referenceType: "CampSignup",
      }
    )

    return NextResponse.json({ success: true, id: signup.id, totalFee }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Camp signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
