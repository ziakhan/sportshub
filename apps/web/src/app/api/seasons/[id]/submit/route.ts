import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { submitTeamToSeason } from "@/lib/seasons/submit-team"

export const dynamic = "force-dynamic"

const submitTeamSchema = z.object({
  teamId: z.string(),
  divisionId: z.string(),
  // Optional roster version: which of the club's ACTIVE players go into THIS
  // league. Omitted → whole active roster (legacy behavior).
  playerIds: z.array(z.string()).optional(),
})

/**
 * POST /api/seasons/[id]/submit — Club submits a team to the season.
 * Operator-only (ClubOwner/ClubManager/PlatformAdmin); coaches and team
 * managers go through /api/seasons/[id]/submission-requests instead
 * (owner 2026-07-15: payments hang off submissions, so a club operator
 * approves before anything reaches the league). Validation, snapshotting
 * and notifications live in lib/seasons/submit-team.ts, shared with the
 * approval path.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = submitTeamSchema.parse(body)

    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      select: { id: true, tenantId: true },
    })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId: sessionInfo.userId,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "Only club owners/managers can submit teams — coaches can send the club a registration request instead.",
          code: "NEEDS_CLUB_APPROVAL",
        },
        { status: 403 }
      )
    }

    const result = await submitTeamToSeason({
      seasonId: params.id,
      teamId: data.teamId,
      divisionId: data.divisionId,
      playerIds: data.playerIds,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code, conflicts: result.conflicts },
        { status: result.status }
      )
    }

    return NextResponse.json(
      {
        success: true,
        leagueTeamId: result.submissionId, // keep legacy key for UI compat
        rosterId: result.rosterId,
        playerCount: result.playerCount,
        message: `${result.teamName} submitted with ${result.playerCount} players. Pending league approval.`,
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
