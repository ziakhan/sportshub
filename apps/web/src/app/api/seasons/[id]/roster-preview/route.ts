import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { findSeasonConflicts } from "@/lib/seasons/roster-selection"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/roster-preview?teamId= — the club's ACTIVE roster
 * with per-player eligibility flags for THIS season (already rostered with
 * another club?). Powers the pick-your-league-version checkboxes.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const teamId = new URL(request.url).searchParams.get("teamId")
    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 })

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tenantId: true },
    })
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })

    if (!auth.isPlatformAdmin) {
      const role = await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          tenantId: team.tenantId,
          role: { in: ["ClubOwner", "ClubManager"] },
        },
        select: { id: true },
      })
      if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const teamPlayers = await prisma.teamPlayer.findMany({
      where: { teamId, status: "ACTIVE" },
      select: {
        playerId: true,
        jerseyNumber: true,
        player: { select: { firstName: true, lastName: true, position: true } },
      },
      orderBy: { jerseyNumber: "asc" },
    })
    const conflicts = await findSeasonConflicts(
      params.id,
      teamId,
      teamPlayers.map((tp: any) => tp.playerId)
    )
    const conflictBy = new Map(conflicts.map((c) => [c.playerId, c]))

    return NextResponse.json({
      players: teamPlayers.map((tp: any) => ({
        playerId: tp.playerId,
        name: `${tp.player.firstName} ${tp.player.lastName}`,
        jerseyNumber: tp.jerseyNumber,
        position: tp.player.position,
        conflict: conflictBy.get(tp.playerId) ?? null,
      })),
    })
  } catch (error) {
    console.error("Roster preview error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
