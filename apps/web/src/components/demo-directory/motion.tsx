"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react"
import { cn } from "@/components/ui/cn"

/* ── Reduced motion ──────────────────────────────────────────────────────── */

/**
 * True when the viewer asked their system for less motion. Every animated part
 * of this kit reads it and renders the FINAL frame instead: the story still
 * tells itself through captions and finished screens, nothing slides or types.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduced
}

/* ── Playback rate ───────────────────────────────────────────────────────── */

/**
 * Playback speed (owner ruling 2026-08-16: "let fast viewers speed up").
 *
 * ONE module-level store, for the same reason the game clock is one store: a
 * demo is a single recording, and the cursor glide, the typing cadence, the
 * beat holds and the game clock all have to agree about how fast it is
 * running. Every timed part of the kit divides its wall-clock milliseconds by
 * this number.
 *
 * The choice survives the session (sessionStorage) so a viewer who set 2x on
 * one demo does not have to set it again on the next.
 */
export const DEMO_RATES = [1, 1.5, 2] as const
export type DemoRate = (typeof DEMO_RATES)[number]

const RATE_KEY = "sportshub.demo.rate"

let rate: DemoRate = 1
const rateListeners = new Set<() => void>()

/**
 * Demo time, in milliseconds of SCRIPT time.
 *
 * Wall time accumulates into it at the current rate, so a rate change never
 * makes anything reading it jump: the seconds already banked stay banked and
 * only the ones after the change run faster. Consumers that count down (the
 * game clock) read this instead of Date.now().
 */
let scaled = 0
let lastWall = 0

export function demoNow(): number {
  const now = Date.now()
  if (lastWall === 0) lastWall = now
  scaled += (now - lastWall) * rate
  lastWall = now
  return scaled
}

export function getDemoRate(): DemoRate {
  return rate
}

export function setDemoRate(next: DemoRate): void {
  if (next === rate) return
  demoNow() // bank everything elapsed at the old rate first
  rate = next
  try {
    window.sessionStorage.setItem(RATE_KEY, String(next))
  } catch {
    /* private browsing: the rate simply does not persist */
  }
  rateListeners.forEach((l) => l())
}

/** Reads the stored rate once the player is on a client. */
export function restoreDemoRate(): void {
  try {
    const stored = Number(window.sessionStorage.getItem(RATE_KEY))
    const match = DEMO_RATES.find((r) => r === stored)
    if (match) setDemoRate(match)
  } catch {
    /* no storage, no restore */
  }
}

export function useDemoRate(): DemoRate {
  const [value, setValue] = useState<DemoRate>(getDemoRate)
  useEffect(() => {
    const listener = () => setValue(getDemoRate())
    rateListeners.add(listener)
    listener()
    return () => {
      rateListeners.delete(listener)
    }
  }, [])
  return value
}

/* ── Overlay keyframes ───────────────────────────────────────────────────── */

/**
 * The two keyframes the overlays need, carried by the kit rather than the
 * global sheet: they belong to the demo player and nothing else uses them.
 *
 * Neither one translates the stage or scales a frame. The callout's entrance
 * is a 200ms fade with a 6px settle, and the emphasis ring animates OPACITY
 * only, never a transform, because a ring that grew would read as a zoom.
 */
const OVERLAY_CSS = `
@keyframes demo-callout-in {
  from {
    opacity: 0;
    transform: translate3d(var(--demo-callout-x, 0px), var(--demo-callout-y, 6px), 0) scale(0.965);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}
@keyframes demo-emphasis-pulse {
  0% { opacity: 0.2; }
  38% { opacity: 1; }
  100% { opacity: 0.55; }
}
/* The phone keyhole scrolls itself to the acting element, so its scrollbar is
   a 15px bite out of a fixed height box and nothing else. Hidden in every
   engine, not just the ones with overlay scrollbars. */
[data-demo-keyhole] {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
[data-demo-keyhole]::-webkit-scrollbar {
  display: none;
}
`

export function DemoOverlayStyles() {
  return <style data-demo-overlay-styles="true">{OVERLAY_CSS}</style>
}

