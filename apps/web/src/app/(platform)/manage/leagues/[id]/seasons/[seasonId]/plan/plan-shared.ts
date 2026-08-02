import type { WeekendLoad } from "@/lib/scheduler/planner-core"

/**
 * What step 3's two views both need. The board (calendar-step.tsx) and the
 * season strip (season-strip.tsx) show the same calendar two ways, so the
 * armed-chip shape and the tone vocabulary live here once: amber has to mean
 * the same thing whichever view the operator is standing in.
 */

/** A grade picked up and waiting for somewhere to go. */
export interface Armed {
  unitKey: string
  label: string
  fromSessionId: string | null
  /** A grade plays ONE weekend per month window, so it only ever moves
   *  inside the column it is already in. */
  window: string
}

/** A weekend card's fill, by what its courts are doing. */
export const CARD_TONE: Record<WeekendLoad["tone"], string> = {
  over: "border-hoop-300 bg-hoop-50",
  tight: "border-gold-200 bg-gold-50",
  unavailable: "border-ink-200 border-dashed bg-ink-50/70",
  empty: "border-ink-100 bg-white",
  roomy: "border-ink-100 bg-white",
}

/** The demand / capacity readout, wherever it is written. */
export const METER_TONE: Record<WeekendLoad["tone"], string> = {
  over: "text-hoop-800",
  tight: "text-gold-800",
  unavailable: "text-ink-400",
  empty: "text-ink-400",
  roomy: "text-ink-500",
}

export const PILL_TONE = {
  ok: "border-court-200 bg-court-50 text-court-800",
  warn: "border-gold-200 bg-gold-50 text-gold-800",
  bad: "border-hoop-200 bg-hoop-50 text-hoop-800",
}
