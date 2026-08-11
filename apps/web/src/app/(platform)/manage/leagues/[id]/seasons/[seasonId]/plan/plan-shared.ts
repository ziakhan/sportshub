import type { WeekendLoad, WeekendTone } from "@/lib/scheduler/planner-core"
import {
  seasonVenueOrder,
  venueHueSlots,
  type StripVenue,
  type StripWeekendLike,
  type VenueGridLike,
} from "@/lib/seasons/venue-strip"

/**
 * What step 3's two views both need. The board (calendar-step.tsx) and the
 * season strip (season-strip.tsx) show the same calendar two ways, so the
 * armed-chip shape, the tone vocabulary and the gym colours live here once:
 * amber has to mean the same thing whichever view the operator is standing in,
 * and a gym has to be the same colour in both.
 */

/**
 * THE THREE BUTTONS THIS WIZARD HAS (owner ruling 2026-08-06, after two sweeps
 * failed to reach him).
 *
 * The last pass gave every control a solid border and a dark label and left the
 * BACKGROUND white. On a screen of white cards that is still a label: the eye
 * has nothing to catch, and the owner walked past the bookings picker twice.
 * The repo's design CLI says the same thing twice over — 4.5:1 minimum contrast,
 * and never carry meaning on a hairline alone — so the fix is real colour, not
 * a heavier grey.
 *
 * `play` is the action colour (indigo 600/700), which is what the CLI's own
 * SaaS palette recommends and what this product already uses for its verbs.
 * Three levels, and every actionable control on steps 1 to 3 is one of them:
 *
 *  - PRIMARY: filled indigo, white label. The one thing to do on this screen.
 *  - SECONDARY: white, INDIGO border and INDIGO label. Unmistakably pressable,
 *    still quieter than the primary. This is what a grey-bordered white button
 *    should have been.
 *  - QUIET: for rows of small verbs that must not shout, but still carries an
 *    ink border and a dark label, never grey-on-grey.
 *
 * All three: cursor-pointer, a real hover, a transition, and a disabled state
 * the CLI asks for by name (opacity + not-allowed).
 */
const BTN_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"

export const BTN_PRIMARY = `${BTN_BASE} border-play-700 bg-play-600 text-white shadow-sm hover:bg-play-700 hover:border-play-800`
export const BTN_SECONDARY = `${BTN_BASE} border-play-300 bg-white text-play-700 shadow-sm hover:bg-play-50 hover:border-play-500`
export const BTN_QUIET = `${BTN_BASE} border-ink-300 bg-white text-ink-700 shadow-sm hover:bg-ink-50 hover:border-ink-400 hover:text-ink-900`

/** The sizes those three come in, so a row of verbs lines up. */
export const BTN_SM = "min-h-[32px] px-2.5 text-[11.5px]"
export const BTN_MD = "min-h-[36px] px-3 text-[12.5px]"
export const BTN_LG = "min-h-[44px] px-4 text-[13.5px]"

/** A grade picked up and waiting for somewhere to go. */
export interface Armed {
  unitKey: string
  label: string
  fromSessionId: string | null
  /** A grade plays ONE weekend per month window, so it only ever moves
   *  inside the column it is already in. */
  window: string
}

/**
 * A whole rental block picked up, looking for a lighter weekend (owner ruling
 * 2026-08-04). The second half of the two-choice prompt a stranded block asks:
 * the cohorts travel together, because the block is the thing with nowhere to
 * play, and they can only land inside their own month.
 */
export interface ArmedBlock {
  sessionId: string
  unitKeys: string[]
  window: string
  label: string
}

/**
 * A WHOLE GYM SECTION PICKED UP (owner-approved suggestion 2026-08-05, #4). The
 * grades under one building on one weekend, moved as ONE action: onto another
 * gym on the same weekend, or onto another weekend of the same month. Dragged by
 * its grip for a mouse, armed by a tap for a thumb — the same two ways
 * everything else on this board moves.
 */
export interface ArmedSection {
  sessionId: string
  /** The building they are in now. */
  venueId: string
  unitKeys: string[]
  window: string
  /** The gym in the words the board uses, for the line that says what is armed. */
  gym: string
  /** The weekend, for the same line. */
  weekendLabel: string
}

