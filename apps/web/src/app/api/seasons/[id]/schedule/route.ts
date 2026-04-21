import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/schedule — list existing Game rows for the season.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const games = await (prisma as any).game.findMany({
      where: { seasonId: params.id },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        court: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    })
    return NextResponse.json({ games })
  } catch (error) {
    console.error("List schedule error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/seasons/[id]/schedule — wipe scheduled regular-season games.
 * Refuses if any game has moved past SCHEDULED.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (
      season.league.ownerId !== sessionInfo.userId &&
      !sessionInfo.isPlatformAdmin
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const nonSchedCount = await (prisma as any).game.count({
      where: {
        seasonId: params.id,
        phase: "REGULAR",
        status: { not: "SCHEDULED" },
      },
    })
    if (nonSchedCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot wipe: ${nonSchedCount} game(s) have moved past SCHEDULED`,
        },
        { status: 409 }
      )
    }

    const del = await (prisma as any).game.deleteMany({
      where: { seasonId: params.id, phase: "REGULAR", status: "SCHEDULED" },
    })
    return NextResponse.json({ success: true, removed: del.count })
  } catch (error) {
    console.error("Delete schedule error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
