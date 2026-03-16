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
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n))
    )
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
                message:
                  n.message +
                  ` (${action === "accept" ? "Accepted" : "Declined"})`,
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
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading notifications...</p>
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({unreadCount} unread)
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-gray-500">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const isInvite = notification.type === "staff_invite"
              const isActionable =
                isInvite &&
                !notification.isRead &&
                notification.referenceId

              return (
                <div
                  key={notification.id}
                  className={`rounded-lg border bg-white p-4 shadow-sm transition ${
                    notification.isRead
                      ? "border-gray-100"
                      : "border-blue-200 bg-blue-50/30"
                  } ${notification.link && !isActionable ? "cursor-pointer hover:shadow-md" : ""}`}
                  onClick={() =>
                    !isActionable && handleClick(notification)
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-sm font-semibold ${
                            notification.isRead
                              ? "text-gray-700"
                              : "text-gray-900"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(notification.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                    {isActionable && notification.referenceId && (
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRespond(
                              notification.id,
                              notification.referenceId!,
                              "accept"
                            )
                          }}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRespond(
                              notification.id,
                              notification.referenceId!,
                              "decline"
                            )
                          }}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
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
    </div>
  )
}
