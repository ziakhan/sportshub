"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface Tab {
  label: string
  href: string
}

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
    <nav className="-mb-px flex gap-2 overflow-x-auto sm:gap-4 md:gap-6">
      {tabs.map((tab) => {
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium ${
              active
                ? "border-play-500 text-play-700"
                : "border-transparent text-ink-500 hover:border-ink-200 hover:text-ink-700"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
