"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, toneForStatus } from "@/components/ui"
import {
  RosterChangeReviewDialog,
  type RosterChangePreview,
} from "@/components/roster-change-review"

interface RequestRow {
  id: string
  status: string
  message: string
  createdAt: string
  requestedBy: string
  additionNames: string[]
  removalNames: string[]
}

/**
 * Roster actions ON the team page (owner 2026-07-29):
 * - approve/deny the club's change requests through a confirm-with-diff
 *   dialog (in / out / final roster) — never a blind Approve;
 * - league edits are REMOVE-ONLY, each removal carrying a reason that goes
 *   to the club verbatim. Additions only ever arrive via club requests.
 */
export function RosterTools({
  seasonId,
  submissionId,
  canEdit,
  roster,
  requests,
}: {
  seasonId: string
  submissionId: string
  canEdit: boolean
  roster: Array<{ playerId: string; name: string; jerseyNumber: number | null }>
  requests: RequestRow[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{
    preview: RosterChangePreview
    run: () => Promise<void>
  } | null>(null)

  // League edit state: removals collected before review
  const [editOpen, setEditOpen] = useState(false)
  const [removals, setRemovals] = useState<Map<string, string>>(new Map()) // playerId -> reason
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  const [reasonDraft, setReasonDraft] = useState("")

  const rosterNames = roster.map((r) => r.name)

  const patch = async (body: unknown) => {
    const res = await fetch(`/api/seasons/${seasonId}/submissions/${submissionId}/roster`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Couldn't save the roster")
  }

  const resolveRequest = async (requestId: string, action: "approve" | "deny") => {
    const res = await fetch(`/api/roster-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Couldn't resolve the request")
  }

  const openApproveDialog = (r: RequestRow) => {
    const structured = r.additionNames.length + r.removalNames.length > 0
    const removeSet = new Set(r.removalNames)
    const finalRoster = structured
      ? [...rosterNames.filter((n) => !removeSet.has(n)), ...r.additionNames]
      : rosterNames
    setDialog({
      preview: {
        title: `Approve roster change — ${r.requestedBy}`,
        subtitle: r.message || null,
        additions: r.additionNames,
        removals: r.removalNames.map((name) => ({ name })),
        finalRoster,
        unlockOnly: !structured,
        confirmLabel: "Approve change",
      },
      run: async () => {
        await resolveRequest(r.id, "approve")
      },
    })
  }

  const openEditReview = () => {
    const out = roster
      .filter((r) => removals.has(r.playerId))
      .map((r) => ({ name: r.name, reason: removals.get(r.playerId) }))
    setDialog({
      preview: {
        title: "League roster edit — removals",
        subtitle: null,
        additions: [],
        removals: out,
        finalRoster: roster.filter((r) => !removals.has(r.playerId)).map((r) => r.name),
        confirmLabel: `Remove ${out.length} player${out.length === 1 ? "" : "s"}`,
      },
      run: async () => {
        await patch({
          removals: [...removals.entries()].map(([playerId, reason]) => ({ playerId, reason })),
        })
        setRemovals(new Map())
        setEditOpen(false)
      },
    })
  }

  const confirmDialog = async () => {
    if (!dialog) return
    setBusy(true)
    setError(null)
    try {
      await dialog.run()
      setDialog(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setDialog(null)
    } finally {
      setBusy(false)
    }
  }

  const deny = async (requestId: string) => {
    setBusy(true)
    setError(null)
    try {
      await resolveRequest(requestId, "deny")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't deny the request")
    } finally {
      setBusy(false)
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
            {r.additionNames.length + r.removalNames.length > 0 && (
              <span className="text-ink-500">
                {" "}
                (+{r.additionNames.length} / −{r.removalNames.length})
              </span>
            )}
            {r.message ? `: ${r.message}` : " requested a roster change"}
          </span>
          <span className="flex shrink-0 gap-2">
            <Button size="sm" tone="court" disabled={busy} onClick={() => openApproveDialog(r)}>
              Review &amp; approve
            </Button>
            <Button size="sm" variant="secondary" tone="hoop" disabled={busy} onClick={() => deny(r.id)}>
              Deny
            </Button>
          </span>
        </div>
      ))}
      {resolved.map((r) => (
        <p key={r.id} className="text-ink-500 text-xs">
          <Badge tone={toneForStatus(r.status)}>{r.status.toLowerCase()}</Badge> {r.requestedBy}
          {r.message ? `: ${r.message}` : ""}
        </p>
      ))}

      {canEdit && (
        <div>
          <button
            onClick={() => {
              setEditOpen((v) => !v)
              setRemovals(new Map())
              setReasonFor(null)
            }}
            className="text-play-700 text-xs font-semibold hover:underline"
          >
            {editOpen ? "Close roster editor" : "Edit roster"}
          </button>
          {editOpen && (
            <div className="border-ink-100 mt-2 rounded-xl border p-3">
              <p className="text-ink-500 mb-2 text-xs">
                League edits are remove-only — each removal needs a reason the club will read
                word-for-word. Additions come from the club as change requests.
              </p>
              <div className="grid gap-1">
                {roster.map((p) => {
                  const marked = removals.has(p.playerId)
                  return (
                    <div
                      key={p.playerId}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${
                        marked ? "bg-hoop-50" : "hover:bg-court-50"
                      }`}
                    >
                      <span className={marked ? "text-hoop-700 line-through" : "text-ink-800"}>
                        {p.jerseyNumber != null && (
                          <span className="text-ink-400">#{p.jerseyNumber} </span>
                        )}
                        {p.name}
                        {marked && (
                          <span className="text-ink-500 no-underline"> — {removals.get(p.playerId)}</span>
                        )}
                      </span>
                      {marked ? (
                        <button
                          onClick={() => {
                            const next = new Map(removals)
                            next.delete(p.playerId)
                            setRemovals(next)
                          }}
                          className="text-ink-500 text-xs font-semibold hover:underline"
                        >
                          Undo
                        </button>
                      ) : reasonFor === p.playerId ? (
                        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                          <input
                            autoFocus
                            value={reasonDraft}
                            onChange={(e) => setReasonDraft(e.target.value)}
                            placeholder="Reason the club will see…"
                            className="border-ink-200 min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs sm:max-w-xs"
                          />
                          <button
                            disabled={reasonDraft.trim().length < 3}
                            onClick={() => {
                              const next = new Map(removals)
                              next.set(p.playerId, reasonDraft.trim())
                              setRemovals(next)
                              setReasonFor(null)
                              setReasonDraft("")
                            }}
                            className="text-hoop-700 text-xs font-semibold disabled:opacity-40"
                          >
                            Mark for removal
                          </button>
                          <button
                            onClick={() => {
                              setReasonFor(null)
                              setReasonDraft("")
                            }}
                            className="text-ink-400 text-xs"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setReasonFor(p.playerId)
                            setReasonDraft("")
                          }}
                          className="text-hoop-600 text-xs font-semibold hover:underline"
                        >
                          Remove…
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {removals.size > 0 && (
                <div className="mt-3">
                  <Button size="sm" tone="hoop" disabled={busy} onClick={openEditReview}>
                    Review {removals.size} removal{removals.size === 1 ? "" : "s"}…
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {dialog && (
        <RosterChangeReviewDialog
          preview={dialog.preview}
          busy={busy}
          onConfirm={confirmDialog}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}
