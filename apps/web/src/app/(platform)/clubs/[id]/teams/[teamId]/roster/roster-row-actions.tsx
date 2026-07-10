"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/** Per-row manual controls: jersey edit (clash-guarded server-side) + release,
 *  or reactivate when the row is a released (INACTIVE) player. */
export function RosterRowActions({
  teamId,
  playerId,
  playerName,
  jerseyNumber,
  status = "ACTIVE",
}: {
  teamId: string
  playerId: string
  playerName: string
  jerseyNumber: number | null
  status?: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(jerseyNumber?.toString() ?? "")
  const [busy, setBusy] = useState(false)

  const saveJersey = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jerseyNumber: value === "" ? null : Number(value) }),
      })
      const data = await res.json()
      if (!res.ok) {
        window.alert(data.error || "Couldn't change the jersey number")
        return
      }
      setEditing(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const release = async () => {
    if (
      !window.confirm(
        `Release ${playerName} from this roster? Their history is kept; they can be re-added any time.`
      )
    )
      return
    setBusy(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        window.alert(data.error || "Couldn't release the player")
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const reactivate = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // e.g. jersey-number clash returned by the API
        window.alert(data.error || "Couldn't reactivate the player")
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // Released players get a single action: bring them back.
  if (status === "INACTIVE") {
    return (
      <button
        onClick={reactivate}
        disabled={busy}
        className="text-court-700 text-xs font-semibold transition-colors hover:underline disabled:opacity-50"
      >
        Reactivate
      </button>
    )
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={99}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="brand-focus border-ink-200 w-16 rounded-lg border bg-white px-2 py-1 text-sm"
          autoFocus
        />
        <button
          onClick={saveJersey}
          disabled={busy}
          className="text-xs font-semibold text-[color:var(--brand-ink)] transition-colors hover:underline disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-ink-400 hover:text-ink-600 text-xs transition-colors hover:underline"
        >
          ✕
        </button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="text-xs font-semibold text-[color:var(--brand-ink)] transition-colors hover:underline"
        title="Manually set jersey number"
      >
        Edit #
      </button>
      <button
        onClick={release}
        disabled={busy}
        className="text-hoop-600 hover:text-hoop-700 text-xs font-semibold transition-colors hover:underline disabled:opacity-50"
      >
        Release
      </button>
    </span>
  )
}
