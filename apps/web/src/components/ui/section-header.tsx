import type { ReactNode } from "react"
import { cn } from "./cn"

type Accent = "play" | "hoop" | "court" | "gold"

const ACCENT_LINE: Record<Accent, string> = {
  play: "bg-play-400",
  hoop: "bg-hoop-400",
  court: "bg-court-400",
  gold: "bg-gold-400",
}
const ACCENT_TEXT: Record<Accent, string> = {
  play: "text-play-500",
  hoop: "text-hoop-500",
  court: "text-court-600",
  gold: "text-gold-600",
}

interface SectionHeaderProps {
  /** Small uppercase eyebrow label above the title. */
  eyebrow?: string
  title: string
  description?: string
  accent?: Accent
  align?: "left" | "center"
  /** Optional trailing element (e.g., a "View all →" link). */
  action?: ReactNode
  className?: string
}

/** The recurring "line + uppercase label + heading" section intro pattern. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  accent = "play",
  align = "left",
  action,
  className,
}: SectionHeaderProps) {
  const centered = align === "center"
  return (
    <div
      className={cn(
        "gap-6",
        action && !centered ? "flex items-end justify-between" : "",
        className
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto text-center")}>
        {eyebrow && (
          <div
            className={cn(
              "mb-4 inline-flex items-center gap-3",
              centered && "justify-center"
            )}
          >
            <span className={cn("h-px w-10", ACCENT_LINE[accent])} />
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.2em]",
                ACCENT_TEXT[accent]
              )}
            >
              {eyebrow}
            </span>
            {centered && <span className={cn("h-px w-10", ACCENT_LINE[accent])} />}
          </div>
        )}
        <h2 className="text-ink-950 text-3xl font-bold sm:text-4xl">{title}</h2>
        {description && (
          <p className="text-ink-500 mt-3 text-base leading-7 sm:text-lg">{description}</p>
        )}
      </div>
      {action && !centered && <div className="hidden shrink-0 sm:block">{action}</div>}
    </div>
  )
}
