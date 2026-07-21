import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { format } from "date-fns"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { ensureObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent, grantExpressConsent } from "@/lib/comms/consent"
import { getOutstandingRequiredWaivers, waiversRequiredResponse } from "@/lib/waivers/inline"

export const dynamic = "force-dynamic"

const signupSchema = z.object({
  playerId: z.string(),
  weeksSelected: z.number().min(1),
  notes: z.string().optional(),
  // CASL express-consent checkbox from the public form.
  marketingConsent: z.boolean().optional(),
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
      include: {
        tenant: { select: { name: true, currency: true } },
        _count: { select: { signups: true } },
      },
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

    // Owner ruling 2026-07-20 (waivers-esign): required club waivers are
    // signed WITH the registration — the client opens the signing gate on
    // this 409 and retries.
    const outstandingWaivers = await getOutstandingRequiredWaivers({
      tenantId: camp.tenantId,
      playerId: player.id,
    })
    if (outstandingWaivers.length > 0) {
      return NextResponse.json(waiversRequiredResponse(outstandingWaivers), { status: 409 })
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

    const signup = await prisma.$transaction(async (tx: any) => {
      const created = await tx.campSignup.create({
        data: {
          campId: params.id,
          userId: sessionInfo.userId,
          playerId: data.playerId,
          weeksSelected: data.weeksSelected,
          totalFee,
          notes: data.notes || null,
        },
      })
      await ensureObligation(tx, {
        payerUserId: sessionInfo.userId,
        payeeTenantId: camp.tenantId,
        referenceType: "CampSignup",
        referenceId: created.id,
        description: `Camp fee — ${camp.name} (${data.weeksSelected} week${data.weeksSelected > 1 ? "s" : ""})`,
        amount: totalFee,
        currency: camp.tenant?.currency ?? "CAD",
      })
      return created
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

    // ── Family-side confirmation (gap: the paying family got nothing) ──
    // All additive best-effort side-effects: never fail the registration.
    const playerName = `${player.firstName} ${player.lastName}`
    const clubName = camp.tenant?.name ?? "the club"
    const currency = camp.tenant?.currency ?? "CAD"
    const feeText = totalFee > 0 ? formatMoney(totalFee, currency) : "Free"
    const dates = `${format(new Date(camp.startDate), "MMM d")} – ${format(new Date(camp.endDate), "MMM d, yyyy")}`
    const weeksText = `${data.weeksSelected} week${data.weeksSelected > 1 ? "s" : ""}`

    await notifySafe({
      userId: sessionInfo.userId,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${playerName} is registered for "${camp.name}" with ${clubName}.`,
      link: "/dashboard",
      referenceId: signup.id,
      referenceType: "CampSignup",
    })

    try {
      const parent = await prisma.user.findUnique({
        where: { id: sessionInfo.userId },
        select: { email: true },
      })
      if (parent?.email) {
        await sendEmail({
          to: parent.email,
          subject: `Registration confirmed — ${camp.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p><strong>${escapeHtml(playerName)}</strong> is registered for <strong>${escapeHtml(camp.name)}</strong> with <strong>${escapeHtml(clubName)}</strong>.</p>
              <p>
                <strong>Dates:</strong> ${escapeHtml(dates)} (${escapeHtml(weeksText)})<br />
                <strong>Daily hours:</strong> ${escapeHtml(camp.dailyStartTime)} – ${escapeHtml(camp.dailyEndTime)}<br />
                <strong>Where:</strong> ${escapeHtml(camp.location)}<br />
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
      console.error("Camp confirmation email failed:", emailError)
    }

    // CASL: registration = existing business relationship (implied consent);
    // the explicit checkbox upgrades it to express.
    try {
      await upsertImpliedConsent(
        sessionInfo.userId,
        "TENANT",
        camp.tenantId,
        `registration:camp:${params.id}`
      )
      if (data.marketingConsent === true) {
        await grantExpressConsent(
          sessionInfo.userId,
          "TENANT",
          camp.tenantId,
          `checkbox:camp:${params.id}`
        )
      }
    } catch (consentError) {
      console.error("Camp consent capture failed:", consentError)
    }

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
