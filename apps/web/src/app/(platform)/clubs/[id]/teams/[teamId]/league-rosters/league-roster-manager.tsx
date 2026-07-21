"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Badge, Button, PanelHeader, toneForStatus } from "@/components/ui"

interface RosterPlayer {
  playerId: string
  name: string
  jerseyNumber: number | null
  position: string | null
  /** League-waiver signing status (owner 2026-07-20): staff see it on the roster. */
  waiversTotal?: number
  waiversOutstanding?: number
}

interface RosterVersion {
  submissionId: string
  submissionStatus: string
  leagueName: string
  seasonId: string
  seasonLabel: string
  divisionName: string | null
  policy: string
  deadline: string | null
  isLocked: boolean
  submittedAt: string | null
  canEdit: boolean
  canRequest: boolean
  reason: string
  players: RosterPlayer[]
  requests: {
    id: string
    status: string
    message: string
    createdAt: string
    resolutionNote: string | null
  }[]
}

const POLICY_LABEL: Record<string, string> = {
  OPEN_UNTIL_DEADLINE: "changes open until deadline",
  REQUEST_ONLY: "changes by league approval",
  CLOSED: "no changes after lock",
}

export function LeagueRosterManager({
  versions,
  clubRoster,
  highlight,
}: {
  versions: RosterVersion[]
  clubRoster: RosterPlayer[]
  highlight?: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [requesting, setRequesting] = useState<string | null>(null)
  const [requestMessage, setRequestMessage] = useState("")
  const [requestAdds, setRequestAdds] = useState<Set<string>>(new Set())
  const [requestRemoves, setRequestRemoves] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  // Owner 2026-07-18: withdrawing an APPROVED team needs the league's
  // sign-off — track our pending withdrawal requests by submissionId.
  const [withdrawing, setWithdrawing] = useState<string | null>(null)
  const [withdrawReason, setWithdrawReason] = useState("")
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Record<string, string>>({})

  const loadWithdrawals = async () => {
    try {
      const res = await fetch("/api/withdrawal-requests")
      if (!res.ok) return
      const data = await res.json()
      const map: Record<string, string> = {}
      for (const r of data.made ?? []) {
        if (r.status === "PENDING" && r.submission?.id) map[r.submission.id] = r.id
      }
      setPendingWithdrawals(map)
    } catch {
      // non-fatal — the Withdraw button just behaves as if nothing is pending
    }
  }

  useEffect(() => {
    loadWithdrawals()
  }, []) // eslint-disable-line

  const requestWithdrawal = async (v: RosterVersion) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/withdrawal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CLUB_FROM_LEAGUE",
          submissionId: v.submissionId,
          reason: withdrawReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't send the withdrawal request")
      setMessage({
        type: "success",
        text: `Withdrawal request sent — ${v.leagueName} will review it.`,
      })
      setWithdrawing(null)
      setWithdrawReason("")
      loadWithdrawals()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Couldn't send" })
    } finally {
      setBusy(false)
    }
  }

  const cancelWithdrawal = async (requestId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/withdrawal-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      if (res.ok) {
        setMessage({ type: "success", text: "Withdrawal request cancelled." })
        loadWithdrawals()
      }
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (v: RosterVersion) => {
    setEditing(v.submissionId)
    setRequesting(null)
    setSelection(new Set(v.players.map((p) => p.playerId)))
    setMessage(null)
  }

  const toggle = (playerId: string) => {
    setSelection((current) => {
      const next = new Set(current)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const saveEdit = async (v: RosterVersion) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/seasons/${v.seasonId}/submissions/${v.submissionId}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [...selection] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't save the roster")
      setMessage({
        type: "success",
        text: `Roster saved (${data.playerCount} players)${data.relocked ? " — the roster is locked again." : "."}`,
      })
      setEditing(null)
      router.refresh()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Couldn't save" })
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (v: RosterVersion) => {
    if (
      !window.confirm(
        "Withdraws the team from the season — future games are cancelled and opponents notified."
      )
    )
      return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/seasons/${v.seasonId}/teams/${v.submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "WITHDRAWN" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't withdraw the team")
      setMessage({
        type: "success",
        text: `Withdrawn from ${v.leagueName}${
          data.cancelledGames > 0
            ? ` — ${data.cancelledGames} upcoming game(s) cancelled.`
            : "."
        }`,
      })
      setEditing(null)
      setRequesting(null)
      router.refresh()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Couldn't withdraw" })
    } finally {
      setBusy(false)
    }
  }

  const sendRequest = async (v: RosterVersion) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/seasons/${v.seasonId}/submissions/${v.submissionId}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: requestMessage,
          additions: [...requestAdds],
          removals: [...requestRemoves],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't send the request")
      setMessage({ type: "success", text: "Request sent — the league will review it." })
      setRequesting(null)
      setRequestMessage("")
      setRequestAdds(new Set())
      setRequestRemoves(new Set())
      router.refresh()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Couldn't send" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-xl border px-4 py-2 text-sm ${
            message.type === "success"
              ? "border-court-200 bg-court-50 text-court-700"
              : "border-hoop-200 bg-hoop-50 text-hoop-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {versions.map((v, i) => {
        const pendingRequest = v.requests.find((r) => r.status === "PENDING")
        const isEditing = editing === v.submissionId
        const isRequesting = requesting === v.submissionId
        const highlighted = highlight === v.submissionId

        return (
          <div
            key={v.submissionId}
            style={{ animationDelay: `${i * 70}ms` }}
            className={`reveal border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white ${
              highlighted ? "ring-play-200 ring-2" : ""
            }`}
          >
            <PanelHeader
              variant="band"
              title={
                <>
                  {v.leagueName}
                  <span className="text-ink-400 font-medium"> · {v.seasonLabel}</span>
                  {v.divisionName && (
                    <span className="text-ink-400 font-medium"> · {v.divisionName}</span>
                  )}
                </>
              }
              action={
                <span className="flex flex-wrap items-center gap-2">
                  {v.canEdit && !isEditing && (
                    <Button size="sm" onClick={() => startEdit(v)}>
                      Edit roster
                    </Button>
                  )}
                  {v.canRequest && !pendingRequest && !isRequesting && (
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        setRequesting(v.submissionId)
                        setEditing(null)
                        setMessage(null)
                        setRequestAdds(new Set())
                        setRequestRemoves(new Set())
                      }}
                    >
                      Request change
                    </Button>
                  )}
                  {pendingWithdrawals[v.submissionId] ? (
                    <>
                      <Badge tone="warning">Withdrawal requested</Badge>
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => cancelWithdrawal(pendingWithdrawals[v.submissionId])}
                        disabled={busy}
                      >
                        Cancel request
                      </Button>
                    </>
                  ) : v.submissionStatus === "PENDING" ? (
                    <Button
                      variant="secondary"
                      tone="hoop"
                      size="sm"
                      onClick={() => withdraw(v)}
                      disabled={busy}
                    >
                      Withdraw from league
                    </Button>
                  ) : v.submissionStatus === "APPROVED" ? (
                    <Button
                      variant="secondary"
                      tone="hoop"
                      size="sm"
                      onClick={() => {
                        setWithdrawing(withdrawing === v.submissionId ? null : v.submissionId)
                        setWithdrawReason("")
                        setMessage(null)
                      }}
                      disabled={busy}
                    >
                      Request withdrawal
                    </Button>
                  ) : null}
                </span>
              }
            />
            {withdrawing === v.submissionId && (
              <div className="border-ink-100 bg-ink-50/50 border-b px-6 py-4">
                <p className="text-ink-700 mb-2 text-sm font-medium">
                  Request withdrawal from {v.leagueName}
                </p>
                <p className="text-ink-500 mb-3 text-xs">
                  Your team is approved for this season, so the league has to sign off. If
                  approved, upcoming games are cancelled and opponents notified.
                </p>
                <textarea
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Why is the team withdrawing? (required)"
                  rows={2}
                  className="border-ink-200 mb-3 w-full rounded-lg border px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    tone="hoop"
                    onClick={() => requestWithdrawal(v)}
                    disabled={busy || withdrawReason.trim().length < 3}
                  >
                    Send request
                  </Button>
                  <Button size="sm" variant="subtle" onClick={() => setWithdrawing(null)}>
                    Never mind
                  </Button>
                </div>
              </div>
            )}
            <div className="border-ink-100 border-b px-6 py-3">
              <div className="text-ink-500 flex flex-wrap items-center gap-2 text-xs">
                {v.submissionStatus === "WITHDRAWN" && (
                  <Badge tone={toneForStatus(v.submissionStatus)}>Withdrawn</Badge>
                )}
                <Badge tone={toneForStatus(v.isLocked ? "LOCKED" : "OPEN")} dot>
                  {v.isLocked ? "Locked" : "Open"}
                </Badge>
                <span className="bg-ink-50 text-ink-600 rounded-full px-2.5 py-0.5 font-medium">
                  {POLICY_LABEL[v.policy] ?? v.policy}
                  {v.deadline ? ` (${format(new Date(v.deadline), "MMM d")})` : ""}
                </span>
                {v.submittedAt && (
                  <span>submitted {format(new Date(v.submittedAt), "MMM d, yyyy")}</span>
                )}
                <span>{v.players.length} players</span>
              </div>
              {!v.canEdit && (
                <p className="text-ink-400 mt-2 text-xs">{v.reason}</p>
              )}
              {pendingRequest && (
                <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mt-2 rounded-xl border px-3 py-2 text-xs">
                  Change request pending with the league since{" "}
                  {format(new Date(pendingRequest.createdAt), "MMM d")}: “{pendingRequest.message}”
                </div>
              )}
            </div>

            {isRequesting && (() => {
              const onRosterIds = new Set(v.players.map((p) => p.playerId))
              const addable = clubRoster.filter((p) => !onRosterIds.has(p.playerId))
              const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
                const next = new Set(set)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                setter(next)
              }
              return (
                <div className="border-ink-100 border-b px-6 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-ink-600 mb-1 text-xs font-medium">
                        Remove from league roster ({requestRemoves.size})
                      </p>
                      <div className="border-ink-200 max-h-44 space-y-0.5 overflow-y-auto rounded-xl border p-2">
                        {v.players.length === 0 && (
                          <p className="text-ink-400 p-1 text-xs">Roster is empty.</p>
                        )}
                        {v.players.map((p) => (
                          <label
                            key={p.playerId}
                            className="hover:bg-hoop-50 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={requestRemoves.has(p.playerId)}
                              onChange={() => toggle(requestRemoves, setRequestRemoves, p.playerId)}
                              className="accent-hoop-600"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                              {p.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-ink-600 mb-1 text-xs font-medium">
                        Add from club roster ({requestAdds.size})
                      </p>
                      <div className="border-ink-200 max-h-44 space-y-0.5 overflow-y-auto rounded-xl border p-2">
                        {addable.length === 0 && (
                          <p className="text-ink-400 p-1 text-xs">
                            Everyone on the club roster is already in this league.
                          </p>
                        )}
                        {addable.map((p) => (
                          <label
                            key={p.playerId}
                            className="hover:bg-court-50 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={requestAdds.has(p.playerId)}
                              onChange={() => toggle(requestAdds, setRequestAdds, p.playerId)}
                              className="accent-court-600"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                              {p.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <label className="text-ink-600 mb-1 mt-3 block text-xs font-medium">
                    Note for the league (optional)
                  </label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. Two call-ups from our Grade 8 squad after an injury"
                    className="border-ink-200 focus:border-[color:var(--brand)] w-full rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none"
                  />
                  <p className="text-ink-400 mt-1 text-xs">
                    Nothing changes until the league approves — approval applies these
                    adds/removes to the locked roster.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => sendRequest(v)}
                      disabled={
                        busy ||
                        (requestAdds.size + requestRemoves.size === 0 &&
                          requestMessage.trim().length < 5)
                      }
                    >
                      {busy
                        ? "Sending…"
                        : `Send request${requestAdds.size + requestRemoves.size > 0 ? ` (+${requestAdds.size} / -${requestRemoves.size})` : ""}`}
                    </Button>
                    <Button variant="subtle" size="sm" onClick={() => setRequesting(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            })()}

            {isEditing ? (
              <div className="px-6 py-4">
                <p className="text-ink-600 mb-2 text-xs font-medium">
                  Pick this league&apos;s version from your club roster (
                  {selection.size}/{clubRoster.length} selected)
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {clubRoster.map((p) => (
                    <label
                      key={p.playerId}
                      className="hover:bg-ink-50 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selection.has(p.playerId)}
                        onChange={() => toggle(p.playerId)}
                        className="accent-[color:var(--brand)]"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                        {p.name}
                      </span>
                      {p.position && <span className="text-ink-400 text-xs">{p.position}</span>}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(v)} disabled={busy || selection.size === 0}>
                    {busy ? "Saving…" : `Save version (${selection.size} players)`}
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="divide-ink-100 min-w-full divide-y">
                  <thead className="bg-ink-50/60">
                    <tr>
                      <th className="text-ink-500 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">#</th>
                      <th className="text-ink-500 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Player</th>
                      <th className="text-ink-500 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Position</th>
                      <th className="text-ink-500 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Waivers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-ink-100 divide-y">
                    {v.players.map((p) => (
                      <tr key={p.playerId} className="hover:bg-ink-50/60 transition-colors">
                        <td className="text-ink-600 whitespace-nowrap px-4 py-2 text-sm">
                          {p.jerseyNumber ?? "—"}
                        </td>
                        <td className="text-ink-900 whitespace-nowrap px-4 py-2 text-sm font-medium">
                          {p.name}
                        </td>
                        <td className="text-ink-600 whitespace-nowrap px-4 py-2 text-sm">
                          {p.position ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm">
                          {!p.waiversTotal ? (
                            <span className="text-ink-400">—</span>
                          ) : p.waiversOutstanding === 0 ? (
                            <Badge tone="court">Signed</Badge>
                          ) : (
                            <Badge tone="warning">
                              {p.waiversOutstanding} unsigned
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
