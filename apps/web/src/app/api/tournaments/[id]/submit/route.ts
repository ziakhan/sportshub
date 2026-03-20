import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const submitTeamSchema = z.object({
  teamId: z.string(),
  divisionId: z.string(),
})

/**
 * POST /api/tournaments/[id]/submit — Club submits a team to the tournament
 * Creates TournamentTeam with status PENDING
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = submitTeamSchema.parse(body)

    // Get the tournament
    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        registrationDeadline: true,
        teamFee: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
    }

    if (tournament.status !== "REGISTRATION") {
      return NextResponse.json({ error: "This tournament is not currently accepting registrations" }, { status: 400 })
    }

    if (tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()) {
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
        userId: sessionInfo.userId,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] as any } },
          { role: "PlatformAdmin" as any },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Only club owners/managers can submit teams" }, { status: 403 })
    }

    // Check division exists and belongs to this tournament
    const division = await (prisma as any).tournamentDivision.findFirst({
      where: { id: data.divisionId, tournamentId: params.id },
    })
    if (!division) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 })
    }

    // Check if team already submitted
    const existing = await (prisma as any).tournamentTeam.findUnique({
      where: { tournamentId_teamId: { tournamentId: params.id, teamId: data.teamId } },
    })
    if (existing) {
      return NextResponse.json({ error: "This team is already submitted to this tournament" }, { status: 409 })
    }

    // Create TournamentTeam with PENDING status
    const tournamentTeam = await (prisma as any).tournamentTeam.create({
      data: {
        tournamentId: params.id,
        teamId: data.teamId,
        divisionId: data.divisionId,
        status: "PENDING",
        registrationFee: tournament.teamFee ? Number(tournament.teamFee) : null,
      },
    })

    return NextResponse.json({
      success: true,
      tournamentTeamId: tournamentTeam.id,
      message: `${team.name} submitted to tournament. Pending approval.`,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Submit tournament team error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
