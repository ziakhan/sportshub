"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface Tab {
  label: string
  href: string
}

/**
 * Club workspace navigation — the ONE way to move within a club (the
 * sidebar only switches workspaces; owner rule 2026-07-11). Scrollable
 * pills with an edge fade so the row never clips silently ("Hous…").
 */
export function ClubTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (!pathname) return false
    // Exact match for overview (the base club page)
    if (href === tabs[0]?.href) {
      return pathname === href
    }
    // Prefix match for other tabs
    return pathname.startsWith(href)
  }

  return (
    <div className="relative">
      <nav
        aria-label="Club sections"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={
                active
                  ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" }
                  : undefined
              }
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? "text-white"
                  : "border-ink-200 text-ink-600 hover:bg-ink-50 hover:text-ink-800"
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      {/* Edge fade: the scroll affordance phones were missing */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent lg:hidden" />
    </div>
  )
}
