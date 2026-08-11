"use client"

import type { PlacementReason, PlannerUnit } from "@/lib/scheduler/planner-core"
import type { Armed } from "./plan-shared"
import { armAfterDragStarts, FILTER_DIM, FILTER_MATCH } from "./board-shared"
import { REASON_GLYPH, ReasonGlyph, WhyPopover } from "./plan-ui"

/**
 * THE TWO SMALLEST THINGS ON THE BOARD: a grade, and the hole a grade left.
 * Both are drawn inside a gym section, both are drawn by the weekend card and
 * by the month column's bench, and neither knows anything about the plan.
 */

/** A grade, in the colour of the gym it plays in. Draggable for a mouse,
 *  tappable for everything else: one tap arms it, the next tap on a weekend
 *  moves it. Its games ride on it as a number, and the reason it sits where it
 *  sits rides on it as a mark you can tap for the sentence. */
export function GradeChip({
  unit,
  games,
  tint,
  quiet,
  reason,
  why,
  fromSessionId,
  windowLabel,
  weekendLabel,
  armed,
  interactive,
  flash,
  highlight,
  onArm,
  onDragState,
  onRemove,
  muted,
}: {
  unit: PlannerUnit
  /** Games this grade brings. On a weekend, what it brings there; on the bench,
   *  what it would bring to that month (owner ruling 2026-08-05 — the count is
   *  on the chip you pick up, not only on the one you put down). */
  games?: number
  /** The gym's colour, as chip classes. */
  tint?: string
  /** The quieter ink inside the chip, from the same family. */
  quiet?: string
  /** Why it is in this building, for the mark it wears. */
  reason?: PlacementReason | null
  /** The sentence behind that mark. */
  why?: string
  fromSessionId: string | null
  windowLabel: string
  weekendLabel: string
  armed: Armed | null
  interactive: boolean
  /** THIS is the grade that just moved (owner ruling 2026-08-05, #3a). It wears a
   *  stronger mark than the card it landed on, because the card is where to look
   *  and the chip is what happened, and it keeps it until the next interaction. */
  flash?: boolean
  /**
   * THE GRADE HIGHLIGHT (owner ruling 2026-08-05, #4). Null while the filter is
   * off, which is the ordinary case and changes nothing. "on" is a grade
   * somebody picked out, "off" is every other grade while a pick is in force.
   */
  highlight?: "on" | "off" | null
  onArm: (a: Armed | null) => void
  /**
   * PICKED UP WITH A MOUSE (owner ruling 2026-08-05, #1). A drag has to light the
   * board up exactly the way a tap does, so dragging arms the chip and dropping
   * it puts it down again. Without this the colour coding only ever appeared for
   * the thumb path.
   */
  onDragState?: (dragging: boolean) => void
  onRemove?: () => void
  /** A benched grade: still readable, but a notch quieter than one that plays
   *  somewhere this month. */
  muted?: boolean
}) {
  const isArmed = armed?.unitKey === unit.key && armed?.fromSessionId === fromSessionId
  // Arming is a live action, so it outranks everything else while it lasts,
  // and the mark on the grade that JUST MOVED outranks everything: it is the
  // answer to "what did I just do", and it stands until the board is touched
  // again.
  const ring = flash
    ? "outline-play-600 outline outline-[3px] outline-offset-1 motion-safe:transition-all"
    : isArmed
      ? "ring-play-500 ring-2"
      : // The highlight is the quietest ring on the chip, so it never
        // outranks a live answer about what just happened.
        highlight === "on"
        ? FILTER_MATCH
        : ""
  const ink = muted ? "text-ink-400" : (quiet ?? "text-ink-400")
  const glyph = reason ? REASON_GLYPH[reason] : undefined
  return (
    <span
      draggable={interactive}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ unitKey: unit.key, fromSessionId, window: windowLabel })
        )
        // A frame later, never inside the event (see armAfterDragStarts): the
        // arming redraws the line above the board, and a DOM change above the
        // drag source cancels the drag in Chrome.
        armAfterDragStarts(() => onDragState?.(true))
      }}
      onDragEnd={() => onDragState?.(false)}
      data-testid="grade-chip"
      data-flash={flash ? "1" : undefined}
      data-highlight={highlight ?? undefined}
      data-unit={unit.key}
      data-reason={reason ?? undefined}
      className={`group inline-flex min-h-[34px] items-center gap-1 rounded-lg border pl-1 text-[12px] font-bold shadow-sm ${
        muted ? "border-ink-200 bg-ink-50 text-ink-500" : (tint ?? "border-ink-300 bg-white")
      } ${interactive ? "cursor-grab active:cursor-grabbing" : ""} ${ring} ${
        highlight === "off" ? FILTER_DIM : ""
      }`}
    >
      {/* THE GRIP (owner ruling 2026-08-05). A chip you can pick up says so
          before you try: six dots and a grab cursor, the way every draggable
          thing on this board is marked. */}
      {interactive && (
        <svg
          viewBox="0 0 10 16"
          aria-hidden
          focusable="false"
          className={`h-3.5 w-2 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${ink}`}
        >
          <circle cx="3" cy="4" r="1.1" fill="currentColor" />
          <circle cx="7" cy="4" r="1.1" fill="currentColor" />
          <circle cx="3" cy="8" r="1.1" fill="currentColor" />
          <circle cx="7" cy="8" r="1.1" fill="currentColor" />
          <circle cx="3" cy="12" r="1.1" fill="currentColor" />
          <circle cx="7" cy="12" r="1.1" fill="currentColor" />
        </svg>
      )}
      <button
        type="button"
        disabled={!interactive}
        aria-pressed={isArmed}
        aria-label={`${unit.label} on ${weekendLabel}`}
        onClick={(e) => {
          e.stopPropagation()
          if (!interactive) return
          onArm(
            isArmed
              ? null
              : { unitKey: unit.key, label: unit.label, fromSessionId, window: windowLabel }
          )
        }}
        className="min-h-[34px] cursor-pointer pr-0.5 disabled:cursor-default"
      >
        {unit.label}
      </button>
      {games != null && games > 0 && (
        <span className={`text-[11px] font-bold tabular-nums ${ink}`} aria-hidden>
          {games}
        </span>
      )}
      {/* The reason, drawn. The tap target is the whole height of the chip,
          never the 12px mark on its own, and the sentence is behind it. */}
      {glyph && why && (
        <WhyPopover
          text={why}
          label={`Why ${unit.label} plays here`}
          testId="chip-why"
          className={`inline-flex min-h-[32px] items-center px-0.5 ${ink}`}
        >
          <ReasonGlyph glyph={glyph} />
        </WhyPopover>
      )}
      {/**
       * THE ⇄ IS GONE (owner ruling 2026-08-05, #2: "it guesses").
       *
       * It picked the destination itself — the next building along with room in
       * it — so the operator pressed an arrow and found out afterwards where the
       * grade had gone. A gym is not a thing to be assigned by wrap-around.
       *
       * The move it did is still there and it is now NAMED: pick the chip up and
       * put it on the gym you want, by drag or by tap, and only the buildings
       * that can really hold it light up (ruling #1). One less control, and the
       * operator chooses the building instead of the board.
       */}
      {interactive && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Take ${unit.label} off ${weekendLabel}`}
          className={`hover:text-hoop-700 min-h-[34px] cursor-pointer px-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${ink}`}
        >
          ×
        </button>
      )}
    </span>
  )
}

/**
 * "GRADE 8 MOVED TO NOV 15" (owner ruling 2026-08-05, #3b, re-ruled the same day
 * as #2). The empty slot a grade left behind, in hoop red so the eye finds it in
 * a column of gym colours, and it names the destination rather than only the
 * departure: an origin that says "was here" leaves the operator hunting for
 * where it went.
 *
 * No animation and no clock. It stands until the board is touched again or the
 * move is undone, so there is nothing to catch.
 */
export function GhostMark({ label, to }: { label: string; to: string }) {
  return (
    <span
      data-testid="move-ghost"
      data-unit={label}
      data-to={to}
      className="border-hoop-400 bg-hoop-50/60 text-hoop-700 inline-flex min-h-[34px] items-center rounded-lg border border-dashed px-1.5 text-[11px] font-bold"
    >
      {label} moved to {to}
    </span>
  )
}
