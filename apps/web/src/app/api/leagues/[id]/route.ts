import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/leagues/[id] — Get league details
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const league = await prisma.league.findUnique({
      where: { id: params.id },
      include: {
        divisions: { orderBy: { ageGroup: "asc" } },
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                ageGroup: true,
                gender: true,
                tenant: { select: { id: true, name: true, slug: true } },
              },
            },
            division: { select: { id: true, name: true } },
          },
        },
        _count: { select: { teams: true, games: true, sessions: true } },
      },
    })

    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...league,
      teamFee: league.teamFee ? Number(league.teamFee) : null,
      teams: league.teams.map((t: any) => ({
        ...t,
        registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
      })),
    })
  } catch (error) {
    console.error("Get league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/leagues/[id] — Update league (including status changes)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Verify ownership (impersonation-aware)
    const isOwner = league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    const fields = [
      "name",
      "description",
      "season",
      "gamesGuaranteed",
      "gamesPerSession",
      "gameSlotMinutes",
      "gameLengthMinutes",
      "gamePeriods",
      "periodLengthMinutes",
      "idealGamesPerDayPerTeam",
      "defaultVenueOpenTime",
      "defaultVenueCloseTime",
      "defaultCourtsPerVenue",
      "playoffFormat",
      "playoffTeams",
      "leagueStatus",
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }
    if (body.teamFee !== undefined) updateData.teamFee = body.teamFee
    if (body.startDate) updateData.startDate = new Date(body.startDate)
    if (body.endDate) updateData.endDate = new Date(body.endDate)
    if (body.registrationDeadline)
      updateData.registrationDeadline = new Date(body.registrationDeadline)
    if (body.ageGroupCutoffDate) updateData.ageGroupCutoffDate = new Date(body.ageGroupCutoffDate)

    // If transitioning to FINALIZED, run preflight checks then lock rosters
    if (body.leagueStatus === "FINALIZED") {
      const preflight = await (prisma as any).league.findUnique({
        where: { id: params.id },
        include: {
          divisions: { select: { id: true } },
          sessions: { select: { id: true } },
          leagueVenues: { select: { id: true } },
          teams: { select: { id: true, status: true } },
        },
      })

      // Merge DB values with values being set in this same request
      const effective = { ...(preflight as any), ...updateData }
      const missing: string[] = []

      if (!effective.gamesGuaranteed)
        missing.push("Max games per team per season must be set in Scheduling Settings")
      if (!effective.periodLengthMinutes)
        missing.push("Period / half length (minutes) must be set in Scheduling Settings")
      if (!effective.defaultCourtsPerVenue)
        missing.push("Default courts per venue must be set in Scheduling Settings")
      if ((preflight as any).divisions.length === 0)
        missing.push("At least one division is required")
      if ((preflight as any).sessions.length === 0)
        missing.push("At least one game session is required")
      if ((preflight as any).leagueVenues.length === 0)
        missing.push("At least one venue must be assigned")
      const pendingCount = (preflight as any).teams.filter(
        (t: any) => t.status === "PENDING"
      ).length
      if (pendingCount > 0)
        missing.push(
          `${pendingCount} team(s) are still pending — approve or reject all teams first`
        )

      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Cannot finalize: requirements not met", missing },
          { status: 422 }
        )
      }

      await (prisma as any).leagueRoster.updateMany({
        where: { leagueId: params.id },
        data: { isLocked: true, lockedAt: new Date() },
      })
    }

    const updated = await prisma.league.update({
      where: { id: params.id },
      data: updateData as any,
    })

    return NextResponse.json({
      success: true,
      ...(updated as any),
      teamFee: (updated as any).teamFee ? Number((updated as any).teamFee) : null,
    })
  } catch (error) {
    console.error("Update league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
