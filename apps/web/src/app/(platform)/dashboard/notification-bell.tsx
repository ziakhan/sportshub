"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  referenceId: string | null
  referenceType: string | null
  createdAt: string
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications.slice(0, 5))
        setUnreadCount(data.unreadCount)
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  const markAsRead = async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - ids.length))
  }

  const markAllAsRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  const handleClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsRead([notification.id])
    }
    setOpen(false)
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const handleRespond = async (
    notificationId: string,
    referenceId: string,
    action: "accept" | "decline"
  ) => {
    try {
      const res = await fetch(`/api/invitations/${referenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to respond")
        return
      }
      await markAsRead([notificationId])
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? {
                ...n,
                isRead: true,
                message: n.message + ` (${action === "accept" ? "Accepted" : "Declined"})`,
              }
            : n
        )
      )
    } catch {
      alert("Failed to respond")
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "Just now"
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHrs = Math.floor(diffMin / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="border-ink-200 text-ink-600 hover:bg-ink-50 hover:text-ink-950 relative rounded-2xl border bg-white p-2 transition"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="bg-hoop-500 absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="border-ink-100 shadow-panel absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-3xl border bg-white">
          <div className="border-ink-100 flex items-center justify-between border-b px-4 py-4">
            <h3 className="text-ink-950 text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-play-600 hover:text-play-700 text-xs font-semibold transition"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-ink-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const isActionable =
                  notification.type === "staff_invite" &&
                  !notification.isRead &&
                  notification.referenceId

                return (
                  <div
                    key={notification.id}
                    className={`border-ink-100 border-b px-4 py-3 transition ${
                      notification.isRead ? "bg-white" : "bg-play-50/50"
                    } ${!isActionable ? "hover:bg-ink-50 cursor-pointer" : ""}`}
                    onClick={() => !isActionable && handleClick(notification)}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.isRead && (
                        <span className="bg-play-500 mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
                      )}
                      <div className={`flex-1 ${notification.isRead ? "pl-4" : ""}`}>
                        <p className="text-ink-950 text-sm font-medium">{notification.title}</p>
                        <p className="text-ink-600 mt-0.5 line-clamp-2 text-xs">
                          {notification.message}
                        </p>
                        <p className="text-ink-400 mt-1 text-[11px]">
                          {formatTime(notification.createdAt)}
                        </p>
                        {isActionable && notification.referenceId && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRespond(notification.id, notification.referenceId!, "accept")
                              }}
                              className="bg-court-600 hover:bg-court-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-white transition"
                            >
                              Accept
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRespond(notification.id, notification.referenceId!, "decline")
                              }}
                              className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-2.5 py-1 text-xs font-semibold transition"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="border-ink-100 border-t">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-play-600 hover:bg-ink-50 block px-4 py-3 text-center text-xs font-semibold transition"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
