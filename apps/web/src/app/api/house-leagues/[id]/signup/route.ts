import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { format } from "date-fns"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { ensureObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent, grantExpressConsent } from "@/lib/comms/consent"

export const dynamic = "force-dynamic"

const signupSchema = z.object({
  playerId: z.string(),
  notes: z.string().optional(),
  // CASL express-consent checkbox from the public form.
  marketingConsent: z.boolean().optional(),
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
      include: {
        tenant: { select: { name: true, currency: true } },
        _count: { select: { signups: true } },
      },
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

    // ── Family-side confirmation (gap: the paying family got nothing) ──
    // All additive best-effort side-effects: never fail the registration.
    const playerName = `${player.firstName} ${player.lastName}`
    const clubName = league.tenant?.name ?? "the club"
    const currency = league.tenant?.currency ?? "CAD"
    const fee = Number(league.fee)
    const feeText = fee > 0 ? formatMoney(fee, currency) : "Free"
    const dates = `${format(new Date(league.startDate), "MMM d")} – ${format(new Date(league.endDate), "MMM d, yyyy")}`
    const schedule = `${league.daysOfWeek}, ${league.startTime} – ${league.endTime}`

    await notifySafe({
      userId: sessionInfo.userId,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${playerName} is registered for "${league.name}" with ${clubName}.`,
      link: "/dashboard",
      referenceId: signup.id,
      referenceType: "HouseLeagueSignup",
    })

    try {
      const parent = await prisma.user.findUnique({
        where: { id: sessionInfo.userId },
        select: { email: true },
      })
      if (parent?.email) {
        await sendEmail({
          to: parent.email,
          subject: `Registration confirmed — ${league.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p><strong>${escapeHtml(playerName)}</strong> is registered for <strong>${escapeHtml(league.name)}</strong> with <strong>${escapeHtml(clubName)}</strong>.</p>
              <p>
                <strong>Dates:</strong> ${escapeHtml(dates)}<br />
                <strong>Schedule:</strong> ${escapeHtml(schedule)}<br />
                <strong>Where:</strong> ${escapeHtml(league.location)}<br />
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
      console.error("House league confirmation email failed:", emailError)
    }

    // CASL: registration = existing business relationship (implied consent);
    // the explicit checkbox upgrades it to express.
    try {
      await upsertImpliedConsent(
        sessionInfo.userId,
        "TENANT",
        league.tenantId,
        `registration:houseleague:${params.id}`
      )
      if (data.marketingConsent === true) {
        await grantExpressConsent(
          sessionInfo.userId,
          "TENANT",
          league.tenantId,
          `checkbox:houseleague:${params.id}`
        )
      }
    } catch (consentError) {
      console.error("House league consent capture failed:", consentError)
    }

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
