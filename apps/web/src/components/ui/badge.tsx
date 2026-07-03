import type { ReactNode } from "react"
import { cn } from "./cn"

export type BadgeTone =
  | "neutral"
  | "play"
  | "hoop"
  | "court"
  | "gold"
  | "live"
  | "success"
  | "warning"
  | "danger"

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink-50 text-ink-600 ring-ink-200",
  play: "bg-play-50 text-play-700 ring-play-100",
  hoop: "bg-hoop-50 text-hoop-600 ring-hoop-100",
  court: "bg-court-50 text-court-700 ring-court-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-100",
  live: "bg-live-50 text-live-600 ring-live-100",
  success: "bg-court-50 text-court-700 ring-court-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-red-50 text-red-600 ring-red-100",
}

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  /** Leading status dot. For `live` it pulses (respecting reduced motion). */
  dot?: boolean
  /** Optional leading SVG icon (pair with text — never color alone). */
  icon?: ReactNode
  className?: string
}

export function Badge({ children, tone = "neutral", dot = false, icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "live" ? "bg-live-500 motion-safe:animate-pulse" : "bg-current"
          )}
        />
      )}
      {icon}
      {children}
    </span>
  )
}
