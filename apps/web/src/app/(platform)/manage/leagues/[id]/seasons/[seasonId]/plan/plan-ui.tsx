"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { PlacementReason, RentalAsk } from "@/lib/scheduler/planner-core"
import { FRACTION_TONE, hueFor, type FractionTone } from "./plan-shared"

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
  // The building the league owns (owner ruling 2026-08-03). "resident" now
  // means it kept a RENTED gym, which is a different fact and wears no glyph:
  // the caption says it in words.
  home: "home",
  bumped: "moved",
  decided: "picked",
  avoided: "alternates",
}

/** The four glyphs and their words, for the one quiet legend line. */
export const GLYPH_LEGEND: Array<{ glyph: ReasonGlyphName; words: string }> = [
  { glyph: "home", words: "home gym, no rent" },
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

/** The status in words, in the owner's own vocabulary (2026-08-03): a rental
 *  is needed, assumed, or confirmed. */
export const BLOCK_STATUS_WORDS: Record<BlockStatus, string> = {
  needed: "needs a building",
  assumed: "assumed",
  confirmed: "confirmed",
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
        {gym ? `${gym} · ${BLOCK_STATUS_WORDS[status]}` : BLOCK_STATUS_WORDS[status]}
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
        className="text-play-700 hover:text-play-800 text-sm font-semibold"
      >
        What you need to book
      </button>
      <span className="text-ink-400 ml-2 text-[11.5px]" data-testid="ask-season">
        {season}
      </span>
      {open && (
        <div className="border-ink-100 bg-ink-50/60 mt-2 rounded-xl border p-3" data-testid="ask-sheet-body">
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
  const parts = [
    confirmed > 0 ? `${confirmed} confirmed` : null,
    assumed > 0 ? `${assumed} assumed` : null,
    needed > 0 ? `${needed} still need a building` : null,
  ].filter(Boolean)
  return (
    <span className="text-ink-500 text-xs" data-testid="block-summary">
      {total === 1 ? "1 rental block" : `${total} rental blocks`}
      {parts.length > 0 ? `: ${parts.join(" · ")}` : ""}
    </span>
  )
}

/** One gym of the pool, ready to be placed. */
export interface TrayGym {
  venueId: string
  name: string
  short: string
  /** Courts wired at this gym. */
  courts: number
  /** Weekends of the season it is actually available on. */
  weekends: number
}

/**
 * THE POOL, as something you can pick up (owner ruling 2026-08-03, the "I will
 * place them" half). Every gym the league rents, with the two numbers that
 * decide whether it can take a weekend: how many courts it has, and how many
 * weekends of the season it is free on.
 *
 * Drag for a mouse, tap-then-tap for a thumb, the same pattern the grade chips
 * already use — so the board has one way of moving things, not two.
 */
export function VenueTray({
  gyms,
  hue,
  armedVenueId,
  onArm,
}: {
  gyms: TrayGym[]
  hue: Map<string, number>
  armedVenueId: string | null
  onArm: (venueId: string | null) => void
}) {
  return (
    <div className="border-ink-100 bg-ink-50/60 mt-2 rounded-xl border p-2.5" data-testid="venue-tray">
      <p className="text-ink-400 text-[11px] font-bold uppercase tracking-[0.06em]">
        Gyms you rent
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {gyms.length === 0 && (
          <p className="text-ink-500 text-[12px]">
            No rented gyms on this season yet. Add one back in step 2.
          </p>
        )}
        {gyms.map((gym) => {
          const paint = hueFor(hue, gym.venueId)
          const on = armedVenueId === gym.venueId
          return (
            <button
              key={gym.venueId}
              type="button"
              draggable
              data-testid="tray-gym"
              data-venue-id={gym.venueId}
              aria-pressed={on}
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", JSON.stringify({ venueId: gym.venueId }))
              }
              onClick={(e) => {
                e.stopPropagation()
                onArm(on ? null : gym.venueId)
              }}
              className={`inline-flex min-h-[36px] cursor-grab items-center gap-1.5 rounded-lg border bg-white px-2 text-[12px] font-bold active:cursor-grabbing ${
                on ? "border-play-400 ring-play-400 ring-2" : "border-ink-200"
              }`}
            >
              <i aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${paint.swatch}`} />
              <span className={paint.name}>{gym.short}</span>
              <span className="text-ink-400 text-[11px] font-semibold tabular-nums">
                {courtsWord(gym.courts)}
              </span>
              <span className="text-ink-400 text-[11px] font-semibold tabular-nums">
                on {weekendsWord(gym.weekends)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
