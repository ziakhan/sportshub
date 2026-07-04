import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notifyMany } from "@/lib/notifications"
import { ensureObligation } from "@/lib/payments/obligations"

export const dynamic = "force-dynamic"

const signupSchema = z.object({
  playerId: z.string(),
  notes: z.string().optional(),
})

/**
 * POST /api/house-leagues/[id]/signup — Parent signs up player
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = signupSchema.parse(body)

    // Verify player belongs to this parent
    const player = await prisma.player.findFirst({
      where: { id: data.playerId, parentId: sessionInfo.userId },
    })
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 403 })
    }

    // Get league and check availability
    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
      include: { tenant: { select: { currency: true } }, _count: { select: { signups: true } } },
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

    const signup = await prisma.$transaction(async (tx: any) => {
      const created = await tx.houseLeagueSignup.create({
        data: {
          houseLeagueId: params.id,
          userId: sessionInfo.userId,
          playerId: data.playerId,
          notes: data.notes || null,
        },
      })
      await ensureObligation(tx, {
        payerUserId: sessionInfo.userId,
        payeeTenantId: league.tenantId,
        referenceType: "HouseLeagueSignup",
        referenceId: created.id,
        description: `House league fee — ${league.name} (${player.firstName} ${player.lastName})`,
        amount: Number(league.fee),
        currency: league.tenant?.currency ?? "CAD",
      })
      return created
    })

    // Notify the club that a new signup arrived (gap: signups were silent).
    const staff = await prisma.userRole.findMany({
      where: { tenantId: league.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true },
    })
    await notifyMany(
      prisma,
      staff.map((r) => r.userId),
      {
        type: "signup_received",
        title: "New House League Signup",
        message: `A new player signed up for "${league.name}".`,
        link: `/clubs/${league.tenantId}/house-leagues`,
        referenceId: signup.id,
        referenceType: "HouseLeagueSignup",
      }
    )

    return NextResponse.json({ success: true, id: signup.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("House league signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
