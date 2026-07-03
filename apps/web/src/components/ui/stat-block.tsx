import type { ReactNode } from "react"
import { cn } from "./cn"

type Tone = "play" | "hoop" | "court" | "gold" | "sky" | "violet" | "amber" | "neutral"

const ICON_BG: Record<Tone, string> = {
  play: "bg-play-50 text-play-600",
  hoop: "bg-hoop-50 text-hoop-600",
  court: "bg-court-50 text-court-600",
  gold: "bg-gold-50 text-gold-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  neutral: "bg-ink-100 text-ink-700",
}

interface StatBlockProps {
  label: string
  value: string | number
  icon?: ReactNode
  tone?: Tone
  /** Optional period-over-period trend, e.g. { dir: "up", value: "12%" }. */
  trend?: { dir: "up" | "down"; value: string }
  className?: string
}

/** A single KPI/metric tile for dashboards (admin overview, club, parent). */
export function StatBlock({ label, value, icon, tone = "neutral", trend, className }: StatBlockProps) {
  return (
    <div className={cn("border-ink-100 shadow-soft rounded-2xl border bg-white p-5", className)}>
      <div className="flex items-center justify-between">
        {icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", ICON_BG[tone])}>
            {icon}
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              trend.dir === "up" ? "text-court-600" : "text-live-600"
            )}
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              {trend.dir === "up" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M9 6h9v9" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M9 18h9V9" />
              )}
            </svg>
            {trend.value}
          </span>
        )}
      </div>
      <div className="font-display text-ink-950 mt-3 text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-ink-500 mt-0.5 text-sm">{label}</div>
    </div>
  )
}
