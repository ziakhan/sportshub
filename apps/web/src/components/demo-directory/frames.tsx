"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { useDemoRate } from "./motion"
import type { StageMode } from "./types"

/**
 * Demo directory v2 frames (2026-08-15).
 *
 * The owner's motion law: no unnecessary panning, no unnecessary zooming, no
 * unnecessary scrolling, no jitter. So:
 *
 *   1. Every surface is laid out at a LOGICAL size and scaled once to fit. It
 *      never scrolls and never pans; if content does not fit the frame, the
 *      script is wrong, not the frame.
 *   2. The split stage reserves the phone column FROM THE FIRST FRAME. The
 *      desktop therefore never moves or rescales when the phone arrives, which
 *      is what "the stage is fixed, the content changes" means in practice.
 *   3. Only two things animate at stage level: the phone sliding into its
 *      reserved slot, and crossfades inside a frame.
 */

export const DESKTOP_W = 1120
export const DESKTOP_H = 660
export const DESKTOP_CHROME_H = 40
export const PHONE_W = 300
export const PHONE_H = 648
const PHONE_BEZEL = 10
export const PHONE_FRAME_W = PHONE_W + PHONE_BEZEL * 2
export const PHONE_FRAME_H = PHONE_H + PHONE_BEZEL * 2
const GAP = 36

const SPLIT_W = DESKTOP_W + GAP + PHONE_FRAME_W
const SPLIT_H = Math.max(DESKTOP_H, PHONE_FRAME_H)
/** Below this the two frames stack instead of sitting side by side. */
const STACK_BELOW = 780

/**
 * Fit to panel (owner ruling 2026-08-15: "too zoomed out").
 *
 * The stage is measured once at mount and again only on resize, then the whole
 * frame group is scaled by a single transform to fill the panel: most of
 * whichever axis binds first, so there is a margin but not a moat. Upscaling to
 * 1.15x is allowed because the frames are laid out in rem and a transform keeps
 * text crisp on a large display. The floor keeps a mid-size window readable.
 *
 * This scale NEVER changes during playback. The no-zoom law governs the
 * recording; this is layout, decided before the first beat.
 */
const FIT_RATIO = 0.96
const MIN_SCALE = 0.5
const MAX_SCALE = 1.15
/** Room kept for the caption bar and the beat stepper under the stage. */
const DEFAULT_RESERVE_BELOW = 170

function fitToPanel(
  availW: number,
  availH: number,
  logicalW: number,
  logicalH: number
): number {
  if (availW <= 0) return 0
  const widthFit = availW / logicalW
  const heightFit = availH > 0 ? availH / logicalH : Number.POSITIVE_INFINITY
  const bounded = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min(widthFit, heightFit) * FIT_RATIO)
  )
  // The floor may not push the stage past the panel edge.
  return Math.min(bounded, widthFit)
}

/* ── Desktop ─────────────────────────────────────────────────────────────── */

/** Browser window for league and club surfaces, the collaborative side. */
export function DesktopFrame({
  url,
  children,
  dimmed,
}: {
  url: string
  children: ReactNode
  dimmed?: boolean
}) {
  return (
    <div
      className={cn(
        "border-ink-200/80 flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.5)] transition-opacity duration-500 motion-reduce:transition-none",
        dimmed ? "opacity-55" : "opacity-100"
      )}
      style={{ width: DESKTOP_W, height: DESKTOP_H }}
    >
      <div
        className="border-ink-100 bg-ink-50 flex shrink-0 items-center gap-3 border-b px-4"
        style={{ height: DESKTOP_CHROME_H }}
      >
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#f87171]" />
          <span className="h-3 w-3 rounded-full bg-[#fbbf24]" />
          <span className="h-3 w-3 rounded-full bg-[#34d399]" />
        </div>
        {/* Wide enough for a workspace route with a query on it: a demo that
            moves between screens has to be able to READ the address it moved
            to, and an ellipsis in the middle of a route says nothing. */}
        <div className="border-ink-200 text-ink-500 mx-auto flex min-w-0 max-w-[66%] items-center gap-1.5 truncate rounded-full border bg-white px-4 py-1 text-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3 w-3 shrink-0"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="truncate">sportshubone.com{url}</span>
        </div>
        <span className="text-ink-300 text-[11px] font-semibold uppercase tracking-[0.14em]">
          Desktop
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-white">{children}</div>
    </div>
  )
}

