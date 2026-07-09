import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "./cn"
import { AnimatedNumber } from "./animated-number"

export type StatTileTone = "brand" | "court" | "play" | "hoop" | "gold" | "ink"

const TONES: Record<StatTileTone, { chip: string; num: string; ring: string }> = {
  brand: {
    chip: "bg-[var(--brand-soft)] text-[color:var(--brand-ink)]",
    num: "text-[color:var(--brand-ink)]",
    ring: "group-hover:border-[color:var(--brand-line)]",
  },
  court: { chip: "bg-court-50 text-court-600", num: "text-court-700", ring: "group-hover:border-court-200" },
  play: { chip: "bg-play-50 text-play-600", num: "text-play-700", ring: "group-hover:border-play-200" },
  hoop: { chip: "bg-hoop-50 text-hoop-600", num: "text-hoop-600", ring: "group-hover:border-hoop-200" },
  gold: { chip: "bg-gold-50 text-gold-600", num: "text-gold-600", ring: "group-hover:border-gold-100" },
  ink: { chip: "bg-ink-100 text-ink-700", num: "text-ink-800", ring: "group-hover:border-ink-300" },
}

const SUB_TONES = {
  brand: "text-[color:var(--brand-ink)] bg-[var(--brand-soft)]",
  court: "text-court-700 bg-court-50",
  hoop: "text-hoop-700 bg-hoop-50",
  play: "text-play-700 bg-play-50",
  ink: "text-ink-500 bg-ink-50",
} as const

interface StatTileProps {
  /** Big metric value — animates a count-up on mount. */
  value: number
  label: string
  /** Optional leading SVG icon (caller passes the node — 20×20 recommended). */
  icon?: ReactNode
  tone?: StatTileTone
  /** Small pill in the top-right (e.g. "3 without players"). */
  sub?: string | null
  subTone?: keyof typeof SUB_TONES
  /** When set, the whole tile is a link. */
  href?: string
  /** Stagger the reveal (ms of animation-delay). */
  delay?: number
  className?: string
}

/**
 * Dashboard KPI tile with count-up, hover-lift, and staggered reveal — the
 * elevated stat pattern from the club dashboard, generalized for the whole app.
 */
export function StatTile({
  value,
  label,
  icon,
  tone = "brand",
  sub,
  subTone = "ink",
  href,
  delay = 0,
  className,
}: StatTileProps) {
  const t = TONES[tone]
  const inner = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        {icon && (
          <span className={cn("grid h-10 w-10 place-items-center rounded-2xl", t.chip)}>{icon}</span>
        )}
        {sub && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", SUB_TONES[subTone])}>
            {sub}
          </span>
        )}
      </div>
      <div className={cn("font-condensed text-4xl font-bold leading-none", t.num)}>
        <AnimatedNumber value={value} />
      </div>
      <div className="text-ink-500 mt-1.5 text-sm font-medium">{label}</div>
    </>
  )

  const shared = cn(
    "reveal group border-ink-100 relative block overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition-all duration-200",
    href && "hover:-translate-y-1 hover:shadow-[0_26px_60px_-32px_rgba(15,23,42,0.5)]",
    t.ring,
    className
  )

  if (href) {
    return (
      <Link href={href} style={{ animationDelay: `${delay}ms` }} className={shared}>
        {inner}
      </Link>
    )
  }
  return (
    <div style={{ animationDelay: `${delay}ms` }} className={shared}>
      {inner}
    </div>
  )
}
