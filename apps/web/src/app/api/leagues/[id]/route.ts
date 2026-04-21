import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/leagues/[id] — Get season details (Phase 0: [id] is a Season.id)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const season = await prisma.season.findUnique({
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

    const { league, teamSubmissions, _count, ...rest } = season as any
    return NextResponse.json({
      ...rest,
      id: season.id,
      name: league?.name,
      description: league?.description,
      ownerId: league?.ownerId,
      leagueId: league?.id,
      season: season.label,
      leagueStatus: season.status,
      teamFee: season.teamFee ? Number(season.teamFee) : null,
      teams: teamSubmissions.map((t: any) => ({
        ...t,
        leagueId: season.id,
        registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
      })),
      _count: { teams: _count.teamSubmissions, games: _count.games, sessions: _count.sessions },
    })
  } catch (error) {
    console.error("Get league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/leagues/[id] — Update season (Phase 0: [id] is a Season.id)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
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
    const seasonUpdate: Record<string, any> = {}
    const leagueUpdate: Record<string, any> = {}

    // League-level fields (persistent entity)
    if (body.name !== undefined) leagueUpdate.name = body.name
    if (body.description !== undefined) leagueUpdate.description = body.description

    // Season-level fields
    if (body.season !== undefined) seasonUpdate.label = body.season
    const seasonFields = [
      "gamesGuaranteed",
      "gameSlotMinutes",
      "gameLengthMinutes",
      "gamePeriods",
      "periodLengthMinutes",
      "idealGamesPerDayPerTeam",
      "defaultVenueOpenTime",
      "defaultVenueCloseTime",
      "playoffFormat",
      "playoffTeams",
    ]
    for (const field of seasonFields) {
      if (body[field] !== undefined) seasonUpdate[field] = body[field]
    }
    if (body.gamesPerSession !== undefined) seasonUpdate.targetGamesPerSession = body.gamesPerSession
    if (body.leagueStatus !== undefined) seasonUpdate.status = body.leagueStatus
    if (body.teamFee !== undefined) seasonUpdate.teamFee = body.teamFee
    if (body.startDate) seasonUpdate.startDate = new Date(body.startDate)
    if (body.endDate) seasonUpdate.endDate = new Date(body.endDate)
    if (body.registrationDeadline)
      seasonUpdate.registrationDeadline = new Date(body.registrationDeadline)
    if (body.ageGroupCutoffDate) seasonUpdate.ageGroupCutoffDate = new Date(body.ageGroupCutoffDate)

    // If transitioning to FINALIZED, run preflight checks then lock rosters
    if (body.leagueStatus === "FINALIZED") {
      const preflight = await (prisma as any).season.findUnique({
        where: { id: params.id },
        include: {
          divisions: { select: { id: true } },
          sessions: { select: { id: true } },
          seasonVenues: { select: { id: true } },
          teamSubmissions: { select: { id: true, status: true } },
        },
      })

      const effective = { ...(preflight as any), ...seasonUpdate }
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

    const updated = await prisma.$transaction(async (tx: any) => {
      if (Object.keys(leagueUpdate).length > 0) {
        await tx.league.update({ where: { id: season.leagueId }, data: leagueUpdate })
      }
      return tx.season.update({
        where: { id: params.id },
        data: seasonUpdate,
        include: { league: { select: { name: true, description: true, ownerId: true, id: true } } },
      })
    })

    return NextResponse.json({
      success: true,
      ...(updated as any),
      name: updated.league?.name,
      description: updated.league?.description,
      ownerId: updated.league?.ownerId,
      leagueId: updated.league?.id,
      season: updated.label,
      leagueStatus: updated.status,
      teamFee: updated.teamFee ? Number(updated.teamFee) : null,
    })
  } catch (error) {
    console.error("Update league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
