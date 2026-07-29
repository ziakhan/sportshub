"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Badge, Button, PanelHeader, toneForStatus, DateTimePicker } from "@/components/ui"
import { inputClass, panelClass } from "./types"

interface RosterRequest {
  id: string
  message: string
  additions?: string[]
  removals?: string[]
  status: string
  createdAt: string
  requestedBy: string
  teamName: string
  clubName: string
}

/**
 * Commissioner counterpart of the club's "Request roster change" button:
 * the pending queue (approve = one-shot unlock, deny = keep locked) plus
 * the season's roster-change policy settings.
 */
export function RosterRequestsPanel({
  seasonId,
  policy,
  deadline,
  teams,
  refresh,
}: {
  seasonId: string
  policy: string
  deadline: string | null
  /** Approved submissions: [{ id, team: { id, name } }] — override targets */
  teams: any[]
  refresh: () => void
}) {
  const [requests, setRequests] = useState<RosterRequest[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [policyDraft, setPolicyDraft] = useState(policy)
  const [deadlineDraft, setDeadlineDraft] = useState(deadline ? deadline.slice(0, 10) : "")
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/roster-requests?status=PENDING`).catch(
      () => null
    )
    if (!res?.ok) return
    const data = await res.json()
    setRequests(data.requests ?? [])
  }, [seasonId])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const resolve = async (requestId: string, action: "approve" | "deny") => {
    const target = requests.find((r) => r.id === requestId)
    const structured = (target?.additions?.length ?? 0) + (target?.removals?.length ?? 0) > 0
    if (
      action === "approve" &&
      !window.confirm(
        structured
          ? "Approve this roster change? The listed adds/removes are applied to the locked roster immediately."
          : "Approve this roster change? The team's roster unlocks until the club saves its changes, then locks again."
      )
    )
      return
    setBusy(requestId)
    setMessage(null)
    try {
      const res = await fetch(`/api/roster-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[requestId]?.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't resolve the request")
      setMessage(
        action === "approve"
          ? structured
            ? "Approved — changes applied to the roster."
            : "Approved — roster unlocked for one change."
          : "Denied."
      )
      await loadRequests()
      refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't resolve the request")
    } finally {
      setBusy(null)
    }
  }

  const savePolicy = async () => {
    setSavingPolicy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterChangePolicy: policyDraft,
          rosterChangeDeadline: deadlineDraft ? new Date(deadlineDraft).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't save the policy")
      }
      setMessage("Roster policy saved.")
      refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save the policy")
    } finally {
      setSavingPolicy(false)
    }
  }

  return (
    <div className={`reveal ${panelClass}`}>
      <PanelHeader
        title="Roster changes"
        action={
          requests.length > 0 ? (
            <Badge tone={toneForStatus("PENDING")}>{requests.length} pending</Badge>
          ) : undefined
        }
      />

      {message && (
        <div className="border-court-200 bg-court-50 text-court-700 mb-3 rounded-xl border px-3 py-2 text-xs">
          {message}
        </div>
      )}

      {/* Policy */}
      <div className="border-court-100 bg-court-50 mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-3">
        <div>
          <label className="text-ink-600 mb-1 block text-xs font-medium">After rosters lock</label>
          <select
            value={policyDraft}
            onChange={(e) => setPolicyDraft(e.target.value)}
            className={inputClass}
          >
            <option value="REQUEST_ONLY">Changes need my approval</option>
            <option value="OPEN_UNTIL_DEADLINE">Clubs edit freely until a deadline</option>
            <option value="CLOSED">No changes at all</option>
          </select>
        </div>
        {policyDraft === "OPEN_UNTIL_DEADLINE" && (
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">Change deadline</label>
            <DateTimePicker
              mode="date"
              value={deadlineDraft}
              onChange={setDeadlineDraft}
              className="w-40"
            />
          </div>
        )}
        <Button size="sm" onClick={savePolicy} disabled={savingPolicy}>
          {savingPolicy ? "Saving…" : "Save policy"}
        </Button>
      </div>

      {/* Roster editing moved to each team's detail page (owner 2026-07-29:
          one place per team) — this panel is now purely the policy + the
          cross-team pending queue. */}

      {/* Pending queue */}
      {requests.length === 0 ? (
        <p className="text-ink-500 text-sm">No pending roster-change requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="border-ink-100 hover:border-ink-200 rounded-xl border p-3 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-ink-900 text-sm font-semibold">{r.teamName}</span>
                  <span className="text-ink-400 ml-2 text-xs">
                    {r.clubName} · {r.requestedBy} · {format(new Date(r.createdAt), "MMM d")}
                  </span>
                </div>
              </div>
              {(r.additions?.length || r.removals?.length) ? (
                <div className="mt-1 space-y-0.5 text-sm">
                  {r.additions && r.additions.length > 0 && (
                    <p className="text-court-700">+ Add: {r.additions.join(", ")}</p>
                  )}
                  {r.removals && r.removals.length > 0 && (
                    <p className="text-hoop-700">− Remove: {r.removals.join(", ")}</p>
                  )}
                  {r.message && <p className="text-ink-500 text-xs">“{r.message}”</p>}
                </div>
              ) : (
                <p className="text-ink-700 mt-1 text-sm">“{r.message}”</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Note back to the club (optional)"
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <Button
                  size="sm"
                  tone="court"
                  onClick={() => resolve(r.id, "approve")}
                  disabled={busy === r.id}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  tone="hoop"
                  onClick={() => resolve(r.id, "deny")}
                  disabled={busy === r.id}
                >
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
