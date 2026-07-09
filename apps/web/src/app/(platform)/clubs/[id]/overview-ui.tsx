"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { ReactNode } from "react"

/** Counts up from 0 to `value` on mount (respects reduced-motion). */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
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
    const duration = 750
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
  }, [value])

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {n}
    </span>
  )
}

type Tone = "court" | "play" | "hoop" | "ink"

const TONES: Record<Tone, { chip: string; num: string; ring: string }> = {
  court: { chip: "bg-court-50 text-court-600", num: "text-court-700", ring: "group-hover:border-court-200" },
  play: { chip: "bg-play-50 text-play-600", num: "text-play-700", ring: "group-hover:border-play-200" },
  hoop: { chip: "bg-hoop-50 text-hoop-600", num: "text-hoop-600", ring: "group-hover:border-hoop-200" },
  ink: { chip: "bg-ink-100 text-ink-700", num: "text-ink-800", ring: "group-hover:border-ink-300" },
}

const ICONS: Record<string, ReactNode> = {
  teams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  tryouts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" strokeLinejoin="round" />
      <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  offers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" strokeLinecap="round" />
    </svg>
  ),
}

export function StatTile({
  href,
  value,
  label,
  sub,
  subTone,
  tone,
  icon,
  delay = 0,
}: {
  href: string
  value: number
  label: string
  sub?: string | null
  subTone?: "hoop" | "play" | "ink"
  tone: Tone
  icon: keyof typeof ICONS
  delay?: number
}) {
  const t = TONES[tone]
  const subCls =
    subTone === "hoop"
      ? "text-hoop-700 bg-hoop-50"
      : subTone === "play"
        ? "text-play-700 bg-play-50"
        : "text-ink-500 bg-ink-50"
  return (
    <Link
      href={href}
      style={{ animationDelay: `${delay}ms` }}
      className={`reveal group border-ink-100 relative block overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_60px_-32px_rgba(15,23,42,0.5)] ${t.ring}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${t.chip}`}>{ICONS[icon]}</span>
        {sub && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${subCls}`}>{sub}</span>
        )}
      </div>
      <div className={`font-condensed text-4xl font-bold leading-none ${t.num}`}>
        <AnimatedNumber value={value} />
      </div>
      <div className="text-ink-500 mt-1.5 text-sm font-medium">{label}</div>
    </Link>
  )
}
