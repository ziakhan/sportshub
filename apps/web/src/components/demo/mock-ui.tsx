/**
 * Tiny mock-UI kit for the walkthrough scenes — deliberately simplified
 * shorthand of the real product surfaces (cards, rows, chips, fake inputs)
 * so every scene reads instantly at marketing-page size. Demo data only.
 */

import type { ReactNode } from "react"

export function Screen({ title, children, badge }: { title: string; children: ReactNode; badge?: string }) {
  return (
    <div className="border-ink-100 mx-auto w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-xl">
      <div className="border-ink-50 flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="bg-hoop-500 h-2.5 w-2.5 rounded-full" aria-hidden="true" />
          <span className="text-ink-950 text-[13px] font-bold">{title}</span>
        </div>
        {badge ? (
          <span className="bg-play-50 text-play-700 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function Row({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "active" | "done" }) {
  const cls =
    tone === "active"
      ? "border-play-300 bg-play-50/60"
      : tone === "done"
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-ink-100 bg-white"
  return <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${cls}`}>{children}</div>
}

export function Chip({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "green" | "orange" | "blue" | "gold" | "red" }) {
  const map = {
    ink: "bg-ink-100 text-ink-600",
    green: "bg-emerald-100 text-emerald-700",
    orange: "bg-hoop-50 text-hoop-700",
    blue: "bg-play-50 text-play-700",
    gold: "bg-amber-100 text-amber-800",
    red: "bg-red-50 text-red-600",
  } as const
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${map[tone]}`}>{children}</span>
}

/** A fake filled-in form field. */
export function Field({ label, value, active }: { label: string; value: ReactNode; active?: boolean }) {
  return (
    <div>
      <div className="text-ink-400 mb-0.5 text-[10px] font-bold uppercase tracking-wider">{label}</div>
      <div
        className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold ${
          active ? "border-play-400 bg-play-50/50 text-ink-950 ring-2 ring-play-100" : "border-ink-100 text-ink-700 bg-white"
        }`}
      >
        {value}
      </div>
    </div>
  )
}

/** The "this is what you click" button — pulses gently to draw the eye. */
export function ActionBtn({ children, secondary }: { children: ReactNode; secondary?: boolean }) {
  return (
    <span
      className={`demo-pulse inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2 text-[13px] font-bold ${
        secondary ? "border-ink-200 text-ink-700 border bg-white" : "bg-ink-950 text-white shadow-lg"
      }`}
    >
      {children}
      <style>{`
        .demo-pulse { animation: demoPulse 1.8s ease-in-out infinite; }
        @keyframes demoPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(242,78,30,0.35); } 50% { box-shadow: 0 0 0 7px rgba(242,78,30,0); } }
        @media (prefers-reduced-motion: reduce) { .demo-pulse { animation: none; } }
      `}</style>
    </span>
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
