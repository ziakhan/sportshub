"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Button, PanelHeader } from "@/components/ui"
import { panelClass } from "./types"

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

export function SessionsTab({
  seasonId,
  sessions,
  seasonStatus,
  refresh,
}: {
  seasonId: string
  sessions: any[]
  seasonStatus?: string
  refresh: () => void
}) {
  const locked = LOCKED_STATUSES.includes(seasonStatus ?? "")
  // Session form
  const [sessionLabel, setSessionLabel] = useState("")
  const [sessionDays, setSessionDays] = useState([
    { date: "", startTime: "09:00", endTime: "17:00" },
  ])
  // Venue default hours (owner ask 2026-07-07): picking a date prefills the
  // day window from the venue's stored hours for that weekday — editable.
  const [venueHoursName, setVenueHoursName] = useState<string | null>(null)
  const [hoursByDay, setHoursByDay] = useState<
    Map<number, { open: string; close: string }> | null
  >(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/seasons/${seasonId}/venues`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.venues?.length) return
        const venue = data.venues[0].venue
        const map = new Map<number, { open: string; close: string }>()
        for (const h of venue?.venueHours ?? []) {
          if (h.openTime && h.closeTime) {
            map.set(h.dayOfWeek, { open: h.openTime, close: h.closeTime })
          }
        }
        if (map.size > 0) {
          setHoursByDay(map)
          setVenueHoursName(venue.name)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [seasonId])

  const addSessionDay = () => {
    setSessionDays([...sessionDays, { date: "", startTime: "09:00", endTime: "17:00" }])
  }

  const updateSessionDay = (idx: number, field: string, value: string) => {
    setSessionDays(
      sessionDays.map((d, i) => {
        if (i !== idx) return d
        // Date picked → default the window to the venue's hours that weekday
        if (field === "date" && value && hoursByDay) {
          const hours = hoursByDay.get(new Date(`${value}T12:00:00`).getDay())
          if (hours) {
            return { ...d, date: value, startTime: hours.open, endTime: hours.close }
          }
        }
        return { ...d, [field]: value }
      })
    )
  }

  const removeSessionDay = (idx: number) => {
    if (sessionDays.length > 1) setSessionDays(sessionDays.filter((_, i) => i !== idx))
  }

  const addSession = async () => {
    const validDays = sessionDays.filter((d) => d.date)
    if (validDays.length === 0) return
    await fetch(`/api/seasons/${seasonId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: sessionLabel || undefined,
        days: validDays.map((d) => ({
          date: new Date(d.date).toISOString(),
          startTime: d.startTime,
          endTime: d.endTime,
        })),
      }),
    })
    setSessionLabel("")
    setSessionDays([{ date: "", startTime: "09:00", endTime: "17:00" }])
    refresh()
  }

  return (
    <div className="grid gap-6">
      {/* Sessions */}
      <div className={`reveal ${panelClass}`}>
        <PanelHeader title="Sessions (game days)" />
        {locked && (
          <div className="border-amber-200 bg-amber-50 text-amber-800 mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Season is {seasonStatus === "IN_PROGRESS" ? "in progress" : seasonStatus?.toLowerCase()} —
            sessions are locked while games are being played.
          </div>
        )}
        {sessions.map((s: any) => (
          <div
            key={s.id}
            className="border-court-100 bg-court-50 hover:border-court-200 mb-2 rounded-xl border px-3 py-2 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-ink-900 font-medium">{s.label || "Session"}</span>
              <div className="flex items-center gap-2">
                {s.venue && <span className="text-ink-400 text-xs">{s.venue.name}</span>}
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
          </div>
        ))}
        {!locked && (
        <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
          <input
            type="text"
            value={sessionLabel}
            onChange={(e) => setSessionLabel(e.target.value)}
            placeholder="Label (e.g. Week 1)"
            className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-full rounded-xl border px-2 py-1.5 text-sm focus:outline-none focus:ring-2"
          />
          {sessionDays.map((day, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <input
                type="date"
                value={day.date}
                onChange={(e) => updateSessionDay(idx, "date", e.target.value)}
                className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 flex-1 rounded-xl border px-2 py-1 text-xs focus:outline-none focus:ring-2"
              />
              <input
                type="time"
                value={day.startTime}
                onChange={(e) => updateSessionDay(idx, "startTime", e.target.value)}
                className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-20 rounded-xl border px-1 py-1 text-xs focus:outline-none focus:ring-2"
              />
              <span className="text-ink-400 text-xs">-</span>
              <input
                type="time"
                value={day.endTime}
                onChange={(e) => updateSessionDay(idx, "endTime", e.target.value)}
                className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-20 rounded-xl border px-1 py-1 text-xs focus:outline-none focus:ring-2"
              />
              {sessionDays.length > 1 && (
                <button
                  onClick={() => removeSessionDay(idx)}
                  className="hover:text-hoop-700 text-xs text-red-500"
                >
                  x
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSessionDay}
            className="text-play-700 text-xs font-medium hover:underline"
          >
            + Add another day
          </button>
          {venueHoursName && (
            <p className="text-ink-400 text-[11px]">
              Times default to {venueHoursName}&apos;s hours for the chosen weekday — edit as
              needed.
            </p>
          )}
          <Button size="sm" block onClick={addSession}>
            Add Session
          </Button>
        </div>
        )}
      </div>
    </div>
  )
}
