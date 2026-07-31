import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { findPlacementConflicts } from "@/lib/games/conflicts"
import { publishRealtime, rooms as rt } from "@/lib/realtime/publish"

export const dynamic = "force-dynamic"

const swapSchema = z.object({ gameAId: z.string(), gameBId: z.string() })

const SWAP_FIELDS = [
  "scheduledAt",
  "venueId",
  "courtId",
  "dayId",
  "dayVenueId",
  "sessionId",
] as const

/**
 * POST /api/games/swap — exchange two games' time+place atomically
 * (Schedule Studio P0). One operator action, one transaction: no
 * half-swapped state on screens, no double notification storm. Draft games
 * swap silently; published games notify via the normal game-change path
 * only when the operator later publishes/edits (swap itself is a planning
 * move — the board is where this gets used).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { gameAId, gameBId } = swapSchema.parse(await request.json())
    if (gameAId === gameBId)
      return NextResponse.json({ error: "Pick two different games" }, { status: 400 })

    const games = await (prisma as any).game.findMany({
      where: { id: { in: [gameAId, gameBId] } },
      include: { season: { select: { id: true, leagueId: true, league: { select: { ownerId: true } } } } },
    })
    if (games.length !== 2) return NextResponse.json({ error: "Game not found" }, { status: 404 })
    const [a, b] = games[0].id === gameAId ? games : [games[1], games[0]]

    for (const g of [a, b]) {
      if (g.season?.league?.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      if (!["SCHEDULED", "POSTPONED"].includes(g.status))
        return NextResponse.json(
          { error: `Game ${g.id} is ${g.status} — only upcoming games can swap` },
          { status: 409 }
        )
      if (g.isLocked)
        return NextResponse.json(
          { error: `Game ${g.id} is locked — unlock it to move it`, code: "GAME_LOCKED" },
          { status: 409 }
        )
    }
    if (a.season?.id !== b.season?.id)
      return NextResponse.json({ error: "Games must belong to the same season" }, { status: 400 })

    // Validate both landing spots, ignoring both games themselves.
    const conflicts = [
      ...(await findPlacementConflicts({
        excludeGameIds: [a.id, b.id],
        homeTeamId: a.homeTeamId,
        awayTeamId: a.awayTeamId,
        courtId: b.courtId,
        start: new Date(b.scheduledAt),
        durationMinutes: a.duration ?? 90,
      })),
      ...(await findPlacementConflicts({
        excludeGameIds: [a.id, b.id],
        homeTeamId: b.homeTeamId,
        awayTeamId: b.awayTeamId,
        courtId: a.courtId,
        start: new Date(a.scheduledAt),
        durationMinutes: b.duration ?? 90,
      })),
    ]
    if (conflicts.length > 0) {
      return NextResponse.json({ error: "Swap would double-book", conflicts }, { status: 409 })
    }

    const placeOf = (g: any) => Object.fromEntries(SWAP_FIELDS.map((f) => [f, g[f]]))
    const [updatedA, updatedB] = await (prisma as any).$transaction([
      (prisma as any).game.update({ where: { id: a.id }, data: placeOf(b) }),
      (prisma as any).game.update({ where: { id: b.id }, data: placeOf(a) }),
    ])

    await publishRealtime({
      rooms: [
        rt.game(a.id),
        rt.game(b.id),
        rt.scores,
        ...(a.season?.leagueId ? [rt.leagueScores(a.season.leagueId)] : []),
      ],
      event: "game.update",
      payload: { gameId: a.id, status: a.status },
    })

    return NextResponse.json({ success: true, games: [updatedA, updatedB] })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Game swap error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
