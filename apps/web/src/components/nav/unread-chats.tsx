"use client"

import { useEffect, useState } from "react"

/**
 * Client-side unread-chat total for nav badges. Layouts stay cheap (no
 * server chat queries per page); this hydrates after mount from the same
 * endpoint the chat dock uses, refreshing on focus + every 60s.
 */
export function useUnreadChats(): number {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch("/api/chat/summary")
        if (!res.ok) return
        const data = await res.json()
        if (!alive) return
        const total = (data.teams ?? []).reduce(
          (sum: number, t: { unread?: number }) => sum + (t.unread || 0),
          0
        )
        setUnread(total)
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

export function UnreadDot({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`bg-hoop-600 absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ${className}`}
      aria-label={`${count} unread`}
    >
      {count > 9 ? "9+" : count}
    </span>
  )
}
