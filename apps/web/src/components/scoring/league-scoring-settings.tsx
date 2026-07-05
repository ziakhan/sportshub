"use client"

import { useState } from "react"

/**
 * League scoring configuration (docs/live-scoring-design.md) — what the
 * scorekeeper console tracks and how periods/clock run. League owner only.
 */

const DEPTHS = [
  { value: "SCORE_ONLY", label: "Score only", hint: "Score, fouls, subs — six buttons" },
  {
    value: "STANDARD",
    label: "Standard",
    hint: "Adds missed shots, rebounds, assists",
  },
  {
    value: "FULL",
    label: "Full",
    hint: "Adds steals, blocks, turnovers",
  },
] as const

export function LeagueScoringSettings({
  leagueId,
  initial,
}: {
  leagueId: string
  initial: {
    statDepth?: string
    gameClockMode?: string
    periodType?: string
    periodMinutes?: number
  }
}) {
  const [statDepth, setStatDepth] = useState(initial.statDepth ?? "STANDARD")
  const [gameClockMode, setGameClockMode] = useState(initial.gameClockMode ?? "SIMPLE")
  const [periodType, setPeriodType] = useState(initial.periodType ?? "QUARTERS")
  const [periodMinutes, setPeriodMinutes] = useState(initial.periodMinutes ?? 10)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ statDepth, gameClockMode, periodType, periodMinutes }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || "Failed to save")
      return
    }
    setMessage("Scoring settings saved — applies to every game from the next console load.")
  }

  return (
    <div className="border-ink-100 rounded-3xl border bg-white p-6">
      <h2 className="text-ink-900 font-semibold">Live scoring settings</h2>
      <p className="text-ink-500 mt-0.5 text-sm">
        What scorekeepers track at the table, and how game time runs.
      </p>
      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mt-3 rounded-xl border px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="border-court-200 bg-court-50 text-court-700 mt-3 rounded-xl border px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="mt-4 grid gap-5 md:grid-cols-3">
        <div>
          <p className="text-ink-700 text-sm font-medium">Stats tracked</p>
          <div className="mt-2 space-y-1.5">
            {DEPTHS.map((d) => (
              <label
                key={d.value}
                className={`block cursor-pointer rounded-xl border p-2.5 ${
                  statDepth === d.value
                    ? "border-play-400 bg-play-50"
                    : "border-ink-200 hover:bg-ink-50"
                }`}
              >
                <input
                  type="radio"
                  name="statDepth"
                  className="mr-2"
                  checked={statDepth === d.value}
                  onChange={() => setStatDepth(d.value)}
                />
                <span className="text-ink-900 text-sm font-medium">{d.label}</span>
                <span className="text-ink-500 block pl-5 text-xs">{d.hint}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-ink-700 text-sm font-medium">Game clock</p>
          <select
            value={gameClockMode}
            onChange={(e) => setGameClockMode(e.target.value)}
            className="border-ink-200 mt-2 w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="SIMPLE">Start/stop clock on the console</option>
            <option value="OFF">No clock — periods only</option>
          </select>
          <p className="text-ink-500 mt-1 text-xs">
            With the clock on, minutes played per player are tracked automatically.
          </p>
        </div>

        <div>
          <p className="text-ink-700 text-sm font-medium">Periods</p>
          <div className="mt-2 flex items-center gap-2">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="border-ink-200 flex-1 rounded-xl border px-3 py-2 text-sm"
            >
              <option value="QUARTERS">4 quarters</option>
              <option value="HALVES">2 halves</option>
            </select>
            <input
              type="number"
              min={1}
              max={30}
              value={periodMinutes}
              onChange={(e) => setPeriodMinutes(Number(e.target.value || 10))}
              className="border-ink-200 w-20 rounded-xl border px-3 py-2 text-sm"
            />
            <span className="text-ink-500 text-xs">min</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-ink-900 hover:bg-ink-800 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save scoring settings"}
        </button>
      </div>
    </div>
  )
}
