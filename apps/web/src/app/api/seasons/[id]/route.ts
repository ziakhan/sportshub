import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id] — Get season details (includes league, divisions, team submissions, counts)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      include: {
        league: { select: { id: true, name: true, description: true, ownerId: true } },
        divisions: { orderBy: { ageGroup: "asc" } },
        teamSubmissions: {
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
        _count: { select: { teamSubmissions: true, games: true, sessions: true } },
      },
    })

    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...season,
      teamFee: season.teamFee ? Number(season.teamFee) : null,
      teamSubmissions: season.teamSubmissions.map((t: any) => ({
        ...t,
        registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
      })),
    })
  } catch (error) {
    console.error("Get season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/seasons/[id] — Update season fields (scheduling, pricing, status)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { leagueId: true, league: { select: { ownerId: true } } },
    })
    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isOwner = season.league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const update: Record<string, any> = {}

    if (body.label !== undefined) update.label = body.label
    const passThrough = [
      "type",
      "status",
      "gamesGuaranteed",
      "gameSlotMinutes",
      "gameLengthMinutes",
      "gamePeriods",
      "periodLengthMinutes",
      "targetGamesPerSession",
      "idealGamesPerDayPerTeam",
      "defaultVenueOpenTime",
      "defaultVenueCloseTime",
      "playoffFormat",
      "playoffTeams",
      "philosophy",
      "allowCrossDivisionScheduling",
      "tiebreakerOrder",
    ]
    for (const field of passThrough) {
      if (body[field] !== undefined) update[field] = body[field]
    }
    if (body.teamFee !== undefined) update.teamFee = body.teamFee
    if (body.startDate) update.startDate = new Date(body.startDate)
    if (body.endDate) update.endDate = new Date(body.endDate)
    if (body.registrationDeadline)
      update.registrationDeadline = new Date(body.registrationDeadline)
    if (body.ageGroupCutoffDate) update.ageGroupCutoffDate = new Date(body.ageGroupCutoffDate)

    // Preflight + lock when transitioning to FINALIZED
    if (body.status === "FINALIZED") {
      const preflight = await (prisma as any).season.findUnique({
        where: { id: params.id },
        include: {
          divisions: { select: { id: true } },
          sessions: { select: { id: true } },
          seasonVenues: { select: { id: true } },
          teamSubmissions: { select: { id: true, status: true } },
        },
      })

      const effective = { ...(preflight as any), ...update }
      const missing: string[] = []

      if (!effective.gamesGuaranteed)
        missing.push("Max games per team per season must be set in Scheduling Settings")
      if (!effective.periodLengthMinutes)
        missing.push("Period / half length (minutes) must be set in Scheduling Settings")
      if (preflight.divisions.length === 0)
        missing.push("At least one division is required")
      if (preflight.sessions.length === 0)
        missing.push("At least one game session is required")
      if (preflight.seasonVenues.length === 0)
        missing.push("At least one venue must be assigned")
      const pendingCount = preflight.teamSubmissions.filter(
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

      await (prisma as any).seasonRoster.updateMany({
        where: { seasonId: params.id },
        data: { isLocked: true, lockedAt: new Date() },
      })
    }

    const updated = await (prisma as any).season.update({
      where: { id: params.id },
      data: update,
      include: { league: { select: { id: true, name: true, description: true, ownerId: true } } },
    })

    return NextResponse.json({
      success: true,
      ...updated,
      teamFee: updated.teamFee ? Number(updated.teamFee) : null,
    })
  } catch (error) {
    console.error("Update season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/seasons/[id] — Delete season (only if no games or submissions yet)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: {
        league: { select: { ownerId: true } },
        _count: { select: { games: true, teamSubmissions: true } },
      },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = season.league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (season._count.games > 0 || season._count.teamSubmissions > 0) {
      return NextResponse.json(
        { error: "Cannot delete a season with games or team submissions" },
        { status: 409 }
      )
    }

    await (prisma as any).season.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
