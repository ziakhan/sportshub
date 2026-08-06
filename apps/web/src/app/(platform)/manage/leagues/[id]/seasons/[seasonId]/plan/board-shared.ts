import type { DragEvent } from "react"
import type { PlannerLever, PlannerState, PlanSummary } from "@/lib/scheduler/planner-core"
import { PILL_TONE, type GhostChip } from "./plan-shared"
import type { BlockStatus } from "./plan-ui"

/**
 * WHAT THE WHOLE BOARD AGREES ON. Step 3 is one screen drawn by half a dozen
 * modules — the board, the weekend card, the rail, the zoom, the chrome and the
 * verbs behind them — and every one of them says "3 courts" or "2 weekends over"
 * in the operator's own words.
 *
 * The copy, the counting words, the working copy's own shapes and the two
 * verdict lines live here once, so a sentence can never come out two ways
 * depending on which module wrote it.
 */

export const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

/** Strings with real apostrophes live here as JS expressions, so nothing
 *  needs escaping and the copy stays readable. */
export const COPY = {
  opened:
    "We placed every grade for you, balanced across your gym time. Drag anything you'd do differently, then keep it.",
  oneWeekendPerMonth:
    "Every grade gets one weekend a month, so move it to another weekend in the same month.",
  /** The verb that fills every weekend with no building from the pool. A button
   *  in the header now (owner ruling 2026-08-06, #6), not half of a mode. */
  fillFromPool: "Fill the gaps from my pool",
  fillHint: "We take the cheapest gym in your pool that can hold the games. Nothing is booked.",
  /** The one alternative shape worth a button of its own: the same solve, told to
   *  use every weekend instead of as few as it can. */
  redrawSpread: "Redraw, spread out instead",
  nothingToFill: "Every weekend already has a building. There is nothing to fill.",
  noPool: "Your pool has no gym free on those weekends. Turn one on for them back in step 2.",
  /**
   * THE EMPTY BOARD LEADS WITH ONE BUTTON (owner ruling 2026-08-05, #1). A plan
   * that has its weekends and its gym time but no calendar yet is one tap from
   * the answer, and that tap must not be hidden behind "adjust grouping rules".
   */
  drawTitle: "Draw the calendar",
  /**
   * WHAT THE BUTTON IS ABOUT TO DO, in one line (owner ruling 2026-08-06, slice
   * B2). The draw has a shape — the building you own fills before anything is
   * rented, and what spills takes as few rented gyms as it can, as full as it
   * can — and an operator should know that shape before they press it rather
   * than infer it from the board afterwards.
   */
  drawHow:
    "Fills your home gym first, then rents as few gyms as possible, as full as possible. Adjust anything afterward.",
  drawHint:
    "The planner fills your chosen weekends from your gyms. Nothing is booked or saved until you say so.",
  /** The same board with no world to solve in. The fix is a step back, not a
   *  button here, so the hero points at step 2 instead of pretending. */
  worldFirst: "Pick your weekends and gym time in step 2 first",
  worldFirstHint:
    "A plan runs the weekends you choose, in the gyms you give it. Choose those and the calendar draws itself here.",
  worldFirstLink: "Go to step 2",
  /** Said once the solver has answered, whichever button asked it. */
  drawn:
    "Here is the calendar. Every grade is on one of the weekends you chose, in the gyms this plan has. Nothing is saved until you save it.",
  redrawn:
    "Redrawn from your weekends and your gyms. The plan you saved has not changed until you save this.",
  resolved:
    "Redrawn in this plan's world, so nothing is left in a gym this plan does not have. Nothing is saved until you save it.",
  /** Before a redraw throws away hand work. */
  redrawConfirm:
    "Redraw replaces the calendar on the board. Your saved plan is untouched until you save.",
  redraw: "Redraw calendar",
}

export const LEVERS: Array<{ lever: PlannerLever; label: string; note: string }> = [
  {
    lever: "balance",
    label: "Even weekends",
    note: "Proposed: the flattest weekends. Keep it, or drag first.",
  },
  {
    lever: "compact",
    label: "Fewest weekends",
    note: "Proposed: as few weekends in use as your gyms allow.",
  },
  {
    lever: "spread",
    label: "Use every weekend",
    note: "Proposed: every weekend of the season in use.",
  },
  {
    lever: "one-gym",
    label: "Pack one gym",
    note: "Proposed: every weekend inside one building, even where that makes a weekend heavier.",
  },
]

