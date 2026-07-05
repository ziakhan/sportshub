"use client"

import { useState } from "react"
import { format } from "date-fns"
import { panelClass } from "./types"

export function SessionsTab({
  seasonId,
  sessions,
  refresh,
}: {
  seasonId: string
  sessions: any[]
  refresh: () => void
}) {
  // Session form
  const [sessionLabel, setSessionLabel] = useState("")
  const [sessionDays, setSessionDays] = useState([
    { date: "", startTime: "09:00", endTime: "17:00" },
  ])

  const addSessionDay = () => {
    setSessionDays([...sessionDays, { date: "", startTime: "09:00", endTime: "17:00" }])
  }

  const updateSessionDay = (idx: number, field: string, value: string) => {
    setSessionDays(sessionDays.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
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
      <div className={panelClass}>
        <h3 className="text-ink-900 mb-4 font-semibold">Sessions (Game Days)</h3>
        {sessions.map((s: any) => (
          <div
            key={s.id}
            className="border-court-100 bg-court-50 mb-2 rounded-xl border px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-ink-900 font-medium">{s.label || "Session"}</span>
              <div className="flex items-center gap-2">
                {s.venue && <span className="text-ink-400 text-xs">{s.venue.name}</span>}
                <button
                  onClick={async () => {
                    await fetch(`/api/seasons/${seasonId}/sessions?sessionId=${s.id}`, {
                      method: "DELETE",
                    })
                    refresh()
                  }}
                  className="hover:text-hoop-700 text-xs text-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
            {s.days?.map((d: any) => (
              <div key={d.id} className="text-ink-500 ml-2 text-xs">
                {format(new Date(d.date), "EEE, MMM d")} {d.startTime}-{d.endTime}
              </div>
            ))}
          </div>
        ))}
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
          <button
            onClick={addSession}
            className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            Add Session
          </button>
        </div>
      </div>
    </div>
  )
}
