"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, toneForStatus } from "@/components/ui"

/**
 * Roster actions ON the team page (owner 2026-07-29: "why can't everything
 * be done from the team roster page?"): approve/deny this team's pending
 * change requests and edit the locked roster (audited override) in place —
 * the Teams-tab queue remains as the cross-team triage view.
 */
export function RosterTools({
  seasonId,
  submissionId,
  teamId,
  canOverride,
  requests,
}: {
  seasonId: string
  submissionId: string
  teamId: string
  canOverride: boolean
  requests: Array<{
    id: string
    status: string
    message: string
    createdAt: string
    requestedBy: string
  }>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [players, setPlayers] = useState<
    Array<{ playerId: string; name: string; jerseyNumber: number | null }> | null
  >(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const resolve = async (requestId: string, action: "approve" | "deny") => {
    if (
      action === "approve" &&
      !window.confirm("Approve this roster change? It applies to the roster immediately.")
    )
      return
    setBusy(requestId)
    setError(null)
    try {
      const res = await fetch(`/api/roster-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't resolve the request")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resolve the request")
    } finally {
      setBusy(null)
    }
  }

  const openEditor = async () => {
    if (editOpen) {
      setEditOpen(false)
      return
    }
    setEditOpen(true)
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/roster-preview?teamId=${teamId}`).catch(
      () => null
    )
    if (!res?.ok) {
      setError("Couldn't load the club's player list")
      return
    }
    const data = await res.json()
    setPlayers(data.players ?? [])
    setSelected(new Set(data.submission?.currentPlayerIds ?? []))
  }

  const saveOverride = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/submissions/${submissionId}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't save the roster")
      setEditOpen(false)
      setPlayers(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the roster")
    } finally {
      setSaving(false)
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING")
  const resolved = requests.filter((r) => r.status !== "PENDING").slice(0, 5)

  return (
    <div className="space-y-3">
      {error && <p className="text-hoop-600 text-sm">{error}</p>}
      {pending.map((r) => (
        <div
          key={r.id}
          className="bg-gold-50 border-gold-100 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
        >
          <span className="text-ink-800 min-w-0 text-sm">
            <span className="font-medium">{r.requestedBy}</span>
            {r.message ? `: ${r.message}` : " requested a roster change"}
          </span>
          <span className="flex shrink-0 gap-2">
            <Button size="sm" tone="court" disabled={busy === r.id} onClick={() => resolve(r.id, "approve")}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              tone="hoop"
              disabled={busy === r.id}
              onClick={() => resolve(r.id, "deny")}
            >
              Deny
            </Button>
          </span>
        </div>
      ))}
      {resolved.map((r) => (
        <p key={r.id} className="text-ink-500 text-xs">
          <Badge tone={toneForStatus(r.status)}>{r.status.toLowerCase()}</Badge>{" "}
          {r.requestedBy}
          {r.message ? `: ${r.message}` : ""}
        </p>
      ))}
      {canOverride && (
        <div>
          <button onClick={openEditor} className="text-play-700 text-xs font-semibold hover:underline">
            {editOpen ? "Close roster editor" : "Edit roster"}
          </button>
          {editOpen && (
            <div className="border-ink-100 mt-2 rounded-xl border p-3">
              {!players ? (
                <p className="text-ink-500 text-sm">Loading players…</p>
              ) : (
                <>
                  <p className="text-ink-500 mb-2 text-xs">
                    Tick the players who belong on the submitted roster. League edits are
                    audited and the club is notified automatically.
                  </p>
                  <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
                    {players.map((p) => (
                      <label
                        key={p.playerId}
                        className="hover:bg-court-50 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(p.playerId)}
                          onChange={(e) => {
                            const next = new Set(selected)
                            if (e.target.checked) next.add(p.playerId)
                            else next.delete(p.playerId)
                            setSelected(next)
                          }}
                        />
                        <span className="text-ink-800">
                          {p.name}
                          {p.jerseyNumber != null && (
                            <span className="text-ink-400"> #{p.jerseyNumber}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Button size="sm" tone="court" disabled={saving} onClick={saveOverride}>
                      {saving ? "Saving…" : `Save roster (${selected.size})`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
