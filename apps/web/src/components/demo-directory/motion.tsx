"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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

/* ── Cursor ──────────────────────────────────────────────────────────────── */

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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [down, setDown] = useState(false)
  const [ripple, setRipple] = useState(0)

  /* Measure the target, twice: once now and once after the frames have
     finished any slide, so the pointer lands on the settled position. */
  useLayoutEffect(() => {
    if (reduced || !target) return
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const el = stage.querySelector<HTMLElement>(`[data-demo-target="${target}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      const s = stage.getBoundingClientRect()
      setPos({ x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 })
    }
    measure()
    const settle = setTimeout(measure, 320)
    const onResize = () => measure()
    window.addEventListener("resize", onResize)
    return () => {
      clearTimeout(settle)
      window.removeEventListener("resize", onResize)
    }
  }, [target, beatKey, reduced, stageRef])

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
    }, 520)
    const t2 = setTimeout(() => {
      setDown(false)
      if (el) delete el.dataset.demoPress
    }, 700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (el) delete el.dataset.demoPress
    }
  }, [press, target, beatKey, reduced, stageRef])

  if (reduced || !pos) return null
  return (
    <>
      {/* A beat with no target has no hand in it. The pointer fades out where
          it was rather than sitting on the screen pointing at nothing. */}
      <div
        className={cn("live-cursor", down && "down")}
        style={{ left: pos.x, top: pos.y, opacity: target ? 1 : 0 }}
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
        const base = 1000 / cps
        const jitter = base * (0.6 + Math.random() * 0.8)
        const pause = text[i - 1] === " " ? base * 1.6 : 0
        timer.current = setTimeout(step, jitter + pause)
      }
    }
    timer.current = setTimeout(step, 220)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, typing, cps])

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

/* ── Caption ─────────────────────────────────────────────────────────────── */

/** The beat name under the stage: who is acting and what is happening. */
export function StepCaption({
  role,
  roleTone = "club",
  children,
  chapterTitle,
}: {
  role: string
  roleTone?: "club" | "league" | "parent" | "referee"
  children: ReactNode
  chapterTitle?: string
}) {
  const tones: Record<string, string> = {
    club: "bg-court-50 text-court-700 ring-court-100",
    league: "bg-play-50 text-play-700 ring-play-100",
    parent: "bg-hoop-50 text-hoop-600 ring-hoop-100",
    referee: "bg-gold-50 text-gold-600 ring-gold-100",
  }
  return (
    <div className="border-ink-100 bg-white/95 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)]">
      <span
        className={cn(
          "mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
          tones[roleTone]
        )}
      >
        {role}
      </span>
      <p className="text-ink-700 min-w-[200px] flex-1 text-sm font-medium leading-relaxed">
        {children}
      </p>
      {chapterTitle && (
        <span className="text-ink-400 mt-1 hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] sm:block">
          {chapterTitle}
        </span>
      )}
    </div>
  )
}