/* ── Phone ───────────────────────────────────────────────────────────────── */

/** iPhone-proportioned frame for parent and scoring surfaces. */
export function PhoneFrame({
  children,
  time = "9:41",
}: {
  children: ReactNode
  time?: string
}) {
  return (
    <div
      className="rounded-[44px] bg-[#0b0b0f] p-[10px] shadow-[0_36px_90px_-40px_rgba(15,23,42,0.7)]"
      style={{ width: PHONE_FRAME_W, height: PHONE_FRAME_H }}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-[34px] bg-white"
        style={{ width: PHONE_W, height: PHONE_H }}
      >
        <div className="text-ink-900 relative z-20 flex shrink-0 items-center justify-between px-5 pb-1 pt-2.5 text-[11px] font-semibold">
          <span>{time}</span>
          <div className="absolute left-1/2 top-2 h-[20px] w-[74px] -translate-x-1/2 rounded-full bg-[#0b0b0f]" />
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 18 12" className="h-2.5 w-[14px] fill-current">
              <rect x="0" y="7" width="3" height="5" rx="0.8" />
              <rect x="5" y="5" width="3" height="7" rx="0.8" />
              <rect x="10" y="2.5" width="3" height="9.5" rx="0.8" />
              <rect x="15" y="0" width="3" height="12" rx="0.8" opacity="0.35" />
            </svg>
            <svg viewBox="0 0 25 12" className="h-2.5 w-5">
              <rect
                x="0.5"
                y="0.5"
                width="21"
                height="11"
                rx="3"
                fill="none"
                stroke="currentColor"
                opacity="0.4"
              />
              <rect x="2" y="2" width="15" height="8" rx="1.5" className="fill-current" />
            </svg>
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-20 flex justify-center">
          <div className="bg-ink-900/70 h-[4px] w-[104px] rounded-full" />
        </div>
      </div>
    </div>
  )
}

/* ── Split stage ─────────────────────────────────────────────────────────── */

/**
 * The fixed stage. Both frames live at logical size inside one scaled box, so
 * the whole demo is one deterministic layout at every viewport: nothing is
 * measured per element, nothing reflows mid beat.
 */
