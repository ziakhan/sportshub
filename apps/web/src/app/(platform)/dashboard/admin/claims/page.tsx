"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"

interface Claim {
  id: string
  status: string
  message: string | null
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
  tenant: { id: string; name: string; city: string | null; contactEmail: string | null }
  user: { id: string; email: string; firstName: string | null; lastName: string | null }
}

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const fetchClaims = () => {
    fetch("/api/admin/claims")
      .then((res) => res.json())
      .then((data) => setClaims(data.claims || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchClaims()
  }, [])

  const handleAction = async (claimId: string, action: "approve" | "reject", note?: string) => {
    setActionId(claimId)
    try {
      const res = await fetch(`/api/admin/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      })
      if (res.ok) fetchClaims()
    } catch {
    } finally {
      setActionId(null)
      setRejectingId(null)
      setRejectNote("")
    }
  }

  if (loading) return <div className="text-ink-500 py-12 text-center">Loading claims...</div>

  const pending = claims.filter((c) =>
    ["PENDING", "EMAIL_SENT", "EMAIL_VERIFIED"].includes(c.status)
  )
  const resolved = claims.filter((c) => ["APPROVED", "REJECTED"].includes(c.status))

  const statusColors: Record<string, string> = {
    PENDING: "bg-play-50 text-play-700",
    EMAIL_SENT: "bg-hoop-50 text-hoop-700",
    EMAIL_VERIFIED: "bg-court-50 text-court-700",
    APPROVED: "bg-court-50 text-court-700",
    REJECTED: "bg-hoop-50 text-hoop-700",
  }

  return (
    <div className="space-y-6">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h2 className="font-display text-ink-950 text-2xl font-bold">Club claims</h2>
        <p className="text-ink-500 mt-1 text-sm">Review and manage club ownership claims</p>
      </div>

      {claims.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">No claims yet</h3>
          <p className="text-ink-600">
            When users request to claim unclaimed clubs, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending claims */}
          {pending.length > 0 && (
            <div>
              <h3 className="font-display text-ink-950 mb-3 text-lg font-semibold">
                Pending Review ({pending.length})
              </h3>
              <div className="space-y-3">
                {pending.map((claim) => (
                  <div
                    key={claim.id}
                    className="border-play-200 shadow-soft rounded-2xl border bg-white p-5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-ink-950 font-semibold">{claim.tenant.name}</h4>
                        <p className="text-ink-500 text-sm">{claim.tenant.city}</p>
                        <p className="text-ink-600 mt-1 text-sm">
                          Claimed by:{" "}
                          <strong>
                            {claim.user.firstName} {claim.user.lastName}
                          </strong>{" "}
                          ({claim.user.email})
                        </p>
                        {claim.message && (
                          <p className="text-ink-500 mt-1 text-xs italic">
                            &ldquo;{claim.message}&rdquo;
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[claim.status]}`}
                          >
                            {claim.status.replace("_", " ").toLowerCase()}
                          </span>
                          <span className="text-ink-400 text-xs">
                            {format(new Date(claim.createdAt), "MMM d, yyyy")}
                          </span>
                          {claim.tenant.contactEmail && (
                            <span className="text-ink-400 text-xs">
                              Club email: {claim.tenant.contactEmail}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => handleAction(claim.id, "approve")}
                          disabled={actionId === claim.id}
                          className="bg-court-600 hover:bg-court-700 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        {rejectingId === claim.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="Reason..."
                              className="border-ink-300 w-32 rounded-md border px-2 py-1 text-xs"
                            />
                            <button
                              onClick={() => handleAction(claim.id, "reject", rejectNote)}
                              className="bg-hoop-600 rounded-md px-2 py-1 text-xs text-white"
                            >
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRejectingId(claim.id)}
                            className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-md border px-3 py-1.5 text-xs font-semibold"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved claims */}
          {resolved.length > 0 && (
            <div>
              <h3 className="font-display text-ink-950 mb-3 text-lg font-semibold">
                Resolved ({resolved.length})
              </h3>
              <div className="space-y-2">
                {resolved.map((claim) => (
                  <div key={claim.id} className="border-ink-200 rounded-xl border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-ink-900 font-medium">{claim.tenant.name}</span>
                        <span className="text-ink-500 ml-2 text-sm">
                          by {claim.user.firstName} {claim.user.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[claim.status]}`}
                        >
                          {claim.status.toLowerCase()}
                        </span>
                        {claim.reviewedAt && (
                          <span className="text-ink-400 text-xs">
                            {format(new Date(claim.reviewedAt), "MMM d")}
                          </span>
                        )}
                      </div>
                    </div>
                    {claim.reviewNote && (
                      <p className="text-ink-500 mt-1 text-xs">{claim.reviewNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