/* ── Target measurement ──────────────────────────────────────────────────── */

export interface TargetRect {
  /** Target box in stage coordinates. */
  left: number
  top: number
  width: number
  height: number
  /** The target's own corner radius, so a ring around it matches its shape. */
  radius: number
  /** The stage box, for keeping overlays inside the panel. */
  stageW: number
  stageH: number
  /**
   * The part of the stage the viewer can SEE, in stage coordinates.
   *
   * On a computer that is the whole stage. Inside the phone keyhole the stage
   * is the scrolled content and the window is a 352px slot moving across it, so
   * an overlay that clamped itself to the stage would be perfectly inside a box
   * nobody is looking at.
   */
  viewLeft: number
  viewW: number
}

const same = (a: TargetRect, b: TargetRect) =>
  a.left === b.left &&
  a.top === b.top &&
  a.width === b.width &&
  a.height === b.height &&
  a.radius === b.radius &&
  a.stageW === b.stageW &&
  a.stageH === b.stageH &&
  a.viewLeft === b.viewLeft &&
  a.viewW === b.viewW

/**
 * Measures a `data-demo-target` against the stage box.
 *
 * This is the single measurement path the cursor, the emphasis ring and the
 * callout all share, so all three agree on where the target is to the pixel:
 * measured now, measured again once any frame slide has settled, and on
 * resize. The equality guard is what keeps a re-measure that found the same
 * box from re-rendering an overlay, which is where jitter would come from.
 */
