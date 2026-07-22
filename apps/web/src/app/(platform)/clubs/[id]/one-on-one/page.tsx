"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { Button, DateTimePicker, PanelHeader } from "@/components/ui"
import { formatCurrency } from "@/lib/countries"

interface Window {
  id: string
  date: string
  startTime: string
  endTime: string
  note: string | null
}

interface Booking {
  id: string
  startAt: string
  durationMinutes: number
  fee: number
  status: string
  notes: string | null
  player: { firstName: string; lastName: string }
  user: { firstName: string | null; lastName: string | null; email: string }
}

interface Profile {
  oneOnOneEnabled: boolean
  oneOnOneFee: number | null
  slotMinutes: number
  bio: string | null
}

/**
 * Trainer 1-on-1 workspace (batch-backlog §5 P2): settings (fee + slot
 * length + enable), availability windows, and upcoming bookings. Parents
 * book generated slots from the public trainer page.
 */
export default function OneOnOnePage() {
  const params = useParams()
  const clubId = params?.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [windows, setWindows] = useState<Window[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Settings form
  const [fee, setFee] = useState("")
  const [slotMinutes, setSlotMinutes] = useState(60)
  const [savingSettings, setSavingSettings] = useState(false)

  // Availability form
  const [date, setDate] = useState("")
  const [start, setStart] = useState("16:00")
  const [end, setEnd] = useState("20:00")
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [p, w, b] = await Promise.all([
        fetch(`/api/trainers/${clubId}/profile`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/trainers/${clubId}/availability`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/trainers/${clubId}/bookings`).then((r) => (r.ok ? r.json() : null)),
      ])
      if (p) {
        setProfile(
          p.profile ?? { oneOnOneEnabled: false, oneOnOneFee: null, slotMinutes: 60, bio: null }
        )
        if (p.profile?.oneOnOneFee != null) setFee(String(p.profile.oneOnOneFee))
        if (p.profile?.slotMinutes) setSlotMinutes(p.profile.slotMinutes)
      }
      if (w) setWindows(w.windows ?? [])
      if (b) setBookings(b.bookings ?? [])
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveSettings = async (enable?: boolean) => {
    setSavingSettings(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/trainers/${clubId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oneOnOneFee: fee === "" ? null : Number(fee),
          slotMinutes,
          ...(enable !== undefined ? { oneOnOneEnabled: enable } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't save settings")
      setNotice("Settings saved.")
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't save settings.")
    } finally {
      setSavingSettings(false)
    }
  }

  const addWindow = async () => {
    if (!date) return setError("Pick a date.")
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`/api/trainers/${clubId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime: start, endTime: end }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't add availability")
      setDate("")
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't add availability.")
    } finally {
      setAdding(false)
    }
  }

  const removeWindow = async (id: string) => {
    await fetch(`/api/trainers/${clubId}/availability?id=${id}`, { method: "DELETE" })
    await refresh()
  }

  const cancelBooking = async (bookingId: string) => {
    if (!confirm("Cancel this session? The family will be notified.")) return
    const res = await fetch(`/api/trainers/${clubId}/bookings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, action: "cancel" }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Couldn't cancel the booking.")
      return
    }
    await refresh()
  }

  const panelClass = "rounded-2xl border border-ink-100 bg-white p-5"
  const inputClass =
    "rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 focus:border-play-500 focus:outline-none"

  if (loading) return <p className="text-ink-500 text-sm">Loading…</p>

  const upcoming = bookings.filter((b) => b.status === "CONFIRMED")

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-ink-900 text-2xl font-semibold">One-on-One Training</h2>
        <p className="text-ink-500 mt-1 text-sm">
          Set your session length and fee, open up availability, and families book slots from
          your public page.
        </p>
      </div>

      {error && (
        <div className="border-hoop-200 text-hoop-700 rounded-lg border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="border-court-200 text-court-700 bg-court-50 rounded-lg border p-3 text-sm">
          {notice}
        </div>
      )}

      {/* Settings */}
      <div className={panelClass}>
        <PanelHeader title="Session settings" />
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-semibold">Session length</label>
            <select
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
              className={inputClass}
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-semibold">
              Fee per session
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} w-32`}
            />
          </div>
          <Button size="sm" variant="secondary" disabled={savingSettings} onClick={() => saveSettings()}>
            Save
          </Button>
          {profile?.oneOnOneEnabled ? (
            <Button
              size="sm"
              variant="subtle"
              disabled={savingSettings}
              onClick={() => saveSettings(false)}
            >
              Turn off booking
            </Button>
          ) : (
            <Button size="sm" disabled={savingSettings} onClick={() => saveSettings(true)}>
              Turn on booking
            </Button>
          )}
        </div>
        <p className="text-ink-400 mt-3 text-xs">
          {profile?.oneOnOneEnabled
            ? "Booking is ON — families see your open slots on your public page."
            : "Booking is OFF — set a fee, add availability, then turn it on."}
        </p>
      </div>

      {/* Availability */}
      <div className={panelClass}>
        <PanelHeader title="Availability" />
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-semibold">Date</label>
            <DateTimePicker mode="date" value={date} onChange={setDate} className="w-40" />
          </div>
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-semibold">From</label>
            <DateTimePicker mode="time" value={start} onChange={setStart} className="w-28" />
          </div>
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-semibold">To</label>
            <DateTimePicker mode="time" value={end} onChange={setEnd} className="w-28" />
          </div>
          <Button size="sm" disabled={adding} onClick={addWindow}>
            Add
          </Button>
        </div>
        {windows.length === 0 ? (
          <p className="text-ink-400 mt-3 text-sm">
            No availability yet — add the days and hours you can train.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {windows.map((w) => (
              <li key={w.id} className="text-ink-700 flex items-center gap-3 text-sm">
                <span className="w-36">{format(new Date(w.date), "EEE MMM d")}</span>
                <span>
                  {w.startTime} – {w.endTime}
                </span>
                <button
                  onClick={() => removeWindow(w.id)}
                  className="text-ink-400 ml-auto text-xs hover:text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bookings */}
      <div className={panelClass}>
        <PanelHeader title="Upcoming sessions" />
        {upcoming.length === 0 ? (
          <p className="text-ink-400 text-sm">No booked sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((b) => (
              <li
                key={b.id}
                className="border-ink-100 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
              >
                <div>
                  <p className="text-ink-900 font-medium">
                    {b.player.firstName} {b.player.lastName}
                  </p>
                  <p className="text-ink-500">
                    {format(new Date(b.startAt), "EEE MMM d, h:mm a")} · {b.durationMinutes} min ·{" "}
                    {b.fee > 0 ? formatCurrency(b.fee, "CAD") : "Free"}
                  </p>
                  {b.notes && <p className="text-ink-400 mt-0.5 text-xs">{b.notes}</p>}
                </div>
                <button
                  onClick={() => cancelBooking(b.id)}
                  className="hover:text-hoop-700 ml-auto text-xs text-red-500"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
