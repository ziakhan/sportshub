import { NextRequest, NextResponse } from "next/server"
import { effectiveClockMode } from "@/lib/scoring/clock-mode"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { authOptions } from "@/lib/auth"
import { playerDisplayName } from "@/lib/privacy/names"
import { getViewerScope, isParticipant } from "@/lib/privacy/participants"
import { getSeasonStandings } from "@/lib/queries/standings"
import { aggregateSeasonStats, type SeasonStatLine } from "@/lib/stats/season"

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
    // Plain URL parsing — this route is also exercised with vanilla Requests.
    // Garbage/negative values fall back to 0 (full load); NaN would make
    // Prisma throw a 500.
    const rawSince = Number(new URL(request.url).searchParams.get("sinceSeq") ?? 0)
    const sinceSeq = Number.isFinite(rawSince) && rawSince > 0 ? Math.floor(rawSince) : 0

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
        homeTeam: {
          select: { name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } },
        },
        awayTeam: {
          select: { name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } },
        },
        venue: { select: { id: true, name: true } },
        // POTG rides the header fields so it appears the moment the game
        // finalizes mid-view; the photo never leaves the server without the
        // player's media consent.
        potgPlayerId: true,
        potgPhotoUrl: true,
        potgPlayer: { select: { mediaConsent: true } },
        clockEnabled: true,
        season: {
          select: {
            label: true,
            league: { select: { id: true, name: true, periodType: true, gameClockMode: true } },
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

    // Voids MUTATE existing rows (PATCH /events flips `voided`), so an
    // incremental poll can't see undo/correction of an already-delivered
    // event. Ship the currently-voided sequences with every incremental
    // response; the client reconciles its cached events against this set.
    let voidedSequences: number[] | undefined
    if (sinceSeq > 0) {
      const voided = await (prisma as any).gameEvent.findMany({
        where: { gameId: params.gameId, voided: true, sequence: { lte: sinceSeq } },
        select: { sequence: true },
      })
      voidedSequences = voided.map((v: any) => v.sequence)
    }

    // Player names/jerseys + header context only on the initial load (sinceSeq=0)
    let players: Array<{
      playerId: string
      teamId: string
      name: string
      jerseyNumber: string | null
    }> = []
    let records: Record<string, { record: string; rank: number; divisionName: string }> = {}
    let seasonAverages: Record<string, { gp: number; ppg: number; rpg: number; apg: number }> = {}
    if (sinceSeq === 0) {
      const submissions = await (prisma as any).teamSubmission.findMany({
        where: {
          seasonId: game.seasonId ?? undefined,
          teamId: { in: [game.homeTeamId, game.awayTeamId] },
          status: "APPROVED",
        },
        select: {
          teamId: true,
          roster: {
            select: {
              players: {
                select: {
                  playerId: true,
                  jerseyNumber: true,
                  player: { select: { firstName: true, lastName: true, mediaConsent: true } },
                },
              },
            },
          },
        },
      })
      // Viewer-aware naming: participants (staff, league members, parents of
      // rostered kids) see full names; the anonymous public gets the
      // consent-gated "First L." form — same rule as the leaders page.
      const session = await getServerSession(authOptions).catch(() => null)
      const scope = await getViewerScope((session?.user as any)?.id ?? null)
      const participant =
        isParticipant(scope, { teamId: game.homeTeamId }) ||
        isParticipant(scope, { teamId: game.awayTeamId }) ||
        isParticipant(scope, { leagueId: game.season?.league?.id ?? null })

      players = submissions.flatMap((s: any) =>
        (s.roster?.players ?? []).map((p: any) => ({
          playerId: p.playerId,
          teamId: s.teamId,
          name: playerDisplayName(p.player, participant),
          jerseyNumber: p.jerseyNumber != null ? String(p.jerseyNumber) : null,
        }))
      )

      // W–L record + division rank for the hero (row order IS the ranking)
      if (game.seasonId) {
        const standings = await getSeasonStandings(game.seasonId)
        for (const division of standings?.divisions ?? []) {
          division.rows.forEach((row: any, idx: number) => {
            if (row.teamId === game.homeTeamId || row.teamId === game.awayTeamId) {
              records[row.teamId] = {
                record: `${row.wins}–${row.losses}`,
                rank: idx + 1,
                divisionName: division.divisionName,
              }
            }
          })
        }
      }

      // Season per-game averages: the pre-game page shows rosters with
      // season stats instead of an empty box score (owner decision 2026-07-06)
      if (game.status === "SCHEDULED" && game.seasonId && players.length > 0) {
        const statRows = await (prisma as any).playerStat.findMany({
          where: {
            playerId: { in: players.map((p) => p.playerId) },
            game: { seasonId: game.seasonId, status: "COMPLETED" },
          },
          select: {
            playerId: true,
            gameId: true,
            points: true,
            rebounds: true,
            assists: true,
            steals: true,
            blocks: true,
            turnovers: true,
            fouls: true,
          },
        })
        for (const agg of aggregateSeasonStats(statRows as SeasonStatLine[])) {
          seasonAverages[agg.playerId] = {
            gp: agg.gamesPlayed,
            ppg: agg.ppg,
            rpg: agg.rpg,
            apg: agg.apg,
          }
        }
      }
    }

    return NextResponse.json({
      game: {
        id: game.id,
        seasonId: game.seasonId ?? null,
        status: game.status,
        scheduledAt: game.scheduledAt,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeamName: game.homeTeam.name,
        awayTeamName: game.awayTeam.name,
        homeColor: game.homeTeam.tenant?.branding?.primaryColor ?? null,
        awayColor: game.awayTeam.tenant?.branding?.primaryColor ?? null,
        homeRecord: records[game.homeTeamId] ?? null,
        awayRecord: records[game.awayTeamId] ?? null,
        venueName: game.venue?.name ?? null,
        venueId: game.venue?.id ?? null,
        leagueName: game.season?.league?.name ?? null,
        // League-level clock switch (ClockMode SIMPLE|OFF) — the public page
        // shows a ticking clock only when the league runs one (owner
        // 2026-07-15: many games run on the arena clock instead).
        clockMode: effectiveClockMode((game as any).clockEnabled, game.season?.league?.gameClockMode ?? "OFF"),
        seasonName: game.season?.label ?? null,
        potgPlayerId: game.potgPlayerId ?? null,
        potgPhotoUrl:
          game.potgPlayerId && game.potgPlayer?.mediaConsent === "GRANTED"
            ? (game.potgPhotoUrl ?? null)
            : null,
      },
      events: events.map((e: any) => ({ ...e, timestampMs: new Date(e.timestamp).getTime() })),
      voidedSequences,
      players,
      seasonAverages,
    })
  } catch (error) {
    console.error("Live game read error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
