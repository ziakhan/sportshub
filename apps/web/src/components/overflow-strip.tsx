"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

/**
 * Horizontal strip without the ugly scrollbar (owner 2026-07-15: "looks
 * like a section inside a page"). Phones swipe; desktop gets edge fades +
 * chevron buttons that appear only when there is actually overflow in that
 * direction. One component so every strip behaves identically.
 */
export function OverflowStrip({
  children,
  className = "",
  wrapperClassName = "",
  tone = "light",
}: {
  children: React.ReactNode
  /** Classes for the scrolling row itself (gap, padding). `flex` + scroll handling are built in. */
  className?: string
  /** Classes for the positioned wrapper (negative margins etc.). */
  wrapperClassName?: string
  /** Match the section background so fades/chevrons blend (dark = ink-950 hero sections). */
  tone?: "light" | "dark"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [update])

  const nudge = (dir: -1 | 1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" })

  const chevron = (dir: -1 | 1) => (
    <button
      type="button"
      aria-label={dir === -1 ? "Scroll left" : "Scroll right"}
      onClick={() => nudge(dir)}
      className={`absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition md:flex ${
        tone === "dark"
          ? "border-ink-700 bg-ink-900 text-ink-300 hover:text-white"
          : "border-ink-200 text-ink-500 hover:text-ink-950 bg-white"
      } ${dir === -1 ? "left-0" : "right-0"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
        {dir === -1 ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  )

  return (
    <div className={`relative ${wrapperClassName}`}>
      {canLeft && chevron(-1)}
      {canRight && chevron(1)}
      {canLeft && (
        <div
          className={`pointer-events-none absolute left-0 top-0 z-[5] h-full w-6 bg-gradient-to-r to-transparent ${tone === "dark" ? "from-ink-950/90" : "from-white/90"}`}
        />
      )}
      {canRight && (
        <div
          className={`pointer-events-none absolute right-0 top-0 z-[5] h-full w-6 bg-gradient-to-l to-transparent ${tone === "dark" ? "from-ink-950/90" : "from-white/90"}`}
        />
      )}
      <div
        ref={ref}
        className={`flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
