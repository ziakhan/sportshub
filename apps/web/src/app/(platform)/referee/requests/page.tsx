"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { DateTimePicker } from "@/components/ui"

interface InboxRequest {
  id: string
  leagueName: string
  date: string
  sessionLabel: string | null
  seasonLabel: string
  window: string
  message: string | null
  status: string
  broadcast: boolean
  mine: boolean
}

interface Slot {
  id: string
  date: string
  startTime: string
  endTime: string
  note: string | null
}

/**
 * The referee's desk: declare availability (leagues see it when booking)
 * and answer shift offers — targeted ones and pool broadcasts where the
 * first to accept gets the day and its games.
 */
export default function RefereeRequestsPage() {
  const [requests, setRequests] = useState<InboxRequest[] | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [date, setDate] = useState("")
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("18:00")
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [reqRes, avRes] = await Promise.all([
      fetch("/api/referee/requests").catch(() => null),
      fetch("/api/referee/availability").catch(() => null),
    ])
    if (reqRes?.ok) setRequests((await reqRes.json()).requests)
    if (avRes?.ok) setSlots((await avRes.json()).slots)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const respond = async (id: string, action: "accept" | "decline") => {
    setBusy(id)
    setNote(null)
    try {
      const res = await fetch(`/api/referee-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't respond")
      setNote(
        action === "accept"
          ? `You're booked — assigned to ${data.gamesAssigned} game${data.gamesAssigned !== 1 ? "s" : ""} that day.`
          : "Declined."
      )
      load()
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't respond")
      load()
    } finally {
      setBusy(null)
    }
  }

  const addSlot = async () => {
    if (!date) return
    const res = await fetch("/api/referee/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startTime: start, endTime: end }),
    })
    if (res.ok) {
      setDate("")
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setNote(data.error || "Couldn't save availability")
    }
  }

  const removeSlot = async (id: string) => {
    await fetch(`/api/referee/availability?id=${id}`, { method: "DELETE" })
    load()
  }

  const pending = (requests ?? []).filter((r) => r.status === "PENDING")
  const booked = (requests ?? []).filter((r) => r.status === "ACCEPTED" && r.mine)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-ink-950 text-2xl font-bold">Shifts &amp; availability</h1>
          <p className="text-ink-500 mt-1 text-sm">
            Leagues book you by the day — keep your availability current and answer offers here.
          </p>
        </div>
        <Link href="/referee/profile" className="text-play-600 text-sm font-semibold hover:underline">
          My profile →
        </Link>
      </div>

      {note && (
        <div className="border-court-200 bg-court-50 text-court-700 rounded-xl border px-4 py-2 text-sm">
          {note}
        </div>
      )}

      {/* Offers */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
        <h2 className="text-ink-900 mb-3 font-semibold">
          Offers{pending.length > 0 ? ` (${pending.length})` : ""}
        </h2>
        {requests === null ? (
          <p className="text-ink-400 text-sm">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-ink-500 text-sm">No open offers right now.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="border-ink-100 rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-ink-900 text-sm font-semibold">
                      {r.leagueName} · {format(new Date(r.date), "EEE, MMM d")} · {r.window}
                    </span>
                    <span className="text-ink-400 ml-2 text-xs">
                      {r.seasonLabel}
                      {r.sessionLabel ? ` · ${r.sessionLabel}` : ""}
                    </span>
                    {r.broadcast && (
                      <span className="bg-hoop-100 text-hoop-700 ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold">
                        first accept wins
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(r.id, "accept")}
                      disabled={busy === r.id}
                      className="bg-court-600 rounded-xl px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respond(r.id, "decline")}
                      disabled={busy === r.id}
                      className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
                {r.message && <p className="text-ink-600 mt-1 text-sm">“{r.message}”</p>}
              </div>
            ))}
          </div>
        )}

        {booked.length > 0 && (
          <div className="border-ink-100 mt-4 border-t pt-3">
            <p className="text-ink-500 mb-2 text-xs font-medium uppercase tracking-wide">
              Your booked shifts
            </p>
            {booked.map((r) => (
              <div key={r.id} className="text-ink-700 flex items-center gap-2 text-sm">
                <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  booked
                </span>
                {r.leagueName} · {format(new Date(r.date), "EEE, MMM d")} · {r.window}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
        <h2 className="text-ink-900 mb-1 font-semibold">My availability</h2>
        <p className="text-ink-500 mb-3 text-xs">
          Days and hours you can work — leagues see this when they pick a referee.
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">Date</label>
            <DateTimePicker mode="date" value={date} onChange={setDate} className="w-40" />
          </div>
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">From</label>
            <DateTimePicker mode="time" value={start} onChange={setStart} className="w-28" />
          </div>
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">To</label>
            <DateTimePicker mode="time" value={end} onChange={setEnd} className="w-28" />
          </div>
          <button
            onClick={addSlot}
            disabled={!date}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {slots.length === 0 ? (
          <p className="text-ink-500 text-sm">No upcoming availability declared.</p>
        ) : (
          <div className="space-y-1">
            {slots.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-700">
                  {format(new Date(s.date), "EEE, MMM d")} · {s.startTime}–{s.endTime}
                </span>
                <button
                  onClick={() => removeSlot(s.id)}
                  className="text-hoop-600 text-xs font-semibold hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
