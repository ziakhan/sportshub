"use client"

import { useEffect, useRef, useState } from "react"

interface AnimatedNumberProps {
  value: number
  className?: string
  /** Count-up duration in ms (default 750). */
  duration?: number
}

/** Counts up from 0 to `value` on mount (respects reduced-motion). */
export function AnimatedNumber({ value, className, duration = 750 }: AnimatedNumberProps) {
  const [n, setN] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce || value <= 0) {
      setN(value)
      return
    }
    if (started.current) return
    started.current = true
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
