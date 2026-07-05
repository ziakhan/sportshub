export type SchedSettings = {
  gamesGuaranteed: string
  gamesPerSession: string
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