/**
 * WHERE IT WAS, AND WHERE IT WENT (owner re-ruling 2026-08-05, #2). A grade that
 * left keeps a dashed hoop-red slot behind it naming its destination, because a
 * move whose origin says nothing is a move an operator has to reconstruct from
 * memory. It has no clock on it: it stands until the next interaction with the
 * board or an Undo, whichever comes first. Four seconds was not long enough to
 * read it.
 */
export interface GhostChip {
  sessionId: string
  /** The gym it left, when it left one, so the ghost sits in that section. */
  venueId: string | null
  unitKey: string
  label: string
  /** Where it went, in the words the board uses: a weekend, a gym, or both. */
  to: string
}

/**
 * A weekend card's fill, by what its courts are doing. Every tone carries a
 * border that is actually visible on a white page (owner ruling 2026-08-05,
 * the clarity pass): a column of cards with hairline edges reads as one blob.
 */
export const CARD_TONE: Record<WeekendLoad["tone"], string> = {
  over: "border-hoop-400 bg-hoop-50",
  tight: "border-gold-500 bg-gold-50",
  unavailable: "border-ink-300 border-dashed bg-ink-100/70",
  empty: "border-ink-300 bg-white",
  roomy: "border-ink-300 bg-white",
}

/** The demand / capacity readout, wherever it is written. */
export const METER_TONE: Record<WeekendLoad["tone"], string> = {
  over: "text-hoop-800",
  tight: "text-gold-600",
  unavailable: "text-ink-400",
  empty: "text-ink-400",
  roomy: "text-ink-500",
}

export const PILL_TONE = {
  ok: "border-court-200 bg-court-50 text-court-800",
  warn: "border-gold-400 bg-gold-50 text-gold-600",
  bad: "border-hoop-200 bg-hoop-50 text-hoop-800",
}

/**
 * A number on this screen is a chip, never a clause (owner-approved mock,
 * 2026-08-02): "61 of 54, 7 short" is a red pill reading 61/54 with an overage
 * marker on it. Three tones and three only, so the chip can be read at a
 * glance without reading it at all.
 */
export type FractionTone = "fits" | "tight" | "over" | "quiet"

export const FRACTION_TONE: Record<FractionTone, string> = {
  fits: "border-court-200 bg-court-50 text-court-800",
  tight: "border-gold-400 bg-gold-50 text-gold-600",
  over: "border-hoop-300 bg-hoop-50 text-hoop-800",
  quiet: "border-ink-200 bg-ink-50 text-ink-500",
}

/** The same three tones the board paints a weekend in, said as a chip tone.
 *  One vocabulary, so a red chip and a red card always agree. */
export const FRACTION_FOR_TONE: Record<WeekendTone, FractionTone> = {
  over: "over",
  tight: "tight",
  roomy: "fits",
  empty: "quiet",
  unavailable: "quiet",
}

/** A gym section's own chip: its games against its courts. Same 85% line the
 *  weekend tone uses, so "tight" means one thing on this screen. */
export function fractionTone(games: number, capacity: number): FractionTone {
  if (capacity <= 0) return games > 0 ? "over" : "quiet"
  if (games > capacity) return "over"
  if (games === 0) return "quiet"
  return games / capacity >= 0.85 ? "tight" : "fits"
}

/**
 * A gym's colour, from the families the design system already uses. Pale fill,
 * saturated stripe, ink text — and the gym's NAME travels with it everywhere,
 * because colour never carries the fact on its own (owner rule 2026-08-02:
 * the gym is the colour, and colour is never alone).
 *
 * ONE table for the whole step. The board's sections, its grade chips and the
 * strip's cells all read this, in the same season gym order, so The Playground
 * is the same colour whichever view you are standing in.
 */
