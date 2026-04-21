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
 * POST /api/seasons/[id]/submit — Club submits a team to the season.
 * Creates TeamSubmission + SeasonRoster with frozen player snapshot.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = submitTeamSchema.parse(body)

    const season = (await prisma.season.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        registrationDeadline: true,
        teamFee: true,
      } as any,
    })) as any

    if (!season) {
      return NextResponse.json({ error: "League not found" }, { status: 404 })
    }

    if (season.status !== "REGISTRATION") {
      return NextResponse.json(
        { error: "This league is not currently accepting registrations" },
        { status: 400 }
      )
    }

    if (season.registrationDeadline && new Date(season.registrationDeadline) < new Date()) {
      return NextResponse.json({ error: "Registration deadline has passed" }, { status: 400 })
    }

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
      return NextResponse.json(
        { error: "Only club owners/managers can submit teams" },
        { status: 403 }
      )
    }

    const division = await prisma.division.findFirst({
      where: { id: data.divisionId, seasonId: params.id },
      include: {
        _count: {
          select: {
            teamSubmissions: {
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
      const activeTeams = division._count?.teamSubmissions ?? 0
      if (activeTeams >= division.maxTeams) {
        return NextResponse.json(
          {
            error: `Division capacity reached (${division.maxTeams} teams).`,
          },
          { status: 409 }
        )
      }
    }

    const existing = await prisma.teamSubmission.findUnique({
      where: { seasonId_teamId: { seasonId: params.id, teamId: data.teamId } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "This team is already submitted to this league" },
        { status: 409 }
      )
    }

    const teamPlayers = await prisma.teamPlayer.findMany({
      where: { teamId: data.teamId, status: "ACTIVE" },
      include: {
        player: { select: { id: true, firstName: true, lastName: true, position: true } },
      },
    })

    const result = await prisma.$transaction(async (tx: any) => {
      const submission = await tx.teamSubmission.create({
        data: {
          seasonId: params.id,
          teamId: data.teamId,
          divisionId: data.divisionId,
          status: "PENDING",
          registrationFee: season.teamFee ? Number(season.teamFee) : null,
        },
      })

      const roster = await tx.seasonRoster.create({
        data: {
          seasonId: params.id,
          teamSubmissionId: submission.id,
          isLocked: false,
          submittedAt: new Date(),
        },
      })

      if (teamPlayers.length > 0) {
        await tx.seasonRosterPlayer.createMany({
          data: teamPlayers.map((tp: any) => ({
            rosterId: roster.id,
            playerId: tp.playerId,
            jerseyNumber: tp.jerseyNumber,
            position: tp.player.position,
          })),
        })
      }

      return {
        leagueTeamId: submission.id, // keep legacy key for UI compat
        rosterId: roster.id,
        playerCount: teamPlayers.length,
      }
    })

    return NextResponse.json(
      {
        success: true,
        ...result,
        message: `${team.name} submitted with ${result.playerCount} players. Pending league approval.`,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Submit team error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
