"use client"

import { useState } from "react"

interface Court {
  id: string
  name: string
  displayOrder: number
}

interface Hours {
  id?: string
  dayOfWeek: number
  openTime: string | null
  closeTime: string | null
}

interface VenueEditorProps {
  venueId: string
  venueName: string
  courts: Court[]
  hours: Hours[]
  onChange?: () => void
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function VenueEditor({ venueId, venueName, courts, hours, onChange }: VenueEditorProps) {
  const [addingCourt, setAddingCourt] = useState(false)
  const [newCourtName, setNewCourtName] = useState("")
  const [savingHours, setSavingHours] = useState(false)

  const [hoursState, setHoursState] = useState<Hours[]>(() => {
    const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]))
    return DAY_LABELS.map((_, dayOfWeek) => {
      const existing = byDay.get(dayOfWeek)
      return (
        existing ?? {
          dayOfWeek,
          openTime: null,
          closeTime: null,
        }
      )
    })
  })

  const addCourt = async () => {
    if (!newCourtName.trim()) return
    const res = await fetch(`/api/venues/${venueId}/courts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCourtName.trim() }),
    })
    if (res.ok) {
      setNewCourtName("")
      setAddingCourt(false)
      onChange?.()
    }
  }

  const renameCourt = async (courtId: string, name: string) => {
    await fetch(`/api/venues/${venueId}/courts/${courtId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    onChange?.()
  }

  const removeCourt = async (courtId: string) => {
    const res = await fetch(`/api/venues/${venueId}/courts/${courtId}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed" }))
      alert(data.error || "Failed to delete")
      return
    }
    onChange?.()
  }

  const saveHours = async () => {
    setSavingHours(true)
    await fetch(`/api/venues/${venueId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours: hoursState.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime || null,
          closeTime: h.closeTime || null,
        })),
      }),
    })
    setSavingHours(false)
    onChange?.()
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-ink-700 mb-2 text-xs font-semibold uppercase tracking-[0.1em]">
          Courts at {venueName}
        </p>
        {courts.length === 0 ? (
          <p className="text-ink-400 text-xs">No courts defined yet.</p>
        ) : (
          <ul className="space-y-1">
            {courts.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input
                  defaultValue={c.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== c.name) renameCourt(c.id, v)
                  }}
                  className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 flex-1 rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2"
                />
                <button
                  onClick={() => {
                    if (confirm(`Remove ${c.name}?`)) removeCourt(c.id)
                  }}
                  className="hover:text-hoop-700 text-xs text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {addingCourt ? (
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              value={newCourtName}
              onChange={(e) => setNewCourtName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCourt()
                if (e.key === "Escape") setAddingCourt(false)
              }}
              placeholder="e.g. Court 1, Main Court"
              className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 flex-1 rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2"
            />
            <button
              onClick={addCourt}
              className="bg-play-600 hover:bg-play-700 rounded-lg px-3 py-1 text-xs font-semibold text-white"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAddingCourt(false)
                setNewCourtName("")
              }}
              className="text-ink-500 text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCourt(true)}
            className="text-play-700 hover:text-play-800 mt-2 text-xs font-semibold"
          >
            + Add court
          </button>
        )}
      </div>

      <div>
        <p className="text-ink-700 mb-2 text-xs font-semibold uppercase tracking-[0.1em]">
          Default hours
        </p>
        <div className="space-y-1">
          {hoursState.map((h) => {
            const closed = !h.openTime && !h.closeTime
            return (
              <div key={h.dayOfWeek} className="flex items-center gap-2 text-xs">
                <span className="text-ink-700 w-8">{DAY_LABELS[h.dayOfWeek]}</span>
                <input
                  type="time"
                  value={h.openTime ?? ""}
                  onChange={(e) => {
                    const next = [...hoursState]
                    next[h.dayOfWeek] = { ...h, openTime: e.target.value || null }
                    setHoursState(next)
                  }}
                  className="border-ink-200 rounded-lg border px-2 py-1 text-xs"
                />
                <span className="text-ink-400">–</span>
                <input
                  type="time"
                  value={h.closeTime ?? ""}
                  onChange={(e) => {
                    const next = [...hoursState]
                    next[h.dayOfWeek] = { ...h, closeTime: e.target.value || null }
                    setHoursState(next)
                  }}
                  className="border-ink-200 rounded-lg border px-2 py-1 text-xs"
                />
                {closed && <span className="text-ink-400">(closed)</span>}
                <button
                  onClick={() => {
                    const next = [...hoursState]
                    next[h.dayOfWeek] = { ...h, openTime: null, closeTime: null }
                    setHoursState(next)
                  }}
                  className="text-ink-400 hover:text-ink-600 ml-auto text-[10px]"
                >
                  clear
                </button>
              </div>
            )
          })}
        </div>
        <button
          onClick={saveHours}
          disabled={savingHours}
          className="bg-play-600 hover:bg-play-700 mt-2 rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {savingHours ? "Saving..." : "Save hours"}
        </button>
      </div>
    </div>
  )
}
