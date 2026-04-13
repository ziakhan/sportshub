"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

interface Club {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  createdAt: string
  _count: { teams: number; tryouts: number; staff: number }
  staff: Array<{
    user: { firstName: string | null; lastName: string | null; email: string }
  }>
}

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState({ active: 0, unclaimed: 0, suspended: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [transferModal, setTransferModal] = useState<string | null>(null)
  const [transferEmail, setTransferEmail] = useState("")

  const loadClubs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)

    try {
      const res = await fetch(`/api/admin/clubs?${params}`)
      const data = await res.json().catch(() => ({}) as any)

      if (!res.ok) {
        setClubs([])
        setTotal(0)
        setTotalPages(1)
        setMessage({ type: "error", text: data.error || "Failed to load clubs" })
        return
      }

      setClubs(data.clubs || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (data.statusCounts) setStatusCounts(data.statusCounts)
    } catch {
      setClubs([])
      setTotal(0)
      setTotalPages(1)
      setMessage({ type: "error", text: "Network error while loading clubs" })
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    loadClubs()
  }, [loadClubs])

  async function handleAction(clubId: string, action: string, extra?: Record<string, string>) {
    setActionLoading(clubId)
    setMessage(null)
    const res = await fetch(`/api/admin/clubs/${clubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage({ type: "success", text: data.message })
      loadClubs()
    } else {
      setMessage({ type: "error", text: data.error })
    }
    setActionLoading(null)
  }

  async function handleTransfer(clubId: string) {
    if (!transferEmail) return
    await handleAction(clubId, "transferOwnership", { newOwnerEmail: transferEmail })
    setTransferModal(null)
    setTransferEmail("")
  }

  const planColors: Record<string, string> = {
    FREE: "bg-ink-100 text-ink-700",
    BASIC: "bg-play-50 text-play-700",
    PRO: "bg-court-50 text-court-700",
    ENTERPRISE: "bg-hoop-50 text-hoop-700",
  }

  return (
    <div className="space-y-5">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-ink-950 text-2xl font-bold">Club management</h1>
            <p className="text-ink-600 text-sm">
              {total} total clubs
              {" \u2022 "}
              <span className="text-court-700">{statusCounts.active} active</span>
              {" \u2022 "}
              <span className="text-play-700">{statusCounts.unclaimed} unclaimed</span>
              {" \u2022 "}
              <span className="text-hoop-700">{statusCounts.suspended} suspended</span>
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-play-600 hover:text-play-700 text-sm font-semibold"
          >
            ← Back to Dashboard
          </Link>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          {[
            { key: "", label: "All", count: total },
            { key: "ACTIVE", label: "Active", count: statusCounts.active },
            { key: "UNCLAIMED", label: "Unclaimed", count: statusCounts.unclaimed },
            { key: "SUSPENDED", label: "Suspended", count: statusCounts.suspended },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setStatusFilter(f.key)
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusFilter === f.key
                  ? "bg-play-600 text-white"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search clubs by name or slug..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="border-ink-200 text-ink-900 ring-play-200 flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring"
        />
      </div>

      {/* Clubs grid */}
      {loading ? (
        <div className="text-ink-500 py-12 text-center">Loading...</div>
      ) : clubs.length === 0 ? (
        <div className="text-ink-500 py-12 text-center">No clubs found</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clubs.map((club) => {
            const owner = club.staff[0]?.user
            return (
              <div
                key={club.id}
                className={`border-ink-100 shadow-soft rounded-2xl border bg-white p-5 ${club.status === "SUSPENDED" ? "border-hoop-300" : ""}`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-ink-950 text-lg font-semibold">{club.name}</h3>
                    <p className="text-ink-500 text-xs">{club.slug}.youthbasketballhub.com</p>
                  </div>
                  <div className="flex gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${planColors[club.plan] || "bg-ink-100 text-ink-700"}`}
                    >
                      {club.plan}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        club.status === "ACTIVE"
                          ? "bg-court-50 text-court-700"
                          : club.status === "UNCLAIMED"
                            ? "bg-play-50 text-play-700"
                            : club.status === "SUSPENDED"
                              ? "bg-hoop-50 text-hoop-700"
                              : "bg-ink-100 text-ink-700"
                      }`}
                    >
                      {club.status}
                    </span>
                  </div>
                </div>

                {owner && (
                  <p className="text-ink-500 mb-2 text-xs">
                    Owner: {owner.firstName} {owner.lastName} ({owner.email})
                  </p>
                )}

                <div className="text-ink-600 mb-4 flex gap-4 text-sm">
                  <span>{club._count.teams} teams</span>
                  <span>{club._count.tryouts} tryouts</span>
                  <span>{club._count.staff} staff</span>
                </div>

                {/* Actions */}
                <div className="border-ink-100 flex flex-wrap gap-2 border-t pt-3">
                  <Link
                    href={`/clubs/${club.id}`}
                    className="text-play-600 hover:bg-play-50 rounded-md px-2 py-1 text-xs font-semibold"
                  >
                    View
                  </Link>

                  {club.status === "ACTIVE" ? (
                    <button
                      onClick={() => handleAction(club.id, "suspend")}
                      disabled={actionLoading === club.id}
                      className="text-hoop-700 hover:bg-hoop-50 rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(club.id, "reactivate")}
                      disabled={actionLoading === club.id}
                      className="text-court-700 hover:bg-court-50 rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  )}

                  {/* Plan change dropdown */}
                  <select
                    value={club.plan}
                    onChange={(e) => handleAction(club.id, "changePlan", { plan: e.target.value })}
                    disabled={actionLoading === club.id}
                    className="border-ink-200 text-ink-700 rounded-md border px-1.5 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="FREE">Free</option>
                    <option value="BASIC">Basic</option>
                    <option value="PRO">Pro</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>

                  <button
                    onClick={() => setTransferModal(club.id)}
                    className="text-play-600 hover:bg-play-50 rounded-md px-2 py-1 text-xs font-semibold"
                  >
                    Transfer
                  </button>
                </div>

                {/* Transfer modal inline */}
                {transferModal === club.id && (
                  <div className="border-ink-200 bg-ink-50 mt-3 rounded-xl border p-3">
                    <p className="text-ink-700 mb-2 text-xs font-medium">Transfer ownership to:</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="New owner email"
                        value={transferEmail}
                        onChange={(e) => setTransferEmail(e.target.value)}
                        className="border-ink-200 flex-1 rounded-md border px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => handleTransfer(club.id)}
                        className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1 text-xs font-medium text-white"
                      >
                        Transfer
                      </button>
                      <button
                        onClick={() => {
                          setTransferModal(null)
                          setTransferEmail("")
                        }}
                        className="text-ink-600 hover:bg-ink-200 rounded-md px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-ink-100 shadow-soft flex items-center justify-between rounded-xl border bg-white p-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-ink-200 text-ink-700 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-ink-600 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-ink-200 text-ink-700 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
