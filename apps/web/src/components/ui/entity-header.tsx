import type { ReactNode } from "react"
import { cn } from "./cn"
import { CourtBackdropLayer } from "./court-backdrop"

interface EntityHeaderProps {
  name: string
  /** Short context line, e.g. "Metro League · U14 Boys". */
  subtitle?: string
  /** Chips rendered under the title, e.g. ["8–2", "2nd in East"]. */
  meta?: string[]
  /** Brand color for the crest and the baseline stripe (club/team primary). */
  primaryColor?: string
  logoUrl?: string | null
  /** Fallback crest text when no logo (usually first initial). */
  crestText?: string
  /** Right-aligned action(s), e.g. a Follow button. */
  action?: ReactNode
  className?: string
}

/**
 * The branded banner atop every "hub" page (club / league / team / player).
 * Provides a consistent identity block: crest, name, context, meta chips, and
 * an action.
 *
 * Court system v2, screen 03 of the approved mock: the header now stands on
 * the daylight floor (maple planks, warm wash, the court cropping in from the
 * top-right at 15%) instead of a dark gradient, and the entity's own colour
 * carries the crest plus the 4px baseline stripe along the bottom edge.
 */
export function EntityHeader({
  name,
  subtitle,
  meta,
  primaryColor = "#4f46e5",
  logoUrl,
  crestText,
  action,
  className,
}: EntityHeaderProps) {
  return (
    <div
      className={cn(
        "border-[#e7dbc4] relative isolate overflow-hidden rounded-[28px] border",
        className
      )}
    >
      <CourtBackdropLayer variant="daylight" intensity="band" />
      <div className="relative z-10 flex flex-wrap items-center gap-5 p-6 pb-7 sm:p-8 sm:pb-9">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-black text-white shadow-lg"
          style={logoUrl ? { backgroundColor: "#ffffff" } : { backgroundColor: primaryColor }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
          ) : (
            (crestText || name.slice(0, 1)).toUpperCase()
          )}
        </span>
        {/* min-w keeps the name column readable: on a phone the action wraps to
            its own line instead of squeezing the title into three words. */}
        <div className="min-w-[15rem] flex-1">
          <h1 className="font-display text-ink-950 text-[26px] font-black leading-[1.04] tracking-[-0.02em] sm:text-[34px]">
            {name}
          </h1>
          {subtitle && <p className="text-ink-600 mt-1 text-sm">{subtitle}</p>}
          {meta && meta.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {meta.map((m, i) => (
                <span
                  key={i}
                  className="border-ink-200 text-ink-700 rounded-full border bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {/* The baseline: the entity's own colour, 4px along the bottom edge. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 z-10 h-1"
        style={{ backgroundColor: primaryColor }}
      />
    </div>
  )
}
