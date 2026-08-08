/**
 * Scheduler v2 — shared types.
 *
 * Contract: docs/roadmap/scheduler-v2-requirements-2026-08-08.md
 * Design:   docs/roadmap/scheduler-v2-design-2026-08-08.md
 *
 * The engine is a pure function of WorldSnapshot. The snapshot is
 * JSON-serializable, fully sorted (canonical), and content-hashed; nothing
 * downstream of world.ts performs I/O, reads clocks, or draws randomness.
 */

export interface BurdenWeights {
  /** Zero-gap same-day pair. Forbidden-tier (owner: "should not happen at
   *  all"); priced so repair trades anything else to remove it, and gated
   *  at zero by acceptance test A7. */
  b2b: number
  /** Same-day pair with exactly 1 empty slot (owner prefers 2+). */
  gap1: number
  /** Same-day pair with 5+ empty slots. */
  longGap: number
  /** The weekend's two games on two different dates — equal to longGap by
   *  owner ruling 2026-08-08 ("they are equally bad"). */
  twoDates: number
  styleMiss: number
  windowMiss: number
  early: number
  late: number
}

export const V2_WEIGHTS: BurdenWeights = {
  b2b: 50,
  gap1: 1,
  longGap: 6,
  twoDates: 6,
  styleMiss: 5,
  windowMiss: 6,
  early: 1,
  late: 1,
}

export interface SnapshotConfig {
  slotMinutes: number
  promiseDefault: number
  weights: BurdenWeights
  /** Matchup stickiness: an existing draft pairing at its weekend beats an
   *  otherwise-equal alternative by this much (re-solve minimal change). */
  keepBonus: number
  /** Placement stickiness: a draft's previous position is kept unless a
   *  rival position wins by more than this. */
  keepTheta: number
  courtBuffer: number
}

export interface SnapCourt {
  id: string
  order: number
}

export interface SnapDayVenue {
  dayVenueId: string
  gymId: string
  /** Minutes from midnight, Friday window already applied. */
  openMin: number
  closeMin: number
  courts: SnapCourt[]
}

export interface SnapDay {
  id: string
  /** ISO datetime of local midnight for the playing date. */
  date: string
  /** Local calendar key "yyyy-m-d" — matches blackout dateKeys. */
  dateKey: string
  dow: number
  venues: SnapDayVenue[]
}

export interface SnapWeekend {
  id: string // SeasonSession id
  label: string | null
  order: number // chronological index among REGULAR weekends
  roundId: string | null
  /** Games per team the plan targets for every grade it hosts here. */
  target: number
  days: SnapDay[]
  /** The plan's law (H1): which grade plays in which gym this weekend.
   *  A grade absent from every weekend's hosting list does not play. */
  hosting: Array<{ gradeId: string; gymId: string }>
}

export interface SnapBlackout {
  dateKey: string
  startMin?: number
  endMin?: number
}

export interface SnapWindow {
  dow?: number
  dateKey?: string
  earliestMin?: number
  latestMin?: number
}

export interface SnapTeam {
  id: string // Team.id — the id games reference
  name: string
  gradeId: string
  style: "SAME_DAY" | "SPLIT_DAYS" | null
  blackouts: SnapBlackout[]
  windows: SnapWindow[]
}

export interface SnapGrade {
  id: string // Division id
  name: string
  teamIds: string[] // sorted
}

export type PinState = "PIN" | "DRAFT"

export interface SnapGame {
  id: string
  teamAId: string
  teamBId: string
  weekendId: string | null
  dayId: string | null
  dayVenueId: string | null
  gymId: string | null
  courtId: string | null
  startIso: string
  durationMin: number
  /** PIN = played/live/locked: a constant the solver schedules around.
   *  DRAFT = replaceable, but sticky (keepBonus/keepTheta). */
  state: PinState
}

export interface WorldSnapshot {
  seasonId: string
  config: SnapshotConfig
  weekends: SnapWeekend[]
  grades: SnapGrade[]
  teams: SnapTeam[]
  existingGames: SnapGame[]
}

/* ---------------------------------- audit --------------------------------- */

export type FindingSeverity = "BLOCK" | "WARN" | "INFO"

export interface Finding {
  severity: FindingSeverity
  code:
    | "grade-does-not-fit"
    | "promise-unreachable"
    | "plan-promises-fewer"
    | "day-pileup"
    | "pin-conflict"
    | "pin-outside-hours"
    | "group-split-across-gyms"
    | "no-games-planned"
  weekendId?: string
  gradeId?: string
  gymId?: string
  teamIds?: string[]
  /** The arithmetic the message shows: need X, have Y, short Z, etc. */
  arithmetic: Record<string, number | string>
  message: string
  options: string[]
}

/* --------------------------------- matchups -------------------------------- */

export interface CellGame {
  gradeId: string
  teamAId: string
  teamBId: string
  /** How many times this pair has met before this game (0-based). Drives
   *  home/away alternation and game identity. */
  occurrence: number
  /** A PIN's fixed position; solver never moves it. */
  pinned?: { gameId: string; dayId: string; startIso: string; courtId: string; dayVenueId: string }
}

export interface MatchupCell {
  weekendId: string
  gymId: string
  games: CellGame[]
  /** teamId -> dayIds the team may play (from partial blackouts). Absent =
   *  any day. */
  dayAllow: Record<string, string[]>
}

/* --------------------------------- placement ------------------------------- */

export interface PlacedGame extends CellGame {
  dayId: string
  dayVenueId: string
  courtId: string
  slotIdx: number
  startIso: string
}

export interface PlacedCell {
  weekendId: string
  gymId: string
  games: PlacedGame[]
}

/* --------------------------------- proposal -------------------------------- */

export interface ProposedRow {
  sessionId: string
  dayId: string
  dayVenueId: string
  courtId: string
  venueId: string
  homeTeamId: string
  awayTeamId: string
  scheduledAt: string
  duration: number
}

export type Operation =
  | { op: "update"; gameId: string; row: ProposedRow }
  | { op: "create"; row: ProposedRow }
  | { op: "delete"; gameId: string }

export interface Proposal {
  snapshotHash: string
  proposalHash: string
  operations: Operation[]
  /** Every game of the final schedule (pins included), for reporting. */
  games: Array<ProposedRow & { pinned: boolean }>
  stats: {
    games: number
    created: number
    updated: number
    deleted: number
    unchanged: number
    backToBacks: number
    longGaps: number
    twoDateWeekends: number
    gap1: number
  }
}
