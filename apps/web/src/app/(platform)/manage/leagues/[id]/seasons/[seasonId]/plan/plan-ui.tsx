"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { PlacementReason, RentalAsk } from "@/lib/scheduler/planner-core"
import {
  BTN_MD,
  BTN_QUIET,
  BTN_SECONDARY,
  FRACTION_TONE,
  hueFor,
  type FractionTone,
} from "./plan-shared"
import { armAfterDragStarts } from "./board-shared"

/**
 * The three small things step 3 is built out of (owner-approved mock,
 * 2026-08-02).
 *
 *  1. A NUMBER IS A CHIP. "61 of 54, 7 short" is a red pill reading 61/54 with
 *     an overage marker, never a clause. Severity is never colour alone: the
 *     fraction itself is the redundant cue and the marker makes it scannable.
 *  2. A REASON IS A GLYPH. Four of them, drawn not typed, so they render the
 *     same on every machine and inherit the chip's colour: home gym, moved,
 *     your pick, alternates.
 *  3. PROSE IS THE POPOVER. The sentences the pure core composes still exist,
 *     word for word, but they live behind a real button that opens on tap as
 *     well as hover. A title= attribute is dead on a touch screen, so nothing
 *     that matters is ever only a title.
 */

/* ----------------------------- the notice slot ---------------------------- */

/**
 * MESSAGES NEVER RESHAPE THE SCREEN UNDER YOUR CURSOR (owner 2026-08-02: "when
 * I'm removing the gym on and off, I'm seeing a message on top which is
 * fluctuating and shifting the whole layout"). One slot, shared by every step
 * that reports a save result: it keeps its space whether or not it has
 * anything to say, so a toggle or a retry never moves a card under the
 * operator's finger. An error always wins over a notice, and wears hoop; a
 * notice wears whichever tone its step means by it.
 */
export function NoticeSlot({
  error,
  notice,
  tone = "court",
  testId,
  className = "",
}: {
  error?: string | null
  notice?: string | null
  tone?: "court" | "gold"
  testId?: string
  className?: string
}) {
  return (
    <p
      data-testid={testId}
      data-tone={error ? "hoop" : tone}
      aria-live="polite"
      className={`rounded-xl border px-4 py-2.5 text-sm transition-opacity duration-150 ${
        error
          ? "border-hoop-200 bg-hoop-50 text-hoop-900"
          : tone === "gold"
            ? "border-gold-200 bg-gold-50 text-gold-900"
            : "border-court-200 bg-court-50 text-court-900"
      } ${error || notice ? "opacity-100" : "invisible opacity-0"} ${className}`}
    >
      {error ?? notice ?? " "}
    </p>
  )
}

/* ------------------------------ the glyphs ------------------------------- */

/** The four reasons worth drawing, in the app's own stroked-icon idiom. */
export type ReasonGlyphName = "home" | "moved" | "picked" | "alternates"

const GLYPHS: Record<ReasonGlyphName, React.ReactNode> = {
  // A house: the gym this grade plays in all season.
  home: (
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5.5 9.6V20h13V9.6" />
    </>
  ),
  // Corner-up-right: it was bumped out of its building.
  moved: (
    <>
      <path d="M15 4.5 20 9.5l-5 5" />
      <path d="M4 20v-6.5a4 4 0 0 1 4-4h12" />
    </>
  ),
  // A pin: somebody put it here by hand.
  picked: (
    <>
      <path d="M20 10.2c0 5.6-8 11.8-8 11.8s-8-6.2-8-11.8a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  // Repeat: this grade swaps buildings on purpose.
  alternates: (
    <>
      <path d="m17 2.5 3.5 3.5L17 9.5" />
      <path d="M3.5 11.5v-1.5a4 4 0 0 1 4-4h13" />
      <path d="m7 21.5-3.5-3.5L7 14.5" />
      <path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13" />
    </>
  ),
}

/**
 * Which glyph a placement reason wears. Fill order is the ordinary case and
 * draws nothing; overflow wears the overage marker instead, because "no room"
 * is a shortage, not a reason.
 *
 * THE HOME GYM WEARS NOTHING (owner ruling 2026-08-05). A house on every chip
 * in the building the league owns is an icon on the ordinary case: the gym
 * legend above the calendar already tags that building "home gym", and the
 * section says it too. Playing at home is the default, and defaults are silent.
 */
export const REASON_GLYPH: Partial<Record<PlacementReason, ReasonGlyphName>> = {
  bumped: "moved",
  decided: "picked",
  avoided: "alternates",
}

/** The glyphs and their words, for the one quiet legend line. */
export const GLYPH_LEGEND: Array<{ glyph: ReasonGlyphName; words: string }> = [
  { glyph: "moved", words: "moved, its building was full" },
  { glyph: "picked", words: "your pick" },
  { glyph: "alternates", words: "alternates buildings" },
]

export function ReasonGlyph({
  glyph,
  className = "",
}: {
  glyph: ReasonGlyphName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`h-3 w-3 shrink-0 ${className}`}
    >
      {GLYPHS[glyph]}
    </svg>
  )
}

/** The overage marker: what makes an over chip readable without its colour. */
function OverMark({ by }: { by: number }) {
  return (
    <span className="inline-flex items-center gap-[1px] font-extrabold">
      <svg viewBox="0 0 10 10" aria-hidden focusable="false" className="h-2 w-2 shrink-0">
        <path d="M5 1 9.5 9h-9z" fill="currentColor" />
      </svg>
      {by}
    </span>
  )
}

/* ----------------------------- the fraction ------------------------------ */

/**
 * Load against capacity, as one pill. Tabular figures so a column of them
 * lines up, and never under 12px: this is the number the whole screen is for.
 */
