import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/live/[gameId] — PUBLIC scoreboard read (allowlisted in
 * public-paths.ts for GET only). Returns the game header, both rosters
 * (names + jerseys), and the non-voided event stream; the page folds it
 * client-side with the same lib/scoring/fold the console uses.
 * Supports ?sinceSeq=N for cheap polling.
 */
export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    // Plain URL parsing — this route is also exercised with vanilla Requests
    const sinceSeq = Number(new URL(request.url).searchParams.get("sinceSeq") ?? 0)

    const game = await (prisma as any).game.findUnique({
      where: { id: params.gameId },
      select: {
        id: true,
        seasonId: true,
        status: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        venue: { select: { name: true } },
        season: {
          select: {
            label: true,
            league: { select: { name: true, periodType: true, gameClockMode: true } },
          },
        },
      },
    })
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })

    const events = await (prisma as any).gameEvent.findMany({
      where: { gameId: params.gameId, sequence: { gt: sinceSeq } },
      orderBy: { sequence: "asc" },
      select: {
        eventType: true,
        teamId: true,
        playerId: true,
        made: true,
        period: true,
        clockSeconds: true,
        sequence: true,
        voided: true,
        timestamp: true,
        metadata: true,
      },
    })

    // Player names/jerseys only on the initial load (sinceSeq=0)
    let players: Array<{ playerId: string; name: string; jerseyNumber: string | null }> = []
    if (sinceSeq === 0) {
      const submissions = await (prisma as any).teamSubmission.findMany({
        where: {
          seasonId: game.seasonId ?? undefined,
          teamId: { in: [game.homeTeamId, game.awayTeamId] },
          status: "APPROVED",
        },
        select: {
          roster: {
            select: {
              players: {
                select: {
                  playerId: true,
                  jerseyNumber: true,
                  player: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      })
      players = submissions.flatMap((s: any) =>
        (s.roster?.players ?? []).map((p: any) => ({
          playerId: p.playerId,
          name: `${p.player.firstName} ${p.player.lastName}`.trim(),
          jerseyNumber: p.jerseyNumber != null ? String(p.jerseyNumber) : null,
        }))
      )
    }

    return NextResponse.json({
      game: {
        id: game.id,
        status: game.status,
        scheduledAt: game.scheduledAt,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeamName: game.homeTeam.name,
        awayTeamName: game.awayTeam.name,
        venueName: game.venue?.name ?? null,
        leagueName: game.season?.league?.name ?? null,
        seasonName: game.season?.label ?? null,
      },
      events: events.map((e: any) => ({ ...e, timestampMs: new Date(e.timestamp).getTime() })),
      players,
    })
  } catch (error) {
    console.error("Live game read error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
