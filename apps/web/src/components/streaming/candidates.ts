/**
 * The wire shape of GET /api/games/[id]/stream/candidates, in one place.
 *
 * Two client components read it (the scorekeeper's broadcast bar and the
 * camera chooser it opens), so the shape is declared once rather than twice.
 * Every field's meaning, and the one security rule that decides whether
 * `playbackUrl` is present, live in that route's header. Read it before adding
 * anything here.
 */

export interface CandidateChannel {
  id: string
  name: string
  /**
   * NULL is a real answer, not a loading state: a camera standing in another
   * building carries no address. Only cameras that are unplaced or standing in
   * THIS building get one.
   */
  playbackUrl: string | null
  /** "Usually at" — a finding aid, never a restriction on placement. */
  homeVenueId: string | null
  homeVenueName: string | null
  /** A probe saw a picture on it inside the freshness window. */
  live: boolean
  lastSeenLiveAt: string | null
  placedCourtId: string | null
  placedCourtName: string | null
  placedVenueId: string | null
  placedVenueName: string | null
  /** Already standing on this game's floor: the confirm-by-picture case. */
  placedAtThisCourt: boolean
  /** Standing somewhere else: picking it takes it off that floor. */
  placedElsewhere: boolean
}

export interface CandidatesResponse {
  /** Court XOR venue, exactly as the placement endpoint takes it. */
  target: {
    courtId: string | null
    venueId: string | null
    courtName: string | null
    venueName: string | null
  }
  /** The building, which a game on a numbered court still has. */
  building: { id: string; name: string | null } | null
  /** The league turned streaming on. Everything here is hidden when false. */
  consented: boolean
  scope: "here" | "all"
  /** Active cameras in the whole fleet, so "show all" can say the number. */
  fleetCount: number
  channels: CandidateChannel[]
}

/** The other court's live game, returned with a 409 TAKEOVER_REQUIRED. */
export interface TakeoverDetails {
  channelName: string
  courtName: string | null
  venueName: string | null
  matchup: string | null
}

/** A rig pushed off this floor, because a floor holds one camera. */
export interface DisplacedChannel {
  channelId: string
  channelName: string
  unmapped: string[]
}
