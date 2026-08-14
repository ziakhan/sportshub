import type { ReactNode } from "react"
import { cn } from "./cn"
import { CourtBackdrop } from "./court-backdrop"

/**
 * The page-title band for browse surfaces (court system v2, screen 02 of the
 * approved mock).
 *
 * A full-bleed strip of the daylight finish — maple planks under a warm wash,
 * with the court cropping in from the top-right corner — carrying ONLY the
 * page title, its lead line and the filter controls that belong to it. The
 * list below keeps its own calm background, so a hundred rows never sit on a
 * texture (spec R1/R4).
 *
 * Callers pass their existing heading level via `as` — the band is a visual
 * wrapper and must never change a page's document outline.
 */
interface PageBandProps {
  /** Small uppercase label above the title. */
  eyebrow?: string
  title: string
  /** One-line lead under the title. */
  description?: string
  /** Filter chips / controls that belong to the title. */
  children?: ReactNode
  /** Right-aligned action (e.g. a CTA link). */
  action?: ReactNode
  /** Heading level, matching whatever the page rendered before the band. */
  as?: "h1" | "h2"
  /** Centres the title block (club directory). */
  align?: "left" | "center"
  className?: string
  contentClassName?: string
}

export function PageBand({
  eyebrow,
  title,
  description,
  children,
  action,
  as: Heading = "h1",
  align = "left",
  className,
  contentClassName,
}: PageBandProps) {
  const centered = align === "center"
  return (
    <CourtBackdrop
      variant="daylight"
      intensity="band"
      // The baseline: one warm rule where the floor stops and the list starts.
      className={cn("border-b border-[#e7dbc4]", className)}
      contentClassName={cn(
        "container mx-auto px-4 py-8 sm:px-6 sm:py-10",
        contentClassName
      )}
    >
      <div
        className={cn(
          "gap-4",
          action && !centered ? "flex flex-wrap items-end justify-between" : ""
        )}
      >
        <div className={cn("max-w-2xl", centered && "mx-auto text-center")}>
          {eyebrow && (
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#b45309]">
              {eyebrow}
            </p>
          )}
          <Heading className="font-display text-ink-950 text-[30px] font-black leading-[1.04] tracking-[-0.02em] sm:text-[40px]">
            {title}
          </Heading>
          {description && (
            <p className="text-ink-600 mt-3 text-[15px] leading-6 sm:text-base sm:leading-7">
              {description}
            </p>
          )}
        </div>
        {action && !centered && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className={cn("mt-5", centered && "text-center")}>{children}</div>}
    </CourtBackdrop>
  )
}
