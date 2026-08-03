"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { PlacementReason } from "@/lib/scheduler/planner-core"
import { FRACTION_TONE, type FractionTone } from "./plan-shared"

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

/** Which glyph a placement reason wears. Fill order is the ordinary case and
 *  draws nothing; overflow wears the overage marker instead, because "no room"
 *  is a shortage, not a reason. */
export const REASON_GLYPH: Partial<Record<PlacementReason, ReasonGlyphName>> = {
  resident: "home",
  bumped: "moved",
  decided: "picked",
  avoided: "alternates",
}

/** The four glyphs and their words, for the one quiet legend line. */
export const GLYPH_LEGEND: Array<{ glyph: ReasonGlyphName; words: string }> = [
  { glyph: "home", words: "home gym" },
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

function placeFor(rect: DOMRect): Placement {
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - PANEL_WIDTH - 8))
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
        className={`cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-1 ${className}`}
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
