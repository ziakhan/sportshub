import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { canScoreGame } from "@/lib/scoring/authz"

export const dynamic = "force-dynamic"

/**
 * GET /api/games/[id]/scoring — scoring-console bootstrap: the game, league
 * scoring config, both rosters (season roster with jerseys; falls back to
 * the club's player list), all events, and the device-lock state. The
 * console loads this once pre-game and can then run fully offline.
 */

async function rosterForTeam(seasonId: string | null, teamId: string) {
  if (seasonId) {
    const submission = await (prisma as any).teamSubmission.findFirst({
      where: { seasonId, teamId, status: "APPROVED" },
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
    const players = submission?.roster?.players ?? []
    if (players.length > 0) {
      return players.map((p: any) => ({
        playerId: p.playerId,
        jerseyNumber: p.jerseyNumber != null ? String(p.jerseyNumber) : null,
        name: `${p.player.firstName} ${p.player.lastName}`.trim(),
      }))
    }
  }
  const players = await prisma.player.findMany({
    where: { teamId, deletedAt: null } as any,
    select: { id: true, firstName: true, lastName: true, jerseyNumber: true },
  })
  return players.map((p: any) => ({
    playerId: p.id,
    jerseyNumber: p.jerseyNumber ?? null,
    name: `${p.firstName} ${p.lastName}`.trim(),
  }))
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await (prisma as any).game.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        seasonId: true,
        status: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
        scoringSessionId: true,
        scoringSessionUser: true,
        scoringSessionAt: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        venue: { select: { name: true } },
        season: {
          select: {
            label: true,
            league: {
              select: {
                id: true,
                name: true,
                statDepth: true,
                gameClockMode: true,
                periodType: true,
                periodMinutes: true,
                requireRefereeApproval: true,
              },
            },
          },
        },
      },
    })
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })

    if (!(await canScoreGame(sessionInfo.userId, !!sessionInfo.isPlatformAdmin, game))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [homeRoster, awayRoster, events] = await Promise.all([
      rosterForTeam(game.seasonId, game.homeTeamId),
      rosterForTeam(game.seasonId, game.awayTeamId),
      (prisma as any).gameEvent.findMany({
        where: { gameId: params.id },
        orderBy: { sequence: "asc" },
        select: {
          eventType: true,
          teamId: true,
          playerId: true,
          made: true,
          period: true,
          clockSeconds: true,
          sequence: true,
          clientEventId: true,
          voided: true,
          timestamp: true,
          metadata: true,
        },
      }),
    ])

    const league = game.season?.league ?? null
    return NextResponse.json({
      game: {
        id: game.id,
        status: game.status,
        scheduledAt: game.scheduledAt,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        finalizedAt: game.finalizedAt,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        venueName: game.venue?.name ?? null,
        seasonName: game.season?.label ?? null,
        leagueName: league?.name ?? null,
      },
      config: {
        statDepth: league?.statDepth ?? "STANDARD",
        gameClockMode: league?.gameClockMode ?? "SIMPLE",
        periodType: league?.periodType ?? "QUARTERS",
        periodMinutes: league?.periodMinutes ?? 10,
        requireRefereeApproval: league?.requireRefereeApproval ?? false,
      },
      rosters: { home: homeRoster, away: awayRoster },
      events: events.map((e: any) => ({
        ...e,
        timestampMs: new Date(e.timestamp).getTime(),
      })),
      lock: {
        sessionId: game.scoringSessionId,
        user: game.scoringSessionUser,
        at: game.scoringSessionAt,
      },
      me: sessionInfo.userId,
    })
  } catch (error) {
    console.error("Scoring bootstrap error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