export function Fraction({
  of,
  is,
  tone,
  title,
  className = "",
  testId,
}: {
  /** Games asked for. */
  is: number
  /** Games the courts hold. */
  of: number
  tone: FractionTone
  /** What a screen reader hears instead of "61 slash 54". */
  title?: string
  className?: string
  testId?: string
}) {
  const over = Math.max(0, is - of)
  // The overage is never colour alone, and never a mark alone: whatever the
  // caller titles the chip, "7 over" is said at the end of it.
  const said = `${title ?? `${is} games of ${of}`}${over > 0 ? `, ${over} over` : ""}`
  return (
    <span
      data-testid={testId}
      aria-label={said}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[1.5px] text-[12px] font-bold tabular-nums ${FRACTION_TONE[tone]} ${className}`}
    >
      <span aria-hidden>
        {is}/{of}
      </span>
      {over > 0 && <OverMark by={over} />}
    </span>
  )
}

/**
 * A number that wears its unit: "7 games over", "fits, 73 slots left" (owner
 * 2026-08-02: "it's not very clear that 27 is a number of games"). The same
 * three tones as the fraction, for the places a fraction is too much arithmetic
 * to read: the rail says what is wrong and what is left, and keeps the full
 * capacity maths for the popover.
 */
export function CountChip({
  words,
  tone,
  className = "",
  testId,
}: {
  /** The number and its unit, already said: this chip never adds a noun. */
  words: string
  tone: FractionTone
  className?: string
  testId?: string
}) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-[1.5px] text-[12px] font-bold tabular-nums ${FRACTION_TONE[tone]} ${className}`}
    >
      {words}
    </span>
  )
}

/* ------------------------------ the popover ------------------------------ */

/** Where a panel sits, in viewport coordinates: the trigger's own rectangle,
 *  flipped above it when there is no room below. */
interface Placement {
  left: number
  top?: number
  bottom?: number
}

const PANEL_WIDTH = 268
/** Enough for the longest sentence the core composes, at this width. */
const PANEL_GUESS = 150

function placeFor(rect: DOMRect, width: number = PANEL_WIDTH): Placement {
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
  const below = window.innerHeight - rect.bottom
  if (below < PANEL_GUESS && rect.top > below) {
    return { left, bottom: window.innerHeight - rect.top + 6 }
  }
  return { left, top: rect.bottom + 6 }
}

/**
 * A sentence, one tap away. The trigger is a real button (so a thumb and a
 * keyboard both reach it), the panel is portalled to the body (the board
 * scrolls sideways inside an overflow container, which would clip anything
 * positioned inside it) and it closes on outside click, Escape, scroll or
 * resize. Hover opens it too, for the mouse.
 */
export function WhyPopover({
  text,
  label,
  className = "",
  children,
  testId,
}: {
  /** The prose. Composed in the pure core, only rendered here. */
  text: string
  /** What the trigger is, said out loud. */
  label: string
  className?: string
  children: React.ReactNode
  testId?: string
}) {
  const [at, setAt] = useState<Placement | null>(null)
  /** Null when shut. A hover opens it lightly; a click pins it open. */
  const [mode, setMode] = useState<"hover" | "click" | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = `why-${useId()}`
  const open = mode !== null

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (rect) setAt(placeFor(rect))
  }, [])

  const shut = useCallback(() => {
    setMode(null)
    setAt(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (trigger.current?.contains(target) || panel.current?.contains(target)) return
      shut()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        shut()
        trigger.current?.focus()
      }
    }
    // Scrolling MOVES the panel with its trigger rather than dismissing it:
    // the board scrolls sideways and a smooth scroll into view would otherwise
    // shut a popover the moment it opened.
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, shut, place])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (mode === "click") {
            shut()
            return
          }
          place()
          setMode("click")
        }}
        onMouseEnter={() => {
          if (mode) return
          place()
          setMode("hover")
        }}
        onMouseLeave={() => {
          if (mode === "hover") shut()
        }}
        // Focus deliberately does NOT open it: Escape puts focus back on the
        // trigger, and a popover that reopens on that focus can never be shut
        // from the keyboard. A keyboard opens it the way it opens any button.
        onBlur={() => {
          if (mode === "hover") shut()
        }}
        className={`focus-visible:ring-play-500 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${className}`}
      >
        {children}
      </button>
      {open &&
        at &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="tooltip"
            data-testid="why-popover"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: at.left,
              top: at.top,
              bottom: at.bottom,
              width: PANEL_WIDTH,
            }}
            className="border-ink-200 text-ink-700 z-50 rounded-xl border bg-white p-3 text-[12px] leading-[1.5] shadow-lg"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}

/**
 * A PANEL YOU CAN ACT IN, one tap away. WhyPopover's sibling: the same
 * portalled placement and the same outside-click, Escape, resize handling, but
 * it holds controls rather than a sentence, so it never opens on hover and it
 * stays open while you use it.
 */
export function ActionPopover({
  label,
  trigger,
  children,
  open,
  onOpenChange,
  className = "",
  testId,
  width = PANEL_WIDTH,
}: {
  /** What the trigger is, said out loud. */
  label: string
  trigger: React.ReactNode
  /** The panel's contents. Rendered only while open. */
  children: (close: () => void) => React.ReactNode
  /** Controlled when supplied, so a board can shut one panel by opening
   *  another. Uncontrolled otherwise. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  testId?: string
  width?: number
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const [at, setAt] = useState<Placement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = `act-${useId()}`
  const isOpen = open ?? ownOpen

  const setOpen = useCallback(
    (next: boolean) => {
      setOwnOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setAt(placeFor(rect, width))
  }, [width])

  const shut = useCallback(() => {
    setOpen(false)
    setAt(null)
  }, [setOpen])

  /**
   * A PANEL THAT FITS ON THE SCREEN (owner ruling 2026-08-06, #5, found by the
   * drive). placeFor guesses a height before the panel exists, and the ⋯ menu is
   * taller than the guess: opened low on a long board it hung off the bottom of
   * the window and its Apply button could not be clicked at all.
   *
   * So the panel is measured once it is really there and pulled back up by
   * exactly what overflows. It settles in one pass, and a panel already inside
   * the window is left alone, so nothing moves under a cursor for no reason.
   */
  useEffect(() => {
    if (!isOpen || !at || at.top == null) return
    const box = panelRef.current?.getBoundingClientRect()
    if (!box) return
    const overflow = box.bottom - (window.innerHeight - 8)
    if (overflow <= 1) return
    const top = Math.max(8, at.top - overflow)
    if (Math.abs(top - at.top) < 1) return
    setAt({ ...at, top })
  }, [isOpen, at])

  useEffect(() => {
    if (!isOpen) return
    if (!at) place()
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      shut()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      shut()
      triggerRef.current?.focus()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [isOpen, at, place, shut])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (isOpen) {
            shut()
            return
          }
          place()
          setOpen(true)
        }}
        className={`focus-visible:ring-play-500 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${className}`}
      >
        {trigger}
      </button>
      {isOpen &&
        at &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            data-testid={testId ? `${testId}-panel` : "action-popover"}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: at.left,
              top: at.top,
              bottom: at.bottom,
              width,
              // Taller than the window is the operator's problem to scroll, not
              // a reason to lose the buttons at the bottom of it.
              maxHeight: "calc(100vh - 16px)",
              overflowY: "auto",
            }}
            className="border-ink-200 z-50 rounded-xl border bg-white p-3 shadow-lg"
          >
            {children(shut)}
          </div>,
          document.body
        )}
    </>
  )
}

