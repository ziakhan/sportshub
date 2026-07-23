import { getSessionUserId } from "@/lib/auth-helpers"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { format } from "date-fns"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { cancelObligationIfUnpaid, ensureObligation, reviveObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent, grantExpressConsent } from "@/lib/comms/consent"
import { getOutstandingRequiredWaivers, waiversRequiredResponse } from "@/lib/waivers/inline"
import { signupPayloadSchema, normalizeRegistrations } from "@/lib/registration/payload"
import { checkEligibility, ageOf } from "@/lib/registration/eligibility"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

export const dynamic = "force-dynamic"

/**
 * Sign up for a tryout — one or more of the parent's kids (owner 2026-07-23:
 * multi-kid; legacy `{ playerId }` accepted forever). Tryouts default to a
 * STRICT age policy: the age group on the team is mandatory, so ineligible
 * players are blocked server-side.
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
    const data = signupPayloadSchema.parse(body)
    const entries = normalizeRegistrations(data)
    if (entries.length === 0) {
      return NextResponse.json({ error: "Select at least one player" }, { status: 400 })
    }

    const players = await prisma.player.findMany({
      where: { id: { in: entries.map((e) => e.playerId) }, parentId: user.id },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
    })
    if (players.length !== entries.length) {
      return NextResponse.json({ error: "Player not found or does not belong to you" }, { status: 403 })
    }
    const playerById = new Map(players.map((p) => [p.id, p]))

    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { name: true, currency: true } },
        _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
      },
    })

    if (!tryout || !tryout.isPublished) {
      return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
    }

    if (new Date(tryout.scheduledAt) < new Date()) {
      return NextResponse.json({ error: "This tryout has already passed" }, { status: 400 })
    }

    if (tryout.maxParticipants && tryout._count.signups + entries.length > tryout.maxParticipants) {
      const left = Math.max(0, tryout.maxParticipants - tryout._count.signups)
      return NextResponse.json(
        { error: left === 0 ? "This tryout is full" : `Only ${left} spot${left === 1 ? "" : "s"} left` },
        { status: 400 }
      )
    }

    // Age policy — tryouts are STRICT by default (team age groups are
    // mandatory, owner 2026-07-23).
    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const eligibility = checkEligibility({
        dateOfBirth: player.dateOfBirth,
        gender: player.gender,
        program: {
          ageGroup: tryout.ageGroup,
          agePolicy: (tryout as any).agePolicy ?? "STRICT",
          gender: tryout.gender,
        },
      })
      if (eligibility.status === "block") {
        return NextResponse.json(
          {
            error: `${player.firstName} ${player.lastName} isn't eligible: ${eligibility.reason}`,
            code: "NOT_ELIGIBLE",
          },
          { status: 400 }
        )
      }
    }

    // Duplicates: match on playerId (current rows) or userId+playerName
    // (legacy rows that predate the Player link).
    const names = players.map((p) => `${p.firstName} ${p.lastName}`)
    const existing = await prisma.tryoutSignup.findMany({
      where: {
        tryoutId: params.id,
        OR: [
          { playerId: { in: players.map((p) => p.id) } },
          { userId: user.id, playerName: { in: names } },
        ],
      },
    })
    const activeDup = existing.find((s) => s.status !== "CANCELLED")
    if (activeDup) {
      return NextResponse.json(
        { error: `${activeDup.playerName} is already signed up for this tryout` },
        { status: 409 }
      )
    }
    const cancelledFor = (playerId: string, playerName: string) =>
      existing.find(
        (s) => s.status === "CANCELLED" && (s.playerId === playerId || s.playerName === playerName)
      )

    // Required club waivers signed WITH the registration (owner 2026-07-20).
    const waiversByPlayer: Array<{ playerId: string; playerName: string; waivers: any[] }> = []
    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const outstanding = await getOutstandingRequiredWaivers({
        tenantId: tryout.tenantId,
        playerId: player.id,
      })
      if (outstanding.length > 0) {
        waiversByPlayer.push({
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          waivers: outstanding,
        })
      }
    }
    if (waiversByPlayer.length > 0) {
      return NextResponse.json(
        { ...waiversRequiredResponse(waiversByPlayer[0].waivers), waiversByPlayer },
        { status: 409 }
      )
    }

    const isFree = Number(tryout.fee) === 0
    const status = isFree ? "CONFIRMED" : "PENDING"

    const results = await prisma.$transaction(async (tx: any) => {
      const created: Array<{ playerId: string; signupId: string; playerName: string }> = []
      for (const entry of entries) {
        const player = playerById.get(entry.playerId)!
        const playerName = `${player.firstName} ${player.lastName}`
        const snapshot = {
          playerName,
          // Calendar age via lib/coppa (audit 2026-07-23: the old float
          // formula here drifted from the canonical calculation).
          playerAge: ageOf(player.dateOfBirth),
          playerGender: player.gender,
          status,
          notes: data.notes || null,
        }
        const revive = cancelledFor(player.id, playerName)
        const signup = revive
          ? await tx.tryoutSignup.update({
              where: { id: revive.id },
              data: { ...snapshot, playerId: player.id },
              select: { id: true, playerName: true, status: true, createdAt: true },
            })
          : await tx.tryoutSignup.create({
              data: { tryoutId: params.id, userId: user.id, playerId: player.id, ...snapshot },
              select: { id: true, playerName: true, status: true, createdAt: true },
            })

        // Paid tryout → the signup owes the club its fee. How it gets paid
        // (at the door, e-transfer, or Stripe later) is the club's payment
        // config; the obligation is the same either way.
        await (revive ? reviveObligation : ensureObligation)(tx, {
          payerUserId: user.id,
          payeeTenantId: tryout.tenantId,
          referenceType: "TryoutSignup",
          referenceId: signup.id,
          description: `Tryout fee — ${tryout.title} (${playerName})`,
          amount: Number(tryout.fee),
          currency: tryout.tenant.currency,
        })
        created.push({ playerId: player.id, signupId: signup.id, playerName })
      }
      return created
    })

    // Notify the club that new signups arrived.
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
        message: `${results.map((r) => r.playerName).join(", ")} signed up for "${tryout.title}".`,
        link: `/clubs/${tryout.tenantId}/tryouts`,
        referenceId: results[0].signupId,
        referenceType: "TryoutSignup",
      }
    )

    // ── Family-side confirmation — ONE notification + ONE email, all kids.
    const clubName = tryout.tenant.name
    const fee = Number(tryout.fee)
    const totalAll = fee * results.length
    const when = format(new Date(tryout.scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a")
    const kidNames = results.map((r) => r.playerName)

    await notifySafe({
      userId: user.id,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${kidNames.join(" and ")} ${kidNames.length > 1 ? "are" : "is"} signed up for "${tryout.title}" with ${clubName}.`,
      link: "/dashboard",
      referenceId: results[0].signupId,
      referenceType: "TryoutSignup",
    })

    try {
      if (user.email) {
        const kidLines = kidNames
          .map((n) => `<li><strong>${escapeHtml(n)}</strong> — ${escapeHtml(isFree ? "Free" : formatMoney(fee, tryout.tenant.currency))}</li>`)
          .join("")
        await sendEmail({
          to: user.email,
          subject: `Registration confirmed — ${tryout.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p>Signed up for <strong>${escapeHtml(tryout.title)}</strong> with <strong>${escapeHtml(clubName)}</strong>:</p>
              <ul>${kidLines}</ul>
              <p>
                <strong>When:</strong> ${escapeHtml(when)}<br />
                <strong>Where:</strong> ${escapeHtml(tryout.location)}<br />
                <strong>Total:</strong> ${escapeHtml(totalAll > 0 ? formatMoney(totalAll, tryout.tenant.currency) : "Free")}
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

    // Legacy single-kid clients read the flat signup fields.
    return NextResponse.json(
      { id: results[0].signupId, playerName: results[0].playerName, status, results },
      { status: 201 }
    )
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
