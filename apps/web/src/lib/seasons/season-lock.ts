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
