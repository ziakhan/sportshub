import type { ReactNode } from "react"
import { cn } from "./cn"

interface EntityHeaderProps {
  name: string
  /** Short context line, e.g. "Metro League · U14 Boys". */
  subtitle?: string
  /** Chips rendered under the title, e.g. ["8–2", "2nd in East"]. */
  meta?: string[]
  /** Brand color for the banner gradient (club/team primary color). */
  primaryColor?: string
  logoUrl?: string | null
  /** Fallback crest text when no logo (usually first initial). */
  crestText?: string
  /** Right-aligned action(s), e.g. a Follow button. */
  action?: ReactNode
  className?: string
}

/**
 * The branded banner atop every "hub" page (club / league / team). Provides a
 * consistent identity block: crest, name, context, meta chips, and an action.
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
      className={cn("relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8", className)}
      style={{ background: `linear-gradient(135deg, ${primaryColor}, #18181b)` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_36%)]" />
      <div className="relative z-10 flex flex-wrap items-center gap-5">
        <span className="text-ink-950 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/95 text-2xl font-bold shadow-lg">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
          ) : (
            (crestText || name.slice(0, 1)).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
          {meta && meta.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {meta.map((m, i) => (
                <span
                  key={i}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
