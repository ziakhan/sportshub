"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface Player {
  id: string
  firstName: string
  lastName: string
}

/**
 * Public 1-on-1 booking widget (batch-backlog §5 P2). Fetches the trainer's
 * generated open slots, lets a signed-in parent pick a player + slot, and
 * books it (POST /api/trainers/[tenantId]/book → obligation + emails).
 */
export function OneOnOneBooking({
  tenantId,
  title,
  fee,
  slotMinutes,
  currency,
  signedIn,
  players,
  returnPath,
}: {
  tenantId: string
  title: string
  fee: number | null
  slotMinutes: number
  currency: string
  signedIn: boolean
  players: Player[]
  returnPath: string
}) {
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [playerId, setPlayerId] = useState(players.length === 1 ? players[0].id : "")
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/trainers/${tenantId}/slots`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSlots(data?.slots ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantId])

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const iso of slots) {
      const key = format(new Date(iso), "EEE MMM d")
      map.set(key, [...(map.get(key) ?? []), iso])
    }
    return [...map.entries()]
  }, [slots])

  const book = async () => {
    if (!playerId) return setError("Pick a player.")
    if (!selected) return setError("Pick a time.")
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trainers/${tenantId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, startAt: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't book the session")
      setSuccess(format(new Date(selected), "EEE MMM d, h:mm a"))
      setSlots((cur) => cur.filter((s) => s !== selected))
      setSelected(null)
    } catch (e: any) {
      setError(e?.message || "Couldn't book the session.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--brand-line)] bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-ink-900 font-semibold">{title}</p>
          <p className="text-ink-500 text-sm">
            {slotMinutes} min session
            {fee != null && fee > 0 ? ` · ${formatCurrency(fee, currency)}` : fee === 0 ? " · Free" : ""}
          </p>
        </div>
      </div>

      {success && (
        <div className="border-court-200 bg-court-50 text-court-700 mb-3 rounded-xl border p-3 text-sm">
          Booked for <strong>{success}</strong> — check your email for the confirmation.
        </div>
      )}
      {error && (
        <div className="border-hoop-200 text-hoop-700 mb-3 rounded-xl border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-ink-400 text-sm">Loading open times…</p>
      ) : slots.length === 0 ? (
        <p className="text-ink-500 text-sm">
          No open times right now — check back soon.
        </p>
      ) : !signedIn ? (
        <a
          href={`/sign-in?callbackUrl=${encodeURIComponent(returnPath)}`}
          className="bg-play-600 hover:bg-play-700 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in to book a session
        </a>
      ) : players.length === 0 ? (
        <a
          href={`/players/add?redirect=${encodeURIComponent(returnPath)}`}
          className="text-play-700 text-sm font-semibold hover:underline"
        >
          Add your player first &rarr;
        </a>
      ) : (
        <div className="space-y-3">
          {players.length > 1 && (
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="border-ink-200 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none sm:w-64"
            >
              <option value="">Choose a player...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          )}
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {byDay.map(([day, times]) => (
              <div key={day}>
                <p className="text-ink-700 mb-1 text-xs font-semibold uppercase tracking-wide">
                  {day}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {times.map((iso) => (
                    <button
                      key={iso}
                      onClick={() => setSelected(iso === selected ? null : iso)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        selected === iso
                          ? "border-play-600 bg-play-600 text-white"
                          : "border-ink-200 text-ink-700 hover:border-play-400"
                      }`}
                    >
                      {format(new Date(iso), "h:mm a")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={book}
            disabled={submitting || !selected || !playerId}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting
              ? "Booking…"
              : selected
                ? `Book ${format(new Date(selected), "h:mm a")}${fee ? ` (${formatCurrency(fee, currency)})` : ""}`
                : "Pick a time"}
          </button>
        </div>
      )}
    </div>
  )
}
