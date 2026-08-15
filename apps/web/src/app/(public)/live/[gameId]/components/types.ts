import type { FoldEvent, PlayerLine } from "@/lib/scoring/fold"

/**
 * Wire + view types for the public live game page (R2 split, 2026-08-14).
 * The payload shape is EXACTLY what /api/live/[gameId] returns — this file
 * only moved it out of live-view.tsx, nothing was added or renamed.
 */

export interface LivePlayer {
  playerId: string
  teamId: string
  name: string
  jerseyNumber: string | null
  /** Head shot, already consent-gated by the API. Null = draw the mug. */
  photoUrl?: string | null
}

export interface TeamRecord {
  record: string
  rank: number
  divisionName: string
}

export interface LivePayload {
  game: {
    id: string
    status: string
    scheduledAt: string
    homeScore: number | null
    awayScore: number | null
    homeTeamId: string
    awayTeamId: string
    seasonId?: string | null
    homeTeamName: string
    awayTeamName: string
    homeColor: string | null
    awayColor: string | null
    homeRecord: TeamRecord | null
    awayRecord: TeamRecord | null
    venueName: string | null
    venueId: string | null
    leagueName: string | null
    clockMode?: "SIMPLE" | "OFF"
    seasonName: string | null
    potgPlayerId?: string | null
    /** Only present when the player's media consent allows it */
    potgPhotoUrl?: string | null
  }
  events: FoldEvent[]
  /** Incremental polls only: sequences ≤ sinceSeq that are currently voided. */
  voidedSequences?: number[]
  players: LivePlayer[]
  seasonAverages: Record<string, { gp: number; ppg: number; rpg: number; apg: number }>
  /** Initial load only: the viewer's own players (kids / 13+ self) */
  viewerPlayerIds?: string[]
}

/**
 * Tabs are REAL at every width as of 2026-08-13. They used to be phone-only
 * (`lg:hidden`), so desktop rendered every panel at once and the layout had
 * to cram them into escalating grids. ESPN's box score doesn't do that: one
 * focused view at a time, each owning the full width.
 */
export type Tab = "game" | "team" | "plays"

export interface LeaderEntry {
  l: PlayerLine
  value: number
  unit: string
}

export interface LeaderSection {
  label: string
  unit: string
  pick: (teamId: string) => LeaderEntry | null
  sub: (l: PlayerLine) => string
}

/** One play-by-play line: the event, the running score, the merged follow-up. */
export interface PlayRow {
  e: FoldEvent
  score: string | null
  tail: string | null
}
