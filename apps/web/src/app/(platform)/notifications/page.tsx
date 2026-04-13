"use client"

import { useState, useEffect } from "react"
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

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/notifications")
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications)
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const markAsRead = async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)))
  }

  const markAllAsRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const handleClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsRead([notification.id])
    }

    // Handle staff invite/request — show accept/decline
    if (
      notification.referenceType === "StaffInvitation" &&
      notification.referenceId &&
      (notification.type === "staff_invite" || notification.type === "staff_request")
    ) {
      // Navigate to a page or handle inline
      if (notification.link) {
        router.push(notification.link)
      }
      return
    }

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

      // Mark as read and update UI
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-ink-500">Loading notifications...</p>
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="space-y-6">
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Inbox
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-ink-950 text-3xl font-bold">
            Notifications
            {unreadCount > 0 && (
              <span className="text-ink-500 ml-2 text-sm font-normal">({unreadCount} unread)</span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-play-600 hover:text-play-700 text-sm font-semibold"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
          <p className="text-ink-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const isInvite = notification.type === "staff_invite"
            const isActionable = isInvite && !notification.isRead && notification.referenceId

            return (
              <div
                key={notification.id}
                className={`shadow-soft rounded-2xl border bg-white p-4 transition ${
                  notification.isRead ? "border-ink-100" : "border-play-200 bg-play-50/30"
                } ${notification.link && !isActionable ? "hover:border-play-300 cursor-pointer" : ""}`}
                onClick={() => !isActionable && handleClick(notification)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          notification.isRead ? "text-ink-700" : "text-ink-900"
                        }`}
                      >
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <span className="bg-play-500 h-2 w-2 rounded-full" />
                      )}
                    </div>
                    <p className="text-ink-600 mt-1 text-sm">{notification.message}</p>
                    <p className="text-ink-400 mt-1 text-xs">
                      {new Date(notification.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {isActionable && notification.referenceId && (
                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRespond(notification.id, notification.referenceId!, "accept")
                        }}
                        className="bg-court-600 hover:bg-court-700 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Accept
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRespond(notification.id, notification.referenceId!, "decline")
                        }}
                        className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-md border px-3 py-1.5 text-xs font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
