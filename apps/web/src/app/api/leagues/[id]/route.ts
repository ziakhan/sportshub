import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/leagues/[id] — Get league details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const league = await prisma.league.findUnique({
      where: { id: params.id },
      include: {
        divisions: { orderBy: { ageGroup: "asc" } },
        teams: {
          include: {
            team: { select: { id: true, name: true, ageGroup: true, gender: true, tenant: { select: { id: true, name: true, slug: true } } } },
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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Verify ownership
    const isOwner = league.ownerId === session.user.id
    const isAdmin = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: "PlatformAdmin" },
    })
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}

    const fields = [
      "name", "description", "season", "gamesGuaranteed", "gamesPerSession",
      "playoffFormat", "playoffTeams", "leagueStatus",
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }
    if (body.teamFee !== undefined) updateData.teamFee = body.teamFee
    if (body.startDate) updateData.startDate = new Date(body.startDate)
    if (body.endDate) updateData.endDate = new Date(body.endDate)
    if (body.registrationDeadline) updateData.registrationDeadline = new Date(body.registrationDeadline)
    if (body.ageGroupCutoffDate) updateData.ageGroupCutoffDate = new Date(body.ageGroupCutoffDate)

    // If finalizing, lock all rosters
    if (body.leagueStatus === "FINALIZED") {
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