/**
 * The quiet action a correction and a split both hang off: small, grey, and
 * unmistakably a button (owner ruling 2026-08-05, the clarity pass). A border
 * that is actually visible in light mode, a hover that changes the fill rather
 * than the layout, and a 28px face so a thumb can find it.
 */
/**
 * QUIET IS NOT INVISIBLE (owner ruling 2026-08-06, the affordance sweep, second
 * occurrence). These sit beside louder controls and must not shout, but a
 * stranger still has to be able to tell they are pressable: a solid border, a
 * dark label, a real hover. The grey-on-grey version is what let the owner walk
 * past the bookings picker twice.
 */
export function QuietAction({ children }: { children: React.ReactNode }) {
  return (
    <span className={`${BTN_QUIET} min-h-[32px] rounded-md px-2 text-[10.5px]`}>
      {children}
    </span>
  )
}

/* --------------------------- what a season rents -------------------------- */

/**
 * Where one rental stands (owner ruling 2026-08-03): nobody has a building for
 * it, the pool answered it and nobody has booked it, or a gym said yes.
 */
export type BlockStatus = "needed" | "assumed" | "confirmed"

/** Hoop for a hole in the season, gold for an answer nobody has booked yet,
 *  court for a booking somebody asserted. The same three families every other
 *  tone on this step is painted in. */
export const BLOCK_STATUS_TONE: Record<BlockStatus, string> = {
  needed: "border-hoop-300 bg-hoop-50 text-hoop-800",
  assumed: "border-gold-400 bg-gold-50 text-gold-600",
  confirmed: "border-court-200 bg-court-50 text-court-800",
}

/**
 * The status in words (2026-08-03), with the 2026-08-05 simplification: a
 * CONFIRMED rental is the ordinary case and is never written down. Silence
 * means confirmed. Only a rental with no building, or one nobody has booked
 * yet, has anything to say.
 */
export const BLOCK_STATUS_WORDS: Record<BlockStatus, string> = {
  needed: "needs a building",
  assumed: "assumed, not booked yet",
  confirmed: "",
}

/** A number with no trailing zeros: court-hours divide by the hours a gym is
 *  open, and "23.5 court-hours" is a real answer. */
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const courtsWord = (n: number) => `${n} court${n === 1 ? "" : "s"}`
const weekendsWord = (n: number) => `${n} weekend${n === 1 ? "" : "s"}`

/** One rental, as a chip: where it is, which building, and where the booking
 *  stands. `data-status` carries the canonical word so a drive can read it. */
export function BlockStatusChip({
  status,
  weekend,
  gym,
  testId = "ask-block",
}: {
  status: BlockStatus
  weekend: string
  /** Null on a rental with no building yet. */
  gym: string | null
  testId?: string
}) {
  return (
    <span
      data-testid={testId}
      data-status={status}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[1.5px] text-[11.5px] font-bold ${BLOCK_STATUS_TONE[status]}`}
    >
      <span className="tabular-nums">{weekend}</span>
      <span className="font-semibold opacity-80">
        {[gym, BLOCK_STATUS_WORDS[status]].filter(Boolean).join(" · ")}
      </span>
    </span>
  )
}

/** The same standing, small enough to ride in a gym section's header line. */
export function BlockStatusMark({
  status,
  testId = "block-status",
}: {
  status: BlockStatus
  testId?: string
}) {
  return (
    <span
      data-testid={testId}
      data-status={status}
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 text-[10px] font-bold ${BLOCK_STATUS_TONE[status]}`}
    >
      {BLOCK_STATUS_WORDS[status]}
    </span>
  )
}

/**
 * THE ASK, as the sheet somebody reads down the phone (owner ruling
 * 2026-08-03: "tell the gym how many hours we need, they pick the days").
 *
 * Quiet by default and one tap open, because it is a thing you go and look at
 * rather than a thing that shouts: the season in two numbers, then a row per
 * month with the shape of the need in words, then every weekend that rents
 * anything with where its booking stands.
 */
