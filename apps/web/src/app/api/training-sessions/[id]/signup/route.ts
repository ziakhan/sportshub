import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { ensureObligation, reviveObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent, grantExpressConsent } from "@/lib/comms/consent"
import { getOutstandingRequiredWaivers, waiversRequiredResponse } from "@/lib/waivers/inline"
import { formatTrainingSchedule } from "@/lib/training"
import { signupPayloadSchema, normalizeRegistrations } from "@/lib/registration/payload"
import { checkEligibility } from "@/lib/registration/eligibility"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

export const dynamic = "force-dynamic"

/**
 * POST /api/training-sessions/[id]/signup — register one or more of the
 * parent's kids for a trainer's session (owner 2026-07-23: multi-kid; legacy
 * `{ playerId }` accepted forever). One signup + one obligation per kid;
 * STRICT age policy blocks ineligible kids server-side.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = signupPayloadSchema.parse(body)
    const entries = normalizeRegistrations(data)
    if (entries.length === 0) {
      return NextResponse.json({ error: "Select at least one player" }, { status: 400 })
    }

    const players = await prisma.player.findMany({
      where: { id: { in: entries.map((e) => e.playerId) }, parentId: sessionInfo.userId },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
    })
    if (players.length !== entries.length) {
      return NextResponse.json({ error: "Player not found" }, { status: 403 })
    }
    const playerById = new Map(players.map((p) => [p.id, p]))

    const session = await (prisma as any).trainingSession.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { name: true, currency: true } },
        _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
      },
    })

    if (!session || !session.isPublished) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const endReference = session.scheduleType === "RECURRING" ? session.endDate : session.startAt
    if (endReference && new Date(endReference) < new Date()) {
      return NextResponse.json({ error: "This program has ended" }, { status: 400 })
    }

    if (session.capacity && session._count.signups + entries.length > session.capacity) {
      const left = Math.max(0, session.capacity - session._count.signups)
      return NextResponse.json(
        { error: left === 0 ? "This program is full" : `Only ${left} spot${left === 1 ? "" : "s"} left` },
        { status: 400 }
      )
    }

    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const eligibility = checkEligibility({
        dateOfBirth: player.dateOfBirth,
        gender: player.gender,
        program: { ageGroup: session.ageGroup, agePolicy: session.agePolicy, gender: session.gender },
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

    const existing = await (prisma as any).trainingSessionSignup.findMany({
      where: { sessionId: params.id, playerId: { in: entries.map((e) => e.playerId) } },
    })
    const activeDup = existing.find((s: any) => s.status !== "CANCELLED")
    if (activeDup) {
      const p = playerById.get(activeDup.playerId)
      return NextResponse.json(
        { error: `${p ? `${p.firstName} ${p.lastName}` : "This player"} is already registered` },
        { status: 409 }
      )
    }
    const cancelledByPlayer = new Map(
      existing.filter((s: any) => s.status === "CANCELLED").map((s: any) => [s.playerId, s.id])
    )

    const waiversByPlayer: Array<{ playerId: string; playerName: string; waivers: any[] }> = []
    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const outstanding = await getOutstandingRequiredWaivers({
        tenantId: session.tenantId,
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

    const totalFee = Number(session.fee)

    const results = await prisma.$transaction(
      async (tx: any) => {
        // QA-007: the pre-transaction capacity check is advisory only — two
        // concurrent signups could both pass it. This SERIALIZABLE re-check
        // is the authoritative gate; Postgres aborts one of two racers.
        if (session.capacity) {
          const activeNow = await tx.trainingSessionSignup.count({
            where: { sessionId: params.id, status: { not: "CANCELLED" } },
          })
          if (activeNow + entries.length > session.capacity) throw new Error("CAPACITY_FULL")
        }
      const created: Array<{ playerId: string; signupId: string }> = []
      for (const entry of entries) {
        const cancelledId = cancelledByPlayer.get(entry.playerId)
        const signup = cancelledId
          ? await tx.trainingSessionSignup.update({
              where: { id: cancelledId },
              data: { status: "CONFIRMED", totalFee, notes: data.notes || null },
            })
          : await tx.trainingSessionSignup.create({
              data: {
                sessionId: params.id,
                userId: sessionInfo.userId,
                playerId: entry.playerId,
                totalFee,
                notes: data.notes || null,
              },
            })
        await (cancelledId ? reviveObligation : ensureObligation)(tx, {
          payerUserId: sessionInfo.userId,
          payeeTenantId: session.tenantId,
          referenceType: "TrainingSessionSignup",
          referenceId: signup.id,
          description: `Training fee — ${session.title}`,
          amount: totalFee,
          currency: session.tenant?.currency ?? "CAD",
        })
        created.push({ playerId: entry.playerId, signupId: signup.id })
      }
        return created
      },
      { isolationLevel: "Serializable" }
    )

    const names = results.map((r) => {
      const p = playerById.get(r.playerId)!
      return `${p.firstName} ${p.lastName}`
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
        message: `${names.join(", ")} signed up for "${session.title}".`,
        link: `/clubs/${session.tenantId}/training`,
        referenceId: results[0].signupId,
        referenceType: "TrainingSessionSignup",
      }
    )

    const trainerName = session.tenant?.name ?? "the trainer"
    const currency = session.tenant?.currency ?? "CAD"
    const totalAll = totalFee * results.length
    const scheduleText = formatTrainingSchedule(session)

    await notifySafe({
      userId: sessionInfo.userId,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} registered for "${session.title}" with ${trainerName}.`,
      link: "/dashboard",
      referenceId: results[0].signupId,
      referenceType: "TrainingSessionSignup",
    })

    try {
      const parent = await prisma.user.findUnique({
        where: { id: sessionInfo.userId },
        select: { email: true },
      })
      if (parent?.email) {
        const kidLines = names
          .map((n) => `<li><strong>${escapeHtml(n)}</strong> — ${escapeHtml(totalFee > 0 ? formatMoney(totalFee, currency) : "Free")}</li>`)
          .join("")
        await sendEmail({
          to: parent.email,
          subject: `Registration confirmed — ${session.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p>Registered for <strong>${escapeHtml(session.title)}</strong> with <strong>${escapeHtml(trainerName)}</strong>:</p>
              <ul>${kidLines}</ul>
              <p>
                <strong>When:</strong> ${escapeHtml(scheduleText)}<br />
                ${session.location ? `<strong>Where:</strong> ${escapeHtml(session.location)}<br />` : ""}
                <strong>Total:</strong> ${escapeHtml(totalAll > 0 ? formatMoney(totalAll, currency) : "Free")}
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
      await upsertImpliedConsent(sessionInfo.userId, "TENANT", session.tenantId, `registration:training:${params.id}`)
      if (data.marketingConsent === true) {
        await grantExpressConsent(sessionInfo.userId, "TENANT", session.tenantId, `checkbox:training:${params.id}`)
      }
    } catch (consentError) {
      console.error("Training consent capture failed:", consentError)
    }

    return NextResponse.json({ success: true, id: results[0].signupId, totalFee: totalAll, results }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "CAPACITY_FULL") {
      return NextResponse.json({ error: "This program is full" }, { status: 400 })
    }
    if ((error as any)?.code === "P2034") {
      // Serialization conflict: another registration landed first.
      return NextResponse.json(
        { error: "Registrations are moving fast — please try again." },
        { status: 409 }
      )
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Training signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
