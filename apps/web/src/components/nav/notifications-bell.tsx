"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/components/ui/cn"

interface NotificationItem {
  id: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

/**
 * The header bell with its dropdown inbox (owner 2026-07-21: the bell opens
 * a scrollable panel in place, never a page jump; pressing it again
 * dismisses). Open/close state lives in AccountMenu so the bell and the
 * badge menu can never be open together. The /notifications page stays for
 * deep links and staff-invite accept/decline.
 */
export function NotificationsBell({
  open,
  onToggle,
  onClose,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [unread, setUnread] = useState(0)

  const load = useCallback(async (withList: boolean) => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setUnread(data.unreadCount ?? 0)
      if (withList) setItems(data.notifications ?? [])
    } catch {
      /* badge is best-effort */
    }
  }, [])

  /* Dot keeps itself fresh: hydrate after mount, refresh on focus + every
     60s — best-effort, never blocks the layout. */
  useEffect(() => {
    load(false)
    const onFocus = () => load(false)
    const timer = setInterval(() => load(false), 60_000)
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [load])

  /* Fresh list every time the panel opens. */
  useEffect(() => {
    if (open) load(true)
  }, [open, load])

  const markAllRead = () => {
    setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? null)
    setUnread(0)
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
  }

  const dismissOne = (id: string) => {
    setItems((prev) => {
      const gone = prev?.find((n) => n.id === id)
      if (gone && !gone.isRead) setUnread((u) => Math.max(0, u - 1))
      return prev?.filter((n) => n.id !== id) ?? null
    })
    void fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    })
  }

  const openItem = (n: NotificationItem) => {
    if (!n.isRead) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? null)
      setUnread((u) => Math.max(0, u - 1))
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      })
    }
    onClose()
    if (n.link) router.push(n.link)
  }

  return (
    <>
      <button
        onClick={onToggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className={cn(
          "text-ink-600 hover:text-ink-950 relative inline-flex rounded-xl p-2 transition",
          open ? "bg-ink-100 text-ink-950" : "hover:bg-ink-50"
        )}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
          />
        </svg>
        {unread > 0 && (
          <span className="bg-hoop-600 absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white" />
        )}
      </button>

      {open && (
        <div className="border-ink-100 absolute right-0 top-11 z-50 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className="border-ink-100 flex items-center justify-between border-b px-4 py-3">
            <p className="text-ink-950 text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-play-600 hover:text-play-700 text-xs font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {items === null ? (
              <p className="text-ink-500 px-4 py-6 text-center text-sm">Loading&hellip;</p>
            ) : items.length === 0 ? (
              <p className="text-ink-500 px-4 py-6 text-center text-sm">
                You&apos;re all caught up.
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "border-ink-50 flex cursor-pointer items-start gap-2 border-b px-4 py-3 transition",
                    n.isRead ? "hover:bg-ink-50" : "bg-play-50/40 hover:bg-play-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-sm font-semibold",
                          n.isRead ? "text-ink-700" : "text-ink-950"
                        )}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && <span className="bg-play-500 h-2 w-2 shrink-0 rounded-full" />}
                    </div>
                    <p className="text-ink-600 mt-0.5 line-clamp-2 text-[13px]">{n.message}</p>
                    <p className="text-ink-400 mt-0.5 text-xs">
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissOne(n.id)
                    }}
                    aria-label="Dismiss notification"
                    className="text-ink-300 hover:bg-ink-100 hover:text-ink-600 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm transition"
                  >
                    &#x2715;
                  </button>
                </div>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={onClose}
            className="border-ink-100 text-play-600 hover:bg-ink-50 block border-t px-4 py-3 text-center text-sm font-semibold"
          >
            See all notifications
          </Link>
        </div>
      )}
    </>
  )
}
