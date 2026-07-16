import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { resolveGuestScorer } from "@/lib/scoring/guest"
import { prisma } from "@youthbasketballhub/db"
import { canScoreGame } from "@/lib/scoring/authz"
import { effectiveClockMode } from "@/lib/scoring/clock-mode"
import { getGameRsvpAbsentees } from "@/lib/rsvp"

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
  // Club roster via the TeamPlayer join (Player has no direct teamId) —
  // the season-less path was previously a crash, caught by the RSVP suite
  const roster = await prisma.teamPlayer.findMany({
    where: { teamId, status: "ACTIVE", player: { deletedAt: null } },
    select: {
      playerId: true,
      jerseyNumber: true,
      player: { select: { firstName: true, lastName: true, jerseyNumber: true } },
    },
  })
  return roster.map((r: any) => ({
    playerId: r.playerId,
    jerseyNumber:
      r.jerseyNumber != null ? String(r.jerseyNumber) : (r.player.jerseyNumber ?? null),
    name: `${r.player.firstName} ${r.player.lastName}`.trim(),
  }))
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let sessionInfo = await getSessionUserId()
    let guestScorer: { name: string; actorUserId: string } | null = null
    if (!sessionInfo) {
      // Guest scorekeeper: game-scoped one-time token (2026-07-15); acts
      // under the delegating operator's identity
      guestScorer = await resolveGuestScorer(request, params.id)
      if (guestScorer) {
        sessionInfo = {
          userId: guestScorer.actorUserId,
          realUserId: guestScorer.actorUserId,
          isPlatformAdmin: false,
        }
      }
    }
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
        clockEnabled: true,
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

    // ?probe=1 — authz-only check ("may this viewer score?") without the
    // roster/event payload. The public live page uses it for its Score button.
    if (new URL(request.url).searchParams.get("probe") === "1") {
      return NextResponse.json({ canScore: true })
    }

    const [homeRoster, awayRoster, rsvpNotGoing, refereeRoles, events] = await Promise.all([
      rosterForTeam(game.seasonId, game.homeTeamId),
      rosterForTeam(game.seasonId, game.awayTeamId),
      getGameRsvpAbsentees(params.id),
      prisma.userRole.findMany({
        where: { gameId: params.id, role: "Referee" },
        select: {
          userId: true,
          user: {
            select: { firstName: true, lastName: true, refereeProfile: { select: { signoffPinHash: true } } },
          },
        },
      }),
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
        gameClockMode: effectiveClockMode((game as any).clockEnabled, league?.gameClockMode),
        periodType: league?.periodType ?? "QUARTERS",
        periodMinutes: league?.periodMinutes ?? 10,
        requireRefereeApproval: league?.requireRefereeApproval ?? false,
      },
      rosters: { home: homeRoster, away: awayRoster },
      // Rostered players whose family RSVP'd Not going — the console
      // pre-marks them absent in the roll call (scorer can still toggle)
      rsvpAbsent: {
        home: homeRoster.filter((p: any) => rsvpNotGoing.has(p.playerId)).map((p: any) => p.playerId),
        away: awayRoster.filter((p: any) => rsvpNotGoing.has(p.playerId)).map((p: any) => p.playerId),
      },
      events: events.map((e: any) => ({
        ...e,
        timestampMs: new Date(e.timestamp).getTime(),
      })),
      lock: {
        sessionId: game.scoringSessionId,
        user: game.scoringSessionUser,
        at: game.scoringSessionAt,
      },
      // Referees assigned to THIS game (UserRole role=Referee gameId) — the
      // PIN sign-off path only offers referees who have set a PIN.
      referees: refereeRoles.map((r: any) => ({
        userId: r.userId,
        name: `${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.trim() || "Referee",
        hasPin: !!r.user?.refereeProfile?.signoffPinHash,
      })),
      me: sessionInfo.userId,
    })
  } catch (error) {
    console.error("Scoring bootstrap error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
