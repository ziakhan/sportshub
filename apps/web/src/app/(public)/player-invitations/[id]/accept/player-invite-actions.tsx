"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Player {
  id: string
  firstName: string
  lastName: string
}

export function PlayerInviteActions({
  invitationId,
  players,
  suggestedName,
}: {
  invitationId: string
  players: Player[]
  suggestedName: string | null
}) {
  const router = useRouter()
  // Pre-select a player whose name matches the invitation's playerName, if any.
  const suggested = suggestedName
    ? players.find(
        (p) => `${p.firstName} ${p.lastName}`.toLowerCase() === suggestedName.toLowerCase()
      )
    : undefined
  const [playerId, setPlayerId] = useState(suggested?.id ?? "")
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<"accepted" | "declined" | null>(null)

  async function respond(action: "accept" | "decline") {
    if (action === "accept" && !playerId) {
      setError("Select which player this invitation is for.")
      return
    }
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/player-invitations/${invitationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "accept" ? { action, playerId } : { action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (HTTP ${res.status})`)
      }
      setDone(action === "accept" ? "accepted" : "declined")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  if (done === "accepted") {
    return (
      <div className="border-play-200 bg-play-50 text-play-700 rounded-xl border p-4 text-sm">
        ✅ Accepted — a roster offer has been created. Review sizes and confirm to finish.{" "}
        <a href="/offers" className="font-semibold underline">
          Review your offer →
        </a>
      </div>
    )
  }
  if (done === "declined") {
    return (
      <div className="border-ink-200 bg-ink-50 text-ink-700 rounded-xl border p-4 text-sm">
        Invitation declined. The club has been notified.
      </div>
    )
  }

  if (players.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border-ink-200 bg-ink-50 text-ink-700 rounded-xl border p-4 text-sm">
          Add the player this invitation is for, then come back to accept.
        </div>
        <Link
          href={`/players/add?redirect=/player-invitations/${invitationId}/accept`}
          className="bg-play-600 hover:bg-play-700 block rounded-xl px-4 py-2 text-center font-semibold text-white transition"
        >
          Add a player
        </Link>
        <button
          onClick={() => respond("decline")}
          disabled={busy !== null}
          className="border-ink-200 text-ink-700 hover:bg-court-50 block w-full rounded-xl border px-4 py-2 font-semibold transition"
        >
          {busy === "decline" ? "Declining…" : "Decline invitation"}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="pi-player" className="text-ink-800 block text-sm font-medium">
          Player <span className="text-red-500">*</span>
        </label>
        <select
          id="pi-player"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="border-ink-200 focus:ring-play-500/20 mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2"
        >
          <option value="">Choose a player...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
        <Link
          href={`/players/add?redirect=/player-invitations/${invitationId}/accept`}
          className="text-play-600 hover:text-play-700 mt-1.5 inline-block text-xs font-semibold"
        >
          + Add another player
        </Link>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => respond("accept")}
          disabled={busy !== null}
          className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-2 font-semibold text-white transition disabled:cursor-not-allowed"
        >
          {busy === "accept" ? "Accepting…" : "Accept"}
        </button>
        <button
          onClick={() => respond("decline")}
          disabled={busy !== null}
          className="border-ink-200 text-ink-700 hover:bg-court-50 disabled:opacity-50 flex-1 rounded-xl border px-4 py-2 font-semibold transition disabled:cursor-not-allowed"
        >
          {busy === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  )
}
