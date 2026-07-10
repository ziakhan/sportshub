import { getSessionUserId } from "@/lib/auth-helpers"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { tryoutSignupSchema } from "@/lib/validations/tryout-signup"
import { z } from "zod"
import { format } from "date-fns"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { cancelObligationIfUnpaid, ensureObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent, grantExpressConsent } from "@/lib/comms/consent"

export const dynamic = "force-dynamic"

// Accepts the shared signup payload plus the optional marketing-consent
// checkbox from the public form (CASL express consent).
const signupBodySchema = tryoutSignupSchema.extend({
  marketingConsent: z.boolean().optional(),
})

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
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = signupBodySchema.parse(body)

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
        tenant: { select: { name: true, currency: true } },
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

    // ── Family-side confirmation (gap: the paying family got nothing) ──
    // All additive best-effort side-effects: never fail the registration.
    const clubName = tryout.tenant.name
    const feeText = isFree ? "Free" : formatMoney(Number(tryout.fee), tryout.tenant.currency)
    const when = format(new Date(tryout.scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a")

    await notifySafe({
      userId: user.id,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${playerName} is signed up for "${tryout.title}" with ${clubName}.`,
      link: "/dashboard",
      referenceId: signup.id,
      referenceType: "TryoutSignup",
    })

    try {
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: `Registration confirmed — ${tryout.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p><strong>${escapeHtml(playerName)}</strong> is signed up for <strong>${escapeHtml(tryout.title)}</strong> with <strong>${escapeHtml(clubName)}</strong>.</p>
              <p>
                <strong>When:</strong> ${escapeHtml(when)}<br />
                <strong>Where:</strong> ${escapeHtml(tryout.location)}<br />
                <strong>Fee:</strong> ${escapeHtml(feeText)}
              </p>
              <p style="color: #666; font-size: 14px;">Payment and registration details are available on your dashboard.</p>
              <p>
                <a href="${appBaseUrl()}/dashboard" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                  View Registration
                </a>
              </p>
              ${transactionalFooter(clubName)}
            </div>
          `,
        })
      }
    } catch (emailError) {
      console.error("Tryout confirmation email failed:", emailError)
    }

    // CASL: registration = existing business relationship (implied consent);
    // the explicit checkbox upgrades it to express.
    try {
      await upsertImpliedConsent(user.id, "TENANT", tryout.tenantId, `registration:tryout:${params.id}`)
      if (data.marketingConsent === true) {
        await grantExpressConsent(user.id, "TENANT", tryout.tenantId, `checkbox:tryout:${params.id}`)
      }
    } catch (consentError) {
      console.error("Tryout consent capture failed:", consentError)
    }

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

    // Bell the club that a family cancelled (mirrors the POST's club notify;
    // best-effort — the cancellation already committed).
    try {
      const tryout = await prisma.tryout.findUnique({
        where: { id: params.id },
        select: { tenantId: true, title: true },
      })
      if (tryout) {
        const staff = await prisma.userRole.findMany({
          where: { tenantId: tryout.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          select: { userId: true },
        })
        await notifyMany(
          prisma,
          staff.map((r) => r.userId),
          {
            type: "signup_cancelled",
            title: "Tryout Signup Cancelled",
            message: `${signup.playerName} cancelled their signup for "${tryout.title}".`,
            link: `/clubs/${tryout.tenantId}/tryouts`,
            referenceId: signup.id,
            referenceType: "TryoutSignup",
          }
        )
      }
    } catch (notifyError) {
      console.error("Cancel notification failed:", notifyError)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Cancel signup error:", error)
    return NextResponse.json({ error: "Failed to cancel signup" }, { status: 500 })
  }
}
