import type { ReactNode } from "react"
import { cn } from "./cn"

interface PanelHeaderProps {
  /** Uppercase condensed title (e.g. "Needs attention"). */
  title: ReactNode
  /** Optional trailing element (a count pill, a "View all →" link). */
  action?: ReactNode
  /**
   * `band` renders the header on a `--brand-soft` bar with its own padding —
   * use at the top edge of an `overflow-hidden` card. Default (`inline`) is the
   * compact in-card header meant to sit inside existing card padding.
   */
  variant?: "inline" | "band"
  className?: string
}

/**
 * Compact brand accent-bar + condensed uppercase title — the section-heading
 * pattern used inside dashboard cards/panels. Distinct from the marketing
 * `SectionHeader` (this one is for operator/app surfaces).
 */
export function PanelHeader({ title, action, variant = "inline", className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        variant === "band" ? "bg-[var(--brand-soft)] px-6 py-4" : "mb-4",
        !!action && "justify-between",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
        <span className="font-condensed text-ink-950 truncate text-lg font-bold uppercase leading-none tracking-wide">
          {title}
        </span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  )
}
