import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/teams/[id]/season-links — which seasons this team is already
 * linked to: live submissions + pending club-approval requests. Used by
 * Browse Leagues to hide leagues the team is already in (owner 2026-07-15).
 * Viewable by the team's staff or the club's operators.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true },
    })
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })

    const role = await prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { teamId: team.id, role: { in: ["Staff", "TeamManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
      select: { id: true },
    })
    if (!role && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [submissions, requests] = await Promise.all([
      prisma.teamSubmission.findMany({
        where: { teamId: team.id, status: { in: ["PENDING", "APPROVED"] } },
        select: { seasonId: true },
      }),
      (prisma as any).teamSubmissionRequest.findMany({
        where: { teamId: team.id, status: "PENDING" },
        select: { seasonId: true },
      }),
    ])

    return NextResponse.json({
      submittedSeasonIds: [...new Set(submissions.map((s: any) => s.seasonId))],
      pendingRequestSeasonIds: [...new Set(requests.map((r: any) => r.seasonId))],
    })
  } catch (error) {
    console.error("Season links error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
