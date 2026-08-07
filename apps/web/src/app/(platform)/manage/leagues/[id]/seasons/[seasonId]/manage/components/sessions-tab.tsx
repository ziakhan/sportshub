"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Button, PanelHeader, DateTimePicker, Badge } from "@/components/ui"
import { inputClass, panelClass, LOCKED_STATUSES, monthAnchorLabel } from "./types"

interface DayDraft {
  date: string
  startTime: string
  endTime: string
}
interface VenueSelection {
  venueId: string
  courtIds: string[] // in PREFERRED order — first court fills first
}
interface SessionInitial {
  label: string
  days: DayDraft[]
  venues: VenueSelection[]
  targetGamesPerTeam: number | null
}

/**
 * Sessions (owner 2026-07-30 tune-up): fully editable, and every session
 * picks its own venues and courts — in the order games should fill them —
 * instead of silently absorbing every court the season has.
 */
export function SessionsTab({
  seasonId,
  sessions,
  venues,
  seasonStatus,
  rounds,
  refresh,
}: {
  seasonId: string
  sessions: any[]
  /** Season venues from the page's shared fetch — one source with VenuesTab
   *  (a private fetch here could fail once on a cold compile and leave the
   *  form venue-less forever). */
  venues: any[]
  seasonStatus?: string
  /** This season's rounds (owner 2026-08-07, Stage 1), optional structure —
   *  omitted or empty renders exactly as before rounds existed. */
  rounds?: any[]
  refresh: () => void
}) {
  const locked = LOCKED_STATUSES.includes(seasonStatus ?? "")
  const seasonVenues = venues
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const save = async (sessionId: string | null, payload: any) => {
    const res = await fetch(
      sessionId
        ? `/api/seasons/${seasonId}/sessions?sessionId=${sessionId}`
        : `/api/seasons/${seasonId}/sessions`,
      {
        method: sessionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't save the session.")
      return false
    }
    setEditingId(null)
    setCreating(false)
    refresh()
    return true
  }

  return (
    <div className="grid gap-6">
      <div className={`reveal ${panelClass}`}>
        <PanelHeader
          title="Sessions (game days)"
          action={
            !locked && !creating ? (
              <Button size="sm" onClick={() => { setCreating(true); setEditingId(null) }}>
                + Add session
              </Button>
            ) : undefined
          }
        />
        {locked && (
          <div className="border-amber-200 bg-amber-50 text-amber-800 mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Season is {seasonStatus === "IN_PROGRESS" ? "in progress" : seasonStatus?.toLowerCase()} —
            sessions are locked while games are being played.
          </div>
        )}
        {sessions.map((s: any) =>
          editingId === s.id ? (
            <SessionForm
              key={s.id}
              seasonVenues={seasonVenues}
              initial={{
                label: s.label ?? "",
                days: (s.days ?? []).map((d: any) => ({
                  date: String(d.date).slice(0, 10),
                  startTime: d.startTime || "09:00",
                  endTime: d.endTime || "17:00",
                })),
                venues: (s.venueSelections ?? []).map((v: any) => ({
                  venueId: v.venueId,
                  courtIds: (v.courts ?? []).map((c: any) => c.id),
                })),
                targetGamesPerTeam: s.targetGamesPerTeam ?? null,
              }}
              onCancel={() => setEditingId(null)}
              onSave={(payload) => save(s.id, payload)}
            />
          ) : (
            <div
              key={s.id}
              className="border-court-100 bg-court-50 hover:border-court-200 mb-2 rounded-xl border px-3 py-2 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-900 font-medium">
                  {s.label || "Session"}
                  {s.targetGamesPerTeam != null && (
                    <span className="text-ink-400 ml-2 text-xs font-normal">
                      {s.targetGamesPerTeam} game{s.targetGamesPerTeam === 1 ? "" : "s"}/team
                    </span>
                  )}
                  {s.phase === "PLAYOFF" && (
                    <Badge className="ml-2" tone="gold">
                      Playoffs
                    </Badge>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {/* Which round this weekend materializes (owner 2026-08-07,
                      Stage 1) — optional, so it only shows once the league has
                      defined at least one round. */}
                  {rounds && rounds.length > 0 && (
                    <select
                      value={s.roundId ?? ""}
                      disabled={locked}
                      onChange={(e) => void save(s.id, { roundId: e.target.value || null })}
                      aria-label="Round"
                      title="Which round this weekend belongs to"
                      className={inputClass + " py-1 text-xs"}
                    >
                      <option value="">No round</option>
                      {rounds.map((r: any) => (
                        <option key={r.id} value={r.id}>
                          Session {r.ordinal}
                          {monthAnchorLabel(r.monthAnchor, true) ? ` · ${monthAnchorLabel(r.monthAnchor, true)}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {/* WHAT THIS WEEKEND IS FOR (owner's 2026-08-06 analysis,
                      C1). Playoff weekends are a SEASON setting, set here and
                      nowhere else: planning excludes their dates entirely —
                      no columns, no ghosts — and the scheduler never treats
                      them as supply. */}
                  {!locked && (
                    <button
                      data-testid="session-phase-toggle"
                      data-phase={s.phase ?? "REGULAR"}
                      title={
                        s.phase === "PLAYOFF"
                          ? "Put this weekend back in the regular season, so planning can use its dates again."
                          : "Playoff weekends come out of the standings later. Planning skips their dates entirely."
                      }
                      onClick={() =>
                        void save(s.id, {
                          phase: s.phase === "PLAYOFF" ? "REGULAR" : "PLAYOFF",
                        })
                      }
                      className="text-play-700 hover:text-play-800 text-xs font-semibold"
                    >
                      {s.phase === "PLAYOFF" ? "Back to regular season" : "Mark as playoffs"}
                    </button>
                  )}
                  {!locked && (
                    <button
                      onClick={() => { setEditingId(s.id); setCreating(false) }}
                      className="text-play-700 hover:text-play-800 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  )}
                  {!locked && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Remove session "${s.label || "Session"}"? Its game days and venue slots go with it. This cannot be undone.`)) return
                        const res = await fetch(
                          `/api/seasons/${seasonId}/sessions?sessionId=${s.id}`,
                          { method: "DELETE" }
                        )
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}))
                          window.alert(data.error || "Couldn't remove the session.")
                        }
                        refresh()
                      }}
                      className="hover:text-hoop-700 text-xs text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {s.days?.map((d: any) => (
                <div key={d.id} className="text-ink-500 ml-2 text-xs">
                  {format(new Date(d.date), "EEE, MMM d")} {d.startTime}-{d.endTime}
                </div>
              ))}
              <div className="text-ink-400 ml-2 mt-0.5 text-xs">
                {(s.venueSelections ?? []).length === 0
                  ? "No venue selected — session is unusable until one is picked"
                  : (s.venueSelections ?? [])
                      .map(
                        (v: any) =>
                          `${v.venueName}: ${
                            (v.courts ?? []).length === 0
                              ? "no courts"
                              : (v.courts ?? []).map((c: any) => c.name).join(" → ")
                          }`
                      )
                      .join(" · ")}
              </div>
            </div>
          )
        )}
        {creating && (
          <SessionForm
            // Remount if venues arrive after the form opened, so defaults land.
            key={`create-${seasonVenues.length}`}
            seasonVenues={seasonVenues}
            initial={null}
            // New sessions start with EVERY season venue and its default
            // courts already on (owner 2026-07-31) — trim, don't build up.
            defaultSelections={seasonVenues.map((sv: any) => ({
              venueId: sv.venue.id,
              courtIds: (sv.venue.courtList ?? [])
                .slice(0, sv.courtsAvailable ?? undefined)
                .map((c: any) => c.id),
            }))}
            onCancel={() => setCreating(false)}
            onSave={(payload) => save(null, payload)}
          />
        )}
        {sessions.length === 0 && !creating && (
          <p className="text-ink-500 text-sm">
            No sessions yet — a session is a game weekend or game night; the schedule fills them.
          </p>
        )}
      </div>
    </div>
  )
}

