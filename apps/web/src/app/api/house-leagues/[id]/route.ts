import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicHouseLeague } from "@/lib/queries/house-league"
import { getSessionUserId } from "@/lib/auth-helpers"
import { MANAGE_LITE_FIELDS, isAssignedProgramStaff } from "@/lib/programs/staff"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { notifySafe } from "@/lib/notifications"
import { cancelObligationIfUnpaid } from "@/lib/payments/obligations"
import { sendEmail, escapeHtml, transactionalFooter } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * GET /api/house-leagues/[id] — Get single house league
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const league = await getPublicHouseLeague(params.id)

    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(league)
  } catch (error) {
    console.error("Get house league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/house-leagues/[id] — Update (including publish/unpublish)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
      select: { tenantId: true },
    })
    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()

    // Club admins edit everything; ASSIGNED program staff get manage-lite
    // (description/schedule fields only); everyone else 403
    // (docs/roadmap/program-staff-plan.md, owner 2026-07-11)
    const isAdmin =
      auth.isPlatformAdmin ||
      !!(await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          tenantId: league.tenantId,
          role: { in: ["ClubOwner", "ClubManager"] },
        },
        select: { id: true },
      }))
    if (!isAdmin) {
      const assigned = await isAssignedProgramStaff(auth.userId, "HOUSE_LEAGUE", params.id)
      if (!assigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const blocked = Object.keys(body).filter(
        (k) => body[k] !== undefined && !MANAGE_LITE_FIELDS.HOUSE_LEAGUE.has(k)
      )
      if (blocked.length > 0) {
        return NextResponse.json(
          { error: `Program staff can't change: ${blocked.join(", ")}` },
          { status: 403 }
        )
      }
    }
    const updateData: Record<string, any> = {}

    // Allow updating any field
    const fields = [
      "name",
      "description",
      "details",
      "ageGroups",
      "agePolicy",
      "gender",
      "season",
      "daysOfWeek",
      "startTime",
      "endTime",
      "location",
      "maxParticipants",
      "includesUniform",
      "includesJersey",
      "includesBall",
      "includesMedal",
      "isPublished",
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }
    if (body.fee !== undefined) updateData.fee = body.fee
    if (body.venueId !== undefined) updateData.venueId = body.venueId || null
    if (body.startDate) updateData.startDate = new Date(body.startDate)
    if (body.endDate) updateData.endDate = new Date(body.endDate)

    const updated = await (prisma as any).houseLeague.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({ success: true, ...updated, fee: Number(updated.fee) })
  } catch (error) {
    console.error("Update house league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Delete a house league
 * DELETE /api/house-leagues/[id]
 *
 * Owner ruling 2026-07-24 (QA-204): club-admin only (not manage-lite program
 * staff). Deletion is allowed with active registrations — unpaid fees are
 * cancelled, every affected family is told, and the row (and its signups, via
 * cascade) is removed. Paid platform obligations are left for the club to
 * refund explicitly — see the email copy below.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        tenant: { select: { name: true } },
      },
    })
    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (!(await isClubAdmin(auth.userId, league.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cancelledSignups = await prisma.$transaction(async (tx: any) => {
      const signups = await tx.houseLeagueSignup.findMany({
        where: { houseLeagueId: params.id, status: { not: "CANCELLED" } },
        select: {
          id: true,
          userId: true,
          user: { select: { email: true } },
          player: { select: { firstName: true, lastName: true } },
        },
      })

      for (const signup of signups) {
        await cancelObligationIfUnpaid(tx, "HouseLeagueSignup", signup.id)
      }

      await tx.houseLeague.delete({ where: { id: params.id } })

      return signups
    })

    // Best-effort family notice — one bell + one email per parent, deduped
    // (a parent can have more than one player signed up for the league).
    const byParent = new Map<string, { email: string | null; players: string[] }>()
    for (const signup of cancelledSignups) {
      const entry: { email: string | null; players: string[] } = byParent.get(signup.userId) ?? {
        email: signup.user?.email ?? null,
        players: [],
      }
      entry.players.push(`${signup.player.firstName} ${signup.player.lastName}`)
      byParent.set(signup.userId, entry)
    }

    for (const [userId, { email, players }] of byParent) {
      await notifySafe({
        userId,
        type: "registration_cancelled",
        title: "Registration Cancelled",
        message: `"${league.name}" has been cancelled by the club. Any unpaid fee${players.length > 1 ? "s" : ""} for ${players.join(", ")} ${players.length > 1 ? "have" : "has"} been cancelled.`,
        link: "/payments",
        referenceId: league.id,
        referenceType: "HouseLeague",
      })
      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: `Cancelled — ${league.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <p><strong>${escapeHtml(league.name)}</strong> has been cancelled by the club.</p>
                <p>If you paid through the platform, the club will process your refund. If you paid the club directly (cash or e-transfer), please contact the club about your refund — the platform is not responsible for offline payments.</p>
                ${transactionalFooter(league.tenant?.name)}
              </div>`,
          })
        } catch (mailErr) {
          console.error("House league delete email failed:", email, mailErr)
        }
      }
    }

    return NextResponse.json({ success: true, cancelledSignups: cancelledSignups.length })
  } catch (error) {
    console.error("Delete house league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