export function useTargetRect(
  stageRef: RefObject<HTMLElement>,
  target: string | undefined,
  beatKey: string,
  enabled = true
): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null)

  useLayoutEffect(() => {
    if (!enabled || !target) {
      setRect(null)
      return
    }
    const stage = stageRef.current
    if (!stage) return

    /** The phone keyhole, when the stage is sitting inside one. */
    const keyhole = stage.closest<HTMLElement>("[data-demo-keyhole]")

    const measure = () => {
      const el = stage.querySelector<HTMLElement>(`[data-demo-target="${target}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      const s = stage.getBoundingClientRect()
      const raw = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
      const next: TargetRect = {
        left: r.left - s.left,
        top: r.top - s.top,
        width: r.width,
        height: r.height,
        radius: Math.min(26, raw),
        stageW: s.width,
        stageH: s.height,
        viewLeft: keyhole ? keyhole.scrollLeft : 0,
        viewW: keyhole ? keyhole.clientWidth : s.width,
      }
      setRect((prev) => (prev && same(prev, next) ? prev : next))
    }

    measure()
    /* Two settles, not one. The stage's own slides finish inside 320ms; the
       phone presentation ALSO swaps handsets under the overlay, and a second
       look costs nothing because an unchanged box re-renders nothing. */
    const settle = setTimeout(measure, 320)
    const settle2 = setTimeout(measure, 640)
    const onResize = () => measure()
    window.addEventListener("resize", onResize)
    /* And once more when the keyhole finishes panning, which is the only thing
       that moves the window. Debounced to the END of the pan on purpose: a
       measurement per scroll frame is exactly the jitter this kit bans. */
    let settle3: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      if (settle3) clearTimeout(settle3)
      settle3 = setTimeout(measure, 120)
    }
    keyhole?.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      clearTimeout(settle)
      clearTimeout(settle2)
      if (settle3) clearTimeout(settle3)
      window.removeEventListener("resize", onResize)
      keyhole?.removeEventListener("scroll", onScroll)
    }
  }, [target, beatKey, enabled, stageRef])

  return rect
}

/* ── Cursor ──────────────────────────────────────────────────────────────── */

/** When the hand reaches its target: the press lands here, and so does the
 *  callout, because a balloon that arrives before the cursor is pointing at
 *  nothing yet. */
export const CURSOR_ARRIVE_MS = 520

/**
 * The demo pointer. It glides (eased, 0.55s, from the shared .live-cursor rule
 * the frozen engine already proved), shrinks on press, throws a ripple, and
 * puts the target into its hover state on the way in.
 *
 * Targets are addressed by `data-demo-target="id"` anywhere inside the stage,
 * so a script never carries pixel coordinates and the choreography survives
 * every breakpoint and every frame scale.
 */
export function AnimatedCursor({
  stageRef,
  target,
  hover,
  press,
  beatKey,
  reduced,
}: {
  stageRef: RefObject<HTMLElement>
  target?: string
  hover?: string
  press?: boolean
  /** Changes on every beat so a repeated target still replays its press. */
  beatKey: string
  reduced: boolean
}) {
  const [down, setDown] = useState(false)
  const [ripple, setRipple] = useState(0)
  const rate = useDemoRate()

  /* One measurement path for cursor, ring and callout (see useTargetRect):
     measured now and again once any frame slide has settled, so the pointer
     lands on the position the other overlays are pointing at. The last known
     position is kept when a beat has no target, so the pointer fades out
     where it was instead of leaping to the corner. */
  const rect = useTargetRect(stageRef, target, beatKey, !reduced)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  if (rect) {
    lastPos.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }
  const pos = lastPos.current

  /* Hover state on the element the pointer is over. */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const id = hover ?? target
    const el = id
      ? stage.querySelector<HTMLElement>(`[data-demo-target="${id}"]`)
      : null
    if (el && !reduced) el.dataset.demoHover = "true"
    return () => {
      if (el) delete el.dataset.demoHover
    }
  }, [hover, target, beatKey, reduced, stageRef])

  /* The press: it lands AFTER the glide, the way a hand does. */
  useEffect(() => {
    if (reduced || !press || !target) return
    const stage = stageRef.current
    if (!stage) return
    const el = stage.querySelector<HTMLElement>(`[data-demo-target="${target}"]`)
    const t1 = setTimeout(() => {
      setDown(true)
      setRipple((r) => r + 1)
      if (el) el.dataset.demoPress = "true"
    }, CURSOR_ARRIVE_MS / rate)
    const t2 = setTimeout(() => {
      setDown(false)
      if (el) delete el.dataset.demoPress
    }, 700 / rate)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (el) delete el.dataset.demoPress
    }
  }, [press, target, beatKey, reduced, rate, stageRef])

  if (reduced || !pos) return null
  /* The glide itself is a CSS transition on .live-cursor (left, top,
     transform, opacity, in that order). Speeding the demo up has to speed the
     hand up with it, so the durations are restated here at the current rate
     rather than left at the sheet's 1x values. */
  const glide = [550, 550, 250, 300].map((ms) => `${Math.round(ms / rate)}ms`).join(", ")
  return (
    <>
      {/* A beat with no target has no hand in it. The pointer fades out where
          it was rather than sitting on the screen pointing at nothing. */}
      <div
        className={cn("live-cursor", down && "down")}
        style={{ left: pos.x, top: pos.y, opacity: target ? 1 : 0, transitionDuration: glide }}
      />
      {ripple > 0 && (
        <div key={ripple} className="live-ripple" style={{ left: pos.x, top: pos.y }} />
      )}
    </>
  )
}

/* ── Typing ──────────────────────────────────────────────────────────────── */

/**
 * Text that appears the way a person types it: character by character with a
 * slightly uneven cadence and a blinking caret, then settles. When `typing` is
 * false the full text is simply there, which is what jumping to a chapter and
 * reduced motion both need.
 */
export function TypeText({
  text,
  typing,
  className,
  placeholder,
  cps = 26,
}: {
  text: string
  typing: boolean
  className?: string
  placeholder?: string
  cps?: number
}) {
  const [shown, setShown] = useState(typing ? "" : text)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rate = useDemoRate()

  useEffect(() => {
    if (!typing) {
      setShown(text)
      return
    }
    setShown("")
    let i = 0
    const step = () => {
      i += 1
      setShown(text.slice(0, i))
      if (i < text.length) {
        // A person is not a metronome: vary the gap, pause after a space.
        // At 1.5x and 2x the same hand simply types faster.
        const base = 1000 / (cps * rate)
        const jitter = base * (0.6 + Math.random() * 0.8)
        const pause = text[i - 1] === " " ? base * 1.6 : 0
        timer.current = setTimeout(step, jitter + pause)
      }
    }
    timer.current = setTimeout(step, 220 / rate)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, typing, cps, rate])

  const empty = shown.length === 0
  return (
    <span
      className={cn(
        empty && placeholder ? "text-ink-400" : "text-ink-900",
        typing && "live-caret",
        className
      )}
    >
      {empty && placeholder ? placeholder : shown}
    </span>
  )
}

/* ── Emphasis ────────────────────────────────────────────────────────────── */

/** Extra dwell an emphasized beat buys, in script milliseconds. */
export const EMPHASIS_HOLD_MS = 1200

const RING_PAD = 6

/**
 * The gold ring around the beat's key element (owner ruling 2026-08-16:
 * "emphasize the most important thing in each step").
 *
 * It pulses exactly twice and then SETTLES at a calm opacity for the rest of
 * the beat: a ring that kept flashing would be the decorative infinite
 * animation the guidelines forbid, and one that vanished would leave the beat
 * with nothing marked. It animates opacity only, never a transform, so
 * nothing on the stage appears to grow.
 *
 * It sits under the cursor (z-30 against the pointer's z-40) so the hand is
 * never hidden by the thing pointing at it.
 */
export function EmphasisRing({
  stageRef,
  target,
  beatKey,
  reduced,
}: {
  stageRef: RefObject<HTMLElement>
  target?: string
  beatKey: string
  reduced: boolean
}) {
  const rate = useDemoRate()
  const rect = useTargetRect(stageRef, target, beatKey, Boolean(target))
  if (!rect) return null
  return (
    <div
      aria-hidden="true"
      data-demo-emphasis={target}
      className="pointer-events-none absolute z-30"
      style={{
        left: rect.left - RING_PAD,
        top: rect.top - RING_PAD,
        width: rect.width + RING_PAD * 2,
        height: rect.height + RING_PAD * 2,
        borderRadius: rect.radius + RING_PAD,
        boxShadow:
          "0 0 0 2px rgba(251,191,36,0.95), 0 0 0 7px rgba(251,191,36,0.22), 0 10px 30px -12px rgba(245,158,11,0.6)",
        opacity: reduced ? 0.8 : undefined,
        animation: reduced
          ? undefined
          : `demo-emphasis-pulse ${Math.round(1050 / rate)}ms cubic-bezier(0.4, 0, 0.2, 1) 2 both`,
      }}
    />
  )
}

/* ── Callout ─────────────────────────────────────────────────────────────── */

type CalloutSide = "below" | "above" | "right" | "left"

interface CalloutPlacement {
  side: CalloutSide
  left: number
  top: number
  /** Where the arrow sits along the card's edge, in card coordinates. */
  arrow: number
}

const CALLOUT_GAP = 12
const CALLOUT_MARGIN = 8
const ARROW = 9
const INK_100 = "#eeeef1"
/**
 * How long the balloon waits for the phone keyhole to finish panning.
 *
 * The pan starts 300ms into the beat and a smooth scroll lands inside another
 * ~350ms, so 420 clears it with room. The balloon then measures against the
 * window it is actually going to appear in, which is why it never arrives
 * clipped by the edge of the keyhole and then hops.
 */
const KEYHOLE_PAN_WAIT_MS = 420

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v))

/**
 * Where the balloon goes: beside the target, never on it, never off the panel.
 *
 * Below is preferred because a card reads down from the thing it explains.
 * When there is no room the card flips above, then beside, and only a target
 * with room nowhere falls back to the roomier half of the stage.
 */
function placeCallout(rect: TargetRect, size: { w: number; h: number }): CalloutPlacement {
  const { stageH } = rect
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  /* Horizontally the balloon belongs to the VISIBLE window, which on a computer
     is the whole stage and inside the keyhole is the slot the viewer is looking
     through. Vertically the stage and the window are the same box: nothing
     scrolls up and down. */
  const minLeft = rect.viewLeft + CALLOUT_MARGIN
  const maxLeft = rect.viewLeft + rect.viewW - CALLOUT_MARGIN - size.w
  const maxTop = stageH - CALLOUT_MARGIN - size.h

  const below = rect.top + rect.height + CALLOUT_GAP
  const above = rect.top - CALLOUT_GAP - size.h
  const right = rect.left + rect.width + CALLOUT_GAP
  const left = rect.left - CALLOUT_GAP - size.w

  let side: CalloutSide
  if (below + size.h <= stageH - CALLOUT_MARGIN) side = "below"
  else if (above >= CALLOUT_MARGIN) side = "above"
  else if (right <= maxLeft) side = "right"
  else if (left >= minLeft) side = "left"
  else side = cy > stageH / 2 ? "above" : "below"

  if (side === "below" || side === "above") {
    const x = clamp(cx - size.w / 2, minLeft, maxLeft)
    const y = clamp(side === "below" ? below : above, CALLOUT_MARGIN, maxTop)
    return { side, left: x, top: y, arrow: clamp(cx - x, 18, size.w - 18) }
  }
  const y = clamp(cy - size.h / 2, CALLOUT_MARGIN, maxTop)
  const x = clamp(side === "right" ? right : left, minLeft, maxLeft)
  return { side, left: x, top: y, arrow: clamp(cy - y, 18, size.h - 18) }
}

/** The arrow: a rotated square with the two outward edges bordered, so it
 *  reads as the card's own corner rather than a separate dot. */
function arrowStyle(place: CalloutPlacement): CSSProperties {
  const half = ARROW / 2 + 0.5
  /* All four widths are always written as LONGHANDS, never as `borderWidth: 0`
     plus a side. A balloon that flips between beats (below on one, right on
     the next) re-renders this same node, and React warns, loudly and in the
     console, when it has to remove a longhand while the shorthand is also
     set: "don't mix shorthand and non-shorthand properties for the same
     value". Four explicit numbers cost nothing and keep the playback console
     clean, which is a release gate for the demo directory. */
  const sides = (top: number, right: number, bottom: number, left: number): CSSProperties => ({
    position: "absolute",
    width: ARROW,
    height: ARROW,
    background: "#ffffff",
    transform: "rotate(45deg)",
    borderStyle: "solid",
    borderColor: INK_100,
    borderTopWidth: top,
    borderRightWidth: right,
    borderBottomWidth: bottom,
    borderLeftWidth: left,
  })
  if (place.side === "below")
    return { ...sides(1, 0, 0, 1), top: -half, left: place.arrow - ARROW / 2 }
  if (place.side === "above")
    return { ...sides(0, 1, 1, 0), bottom: -half, left: place.arrow - ARROW / 2 }
  if (place.side === "right")
    return { ...sides(0, 0, 1, 1), left: -half, top: place.arrow - ARROW / 2 }
  return { ...sides(1, 1, 0, 0), right: -half, top: place.arrow - ARROW / 2 }
}

/**
 * The anchored balloon (owner ruling 2026-08-16: "tell the viewer what is
 * happening and why, at the point of action").
 *
 * The caption bar under the stage still narrates the beat. This is the local
 * layer: it arrives WITH THE HAND, sits beside the element the hand is on,
 * and leaves when the beat does. It is measured before it is shown, so it
 * never appears in one place and then hops to another.
 *
 * The player mounts it with a key per beat, which is what makes the entrance
 * replay and the exit clean.
 */
export function BeatCallout({
  stageRef,
  text,
  target,
  beatKey,
  reduced,
  delayMs,
}: {
  stageRef: RefObject<HTMLElement>
  text?: string
  target?: string
  beatKey: string
  reduced: boolean
  /** How long after the beat starts the balloon appears (already rated). */
  delayMs: number
}) {
  const rate = useDemoRate()
  const live = Boolean(text && target)
  const rect = useTargetRect(stageRef, target, beatKey, live)
  const cardRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [armed, setArmed] = useState(false)

  /* Measured from its own box before it is shown: the card decides which side
     it fits on, so it has to know how big it is first.
     `rect` is in the deps because the card is not in the DOM until the target
     has been measured, and it re-measures on a resize for the same reason. */
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
  }, [text, rect])

  /* A panning stage moves the window out from under the balloon, so on a phone
     the balloon waits for the pan to finish and is then placed against the
     window it can actually see. On a computer nothing pans and this is zero. */
  const panWait =
    live && stageRef.current?.closest("[data-demo-keyhole]") ? KEYHOLE_PAN_WAIT_MS / rate : 0

  useEffect(() => {
    if (!live) return
    if (reduced) {
      setArmed(true)
      return
    }
    const t = setTimeout(() => setArmed(true), Math.max(0, delayMs + panWait))
    return () => clearTimeout(t)
  }, [live, reduced, delayMs, panWait])

  if (!live || !rect) return null
  const place = size ? placeCallout(rect, size) : null
  const shown = Boolean(place) && armed
  const from =
    place?.side === "above"
      ? { x: "0px", y: "-6px" }
      : place?.side === "right"
        ? { x: "6px", y: "0px" }
        : place?.side === "left"
          ? { x: "-6px", y: "0px" }
          : { x: "0px", y: "6px" }

  return (
    <div
      ref={cardRef}
      role="note"
      data-demo-callout={target}
      data-demo-callout-side={place?.side}
      className="border-ink-100 border-l-gold-400 text-ink-950 pointer-events-none absolute z-50 w-max max-w-[264px] rounded-2xl border border-l-[3px] bg-white px-3.5 py-2.5 text-[14.5px] font-medium leading-snug shadow-[0_20px_44px_-20px_rgba(24,24,27,0.5),0_2px_10px_-6px_rgba(24,24,27,0.35)]"
      style={{
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        visibility: shown ? "visible" : "hidden",
        animation:
          shown && !reduced
            ? `demo-callout-in ${Math.round(210 / rate)}ms cubic-bezier(0.2, 0.8, 0.2, 1) both`
            : undefined,
        ["--demo-callout-x" as string]: from.x,
        ["--demo-callout-y" as string]: from.y,
      } as CSSProperties}
    >
      {place && <span aria-hidden="true" style={arrowStyle(place)} />}
      {text}
    </div>
  )
}

/* ── Caption ─────────────────────────────────────────────────────────────── */

/** The beat name under the stage: who is acting and what is happening. */
export function StepCaption({
  role,
  roleTone = "club",
  children,
  chapterTitle,
  quiet,
}: {
  role: string
  roleTone?: "club" | "league" | "parent" | "referee"
  children: ReactNode
  chapterTitle?: string
  /**
   * The beat is explaining itself on the stage, so this bar holds the place
   * rather than narrating: the line goes quiet and the chapter chip on the
   * right drops, because the line already IS the chapter.
   */
  quiet?: boolean
}) {
  const tones: Record<string, string> = {
    club: "bg-court-50 text-court-700 ring-court-100",
    league: "bg-play-50 text-play-700 ring-play-100",
    parent: "bg-hoop-50 text-hoop-600 ring-hoop-100",
    referee: "bg-gold-50 text-gold-600 ring-gold-100",
  }
  return (
    <div className="border-ink-100 bg-white/95 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border px-4 py-2.5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)] sm:py-3">
      <span
        className={cn(
          "mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[14px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset",
          tones[roleTone]
        )}
      >
        {role}
      </span>
      <p
        className={cn(
          "min-w-[200px] flex-1 text-[15px] font-medium leading-relaxed transition-colors duration-300 motion-reduce:transition-none",
          quiet ? "text-ink-400 font-semibold" : "text-ink-700"
        )}
      >
        {children}
      </p>
      {chapterTitle && !quiet && (
        <span className="text-ink-400 mt-1 hidden shrink-0 text-[14px] font-semibold uppercase tracking-[0.12em] sm:block">
          {chapterTitle}
        </span>
      )}
    </div>
  )
}
