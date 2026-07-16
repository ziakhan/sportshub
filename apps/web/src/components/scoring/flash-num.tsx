"use client"

import { useEffect, useRef } from "react"

/**
 * A number that pulses green whenever its value changes (Energy Pass, owner
 * 2026-07-15: "if something changes it animates so it's obvious"). Used on
 * the live game page for scores, quarter cells and box-score stats; the
 * scoring console can reuse it as-is. Corrections-flash-red is deliberately
 * NOT here yet — future pass.
 */
export function FlashNum({
  value,
  className,
}: {
  value: number | string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)

  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    const el = ref.current
    if (!el) return
    // Restart the animation even when flashes land back-to-back
    el.classList.remove("score-flash")
    void el.offsetWidth
    el.classList.add("score-flash")
  }, [value])

  return (
    <span ref={ref} className={`inline-block ${className ?? ""}`}>
      {value}
    </span>
  )
}
