/**
 * Mock-UI kit for the walkthrough scenes: simplified shorthand of the real
 * product surfaces, sized to stay readable on a phone. Demo data only.
 *
 * Choreography classes (keyframes live in DemoPlayer's stylesheet, which
 * wraps every scene): demo-cascade staggers children in; demo-press plays a
 * button press; demo-late / demo-later reveal payoff elements (ticks, "sent"
 * chips) after the press lands. All of it collapses to final state under
 * prefers-reduced-motion.
 */

"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import { useDemoAdvance } from "./demo-advance-context"

export function Screen({ title, children, badge }: { title: string; children: ReactNode; badge?: string }) {
  return (
    <div className="border-ink-100 mx-auto w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-xl">
      <div className="border-ink-50 flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-hoop-500 h-2.5 w-2.5 flex-none rounded-full" aria-hidden="true" />
          <span className="text-ink-950 truncate text-[14px] font-bold">{title}</span>
        </div>
        {badge ? (
          <span className="bg-play-50 text-play-700 flex-none rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-3.5 sm:p-4">{children}</div>
    </div>
  )
}

/** Staggers its children in, one after another. */
export function Cascade({ children, className = "space-y-2" }: { children: ReactNode; className?: string }) {
  return <div className={`demo-cascade ${className}`}>{children}</div>
}

export function Row({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "active" | "done" }) {
  const cls =
    tone === "active"
      ? "border-play-300 bg-play-50/60"
      : tone === "done"
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-ink-100 bg-white"
  return <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border px-3 py-2 ${cls}`}>{children}</div>
}

export function Chip({
  children,
  tone = "ink",
  late,
}: {
  children: ReactNode
  tone?: "ink" | "green" | "orange" | "blue" | "gold" | "red"
  /** Pop in after the scene's button press (0 = with press, 1 = first beat after, …) */
  late?: number
}) {
  const map = {
    ink: "bg-ink-100 text-ink-600",
    green: "bg-emerald-100 text-emerald-700",
    orange: "bg-hoop-50 text-hoop-700",
    blue: "bg-play-50 text-play-700",
    gold: "bg-amber-100 text-amber-800",
    red: "bg-red-50 text-red-600",
  } as const
  const style: CSSProperties | undefined =
    late !== undefined ? { animationDelay: `${1.1 + late * 0.14}s` } : undefined
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${map[tone]} ${late !== undefined ? "demo-late" : ""}`}
      style={style}
    >
      {children}
    </span>
  )
}

export function Field({ label, value, active }: { label: string; value: ReactNode; active?: boolean }) {
  return (
    <div>
      <div className="text-ink-400 mb-0.5 text-[10.5px] font-bold uppercase tracking-wider">{label}</div>
      <div
        className={`rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold ${
          active ? "border-play-400 bg-play-50/50 text-ink-950 ring-play-100 ring-2" : "border-ink-100 text-ink-700 bg-white"
        }`}
      >
        {value}
      </div>
    </div>
  )
}

/**
 * The scene's real button. Clicking it plays the press and advances the
 * walkthrough to the screen that click would produce in the product
 * (owner 2026-07-19: clicks drive the flow, not a timer). During autoplay
 * the press animates on its own (demo-auto scoping in the player styles).
 */
export function ActionBtn({ children, secondary, press }: { children: ReactNode; secondary?: boolean; press?: boolean }) {
  const advance = useDemoAdvance()
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!advance || secondary) return
        setPressed(true)
        setTimeout(advance, 320)
      }}
      className={`inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-bold ${
        secondary ? "border-ink-200 text-ink-700 border bg-white" : "bg-ink-950 text-white shadow-lg"
      } ${press ? "demo-press" : "demo-pulse"} ${pressed ? "demo-pressed-now" : ""}`}
    >
      {children}
    </button>
  )
}

export function Avatar({ n, name }: { n: number; name: string }) {
  const tones = ["bg-play-500", "bg-hoop-500", "bg-sky-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500"]
  return (
    <span
      className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-black text-white ${tones[n % tones.length]}`}
      aria-hidden="true"
    >
      {name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)}
    </span>
  )
}

/** Compact name row used by the dense lists (10+ players). */
export function PlayerRow({
  n,
  name,
  sub,
  right,
  tone,
}: {
  n: number
  name: string
  sub?: string
  right?: ReactNode
  tone?: "plain" | "active" | "done"
}) {
  return (
    <Row tone={tone}>
      <Avatar n={n} name={name} />
      <div className="min-w-0 flex-1">
        <div className="text-ink-950 truncate text-[13px] font-bold">{name}</div>
        {sub ? <div className="text-ink-500 text-[11px]">{sub}</div> : null}
      </div>
      {right}
    </Row>
  )
}

/** Phone frame for family-side scenes. Mirrors the app shell: navy bar, brand tile. */
export function Phone({ title, children, badge }: { title: string; children: ReactNode; badge?: string }) {
  return (
    <div className="border-ink-200 mx-auto w-full max-w-[310px] overflow-hidden rounded-[26px] border bg-white shadow-xl">
      <div className="flex items-center justify-between bg-[#0b1628] px-4 pb-2 pt-2.5">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-[#1e2d4d] text-[9px] font-black text-white">
            S
            <span className="bg-hoop-500 absolute -right-0.5 -top-0.5 flex h-2 w-2 items-center justify-center rounded-[2px] text-[5px]">1</span>
          </span>
          <span className="text-[11px] font-bold text-white">SportsHub</span>
        </div>
        <span className="text-[10px] font-semibold text-white/60">9:41</span>
      </div>
      <div className="border-ink-50 flex items-center justify-between border-b px-3 py-2">
        <span className="text-ink-950 truncate text-[13px] font-bold">{title}</span>
        {badge ? (
          <span className="bg-play-50 text-play-700 flex-none rounded-full px-2 py-0.5 text-[10px] font-bold">{badge}</span>
        ) : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

/** Side-by-side stage: two screens, one moment. Stacks on phones. */
export function Split({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: ReactNode
  right: ReactNode
  leftLabel: string
  rightLabel: string
}) {
  return (
    <div className="grid w-full items-start gap-4 sm:grid-cols-2">
      <div>
        <div className="text-ink-400 mb-1.5 text-center text-[10.5px] font-black uppercase tracking-[0.14em]">{leftLabel}</div>
        {left}
      </div>
      <div>
        <div className="text-ink-400 mb-1.5 text-center text-[10.5px] font-black uppercase tracking-[0.14em]">{rightLabel}</div>
        {right}
      </div>
    </div>
  )
}

/** Value that flips after the press beat: shows `from`, then swaps to `to`. */
export function Swap({ from, to, className = "" }: { from: ReactNode; to: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-grid ${className}`}>
      <span className="demo-swap-old [grid-area:1/1]">{from}</span>
      <span className="demo-swap-new [grid-area:1/1]">{to}</span>
    </span>
  )
}

/** Chat bubble for team-comms scenes. */
export function Bubble({ who, children, mine, pinned }: { who?: string; children: ReactNode; mine?: boolean; pinned?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug ${
          mine ? "bg-play-600 text-white" : "bg-ink-50 text-ink-950"
        }`}
      >
        {who ? <div className={`text-[10.5px] font-bold ${mine ? "text-play-100" : "text-play-700"}`}>{who}{pinned ? " · 📌 pinned" : ""}</div> : null}
        {children}
      </div>
    </div>
  )
}
