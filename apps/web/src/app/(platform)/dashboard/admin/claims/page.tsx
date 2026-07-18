"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Badge, Button, toneForStatus } from "@/components/ui"

interface Claim {
  id: string
  status: string
  message: string | null
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
  tenant: { id: string; name: string; city: string | null; contactEmail: string | null }
  // v2: anonymous (paper-proof) claims have no user until the token is redeemed
  user: { id: string; email: string; firstName: string | null; lastName: string | null } | null
  claimantEmail: string | null
  proofNote: string | null
  corrections: Record<string, string> | null
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

  if (loading)
    return (
      <div className="text-ink-500 py-12 text-center motion-safe:animate-pulse">Loading claims&hellip;</div>
    )

  const pending = claims.filter((c) =>
    ["PENDING", "EMAIL_SENT", "EMAIL_VERIFIED"].includes(c.status)
  )
  const resolved = claims.filter((c) => ["APPROVED", "REJECTED"].includes(c.status))

  return (
    <div className="space-y-6">
      <div className="border-ink-100 shadow-soft reveal rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">Club claims</h2>
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
                {pending.map((claim, i) => (
                  <div
                    key={claim.id}
                    className="border-play-200 shadow-soft reveal hover:border-brand-line rounded-2xl border bg-white p-5 transition"
                    style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-ink-950 font-semibold">{claim.tenant.name}</h4>
                        <p className="text-ink-500 text-sm">{claim.tenant.city}</p>
                        <p className="text-ink-600 mt-1 text-sm">
                          Claimed by:{" "}
                          {claim.user ? (
                            <>
                              <strong>
                                {claim.user.firstName} {claim.user.lastName}
                              </strong>{" "}
                              ({claim.user.email})
                            </>
                          ) : (
                            <>
                              <strong>anonymous claimer</strong>
                              {claim.claimantEmail ? ` (${claim.claimantEmail})` : ""} — proof
                              review
                            </>
                          )}
                        </p>
                        {claim.proofNote && (
                          <p className="text-ink-600 border-ink-100 bg-ink-50/60 mt-2 rounded-lg border p-2 text-xs">
                            <span className="font-semibold">Proof:</span> {claim.proofNote}
                          </p>
                        )}
                        {claim.corrections && Object.keys(claim.corrections).length > 0 && (
                          <p className="text-ink-600 mt-1 text-xs">
                            <span className="font-semibold">Proposed corrections:</span>{" "}
                            {Object.entries(claim.corrections as Record<string, string>)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                        )}
                        {claim.message && (
                          <p className="text-ink-500 mt-1 text-xs italic">
                            &ldquo;{claim.message}&rdquo;
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <Badge tone={toneForStatus(claim.status)}>
                            {claim.status.replace("_", " ").toLowerCase()}
                          </Badge>
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
                        <Button
                          size="sm"
                          tone="court"
                          onClick={() => handleAction(claim.id, "approve")}
                          disabled={actionId === claim.id}
                        >
                          Approve
                        </Button>
                        {rejectingId === claim.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="Reason..."
                              className="border-ink-300 w-32 rounded-md border px-2 py-1 text-xs"
                            />
                            <Button size="sm" tone="hoop" onClick={() => handleAction(claim.id, "reject", rejectNote)}>
                              Confirm
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="secondary" tone="hoop" onClick={() => setRejectingId(claim.id)}>
                            Reject
                          </Button>
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
                          by{" "}
                          {claim.user
                            ? `${claim.user.firstName} ${claim.user.lastName}`
                            : (claim.claimantEmail ?? "anonymous claimer")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={toneForStatus(claim.status)}>{claim.status.toLowerCase()}</Badge>
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
