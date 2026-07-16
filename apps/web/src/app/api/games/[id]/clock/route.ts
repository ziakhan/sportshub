import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canScoreGame } from "@/lib/scoring/authz"
import { effectiveClockMode } from "@/lib/scoring/clock-mode"

export const dynamic = "force-dynamic"

const clockSchema = z.object({ useClock: z.boolean() })

/**
 * Pre-game clock choice (owner 2026-07-15): the scorekeeper decides before
 * tip-off whether this game runs the clock. An unoperated clock counts
 * minutes wrongly, so per-game intent beats the league default.
 * GET returns the current effective mode; PATCH sets the override — only
 * while the game is still SCHEDULED.
 */

async function loadGame(id: string) {
  return prisma.game.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      clockEnabled: true,
      homeTeamId: true,
      awayTeamId: true,
      seasonId: true,
      season: { select: { league: { select: { gameClockMode: true } } } },
    },
  })
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const game = await loadGame(params.id)
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({
      clockEnabled: game.clockEnabled,
      effectiveMode: effectiveClockMode(game.clockEnabled, game.season?.league?.gameClockMode),
      leagueMode: game.season?.league?.gameClockMode ?? "SIMPLE",
    })
  } catch (error) {
    console.error("Clock mode read error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await loadGame(params.id)
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (game.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "The clock choice is made before tip-off" },
        { status: 409 }
      )
    }
    if (!(await canScoreGame(sessionInfo.userId, !!sessionInfo.isPlatformAdmin, game as any))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { useClock } = clockSchema.parse(await request.json())
    await prisma.game.update({ where: { id: game.id }, data: { clockEnabled: useClock } })
    return NextResponse.json({
      success: true,
      clockEnabled: useClock,
      effectiveMode: effectiveClockMode(useClock, game.season?.league?.gameClockMode),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error" }, { status: 400 })
    }
    console.error("Clock mode update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
