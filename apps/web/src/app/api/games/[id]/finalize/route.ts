import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { canScoreGame } from "@/lib/scoring/authz"
import { foldEvents, totalRebounds, type FoldEvent } from "@/lib/scoring/fold"

export const dynamic = "force-dynamic"

/**
 * POST /api/games/[id]/finalize — fold the event stream server-side, write
 * the final score + PlayerStat rows, and mark the game COMPLETED (which is
 * what the standings engine consumes). Re-finalizing a COMPLETED game (the
 * corrections path: void/add events, then re-run) is restricted to the
 * league owner or a platform admin.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
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
        season: { select: { league: { select: { ownerId: true } } } },
      },
    })
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
    if (!(await canScoreGame(sessionInfo.userId, !!sessionInfo.isPlatformAdmin, game))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (["CANCELLED", "POSTPONED", "DEFAULTED"].includes(game.status)) {
      return NextResponse.json(
        { error: `A ${game.status} game cannot be finalized`, code: "NOT_FINALIZABLE" },
        { status: 400 }
      )
    }
    if (game.status === "COMPLETED") {
      const isLeagueOwner = game.season?.league?.ownerId === sessionInfo.userId
      if (!isLeagueOwner && !sessionInfo.isPlatformAdmin) {
        return NextResponse.json(
          { error: "Only the league owner can re-finalize a completed game", code: "ALREADY_FINAL" },
          { status: 403 }
        )
      }
    }

    const rows = await (prisma as any).gameEvent.findMany({
      where: { gameId: params.id },
      orderBy: { sequence: "asc" },
    })
    const events: FoldEvent[] = rows.map((e: any) => ({
      eventType: e.eventType,
      teamId: e.teamId,
      playerId: e.playerId,
      made: e.made,
      period: e.period,
      clockSeconds: e.clockSeconds,
      voided: e.voided,
      sequence: e.sequence,
      timestampMs: new Date(e.timestamp).getTime(),
      metadata: e.metadata ?? null,
    }))
    if (events.filter((e) => !e.voided).length === 0) {
      return NextResponse.json(
        { error: "No events recorded — nothing to finalize", code: "NO_EVENTS" },
        { status: 400 }
      )
    }

    const folded = foldEvents(events, {
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
    })

    const lines = Object.values(folded.players)
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.game.update({
        where: { id: params.id },
        data: {
          homeScore: folded.homeScore,
          awayScore: folded.awayScore,
          status: "COMPLETED",
          finalizedAt: new Date(),
          scoringSessionId: null,
          scoringSessionUser: null,
          scoringSessionAt: null,
        },
      })
      // Recompute-from-scratch semantics: stats rows mirror the fold exactly
      await tx.playerStat.deleteMany({ where: { gameId: params.id } })
      if (lines.length > 0) {
        await tx.playerStat.createMany({
          data: lines.map((l) => ({
            gameId: params.id,
            playerId: l.playerId,
            points: l.points,
            rebounds: totalRebounds(l),
            assists: l.assists,
            steals: l.steals,
            blocks: l.blocks,
            turnovers: l.turnovers,
            fouls: l.fouls,
            minutesPlayed: l.secondsPlayed > 0 ? Math.round(l.secondsPlayed / 60) : null,
          })),
        })
      }
    })

    return NextResponse.json({
      success: true,
      homeScore: folded.homeScore,
      awayScore: folded.awayScore,
      playerLines: lines.length,
    })
  } catch (error) {
    console.error("Finalize game error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
