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

  useEffect(() => { fetchClaims() }, [])

  const handleAction = async (claimId: string, action: "approve" | "reject", note?: string) => {
    setActionId(claimId)
    try {
      const res = await fetch(`/api/admin/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      })
      if (res.ok) fetchClaims()
    } catch {} finally {
      setActionId(null)
      setRejectingId(null)
      setRejectNote("")
    }
  }

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading claims...</div>

  const pending = claims.filter((c) => ["PENDING", "EMAIL_SENT", "EMAIL_VERIFIED"].includes(c.status))
  const resolved = claims.filter((c) => ["APPROVED", "REJECTED"].includes(c.status))

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    EMAIL_SENT: "bg-blue-100 text-blue-700",
    EMAIL_VERIFIED: "bg-green-100 text-green-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Club Claims</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review and manage club ownership claims
        </p>
      </div>

      {claims.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No claims yet</h3>
          <p className="text-gray-600">
            When users request to claim unclaimed clubs, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending claims */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Pending Review ({pending.length})
              </h3>
              <div className="space-y-3">
                {pending.map((claim) => (
                  <div key={claim.id} className="rounded-lg border border-yellow-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{claim.tenant.name}</h4>
                        <p className="text-sm text-gray-500">{claim.tenant.city}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Claimed by: <strong>{claim.user.firstName} {claim.user.lastName}</strong> ({claim.user.email})
                        </p>
                        {claim.message && (
                          <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{claim.message}&rdquo;</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[claim.status]}`}>
                            {claim.status.replace("_", " ").toLowerCase()}
                          </span>
                          <span className="text-xs text-gray-400">
                            {format(new Date(claim.createdAt), "MMM d, yyyy")}
                          </span>
                          {claim.tenant.contactEmail && (
                            <span className="text-xs text-gray-400">
                              Club email: {claim.tenant.contactEmail}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => handleAction(claim.id, "approve")}
                          disabled={actionId === claim.id}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
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
                              className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs"
                            />
                            <button
                              onClick={() => handleAction(claim.id, "reject", rejectNote)}
                              className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
                            >
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRejectingId(claim.id)}
                            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Resolved ({resolved.length})
              </h3>
              <div className="space-y-2">
                {resolved.map((claim) => (
                  <div key={claim.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{claim.tenant.name}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          by {claim.user.firstName} {claim.user.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[claim.status]}`}>
                          {claim.status.toLowerCase()}
                        </span>
                        {claim.reviewedAt && (
                          <span className="text-xs text-gray-400">
                            {format(new Date(claim.reviewedAt), "MMM d")}
                          </span>
                        )}
                      </div>
                    </div>
                    {claim.reviewNote && (
                      <p className="text-xs text-gray-500 mt-1">{claim.reviewNote}</p>
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