/**
 * THE HOURS CHIPS ARE GONE (owner ruling 2026-08-06, #6). "Start early" moved
 * every gym on every weekend of the season by an hour, which is not a thing
 * anybody phones a gym about: hours are agreed one building and one date at a
 * time, and that is where they are edited now (the ⋯ menu on the section). The
 * season-wide range is still step 2's, where it belongs.
 */

/**
 * VALID TARGETS ONLY, EVERYWHERE (owner ruling 2026-08-05, #1).
 *
 * While something is in the operator's hand — a grade, a whole gym section, a
 * rental block, a gym off the tray — the board answers ONE question in colour:
 * where can this actually go? A destination that the weekend-rooms arithmetic
 * says could take the load wears the green; everything else steps back. No
 * dotted offer, no ring and no drop is drawn anywhere the board would then have
 * to argue with the operator about.
 *
 * Written down once so the card, the sections, the empty slot and the offers all
 * mean the same green and the same quiet.
 */
export const TARGET_RING = "ring-court-500 ring-2"
/** The offer written down inside a target: "Move 3 grades here". */
export const TARGET_OFFER =
  "border-court-400 bg-court-50 text-court-800 border-dashed"
/** Everything that is not a target while something is held. Slightly back, not
 *  gone: an operator still has to be able to read the weekend they cannot use. */
export const NOT_TARGET = "opacity-60"

/**
 * THE GRADE HIGHLIGHT (owner ruling 2026-08-05, #4). A filter that changes
 * nothing about the plan: the grades somebody picked stay at full strength with
 * a quiet ring on them, and everything else drops back far enough that one
 * grade's whole season reads straight off the board.
 */
export const FILTER_MATCH = "ring-court-400 ring-1"
export const FILTER_DIM = "opacity-[0.35]"

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Courts in a phrase, because a rental is quoted in them. */
export const courtsWord = (n: number) => plural(n, "court", "courts")

