/**
 * When a league may be renewed (owner 2026-08-14: "Renew" was being offered on
 * a league whose season was still being played).
 *
 * Renewing deep-copies a finished season's SETUP into a new DRAFT season one
 * year later (`POST /api/seasons/[id]/clone`). Offering that while a season is
 * still being planned, sold, or played creates a duplicate next season nobody
 * asked for, so the action only exists once the league's calendar is clear:
 * every season it has is COMPLETED.
 *
 * One source of truth for both the league dashboard and the clone route.
 */

/**
 * Season statuses that still have life in them: planned, selling, locked in, or
 * being played. Mirrors `SeasonStatus` in prisma/schema.prisma minus COMPLETED,
 * and matches the "locked / underway" sets used across the season workspace.
 */
export const OPEN_SEASON_STATUSES = [
  "DRAFT",
  "REGISTRATION",
  "REGISTRATION_CLOSED",
  "FINALIZED",
  "IN_PROGRESS",
] as const

export type OpenSeasonStatus = (typeof OPEN_SEASON_STATUSES)[number]

/** True while the season is anything other than COMPLETED. */
export function isSeasonOpen(status: string | null | undefined): boolean {
  return !!status && (OPEN_SEASON_STATUSES as readonly string[]).includes(status)
}

/** True when the league has any season still on the calendar. */
export function hasOpenSeason(seasons: ReadonlyArray<{ status: string }>): boolean {
  return seasons.some((s) => isSeasonOpen(s.status))
}

/**
 * The season a league may renew, or `null` when renewal must stay hidden.
 *
 * `seasons` is expected newest-first, the order every league payload returns
 * (`orderBy: { createdAt: "desc" }`), so the returned season is the most
 * recently finished one.
 */
export function renewableSeason<T extends { status: string }>(
  seasons: ReadonlyArray<T>
): T | null {
  if (hasOpenSeason(seasons)) return null
  return seasons.find((s) => s.status === "COMPLETED") ?? null
}
