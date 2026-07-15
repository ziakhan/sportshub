"use client"

import { useCallback, useEffect, useState } from "react"
import { PanelHeader } from "@/components/ui"

/**
 * Club approval queue for coach-initiated league registrations (owner
 * 2026-07-15): approve performs the real submission (league fees follow),
 * decline sends the reason back to the coach. Renders nothing when the
 * queue is empty.
 */

interface ApprovalRequest {
  id: string
  status: string
  createdAt: string
  team: { id: string; name: string }
  season: { id: string; label: string; leagueName: string | null; teamFee: number | null }
  divisionName: string
  playerCount: number | null
  requestedBy: string
}

export function SubmissionApprovals({ clubId }: { clubId: string }) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/submission-requests`)
      if (!res.ok) return
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch {
      // stays empty
    }
  }, [clubId])

  useEffect(() => {
    void load()
  }, [load])

  async function resolve(id: string, action: "approve" | "decline") {
    let reason: string | undefined
    if (action === "decline") {
      reason = window.prompt("Reason for declining (sent to the coach):") ?? undefined
      if (reason === undefined) return // cancelled the prompt
    }
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/submission-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't update the request")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the request")
    } finally {
      setBusyId(null)
    }
  }

  if (requests.length === 0) return null

  return (
    <section className="reveal border-play-200 shadow-soft mb-8 overflow-hidden rounded-[28px] border bg-white">
      <PanelHeader
        variant="band"
        title={`League registrations to approve (${requests.length})`}
      />
      <div className="space-y-2 p-4">
        {error && (
          <p className="bg-hoop-50 text-hoop-700 rounded-lg p-2 text-xs">{error}</p>
        )}
        {requests.map((r) => (
          <div
            key={r.id}
            className="border-ink-100 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-ink-900 text-sm font-semibold">
                {r.team.name}
                <span className="text-ink-400 font-normal"> → </span>
                {r.season.leagueName ?? "League"} — {r.season.label}
              </p>
              <p className="text-ink-500 text-xs">
                {r.divisionName}
                {r.playerCount != null ? ` · ${r.playerCount} players` : ""}
                {r.season.teamFee != null ? ` · $${r.season.teamFee.toFixed(0)} team fee` : ""}
                {" · requested by "}
                {r.requestedBy}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => void resolve(r.id, "approve")}
                disabled={busyId === r.id}
                className="bg-play-600 hover:bg-play-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                Approve &amp; submit
              </button>
              <button
                onClick={() => void resolve(r.id, "decline")}
                disabled={busyId === r.id}
                className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
