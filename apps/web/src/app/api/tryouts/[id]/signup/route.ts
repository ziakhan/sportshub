import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { tryoutSignupSchema } from "@/lib/validations/tryout-signup"
import { z } from "zod"

/**
 * Sign up for a tryout
 * POST /api/tryouts/[id]/signup
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
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = tryoutSignupSchema.parse(body)

    // Verify player belongs to this parent
    const player = await prisma.player.findFirst({
      where: {
        id: data.playerId,
        parentId: user.id,
      },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
      },
    })

    if (!player) {
      return NextResponse.json(
        { error: "Player not found or does not belong to you" },
        { status: 403 }
      )
    }

    // Calculate player age
    const dob = new Date(player.dateOfBirth)
    const playerAge = Math.floor(
      (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    )
    const playerName = `${player.firstName} ${player.lastName}`

    // Fetch tryout and validate
    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            signups: {
              where: { status: { not: "CANCELLED" } },
            },
          },
        },
      },
    })

    if (!tryout || !tryout.isPublished) {
      return NextResponse.json(
        { error: "Tryout not found" },
        { status: 404 }
      )
    }

    if (new Date(tryout.scheduledAt) < new Date()) {
      return NextResponse.json(
        { error: "This tryout has already passed" },
        { status: 400 }
      )
    }

    if (
      tryout.maxParticipants &&
      tryout._count.signups >= tryout.maxParticipants
    ) {
      return NextResponse.json(
        { error: "This tryout is full" },
        { status: 400 }
      )
    }

    // Check for duplicate signup
    const existing = await prisma.tryoutSignup.findUnique({
      where: {
        tryoutId_userId_playerName: {
          tryoutId: params.id,
          userId: user.id,
          playerName,
        },
      },
    })

    if (existing && existing.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "This player is already signed up for this tryout" },
        { status: 409 }
      )
    }

    // Determine status based on fee
    const isFree = Number(tryout.fee) === 0
    const status = isFree ? "CONFIRMED" : "PENDING"

    const signup = await prisma.tryoutSignup.create({
      data: {
        tryoutId: params.id,
        userId: user.id,
        playerName,
        playerAge,
        playerGender: player.gender,
        status,
        notes: data.notes || null,
      },
      select: {
        id: true,
        playerName: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json(signup, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Tryout signup error:", error)
    return NextResponse.json(
      { error: "Failed to sign up" },
      { status: 500 }
    )
  }
}

/**
 * Cancel a tryout signup
 * DELETE /api/tryouts/[id]/signup?signupId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const signupId = request.nextUrl.searchParams.get("signupId")
    if (!signupId) {
      return NextResponse.json(
        { error: "signupId is required" },
        { status: 400 }
      )
    }

    const signup = await prisma.tryoutSignup.findFirst({
      where: {
        id: signupId,
        tryoutId: params.id,
        userId: user.id,
      },
    })

    if (!signup) {
      return NextResponse.json(
        { error: "Signup not found" },
        { status: 404 }
      )
    }

    if (signup.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot cancel a paid signup. Contact the club for a refund." },
        { status: 400 }
      )
    }

    if (signup.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Signup is already cancelled" },
        { status: 400 }
      )
    }

    const updated = await prisma.tryoutSignup.update({
      where: { id: signupId },
      data: { status: "CANCELLED" },
      select: {
        id: true,
        status: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Cancel signup error:", error)
    return NextResponse.json(
      { error: "Failed to cancel signup" },
      { status: 500 }
    )
  }
}
