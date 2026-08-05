"use client"

import type { PlacementReason, PlannerUnit } from "@/lib/scheduler/planner-core"
import type { Armed } from "./plan-shared"
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
  onArm,
  onRemove,
  switchTo,
  onSwitchGym,
  muted,
  diffTone,
  caption,
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
  onArm: (a: Armed | null) => void
  onRemove?: () => void
  /** The next building with room for this grade, when this weekend has one.
   *  `backup` means the plan has no gym time there and taking it is the
   *  operator's own assertion (owner ruling 2026-08-05, #1). */
  switchTo?: { venueId: string; short: string; backup?: boolean }
  onSwitchGym?: () => void
  muted?: boolean
  /** Compare mode: agrees with the kept calendar, or sits somewhere new. */
  diffTone?: "agreed" | "changed"
  /** Compare mode only: where the kept calendar plays this grade instead. */
  caption?: string
}) {
  const isArmed = armed?.unitKey === unit.key && armed?.fromSessionId === fromSessionId
  // Arming is a live action, so it outranks the compare ring while it lasts, and
  // the mark on the grade that JUST MOVED outranks everything: it is the answer
  // to "what did I just do", and it stands until the board is touched again.
  const ring = flash
    ? "outline-play-600 outline outline-[3px] outline-offset-1 motion-safe:transition-all"
    : isArmed
      ? "ring-play-500 ring-2"
      : diffTone === "agreed"
        ? "ring-court-400 ring-1"
        : diffTone === "changed"
          ? "ring-gold-500 ring-1"
          : ""
  const ink = muted ? "text-ink-400" : (quiet ?? "text-ink-400")
  const glyph = reason ? REASON_GLYPH[reason] : undefined
  const chip = (
    <span
      draggable={interactive}
      onDragStart={(e) =>
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ unitKey: unit.key, fromSessionId, window: windowLabel })
        )
      }
      data-testid="grade-chip"
      data-diff={diffTone}
      data-flash={flash ? "1" : undefined}
      data-unit={unit.key}
      data-reason={reason ?? undefined}
      className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border pl-1 text-[12px] font-bold shadow-sm ${
        muted ? "border-ink-200 bg-ink-50 text-ink-500" : (tint ?? "border-ink-300 bg-white")
      } ${interactive ? "cursor-grab active:cursor-grabbing" : ""} ${ring}`}
    >
      {/* THE GRIP (owner ruling 2026-08-05). A chip you can pick up says so
          before you try: six dots and a grab cursor, the way every draggable
          thing on this board is marked. */}
      {interactive && (
        <svg
          viewBox="0 0 10 16"
          aria-hidden
          focusable="false"
          className={`h-3.5 w-2 shrink-0 ${ink}`}
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
      {/* One tap sends the grade to the next gym of this weekend. The chip
          already sits under the gym it plays in, so this is the move. */}
      {/* The switch is drawn ONLY where the other gym has room for this grade
          this weekend (owner ruling 2026-08-05). No mistake paths into full
          buildings, and no greyed arrow keeping a secret about why. */}
      {interactive && switchTo && onSwitchGym && (
        <button
          type="button"
          data-testid="switch-gym"
          data-to={switchTo.venueId}
          data-backup={switchTo.backup ? "1" : undefined}
          onClick={(e) => {
            e.stopPropagation()
            onSwitchGym()
          }}
          aria-label={
            switchTo.backup
              ? `Move ${unit.label} to ${switchTo.short}, a gym this plan has not asked about`
              : `Move ${unit.label} to ${switchTo.short}`
          }
          title={
            switchTo.backup
              ? `Move to ${switchTo.short} — your backup gym. Taking it says you have it that weekend.`
              : `Move to ${switchTo.short}`
          }
          className={`border-ink-300 hover:border-ink-400 hover:text-ink-900 ml-0.5 inline-flex min-h-[26px] cursor-pointer items-center rounded-md border bg-white/70 px-1 text-[11px] font-bold transition-colors hover:bg-white ${ink}`}
        >
          ⇄
        </button>
      )}
      {interactive && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Take ${unit.label} off ${weekendLabel}`}
          className={`hover:text-hoop-700 min-h-[34px] cursor-pointer px-1.5 ${ink}`}
        >
          ×
        </button>
      )}
    </span>
  )

  if (!caption) return chip
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {chip}
      <span
        className={`pl-0.5 text-[10px] font-bold leading-none ${
          diffTone === "changed" ? "text-gold-600" : "text-ink-400"
        }`}
      >
        {caption}
      </span>
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
