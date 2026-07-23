import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { format } from "date-fns"
import { notifyMany, notifySafe } from "@/lib/notifications"
import { ensureObligation, reviveObligation } from "@/lib/payments/obligations"
import { sendEmail, appBaseUrl, escapeHtml, formatMoney, transactionalFooter } from "@/lib/email"
import { upsertImpliedConsent, grantExpressConsent } from "@/lib/comms/consent"
import { getOutstandingRequiredWaivers, waiversRequiredResponse } from "@/lib/waivers/inline"
import { signupPayloadSchema, normalizeRegistrations } from "@/lib/registration/payload"
import { checkEligibility } from "@/lib/registration/eligibility"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

export const dynamic = "force-dynamic"

/**
 * POST /api/house-leagues/[id]/signup — register one or more of the parent's
 * kids (owner 2026-07-23: multi-kid). Legacy `{ playerId }` payload accepted
 * forever. One signup + one obligation per kid; STRICT age policy blocks
 * ineligible kids server-side.
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

    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { name: true, currency: true } },
        _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
      },
    })

    if (!league || !league.isPublished) {
      return NextResponse.json({ error: "House league not found" }, { status: 404 })
    }

    if (new Date(league.endDate) < new Date()) {
      return NextResponse.json({ error: "This house league has ended" }, { status: 400 })
    }

    if (league.maxParticipants && league._count.signups + entries.length > league.maxParticipants) {
      const left = Math.max(0, league.maxParticipants - league._count.signups)
      return NextResponse.json(
        { error: left === 0 ? "This house league is full" : `Only ${left} spot${left === 1 ? "" : "s"} left` },
        { status: 400 }
      )
    }

    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const eligibility = checkEligibility({
        dateOfBirth: player.dateOfBirth,
        gender: player.gender,
        program: { ageGroup: league.ageGroups, agePolicy: league.agePolicy, gender: league.gender },
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

    const existing = await (prisma as any).houseLeagueSignup.findMany({
      where: { houseLeagueId: params.id, playerId: { in: entries.map((e) => e.playerId) } },
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

    // Required club waivers signed WITH the registration (owner 2026-07-20).
    const waiversByPlayer: Array<{ playerId: string; playerName: string; waivers: any[] }> = []
    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const outstanding = await getOutstandingRequiredWaivers({
        tenantId: league.tenantId,
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

    const results = await prisma.$transaction(async (tx: any) => {
      const created: Array<{ playerId: string; signupId: string }> = []
      for (const entry of entries) {
        const player = playerById.get(entry.playerId)!
        const signupData = { notes: data.notes || null, status: "REGISTERED" }
        const cancelledId = cancelledByPlayer.get(entry.playerId)
        const signup = cancelledId
          ? await tx.houseLeagueSignup.update({ where: { id: cancelledId }, data: signupData })
          : await tx.houseLeagueSignup.create({
              data: {
                houseLeagueId: params.id,
                userId: sessionInfo.userId,
                playerId: entry.playerId,
                ...signupData,
              },
            })
        await (cancelledId ? reviveObligation : ensureObligation)(tx, {
          payerUserId: sessionInfo.userId,
          payeeTenantId: league.tenantId,
          referenceType: "HouseLeagueSignup",
          referenceId: signup.id,
          description: `House league fee — ${league.name} (${player.firstName} ${player.lastName})`,
          amount: Number(league.fee),
          currency: league.tenant?.currency ?? "CAD",
        })
        created.push({ playerId: entry.playerId, signupId: signup.id })
      }
      return created
    })

    const names = results.map((r) => {
      const p = playerById.get(r.playerId)!
      return `${p.firstName} ${p.lastName}`
    })

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
        message: `${names.join(", ")} signed up for "${league.name}".`,
        link: `/clubs/${league.tenantId}/house-leagues`,
        referenceId: results[0].signupId,
        referenceType: "HouseLeagueSignup",
      }
    )

    // ── Family-side confirmation — ONE notification + ONE email, all kids.
    const clubName = league.tenant?.name ?? "the club"
    const currency = league.tenant?.currency ?? "CAD"
    const fee = Number(league.fee)
    const totalAll = fee * results.length
    const dates = `${format(new Date(league.startDate), "MMM d")} – ${format(new Date(league.endDate), "MMM d, yyyy")}`
    const schedule = `${league.daysOfWeek}, ${league.startTime} – ${league.endTime}`

    await notifySafe({
      userId: sessionInfo.userId,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} registered for "${league.name}" with ${clubName}.`,
      link: "/dashboard",
      referenceId: results[0].signupId,
      referenceType: "HouseLeagueSignup",
    })

    try {
      const parent = await prisma.user.findUnique({
        where: { id: sessionInfo.userId },
        select: { email: true },
      })
      if (parent?.email) {
        const kidLines = names
          .map((n) => `<li><strong>${escapeHtml(n)}</strong> — ${escapeHtml(fee > 0 ? formatMoney(fee, currency) : "Free")}</li>`)
          .join("")
        await sendEmail({
          to: parent.email,
          subject: `Registration confirmed — ${league.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p>Registered for <strong>${escapeHtml(league.name)}</strong> with <strong>${escapeHtml(clubName)}</strong>:</p>
              <ul>${kidLines}</ul>
              <p>
                <strong>Season:</strong> ${escapeHtml(dates)}<br />
                <strong>Schedule:</strong> ${escapeHtml(schedule)}<br />
                <strong>Where:</strong> ${escapeHtml(league.location)}<br />
                <strong>Total:</strong> ${escapeHtml(totalAll > 0 ? formatMoney(totalAll, currency) : "Free")}
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

    try {
      await upsertImpliedConsent(sessionInfo.userId, "TENANT", league.tenantId, `registration:house-league:${params.id}`)
      if (data.marketingConsent === true) {
        await grantExpressConsent(sessionInfo.userId, "TENANT", league.tenantId, `checkbox:house-league:${params.id}`)
      }
    } catch (consentError) {
      console.error("House league consent capture failed:", consentError)
    }

    return NextResponse.json({ success: true, id: results[0].signupId, results }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("House league signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
