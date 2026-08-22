import type {
  StreamOpsAuditEntry,
  StreamOpsGame,
  StreamOpsSchedule,
  StreamOpsVenue,
} from "@/lib/streaming/ops"
import type { ChannelHealth } from "@/lib/streaming/health"

/**
 * The wire shapes this console reads, in one place.
 *
 * Everything except `Channel` is re-exported from the server modules that
 * produce it, so a field that changes there stops compiling here rather than
 * quietly rendering blank. `Channel` is declared rather than imported because
 * its source is the route's own OPERATOR_SELECT (api/admin/streams/channels),
 * which is a prisma select and not an exported type.
 */

export type { StreamOpsAuditEntry, StreamOpsGame, StreamOpsSchedule, StreamOpsVenue, ChannelHealth }

/** GET /api/admin/streams/channels — PlatformAdmin only, secrets included. */
export interface Channel {
  id: string
  name: string
  status: "ACTIVE" | "DISABLED"
  /** Operator secrets. Masked in the UI until a person asks to see them. */
  ingestUrl: string
  streamKey: string
  playbackUrl: string
  provider: string | null
  notes: string | null
  lastSeenLiveAt: string | null
  placedAt: string | null
  placedById: string | null
  currentCourtId: string | null
  currentVenueId: string | null
  currentCourt: { id: string; name: string; venue: { id: string; name: string } } | null
  currentVenue: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

/** The other court's live game, returned with a 409 TAKEOVER_REQUIRED. */
export interface TakeoverConflict {
  channelId: string
  channelName: string
  gameId: string
  scheduledAt: string
  courtId: string | null
  courtName: string | null
  venueId: string | null
  venueName: string | null
  matchup: string | null
}

/** Where a rig is being sent: exactly one of the two, never both. */
export interface PlacementTarget {
  courtId?: string
  venueId?: string
  /** "Court 2, Central Gym" — for the confirmation sentence. */
  label: string
}
