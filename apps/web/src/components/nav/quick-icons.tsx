"use client"

import Link from "next/link"
import { useUnreadChats, UnreadDot } from "./unread-chats"

/**
 * Desktop header shortcuts to the two hottest badge-menu rows (site-ia-plan
 * §5.6.5): Calendar and Chat. lg+ only — below lg the bottom tab bar carries
 * these. Everything here also exists in the account menu (icons are
 * shortcuts, never the only path).
 */
export function QuickIcons() {
  const unread = useUnreadChats()
  const base =
    "text-ink-500 hover:bg-ink-50 hover:text-ink-950 relative hidden rounded-xl p-2 transition lg:inline-flex"

  return (
    <>
      <Link href="/calendar" className={base} aria-label="My calendar">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </Link>
      <Link href="/messages" className={base} aria-label={`Chat${unread ? `, ${unread} unread` : ""}`}>
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <UnreadDot count={unread} />
      </Link>
    </>
  )
}
