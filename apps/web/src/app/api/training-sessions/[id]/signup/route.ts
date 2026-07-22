import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { ensureObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent, grantExpressConsent } from "@/lib/comms/consent"
import { getOutstandingRequiredWaivers, waiversRequiredResponse } from "@/lib/waivers/inline"
import { formatTrainingSchedule } from "@/lib/training"

export const dynamic = "force-dynamic"

const signupSchema = z.object({
  playerId: z.string(),
  notes: z.string().optional(),
  marketingConsent: z.boolean().optional(),
})

/**
 * POST /api/training-sessions/[id]/signup — a parent registers their player
 * for a trainer's session. Mirrors camp signup: capacity + dup checks,
 * fee → PaymentObligation, both sides notified (batch-backlog §5 P1).
 */
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

    const session = await (prisma as any).trainingSession.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { name: true, currency: true } },
        _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
      },
    })

    if (!session || !session.isPublished) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const endReference =
      session.scheduleType === "RECURRING" ? session.endDate : session.startAt
    if (endReference && new Date(endReference) < new Date()) {
      return NextResponse.json({ error: "This program has ended" }, { status: 400 })
    }

    if (session.capacity && session._count.signups >= session.capacity) {
      return NextResponse.json({ error: "This program is full" }, { status: 400 })
    }

    const existing = await (prisma as any).trainingSessionSignup.findUnique({
      where: { sessionId_playerId: { sessionId: params.id, playerId: data.playerId } },
    })
    if (existing && existing.status !== "CANCELLED") {
      return NextResponse.json({ error: "This player is already registered" }, { status: 409 })
    }

    const outstandingWaivers = await getOutstandingRequiredWaivers({
      tenantId: session.tenantId,
      playerId: player.id,
    })
    if (outstandingWaivers.length > 0) {
      return NextResponse.json(waiversRequiredResponse(outstandingWaivers), { status: 409 })
    }

    const totalFee = Number(session.fee)

    const signup = await prisma.$transaction(async (tx: any) => {
      if (existing) {
        // Re-registering after a cancellation reuses the row
        return tx.trainingSessionSignup.update({
          where: { id: existing.id },
          data: { status: "CONFIRMED", totalFee, notes: data.notes || null },
        })
      }
      const created = await tx.trainingSessionSignup.create({
        data: {
          sessionId: params.id,
          userId: sessionInfo.userId,
          playerId: data.playerId,
          totalFee,
          notes: data.notes || null,
        },
      })
      await ensureObligation(tx, {
        payerUserId: sessionInfo.userId,
        payeeTenantId: session.tenantId,
        referenceType: "TrainingSessionSignup",
        referenceId: created.id,
        description: `Training fee — ${session.title}`,
        amount: totalFee,
        currency: session.tenant?.currency ?? "CAD",
      })
      return created
    })

    const staff = await prisma.userRole.findMany({
      where: {
        tenantId: session.tenantId,
        role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
      },
      select: { userId: true },
    })
    await notifyMany(
      prisma,
      staff.map((r) => r.userId),
      {
        type: "signup_received",
        title: "New Training Signup",
        message: `A new player signed up for "${session.title}".`,
        link: `/clubs/${session.tenantId}/training`,
        referenceId: signup.id,
        referenceType: "TrainingSessionSignup",
      }
    )

    const playerName = `${player.firstName} ${player.lastName}`
    const trainerName = session.tenant?.name ?? "the trainer"
    const currency = session.tenant?.currency ?? "CAD"
    const feeText = totalFee > 0 ? formatMoney(totalFee, currency) : "Free"
    const scheduleText = formatTrainingSchedule(session)

    await notifySafe({
      userId: sessionInfo.userId,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${playerName} is registered for "${session.title}" with ${trainerName}.`,
      link: "/dashboard",
      referenceId: signup.id,
      referenceType: "TrainingSessionSignup",
    })

    try {
      const parent = await prisma.user.findUnique({
        where: { id: sessionInfo.userId },
        select: { email: true },
      })
      if (parent?.email) {
        await sendEmail({
          to: parent.email,
          subject: `Registration confirmed — ${session.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p><strong>${escapeHtml(playerName)}</strong> is registered for <strong>${escapeHtml(session.title)}</strong> with <strong>${escapeHtml(trainerName)}</strong>.</p>
              <p>
                <strong>When:</strong> ${escapeHtml(scheduleText)}<br />
                ${session.location ? `<strong>Where:</strong> ${escapeHtml(session.location)}<br />` : ""}
                <strong>Fee:</strong> ${escapeHtml(feeText)}
              </p>
              <p style="color: #666; font-size: 14px;">Payment and registration details are available on your dashboard.</p>
              <p>
                <a href="${appBaseUrl()}/dashboard" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                  View Registration
                </a>
              </p>
              ${transactionalFooter(trainerName)}
            </div>
          `,
        })
      }
    } catch (emailError) {
      console.error("Training confirmation email failed:", emailError)
    }

    try {
      await upsertImpliedConsent(
        sessionInfo.userId,
        "TENANT",
        session.tenantId,
        `registration:training:${params.id}`
      )
      if (data.marketingConsent === true) {
        await grantExpressConsent(
          sessionInfo.userId,
          "TENANT",
          session.tenantId,
          `checkbox:training:${params.id}`
        )
      }
    } catch (consentError) {
      console.error("Training consent capture failed:", consentError)
    }

    return NextResponse.json({ success: true, id: signup.id, totalFee }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Training signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
