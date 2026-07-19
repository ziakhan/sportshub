"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * Public nav pills (phone/tablet header row). Energy Pass 2026-07-15: the old
 * white-pill-on-white-header row was invisible until you scrolled. Every
 * section now carries its own color — tinted chip at rest, solid fill when
 * you're inside that section — so the row reads as navigation at a glance.
 * Scores rides the palette's energy tokens; the rest use stable families.
 */

const SECTIONS: Array<{
  href: string
  label: string
  /** extra prefixes that count as "inside this section" */
  also?: string[]
  off: string
  on: string
}> = [
  // Order = owner's consumer-first ruling (2026-07-18): scores and news
  // lead — content consumption drives repeat visits; utility follows.
  {
    href: "/scores",
    label: "Scores",
    also: ["/live"],
    off: "bg-energy-soft text-energy-ink",
    on: "bg-energy text-energy-on",
  },
  {
    href: "/news",
    label: "News",
    off: "bg-gold-50 text-gold-600",
    on: "bg-gold-500 text-white",
  },
  {
    href: "/events",
    label: "Programs",
    also: ["/tryout", "/camp", "/house-league", "/tournament", "/marketplace"],
    off: "bg-hoop-50 text-hoop-700",
    on: "bg-hoop-600 text-white",
  },
  {
    href: "/leagues",
    label: "Leagues",
    also: ["/league"],
    off: "bg-court-50 text-court-700",
    on: "bg-court-600 text-white",
  },
  {
    href: "/club",
    label: "Clubs",
    off: "bg-play-50 text-play-700",
    on: "bg-play-600 text-white",
  },
]

function isActive(pathname: string, s: (typeof SECTIONS)[number]): boolean {
  const prefixes = [s.href, ...(s.also ?? [])]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function SectionPills() {
  const pathname = usePathname() ?? ""
  return (
    <>
      {SECTIONS.map((s) => {
        const active = isActive(pathname, s)
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[18px] py-1.5 text-[12.5px] font-bold transition-colors ${
              active ? s.on : s.off
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
            {s.label}
          </Link>
        )
      })}
    </>
  )
}
