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
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [transferModal, setTransferModal] = useState<string | null>(null)
  const [transferEmail, setTransferEmail] = useState("")

  const loadClubs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set("search", search)

    const res = await fetch(`/api/admin/clubs?${params}`)
    if (res.ok) {
      const data = await res.json()
      setClubs(data.clubs)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    }
    setLoading(false)
  }, [page, search])

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
    FREE: "bg-gray-100 text-gray-700",
    BASIC: "bg-blue-100 text-blue-700",
    PRO: "bg-purple-100 text-purple-700",
    ENTERPRISE: "bg-yellow-100 text-yellow-800",
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Club Management</h1>
          <p className="text-sm text-gray-600">{total} total clubs</p>
        </div>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
          ← Back to Dashboard
        </Link>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search clubs by name or slug..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full rounded-lg border px-3 py-2 text-sm md:w-96"
        />
      </div>

      {/* Clubs grid */}
      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : clubs.length === 0 ? (
        <div className="py-12 text-center text-gray-500">No clubs found</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clubs.map((club) => {
            const owner = club.staff[0]?.user
            return (
              <div key={club.id} className={`rounded-lg bg-white p-5 shadow ${club.status === "SUSPENDED" ? "border-2 border-red-200 opacity-75" : ""}`}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{club.name}</h3>
                    <p className="text-xs text-gray-500">{club.slug}.youthbasketballhub.com</p>
                  </div>
                  <div className="flex gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${planColors[club.plan] || "bg-gray-100"}`}>
                      {club.plan}
                    </span>
                    {club.status === "SUSPENDED" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        SUSPENDED
                      </span>
                    )}
                  </div>
                </div>

                {owner && (
                  <p className="mb-2 text-xs text-gray-500">
                    Owner: {owner.firstName} {owner.lastName} ({owner.email})
                  </p>
                )}

                <div className="mb-4 flex gap-4 text-sm text-gray-600">
                  <span>{club._count.teams} teams</span>
                  <span>{club._count.tryouts} tryouts</span>
                  <span>{club._count.staff} staff</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Link
                    href={`/clubs/${club.id}`}
                    className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    View
                  </Link>

                  {club.status === "ACTIVE" ? (
                    <button
                      onClick={() => handleAction(club.id, "suspend")}
                      disabled={actionLoading === club.id}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(club.id, "reactivate")}
                      disabled={actionLoading === club.id}
                      className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  )}

                  {/* Plan change dropdown */}
                  <select
                    value={club.plan}
                    onChange={(e) => handleAction(club.id, "changePlan", { plan: e.target.value })}
                    disabled={actionLoading === club.id}
                    className="rounded border px-1.5 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="FREE">Free</option>
                    <option value="BASIC">Basic</option>
                    <option value="PRO">Pro</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>

                  <button
                    onClick={() => setTransferModal(club.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50"
                  >
                    Transfer
                  </button>
                </div>

                {/* Transfer modal inline */}
                {transferModal === club.id && (
                  <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-medium text-gray-700">Transfer ownership to:</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="New owner email"
                        value={transferEmail}
                        onChange={(e) => setTransferEmail(e.target.value)}
                        className="flex-1 rounded border px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => handleTransfer(club.id)}
                        className="rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700"
                      >
                        Transfer
                      </button>
                      <button
                        onClick={() => { setTransferModal(null); setTransferEmail("") }}
                        className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
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
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
