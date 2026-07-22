import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicCamp } from "@/lib/queries/camp"
import { getSessionUserId } from "@/lib/auth-helpers"
import { MANAGE_LITE_FIELDS, isAssignedProgramStaff } from "@/lib/programs/staff"

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
