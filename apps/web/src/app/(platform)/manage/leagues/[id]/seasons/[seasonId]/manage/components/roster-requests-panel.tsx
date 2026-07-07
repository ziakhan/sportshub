"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { panelClass } from "./types"

interface RosterRequest {
  id: string
  message: string
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
    if (
      action === "approve" &&
      !window.confirm(
        "Approve this roster change? The team's roster unlocks until the club saves its changes, then locks again."
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
      setMessage(action === "approve" ? "Approved — roster unlocked for one change." : "Denied.")
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
    <div className={panelClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-ink-900 font-semibold">
          Roster changes
          {requests.length > 0 && (
            <span className="bg-hoop-100 text-hoop-700 ml-2 rounded-full px-2 py-0.5 text-xs font-bold">
              {requests.length} pending
            </span>
          )}
        </h3>
      </div>

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
            className="border-ink-200 text-ink-900 rounded-xl border px-2 py-1.5 text-sm"
          >
            <option value="REQUEST_ONLY">Changes need my approval</option>
            <option value="OPEN_UNTIL_DEADLINE">Clubs edit freely until a deadline</option>
            <option value="CLOSED">No changes at all</option>
          </select>
        </div>
        {policyDraft === "OPEN_UNTIL_DEADLINE" && (
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">Change deadline</label>
            <input
              type="date"
              value={deadlineDraft}
              onChange={(e) => setDeadlineDraft(e.target.value)}
              className="border-ink-200 text-ink-900 rounded-xl border px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <button
          onClick={savePolicy}
          disabled={savingPolicy}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {savingPolicy ? "Saving…" : "Save policy"}
        </button>
      </div>

      {/* Commissioner override: edit any team's league roster directly */}
      <OverrideEditor seasonId={seasonId} teams={teams} refresh={refresh} onDone={setMessage} />

      {/* Pending queue */}
      {requests.length === 0 ? (
        <p className="text-ink-500 text-sm">No pending roster-change requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="border-ink-100 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-ink-900 text-sm font-semibold">{r.teamName}</span>
                  <span className="text-ink-400 ml-2 text-xs">
                    {r.clubName} · {r.requestedBy} · {format(new Date(r.createdAt), "MMM d")}
                  </span>
                </div>
              </div>
              <p className="text-ink-700 mt-1 text-sm">“{r.message}”</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Note back to the club (optional)"
                  className="border-ink-200 min-w-0 flex-1 rounded-xl border px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => resolve(r.id, "approve")}
                  disabled={busy === r.id}
                  className="bg-court-600 rounded-xl px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => resolve(r.id, "deny")}
                  disabled={busy === r.id}
                  className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Direct roster edit by the commissioner — bypasses lock + policy, always
 * audited (LEAGUE_ROSTER_EDIT) and the club gets notified.
 */
function OverrideEditor({
  seasonId,
  teams,
  refresh,
  onDone,
}: {
  seasonId: string
  teams: any[]
  refresh: () => void
  onDone: (msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [teamId, setTeamId] = useState("")
  const [players, setPlayers] = useState<
    { playerId: string; name: string; jerseyNumber: number | null }[] | null
  >(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const approved = teams.filter((t: any) => t.status === "APPROVED")

  const loadTeam = async (id: string) => {
    setTeamId(id)
    setPlayers(null)
    setErr(null)
    if (!id) return
    const res = await fetch(`/api/seasons/${seasonId}/roster-preview?teamId=${id}`).catch(
      () => null
    )
    if (!res?.ok) {
      setErr("Couldn't load the team's roster")
      return
    }
    const data = await res.json()
    setPlayers(data.players ?? [])
    setSubmissionId(data.submission?.id ?? null)
    setSelected(new Set(data.submission?.currentPlayerIds ?? []))
  }

  const save = async () => {
    if (!submissionId) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/submissions/${submissionId}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't save")
      onDone(`Roster overridden (${data.playerCount} players) — the club has been notified.`)
      setOpen(false)
      setTeamId("")
      setPlayers(null)
      refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-ink-100 mb-4 rounded-xl border p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-play-700 text-xs font-semibold hover:underline"
      >
        {open ? "Hide roster override" : "Override a team's roster (audited)"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <select
            value={teamId}
            onChange={(e) => loadTeam(e.target.value)}
            className="border-ink-200 rounded-xl border px-2 py-1.5 text-xs"
          >
            <option value="">Choose team…</option>
            {approved.map((t: any) => (
              <option key={t.id} value={t.team.id}>
                {t.team.name}
              </option>
            ))}
          </select>
          {err && <p className="text-hoop-600 text-xs">{err}</p>}
          {players && submissionId && (
            <>
              <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                {players.map((p) => (
                  <label
                    key={p.playerId}
                    className="hover:bg-court-50 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.playerId)}
                      onChange={() =>
                        setSelected((cur) => {
                          const next = new Set(cur)
                          if (next.has(p.playerId)) next.delete(p.playerId)
                          else next.add(p.playerId)
                          return next
                        })
                      }
                      className="accent-play-600"
                    />
                    {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                    {p.name}
                  </label>
                ))}
              </div>
              <button
                onClick={save}
                disabled={saving || selected.size === 0}
                className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : `Save override (${selected.size} players)`}
              </button>
            </>
          )}
          {players && !submissionId && (
            <p className="text-ink-500 text-xs">This team has no roster in this season.</p>
          )}
        </div>
      )}
    </div>
  )
}