export function AskSheet({
  ask,
  blocks,
}: {
  ask: RentalAsk
  /** Every rental this calendar needs, weekend order, already labelled. */
  blocks: Array<{ key: string; weekend: string; gym: string | null; status: BlockStatus }>
}) {
  const [open, setOpen] = useState(false)
  const season = [
    `${num(ask.season.courtDays)} court-days`,
    `${num(ask.season.courtHours)} court-hours`,
    ask.season.gamesUnhoused > 0
      ? `${ask.season.gamesUnhoused} game${ask.season.gamesUnhoused === 1 ? "" : "s"} with no building yet`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="mt-4" data-testid="ask-sheet">
      <button
        type="button"
        data-testid="ask-sheet-toggle"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={`${BTN_SECONDARY} ${BTN_MD}`}
      >
        What you need to book
      </button>
      <span className="text-ink-400 ml-2 text-[11.5px]" data-testid="ask-season">
        {season}
      </span>
      {open && (
        <div
          className="border-ink-100 bg-ink-50/60 mt-2 rounded-xl border p-3"
          data-testid="ask-sheet-body"
        >
          <p className="text-ink-400 text-[11px] font-bold uppercase tracking-[0.06em]">
            Month by month
          </p>
          <div className="mt-1.5 space-y-1.5">
            {ask.months.map((month) => (
              <div
                key={month.label}
                data-testid="ask-month"
                className="border-ink-100 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-white px-2.5 py-1.5"
              >
                <span className="text-ink-900 whitespace-nowrap text-[12.5px] font-bold">
                  {month.label}
                </span>
                <span className="text-ink-600 whitespace-nowrap text-[12px] font-semibold tabular-nums">
                  {num(month.courtDays)} court-days
                </span>
                <span className="text-ink-600 whitespace-nowrap text-[12px] font-semibold tabular-nums">
                  {num(month.courtHours)} court-hours
                </span>
                <span className="text-ink-500 whitespace-nowrap text-[11.5px]">
                  {weekendsWord(month.weekendsNeedingRent)} needing rent
                </span>
                <span className="text-ink-500 text-[11.5px] italic">{month.chunks}</span>
              </div>
            ))}
            {ask.months.length === 0 && (
              <p className="text-ink-500 text-[12px]">
                Nothing to rent. Every weekend fits in the gym you own.
              </p>
            )}
          </div>
          {blocks.length > 0 && (
            <>
              <p className="text-ink-400 mt-3 text-[11px] font-bold uppercase tracking-[0.06em]">
                Weekend by weekend
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {blocks.map((b) => (
                  <BlockStatusChip key={b.key} status={b.status} weekend={b.weekend} gym={b.gym} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The rentals behind the calendar, counted (owner ruling 2026-08-03). It sits
 * with the save controls because it is the last thing worth reading before a
 * plan is kept: a plan with a building for every weekend is a plan somebody can
 * go and book, and a plan without one is a season with a hole in February.
 *
 * Zero clauses are left out, the same way the compare line leaves them out.
 */
export function BlockSummary({
  total,
  confirmed,
  assumed,
  needed,
}: {
  total: number
  confirmed: number
  assumed: number
  needed: number
}) {
  if (total === 0) return null
  // "Confirmed" is the default and is never written down (owner ruling
  // 2026-08-05), so the line counts what is still open and nothing else.
  const parts = [
    assumed > 0 ? `${assumed} assumed, not booked yet` : null,
    needed > 0 ? `${needed} still need a building` : null,
  ].filter(Boolean)
  return (
    <span className="text-ink-500 text-xs" data-testid="block-summary">
      {total === 1 ? "1 rental block" : `${total} rental blocks`}
      {parts.length > 0 ? `: ${parts.join(" · ")}` : ""}
    </span>
  )
}

/** One gym of the league's roster, as the gym list draws it. */
export interface TrayGym {
  venueId: string
  name: string
  short: string
  /** Courts wired at this gym. */
  courts: number
  /** Weekends of the season it is actually available on. */
  weekends: number
  /** The building the league owns, or one it rents. */
  role: "home" | "pool"
}

/**
 * ONE GYM LIST (owner ruling 2026-08-06, #1). There used to be two rows above the
 * calendar saying almost the same thing: a colour key that named every gym and
 * could not be picked up, and a tray you could pick a gym up from that only
 * listed the rented ones. An operator had to learn which row answered which
 * question, and the backup gym appeared in both wearing two different tags.
 *
 * So there is one row of gym cards, and each card is the whole truth about that
 * building: its colour, its name, its courts, whether the league owns it or
 * keeps it as a backup, and how many weekends of this plan it is on.
 *
 * It does two things, and the card says which part does which:
 *  - the GRIP picks the gym up. Drag it for a mouse, tap it for a thumb, and the
 *    weekends that could really take it light up (ruling #1, 2026-08-05).
 *  - the CARD toggles the gym lens: that gym's sections and chips stay at full
 *    strength and everything else steps back, which is how "where does Six Park
 *    actually get used" gets answered in one look.
 */
export function GymList({
  gyms,
  hue,
  fillsFirst,
  armedVenueId,
  lens,
  interactive,
  onArm,
  onToggleLens,
  onDragging,
}: {
  gyms: TrayGym[]
  hue: Map<string, number>
  /** The building the league owns, if it has one. */
  fillsFirst: string | null
  armedVenueId: string | null
  /** The gyms the lens is on, by venueId. Empty is the ordinary case. */
  lens: string[]
  /** A locked season still reads the list; it just cannot pick anything up. */
  interactive: boolean
  onArm: (venueId: string | null) => void
  onToggleLens: (venueId: string) => void
  /** A mouse picked a gym up, or put it down (owner ruling 2026-08-05, #1). The
   *  drag arms the gym, so the weekends and sections that could really take it
   *  light up under the cursor instead of the operator dropping it blind. */
  onDragging?: (dragging: boolean) => void
}) {
  if (gyms.length === 0) return null
  return (
    <div
      className="border-ink-200 bg-ink-50/70 mb-2.5 rounded-xl border p-2"
      data-testid="gym-list"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-ink-500 px-0.5 text-[11px] font-bold uppercase tracking-[0.06em]">
        Your gyms · drag one onto a weekend · tap one to spotlight it
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {gyms.map((gym) => {
          const paint = hueFor(hue, gym.venueId)
          const held = armedVenueId === gym.venueId
          const lit = lens.includes(gym.venueId)
          /**
           * A BACKUP GYM IS USABLE (owner ruling 2026-08-05, #1, replacing the
           * 2026-08-04 reading of the Haber case). A pool gym attached to no
           * weekend of this plan is a gym nobody has phoned, and that is exactly
           * what a league keeps one for: dropping it on a weekend IS the operator
           * asserting they have it. Only the DOT stays hollow, because a weekend
           * is the one thing that is genuinely missing.
           */
          const backup = gym.role === "pool" && gym.weekends === 0
          return (
            <div
              key={gym.venueId}
              data-testid="gym-card"
              data-venue-id={gym.venueId}
              data-role={gym.role}
              data-availability={backup ? "backup" : "known"}
              data-lens={lit ? "1" : undefined}
              draggable={interactive}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", JSON.stringify({ venueId: gym.venueId }))
                // A frame later, never inside the event: arming draws a line
                // above this card, and moving the drag source mid-dragstart is
                // what made gyms undraggable (see armAfterDragStarts).
                armAfterDragStarts(() => {
                  onDragging?.(true)
                  onArm(gym.venueId)
                })
              }}
              onDragEnd={() => {
                onDragging?.(false)
                onArm(null)
              }}
              className={`inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-white pr-2 shadow-sm transition-colors ${
                held
                  ? "border-play-500 ring-play-400 border ring-2"
                  : lit
                    ? "border-court-500 ring-court-400 border ring-2"
                    : backup
                      ? "border-ink-400 hover:border-ink-500 border-2"
                      : "border-ink-300 hover:border-ink-400 border"
              }`}
            >
              {/* THE GRIP IS THE PICK-UP (owner ruling 2026-08-06, #1). A card
                  that both places a gym and spotlights it needs to say which
                  part does which, and a thumb needs a target for the half that
                  cannot be dragged. */}
              {interactive && (
                <button
                  type="button"
                  data-testid="gym-grab"
                  aria-pressed={held}
                  aria-label={`Pick up ${gym.name} to place it on a weekend`}
                  title={`Pick up ${gym.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onArm(held ? null : gym.venueId)
                  }}
                  className="text-ink-400 hover:text-ink-800 inline-flex min-h-[40px] cursor-grab items-center px-1.5 active:cursor-grabbing"
                >
                  <svg viewBox="0 0 10 16" aria-hidden focusable="false" className="h-4 w-2.5">
                    <circle cx="3" cy="4" r="1.1" fill="currentColor" />
                    <circle cx="7" cy="4" r="1.1" fill="currentColor" />
                    <circle cx="3" cy="8" r="1.1" fill="currentColor" />
                    <circle cx="7" cy="8" r="1.1" fill="currentColor" />
                    <circle cx="3" cy="12" r="1.1" fill="currentColor" />
                    <circle cx="7" cy="12" r="1.1" fill="currentColor" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                data-testid={lit ? "gym-lens" : "gym-lens-toggle"}
                data-venue-id={gym.venueId}
                aria-pressed={lit}
                aria-label={`Spotlight ${gym.name} on the calendar`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLens(gym.venueId)
                }}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 py-1 pl-0.5 text-left"
              >
                <i
                  aria-hidden
                  className={`h-2.5 w-2.5 flex-none rounded-full ${
                    backup ? "border-ink-400 border border-dashed" : paint.swatch
                  }`}
                />
                <span className={`text-[13px] font-bold ${backup ? "text-ink-900" : paint.name}`}>
                  {gym.name}
                </span>
                <span className="text-ink-400 text-[11px] font-semibold tabular-nums">
                  {courtsWord(gym.courts)}
                </span>
                {gym.venueId === fillsFirst && (
                  <span
                    data-testid="gym-home-tag"
                    className="border-ink-300 text-ink-600 rounded-md border px-1 text-[10.5px] font-bold"
                  >
                    home gym
                  </span>
                )}
                {backup && (
                  <span
                    data-testid="gym-backup-tag"
                    className="border-ink-400 bg-ink-100 text-ink-700 rounded-md border px-1 text-[10.5px] font-bold"
                  >
                    backup
                  </span>
                )}
                <span className="text-ink-400 text-[11px] font-semibold tabular-nums">
                  on {weekendsWord(gym.weekends)}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------- the correcting verb ---------------------------- */

/**
 * "I DON'T HAVE THIS" (owner ruling 2026-08-04).
 *
 * The one thing a planning board cannot know: a gym with six courts on the
 * floor only offered three this Saturday. Every other number on the screen is
 * derived, so the correction goes in at the source — the courts this gym gives
 * on this weekend — and the whole board repacks around it.
 *
 * The stepper stops at the courts the season actually holds there, because this
 * is a correction downward: a gym cannot lend courts it does not have, and a
 * board that let somebody type 12 would be planning a season on a fiction.
 */
export function CourtCorrection({
  gymName,
  weekendLabel,
  wired,
  current,
  onApply,
  testId = "court-correction",
}: {
  gymName: string
  weekendLabel: string
  /** Courts the season holds here: the ceiling, and what "all of them" means. */
  wired: number
  /** Courts the working copy is planning on right now. */
  current: number
  onApply: (courts: number) => void
  testId?: string
}) {
  return (
    <ActionPopover
      label={`How many courts ${gymName} can give on ${weekendLabel}`}
      testId={testId}
      width={252}
      trigger={<QuietAction>I do not have this</QuietAction>}
    >
      {(close) => (
        <CourtCorrectionBody
          gymName={gymName}
          weekendLabel={weekendLabel}
          wired={wired}
          current={current}
          onApply={(n) => {
            onApply(n)
            close()
          }}
          onCancel={close}
        />
      )}
    </ActionPopover>
  )
}

function CourtCorrectionBody({
  gymName,
  weekendLabel,
  wired,
  current,
  onApply,
  onCancel,
}: {
  gymName: string
  weekendLabel: string
  wired: number
  current: number
  onApply: (courts: number) => void
  onCancel: () => void
}) {
  const [courts, setCourts] = useState(Math.max(0, Math.min(wired, current)))
  const step = (delta: number) => setCourts((n) => Math.max(0, Math.min(wired, n + delta)))
  return (
    <div>
      <p className="text-ink-900 text-[12.5px] font-bold">How many courts can you actually get?</p>
      <p className="text-ink-500 mt-0.5 text-[11.5px]">
        {gymName} on {weekendLabel}. This weekend only.
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          data-testid="court-step-down"
          aria-label="One court fewer"
          disabled={courts <= 0}
          onClick={() => step(-1)}
          className="border-ink-200 text-ink-700 hover:bg-ink-50 h-10 w-10 rounded-lg border text-lg font-bold disabled:opacity-40"
        >
          &minus;
        </button>
        <span
          data-testid="court-step-value"
          className="text-ink-900 min-w-[2.5rem] text-center text-[20px] font-bold tabular-nums"
        >
          {courts}
        </span>
        <button
          type="button"
          data-testid="court-step-up"
          aria-label="One court more"
          disabled={courts >= wired}
          onClick={() => step(1)}
          className="border-ink-200 text-ink-700 hover:bg-ink-50 h-10 w-10 rounded-lg border text-lg font-bold disabled:opacity-40"
        >
          +
        </button>
        <span className="text-ink-400 text-[11.5px] font-semibold tabular-nums">
          of {courtsWord(wired)} we hold
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          data-testid="court-correction-apply"
          onClick={() => onApply(courts)}
          className="border-court-300 bg-court-50 text-court-800 hover:bg-court-100 min-h-[36px] rounded-lg border px-3 text-[12px] font-bold"
        >
          {courts === 0 ? "They have nothing" : `That is ${courtsWord(courts)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-ink-500 hover:text-ink-800 min-h-[36px] px-1 text-[12px] font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/* --------------------- this gym, on this one date ------------------------- */

/**
 * THE ⋯ MENU ON EVERY GYM SECTION (owner ruling 2026-08-06, #5).
 *
 * Everything about ONE gym on ONE date, where an operator is already looking: the
 * hours it runs that weekend, and how many of its courts we hold. Both are facts
 * only the person who phoned the gym knows, and both used to live somewhere else
 * (the hours in a disclosure at the foot of the page that moved every gym on
 * every weekend, the courts behind a link that could only ever go down).
 *
 * The courts stepper is TWO WAY, and the two directions mean different things:
 *  - DOWN is the correction that already existed: the gym has six on the floor
 *    and offered three, so capacity shrinks and whatever no longer fits comes
 *    back as games looking for a building.
 *  - UP is the operator saying they rented more of the building than the games
 *    needed. Capacity was never the constraint there, so nothing repacks; the
 *    section reads "4 used of 6 rented" and the ask sheet asks for six.
 */
/**
 * SOMEWHERE ELSE THIS WEEKEND (owner ruling 2026-08-06, #4). One row per other
 * building in the roster that has room for these games on this date, priced in
 * the courts it would take and labelled with what booking it would be.
 *
 * SAME WEEKEND ONLY, deliberately. Moving to another DATE is what dragging is
 * for, and a menu that offered both would be a list of every gym times every
 * Saturday of the season.
 */
export interface MoveTarget {
  venueId: string
  name: string
  /** Courts these games would take in that building. */
  courts: number
  /** What moving there would be: a booking the league has, one the solver
   *  assumed, or a claim the operator is making by choosing it. */
  status: "booked" | "assumed" | "asserts"
  /** What this building is doing on this weekend, in the operator's words: what
   *  it is already holding, or what taking it would mean. */
  note: string
  /** The games already in it leave no room. The ONE reason a row is refused
   *  (owner ruling 2026-08-06): occupancy, never availability. */
  full: boolean
}

const MOVE_STATUS: Record<MoveTarget["status"], { words: string; tone: string }> = {
  booked: { words: "booked", tone: "border-court-200 bg-court-50 text-court-800" },
  assumed: { words: "assumed", tone: "border-gold-400 bg-gold-50 text-ink-800" },
  asserts: { words: "new booking", tone: "border-ink-200 bg-ink-50 text-ink-500" },
}

/**
 * THE BUTTON MOVES THINGS; THE DOTS DESCRIBE THEM (owner ruling 2026-08-06).
 *
 * One control, two rows, and they are the only two places a block can go:
 *
 *  - ANOTHER GYM, THIS WEEKEND. Every gym in the roster, because availability
 *    stopped being a gate: the ones this weekend already has show what they are
 *    holding, and the ones it does not say what taking them would mean. Only
 *    occupancy can grey a row out.
 *  - ANOTHER WEEKEND. Not a list — a list of every Saturday times every gym is
 *    not a menu — so it arms the section and the board lights the dates that can
 *    take it. Tapping one lands it, exactly as the drag always did.
 *
 * It replaces "Move all…", which said what it did only if you already knew.
 */
export function MoveMenu({
  gymName,
  weekendLabel,
  armed,
  targets,
  onMoveTo,
  onArmForWeekend,
}: {
  gymName: string
  weekendLabel: string
  /** This section is already picked up and waiting for a date. */
  armed: boolean
  /** Worked out when the menu opens, so it never offers a room that has since
   *  filled. Every roster gym, with what taking it would be. */
  targets: () => MoveTarget[]
  onMoveTo: (venueId: string) => void
  onArmForWeekend: () => void
}) {
  return (
    <ActionPopover
      label={`Move the ${gymName} block on ${weekendLabel}`}
      testId="move-menu"
      width={300}
      trigger={
        <button
          type="button"
          data-testid="move-menu-trigger"
          aria-pressed={armed}
          /* MOVE IS A VERB, SO IT WEARS THE ACTION COLOUR (owner ruling
             2026-08-06). Armed adds the ring; the resting state is still
             unmistakably a button. */
          className={`${BTN_SECONDARY} min-h-[32px] rounded-md px-2 text-[10.5px] ${
            armed ? "ring-play-400 bg-play-50 ring-2" : ""
          }`}
        >
          Move
        </button>
      }
    >
      {(close) => (
        <MoveMenuBody
          gymName={gymName}
          targets={targets()}
          onMoveTo={(venueId) => {
            onMoveTo(venueId)
            close()
          }}
          onArmForWeekend={() => {
            onArmForWeekend()
            close()
          }}
        />
      )}
    </ActionPopover>
  )
}

function MoveMenuBody({
  gymName,
  targets,
  onMoveTo,
  onArmForWeekend,
}: {
  gymName: string
  targets: MoveTarget[]
  onMoveTo: (venueId: string) => void
  onArmForWeekend: () => void
}) {
  return (
    <div>
      <p className="text-ink-500 mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em]">
        To another gym, this weekend
      </p>
      {targets.length === 0 ? (
        <p className="text-ink-500 text-[11.5px]" data-testid="move-to-empty">
          No other gym has room this weekend. Move it to another weekend instead, or add gym time.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {targets.map((t) => (
            <button
              key={t.venueId}
              type="button"
              data-testid="move-to-option"
              data-venue-id={t.venueId}
              data-status={t.status}
              disabled={t.full}
              onClick={() => onMoveTo(t.venueId)}
              className="border-ink-200 hover:border-court-400 hover:bg-court-50 flex min-h-[40px] w-full cursor-pointer items-center gap-2 rounded-lg border bg-white px-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-ink-200 disabled:hover:bg-white"
            >
              <span className="min-w-0 flex-1">
                <span className="text-ink-900 block truncate text-[12px] font-bold">{t.name}</span>
                <span className="text-ink-500 block text-[10.5px]">{t.note}</span>
              </span>
              <span
                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10.5px] font-bold ${MOVE_STATUS[t.status].tone}`}
              >
                {MOVE_STATUS[t.status].words}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="border-ink-100 mt-2.5 border-t pt-2.5">
        <p className="text-ink-500 mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em]">
          To another weekend
        </p>
        <button
          type="button"
          data-testid="move-to-weekend"
          onClick={onArmForWeekend}
          className="border-ink-200 hover:border-court-400 hover:bg-court-50 flex min-h-[40px] w-full cursor-pointer items-center rounded-lg border bg-white px-2 text-left text-[12px] font-bold transition-colors"
        >
          <span>
            Pick a date for the {gymName} block
            <span className="text-ink-500 block text-[10.5px] font-semibold">
              The dates that can take it light up. Tap one to land it.
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

export function GymMenu({
  gymName,
  weekendLabel,
  wired,
  courts,
  usedCourts,
  hours,
  hoursOverridden,
  fridayCourts,
  onCourts,
  onHours,
  onResetHours,
  onDropFriday,
}: {
  gymName: string
  weekendLabel: string
  /** Courts on the floor at this gym: the ceiling either direction stops at. */
  wired: number
  /** Courts the plan holds here on this date right now. */
  courts: number
  /** Courts the games in this section actually need. */
  usedCourts: number
  /** The window this gym runs on this date, as the board has it. */
  hours: { startTime: string; endTime: string }
  /** True when those hours are this date's own, not the gym's usual range. */
  hoursOverridden: boolean
  /** Courts held on the Friday evening here, when this session took one. */
  fridayCourts?: number
  onCourts: (courts: number) => void
  onHours: (startTime: string, endTime: string) => void
  onResetHours: () => void
  onDropFriday?: () => void
}) {
  return (
    <ActionPopover
      label={`${gymName} on ${weekendLabel}: its hours and its courts`}
      testId="gym-menu"
      width={284}
      trigger={
        <QuietAction>
          <span aria-hidden className="px-0.5 text-[13px] leading-none">
            ⋯
          </span>
        </QuietAction>
      }
    >
      {(close) => (
        <GymMenuBody
          gymName={gymName}
          weekendLabel={weekendLabel}
          wired={wired}
          courts={courts}
          usedCourts={usedCourts}
          hours={hours}
          hoursOverridden={hoursOverridden}
          fridayCourts={fridayCourts}
          onDropFriday={
            onDropFriday &&
            (() => {
              onDropFriday()
              close()
            })
          }
          onCourts={(n) => {
            onCourts(n)
            close()
          }}
          onHours={(start, end) => {
            onHours(start, end)
            close()
          }}
          onResetHours={() => {
            onResetHours()
            close()
          }}
        />
      )}
    </ActionPopover>
  )
}

function GymMenuBody({
  gymName,
  weekendLabel,
  wired,
  courts,
  usedCourts,
  hours,
  hoursOverridden,
  fridayCourts,
  onCourts,
  onHours,
  onResetHours,
  onDropFriday,
}: {
  gymName: string
  weekendLabel: string
  wired: number
  courts: number
  usedCourts: number
  hours: { startTime: string; endTime: string }
  hoursOverridden: boolean
  fridayCourts?: number
  onCourts: (courts: number) => void
  onHours: (startTime: string, endTime: string) => void
  onResetHours: () => void
  onDropFriday?: () => void
}) {
  const [held, setHeld] = useState(Math.max(0, Math.min(wired, courts)))
  const [start, setStart] = useState(hours.startTime)
  const [end, setEnd] = useState(hours.endTime)
  const step = (delta: number) => setHeld((n) => Math.max(0, Math.min(wired, n + delta)))
  const badWindow = start >= end
  return (
    <div>
      {/* THE DOTS DESCRIBE THINGS; THE BUTTON MOVES THEM (owner ruling
          2026-08-06). Move used to live in here, which put a verb inside a menu
          of facts and left the operator hunting for it. It is its own control on
          the section header now, and everything left here is about this gym on
          this date and changes nothing about where anything plays. */}
      <p
        className="text-ink-400 mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em]"
        data-testid="gym-menu-group"
      >
        This gym, this date
      </p>
      {/* THE FRIDAY THIS SESSION TOOK (owner ruling 2026-08-06). The rail is
          where one is accepted; this is where it is changed or given back. */}
      {(fridayCourts ?? 0) > 0 && onDropFriday && (
        <div className="border-court-200 bg-court-50 mb-2.5 rounded-lg border px-2 py-1.5">
          <p className="text-ink-800 text-[11.5px] font-bold">
            Friday evening: {courtsWord(fridayCourts as number)}, 6-10 PM
          </p>
          <button
            type="button"
            data-testid="drop-friday"
            onClick={onDropFriday}
            className="border-ink-400 text-ink-900 hover:border-hoop-500 hover:bg-hoop-50 mt-1.5 inline-flex min-h-[32px] cursor-pointer items-center rounded-lg border bg-white px-2.5 text-[11.5px] font-bold shadow-sm transition-colors"
          >
            Take the Friday back off
          </button>
        </div>
      )}
      <p className="text-ink-900 text-[12.5px] font-bold">
        {gymName} on {weekendLabel}
      </p>
      <p className="text-ink-500 mt-0.5 text-[11.5px]">This date only. Nothing else moves.</p>

      {/* WHEN IT IS OPEN, that weekend. */}
      <p className="text-ink-400 mt-2.5 text-[11px] font-bold uppercase tracking-[0.06em]">
        Hours this date
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <input
          type="time"
          data-testid="gym-hours-start"
          aria-label={`When ${gymName} opens on ${weekendLabel}`}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="border-ink-200 text-ink-900 min-h-[36px] rounded-lg border px-2 text-[12px] font-semibold tabular-nums"
        />
        <span className="text-ink-400 text-[11.5px] font-semibold">to</span>
        <input
          type="time"
          data-testid="gym-hours-end"
          aria-label={`When ${gymName} closes on ${weekendLabel}`}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="border-ink-200 text-ink-900 min-h-[36px] rounded-lg border px-2 text-[12px] font-semibold tabular-nums"
        />
      </div>
      {badWindow && (
        <p className="text-hoop-700 mt-1 text-[11px] font-semibold">
          That would close the gym before it opens.
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="gym-hours-apply"
          disabled={badWindow || (start === hours.startTime && end === hours.endTime)}
          onClick={() => onHours(start, end)}
          className="border-court-300 bg-court-50 text-court-800 hover:bg-court-100 min-h-[36px] cursor-pointer rounded-lg border px-3 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Set these hours
        </button>
        {hoursOverridden && (
          <button
            type="button"
            data-testid="gym-hours-reset"
            onClick={onResetHours}
            className="text-ink-500 hover:text-ink-800 min-h-[36px] cursor-pointer px-1 text-[12px] font-semibold underline decoration-dotted underline-offset-2"
          >
            Back to its usual hours
          </button>
        )}
      </div>

      {/* HOW MUCH OF IT WE HOLD, that weekend. */}
      <p className="text-ink-400 mt-3 text-[11px] font-bold uppercase tracking-[0.06em]">
        Courts this date
      </p>
      <p className="text-ink-500 mt-0.5 text-[11.5px]">
        The games here need {courtsWord(usedCourts)}. Fewer if the gym could not give them all,
        more if you rented more of the building.
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          data-testid="court-step-down"
          aria-label="One court fewer"
          disabled={held <= 0}
          onClick={() => step(-1)}
          className="border-ink-200 text-ink-700 hover:bg-ink-50 h-10 w-10 cursor-pointer rounded-lg border text-lg font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          &minus;
        </button>
        <span
          data-testid="court-step-value"
          className="text-ink-900 min-w-[2.5rem] text-center text-[20px] font-bold tabular-nums"
        >
          {held}
        </span>
        <button
          type="button"
          data-testid="court-step-up"
          aria-label="One court more"
          disabled={held >= wired}
          onClick={() => step(1)}
          className="border-ink-200 text-ink-700 hover:bg-ink-50 h-10 w-10 cursor-pointer rounded-lg border text-lg font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
        <span className="text-ink-400 text-[11.5px] font-semibold tabular-nums">
          of {courtsWord(wired)} on the floor
        </span>
      </div>
      <button
        type="button"
        data-testid="court-correction-apply"
        onClick={() => onCourts(held)}
        className="border-court-300 bg-court-50 text-court-800 hover:bg-court-100 mt-2 min-h-[36px] cursor-pointer rounded-lg border px-3 text-[12px] font-bold"
      >
        {held === 0
          ? "They have nothing"
          : held > usedCourts
            ? `We rented ${courtsWord(held)}`
            : `That is ${courtsWord(held)}`}
      </button>
    </div>
  )
}

/* -------------------------- the breaking verb ----------------------------- */

/** One way of breaking a run of games up, with what it would cost. */
export interface SplitAxis {
  key: "gyms" | "weekends"
  label: string
  /** What it would do, in the operator's own words. */
  detail: string | null
  /** The price, already composed by the pure core. Null when the axis cannot
   *  be taken, in which case `detail` is the reason. */
  price: string | null
  onApply: () => void
}

/**
 * BREAK (owner ruling 2026-08-04). The solver never splits a weekend across two
 * buildings or a month across two weekends: both cost real money and it is
 * built to avoid them. This is the operator overruling that, and it is the only
 * thing that can.
 *
 * The price comes first, every time. An axis that cannot be taken says why
 * instead of costing nothing, because a greyed button with no reason is the
 * board keeping a secret.
 */
export function SplitMenu({
  what,
  axes,
  testId = "split-menu",
}: {
  /** What is being broken up, named: "Grade 10" or "the Six Park block". */
  what: string
  /** Computed lazily by the caller, so the board is not pricing a split nobody
   *  has asked for on every render. */
  axes: () => SplitAxis[]
  testId?: string
}) {
  return (
    <ActionPopover
      label={`Split ${what}`}
      testId={testId}
      width={274}
      trigger={<QuietAction>Split…</QuietAction>}
    >
      {(close) => (
        <div>
          <p className="text-ink-900 text-[12.5px] font-bold">Split {what}</p>
          <p className="text-ink-500 mt-0.5 text-[11.5px]">
            The planner keeps a group together because two of anything costs more. You can overrule
            it.
          </p>
          <div className="mt-2 space-y-1.5">
            {axes().map((axis) => (
              <div
                key={axis.key}
                data-testid={`split-axis-${axis.key}`}
                data-enabled={axis.price !== null}
                className={`rounded-lg border px-2.5 py-2 ${
                  axis.price !== null ? "border-ink-200 bg-white" : "border-ink-100 bg-ink-50"
                }`}
              >
                <p
                  className={`text-[12px] font-bold ${
                    axis.price !== null ? "text-ink-900" : "text-ink-400"
                  }`}
                >
                  {axis.label}
                </p>
                {axis.detail && <p className="text-ink-500 mt-0.5 text-[11px]">{axis.detail}</p>}
                {axis.price !== null && (
                  <>
                    <p
                      className="text-gold-600 mt-1 text-[11px] font-bold"
                      data-testid={`split-price-${axis.key}`}
                    >
                      {axis.price}
                    </p>
                    <button
                      type="button"
                      data-testid={`split-apply-${axis.key}`}
                      onClick={() => {
                        axis.onApply()
                        close()
                      }}
                      className="border-play-300 bg-play-50 text-play-700 hover:bg-play-100 mt-1.5 min-h-[36px] rounded-lg border px-2.5 text-[12px] font-bold"
                    >
                      Do it
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </ActionPopover>
  )
}
