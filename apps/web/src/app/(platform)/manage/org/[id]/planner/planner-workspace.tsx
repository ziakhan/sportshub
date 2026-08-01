"use client"

import { useState } from "react"
import { Button } from "@/components/ui"

interface SeasonOpt {
  id: string
  label: string
  status: string
}
interface CourtOpt {
  courtId: string
  court: string
  venue: string
}

/**
 * The planner's interactive half (owner 2026-08-01): pick seasons, pull
 * levers, Run — sequential cross-league simulation with a fit verdict,
 * utilization table and recommendations. Nothing persists.
 */
export function PlannerWorkspace({
  orgId,
  seasons,
  courts,
}: {
  orgId: string
  seasons: SeasonOpt[]
  courts: CourtOpt[]
}) {
  const [selected, setSelected] = useState<string[]>(seasons.map((s) => s.id).slice(0, 8))
  const [held, setHeld] = useState<string[]>([])
  const [endTime, setEndTime] = useState("")
  const [startTime, setStartTime] = useState("")
  const [compact, setCompact] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}/planner/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonIds: selected,
          levers: {
            holdCourtIds: held.length > 0 ? held : undefined,
            dayWindow:
              startTime || endTime
                ? { startTime: startTime || undefined, endTime: endTime || undefined }
                : undefined,
            compactDays: compact || undefined,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || "Run failed")
      else setResult(data)
    } finally {
      setRunning(false)
    }
  }

  const panel = "border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"

  return (
    <div className="mt-6 space-y-5">
      <section className={panel}>
        <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">Seasons in the pool</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(selected, setSelected, s.id)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selected.includes(s.id)
                  ? "border-play-500 bg-play-50 text-play-700"
                  : "border-ink-200 text-ink-500 hover:border-ink-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-ink-400 mt-2 text-xs">
          Runs happen in the order shown — earlier seasons book their courts first, later ones
          schedule around them.
        </p>
      </section>

      <section className={panel}>
        <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">Levers</h2>
        <div className="mt-2">
          <p className="text-ink-600 text-xs font-medium">Hold courts free (never book):</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {courts.map((c) => (
              <button
                key={c.courtId}
                onClick={() => toggle(held, setHeld, c.courtId)}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  held.includes(c.courtId)
                    ? "border-gold-500 bg-gold-50 text-gold-800"
                    : "border-ink-200 text-ink-500 hover:border-ink-300"
                }`}
              >
                {c.venue} · {c.court}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-ink-600 flex items-center gap-1.5 text-xs">
            Day starts
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="border-ink-200 rounded-lg border px-2 py-1 text-xs"
            />
          </label>
          <label className="text-ink-600 flex items-center gap-1.5 text-xs">
            Day ends
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="border-ink-200 rounded-lg border px-2 py-1 text-xs"
            />
          </label>
          <label className="text-ink-600 flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
              className="accent-play-600"
            />
            Compact days (finish early)
          </label>
          <Button size="sm" tone="play" onClick={run} disabled={running || selected.length === 0}>
            {running ? "Running the whole org…" : "Run the plan"}
          </Button>
        </div>
        {error && <p className="text-hoop-700 mt-2 text-xs">{error}</p>}
      </section>

      {result && (
        <>
          <section className={panel}>
            <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">Verdict</h2>
            <p
              className={`mt-2 text-sm font-semibold ${result.allFit ? "text-court-700" : "text-hoop-700"}`}
            >
              {result.allFit
                ? "Everything fits — every league schedules fully with these levers."
                : "Not everything fits with these levers."}
            </p>
            <div className="mt-3 space-y-2">
              {result.seasons.map((s: any) => (
                <div key={s.seasonId} className="border-ink-100 rounded-xl border px-3 py-2">
                  <p className="text-ink-800 text-sm font-medium">
                    {s.label}{" "}
                    {s.ok ? (
                      <span className={s.unscheduled === 0 ? "text-court-700" : "text-hoop-700"}>
                        · {s.games} games{s.unscheduled > 0 ? ` · ${s.unscheduled} UNPLACED` : ""}
                      </span>
                    ) : (
                      <span className="text-hoop-700">· couldn&apos;t run: {s.errors?.join("; ")}</span>
                    )}
                  </p>
                  {s.ok && (
                    <p className="text-ink-500 mt-0.5 text-xs">
                      {s.backToBacks} back-to-backs · {s.preferenceViolations} preference misses ·{" "}
                      {s.requestViolations} request misses
                      {s.tradeoffs.length > 0 ? ` · ${s.tradeoffs[0]}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className={panel}>
            <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">
              Court utilization
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-ink-400 uppercase">
                    <th className="py-1 pr-3">Venue</th>
                    <th className="py-1 pr-3">Court</th>
                    <th className="py-1 pr-3">Games / capacity</th>
                    <th className="py-1">Used</th>
                  </tr>
                </thead>
                <tbody>
                  {result.utilization.map((u: any) => (
                    <tr key={u.courtId} className="border-ink-50 border-t">
                      <td className="text-ink-700 py-1.5 pr-3">{u.venue}</td>
                      <td className="text-ink-700 py-1.5 pr-3">{u.court}</td>
                      <td className="text-ink-700 py-1.5 pr-3">
                        {u.used}/{u.capacity}
                      </td>
                      <td className="py-1.5">
                        <span className="bg-ink-100 relative inline-block h-2 w-28 overflow-hidden rounded-full align-middle">
                          <span
                            className={`absolute inset-y-0 left-0 rounded-full ${
                              u.pct === 0 ? "bg-ink-200" : u.pct < 40 ? "bg-play-400" : "bg-court-500"
                            }`}
                            style={{ width: `${Math.min(100, u.pct)}%` }}
                          />
                        </span>
                        <span className="text-ink-600 ml-2">{u.pct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {result.recommendations.length > 0 && (
            <section className={panel}>
              <h2 className="text-ink-900 text-sm font-bold uppercase tracking-wide">
                Recommendations
              </h2>
              <ul className="mt-2 space-y-1">
                {result.recommendations.map((r: string) => (
                  <li key={r} className="text-ink-700 text-sm">
                    · {r}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
