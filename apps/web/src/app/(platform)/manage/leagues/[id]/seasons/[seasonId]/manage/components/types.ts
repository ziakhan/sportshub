export type SchedSettings = {
  gamesGuaranteed: string
  gameLengthMinutes: string
  gameSlotMinutes: string
  gamePeriods: string
  periodLengthMinutes: string
  idealGamesPerDayPerTeam: string
  defaultVenueOpenTime: string
  defaultVenueCloseTime: string
  defaultCourtsPerVenue: string
}

export type PreflightCheck = { label: string; ok: boolean }

export const panelClass =
  "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
export const inputClass =
  "rounded-xl border border-ink-200 px-2 py-1.5 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

/** Season statuses where sessions and rounds are locked because games are
 *  already scheduled or the season is underway. */
export const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

/** "2026-10" -> "October 2026" (or "Oct" when `short` — used in compact
 *  round pickers). Empty string for null/invalid input. */
export function monthAnchorLabel(monthAnchor: string | null | undefined, short = false): string {
  if (!monthAnchor || !/^\d{4}-\d{2}$/.test(monthAnchor)) return ""
  const [y, m] = monthAnchor.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleDateString("en-CA", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
    timeZone: "UTC",
  })
}
