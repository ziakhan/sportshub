import type { ReactNode } from "react"
import { cn } from "./cn"
import { Crest } from "./crest"
import { brandTokens } from "@/lib/club-page/brand"
import { CourtBackdropLayer } from "./court-backdrop"

interface EntityHeaderProps {
  name: string
  /** Short context line, e.g. "Metro League · U14 Boys". */
  subtitle?: string
  /** Chips rendered under the title, e.g. ["8–2", "2nd in East"]. */
  meta?: string[]
  /**
   * Brand colour for the crest and the baseline stripe, and ONLY when this
   * header sits on the entity's own hub page and the entity actually picked a
   * colour. Pass `chosenBrandColor(...)` from lib/club-page/brand, never a raw
   * `primaryColor`. Left unset the header is neutral, which is the default.
   */
  brandColor?: string | null
  logoUrl?: string | null
  /** Fallback crest text when no logo (usually first initial). */
  crestText?: string
  /**
   * Replaces the crest with a mark of the caller's own — the player hub hands
   * over a `PlayerMug`, because a person is a face, not a monogram tile.
   */
  mark?: ReactNode
  /** Right-aligned action(s), e.g. a Follow button. */
  action?: ReactNode
  className?: string
}

/**
 * The banner atop every "hub" page (club / league / team / player). Provides a
 * consistent identity block: crest, name, context, meta chips, and an action.
 *
 * Court system v2, screen 03 of the approved mock: the header stands on the
 * daylight floor (maple planks, warm wash, the court cropping in from the
 * top-right at 15%), with a 4px baseline along the bottom edge.
 *
 * Neutral by default (owner ruling 2026-08-14): everyone gets the same
 * treatment and the baseline is navy. A colour only appears when the caller
 * hands over a `brandColor` it already vetted — the entity's own page, and the
 * entity chose the colour. A team or player page shows its club's identity
 * through the crest and the name, not through a fill.
 */
export function EntityHeader({
  name,
  subtitle,
  meta,
  brandColor,
  logoUrl,
  crestText,
  mark,
  action,
  className,
}: EntityHeaderProps) {
  const baseline = brandColor ? brandTokens(brandColor).brand : null
  return (
    <div
      className={cn(
        "border-[#e7dbc4] relative isolate overflow-hidden rounded-[28px] border",
        className
      )}
    >
      <CourtBackdropLayer variant="daylight" intensity="band" />
      <div className="relative z-10 flex flex-wrap items-center gap-5 p-6 pb-7 sm:p-8 sm:pb-9">
        {mark ?? (
          <Crest
            name={name}
            text={(crestText || name.slice(0, 1)).toUpperCase()}
            logoUrl={logoUrl}
            brandColor={brandColor}
            size="xl"
            className="shadow-lg"
          />
        )}
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
      {/* The baseline, 4px along the bottom edge: navy unless this entity
          picked a colour for its own page. */}
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-0 bottom-0 z-10 h-1", !baseline && "bg-navy-900")}
        style={baseline ? { backgroundColor: baseline } : undefined}
      />
    </div>
  )
}
