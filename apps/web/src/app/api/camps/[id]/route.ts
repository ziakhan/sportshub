import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicCamp } from "@/lib/queries/camp"
import { getSessionUserId } from "@/lib/auth-helpers"
import { MANAGE_LITE_FIELDS, isAssignedProgramStaff } from "@/lib/programs/staff"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { notifySafe } from "@/lib/notifications"
import { cancelObligationIfUnpaid } from "@/lib/payments/obligations"
import { sendEmail, escapeHtml, transactionalFooter } from "@/lib/email"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const camp = await getPublicCamp(params.id)
    if (!camp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(camp)
  } catch (error) {
    console.error("Get camp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const camp = await (prisma as any).camp.findUnique({
      where: { id: params.id },
      select: { tenantId: true },
    })
    if (!camp) {
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
          tenantId: camp.tenantId,
          role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
        },
        select: { id: true },
      }))
    if (!isAdmin) {
      const assigned = await isAssignedProgramStaff(auth.userId, "CAMP", params.id)
      if (!assigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const blocked = Object.keys(body).filter(
        (k) => body[k] !== undefined && !MANAGE_LITE_FIELDS.CAMP.has(k)
      )
      if (blocked.length > 0) {
        return NextResponse.json(
          { error: `Program staff can't change: ${blocked.join(", ")}` },
          { status: 403 }
        )
      }
    }
    const updateData: Record<string, any> = {}

    const fields = [
      "name",
      "description",
      "details",
      "campType",
      "ageGroup",
      "agePolicy",
      "gender",
      "dailyStartTime",
      "dailyEndTime",
      "location",
      "numberOfWeeks",
      "maxParticipants",
      "includesLunch",
      "includesSnacks",
      "includesJersey",
      "includesBall",
      "isPublished",
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }
    if (body.weeklyFee !== undefined) updateData.weeklyFee = body.weeklyFee
    if (body.fullCampFee !== undefined) updateData.fullCampFee = body.fullCampFee
    if (body.venueId !== undefined) updateData.venueId = body.venueId || null
    if (body.startDate) updateData.startDate = new Date(body.startDate)
    if (body.endDate) updateData.endDate = new Date(body.endDate)

    const updated = await (prisma as any).camp.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      ...updated,
      weeklyFee: Number(updated.weeklyFee),
      fullCampFee: updated.fullCampFee ? Number(updated.fullCampFee) : null,
    })
  } catch (error) {
    console.error("Update camp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Delete a camp
 * DELETE /api/camps/[id]
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

    const camp = await (prisma as any).camp.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        tenant: { select: { name: true } },
      },
    })
    if (!camp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (!(await isClubAdmin(auth.userId, camp.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cancelledSignups = await prisma.$transaction(async (tx: any) => {
      const signups = await tx.campSignup.findMany({
        where: { campId: params.id, status: { not: "CANCELLED" } },
        select: {
          id: true,
          userId: true,
          user: { select: { email: true } },
          player: { select: { firstName: true, lastName: true } },
        },
      })

      for (const signup of signups) {
        await cancelObligationIfUnpaid(tx, "CampSignup", signup.id)
      }

      await tx.camp.delete({ where: { id: params.id } })

      return signups
    })

    // Best-effort family notice — one bell + one email per parent, deduped
    // (a parent can have more than one player signed up for the camp).
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
        message: `"${camp.name}" has been cancelled by the club. Any unpaid fee${players.length > 1 ? "s" : ""} for ${players.join(", ")} ${players.length > 1 ? "have" : "has"} been cancelled.`,
        link: "/payments",
        referenceId: camp.id,
        referenceType: "Camp",
      })
      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: `Cancelled — ${camp.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <p><strong>${escapeHtml(camp.name)}</strong> has been cancelled by the club.</p>
                <p>If you paid through the platform, the club will process your refund. If you paid the club directly (cash or e-transfer), please contact the club about your refund — the platform is not responsible for offline payments.</p>
                ${transactionalFooter(camp.tenant?.name)}
              </div>`,
          })
        } catch (mailErr) {
          console.error("Camp delete email failed:", email, mailErr)
        }
      }
    }

    return NextResponse.json({ success: true, cancelledSignups: cancelledSignups.length })
  } catch (error) {
    console.error("Delete camp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