/** Things in a sentence: "a", "a and b", "a, b and c". */
export function nameList(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/** How many boards back an operator can step. Ten is more than anybody has
 *  ever wanted, and it costs two small objects a move. */
export const UNDO_DEPTH = 10

/** The whole board, as it was before a move: the calendar and the gyms
 *  somebody had decided. Everything else on screen is derived from these two. */
export interface BoardSnapshot {
  /** What the step back would put right, in the operator's own words: "move
   *  Grade 8". The Undo button wears it, so nobody has to press it to find
   *  out what it does (owner ruling 2026-08-05). */
  label: string
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  /** Where each rental stood: "<sessionId>|<venueId>" → assumed | confirmed.
   *  Filling the gaps from the pool is one step back, gyms and statuses
   *  together, because those two are one decision. */
  blockStatus: Record<string, BlockStatus>
  /** The courts each gym was holding that weekend, where somebody said otherwise
   *  ("<sessionId>|<venueId>" → courts, either direction — owner ruling
   *  2026-08-06, #5). It repacks or re-bills the whole board, so undoing one has
   *  to put the courts back before anything else. */
  courtOverrides: Record<string, number>
  /** The hours each gym was running that weekend, where somebody gave it its own
   *  ("<sessionId>|<venueId>" → the window). Capacity is derived from these, so
   *  they travel with the courts. */
  hourOverrides: Record<string, { startTime: string; endTime: string }>
  /** The gyms placed on a date with nothing in it yet: sessionId → venueIds. They
   *  cost nothing anywhere, and undoing a placement has to take the container
   *  away with it. */
  emptyGyms: Record<string, string[]>
  /** The backup gyms the operator had asserted, weekend by weekend (owner ruling
   *  2026-08-05, #1): sessionId → venueIds. Undoing a placement onto a backup gym
   *  has to take the assertion back with it, or the board would keep computing on
   *  gym time nobody claimed. */
  assertedGyms: Record<string, string[]>
  /** Whether the plan had unsaved changes at that point, so undoing back to
   *  the saved calendar puts the Keep button back to sleep. */
  dirty: boolean
}

/** One rental, keyed the way the working copy remembers it. */
export const blockKey = (sessionId: string, venueId: string) => `${sessionId}|${venueId}`

/**
 * WHAT SOMEBODY IS DRAGGING. Three things travel on this board, all on the same
 * one-line JSON payload: a grade chip, a gym out of the tray, and — since the
 * 2026-08-05 section ruling — a whole gym section with every grade in it.
 */
export type DragPayload =
  | {
      unitKey?: string
      fromSessionId?: string | null
      venueId?: string
      section?: boolean
      sessionId?: string
      unitKeys?: string[]
      window?: string
    }
  | null

/**
 * WHAT LANDED ON A GHOST DATE (owner ruling 2026-08-06, slice B2). A date the
 * plan is not using takes the same things every card takes — a gym off the gym
 * list, one grade, a whole block, a whole section — and they reduce to two
 * intents: put a building on this date, or bring these grades to it.
 */
export type GhostIntent =
  | { kind: "gym"; venueId: string }
  | { kind: "grades"; unitKeys: string[]; fromSessionId: string | null }

/** A ghost drop waiting for the weekend it landed on to exist on the board. */
export interface PendingDrop {
  sessionId: string
  intent: GhostIntent
}

/** What a drag is carrying, as a ghost date reads it. Null when it is not one
 *  of ours, or carries nothing a date can take. */
export function ghostIntentFromDrag(e: DragEvent): GhostIntent | null {
  let payload: DragPayload = null
  try {
    payload = JSON.parse(e.dataTransfer.getData("text/plain")) as DragPayload
  } catch {
    return null
  }
  if (!payload) return null
  if (payload.venueId) return { kind: "gym", venueId: payload.venueId }
  if (payload.section && Array.isArray(payload.unitKeys) && payload.sessionId) {
    return { kind: "grades", unitKeys: payload.unitKeys, fromSessionId: payload.sessionId }
  }
  if (payload.unitKey) {
    return {
      kind: "grades",
      unitKeys: [payload.unitKey],
      fromSessionId: payload.fromSessionId ?? null,
    }
  }
  return null
}

/** One shared empty set, so a weekend with nothing stranded does not hand a new
 *  object down on every repaint. */
export const EMPTY_KEYS: Set<string> = new Set()

/** The same, for a weekend nobody has just moved anything off. */
export const EMPTY_GHOSTS: GhostChip[] = []

/** Which building each grade plays in, as the plan has it SAVED: sessionId →
 *  (unit key → venueId). The board carries this next to the assignment and
 *  hands it back on Apply, so a kept calendar keeps its gyms too. */
export function savedVenueMap(state: PlannerState): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const byUnit = w.assignedVenues ?? {}
      if (Object.keys(byUnit).length > 0) out[w.sessionId] = { ...byUnit }
    }
  }
  return out
}

/**
 * A plan's world, back in the shape the board computes on, lives in
 * lib/scheduler/plan-world.ts now (owner ruling 2026-08-05: "a pure
 * planStateFrom(plan) ... so all three steps render any plan identically"). The
 * board used to own that reading privately, which is exactly why step 2 and step
 * 3 could disagree about the same plan.
 */

/** The header verdict: the loudest true thing about the plan on screen. */
export function headerPill(summary: PlanSummary): { tone: keyof typeof PILL_TONE; text: string } {
  if (summary.over > 0)
    return { tone: "bad", text: `${plural(summary.over, "weekend", "weekends")} over` }
  if (summary.unplaced > 0)
    return { tone: "warn", text: `${plural(summary.unplaced, "grade", "grades")} not placed` }
  if (summary.tight > 0)
    return { tone: "warn", text: `${plural(summary.tight, "weekend", "weekends")} tight` }
  return { tone: "ok", text: "All grades fit" }
}

/**
 * The compare LINE went with the compare lens (owner ruling 2026-08-06, #6). The
 * pure diff it read — diffAssignments and its summary — is untouched in the core,
 * where the strip and the API still use it.
 */
