"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { panelClass } from "./types"

interface PoolReferee {
  userId: string
  name: string
  certification: string | null
  gamesRefereed: number
  hasPin: boolean
  inPool: boolean
  availability: "available" | "partial" | "unknown"
}

interface OfferRow {
  id: string
  date: string
  sessionLabel: string | null
  window: string
  status: string
  target: string
  acceptedBy: string | null
}

const SHIFT_PRESETS = [
  { label: "Full day (9–6)", start: "09:00", end: "18:00" },
  { label: "Morning 6h (9–3)", start: "09:00", end: "15:00" },
  { label: "Afternoon (12–6)", start: "12:00", end: "18:00" },
]

const AVAILABILITY_BADGE: Record<string, [string, string]> = {
  available: ["available", "bg-court-100 text-court-700"],
  partial: ["other hours", "bg-hoop-100 text-hoop-700"],
  unknown: ["no availability set", "bg-ink-100 text-ink-500"],
}

/**
 * The league's referee desk: keep a pool of familiar refs, then book a
 * session day Uber-style — target one referee (availability shown when
 * they've declared it) or broadcast to the whole pool, first accept wins.
 */
export function RefereesTab({
  leagueId,
  sessions,
  refresh,
}: {
  leagueId: string
  sessions: any[]
  refresh: () => void
}) {
  const [pool, setPool] = useState<PoolReferee[] | null>(null)
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [dayId, setDayId] = useState("")
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("18:00")
  const [target, setTarget] = useState("") // "" = broadcast
  const [message, setMessage] = useState("")
  const [growQ, setGrowQ] = useState("")
  const [growResults, setGrowResults] = useState<PoolReferee[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const days = sessions.flatMap((s: any) =>
    (s.days ?? []).map((d: any) => ({
      id: d.id,
      label: `${s.label || "Session"} — ${format(new Date(d.date), "EEE, MMM d")}`,
      date: d.date,
    }))
  )
  const selectedDay = days.find((d) => d.id === dayId)

  const loadPool = useCallback(async () => {
    const dateParam = selectedDay
      ? `?date=${new Date(selectedDay.date).toISOString().slice(0, 10)}&start=${start}&end=${end}`
      : ""
    const res = await fetch(`/api/leagues/${leagueId}/referees${dateParam}`).catch(() => null)
    if (!res?.ok) return
    const data = await res.json()
    setPool(data.referees)
  }, [leagueId, selectedDay, start, end])

  const loadOffers = useCallback(async () => {
    const res = await fetch(`/api/leagues/${leagueId}/referee-requests`).catch(() => null)
    if (!res?.ok) return
    const data = await res.json()
    setOffers(data.requests)
  }, [leagueId])

  useEffect(() => {
    loadPool()
    loadOffers()
  }, [loadPool, loadOffers])

  const growSearch = async (q: string) => {
    setGrowQ(q)
    if (q.trim().length < 2) {
      setGrowResults([])
      return
    }
    const res = await fetch(
      `/api/leagues/${leagueId}/referees?all=1&q=${encodeURIComponent(q)}`
    ).catch(() => null)
    if (!res?.ok) return
    const data = await res.json()
    setGrowResults(data.referees.filter((r: PoolReferee) => !r.inPool))
  }

  const addToPool = async (userId: string) => {
    await fetch(`/api/leagues/${leagueId}/referees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    setGrowQ("")
    setGrowResults([])
    loadPool()
  }

  const removeFromPool = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from your referee pool?`)) return
    await fetch(`/api/leagues/${leagueId}/referees?userId=${userId}`, { method: "DELETE" })
    loadPool()
  }

  const sendOffer = async () => {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch(`/api/leagues/${leagueId}/referee-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDayId: dayId,
          startTime: start,
          endTime: end,
          targetUserId: target || undefined,
          message: message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't send the offer")
      setNote(
        target
          ? "Offer sent — the referee has been notified."
          : `Offer broadcast to ${data.notified} referees — first to accept gets the day.`
      )
      setMessage("")
      loadOffers()
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't send the offer")
    } finally {
      setBusy(false)
    }
  }

  const cancelOffer = async (id: string) => {
    if (!window.confirm("Cancel this offer?")) return
    await fetch(`/api/referee-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    })
    loadOffers()
    refresh()
  }

  return (
    <div className="grid gap-6">
      {/* Book a day */}
      <div className={panelClass}>
        <h3 className="text-ink-900 mb-1 font-semibold">Book a referee for a session day</h3>
        <p className="text-ink-500 mb-4 text-xs">
          Pick a day and shift, then target a referee you know — or broadcast to your whole
          pool and let the first taker have it. Accepting auto-assigns them to every game in
          the window.
        </p>
        {note && (
          <div className="border-court-200 bg-court-50 text-court-700 mb-3 rounded-xl border px-3 py-2 text-xs">
            {note}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">Session day</label>
            <select
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
              className="border-ink-200 rounded-xl border px-2 py-1.5 text-sm"
            >
              <option value="">Choose day…</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">Shift</label>
            <div className="flex items-center gap-1">
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="border-ink-200 rounded-xl border px-2 py-1.5 text-sm" />
              <span className="text-ink-400 text-xs">–</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="border-ink-200 rounded-xl border px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-1">
            {SHIFT_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setStart(p.start)
                  setEnd(p.end)
                }}
                className="bg-ink-100 text-ink-600 hover:bg-ink-200 rounded-full px-2 py-1 text-[11px] font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="text-ink-600 mb-1 block text-xs font-medium">Send to</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="border-ink-200 w-full rounded-xl border px-2 py-1.5 text-sm"
            >
              <option value="">📢 All league referees (first accept wins)</option>
              {(pool ?? [])
                .filter((r) => r.inPool)
                .map((r) => {
                  const [label] = AVAILABILITY_BADGE[r.availability]
                  return (
                    <option key={r.userId} value={r.userId}>
                      {r.name}
                      {dayId ? ` — ${label}` : ""}
                    </option>
                  )
                })}
            </select>
          </div>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message (optional)"
            className="border-ink-200 min-w-0 flex-1 rounded-xl border px-3 py-1.5 text-sm"
          />
          <button
            onClick={sendOffer}
            disabled={busy || !dayId}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send offer"}
          </button>
        </div>
      </div>

      {/* Offers */}
      <div className={panelClass}>
        <h3 className="text-ink-900 mb-3 font-semibold">Offers</h3>
        {offers.length === 0 ? (
          <p className="text-ink-500 text-sm">No offers sent yet.</p>
        ) : (
          <div className="space-y-2">
            {offers.map((o) => (
              <div
                key={o.id}
                className="border-court-100 bg-court-50 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-ink-900 font-medium">
                    {format(new Date(o.date), "EEE, MMM d")} · {o.window}
                  </span>
                  <span className="text-ink-500 ml-2 text-xs">→ {o.target}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === "ACCEPTED"
                        ? "bg-court-100 text-court-700"
                        : o.status === "PENDING"
                          ? "bg-hoop-100 text-hoop-700"
                          : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {o.status === "ACCEPTED" && o.acceptedBy
                      ? `accepted — ${o.acceptedBy}`
                      : o.status.toLowerCase()}
                  </span>
                  {o.status === "PENDING" && (
                    <button
                      onClick={() => cancelOffer(o.id)}
                      className="text-hoop-600 text-xs font-semibold hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pool */}
      <div className={panelClass}>
        <h3 className="text-ink-900 mb-3 font-semibold">
          League referee pool ({(pool ?? []).filter((r) => r.inPool).length})
        </h3>
        <div className="mb-3 space-y-1">
          {(pool ?? [])
            .filter((r) => r.inPool)
            .map((r) => {
              const [label, cls] = AVAILABILITY_BADGE[r.availability]
              return (
                <div
                  key={r.userId}
                  className="border-ink-100 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-ink-900 font-medium">{r.name}</span>
                    <span className="text-ink-400 ml-2 text-xs">
                      {r.certification ?? "Uncertified"} · {r.gamesRefereed} games
                      {r.hasPin ? "" : " · no sign-off PIN"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dayId && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
                        {label}
                      </span>
                    )}
                    <button
                      onClick={() => removeFromPool(r.userId, r.name)}
                      className="text-hoop-600 text-xs font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          {pool !== null && pool.filter((r) => r.inPool).length === 0 && (
            <p className="text-ink-500 text-sm">No referees in your pool yet — add some below.</p>
          )}
        </div>
        <div>
          <label className="text-ink-600 mb-1 block text-xs font-medium">
            Add a referee to your pool
          </label>
          <input
            type="search"
            value={growQ}
            onChange={(e) => growSearch(e.target.value)}
            placeholder="Search referees on the platform…"
            className="border-ink-200 w-full rounded-xl border px-3 py-2 text-sm"
          />
          {growResults.length > 0 && (
            <div className="border-ink-100 mt-1 space-y-1 rounded-xl border p-2">
              {growResults.map((r) => (
                <div key={r.userId} className="flex items-center justify-between text-sm">
                  <span className="text-ink-800">
                    {r.name}
                    <span className="text-ink-400 ml-2 text-xs">
                      {r.certification ?? "Uncertified"} · {r.gamesRefereed} games
                    </span>
                  </span>
                  <button
                    onClick={() => addToPool(r.userId)}
                    className="text-play-700 text-xs font-semibold hover:underline"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
