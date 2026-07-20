"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"

/** Logical design width of desktop screens. Scenes are laid out at this width. */
export const DESKTOP_W = 1160
/** Logical width of the phone screen (iPhone points). */
export const PHONE_W = 390
export const PHONE_H = 844

/**
 * Renders children laid out at a fixed logical width, scaled to fit the
 * available width. Below `minFit` (phones showing a desktop screen) it
 * switches to pan mode: a readable fixed scale with horizontal scrolling,
 * auto-scrolled so the highlighted control is in view.
 */
function ScaledSurface({
  logicalWidth,
  minFit = 0.55,
  panScale = 0.78,
  fitAlways = false,
  children,
  sceneKey,
}: {
  logicalWidth: number
  minFit?: number
  panScale?: number
  /** Never switch to the pan keyhole: scale the whole screen to fit, however
      small. The live engine uses this on phones and zooms its own camera. */
  fitAlways?: boolean
  children: ReactNode
  sceneKey: string
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState(false)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const update = () => {
      const w = outer.clientWidth
      const fit = w / logicalWidth
      const usePan = !fitAlways && fit < minFit
      const s = usePan ? panScale : Math.min(1, fit)
      setPan(usePan)
      setScale(s)
      setHeight(inner.offsetHeight * s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [logicalWidth, minFit, panScale, fitAlways])

  // In pan mode, bring the highlighted control into view for each new scene.
  useEffect(() => {
    if (!pan) return
    const outer = outerRef.current
    if (!outer) return
    const target = outer.querySelector("[data-demo-advance]") as HTMLElement | null
    if (!target) return
    const t = setTimeout(() => {
      const rect = target.getBoundingClientRect()
      const host = outer.getBoundingClientRect()
      outer.scrollTo({
        left: outer.scrollLeft + rect.left - host.left - host.width / 2 + rect.width / 2,
        behavior: "smooth",
      })
    }, 350)
    return () => clearTimeout(t)
  }, [pan, sceneKey])

  return (
    <div
      ref={outerRef}
      className={cn("w-full", pan ? "overflow-x-auto overflow-y-hidden" : "overflow-hidden")}
      style={{ height: height || undefined }}
    >
      <div
        ref={innerRef}
        style={{
          width: logicalWidth,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Browser-style window for admin and operator screens. */
export function DesktopFrame({
  url,
  children,
  sceneKey,
  fitAlways,
}: {
  url: string
  children: ReactNode
  sceneKey: string
  fitAlways?: boolean
}) {
  return (
    <div className="border-ink-200 mx-auto w-full max-w-[1162px] overflow-hidden rounded-2xl border bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
      <div className="border-ink-100 bg-ink-50 flex items-center gap-3 border-b px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#f87171]" />
          <span className="h-3 w-3 rounded-full bg-[#fbbf24]" />
          <span className="h-3 w-3 rounded-full bg-[#34d399]" />
        </div>
        <div className="border-ink-200 text-ink-500 mx-auto flex min-w-0 max-w-[60%] items-center gap-1.5 truncate rounded-full border bg-white px-4 py-1 text-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="truncate">sportshubone.com{url}</span>
        </div>
      </div>
      <ScaledSurface logicalWidth={DESKTOP_W} sceneKey={sceneKey} fitAlways={fitAlways}>
        <div className="bg-ink-50/60 min-h-[560px]" style={{ width: DESKTOP_W }}>
          {children}
        </div>
      </ScaledSurface>
    </div>
  )
}

/** iPhone-style frame for parent and family screens, correct proportions. */
export function PhoneFrame({
  children,
  sceneKey,
  time = "9:41",
}: {
  children: ReactNode
  sceneKey: string
  time?: string
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const bezel = 12
  const frameW = PHONE_W + bezel * 2

  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const update = () => setScale(Math.min(1, outer.clientWidth / frameW))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [frameW])

  return (
    <div ref={outerRef} className="mx-auto w-full max-w-[414px]">
      <div
        style={{
          width: frameW,
          height: (PHONE_H + bezel * 2) * scale,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          className="rounded-[52px] bg-[#0b0b0f] p-3 shadow-[0_36px_90px_-42px_rgba(15,23,42,0.65)]"
          style={{ width: frameW, height: PHONE_H + bezel * 2 }}
        >
          <div
            className="relative flex flex-col overflow-hidden rounded-[40px] bg-white"
            style={{ width: PHONE_W, height: PHONE_H }}
          >
            {/* Status bar + dynamic island */}
            <div className="relative z-10 flex items-center justify-between px-7 pb-1 pt-3.5 text-[13px] font-semibold text-ink-900">
              <span>{time}</span>
              <div className="absolute left-1/2 top-2.5 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-[#0b0b0f]" />
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 18 12" className="h-3 w-[18px] fill-current">
                  <rect x="0" y="7" width="3" height="5" rx="0.8" />
                  <rect x="5" y="5" width="3" height="7" rx="0.8" />
                  <rect x="10" y="2.5" width="3" height="9.5" rx="0.8" />
                  <rect x="15" y="0" width="3" height="12" rx="0.8" opacity="0.35" />
                </svg>
                <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current">
                  <path d="M8 9.5a2 2 0 0 1 2 2H6a2 2 0 0 1 2-2Zm-4.6-2.9a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0L3.4 6.6ZM.6 3.8a10.5 10.5 0 0 1 14.8 0l-1.4 1.4a8.5 8.5 0 0 0-12 0L.6 3.8Z" />
                </svg>
                <svg viewBox="0 0 25 12" className="h-3 w-6">
                  <rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.4" />
                  <rect x="2" y="2" width="15" height="8" rx="1.5" className="fill-current" />
                  <rect x="22.5" y="4" width="2" height="4" rx="1" className="fill-current" opacity="0.4" />
                </svg>
              </span>
            </div>
            {/* Screen content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {/* Home indicator */}
            <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center">
              <div className="h-[5px] w-[134px] rounded-full bg-ink-900/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Live-scoring layout: the scoring console and the public live game page
 * visible together. Side by side when there is room, stacked on a phone,
 * both always on screen at once.
 */
export function DuoFrame({
  left,
  right,
  leftLabel,
  rightLabel,
  url,
  sceneKey,
}: {
  left: ReactNode
  right: ReactNode
  leftLabel: string
  rightLabel: string
  url: string
  sceneKey: string
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="min-w-0">
        <p className="text-ink-500 mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em]">
          {leftLabel}
        </p>
        <DesktopFrame url={url} sceneKey={sceneKey + "-console"}>
          {left}
        </DesktopFrame>
      </div>
      <div className="min-w-0">
        <p className="text-ink-500 mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em]">
          {rightLabel}
        </p>
        <PhoneFrame sceneKey={sceneKey + "-live"}>{right}</PhoneFrame>
      </div>
    </div>
  )
}
