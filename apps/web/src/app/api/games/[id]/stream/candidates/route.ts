import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { withAuth, apiError } from "@/lib/api/handler"
import { canScoreGame } from "@/lib/scoring/authz"
import { isSignalFresh } from "@/lib/streaming/health"

export const dynamic = "force-dynamic"

/**
 * GET /api/games/[id]/stream/candidates — the cameras a scorekeeper may pick from
 * (docs/roadmap/live-streaming-plan.md, "The human interaction: scorekeeper
 * confirms by picture").
 *
 * The chooser at the scorer's table asks one question: which camera is showing
 * this floor. To draw it this route serves a channel list, and the operator
 * list (api/admin/streams/channels) is PlatformAdmin-only because it carries
 * ingestUrl + streamKey — the pair that lets anyone push a picture onto a youth
 * game's page. Those two fields never appear here; see the header rule in
 * lib/queries/game-stream.ts before adding a field.
 *
 * Authorization is the placement route's rule, unchanged and not re-invented:
 * PlatformAdmin, or anyone canScoreGame() already trusts with this game. If you
 * may run the scoreboard, you may say which camera is pointing at the floor you
 * are sitting beside.
 *
 * ── TWO SCOPES, ONE RULE ABOUT PICTURES ───────────────────────────────────
 *
 *   (default)     the cameras that could be in this room: unplaced, placed in
 *                 THIS building, or tagged "usually at" this building.
 *   ?scope=all    the whole ACTIVE fleet, for the case the scope exists to
 *                 handle badly: a rig was carried to another building and its
 *                 placement row still says where it used to be.
 *
 * THE SECURITY RULE IS NOT THE SCOPE, IT IS THE PICTURE. `playbackUrl` needs no
 * further authentication and never rotates (plan, S1), so handing the fleet's
 * URLs to everyone canScoreGame() admits — team managers and assistant coaches
 * of either team, a few hundred people on a Saturday — is a permanent window
 * into every gym we film, including leagues that never turned streaming on.
 * That was finding S2. So:
 *
 *   playbackUrl is served if and only if the camera is UNPLACED or PLACED IN
 *   THIS BUILDING. In both scopes. Everything else carries name, building tag,
 *   live state and current placement, and no address.
 *
 * Note what that excludes: a camera TAGGED to this building but standing in
 * another one gets no picture either. The tag says where a rig usually lives,
 * the placement says where it is, and only being here earns a picture.
 *
 * This costs the scorekeeper nothing they had. Confirming by picture only works
 * on pictures of the room you are standing in; a camera in another building
 * cannot be verified by looking at it anyway. What "show all" buys them is the
 * ability to find a rig BY NAME and take it back, which needs no picture at
 * all, and the take-over guard still names any live game it would interrupt.
 */

/** What one row of the chooser needs. No secrets, and no address by default. */
interface CandidateChannel {
  id: string
  name: string
  /** Null unless this camera is unplaced or standing in this building. */
  playbackUrl: string | null
  /** "Usually at" — a finding aid, never a restriction. */
  homeVenueId: string | null
  homeVenueName: string | null
  /** Has a probe seen a picture on it recently? */
  live: boolean
  lastSeenLiveAt: string | null
  /** Where it is standing right now, so the scorekeeper knows what they take. */
  placedCourtId: string | null
  placedCourtName: string | null
  placedVenueId: string | null
  placedVenueName: string | null
  /** It is already on THIS floor: the confirm-by-picture case. */
  placedAtThisCourt: boolean
  /** It is standing somewhere else: picking it takes it off that floor. */
  placedElsewhere: boolean
}

const CANDIDATE_SELECT = {
  id: true,
  name: true,
  playbackUrl: true,
  lastSeenLiveAt: true,
  homeVenueId: true,
  homeVenue: { select: { id: true, name: true } },
  currentCourtId: true,
  currentVenueId: true,
  currentCourt: { select: { id: true, name: true, venue: { select: { id: true, name: true } } } },
  currentVenue: { select: { id: true, name: true } },
} as const

