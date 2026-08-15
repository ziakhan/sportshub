"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
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
        <div className="border-ink-200 text-ink-500 mx-auto flex min-w-0 max-w-[52%] items-center gap-1.5 truncate rounded-full border bg-white px-4 py-1 text-xs">
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
  desktop,
  phone,
  url,
  stageRef,
  children,
}: {
  mode: StageMode
  /** Reserve the phone column even before the phone arrives. */
  hasPhone: boolean
  desktop: ReactNode
  phone?: ReactNode
  url: string
  /** The cursor overlay measures against this box. */
  stageRef: React.RefObject<HTMLDivElement>
  /** Overlays: cursor, ripple, toast. */
  children?: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const update = () => setWidth(outer.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [])

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

  /* Narrow screens: the two frames stack and each gets its own scale, so the
     phone stays close to life size instead of shrinking with the desktop. */
  if (stacked) {
    return (
      <div ref={outerRef} className="w-full">
        <div ref={stageRef} className="relative">
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

  // One scale for the whole stage. Reserving the phone column up front is what
  // keeps the desktop frame from resizing when the phone slides in.
  const logicalW = hasPhone ? SPLIT_W : DESKTOP_W
  const logicalH = hasPhone ? SPLIT_H : DESKTOP_H
  const scale = width > 0 ? Math.min(1, width / logicalW) : 0

  return (
    <div ref={outerRef} className="w-full">
      <div
        ref={stageRef}
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
