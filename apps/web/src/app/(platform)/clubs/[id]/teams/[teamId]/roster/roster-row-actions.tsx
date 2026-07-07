"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/** Per-row manual controls: jersey edit (clash-guarded server-side) + release. */
export function RosterRowActions({
  teamId,
  playerId,
  playerName,
  jerseyNumber,
}: {
  teamId: string
  playerId: string
  playerName: string
  jerseyNumber: number | null
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

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={99}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="border-ink-200 w-16 rounded-lg border px-2 py-1 text-sm"
          autoFocus
        />
        <button
          onClick={saveJersey}
          disabled={busy}
          className="text-play-700 text-xs font-semibold hover:underline disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-ink-400 text-xs hover:underline"
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
        className="text-play-700 text-xs font-semibold hover:underline"
        title="Manually set jersey number"
      >
        Edit #
      </button>
      <button
        onClick={release}
        disabled={busy}
        className="text-hoop-600 text-xs font-semibold hover:underline disabled:opacity-50"
      >
        Release
      </button>
    </span>
  )
}