export const VENUE_HUES = [
  {
    fill: "bg-court-50",
    stripe: "border-l-court-500",
    swatch: "bg-court-500",
    /** The gym's name in its own colour, for a section header. */
    name: "text-court-700",
    /** The meter's fill. */
    bar: "bg-court-500",
    /** A grade chip sitting in this gym. */
    chip: "border-court-200 bg-court-50 text-court-800",
    /** The quieter ink inside that chip: the game count, the glyph. */
    chipQuiet: "text-court-600",
    /** The gym BOX outline on a weekend card (owner 2026-08-10: "the
     *  outline of the gyms should be the same color as the gym color"). */
    box: "border-court-300",
    /** The row's action buttons, in the family (owner 2026-08-10:
     *  "everything is grey" — controls wear their owner's colour). */
    action: "border-court-300 text-court-700 bg-white hover:bg-court-50",
  },
  {
    fill: "bg-play-50",
    stripe: "border-l-play-500",
    swatch: "bg-play-500",
    name: "text-play-700",
    bar: "bg-play-500",
    chip: "border-play-200 bg-play-50 text-play-800",
    chipQuiet: "text-play-600",
    /** The gym BOX outline on a weekend card (owner 2026-08-10: "the
     *  outline of the gyms should be the same color as the gym color"). */
    box: "border-play-300",
    /** The row's action buttons, in the family (owner 2026-08-10:
     *  "everything is grey" — controls wear their owner's colour). */
    action: "border-play-300 text-play-700 bg-white hover:bg-play-50",
  },
  /* One hue, one meaning (QA T-005) + REAL differentiation (owner
     2026-08-10: "the colors are too similar... reserve red for errors,
     make it more colorful"). Identity hues sit far apart on the wheel —
     green, purple, true blue, fuchsia, cyan — and the whole warning
     family (red/orange/amber) belongs to status alone. */
  {
    fill: "bg-blue-50",
    stripe: "border-l-blue-600",
    swatch: "bg-blue-600",
    name: "text-blue-700",
    bar: "bg-blue-600",
    chip: "border-blue-200 bg-blue-50 text-blue-800",
    chipQuiet: "text-blue-600",
    box: "border-blue-300",
    /** The row's action buttons, in the family (owner 2026-08-10:
     *  "everything is grey" — controls wear their owner's colour). */
    action: "border-blue-300 text-blue-700 bg-white hover:bg-blue-50",
  },
  {
    fill: "bg-fuchsia-50",
    stripe: "border-l-fuchsia-500",
    swatch: "bg-fuchsia-500",
    name: "text-fuchsia-700",
    bar: "bg-fuchsia-500",
    chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
    chipQuiet: "text-fuchsia-600",
    box: "border-fuchsia-300",
    /** The row's action buttons, in the family (owner 2026-08-10:
     *  "everything is grey" — controls wear their owner's colour). */
    action: "border-fuchsia-300 text-fuchsia-700 bg-white hover:bg-fuchsia-50",
  },
  {
    fill: "bg-cyan-50",
    stripe: "border-l-cyan-500",
    swatch: "bg-cyan-500",
    name: "text-cyan-700",
    bar: "bg-cyan-500",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-800",
    chipQuiet: "text-cyan-600",
    box: "border-cyan-300",
    /** The row's action buttons, in the family (owner 2026-08-10:
     *  "everything is grey" — controls wear their owner's colour). */
    action: "border-cyan-300 text-cyan-700 bg-white hover:bg-cyan-50",
  },
]

/**
 * The season's gyms in one stable order, with the colour family each one owns.
 * Both views call THIS with the same two inputs, so the board and the strip
 * can never hand the same gym two different colours.
 */
export function planVenueHues(
  grid: VenueGridLike | null | undefined,
  weekends: StripWeekendLike[]
): { order: StripVenue[]; hue: Map<string, number> } {
  const order = seasonVenueOrder(grid, weekends)
  return {
    order,
    hue: venueHueSlots(
      order.map((v) => v.venueId),
      VENUE_HUES.length
    ),
  }
}

/** The colour family a gym owns, and the first family for anything the season
 *  order has never heard of. */
export function hueFor(hue: Map<string, number>, venueId: string | null | undefined) {
  return VENUE_HUES[(venueId ? hue.get(venueId) : undefined) ?? 0]
}