export function SplitStage({
  mode,
  hasPhone,
  soloPhone,
  desktop,
  phone,
  url,
  stageRef,
  reserveBelow = DEFAULT_RESERVE_BELOW,
  children,
}: {
  mode: StageMode
  /** Reserve the phone column even before the phone arrives. */
  hasPhone: boolean
  /** The whole demo happens on the phone: no browser window on the stage. */
  soloPhone?: boolean
  desktop: ReactNode
  phone?: ReactNode
  url: string
  /** The cursor overlay measures against this box. */
  stageRef: React.RefObject<HTMLDivElement>
  /** Pixels of panel kept free under the stage for caption and controls. */
  reserveBelow?: number
  /** Overlays: cursor, ripple, toast. */
  children?: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState({ w: 0, h: 0 })

  /* Measured at mount and on resize only. The guard against an unchanged box
     is what keeps the observer from looping when our own height changes. */
  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    let raf = 0

    const measure = () => {
      const w = Math.round(outer.clientWidth)
      const top = outer.getBoundingClientRect().top
      const h = Math.round(
        Math.max(320, (window.innerHeight || 0) - top - reserveBelow)
      )
      setPanel((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }

    measure()
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const ro = new ResizeObserver(schedule)
    ro.observe(outer)
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("resize", schedule)
    }
  }, [reserveBelow])

  const width = panel.w
  const showPhone = hasPhone && (mode === "split" || mode === "phone")
  const stacked = width > 0 && width < STACK_BELOW

  const desktopNode = (
    <DesktopFrame url={url} dimmed={mode === "phone"}>
      {desktop}
    </DesktopFrame>
  )
  const phoneNode = hasPhone ? (
    <div
      className="shrink-0 transition-all duration-[650ms] ease-out motion-reduce:transition-none"
      style={{
        width: PHONE_FRAME_W,
        opacity: showPhone ? 1 : 0,
        transform: showPhone ? "translateX(0)" : "translateX(56px)",
      }}
    >
      <PhoneFrame>{phone}</PhoneFrame>
    </div>
  ) : null

  /* A phone-only demo: one frame, centred, scaled on its own. The desktop is
     not dimmed or emptied, it is simply not part of this story. */
  if (soloPhone) {
    const scale = fitToPanel(width, panel.h, PHONE_FRAME_W, PHONE_FRAME_H)
    return (
      <div ref={outerRef} className="w-full">
        <div
          ref={stageRef}
          data-demo-stage="true"
          className="relative mx-auto overflow-hidden"
          style={
            scale
              ? { height: PHONE_FRAME_H * scale, width: "100%" }
              : { aspectRatio: `${PHONE_FRAME_W} / ${PHONE_FRAME_H}`, width: "100%" }
          }
        >
          <div
            className="absolute left-1/2 top-0 origin-top"
            style={{
              width: PHONE_FRAME_W,
              height: PHONE_FRAME_H,
              transform: `translateX(-50%) scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            <PhoneFrame>{phone}</PhoneFrame>
          </div>
          {children}
        </div>
      </div>
    )
  }

  /* Narrow screens: the two frames stack and each gets its own scale, so the
     phone stays close to life size instead of shrinking with the desktop. */
  if (stacked) {
    return (
      <div ref={outerRef} className="w-full">
        <div ref={stageRef} data-demo-stage="true" className="relative">
          <ScaledBox width={width} logicalW={DESKTOP_W} logicalH={DESKTOP_H}>
            {desktopNode}
          </ScaledBox>
          {hasPhone && (
            <div className="mt-5">
              <ScaledBox width={width} logicalW={PHONE_FRAME_W} logicalH={PHONE_FRAME_H}>
                {phoneNode}
              </ScaledBox>
            </div>
          )}
          {children}
        </div>
      </div>
    )
  }

  // One scale for the whole stage, fitted to the panel in both axes. Reserving
  // the phone column up front is what keeps the desktop frame from resizing
  // when the phone slides in.
  const logicalW = hasPhone ? SPLIT_W : DESKTOP_W
  const logicalH = hasPhone ? SPLIT_H : DESKTOP_H
  const scale = fitToPanel(width, panel.h, logicalW, logicalH)

  return (
    <div ref={outerRef} className="w-full">
      <div
        ref={stageRef}
        data-demo-stage="true"
        className="relative mx-auto overflow-hidden"
        // Before the first measure the box still reserves its shape, so the
        // stage never jumps into place on load.
        style={
          scale
            ? { height: logicalH * scale, width: "100%" }
            : { aspectRatio: `${logicalW} / ${logicalH}`, width: "100%" }
        }
      >
        <div
          className="absolute left-1/2 top-0 flex origin-top items-start"
          style={{
            width: logicalW,
            height: logicalH,
            gap: GAP,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          {desktopNode}
          {phoneNode}
        </div>

        {/* Cursor, ripple and toast sit above both frames, unscaled. */}
        {children}
      </div>
    </div>
  )
}

/* ── Scene stage (owner ruling 2026-08-16, audit D2) ─────────────────────── */

/**
 * The presentation the old homepage flow-demo proved, restated as law.
 *
 * 1. NO browser chrome and NO site header. A scene is a focused working REGION
 *    of a product screen, introduced by one slim context line. Chrome costs
 *    40 to 96 vertical pixels and buys nothing a recording needs.
 * 2. The region is composed at 1160 logical and rendered at scale 1.0 on a
 *    computer, so 14px authored text reaches the viewer as 14px. The readability
 *    audit (`scripts/demo/readability-audit.mjs`) is the gate on that promise.
 * 3. A second frame is never bought by shrinking the first. When the phone
 *    joins, the DESKTOP REGION IS COMPOSED NARROWER (900) and the phone arrives
 *    at life size beside it. Both fit the same fixed box, so the stage never
 *    resizes and the scale never moves.
 *
 * The height is the binding constraint at 1440x900: the panel under the player
 * chrome is about 640px, so the box is 600 logical tall and scenes are authored
 * to that. A taller box would silently reintroduce the shrink this exists to
 * kill.
 */
export const SCENE_BOX_H = 600
export const SCENE_WIDE_W = 1160
export const SCENE_DUO_W = 900
export const SCENE_PHONE_W = 390
const SCENE_PHONE_BEZEL = 12
export const SCENE_PHONE_FRAME_W = SCENE_PHONE_W + SCENE_PHONE_BEZEL * 2
const SCENE_GAP = 40
/** The box both layouts live in: the widest of them, so it never resizes. */
export const SCENE_BOX_W = SCENE_DUO_W + SCENE_GAP + SCENE_PHONE_FRAME_W
/** Room under the scene for the context of the player: caption and stepper. */
const SCENE_RESERVE_BELOW = 150

/* ── Phone beside phone (owner ruling 2026-08-16, game day) ──────────────── */

/**
 * The owner ruled the game-day demo onto TWO handsets: "I want to show them the
 * capability of how easy it is to keep the scoring from the phone... that
 * scorekeeper app should be both mobile", and, for the screens that are
 * desktop-first today, "even if it doesn't exist on the phone right now, can we
 * still fabricate some of those screens on the phones... two big phone screens
 * side by side".
 *
 * So the scene grows a third layout: two 390-logical handsets at scale 1.0 with
 * nothing else on the stage. Their box is NARROWER than the duo box, which is
 * what buys the pair its life size at a 1440 viewport, and each handset carries
 * a label strip UNDER it rather than a context bar inside its screen, because a
 * phone showing a browser chrome line is a phone the product does not have.
 */
export const SCENE_PHONES_LABEL_H = 34
export const SCENE_PHONES_W = SCENE_PHONE_FRAME_W * 2 + SCENE_GAP
/**
 * The pair's box is SHORTER than the single-region box, and that is the whole
 * reason it renders at scale 1.0.
 *
 * Measured on the player route at 1440x900: the panel under the controls is
 * 578px, so a 600 box can only fit by scaling to 0.963, and a 14px label
 * reaches the viewer at 13.5px. The pair is authored to 566 instead, which
 * clears 578 with room for a control row that wraps on a narrower window.
 */
export const SCENE_PHONES_BOX_H = 566

/* ── Mobile presentation (owner 08-16: "for the PC and for the mobile") ──── */

/**
 * The OLD production demo's mobile methodology, restored.
 *
 * `flow-demo/frames.tsx` scaled a 1160 logical screen to fit until the fit fell
 * under 0.55; below that it stopped shrinking and became a KEYHOLE: a fixed,
 * readable scale inside a horizontally scrollable window, auto scrolled once per
 * scene so the highlighted control sat in the middle. The owner called that
 * presentation good and workable on a phone, so it is the law here too, with
 * three corrections the new engine earns:
 *
 *   1. The follow target is the BEAT's active element (the cursor target, else
 *      the emphasized one, else the callout anchor), not a single hard coded
 *      `[data-demo-advance]` control.
 *   2. It scrolls ONCE per beat, after the beat has settled, and a second pass
 *      only corrects a destination the frames themselves moved.
 *   3. Reduced motion jumps instead of gliding.
 *
 * The scale is 0.85 rather than the old 0.78 for one measurable reason: scene
 * regions are authored to a 14px floor, and 14 x 0.78 = 10.9px, under the 11px
 * phone floor the audit gates on. 14 x 0.85 = 11.9px clears it, and 414 logical
 * of phone frame lands at 352px, which is the whole handset inside a 390px
 * viewport's keyhole.
 */
const SCENE_MIN_FIT = 0.55
export const SCENE_KEYHOLE_SCALE = 0.85
/**
 * The handset pair holds together only while it clears the same phone floor:
 * 14 x 0.8 = 11.2px. Under that the stage shows ONE handset at a time, near
 * life size, and follows whichever phone is acting. A computer is nowhere near
 * this line (a 1440 window fits the pair at 1.0), so desktop never sees it.
 */
const PHONES_MIN_FIT = 0.8
/** How long after a beat starts the keyhole pans, in script milliseconds. */
const FOLLOW_MS = 300
/** The correction pass, for beats where the frames themselves moved. */
const FOLLOW_CORRECT_MS = 760
/** Under this the view is already centred enough to leave alone. */
const FOLLOW_SLACK = 8
/** Margin kept left of a target too wide to centre, so it reads from its start. */
const FOLLOW_INSET = 12
/** How far inside the right edge such a target's centre must still land. */
const FOLLOW_EDGE = 24
/** The handset swap: fast enough to finish before overlays re measure (320ms). */
const SWAP_MS = 260

export function SceneStage({
  mode,
  phones,
  desktop,
  phone,
  context,
  frameLabels,
  stageRef,
  reserveBelow = SCENE_RESERVE_BELOW,
  focusTarget,
  beatKey,
  reduced,
  children,
}: {
  /** "duo" composes the desktop narrower and brings the phone in beside it. */
  mode: "wide" | "duo"
  /** Both surfaces are handsets: the `desktop` slot renders in the LEFT one. */
  phones?: boolean
  desktop: ReactNode
  phone?: ReactNode
  /** The slim strip over the region: "NPH Showcase League · Plan". */
  context?: string
  /** Phone pair only: what each handset is, written under its frame. */
  frameLabels?: { left: string; right: string }
  stageRef: React.RefObject<HTMLDivElement>
  reserveBelow?: number
  /**
   * `data-demo-target` of the beat's active element: the cursor's destination,
   * else the emphasized element, else the callout's anchor. The mobile
   * presentations follow it; the desktop presentation ignores it, because
   * everything is already on screen.
   */
  focusTarget?: string
  /** Changes once per beat, which is what makes the follow fire exactly once. */
  beatKey?: string
  reduced?: boolean
  children?: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState({ w: 0, h: 0 })
  /** Phone pair on a phone: which handset is on screen, 0 left or 1 right. */
  const [side, setSide] = useState<0 | 1>(0)
  const rate = useDemoRate()

  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    let raf = 0
    const measure = () => {
      const w = Math.round(outer.clientWidth)
      const top = outer.getBoundingClientRect().top
      const h = Math.round(Math.max(320, (window.innerHeight || 0) - top - reserveBelow))
      setPanel((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const ro = new ResizeObserver(schedule)
    ro.observe(outer)
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("resize", schedule)
    }
  }, [reserveBelow])

  const boxW = phones ? SCENE_PHONES_W : SCENE_BOX_W
  const boxH = phones ? SCENE_PHONES_BOX_H : SCENE_BOX_H
  const fit = panel.w > 0 ? panel.w / boxW : 0

  /* The two mobile presentations. Both are decided by measurement alone, so a
     computer never takes either branch: a 1440 window fits the wide box at
     0.96 and the handset pair at 1.0. */
  const solo = Boolean(phones) && fit > 0 && fit < PHONES_MIN_FIT
  const keyhole = !phones && fit > 0 && fit < SCENE_MIN_FIT
  /** The second handset exists on the stage from the beat that brings it in. */
  const pairLive = Boolean(phone) && mode === "duo"

  /* Never above 1: upscaling a composed region would defeat the point of
     composing it. Never below the panel either, in both axes. */
  const scale = solo
    ? Math.min(1, panel.w / SCENE_PHONE_FRAME_W)
    : keyhole
      ? SCENE_KEYHOLE_SCALE
      : panel.w > 0
        ? Math.min(1, fit, (panel.h || boxH) / boxH)
        : 0

  const deskW = mode === "duo" ? SCENE_DUO_W : SCENE_WIDE_W

  /* ── Follow the beat, once ────────────────────────────────────────────── */

  /**
   * The keyhole pan. It waits for the beat to settle, centres the active
   * element and then leaves the view alone: the destination is remembered, so
   * the correction pass is a no op unless the frames themselves moved (the
   * publish beat, where the region narrows and the phone arrives).
   */
  const wantRef = useRef<number | null>(null)
  useEffect(() => {
    if (!keyhole || !focusTarget) return
    const scroller = scrollRef.current
    const stage = stageRef.current
    if (!scroller || !stage) return
    wantRef.current = null
    let cancelled = false

    const follow = () => {
      if (cancelled) return
      const el = stage.querySelector<HTMLElement>(`[data-demo-target="${focusTarget}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      const host = scroller.getBoundingClientRect()
      const here = scroller.scrollLeft + r.left - host.left
      /* Centred, which is what a control or a chip wants. A target WIDER than
         the window cannot be centred and read at the same time: centring a
         paragraph shows the viewer its middle. So a wide one is pulled as far
         left as it can go while its centre still sits inside the window, which
         is the rule the follow gate asserts. */
      const centred = here + r.width / 2 - host.width / 2
      const fromLeft = Math.max(here - FOLLOW_INSET, centred - host.width / 2 + FOLLOW_EDGE)
      const want = Math.max(
        0,
        Math.min(
          scroller.scrollWidth - scroller.clientWidth,
          r.width > host.width ? Math.min(centred, fromLeft) : centred
        )
      )
      if (Math.abs(want - scroller.scrollLeft) < FOLLOW_SLACK) return
      if (wantRef.current !== null && Math.abs(want - wantRef.current) < FOLLOW_SLACK) return
      wantRef.current = want
      scroller.scrollTo({ left: want, behavior: reduced ? "auto" : "smooth" })
    }

    const t1 = setTimeout(follow, FOLLOW_MS / rate)
    const t2 = setTimeout(follow, FOLLOW_CORRECT_MS / rate)
    return () => {
      cancelled = true
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [keyhole, focusTarget, beatKey, reduced, rate, stageRef])

  /**
   * The window the viewer can actually see, published as CSS variables on the
   * stage box. Overlays that belong to the VIEW rather than to a target (the
   * toast) read them, so a confirmation never lands off screen in the part of
   * the scene the keyhole is not showing.
   */
  useEffect(() => {
    const scroller = scrollRef.current
    const stage = stageRef.current
    if (!keyhole || !scroller || !stage) return
    let raf = 0
    const sync = () => {
      stage.style.setProperty("--demo-view-left", `${Math.round(scroller.scrollLeft)}px`)
      stage.style.setProperty("--demo-view-w", `${Math.round(scroller.clientWidth)}px`)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(sync)
    }
    sync()
    scroller.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      scroller.removeEventListener("scroll", onScroll)
      stage.style.removeProperty("--demo-view-left")
      stage.style.removeProperty("--demo-view-w")
    }
  }, [keyhole, stageRef])

  /**
   * One handset at a time: the stage shows whichever phone the beat is acting
   * on. The engine reads it off the DOM rather than the script, so a story
   * never has to restate what its own targets already say.
   */
  useEffect(() => {
    if (!solo) return
    if (!pairLive) {
      setSide(0)
      return
    }
    const stage = stageRef.current
    if (!stage || !focusTarget) return
    const el = stage.querySelector<HTMLElement>(`[data-demo-target="${focusTarget}"]`)
    const frame = el?.closest<HTMLElement>("[data-demo-frame]")
    const which = frame?.dataset.demoFrame
    if (which === "left") setSide(0)
    else if (which === "right") setSide(1)
  }, [solo, pairLive, focusTarget, beatKey, stageRef])

  /* ── The frames ───────────────────────────────────────────────────────── */

  /* One composition, three presentations. Solo pins the left handset to its own
     column so the track alone decides which one is on screen. */
  const framesNode = phones ? (
    <>
      {/* LEFT handset. Alone on the stage it sits centred; when the
          second phone joins it slides to its own column, the same
          move the desktop region makes in duo. */}
      <div
        data-demo-frame="left"
        className="absolute top-0 transition-[left] duration-[450ms] ease-out motion-reduce:transition-none"
        style={{
          width: SCENE_PHONE_FRAME_W,
          left: solo || mode === "duo" ? 0 : (SCENE_PHONES_W - SCENE_PHONE_FRAME_W) / 2,
        }}
      >
        <ScenePhoneFrame short>{desktop}</ScenePhoneFrame>
        {frameLabels && <FrameLabel>{frameLabels.left}</FrameLabel>}
      </div>
      {phone && (
        <div
          data-demo-frame="right"
          className="absolute top-0 transition-all duration-[550ms] ease-out motion-reduce:transition-none"
          style={{
            width: SCENE_PHONE_FRAME_W,
            left: SCENE_PHONE_FRAME_W + SCENE_GAP,
            opacity: mode === "duo" ? 1 : 0,
            transform: mode === "duo" ? "translateX(0)" : "translateX(48px)",
          }}
        >
          <ScenePhoneFrame short>{phone}</ScenePhoneFrame>
          {frameLabels && <FrameLabel>{frameLabels.right}</FrameLabel>}
        </div>
      )}
    </>
  ) : (
    <>
      <div
        className="border-ink-200/70 absolute top-0 flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)] transition-[width,left] duration-[450ms] ease-out motion-reduce:transition-none"
        style={{
          width: deskW,
          left: mode === "duo" ? 0 : (SCENE_BOX_W - SCENE_WIDE_W) / 2,
          height: SCENE_BOX_H,
        }}
      >
        {context && (
          <div className="border-ink-100 bg-ink-50 text-ink-600 flex shrink-0 items-center gap-2 border-b px-5 py-2 text-[14px] font-semibold">
            <span aria-hidden="true" className="bg-court-500 h-2 w-2 shrink-0 rounded-full" />
            <span className="truncate">{context}</span>
          </div>
        )}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">{desktop}</div>
      </div>

      {phone && (
        <div
          className="absolute top-0 transition-all duration-[550ms] ease-out motion-reduce:transition-none"
          style={{
            width: SCENE_PHONE_FRAME_W,
            left: SCENE_DUO_W + SCENE_GAP,
            opacity: mode === "duo" ? 1 : 0,
            transform: mode === "duo" ? "translateX(0)" : "translateX(48px)",
          }}
        >
          <ScenePhoneFrame>{phone}</ScenePhoneFrame>
        </div>
      )}
    </>
  )

  /* ── Presentation 1: the keyhole (phones, single region) ──────────────── */

  if (keyhole) {
    return (
      <div ref={outerRef} className="w-full">
        <div
          ref={scrollRef}
          data-demo-keyhole="true"
          className="w-full overflow-x-auto overflow-y-hidden"
          style={{ height: boxH * scale }}
        >
          {/* The stage box is the SCROLLED content, not the window, so every
              overlay measures in the same coordinates the frames live in and
              the hand, the ring and the balloon pan with the scene instead of
              sliding off it. */}
          <div
            ref={stageRef}
            data-demo-stage="true"
            data-demo-focus={focusTarget}
            data-demo-scale={scale.toFixed(3)}
            className="relative"
            style={{ width: boxW * scale, height: boxH * scale }}
          >
            <div
              className="absolute left-0 top-0"
              style={{
                width: boxW,
                height: boxH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              {framesNode}
            </div>
            {children}
          </div>
        </div>
      </div>
    )
  }

  /* ── Presentation 2: one handset at a time (phones, phone pair) ───────── */

  if (solo) {
    const phoneW = SCENE_PHONE_FRAME_W * scale
    const centred = Math.max(0, (panel.w - phoneW) / 2)
    const offset = side * (SCENE_PHONE_FRAME_W + SCENE_GAP) * scale
    return (
      <div ref={outerRef} className="w-full">
        {/* The other phone stays named even while it is off stage, so the
            viewer knows the story has two of them and can go and look. The row
            is there from the first beat, dimmed until the second handset
            actually joins, because a switcher that appears halfway through
            would push the stage down the screen mid demo. */}
        {phone && frameLabels && (
          <div role="tablist" aria-label="Which phone" className="mb-1.5 flex items-stretch gap-1.5">
            {[frameLabels.left, frameLabels.right].map((label, i) => {
              const armed = i === 0 || pairLive
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={side === i}
                  disabled={!armed}
                  onClick={() => setSide(i === 1 ? 1 : 0)}
                  className={cn(
                    "relative min-w-0 flex-1 truncate rounded-full px-3 py-1.5 text-[14px] font-semibold transition-colors",
                    "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
                    "focus-visible:ring-court-600 outline-none focus-visible:ring-2",
                    !armed
                      ? "bg-ink-50 text-ink-300"
                      : side === i
                        ? "bg-ink-900 text-white"
                        : "bg-ink-100 text-ink-500 hover:text-ink-800"
                  )}
                >
                  {label.split(" · ")[0]}
                </button>
              )
            })}
          </div>
        )}
        <div
          ref={stageRef}
          data-demo-stage="true"
          data-demo-focus={focusTarget}
          data-demo-scale={scale.toFixed(3)}
          className="relative overflow-hidden"
          style={{ height: boxH * scale, width: "100%" }}
        >
          <div
            className="absolute left-0 top-0 ease-out motion-reduce:transition-none"
            style={{
              width: boxW,
              height: boxH,
              transform: `translateX(${centred - offset}px) scale(${scale})`,
              transformOrigin: "top left",
              transitionProperty: "transform",
              transitionDuration: `${SWAP_MS}ms`,
            }}
          >
            {framesNode}
          </div>
          {children}
        </div>
      </div>
    )
  }

  /* ── Presentation 3: the computer, unchanged ──────────────────────────── */

  return (
    <div ref={outerRef} className="w-full">
      <div
        ref={stageRef}
        data-demo-stage="true"
        data-demo-focus={focusTarget}
        data-demo-scale={scale ? scale.toFixed(3) : undefined}
        className="relative mx-auto overflow-hidden"
        style={
          scale
            ? { height: boxH * scale, width: "100%" }
            : { aspectRatio: `${boxW} / ${boxH}`, width: "100%" }
        }
      >
        {/* One fixed box, both layouts inside it. The frames are positioned
            ABSOLUTELY rather than laid out in a flex row, because a hidden
            phone in the flow would still claim its column and push the region
            off the stage. Wide centres the region in the box; duo narrows it,
            slides it left and brings the phone in beside it, once, at the
            publish chapter. */}
        <div
          className="absolute left-1/2 top-0 origin-top"
          style={{
            width: boxW,
            height: boxH,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          {framesNode}
        </div>

        {children}
      </div>
    </div>
  )
}

/**
 * The handset, life size in the axis that decides legibility.
 *
 * 390 logical wide at scale 1.0 is a real iPhone's point width, so phone text
 * authored at 15px is 15px on the viewer's screen. The frame is SHORTER than a
 * real handset (576 of screen, not 844) because the stage box is 600 tall at a
 * 900px viewport: a full-height handset could only fit by scaling to 0.74,
 * which is the exact failure this presentation exists to prevent. Recorded in
 * the fidelity sheet rather than hidden.
 */
function ScenePhoneFrame({
  children,
  time = "9:41",
  /** Pair layout: the frame gives up its last 34px to the label under it. */
  short,
}: {
  children: ReactNode
  time?: string
  short?: boolean
}) {
  const frameH = short ? SCENE_PHONES_BOX_H - SCENE_PHONES_LABEL_H : SCENE_BOX_H
  const screenH = frameH - SCENE_PHONE_BEZEL * 2
  return (
    <div
      className="rounded-[46px] bg-[#0b0b0f] p-[12px] shadow-[0_30px_70px_-34px_rgba(15,23,42,0.7)]"
      style={{ width: SCENE_PHONE_FRAME_W, height: frameH }}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-[34px] bg-white"
        style={{ width: SCENE_PHONE_W, height: screenH }}
      >
        <div className="text-ink-900 relative z-20 flex shrink-0 items-center justify-between px-6 pb-1 pt-3 text-[14px] font-semibold">
          <span>{time}</span>
          <div className="absolute left-1/2 top-2.5 h-[24px] w-[86px] -translate-x-1/2 rounded-full bg-[#0b0b0f]" />
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 18 12" className="h-3 w-[18px] fill-current" aria-hidden="true">
              <rect x="0" y="7" width="3" height="5" rx="0.8" />
              <rect x="5" y="5" width="3" height="7" rx="0.8" />
              <rect x="10" y="2.5" width="3" height="9.5" rx="0.8" />
              <rect x="15" y="0" width="3" height="12" rx="0.8" opacity="0.35" />
            </svg>
            <svg viewBox="0 0 25 12" className="h-3 w-6" aria-hidden="true">
              <rect
                x="0.5"
                y="0.5"
                width="21"
                height="11"
                rx="3"
                fill="none"
                stroke="currentColor"
                opacity="0.4"
              />
              <rect x="2" y="2" width="15" height="8" rx="1.5" className="fill-current" />
            </svg>
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-20 flex justify-center">
          <div className="bg-ink-900/70 h-[4px] w-[110px] rounded-full" />
        </div>
      </div>
    </div>
  )
}

/**
 * Whose handset this is, written under the frame.
 *
 * The single-region scene names its screen in a context strip along the top.
 * A phone cannot carry that strip without pretending the product ships a
 * browser bar inside the app, so the pair layout puts the same information on
 * the bench beside the phone: who is holding it, and the route they are on.
 */
function FrameLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-ink-500 flex items-center justify-center gap-2 text-[14px] font-semibold"
      style={{ height: SCENE_PHONES_LABEL_H }}
    >
      {children}
    </p>
  )
}

/** Scales one logical box to the measured width, reserving its height. */
function ScaledBox({
  width,
  logicalW,
  logicalH,
  children,
}: {
  width: number
  logicalW: number
  logicalH: number
  children: ReactNode
}) {
  const scale = width > 0 ? Math.min(1, width / logicalW) : 0
  return (
    <div
      className="relative mx-auto overflow-hidden"
      style={
        scale
          ? { height: logicalH * scale, width: "100%" }
          : { aspectRatio: `${logicalW} / ${logicalH}`, width: "100%" }
      }
    >
      <div
        className="absolute left-1/2 top-0"
        style={{
          width: logicalW,
          height: logicalH,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  )
}
