"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui"
import type { EligibilityRow } from "@/lib/seasons/games-played"

/**
 * Playoff-eligibility badge + commissioner override (owner 2026-07-29):
 * automatic from games played vs Season.playoffMinGames; the league can
 * overrule in either direction, note required — the note IS the ruling.
 */
export function EligibilityAction({
  seasonId,
  playerId,
  playerName,
  row,
  minGames,
}: {
  seasonId: string
  playerId: string
  playerName: string
  row: EligibilityRow
  minGames: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (eligible: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/eligibility-overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, eligible, note: note.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't save the ruling")
      setOpen(false)
      setNote("")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the ruling")
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await fetch(`/api/seasons/${seasonId}/eligibility-overrides?playerId=${playerId}`, {
        method: "DELETE",
      })
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      <button onClick={() => setOpen((v) => !v)} title={row.overrideNote ?? undefined}>
        <Badge tone={row.eligible ? "success" : "danger"}>
          {row.eligible ? "eligible" : "not eligible"}
          {row.overridden ? " *" : ""}
        </Badge>
      </button>
      {open && (
        <div
          className="border-ink-200 absolute left-0 top-7 z-40 w-72 rounded-xl border bg-white p-3 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-ink-900 text-xs font-bold">{playerName}</p>
          <p className="text-ink-500 mt-0.5 text-xs">
            {row.gamesPlayed} of {minGames} required games
            {row.overridden ? ` · league ruling: ${row.overrideNote}` : ""}
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ruling note (required)…"
            className="border-ink-200 mt-2 w-full rounded-lg border px-2 py-1.5 text-xs"
          />
          {error && <p className="text-hoop-600 mt-1 text-xs">{error}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              disabled={busy || note.trim().length < 3}
              onClick={() => save(true)}
              className="bg-court-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Rule eligible
            </button>
            <button
              disabled={busy || note.trim().length < 3}
              onClick={() => save(false)}
              className="bg-hoop-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Rule ineligible
            </button>
            {row.overridden && (
              <button
                disabled={busy}
                onClick={clear}
                className="text-ink-500 px-1.5 py-1 text-xs font-semibold hover:underline"
              >
                Clear ruling
              </button>
            )}
            <button onClick={() => setOpen(false)} className="text-ink-400 px-1 py-1 text-xs">
              Close
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
