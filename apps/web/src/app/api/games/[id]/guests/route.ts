import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canScoreGame } from "@/lib/scoring/authz"

export const dynamic = "force-dynamic"

const postSchema = z.object({
  teamId: z.string(),
  displayName: z.string().trim().min(2, "Name required").max(60),
  jerseyNumber: z.number().int().min(0).max(99).nullable().optional(),
})

/**
 * Game-day guest players (owner 2026-07-29): name + jersey for ONE game —
 * no account, no roster entry, no invite. Flagged everywhere; excluded from
 * official season stats until linked. Gated by Season.allowGuestPlayers.
 * Authz mirrors scoring: the two playing teams' staff / league / guest
 * scorekeeper token holders manage the game, so we reuse canScoreGame.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guests = await (prisma as any).gameGuestPlayer.findMany({
    where: { gameId: params.id },
    select: { id: true, teamId: true, displayName: true, jerseyNumber: true, linkedPlayerId: true },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ guests })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await (prisma as any).game.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        seasonId: true,
        status: true,
        season: { select: { id: true, allowGuestPlayers: true, leagueId: true } },
      },
    })
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
    if (game.season && game.season.allowGuestPlayers === false) {
      return NextResponse.json(
        { error: "This league does not allow guest players" },
        { status: 403 }
      )
    }
    if (game.status === "COMPLETED") {
      return NextResponse.json({ error: "Game is already finalized" }, { status: 409 })
    }

    const allowed = await canScoreGame(auth.userId, !!auth.isPlatformAdmin, {
      id: game.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      seasonId: game.seasonId ?? null,
    })
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = postSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    if (![game.homeTeamId, game.awayTeamId].includes(parsed.data.teamId)) {
      return NextResponse.json({ error: "Team is not in this game" }, { status: 400 })
    }

    const guest = await (prisma as any).gameGuestPlayer.create({
      data: {
        gameId: params.id,
        teamId: parsed.data.teamId,
        displayName: parsed.data.displayName,
        jerseyNumber: parsed.data.jerseyNumber ?? null,
        addedById: auth.userId,
      },
      select: { id: true, teamId: true, displayName: true, jerseyNumber: true },
    })
    return NextResponse.json({ guest }, { status: 201 })
  } catch (error) {
    console.error("Guest player error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
