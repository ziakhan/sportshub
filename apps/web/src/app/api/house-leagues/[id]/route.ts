import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicHouseLeague } from "@/lib/queries/house-league"
import { getSessionUserId } from "@/lib/auth-helpers"
import { MANAGE_LITE_FIELDS, isAssignedProgramStaff } from "@/lib/programs/staff"

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
