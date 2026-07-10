"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

interface RosterPlayer {
  playerId: string
  name: string
  jerseyNumber: number | null
  position: string | null
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
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

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
        body: JSON.stringify({ message: requestMessage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't send the request")
      setMessage({ type: "success", text: "Request sent — the league will review it." })
      setRequesting(null)
      setRequestMessage("")
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

      {versions.map((v) => {
        const pendingRequest = v.requests.find((r) => r.status === "PENDING")
        const isEditing = editing === v.submissionId
        const isRequesting = requesting === v.submissionId
        const highlighted = highlight === v.submissionId

        return (
          <div
            key={v.submissionId}
            className={`border-ink-100 shadow-soft rounded-2xl border bg-white ${
              highlighted ? "ring-play-200 ring-2" : ""
            }`}
          >
            <div className="border-ink-100 border-b px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-ink-900 font-semibold">
                    {v.leagueName} <span className="text-ink-400 font-normal">· {v.seasonLabel}</span>
                    {v.divisionName && (
                      <span className="text-ink-400 font-normal"> · {v.divisionName}</span>
                    )}
                  </h3>
                  <div className="text-ink-500 mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {v.submissionStatus === "WITHDRAWN" && (
                      <span className="bg-ink-100 text-ink-600 rounded-full px-2 py-0.5 font-medium">
                        Withdrawn
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        v.isLocked ? "bg-ink-100 text-ink-600" : "bg-play-100 text-play-700"
                      }`}
                    >
                      {v.isLocked ? "🔒 locked" : "open"}
                    </span>
                    <span className="bg-court-50 rounded-full px-2 py-0.5">
                      {POLICY_LABEL[v.policy] ?? v.policy}
                      {v.deadline ? ` (${format(new Date(v.deadline), "MMM d")})` : ""}
                    </span>
                    {v.submittedAt && (
                      <span>submitted {format(new Date(v.submittedAt), "MMM d, yyyy")}</span>
                    )}
                    <span>{v.players.length} players</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.canEdit && !isEditing && (
                    <button
                      onClick={() => startEdit(v)}
                      className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Edit roster
                    </button>
                  )}
                  {v.canRequest && !pendingRequest && !isRequesting && (
                    <button
                      onClick={() => {
                        setRequesting(v.submissionId)
                        setEditing(null)
                        setMessage(null)
                      }}
                      className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
                    >
                      Request change
                    </button>
                  )}
                  {(v.submissionStatus === "PENDING" || v.submissionStatus === "APPROVED") && (
                    <button
                      onClick={() => withdraw(v)}
                      disabled={busy}
                      className="text-hoop-700 hover:bg-hoop-50 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Withdraw from league
                    </button>
                  )}
                </div>
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

            {isRequesting && (
              <div className="border-ink-100 border-b px-6 py-4">
                <label className="text-ink-600 mb-1 block text-xs font-medium">
                  What do you need to change, and why?
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="e.g. Adding two call-ups from our Grade 8 squad after an injury"
                  className="border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => sendRequest(v)}
                    disabled={busy || requestMessage.trim().length < 5}
                    className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send request"}
                  </button>
                  <button
                    onClick={() => setRequesting(null)}
                    className="text-ink-600 hover:bg-ink-50 rounded-xl px-3 py-2 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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
                      className="hover:bg-court-50 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selection.has(p.playerId)}
                        onChange={() => toggle(p.playerId)}
                        className="accent-play-600"
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
                  <button
                    onClick={() => saveEdit(v)}
                    disabled={busy || selection.size === 0}
                    className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Saving…" : `Save version (${selection.size} players)`}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-ink-600 hover:bg-ink-50 rounded-xl px-3 py-2 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="divide-court-200 min-w-full divide-y">
                  <thead className="bg-court-50">
                    <tr>
                      <th className="text-ink-500 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">#</th>
                      <th className="text-ink-500 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Player</th>
                      <th className="text-ink-500 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-court-200 divide-y">
                    {v.players.map((p) => (
                      <tr key={p.playerId}>
                        <td className="text-ink-600 whitespace-nowrap px-4 py-2 text-sm">
                          {p.jerseyNumber ?? "—"}
                        </td>
                        <td className="text-ink-900 whitespace-nowrap px-4 py-2 text-sm font-medium">
                          {p.name}
                        </td>
                        <td className="text-ink-600 whitespace-nowrap px-4 py-2 text-sm">
                          {p.position ?? "—"}
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
