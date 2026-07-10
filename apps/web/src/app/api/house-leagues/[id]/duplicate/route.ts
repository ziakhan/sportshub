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
 * Bump the year in a season label for the next run:
 * "Fall 2026" → "Fall 2027", "Winter 2026-27" → "Winter 2027-28".
 * Labels without a parseable trailing year pass through unchanged.
 */
function bumpSeasonYear(season: string): string {
  const range = season.match(/^(.*?)(\d{4})-(\d{2})$/)
  if (range) {
    const startYear = parseInt(range[2], 10) + 1
    const endYear = (parseInt(range[3], 10) + 1) % 100
    return `${range[1]}${startYear}-${String(endYear).padStart(2, "0")}`
  }
  const single = season.match(/^(.*?)(\d{4})$/)
  if (single) {
    return `${single[1]}${parseInt(single[2], 10) + 1}`
  }
  return season
}

/**
 * POST /api/house-leagues/[id]/duplicate — Clone a house league into a fresh
 * draft for the next run (program renewal, season-continuity plan §4). Copies
 * every content field, shifts dates +1 year, bumps the season label's year,
 * and always starts unpublished.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const league = await (prisma as any).houseLeague.findUnique({
      where: { id: params.id },
    })
    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Same authz as house-league create — role at the league's tenant.
    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [
          { tenantId: league.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const clone = await (prisma as any).houseLeague.create({
      data: {
        tenantId: league.tenantId,
        name: `${league.name} (copy)`,
        description: league.description,
        details: league.details,
        ageGroups: league.ageGroups,
        gender: league.gender,
        season: league.season ? bumpSeasonYear(league.season) : null,
        startDate: plusOneYear(league.startDate),
        endDate: plusOneYear(league.endDate),
        daysOfWeek: league.daysOfWeek,
        startTime: league.startTime,
        endTime: league.endTime,
        location: league.location,
        fee: Number(league.fee),
        maxParticipants: league.maxParticipants,
        includesUniform: league.includesUniform,
        includesJersey: league.includesJersey,
        includesBall: league.includesBall,
        includesMedal: league.includesMedal,
        isPublished: false,
      },
    })

    return NextResponse.json({ id: clone.id }, { status: 201 })
  } catch (error) {
    console.error("Duplicate house league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
