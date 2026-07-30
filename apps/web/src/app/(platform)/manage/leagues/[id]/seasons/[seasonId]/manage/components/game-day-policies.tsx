"use client"

import { useState } from "react"

/** Game-day policies — lives with the other game-format settings. */
export function GameDayPolicies({
  league,
  patchSeason,
}: {
  league: any
  patchSeason: (body: Record<string, any>) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const allow = league?.allowGuestPlayers !== false
  const toggle = async () => {
    setBusy(true)
    try {
      await patchSeason({ allowGuestPlayers: !allow })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="border-ink-100 shadow-soft mt-4 rounded-2xl border bg-white p-4">
      <h3 className="text-ink-900 text-sm font-bold uppercase tracking-wide">Game-day policies</h3>
      <label className="mt-2 flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={allow} onChange={toggle} disabled={busy} className="mt-0.5" />
        <span>
          Allow guest players
          <span className="text-ink-400 block text-xs">
            A scorekeeper can add a pickup player (name and jersey only) to a single game when a
            team is short. Guests are labeled &quot;(Guest)&quot; in the box score, never count in
            official season stats or leaderboards, and never join a roster. Uncheck to forbid
            guests league-wide for this season.
          </span>
        </span>
      </label>
    </div>
  )
}
