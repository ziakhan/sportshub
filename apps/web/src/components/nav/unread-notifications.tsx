"use client"

import { useEffect, useState } from "react"

/**
 * Client-side unread-notification count for the badge menu's dot + row
 * (owner 2026-07-15: on mobile the bell folds into the profile badge).
 * Same house pattern as useUnreadChats: hydrate after mount, refresh on
 * focus + every 60s — best-effort, never blocks the layout.
 */
export function useUnreadNotifications(): number {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch("/api/notifications")
        if (!res.ok) return
        const data = await res.json()
        if (!alive) return
        setUnread(data.unreadCount ?? 0)
      } catch {
        /* badge is best-effort */
      }
    }
    load()
    const onFocus = () => load()
    const timer = setInterval(load, 60_000)
    window.addEventListener("focus", onFocus)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  return unread
}
