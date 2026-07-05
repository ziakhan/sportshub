import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canScoreGame } from "@/lib/scoring/authz"

export const dynamic = "force-dynamic"

/**
 * POST /api/games/[id]/scoring/lock — single-active-device soft lock.
 * { sessionId, takeover? } — claims the game for this device. Re-POSTing
 * with the same sessionId is the heartbeat. A different device gets 409
 * with the current holder unless it sends takeover:true (visible handoff)
 * or the lock is stale (no heartbeat for 3 minutes).
 */

const lockSchema = z.object({
  sessionId: z.string().min(8),
  takeover: z.boolean().default(false),
})

const STALE_MS = 3 * 60 * 1000

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await (prisma as any).game.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        seasonId: true,
        homeTeamId: true,
        awayTeamId: true,
        status: true,
        scoringSessionId: true,
        scoringSessionUser: true,
        scoringSessionAt: true,
      },
    })
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
    if (!(await canScoreGame(sessionInfo.userId, !!sessionInfo.isPlatformAdmin, game))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { sessionId, takeover } = lockSchema.parse(await request.json())

    const heldByOther =
      game.scoringSessionId &&
      game.scoringSessionId !== sessionId &&
      game.scoringSessionAt &&
      Date.now() - new Date(game.scoringSessionAt).getTime() < STALE_MS

    if (heldByOther && !takeover) {
      return NextResponse.json(
        {
          error: "Game is being scored on another device",
          code: "LOCK_HELD",
          holder: game.scoringSessionUser,
        },
        { status: 409 }
      )
    }

    const holderName = await prisma.user.findUnique({
      where: { id: sessionInfo.userId },
      select: { firstName: true, lastName: true },
    })
    await (prisma as any).game.update({
      where: { id: params.id },
      data: {
        scoringSessionId: sessionId,
        scoringSessionUser:
          `${holderName?.firstName ?? ""} ${holderName?.lastName ?? ""}`.trim() || "scorekeeper",
        scoringSessionAt: new Date(),
      },
    })
    return NextResponse.json({ locked: true, sessionId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Scoring lock error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
