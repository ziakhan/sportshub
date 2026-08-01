import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { removeBlackout } from "@/lib/schedule-requests/blackouts"

export const dynamic = "force-dynamic"

/**
 * DELETE /api/seasons/[id]/teams/[teamId]/blackouts/[blackoutId] —
 * league-side removal. A blackout that came from an approved request keeps
 * the request's APPROVED status (the paper trail stays; the constraint goes).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; teamId: string; blackoutId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const submission = await (prisma as any).teamSubmission.findFirst({
      where: { id: params.teamId, seasonId: params.id },
      select: {
        id: true,
        season: { select: { leagueId: true, league: { select: { ownerId: true } } } },
      },
    })
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const isOwner = submission.season.league.ownerId === auth.userId
    const managerRole = isOwner
      ? null
      : await prisma.userRole.findFirst({
          where: {
            userId: auth.userId,
            leagueId: submission.season.leagueId,
            role: { in: ["LeagueOwner", "LeagueManager"] },
          },
          select: { id: true },
        })
    if (!isOwner && !auth.isPlatformAdmin && !managerRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const result = await removeBlackout({
      submissionId: params.teamId,
      blackoutId: params.blackoutId,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove blackout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
