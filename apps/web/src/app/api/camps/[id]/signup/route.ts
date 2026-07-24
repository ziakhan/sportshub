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
import { campFeeFor, sessionDatesFor, unitLabel } from "@/lib/registration/camp-schedule"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"

export const dynamic = "force-dynamic"

/**
 * POST /api/camps/[id]/signup — register one or more of the parent's kids
 * (owner 2026-07-23: multi-kid + pick WHICH weeks). Accepts the legacy
 * `{ playerId, weeksSelected }` single-kid payload forever (fielded apps).
 * One CampSignup + one PaymentObligation per kid; STRICT age policy blocks
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

    const camp = await (prisma as any).camp.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { name: true, currency: true } },
        _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
      },
    })

    if (!camp || !camp.isPublished) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 })
    }

    if (new Date(camp.endDate) < new Date()) {
      return NextResponse.json({ error: "This camp has ended" }, { status: 400 })
    }

    if (camp.maxParticipants && camp._count.signups + entries.length > camp.maxParticipants) {
      const left = Math.max(0, camp.maxParticipants - camp._count.signups)
      return NextResponse.json(
        { error: left === 0 ? "This camp is full" : `Only ${left} spot${left === 1 ? "" : "s"} left` },
        { status: 400 }
      )
    }

    // Program flexibility (owner 2026-07-24): CONSECUTIVE keeps the week
    // model; DAILY/WEEKDAY_PATTERN sell individual session dates.
    const scheduleInput = {
      scheduleKind: camp.scheduleKind as "CONSECUTIVE" | "DAILY" | "WEEKDAY_PATTERN",
      startDate: camp.startDate,
      endDate: camp.endDate,
      daysOfWeek: (camp.daysOfWeek ?? []) as number[],
    }
    const validSessionTimes = new Set(
      sessionDatesFor(scheduleInput).map((d) => d.getTime())
    )

    // Per-kid validation: weeks/dates, age policy, duplicates.
    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const name = `${player.firstName} ${player.lastName}`

      if (camp.scheduleKind === "CONSECUTIVE") {
        const weeksCount = entry.weeksCount ?? camp.numberOfWeeks
        if (weeksCount > camp.numberOfWeeks) {
          return NextResponse.json({ error: "Cannot select more weeks than available" }, { status: 400 })
        }
        if (entry.weekNumbers?.some((w) => w < 1 || w > camp.numberOfWeeks)) {
          return NextResponse.json({ error: "Invalid week selection" }, { status: 400 })
        }
      } else {
        const dates = entry.sessionDates ?? []
        if (dates.length === 0) {
          return NextResponse.json({ error: "Select at least one session date" }, { status: 400 })
        }
        const invalid = dates.some((iso) => !validSessionTimes.has(new Date(iso).getTime()))
        if (invalid) {
          return NextResponse.json({ error: "Invalid session date selection" }, { status: 400 })
        }
      }

      const eligibility = checkEligibility({
        dateOfBirth: player.dateOfBirth,
        gender: player.gender,
        program: { ageGroup: camp.ageGroup, agePolicy: camp.agePolicy, gender: camp.gender },
      })
      if (eligibility.status === "block") {
        return NextResponse.json(
          { error: `${name} isn't eligible: ${eligibility.reason}`, code: "NOT_ELIGIBLE" },
          { status: 400 }
        )
      }
    }

    const existing = await (prisma as any).campSignup.findMany({
      where: { campId: params.id, playerId: { in: entries.map((e) => e.playerId) } },
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

    // Required club waivers are signed WITH the registration (owner ruling
    // 2026-07-20) — collect across every kid; client gates then retries.
    const waiversByPlayer: Array<{ playerId: string; playerName: string; waivers: any[] }> = []
    for (const entry of entries) {
      const player = playerById.get(entry.playerId)!
      const outstanding = await getOutstandingRequiredWaivers({
        tenantId: camp.tenantId,
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

    const pricing = {
      scheduleKind: scheduleInput.scheduleKind,
      numberOfWeeks: camp.numberOfWeeks,
      weeklyFee: Number(camp.weeklyFee),
      fullCampFee: camp.fullCampFee != null ? Number(camp.fullCampFee) : null,
      pricePerSession: camp.pricePerSession != null ? Number(camp.pricePerSession) : null,
      startDate: camp.startDate,
      endDate: camp.endDate,
      daysOfWeek: scheduleInput.daysOfWeek,
    }
    const unit = unitLabel(scheduleInput.scheduleKind)

    const results = await prisma.$transaction(
      async (tx: any) => {
        // QA-007: the pre-transaction capacity check is advisory only — two
        // concurrent signups could both pass it. This SERIALIZABLE re-check
        // is the authoritative gate; Postgres aborts one of two racers.
        if (camp.maxParticipants) {
          const activeNow = await tx.campSignup.count({
            where: { campId: params.id, status: { not: "CANCELLED" } },
          })
          if (activeNow + entries.length > camp.maxParticipants) throw new Error("CAPACITY_FULL")
        }
      const created: Array<{ playerId: string; signupId: string; totalFee: number; count: number; unit: "week" | "session" }> = []
      for (const entry of entries) {
        const isConsecutive = scheduleInput.scheduleKind === "CONSECUTIVE"
        const weeksCount = entry.weeksCount ?? camp.numberOfWeeks
        const dates = (entry.sessionDates ?? []).map((iso) => new Date(iso))
        const count = isConsecutive ? weeksCount : dates.length
        const feeTotal = campFeeFor(pricing, isConsecutive ? { weeksCount } : { sessionCount: count })
        const countLabel = `${count} ${unit}${count > 1 ? "s" : ""}`
        const signupData = {
          weeksSelected: isConsecutive ? weeksCount : 0,
          weekNumbers: isConsecutive ? entry.weekNumbers ?? [] : [],
          selectedDates: isConsecutive ? [] : dates,
          totalFee: feeTotal,
          notes: data.notes || null,
          status: "REGISTERED",
        }
        // A CANCELLED row for this kid is revived in place (unique campId+playerId).
        const cancelledId = cancelledByPlayer.get(entry.playerId)
        const signup = cancelledId
          ? await tx.campSignup.update({ where: { id: cancelledId }, data: signupData })
          : await tx.campSignup.create({
              data: { campId: params.id, userId: sessionInfo.userId, playerId: entry.playerId, ...signupData },
            })
        await (cancelledId ? reviveObligation : ensureObligation)(tx, {
          payerUserId: sessionInfo.userId,
          payeeTenantId: camp.tenantId,
          referenceType: "CampSignup",
          referenceId: signup.id,
          description: `Camp fee — ${camp.name} (${countLabel})`,
          amount: feeTotal,
          currency: camp.tenant?.currency ?? "CAD",
        })
        created.push({ playerId: entry.playerId, signupId: signup.id, totalFee: feeTotal, count, unit })
      }
        return created
      },
      { isolationLevel: "Serializable" }
    )

    const names = results.map((r) => {
      const p = playerById.get(r.playerId)!
      return `${p.firstName} ${p.lastName}`
    })

    // Notify the club that new signups arrived.
    const staff = await prisma.userRole.findMany({
      where: { tenantId: camp.tenantId, role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any } },
      select: { userId: true },
    })
    await notifyMany(
      prisma,
      staff.map((r) => r.userId),
      {
        type: "signup_received",
        title: "New Camp Signup",
        message: `${names.join(", ")} signed up for "${camp.name}".`,
        link: `/clubs/${camp.tenantId}/camps`,
        referenceId: results[0].signupId,
        referenceType: "CampSignup",
      }
    )

    // ── Family-side confirmation — additive best-effort, never fails the
    // registration. ONE notification + ONE email covering every kid.
    const clubName = camp.tenant?.name ?? "the club"
    const currency = camp.tenant?.currency ?? "CAD"
    const totalAll = results.reduce((sum, r) => sum + r.totalFee, 0)
    const dates = `${format(new Date(camp.startDate), "MMM d")} – ${format(new Date(camp.endDate), "MMM d, yyyy")}`

    await notifySafe({
      userId: sessionInfo.userId,
      type: "registration_confirmed",
      title: "You're registered!",
      message: `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} registered for "${camp.name}" with ${clubName}.`,
      link: "/dashboard",
      referenceId: results[0].signupId,
      referenceType: "CampSignup",
    })

    try {
      const parent = await prisma.user.findUnique({
        where: { id: sessionInfo.userId },
        select: { email: true },
      })
      if (parent?.email) {
        const kidLines = results
          .map((r) => {
            const p = playerById.get(r.playerId)!
            const feeText = r.totalFee > 0 ? formatMoney(r.totalFee, currency) : "Free"
            return `<li><strong>${escapeHtml(`${p.firstName} ${p.lastName}`)}</strong> · ${r.count} ${r.unit}${r.count > 1 ? "s" : ""}, ${escapeHtml(feeText)}</li>`
          })
          .join("")
        await sendEmail({
          to: parent.email,
          subject: `Registration confirmed — ${camp.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're registered!</h2>
              <p>Registered for <strong>${escapeHtml(camp.name)}</strong> with <strong>${escapeHtml(clubName)}</strong>:</p>
              <ul>${kidLines}</ul>
              <p>
                <strong>Dates:</strong> ${escapeHtml(dates)}<br />
                <strong>Daily hours:</strong> ${escapeHtml(camp.dailyStartTime)} – ${escapeHtml(camp.dailyEndTime)}<br />
                <strong>Where:</strong> ${escapeHtml(camp.location)}<br />
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
      console.error("Camp confirmation email failed:", emailError)
    }

    // CASL: registration = existing business relationship (implied consent);
    // the explicit checkbox upgrades it to express.
    try {
      await upsertImpliedConsent(sessionInfo.userId, "TENANT", camp.tenantId, `registration:camp:${params.id}`)
      if (data.marketingConsent === true) {
        await grantExpressConsent(sessionInfo.userId, "TENANT", camp.tenantId, `checkbox:camp:${params.id}`)
      }
    } catch (consentError) {
      console.error("Camp consent capture failed:", consentError)
    }

    return NextResponse.json(
      // Legacy top-level id/totalFee kept for fielded single-kid clients.
      { success: true, id: results[0].signupId, totalFee: totalAll, results },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === "CAPACITY_FULL") {
      return NextResponse.json({ error: "This camp is full" }, { status: 400 })
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
    console.error("Camp signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
