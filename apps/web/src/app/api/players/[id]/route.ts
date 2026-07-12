import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { addPlayerSchema } from "@/lib/validations/tryout-signup"
import { z } from "zod"

export const dynamic = "force-dynamic"

// PATCH accepts everything the add-player form does, plus the media-consent
// choice (matches the MediaConsent enum in prisma/schema.prisma exactly).
const updatePlayerSchema = addPlayerSchema.extend({
  mediaConsent: z.enum(["UNSET", "GRANTED", "DENIED"]).optional(),
})

/**
 * Get a single player
 * GET /api/players/[id]
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const player = await prisma.player.findFirst({
    where: { id: params.id, parentId: user.id, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      jerseyNumber: true,
      height: true,
      weight: true,
      position: true,
      mediaConsent: true,
      handle: true,
    },
  })

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 })
  }

  return NextResponse.json(player)
}

/**
 * Update a player
 * PATCH /api/players/[id]
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify ownership (and that the player isn't soft-deleted)
    const existing = await prisma.player.findFirst({
      where: { id: params.id, parentId: user.id, deletedAt: null },
    })

    if (!existing) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = updatePlayerSchema.parse(body)

    const dob = new Date(data.dateOfBirth)
    const ageInYears = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

    const player = await prisma.player.update({
      where: { id: params.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: dob,
        gender: data.gender,
        jerseyNumber: data.jerseyNumber || null,
        height: data.height || null,
        weight: data.weight || null,
        position: data.position || null,
        isMinor: ageInYears < 13,
        canLogin: ageInYears >= 13,
        // Media consent is written only when explicitly sent; revoking
        // parentalConsentGiven/consentGivenAt is a separate policy decision.
        ...(data.mediaConsent ? { mediaConsent: data.mediaConsent } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        jerseyNumber: true,
        height: true,
        weight: true,
        position: true,
        mediaConsent: true,
      },
    })

    return NextResponse.json(player)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Update player error:", error)
    return NextResponse.json({ error: "Failed to update player" }, { status: 500 })
  }
}

/**
 * Soft-delete a player. Parent-only. Sets deletedAt; preserves all historical
 * relations (offers, signups, roster entries) so audit/history isn't lost.
 * DELETE /api/players/[id]
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const player = await prisma.player.findFirst({
    where: { id: params.id, parentId: session.user.id },
    select: { id: true, deletedAt: true },
  })

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 })
  }

  if (player.deletedAt) {
    return NextResponse.json({ error: "Player already removed" }, { status: 400 })
  }

  // G10: a child on an active roster must be released by the club first —
  // soft-deleting them would leave a ghost occupying a roster spot.
  const activeRoster = await prisma.teamPlayer.findFirst({
    where: { playerId: params.id, status: "ACTIVE" },
    include: { team: { select: { name: true } } },
  })
  if (activeRoster) {
    return NextResponse.json(
      {
        error: `Cannot remove this player while they are on the active roster of ${activeRoster.team.name}. Ask the club to release them first.`,
        code: "ACTIVE_ROSTER",
      },
      { status: 409 }
    )
  }

  // G10: don't leave dangling commitments behind — decline open offers and
  // cancel signups for tryouts that haven't happened yet.
  await prisma.$transaction(async (tx: any) => {
    await tx.player.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })
    await tx.offer.updateMany({
      where: { playerId: params.id, status: "PENDING" },
      data: { status: "DECLINED", respondedAt: new Date() },
    })
    await tx.tryoutSignup.updateMany({
      where: {
        playerId: params.id,
        status: { not: "CANCELLED" },
        tryout: { scheduledAt: { gt: new Date() } },
      },
      data: { status: "CANCELLED" },
    })
  })

  return NextResponse.json({ success: true })
}
