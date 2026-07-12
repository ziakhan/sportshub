"use client"

import { useEffect, useState } from "react"

interface AnimatedNumberProps {
  value: number
  className?: string
  /** Count-up duration in ms (default 750). */
  duration?: number
}

/** Counts up from 0 to `value` on mount (respects reduced-motion). */
export function AnimatedNumber({ value, className, duration = 750 }: AnimatedNumberProps) {
  const [n, setN] = useState(0)

  // No run-once guard: under React 18 StrictMode the dev double-invoke ran
  // effect → cleanup (cancelling BOTH the rAF and the safety timeout) → the
  // guard then blocked the re-run, so every stat tile stuck at 0 on the dev
  // server (owner bug 2026-07-12). Restarting on the second invoke is
  // harmless — cleanup cancels the first run's timers.
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce || value <= 0) {
      setN(value)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // Safety net: guarantee the final value even if rAF is throttled (e.g. a
    // background tab / headless capture) so a number never sticks at 0.
    const safety = setTimeout(() => setN(value), duration + 150)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
    }
  }, [value, duration])

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {n}
    </span>
  )
}
