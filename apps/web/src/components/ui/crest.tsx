import { cn } from "./cn"
import { monogram } from "@/lib/content/matchup-cover"
import { brandTokens } from "@/lib/club-page/brand"

/**
 * The team / club mark, one component for the whole site.
 *
 * NEUTRAL BY DEFAULT, BRAND BY CHOICE (owner ruling 2026-08-14). Around a
 * thousand imported clubs carry a colour the importer stamped, not one they
 * chose, so painting crests with it turned every standings row, score card and
 * scoreboard into the same three colours signifying nothing. Every list and
 * summary surface therefore renders an ink monogram tile; home and away are
 * told apart by position and type weight, which is how a real scoreboard does
 * it anyway.
 *
 * `brandColor` is the single escape hatch, and it is a DECIDED value: callers
 * pass `chosenBrandColor(...)` (lib/club-page/brand) and only on the entity's
 * own hub page. Passing a raw `primaryColor` straight from the database is the
 * bug this component exists to prevent.
 *
 * A real uploaded logo always wins over both — that is a mark somebody made.
 */

export type CrestSurface = "light" | "dark"
export type CrestSize = "xs" | "sm" | "md" | "lg" | "xl"

const SIZE_CLASSES: Record<CrestSize, string> = {
  xs: "h-5 w-5 rounded-md text-[9px]",
  sm: "h-7 w-7 rounded-lg text-[10px]",
  md: "h-9 w-9 rounded-xl text-[12px]",
  lg: "h-12 w-12 rounded-2xl text-[15px]",
  xl: "h-16 w-16 rounded-2xl text-2xl",
}

/** The neutral tile, per surface. This is what almost every call site gets. */
const NEUTRAL_CLASSES: Record<CrestSurface, string> = {
  light: "bg-ink-100 text-ink-700",
  dark: "bg-white/10 text-white/80 ring-1 ring-inset ring-white/15",
}

export interface CrestProps {
  /** Team or club name — the monogram is derived from it. */
  name: string
  /** Override the derived monogram (a jersey number, a pre-shortened label). */
  text?: string
  /** A real logo the club uploaded. Always wins. */
  logoUrl?: string | null
  /**
   * Brand fill, already vetted by `chosenBrandColor()`. Null / undefined keeps
   * the crest neutral, which is what every list surface wants.
   */
  brandColor?: string | null
  size?: CrestSize
  /**
   * Replaces the size preset outright (box + radius + type), for the handful
   * of surfaces that run their own scale. `cn` does no Tailwind conflict
   * resolution, so overriding through `className` alone would be a coin flip.
   */
  sizeClassName?: string
  surface?: CrestSurface
  /** Extra classes layered on top of the size + tone classes. */
  className?: string
}

export function Crest({
  name,
  text,
  logoUrl,
  brandColor,
  size = "sm",
  sizeClassName,
  surface = "light",
  className,
}: CrestProps) {
  const label = text ?? monogram(name)
  const branded = !logoUrl && !!brandColor
  const tokens = branded ? brandTokens(brandColor) : null

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden font-bold leading-none",
        sizeClassName ?? SIZE_CLASSES[size],
        logoUrl ? "bg-white" : branded ? null : NEUTRAL_CLASSES[surface],
        className
      )}
      style={tokens ? { backgroundColor: tokens.brand, color: tokens.on } : undefined}
      aria-hidden={logoUrl ? undefined : "true"}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
      ) : (
        label
      )}
    </span>
  )
}