export const GET = withAuth<NextRequest>(async (request, { params }, session) => {
  const gameId = params?.id
  if (!gameId) return apiError(400, "Missing game", "BAD_REQUEST")

  const scope = new URL(request.url).searchParams.get("scope") === "all" ? "all" : "here"

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

  /**
   * The building this game is played in, whichever way its location is
   * recorded. A court always belongs to a venue, so a game that names a court
   * has a building too.
   */
  const venueScopeId = game.venueId ?? game.court?.venue?.id ?? null

  // A game with nowhere to put a camera, or a league that has not opted in,
  // gets an empty list rather than a chooser that cannot place anything.
  const placeable = !!(target.courtId || target.venueId)
  const consented = !!game.season?.league?.streamingEnabled

  /** Unplaced, or standing in this building. See the header: this is the set that earns a picture. */
  const inTheRoom = [
    { currentCourtId: null, currentVenueId: null },
    ...(venueScopeId
      ? [{ currentVenueId: venueScopeId }, { currentCourt: { venueId: venueScopeId } }]
      : []),
  ]

  const rows =
    placeable && consented
      ? await prisma.streamChannel.findMany({
          where: {
            status: "ACTIVE",
            ...(scope === "all"
              ? {}
              : {
                  OR: [
                    ...inTheRoom,
                    // Tagged to this building. Offered because it is very
                    // likely the rig beside the table, and because the
                    // building filter would be empty without it. It earns no
                    // picture unless it is also in the room.
                    ...(venueScopeId ? [{ homeVenueId: venueScopeId }] : []),
                  ],
                }),
          },
          select: CANDIDATE_SELECT,
          orderBy: [{ name: "asc" }],
        })
      : []

  /**
   * The whole fleet's size, so the button can say "Show all 137 cameras"
   * instead of asking someone to tap into the dark. A count is not a leak.
   */
  const fleetCount =
    placeable && consented
      ? scope === "all"
        ? rows.length
        : await prisma.streamChannel.count({ where: { status: "ACTIVE" } })
      : 0

  const now = new Date()

  const channels: CandidateChannel[] = rows.map((channel) => {
    const placedVenueId = channel.currentVenueId ?? channel.currentCourt?.venue?.id ?? null
    const unplaced = !channel.currentCourtId && !channel.currentVenueId
    // The one test that decides whether an address goes out.
    const inThisBuilding = !!venueScopeId && placedVenueId === venueScopeId
    const mayShowPicture = unplaced || inThisBuilding

    const placedAtThisCourt = target.courtId
      ? channel.currentCourtId === target.courtId
      : !!target.venueId && channel.currentVenueId === target.venueId

    return {
      id: channel.id,
      name: channel.name,
      playbackUrl: mayShowPicture ? channel.playbackUrl : null,
      homeVenueId: channel.homeVenueId,
      homeVenueName: channel.homeVenue?.name ?? null,
      live: isSignalFresh(channel.lastSeenLiveAt, now),
      lastSeenLiveAt: channel.lastSeenLiveAt?.toISOString() ?? null,
      placedCourtId: channel.currentCourtId,
      placedCourtName: channel.currentCourt?.name ?? null,
      placedVenueId,
      placedVenueName: channel.currentVenue?.name ?? channel.currentCourt?.venue?.name ?? null,
      placedAtThisCourt,
      placedElsewhere: !unplaced && !placedAtThisCourt,
    }
  })

  return NextResponse.json({
    // Court XOR venue, exactly as placeChannel() takes it. The client posts
    // this straight back, so it must stay one or the other.
    target: {
      ...target,
      courtName: game.court?.name ?? null,
      venueName: game.venue?.name ?? game.court?.venue?.name ?? null,
    },
    // The BUILDING, separately, because a game on a numbered court still has
    // one and the building filter is keyed on it.
    building: venueScopeId
      ? {
          id: venueScopeId,
          name: game.venue?.name ?? game.court?.venue?.name ?? null,
        }
      : null,
    consented,
    scope,
    fleetCount,
    channels,
  })
})
