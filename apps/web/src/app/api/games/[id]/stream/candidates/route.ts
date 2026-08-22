import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { withAuth, apiError } from "@/lib/api/handler"
import { canScoreGame } from "@/lib/scoring/authz"

export const dynamic = "force-dynamic"

/**
 * GET /api/games/[id]/stream/candidates — the pictures a scorekeeper may pick from
 * (docs/roadmap/live-streaming-plan.md, "The human interaction: scorekeeper
 * confirms by picture").
 *
 * The strip at the scorer's table shows a grid of live preview tiles and asks
 * "tap the one showing your court". To draw that grid it needs a channel list,
 * and the operator list (api/admin/streams/channels) is PlatformAdmin-only
 * because it serves ingestUrl + streamKey — the pair that lets anyone push a
 * picture onto a youth game's page. So this route exists instead, and it
 * carries FOUR fields per channel and no more:
 *
 *   { id, name, playbackUrl, placedAtThisCourt }
 *
 * playbackUrl is the viewer-safe URL (the same one the game page already
 * hands every signed-in family). The secrets appear in exactly one
 * PlatformAdmin route and this is not it — see the header rule in
 * lib/queries/game-stream.ts before adding a field here.
 *
 * Authorization is the placement route's rule, unchanged and not re-invented:
 * PlatformAdmin, or anyone canScoreGame() already trusts with this game. If
 * you may run the scoreboard, you may say which camera is pointing at the
 * floor you are sitting beside.
 */

export const GET = withAuth<NextRequest>(async (_request, { params }, session) => {
  const gameId = params?.id
  if (!gameId) return apiError(400, "Missing game", "BAD_REQUEST")

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      seasonId: true,
      courtId: true,
      venueId: true,
      court: { select: { id: true, name: true, venue: { select: { id: true, name: true } } } },
      venue: { select: { id: true, name: true } },
      season: { select: { league: { select: { streamingEnabled: true } } } },
    },
  })
  if (!game) return apiError(404, "Game not found", "NOT_FOUND")

  const allowed = await canScoreGame(session.userId, session.isPlatformAdmin, {
    id: game.id,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    seasonId: game.seasonId,
  })
  if (!allowed) {
    return apiError(403, "Only the people scoring this game can move its camera", "FORBIDDEN")
  }

  /**
   * Where a placement for THIS game would land, in the same court-XOR-venue
   * terms placeChannel() takes: a numbered court if the game names one, else
   * the building (single-court gyms and court-less schedules).
   */
  const target = game.courtId
    ? { courtId: game.courtId, venueId: null }
    : game.venueId
      ? { courtId: null, venueId: game.venueId }
      : { courtId: null, venueId: null }

  // A game with nowhere to put a camera, or a league that has not opted in,
  // gets an empty list rather than a grid of tiles that cannot be tapped.
  const placeable = !!(target.courtId || target.venueId)
  const consented = !!game.season?.league?.streamingEnabled

  const channels =
    placeable && consented
      ? await prisma.streamChannel.findMany({
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            playbackUrl: true,
            currentCourtId: true,
            currentVenueId: true,
          },
          orderBy: [{ name: "asc" }],
        })
      : []

  return NextResponse.json({
    target: {
      ...target,
      courtName: game.court?.name ?? null,
      venueName: game.venue?.name ?? game.court?.venue?.name ?? null,
    },
    consented,
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      playbackUrl: channel.playbackUrl,
      placedAtThisCourt: target.courtId
        ? channel.currentCourtId === target.courtId
        : channel.currentVenueId === target.venueId,
    })),
  })
})
