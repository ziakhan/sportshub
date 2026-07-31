"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Badge, Button, PanelHeader, toneForStatus, DateTimePicker } from "@/components/ui"
import { inputClass, panelClass } from "./types"
import { TeamCheck } from "./team-check"

interface CapacityUnit {
  unitKey: string
  label: string
  teams: number
  gamesNeeded: number
}

interface CapacitySession {
  sessionId: string
  label: string | null
  days: number
  courts: number
  slotsTotal: number
  blockedByOthers?: number
  gamesPerTeam: number
  units: CapacityUnit[]
  gamesNeededAll: number
  surplusSlots: number
  maxTeamsSupportable: number
}

/**
 * Generate & review (owner 2026-07-30 tune-up): the FIRST question is the
 * mode — schedule session by session (what most leagues do) or the whole
 * season at once. Session mode scopes preview/commit to one session;
 * committed games elsewhere are never touched and seed matchup rotation.
 */
export function ScheduleTab({
  seasonId,
  league,
  sessions,
  scheduleGames,
  refresh,
}: {
  seasonId: string
  league: any
  sessions: any[]
  scheduleGames: any[]
  refresh: () => void
}) {
  const regularSessions = useMemo(
    () => sessions.filter((s: any) => (s.phase ?? "REGULAR") === "REGULAR"),
    [sessions]
  )
  const committedBySession = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of scheduleGames) {
      if (g.sessionId) map.set(g.sessionId, (map.get(g.sessionId) ?? 0) + 1)
    }
    return map
  }, [scheduleGames])

  const [mode, setMode] = useState<"session" | "season">("session")
  // Default to the first session that has nothing committed yet.
  const [selectedSessionId, setSelectedSessionId] = useState<string>("")
  useEffect(() => {
    if (selectedSessionId && regularSessions.some((s: any) => s.id === selectedSessionId)) return
    const firstEmpty = regularSessions.find((s: any) => !committedBySession.get(s.id))
    setSelectedSessionId(firstEmpty?.id ?? regularSessions[0]?.id ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regularSessions, committedBySession])

  const [preview, setPreview] = useState<{
    games: any[]
    unscheduled: any[]
    warnings: string[]
    utilization: any
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  // Variation number (owner 2026-07-31): 0 = the season's standard plan;
  // Shuffle rolls deterministic variations. Commit sends the SAME number,
  // so what you previewed is exactly what gets saved.
  const [shuffle, setShuffle] = useState(0)
  const [committing, setCommitting] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [capacity, setCapacity] = useState<CapacitySession[] | null>(null)
  // sessionId → unit keys the owner UNCHECKED (default: everything included)
  const [excluded, setExcluded] = useState<Record<string, Set<string>>>({})
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  const [suggestionsFor, setSuggestionsFor] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  // Recompute whenever the sessions substrate changes AT ALL (owner
  // 2026-07-31: editing a session's courts/hours must refresh capacity —
  // depending on .length missed every edit that didn't add/remove one).
  useEffect(() => {
    fetch(`/api/seasons/${seasonId}/schedule/capacity`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCapacity(data?.sessions ?? null))
      .catch(() => setCapacity(null))
  }, [seasonId, sessions])

  // Scope: session mode targets exactly the selected session.
  const scopeSessionIds = mode === "session" && selectedSessionId ? [selectedSessionId] : undefined

  // sessionId → included unit keys, only for sessions where something is
  // excluded (untouched sessions host everything).
  const sessionUnits = useMemo(() => {
    if (!capacity) return undefined
    const map: Record<string, string[]> = {}
    for (const s of capacity) {
      const ex = excluded[s.sessionId]
      if (ex && ex.size > 0) {
        map[s.sessionId] = s.units.map((u) => u.unitKey).filter((k) => !ex.has(k))
      }
    }
    return Object.keys(map).length > 0 ? map : undefined
  }, [capacity, excluded])

  const toggleUnit = (sessionId: string, unitKey: string) => {
    setExcluded((prev) => {
      const next = { ...prev }
      const set = new Set(next[sessionId] ?? [])
      if (set.has(unitKey)) set.delete(unitKey)
      else set.add(unitKey)
      next[sessionId] = set
      return next
    })
    setPreview(null) // stale against the new plan
  }

  const runPreview = async (shuffleOverride?: number) => {
    const attempt = shuffleOverride ?? shuffle
    if (shuffleOverride !== undefined) setShuffle(shuffleOverride)
    setPreviewLoading(true)
    setScheduleError(null)
    const res = await fetch(`/api/seasons/${seasonId}/schedule/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionUnits,
        sessionIds: scopeSessionIds,
        varietyShuffle: attempt || undefined,
      }),
    })
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

  const selectedSession = regularSessions.find((s: any) => s.id === selectedSessionId)
  const commitSchedule = async () => {
    const what =
      (mode === "session"
        ? `Save the schedule for "${selectedSession?.label || "this session"}"? Its existing un-played games are replaced; other sessions are untouched.`
        : "Save the whole season's schedule? ALL existing un-played games are replaced.") +
      "\n\nSaved as a DRAFT — clubs and families see nothing until you publish."
    if (!confirm(what)) return
    setCommitting(true)
    setScheduleError(null)
    const res = await fetch(`/api/seasons/${seasonId}/schedule/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replaceExisting: true,
        sessionUnits,
        sessionIds: scopeSessionIds,
        varietyShuffle: shuffle || undefined,
      }),
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

  const canCommit = ["FINALIZED", "IN_PROGRESS"].includes(league.leagueStatus)
  const draftCount = useMemo(
    () => scheduleGames.filter((g: any) => !g.publishedAt).length,
    [scheduleGames]
  )
  const [publishing, setPublishing] = useState(false)
  const publishSchedule = async () => {
    if (
      !confirm(
        `Publish the schedule? ${draftCount} draft game${draftCount === 1 ? "" : "s"} go live — clubs and families get ONE notification pointing at their team calendar.`
      )
    )
      return
    setPublishing(true)
    setScheduleError(null)
    const res = await fetch(`/api/seasons/${seasonId}/schedule/publish`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error || "Publish failed")
    }
    setPublishing(false)
    refresh()
  }

  // Preview mode feeds Team check the WOULD-BE schedule (owner 2026-07-31:
  // "you should be able to see the games of the teams in preview mode"):
  // games a commit would keep + the previewed proposals.
  const teamCheckGames = useMemo(() => {
    if (!preview) return scheduleGames
    const survivors = scheduleGames.filter((g: any) =>
      mode === "session" && selectedSessionId
        ? !(g.sessionId === selectedSessionId && g.status === "SCHEDULED")
        : g.status !== "SCHEDULED"
    )
    const proposed = preview.games.map((g: any, i: number) => ({
      ...g,
      id: `preview-${i}`,
      status: "PREVIEW",
      homeTeam: { name: g.homeTeamName },
      awayTeam: { name: g.awayTeamName },
    }))
    return [...survivors, ...proposed]
  }, [preview, scheduleGames, mode, selectedSessionId])
  const visibleCapacity =
    mode === "session" && capacity
      ? capacity.filter((s) => s.sessionId === selectedSessionId)
      : capacity
  // Session mode shows ONLY the selected session's games (owner 2026-07-31:
  // "after you create the schedule for a week, you should only see that week")
  const visibleGames =
    mode === "session" && selectedSessionId
      ? scheduleGames.filter((g: any) => g.sessionId === selectedSessionId)
      : scheduleGames

  return (
    <div className="space-y-6">
      <div className={`reveal ${panelClass}`}>
        <PanelHeader title="Generate the schedule" />

        {/* THE first question: how do you want to schedule? */}
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => { setMode("session"); setPreview(null) }}
            aria-pressed={mode === "session"}
            className={`rounded-xl border p-3 text-left transition-colors ${
              mode === "session" ? "border-play-500 bg-play-50" : "border-ink-200 hover:border-ink-300"
            }`}
          >
            <p className="text-ink-900 text-sm font-semibold">
              Session by session
              <Badge className="ml-2" tone="play">
                Most leagues
              </Badge>
            </p>
            <p className="text-ink-500 mt-0.5 text-xs">
              Schedule one game weekend at a time, as registrations settle. Other sessions are
              never touched.
            </p>
          </button>
          <button
            type="button"
            onClick={() => { setMode("season"); setPreview(null) }}
            aria-pressed={mode === "season"}
            className={`rounded-xl border p-3 text-left transition-colors ${
              mode === "season" ? "border-play-500 bg-play-50" : "border-ink-200 hover:border-ink-300"
            }`}
          >
            <p className="text-ink-900 text-sm font-semibold">Whole season at once</p>
            <p className="text-ink-500 mt-0.5 text-xs">
              Fill every session in one pass. Replaces ALL games that haven&apos;t been played
              yet.
            </p>
          </button>
        </div>

        {/* Session picker (session mode) */}
        {mode === "session" && (
          <div className="mb-4">
            <p className="text-ink-700 mb-1.5 text-xs font-semibold">Which session?</p>
            <div className="flex flex-wrap gap-1.5">
              {regularSessions.map((s: any) => {
                const committed = committedBySession.get(s.id) ?? 0
                const selected = selectedSessionId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSessionId(s.id); setPreview(null) }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? "border-play-500 bg-play-600 text-white"
                        : committed > 0
                          ? "border-court-200 bg-court-50 text-court-700 hover:border-court-300"
                          : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                    }`}
                  >
                    {s.label || "Session"}
                    {committed > 0 ? ` · ${committed} ✓` : " · empty"}
                  </button>
                )
              })}
            </div>
            {regularSessions.length === 0 && (
              <p className="text-ink-500 text-sm">No regular-season sessions yet — add one above.</p>
            )}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => runPreview()}
            disabled={previewLoading || (mode === "session" && !selectedSessionId)}
          >
            {previewLoading
              ? "Running…"
              : mode === "session"
                ? `Preview ${selectedSession?.label || "session"}`
                : "Preview whole season"}
          </Button>
          <span title="Roll a different matchup/time variation — previewing and committing keep the exact variation shown">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => runPreview(shuffle + 1)}
              disabled={previewLoading || (mode === "session" && !selectedSessionId)}
            >
              Shuffle
            </Button>
          </span>
          {shuffle > 0 && (
            <span className="bg-play-100 text-play-700 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
              Variation #{shuffle}
              <button
                onClick={() => runPreview(0)}
                className="hover:text-play-900 underline decoration-dotted"
                title="Back to the season's standard plan"
              >
                reset
              </button>
            </span>
          )}
          <span title={!canCommit ? "Finalize the season before committing" : ""}>
            <Button
              size="sm"
              tone="court"
              onClick={commitSchedule}
              disabled={committing || !canCommit || (mode === "session" && !selectedSessionId)}
            >
              {committing
                ? "Committing…"
                : mode === "session"
                  ? "Commit this session"
                  : "Commit whole season"}
            </Button>
          </span>
          {scheduleGames.length > 0 && (
            <Button size="sm" variant="secondary" tone="hoop" onClick={wipeSchedule}>
              Delete all
            </Button>
          )}
        </div>

        {draftCount > 0 && (
          <div className="border-gold-200 bg-gold-50 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
            <p className="text-gold-700 text-xs font-semibold">
              {draftCount} draft game{draftCount === 1 ? "" : "s"} — visible only to you until
              you publish. Review below, re-run sessions freely, then publish once.
            </p>
            <Button size="sm" onClick={publishSchedule} disabled={publishing}>
              {publishing ? "Publishing…" : `Publish schedule · ${draftCount} new`}
            </Button>
          </div>
        )}

        {scheduleError && (
          <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-3 rounded-xl border px-3 py-2 text-xs">
            {scheduleError}
          </div>
        )}

        {visibleCapacity && visibleCapacity.length > 0 && (
          <div className="mb-6 space-y-3">
            <div>
              <PanelHeader title={mode === "session" ? "This session's capacity" : "Capacity planner"} />
              <p className="text-ink-500 -mt-2 text-xs">
                Slots this session can hold vs the games your divisions need. Untick a division
                to leave it out — preview and commit follow this plan.
              </p>
            </div>
            {visibleCapacity.map((s) => {
              const ex = excluded[s.sessionId] ?? new Set<string>()
              const includedDemand = s.units
                .filter((u) => !ex.has(u.unitKey))
                .reduce((sum, u) => sum + u.gamesNeeded, 0)
              const spare = s.slotsTotal - includedDemand
              const tone =
                spare < 0
                  ? "border-hoop-200 bg-hoop-50"
                  : spare <= Math.ceil(s.slotsTotal * 0.1)
                    ? "border-amber-200 bg-amber-50"
                    : "border-court-200 bg-court-50"
              return (
                <div key={s.sessionId} className={`rounded-xl border p-3 ${tone}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-ink-900 text-xs font-semibold">
                      {s.label || "Session"} · {s.days} day{s.days === 1 ? "" : "s"} · {s.courts}{" "}
                      court{s.courts === 1 ? "" : "s"} · {s.gamesPerTeam} game
                      {s.gamesPerTeam === 1 ? "" : "s"}/team
                    </p>
                    <p className="text-ink-700 text-xs font-semibold">
                      {includedDemand} of {s.slotsTotal} slots needed ·{" "}
                      {spare >= 0 ? (
                        <span className="text-court-700">{spare} spare</span>
                      ) : (
                        <span className="text-hoop-700">{-spare} short</span>
                      )}
                      {(s.blockedByOthers ?? 0) > 0 && (
                        <span className="text-amber-700">
                          {" "}· {s.blockedByOthers} taken by other leagues
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.units.map((u) => {
                      const off = ex.has(u.unitKey)
                      return (
                        <label
                          key={u.unitKey}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${
                            off
                              ? "border-ink-200 bg-white text-ink-400 line-through"
                              : "border-ink-200 bg-white text-ink-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!off}
                            onChange={() => toggleUnit(s.sessionId, u.unitKey)}
                          />
                          {u.label} · {u.teams} teams · {u.gamesNeeded} games
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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
                    <tr key={i} className="border-ink-100 hover:bg-ink-50/60 border-t transition-colors">
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

        {/* Per-team verification — checkmarks first, grid second. While a
            preview is open it shows the WOULD-BE schedule. */}
        <div className="mb-4">
          <TeamCheck
            league={league}
            scheduleGames={teamCheckGames}
            sessionFilterId={mode === "session" ? selectedSessionId : null}
            sessionLabel={mode === "session" ? selectedSession?.label ?? null : null}
            previewing={!!preview}
          />
        </div>

        <ManualGameAdd seasonId={seasonId} league={league} refresh={refresh} />

        <div>
          <PanelHeader
            title={
              mode === "session" && selectedSession
                ? `Games in ${selectedSession.label || "this session"}`
                : "Committed games"
            }
            action={
              <span className="bg-ink-100 text-ink-600 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {visibleGames.length}
                {mode === "session" && visibleGames.length !== scheduleGames.length
                  ? ` of ${scheduleGames.length}`
                  : ""}
              </span>
            }
          />
          {mode === "session" && selectedSession && scheduleGames.length > visibleGames.length && (
            <p className="text-ink-400 -mt-1 mb-2 text-xs">
              Showing only {selectedSession.label || "this session"} — switch to &quot;Whole
              season&quot; above to see everything.
            </p>
          )}
          {visibleGames.length === 0 ? (
            <p className="text-ink-500 text-sm">
              {scheduleGames.length === 0
                ? "No games committed yet. Preview then commit once the season is finalized."
                : "No games in this session yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {visibleGames.map((g: any, i: number) => {
                const open = openGameId === g.id
                return (
                  <div
                    key={g.id}
                    style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
                    className="reveal border-ink-100 hover:border-ink-300 rounded-xl border bg-white transition-colors"
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
                        {!g.publishedAt && <Badge tone="gold">Draft</Badge>}
                        <Badge tone={toneForStatus(g.status)}>{g.status}</Badge>
                        <span className="text-ink-400 text-[10px]">
                          {open ? "▴" : "▾"}
                        </span>
                      </div>
                    </button>

                    {open && (
                      <div className="border-ink-100 border-t px-3 py-3 text-xs">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <a
                            href={`/live/${g.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                          >
                            Box score ↗
                          </a>
                          {g.status === "COMPLETED" && (
                            <a
                              href={`/games/${g.id}/score`}
                              className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                              title="Reopen the console to correct the finalized result"
                            >
                              Correct result
                            </a>
                          )}
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
                            onClick={() => {
                              if (window.confirm("Record a FORFEIT by the home team? The away team is awarded the win in standings.")) {
                                patchGame(g.id, { status: "DEFAULTED", defaultedBy: g.homeTeamId })
                              }
                            }}
                            title="Home team forfeits — away team is awarded the game"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                          >
                            Forfeit: home
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Record a FORFEIT by the away team? The home team is awarded the win in standings.")) {
                                patchGame(g.id, { status: "DEFAULTED", defaultedBy: g.awayTeamId })
                              }
                            }}
                            title="Away team forfeits — home team is awarded the game"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                          >
                            Forfeit: away
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
                                    <Button size="sm" onClick={() => applySuggestion(g.id, s)}>
                                      Move here
                                    </Button>
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

/** Escape hatch: add ONE game outside the scheduler (make-ups, fixes). */
function ManualGameAdd({
  seasonId,
  league,
  refresh,
}: {
  seasonId: string
  league: any
  refresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [homeTeamId, setHomeTeamId] = useState("")
  const [awayTeamId, setAwayTeamId] = useState("")
  const [when, setWhen] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const approvedTeams = (league.teams || []).filter((t: any) => t.status === "APPROVED")

  const create = async () => {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeamId,
          awayTeamId,
          scheduledAt: new Date(when).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't add the game")
      setNote("Game added.")
      setHomeTeamId("")
      setAwayTeamId("")
      setWhen("")
      setOpen(false)
      refresh()
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't add the game")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-ink-100 mb-4 rounded-xl border p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-play-700 text-xs font-semibold hover:underline"
      >
        {open ? "Hide manual game" : "+ Add a game manually (make-up / fix)"}
      </button>
      {note && <p className="text-ink-600 mt-1 text-xs">{note}</p>}
      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select
            value={homeTeamId}
            onChange={(e) => setHomeTeamId(e.target.value)}
            className={inputClass}
          >
            <option value="">Home team…</option>
            {approvedTeams.map((t: any) => (
              <option key={t.team.id} value={t.team.id}>
                {t.team.name}
              </option>
            ))}
          </select>
          <select
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.target.value)}
            className={inputClass}
          >
            <option value="">Away team…</option>
            {approvedTeams
              .filter((t: any) => t.team.id !== homeTeamId)
              .map((t: any) => (
                <option key={t.team.id} value={t.team.id}>
                  {t.team.name}
                </option>
              ))}
          </select>
          <DateTimePicker mode="datetime" value={when} onChange={setWhen} className="w-40" />
          <Button size="sm" onClick={create} disabled={busy || !homeTeamId || !awayTeamId || !when}>
            {busy ? "Adding…" : "Add game"}
          </Button>
        </div>
      )}
    </div>
  )
}
