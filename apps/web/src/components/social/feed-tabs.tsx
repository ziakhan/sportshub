"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/components/ui/cn"

/**
 * The social shell nav (owner 2026-07-23, Instagram as reference): the
 * social space gets its own clear navigation, separated from the rest of
 * the site — Feed / My posts tabs plus an explicit way back.
 */
export function FeedTabs() {
  const pathname = usePathname()
  const active = pathname?.startsWith("/feed/mine") ? "mine" : "feed"
  // Phones use the social bottom nav (BottomTabs switches on /feed*); this
  // row is the desktop-only switcher (owner 2026-07-23: no sticky top bar).
  return (
    <div className="hidden lg:block">
      <div className="flex items-center justify-between">
        <div className="bg-ink-100 flex w-fit rounded-xl p-1">
          {(
            [
              ["feed", "Feed", "/feed"],
              ["mine", "My posts", "/feed/mine"],
            ] as const
          ).map(([key, label, href]) => (
            <Link
              key={key}
              href={href}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold",
                active === key
                  ? "text-ink-950 bg-white shadow-sm"
                  : "text-ink-500 hover:text-ink-800"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <Link href="/" className="text-ink-500 hover:text-ink-800 text-xs font-semibold">
          ← Back to SportsHub
        </Link>
      </div>
    </div>
  )
}
