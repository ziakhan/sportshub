/**
 * Season status states that lock the structural shape of the season:
 * divisions, venues, sessions, scheduling groups can no longer be added,
 * removed, or have their membership changed once finalized.
 *
 * Tiebreakers lock via the separate `tiebreakersLockedAt` field, set by
 * the finalize transition in `apps/web/src/app/api/seasons/[id]/route.ts`.
 *
 * Cosmetic edits (e.g. renaming a division) are intentionally not gated
 * here — only create/delete/membership routes call `isSeasonLocked`.
 */

export const LOCKED_SEASON_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"] as const

export function isSeasonLocked(status: string | null | undefined): boolean {
  return !!status && (LOCKED_SEASON_STATUSES as readonly string[]).includes(status)
}

export const SEASON_LOCKED_MESSAGE =
  "Season is finalized — divisions, venues, sessions, and scheduling groups can no longer be modified."

/**
 * Single vocabulary for the rest of the season lifecycle. Before these
 * helpers, routes gated on inline literals (`status !== "REGISTRATION"`,
 * `["FINALIZED", "IN_PROGRESS"].includes(...)`) that could silently drift
 * from LOCKED_SEASON_STATUSES.
 */

/** Clubs may submit teams only while registration is open. */
export function canSubmitTeams(status: string | null | undefined): boolean {
  return status === "REGISTRATION"
}

export const SUBMIT_CLOSED_MESSAGE = "This season is not open for registration."

/**
 * The schedule may be generated/committed once the season's structure is
 * locked (finalized) and until it completes — the same statuses that lock
 * structure are the ones that enable scheduling.
 */
export function canCommitSchedule(status: string | null | undefined): boolean {
  return status === "FINALIZED" || status === "IN_PROGRESS"
}

export const COMMIT_NOT_READY_MESSAGE =
  "Season must be finalized before a schedule can be generated or committed."