function SessionForm({
  seasonVenues,
  initial,
  defaultSelections,
  onSave,
  onCancel,
}: {
  seasonVenues: any[]
  initial: SessionInitial | null
  defaultSelections?: VenueSelection[]
  onSave: (payload: any) => Promise<boolean> | boolean
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? "")
  const [days, setDays] = useState<DayDraft[]>(
    initial?.days?.length ? initial.days : [{ date: "", startTime: "09:00", endTime: "17:00" }]
  )
  const [selections, setSelections] = useState<VenueSelection[]>(
    initial?.venues ?? defaultSelections ?? []
  )
  const [gamesPerTeam, setGamesPerTeam] = useState<string>(
    initial?.targetGamesPerTeam != null ? String(initial.targetGamesPerTeam) : ""
  )
  const [busy, setBusy] = useState(false)

  // Picking a date defaults the window to the first selected venue's hours
  // for that weekday (season hours first, shared posted hours as fallback).
  const hoursByDay = useMemo(() => {
    const firstVenueId = selections[0]?.venueId ?? seasonVenues[0]?.venue?.id
    const sv = seasonVenues.find((v: any) => v.venue.id === firstVenueId)
    if (!sv) return null
    const source = sv.hours?.length ? sv.hours : sv.venue?.venueHours ?? []
    const map = new Map<number, { open: string; close: string }>()
    for (const h of source) {
      if (h.openTime && h.closeTime) map.set(h.dayOfWeek, { open: h.openTime, close: h.closeTime })
    }
    return map.size > 0 ? map : null
  }, [seasonVenues, selections])

  const updateDay = (idx: number, field: keyof DayDraft, value: string) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d
        if (field === "date" && value && hoursByDay) {
          const hours = hoursByDay.get(new Date(`${value}T12:00:00`).getDay())
          if (hours) return { ...d, date: value, startTime: hours.open, endTime: hours.close }
        }
        return { ...d, [field]: value }
      })
    )
  }

  const toggleVenue = (venueId: string, courtIds: string[]) => {
    setSelections((prev) => {
      const has = prev.some((s) => s.venueId === venueId)
      if (has) return prev.filter((s) => s.venueId !== venueId)
      return [...prev, { venueId, courtIds }]
    })
  }
  const toggleCourt = (venueId: string, courtId: string) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.venueId !== venueId) return s
        const has = s.courtIds.includes(courtId)
        return {
          ...s,
          courtIds: has ? s.courtIds.filter((c) => c !== courtId) : [...s.courtIds, courtId],
        }
      })
    )
  }
  const moveCourt = (venueId: string, courtId: string, dir: -1 | 1) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.venueId !== venueId) return s
        const idx = s.courtIds.indexOf(courtId)
        const target = idx + dir
        if (idx < 0 || target < 0 || target >= s.courtIds.length) return s
        const next = [...s.courtIds]
        ;[next[idx], next[target]] = [next[target], next[idx]]
        return { ...s, courtIds: next }
      })
    )
  }

  const validDays = days.filter((d) => d.date)
  const courtsPicked = selections.some((s) => s.courtIds.length > 0)

  const submit = async () => {
    setBusy(true)
    try {
      await onSave({
        label: label || undefined,
        days: validDays.map((d) => ({
          date: new Date(d.date).toISOString(),
          startTime: d.startTime,
          endTime: d.endTime,
        })),
        venues: selections,
        targetGamesPerTeam: gamesPerTeam === "" ? null : parseInt(gamesPerTeam),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-play-200 bg-play-50/40 mb-2 space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Weekend 1, October)"
          className={inputClass + " min-w-48 flex-1"}
        />
        <label className="text-ink-600 flex items-center gap-1.5 text-xs">
          Games per team this session
          <input
            value={gamesPerTeam}
            onChange={(e) => setGamesPerTeam(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="auto"
            className={inputClass + " w-16"}
            title="Blank = derived from the season's games ÷ sessions"
          />
        </label>
      </div>

      <div className="space-y-1.5">
        {days.map((day, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <DateTimePicker mode="date" value={day.date} onChange={(v) => updateDay(idx, "date", v)} className="w-40" />
            <DateTimePicker mode="time" value={day.startTime} onChange={(v) => updateDay(idx, "startTime", v)} className="w-28" />
            <span className="text-ink-400 text-xs">-</span>
            <DateTimePicker mode="time" value={day.endTime} onChange={(v) => updateDay(idx, "endTime", v)} className="w-28" />
            {days.length > 1 && (
              <button
                onClick={() => setDays((prev) => prev.filter((_, i) => i !== idx))}
                className="hover:text-hoop-700 text-xs text-red-500"
              >
                x
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDays((prev) => [...prev, { date: "", startTime: "09:00", endTime: "17:00" }])}
          className="text-play-700 text-xs font-medium hover:underline"
        >
          + Add another day
        </button>
        <p className="text-ink-400 text-[11px]">
          Hours prefill from the venue&apos;s scheduling hours when you pick a date — adjust a
          day only if your booking differs.
        </p>
      </div>

      {/* Venues & courts this session uses, in preferred fill order */}
      <div>
        <p className="text-ink-700 text-xs font-semibold">Where do games run?</p>
        <p className="text-ink-400 mb-1.5 text-[11px]">
          The season&apos;s courts start ON — untick what this session doesn&apos;t have. Games
          fill the first court, then overflow down the list.
        </p>
        {seasonVenues.length === 0 ? (
          <p className="text-ink-500 text-xs">Add a venue to the season first (above).</p>
        ) : (
          <div className="space-y-1.5">
            {seasonVenues.map((sv: any) => {
              const venue = sv.venue
              const selection = selections.find((s) => s.venueId === venue.id)
              const allCourtIds = (venue.courtList ?? []).map((c: any) => c.id)
              return (
                <div key={venue.id} className="border-ink-100 rounded-lg border bg-white px-2.5 py-1.5">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!selection}
                      onChange={() => toggleVenue(venue.id, allCourtIds)}
                    />
                    <span className="text-ink-900 font-medium">{venue.name}</span>
                    <span className="text-ink-400 text-xs">
                      {(venue.courtList ?? []).length} court{(venue.courtList ?? []).length === 1 ? "" : "s"}
                    </span>
                  </label>
                  {selection && (venue.courtList ?? []).length > 0 && (
                    <div className="mt-1 space-y-0.5 pl-6">
                      {/* selected courts first, in preference order */}
                      {selection.courtIds.map((courtId, idx) => {
                        const court = (venue.courtList ?? []).find((c: any) => c.id === courtId)
                        if (!court) return null
                        return (
                          <div key={courtId} className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked onChange={() => toggleCourt(venue.id, courtId)} />
                            <span className="text-ink-400 w-4 font-mono">{idx + 1}.</span>
                            <span className="text-ink-800">{court.name}</span>
                            <button
                              onClick={() => moveCourt(venue.id, courtId, -1)}
                              disabled={idx === 0}
                              className="text-ink-400 hover:text-ink-700 disabled:opacity-30"
                              aria-label="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveCourt(venue.id, courtId, 1)}
                              disabled={idx === selection.courtIds.length - 1}
                              className="text-ink-400 hover:text-ink-700 disabled:opacity-30"
                              aria-label="Move down"
                            >
                              ↓
                            </button>
                          </div>
                        )
                      })}
                      {(venue.courtList ?? [])
                        .filter((c: any) => !selection.courtIds.includes(c.id))
                        .map((c: any) => (
                          <div key={c.id} className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={false} onChange={() => toggleCourt(venue.id, c.id)} />
                            <span className="text-ink-500">{c.name}</span>
                            <span className="text-ink-300 text-[10px]">not used</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy || validDays.length === 0 || !courtsPicked}>
          {busy ? "Saving…" : initial ? "Save session" : "Add session"}
        </Button>
        <Button size="sm" variant="subtle" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {!courtsPicked && (
          <span className="text-amber-600 text-xs">Pick at least one court.</span>
        )}
      </div>
    </div>
  )
}
