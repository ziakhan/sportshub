import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { format } from "date-fns"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { ensureObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent } from "@/lib/comms/consent"
import { generateOneOnOneSlots } from "@/lib/training"

export const dynamic = "force-dynamic"

const bookSchema = z.object({
  playerId: z.string(),
  startAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
})

/**
 * POST /api/trainers/[tenantId]/book — a parent books ONE generated 1-on-1
 * slot (owner ruling: one generic "One-on-One Training" program; the system
 * generates slots of slotMinutes inside the trainer's availability). The
 * server re-derives the slot grid, so off-grid or already-taken times are
 * rejected; booking creates the row + a payment obligation.
 */
export async function POST(request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const data = bookSchema.parse(body)

    const player = await prisma.player.findFirst({
      where: { id: data.playerId, parentId: sessionInfo.userId },
    })
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 403 })

    const [profile, tenant] = await Promise.all([
      (prisma as any).trainerProfile.findUnique({ where: { tenantId: params.tenantId } }),
      (prisma as any).tenant.findUnique({
        where: { id: params.tenantId },
        select: { id: true, name: true, currency: true },
      }),
    ])
    if (!tenant || !profile?.oneOnOneEnabled) {
      return NextResponse.json({ error: "1-on-1 booking isn't available" }, { status: 404 })
    }

    const startAt = new Date(data.startAt)
    const now = new Date()
    if (startAt.getTime() < now.getTime()) {
      return NextResponse.json({ error: "That time has passed" }, { status: 400 })
    }

    // Re-derive the slot grid around the requested day and require membership.
    const dayStart = new Date(startAt.getTime() - 2 * 86_400_000)
    const dayEnd = new Date(startAt.getTime() + 2 * 86_400_000)
    const windows = await (prisma as any).trainerAvailability.findMany({
      where: { tenantId: params.tenantId, date: { gte: dayStart, lte: dayEnd } },
      select: { date: true, startTime: true, endTime: true },
    })
    const validSlots = generateOneOnOneSlots({
      windows,
      slotMinutes: profile.slotMinutes,
      bookedStartMillis: new Set(),
      from: now,
    })
    if (!validSlots.some((s) => s.getTime() === startAt.getTime())) {
      return NextResponse.json(
        { error: "That time isn't one of the trainer's open slots" },
        { status: 400 }
      )
    }

    const fee = profile.oneOnOneFee != null ? Number(profile.oneOnOneFee) : 0

    // No-double-book: the CONFIRMED check + create run in one transaction.
    let booking: any
    try {
      booking = await prisma.$transaction(async (tx: any) => {
        const taken = await tx.oneOnOneBooking.findFirst({
          where: { tenantId: params.tenantId, startAt, status: "CONFIRMED" },
          select: { id: true },
        })
        if (taken) throw new Error("SLOT_TAKEN")
        const created = await tx.oneOnOneBooking.create({
          data: {
            tenantId: params.tenantId,
            userId: sessionInfo.userId,
            playerId: data.playerId,
            startAt,
            durationMinutes: profile.slotMinutes,
            fee,
            notes: data.notes || null,
          },
        })
        await ensureObligation(tx, {
          payerUserId: sessionInfo.userId,
          payeeTenantId: params.tenantId,
          referenceType: "OneOnOneBooking",
          referenceId: created.id,
          description: `${profile.oneOnOneTitle} — ${format(startAt, "MMM d, h:mm a")}`,
          amount: fee,
          currency: tenant.currency ?? "CAD",
        })
        return created
      })
    } catch (e: any) {
      if (e?.message === "SLOT_TAKEN") {
        return NextResponse.json(
          { error: "Someone just booked that slot — pick another time" },
          { status: 409 }
        )
      }
      throw e
    }

    const playerName = `${player.firstName} ${player.lastName}`
    const when = format(startAt, "EEE MMM d, h:mm a")

    // Trainer side
    const staff = await prisma.userRole.findMany({
      where: {
        tenantId: params.tenantId,
        role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
      },
      select: { userId: true },
    })
    await notifyMany(
      prisma,
      staff.map((r) => r.userId),
      {
        type: "signup_received",
        title: "New 1-on-1 Booking",
        message: `${playerName} booked ${when}.`,
        link: `/clubs/${params.tenantId}/one-on-one`,
        referenceId: booking.id,
        referenceType: "OneOnOneBooking",
      }
    )

    // Family side
    await notifySafe({
      userId: sessionInfo.userId,
      type: "registration_confirmed",
      title: "Session booked!",
      message: `${playerName} — ${profile.oneOnOneTitle} with ${tenant.name}, ${when}.`,
      link: "/dashboard",
      referenceId: booking.id,
      referenceType: "OneOnOneBooking",
    })
    try {
      const parent = await prisma.user.findUnique({
        where: { id: sessionInfo.userId },
        select: { email: true },
      })
      if (parent?.email) {
        const feeText = fee > 0 ? formatMoney(fee, tenant.currency ?? "CAD") : "Free"
        await sendEmail({
          to: parent.email,
          subject: `Session booked — ${profile.oneOnOneTitle} (${when})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Session booked!</h2>
              <p><strong>${escapeHtml(playerName)}</strong> has a <strong>${escapeHtml(profile.oneOnOneTitle)}</strong> session with <strong>${escapeHtml(tenant.name)}</strong>.</p>
              <p>
                <strong>When:</strong> ${escapeHtml(when)} (${profile.slotMinutes} min)<br />
                <strong>Fee:</strong> ${escapeHtml(feeText)}
              </p>
              <p>
                <a href="${appBaseUrl()}/dashboard" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                  View Booking
                </a>
              </p>
              ${transactionalFooter(tenant.name)}
            </div>
          `,
        })
      }
    } catch (emailError) {
      console.error("Booking confirmation email failed:", emailError)
    }

    try {
      await upsertImpliedConsent(
        sessionInfo.userId,
        "TENANT",
        params.tenantId,
        `registration:one-on-one:${booking.id}`
      )
    } catch (consentError) {
      console.error("Booking consent capture failed:", consentError)
    }

    return NextResponse.json({ success: true, id: booking.id, fee }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("1-on-1 booking error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
