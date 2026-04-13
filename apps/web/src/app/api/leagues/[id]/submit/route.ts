import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const submitTeamSchema = z.object({
  teamId: z.string(),
  divisionId: z.string(),
})

/**
 * POST /api/leagues/[id]/submit — Club submits a team to the league
 * Creates LeagueTeam + LeagueRoster with frozen player snapshot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = submitTeamSchema.parse(body)

    // Get the league
    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        leagueStatus: true,
        registrationDeadline: true,
        teamFee: true,
      } as any,
    }) as any

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 })
    }

    if (league.leagueStatus !== "REGISTRATION") {
      return NextResponse.json({ error: "This league is not currently accepting registrations" }, { status: 400 })
    }

    if (league.registrationDeadline && new Date(league.registrationDeadline) < new Date()) {
      return NextResponse.json({ error: "Registration deadline has passed" }, { status: 400 })
    }

    // Verify the team exists and user has club access
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      select: { id: true, name: true, tenantId: true },
    })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Only club owners/managers can submit teams" }, { status: 403 })
    }

    // Check division exists
    const division = await prisma.leagueDivision.findFirst({
      where: { id: data.divisionId, leagueId: params.id },
      include: {
        _count: {
          select: {
            teams: {
              where: {
                status: { in: ["PENDING", "APPROVED"] },
              },
            },
          },
        },
      },
    })
    if (!division) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 })
    }

    if (division.maxTeams !== null && division.maxTeams !== undefined) {
      const activeTeams = division._count?.teams ?? 0
      if (activeTeams >= division.maxTeams) {
        return NextResponse.json(
          {
            error: `Division capacity reached (${division.maxTeams} teams).`,
          },
          { status: 409 }
        )
      }
    }

    // Check if team already submitted
    const existing = await prisma.leagueTeam.findUnique({
      where: { leagueId_teamId: { leagueId: params.id, teamId: data.teamId } },
    })
    if (existing) {
      return NextResponse.json({ error: "This team is already submitted to this league" }, { status: 409 })
    }

    // Get current team players for the roster snapshot
    const teamPlayers = await prisma.teamPlayer.findMany({
      where: { teamId: data.teamId, status: "ACTIVE" },
      include: {
        player: { select: { id: true, firstName: true, lastName: true, position: true } },
      },
    })

    // Create LeagueTeam + LeagueRoster + LeagueRosterPlayers in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const leagueTeam = await tx.leagueTeam.create({
        data: {
          leagueId: params.id,
          teamId: data.teamId,
          divisionId: data.divisionId,
          status: "PENDING",
          registrationFee: league.teamFee ? Number(league.teamFee) : null,
        },
      })

      const roster = await (tx as any).leagueRoster.create({
        data: {
          leagueId: params.id,
          leagueTeamId: leagueTeam.id,
          isLocked: false,
          submittedAt: new Date(),
        },
      })

      // Snapshot players
      if (teamPlayers.length > 0) {
        await (tx as any).leagueRosterPlayer.createMany({
          data: teamPlayers.map((tp: any) => ({
            rosterId: roster.id,
            playerId: tp.playerId,
            jerseyNumber: tp.jerseyNumber,
            position: tp.player.position,
          })),
        })
      }

      return { leagueTeamId: leagueTeam.id, rosterId: roster.id, playerCount: teamPlayers.length }
    })

    return NextResponse.json({
      success: true,
      ...result,
      message: `${team.name} submitted with ${result.playerCount} players. Pending league approval.`,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Submit team error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
