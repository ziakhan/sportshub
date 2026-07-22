import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/** Shift a date forward by one calendar year (UTC). */
function plusOneYear(date: Date): Date {
  const next = new Date(date)
  next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}

/**
 * POST /api/camps/[id]/duplicate — Clone a camp into a fresh draft for the
 * next run (program renewal, season-continuity plan §4). Copies every content
 * field, shifts dates +1 year, and always starts unpublished.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const camp = await (prisma as any).camp.findUnique({
      where: { id: params.id },
    })
    if (!camp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Same authz as camp create — role at the camp's tenant.
    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [
          { tenantId: camp.tenantId, role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const clone = await (prisma as any).camp.create({
      data: {
        tenantId: camp.tenantId,
        name: `${camp.name} (copy)`,
        description: camp.description,
        details: camp.details,
        campType: camp.campType,
        ageGroup: camp.ageGroup,
        gender: camp.gender,
        startDate: plusOneYear(camp.startDate),
        endDate: plusOneYear(camp.endDate),
        dailyStartTime: camp.dailyStartTime,
        dailyEndTime: camp.dailyEndTime,
        location: camp.location,
        numberOfWeeks: camp.numberOfWeeks,
        weeklyFee: Number(camp.weeklyFee),
        fullCampFee: camp.fullCampFee !== null ? Number(camp.fullCampFee) : null,
        maxParticipants: camp.maxParticipants,
        includesLunch: camp.includesLunch,
        includesSnacks: camp.includesSnacks,
        includesJersey: camp.includesJersey,
        includesBall: camp.includesBall,
        isPublished: false,
      },
    })

    return NextResponse.json({ id: clone.id }, { status: 201 })
  } catch (error) {
    console.error("Duplicate camp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
