"use client"

import { useState } from "react"
import { format } from "date-fns"
import { panelClass } from "./types"

export function ScheduleTab({
  seasonId,
  league,
  scheduleGames,
  refresh,
}: {
  seasonId: string
  league: any
  scheduleGames: any[]
  refresh: () => void
}) {
  const [preview, setPreview] = useState<{
    games: any[]
    unscheduled: any[]
    warnings: string[]
    utilization: any
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  const [suggestionsFor, setSuggestionsFor] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const runPreview = async () => {
    setPreviewLoading(true)
    setScheduleError(null)
    const res = await fetch(`/api/seasons/${seasonId}/schedule/preview`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(
        Array.isArray(err?.errors) ? err.errors.join("; ") : err?.error || "Preview failed"
      )
      setPreview(null)
    } else {
      setPreview(await res.json())
    }
    setPreviewLoading(false)
  }

  const commitSchedule = async () => {
    if (!confirm("Commit this schedule? Existing SCHEDULED games will be replaced.")) return
    setCommitting(true)
    setScheduleError(null)
    const res = await fetch(`/api/seasons/${seasonId}/schedule/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replaceExisting: true }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(
        Array.isArray(err?.errors) ? err.errors.join("; ") : err?.error || "Commit failed"
      )
    } else {
      setPreview(null)
    }
    setCommitting(false)
    refresh()
  }

  const wipeSchedule = async () => {
    if (!confirm("Delete all scheduled games? (games that have moved past SCHEDULED are kept)"))
      return
    const res = await fetch(`/api/seasons/${seasonId}/schedule`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error || "Delete failed")
    }
    refresh()
  }

  const patchGame = async (gameId: string, body: Record<string, any>) => {
    setScheduleError(null)
    const res = await fetch(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(
        Array.isArray(err?.conflicts)
          ? err.conflicts.join("; ")
          : err?.error || "Update failed"
      )
    }
    refresh()
  }

  const cancelGame = async (gameId: string) => {
    if (!confirm("Cancel this game? It will be excluded from standings.")) return
    setScheduleError(null)
    const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error || "Cancel failed")
    }
    refresh()
  }

  const loadSuggestions = async (gameId: string) => {
    setSuggestionsFor(gameId)
    setSuggestionsLoading(true)
    setSuggestions([])
    const res = await fetch(`/api/games/${gameId}/reschedule-suggestions`, {
      method: "POST",
    })
    if (res.ok) {
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } else {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error || "Could not load suggestions")
    }
    setSuggestionsLoading(false)
  }

  const applySuggestion = async (gameId: string, s: any) => {
    await patchGame(gameId, {
      scheduledAt: s.startAt,
      courtId: s.courtId,
      venueId: s.venueId,
      dayId: s.dayId,
      dayVenueId: s.dayVenueId,
      sessionId: s.sessionId,
    })
    setSuggestionsFor(null)
    setSuggestions([])
    setOpenGameId(null)
  }

  return (
    <div className="space-y-6">
      <div className={panelClass}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-ink-900 font-semibold">Schedule</h3>
            <p className="text-ink-500 mt-0.5 text-xs">
              Preview the scheduler&apos;s proposal, then commit to persist games. Season must
              be finalized before you can commit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runPreview}
              disabled={previewLoading}
              className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              {previewLoading ? "Running…" : "Preview schedule"}
            </button>
            <button
              onClick={commitSchedule}
              disabled={
                committing ||
                !["FINALIZED", "IN_PROGRESS"].includes(league.leagueStatus)
              }
              title={
                !["FINALIZED", "IN_PROGRESS"].includes(league.leagueStatus)
                  ? "Finalize the season before committing"
                  : ""
              }
              className="bg-court-600 hover:bg-court-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              {committing ? "Committing…" : "Commit schedule"}
            </button>
            {scheduleGames.length > 0 && (
              <button
                onClick={wipeSchedule}
                className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
              >
                Delete all
              </button>
            )}
          </div>
        </div>

        {scheduleError && (
          <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-3 rounded-xl border px-3 py-2 text-xs">
            {scheduleError}
          </div>
        )}

        {preview && (
          <div className="mb-6 rounded-2xl border border-play-200 bg-play-50 p-4">
            <p className="text-play-800 mb-2 text-sm font-semibold">
              Preview: {preview.games.length} game{preview.games.length === 1 ? "" : "s"}
              {preview.unscheduled.length > 0
                ? ` · ${preview.unscheduled.length} unscheduled`
                : ""}
            </p>
            {preview.warnings.length > 0 && (
              <ul className="mb-3 space-y-0.5">
                {preview.warnings.map((w, i) => (
                  <li key={i} className="text-amber-700 text-xs">
                    • {w}
                  </li>
                ))}
              </ul>
            )}
            {preview.utilization && (
              <p className="text-ink-500 mb-3 text-xs">
                Slots used: {preview.utilization.slotsUsed ?? "—"} /{" "}
                {preview.utilization.slotsAvailable ?? "—"}
              </p>
            )}
            <div className="max-h-80 overflow-y-auto rounded-xl bg-white">
              <table className="text-ink-700 w-full text-xs">
                <thead className="bg-ink-50 text-ink-500 sticky top-0 text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-1.5 text-left">When</th>
                    <th className="px-3 py-1.5 text-left">Home</th>
                    <th className="px-3 py-1.5 text-left">Away</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.games.map((g: any, i: number) => (
                    <tr key={i} className="border-ink-100 border-t">
                      <td className="px-3 py-1.5">
                        {format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
                      </td>
                      <td className="px-3 py-1.5">{g.homeTeamName}</td>
                      <td className="px-3 py-1.5">{g.awayTeamName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.unscheduled.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="text-amber-700 cursor-pointer font-medium">
                  {preview.unscheduled.length} pairing(s) couldn&apos;t be placed
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {preview.unscheduled.map((u: any, i: number) => (
                    <li key={i} className="text-ink-600">
                      • {u.homeTeamName} vs {u.awayTeamName}
                      {u.reason ? ` — ${u.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div>
          <p className="text-ink-600 mb-2 text-sm font-semibold">
            Committed games ({scheduleGames.length})
          </p>
          {scheduleGames.length === 0 ? (
            <p className="text-ink-500 text-sm">
              No games committed yet. Preview then commit once the season is finalized.
            </p>
          ) : (
            <div className="space-y-2">
              {scheduleGames.map((g: any) => {
                const open = openGameId === g.id
                const statusStyle =
                  g.status === "CANCELLED"
                    ? "text-hoop-600"
                    : g.status === "COMPLETED"
                      ? "text-court-700"
                      : g.status === "DEFAULTED"
                        ? "text-amber-700"
                        : "text-ink-600"
                return (
                  <div
                    key={g.id}
                    className="border-ink-100 rounded-xl border bg-white"
                  >
                    <button
                      onClick={() => setOpenGameId(open ? null : g.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
                    >
                      <div className="flex flex-1 flex-wrap items-center gap-3">
                        <span className="text-ink-700 whitespace-nowrap">
                          {format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
                        </span>
                        <span className="text-ink-900 font-medium">
                          {g.homeTeam?.name ?? g.homeTeamId}{" "}
                          <span className="text-ink-400">vs</span>{" "}
                          {g.awayTeam?.name ?? g.awayTeamId}
                        </span>
                        <span className="text-ink-500">
                          {g.venue?.name ?? "—"}
                          {g.court?.name ? ` · ${g.court.name}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {g.isLocked && (
                          <span className="text-ink-500 text-[10px]">🔒</span>
                        )}
                        <span className={`text-[10px] font-semibold ${statusStyle}`}>
                          {g.status}
                        </span>
                        <span className="text-ink-400 text-[10px]">
                          {open ? "▴" : "▾"}
                        </span>
                      </div>
                    </button>

                    {open && (
                      <div className="border-ink-100 border-t px-3 py-3 text-xs">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => patchGame(g.id, { isLocked: !g.isLocked })}
                            className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                          >
                            {g.isLocked ? "Unlock" : "Lock"}
                          </button>
                          <button
                            onClick={() => {
                              if (suggestionsFor === g.id) {
                                setSuggestionsFor(null)
                                setSuggestions([])
                              } else {
                                loadSuggestions(g.id)
                              }
                            }}
                            className="border-play-300 text-play-700 hover:bg-play-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                          >
                            {suggestionsFor === g.id ? "Hide alternates" : "Find alternates"}
                          </button>
                          <button
                            onClick={() =>
                              patchGame(g.id, { status: "DEFAULTED", defaultedBy: g.homeTeamId })
                            }
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                          >
                            Home defaults
                          </button>
                          <button
                            onClick={() =>
                              patchGame(g.id, { status: "DEFAULTED", defaultedBy: g.awayTeamId })
                            }
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                          >
                            Away defaults
                          </button>
                          <button
                            onClick={() => cancelGame(g.id)}
                            disabled={g.status === "CANCELLED" || g.status === "COMPLETED"}
                            className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                          >
                            Cancel game
                          </button>
                        </div>

                        {suggestionsFor === g.id && (
                          <div className="bg-ink-50 rounded-xl p-2">
                            <p className="text-ink-700 mb-2 text-[11px] font-semibold">
                              Suggested alternate slots
                            </p>
                            {suggestionsLoading ? (
                              <p className="text-ink-500 text-[11px]">Searching…</p>
                            ) : suggestions.length === 0 ? (
                              <p className="text-ink-500 text-[11px]">
                                No viable alternate slots found.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {suggestions.map((s, i) => (
                                  <li
                                    key={i}
                                    className="border-ink-100 flex items-center justify-between gap-2 rounded-lg border bg-white px-2 py-1"
                                  >
                                    <div>
                                      <span className="text-ink-900 font-medium">
                                        {format(new Date(s.startAt), "EEE MMM d · h:mm a")}
                                      </span>
                                      {s.sameDay && (
                                        <span className="bg-play-100 text-play-700 ml-2 rounded-full px-1.5 py-0.5 text-[9px]">
                                          same day
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => applySuggestion(g.id, s)}
                                      className="bg-play-600 hover:bg-play-700 rounded-lg px-2 py-1 text-[10px] font-semibold text-white"
                                    >
                                      Move here
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
