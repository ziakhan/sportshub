import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/house-leagues/[id] — Get single house league
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, currency: true, branding: { select: { primaryColor: true } } },
        },
        _count: { select: { signups: true } },
      },
    })

    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ...league, fee: Number(league.fee) })
  } catch (error) {
    console.error("Get house league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/house-leagues/[id] — Update (including publish/unpublish)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
      select: { tenantId: true },
    })
    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { tenantId: league.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    // Allow updating any field
    const fields = [
      "name", "description", "details", "ageGroup", "gender", "season",
      "daysOfWeek", "startTime", "endTime", "location", "maxParticipants",
      "includesUniform", "includesJersey", "includesBall", "includesMedal", "isPublished",
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
