import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const camp = await (prisma as any).camp.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true, currency: true, branding: { select: { primaryColor: true } } } },
        _count: { select: { signups: true } },
      },
    })
    if (!camp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({
      ...camp,
      weeklyFee: Number(camp.weeklyFee),
      fullCampFee: camp.fullCampFee ? Number(camp.fullCampFee) : null,
    })
  } catch (error) {
    console.error("Get camp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const camp = await (prisma as any).camp.findUnique({
      where: { id: params.id },
      select: { tenantId: true },
    })
    if (!camp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { tenantId: camp.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    const fields = [
      "name", "description", "details", "campType", "ageGroup", "gender",
      "dailyStartTime", "dailyEndTime", "location", "numberOfWeeks",
      "maxParticipants", "includesLunch", "includesSnacks", "includesJersey",
      "includesBall", "isPublished",
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }
    if (body.weeklyFee !== undefined) updateData.weeklyFee = body.weeklyFee
    if (body.fullCampFee !== undefined) updateData.fullCampFee = body.fullCampFee
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
