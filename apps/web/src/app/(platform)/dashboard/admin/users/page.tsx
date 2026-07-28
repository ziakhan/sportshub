"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge, Button, SmartBack, toneForStatus } from "@/components/ui"

interface UserRole {
  id: string
  role: string
  designation: string | null
  tenant: { id: string; name: string } | null
  team: { id: string; name: string } | null
}

interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  createdAt: string
  onboardedAt: string | null
  roles: UserRole[]
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)

    try {
      const res = await fetch(`/api/admin/users?${params}`)
      const contentType = res.headers.get("content-type") || ""
      const isJson = contentType.includes("application/json")
      const data = isJson ? await res.json().catch(() => ({}) as any) : ({} as any)

      if (!isJson) {
        setUsers([])
        setTotal(0)
        setTotalPages(1)
        setMessage({
          type: "error",
          text: "Session expired or unexpected response from server. Please sign in again.",
        })
        return
      }

      if (!res.ok) {
        setUsers([])
        setTotal(0)
        setTotalPages(1)
        const fallback =
          res.status === 403 ? "You do not have permission to view users." : "Failed to load users"
        setMessage({ type: "error", text: data.error || fallback })
        return
      }

      setUsers(data.users || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch {
      setUsers([])
      setTotal(0)
      setTotalPages(1)
      setMessage({ type: "error", text: "Network error while loading users" })
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleAction(userId: string, action: string, extra?: Record<string, string>) {
    setActionLoading(userId)
    setMessage(null)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage({
        type: "success",
        text: data.tempPassword ? `Password reset to: ${data.tempPassword}` : data.message,
      })
      loadUsers()
    } else {
      setMessage({ type: "error", text: data.error })
    }
    setActionLoading(null)
  }

  async function handleImpersonate(userId: string) {
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      window.location.href = "/dashboard"
    }
  }

  return (
    <div className="space-y-5">
      <div className="border-ink-100 shadow-soft reveal rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">User management</h1>
            <p className="text-ink-500 text-sm">{total} total users</p>
          </div>
          <SmartBack fallback="/dashboard" fallbackLabel="Dashboard" />
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl p-3 text-sm font-medium ${message.type === "success" ? "bg-court-50 text-court-700" : "bg-hoop-50 text-hoop-700"}`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="border-ink-200 text-ink-900 ring-play-200 flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="border-ink-200 text-ink-900 ring-play-200 rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Users table — narrow windows scroll INSIDE the card (sticky User
          column, hidden scrollbar, edge fade) instead of squishing columns */}
      <div className="border-ink-100 shadow-soft reveal relative overflow-hidden rounded-2xl border bg-white [animation-delay:80ms]">
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="divide-ink-100 min-w-[820px] w-full divide-y">
          <thead className="bg-ink-50">
            <tr>
              <th className="bg-ink-50 sticky left-0 z-10 text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                User
              </th>
              <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                Status
              </th>
              <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                Roles
              </th>
              <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                Joined
              </th>
              <th className="text-ink-500 px-4 py-3 text-right text-xs font-medium uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-ink-100 divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-ink-500 px-4 py-8 text-center">
                  <span className="motion-safe:animate-pulse">Loading&hellip;</span>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-ink-500 px-4 py-8 text-center">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-ink-50/70">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3">
                    <div className="text-ink-950 text-sm font-semibold">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-ink-500 text-xs">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={toneForStatus(user.status)}>{user.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user.roles.length === 0 ? (
                      <span className="text-ink-300 text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((r) => (
                          <span
                            key={r.id}
                            className="bg-play-50 text-play-700 inline-block rounded-md px-2 py-1 text-xs"
                          >
                            {r.role}
                            {r.designation && ` (${r.designation})`}
                            {r.tenant && ` @ ${r.tenant.name}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-ink-500 whitespace-nowrap px-4 py-3 text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleImpersonate(user.id)}
                        className="text-play-600 hover:bg-play-50 rounded-md px-2 py-1 text-xs font-semibold"
                        title="View as this user"
                      >
                        Impersonate
                      </button>
                      {user.status === "ACTIVE" ? (
                        <button
                          onClick={() => handleAction(user.id, "suspend")}
                          disabled={actionLoading === user.id}
                          className="text-hoop-700 hover:bg-hoop-50 rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      ) : user.status === "SUSPENDED" ? (
                        <button
                          onClick={() => handleAction(user.id, "reactivate")}
                          disabled={actionLoading === user.id}
                          className="text-court-700 hover:bg-court-50 rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleAction(user.id, "resetPassword")}
                        disabled={actionLoading === user.id}
                        className="text-ink-700 hover:bg-ink-100 rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50"
                      >
                        Reset PW
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-white to-transparent lg:hidden" />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-ink-100 shadow-soft flex items-center justify-between rounded-xl border bg-white p-3">
          <Button size="sm" variant="secondary" tone="ink" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-ink-600 text-sm">
            Page {page} of {totalPages}
          </span>
          <Button size="sm" variant="secondary" tone="ink" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
