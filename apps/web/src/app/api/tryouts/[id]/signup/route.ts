import { getSessionUserId } from "@/lib/auth-helpers"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { tryoutSignupSchema } from "@/lib/validations/tryout-signup"
import { z } from "zod"
import { notifyMany } from "@/lib/notifications"
import { cancelObligationIfUnpaid, ensureObligation } from "@/lib/payments/obligations"

export const dynamic = "force-dynamic"

/**
 * Sign up for a tryout
 * POST /api/tryouts/[id]/signup
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

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
        id: true,
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
    const playerAge = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    const playerName = `${player.firstName} ${player.lastName}`

    // Fetch tryout and validate
    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { currency: true } },
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
      return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
    }

    if (new Date(tryout.scheduledAt) < new Date()) {
      return NextResponse.json({ error: "This tryout has already passed" }, { status: 400 })
    }

    if (tryout.maxParticipants && tryout._count.signups >= tryout.maxParticipants) {
      return NextResponse.json({ error: "This tryout is full" }, { status: 400 })
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

    const signup = await prisma.$transaction(async (tx: any) => {
      const created = await tx.tryoutSignup.create({
        data: {
          tryoutId: params.id,
          userId: user.id,
          // Identity thread to the real Player (schema hardening WS4.3) —
          // name/age remain a point-in-time snapshot.
          playerId: player.id,
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

      // Paid tryout → the signup owes the club its fee. How it gets paid
      // (at the door, e-transfer, or Stripe later) is the club's payment
      // config; the obligation is the same either way.
      await ensureObligation(tx, {
        payerUserId: user.id,
        payeeTenantId: tryout.tenantId,
        referenceType: "TryoutSignup",
        referenceId: created.id,
        description: `Tryout fee — ${tryout.title} (${playerName})`,
        amount: Number(tryout.fee),
        currency: tryout.tenant.currency,
      })

      return created
    })

    // Notify the club that a new signup arrived (gap: signups were silent).
    const staff = await prisma.userRole.findMany({
      where: { tenantId: tryout.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true },
    })
    await notifyMany(
      prisma,
      staff.map((r) => r.userId),
      {
        type: "signup_received",
        title: "New Tryout Signup",
        message: `${playerName} signed up for "${tryout.title}".`,
        link: `/clubs/${tryout.tenantId}/tryouts`,
        referenceId: signup.id,
        referenceType: "TryoutSignup",
      }
    )

    return NextResponse.json(signup, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Tryout signup error:", error)
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 })
  }
}

/**
 * Cancel a tryout signup
 * DELETE /api/tryouts/[id]/signup?signupId=xxx
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const signupId = request.nextUrl.searchParams.get("signupId")
    if (!signupId) {
      return NextResponse.json({ error: "signupId is required" }, { status: 400 })
    }

    const signup = await prisma.tryoutSignup.findFirst({
      where: {
        id: signupId,
        tryoutId: params.id,
        userId: user.id,
      },
    })

    if (!signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 })
    }

    if (signup.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot cancel a paid signup. Contact the club for a refund." },
        { status: 400 }
      )
    }

    if (signup.status === "CANCELLED") {
      return NextResponse.json({ error: "Signup is already cancelled" }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const cancelled = await tx.tryoutSignup.update({
        where: { id: signupId },
        data: { status: "CANCELLED" },
        select: {
          id: true,
          status: true,
        },
      })
      // The unpaid fee dies with the signup; paid ones keep their obligation
      // (refund is the club's explicit action).
      await cancelObligationIfUnpaid(tx, "TryoutSignup", signupId)
      return cancelled
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Cancel signup error:", error)
    return NextResponse.json({ error: "Failed to cancel signup" }, { status: 500 })
  }
}
