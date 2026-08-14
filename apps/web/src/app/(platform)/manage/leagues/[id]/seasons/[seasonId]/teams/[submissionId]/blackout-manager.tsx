"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, DateTimePicker } from "@/components/ui"

/**
 * League-direct blackout dates (owner 2026-08-01): mark days a team can't
 * play — no request needed. Rows created by an approved request are tagged.
 */
export function BlackoutManager({
  seasonId,
  submissionId,
  blackouts,
}: {
  seasonId: string
  submissionId: string
  blackouts: Array<{
    id: string
    date: string
    startTime: string | null
    endTime: string | null
    reason: string | null
    fromRequest: boolean
  }>
}) {
  const router = useRouter()
  const [date, setDate] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!date) return
    setBusy(true)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/teams/${submissionId}/blackouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason: reason || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        window.alert(data.error || "Couldn't add the blackout")
        return
      }
      setDate("")
      setReason("")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm("Remove this blackout? The scheduler may book games on that day again.")) return
    const res = await fetch(`/api/seasons/${seasonId}/teams/${submissionId}/blackouts/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't remove the blackout")
      return
    }
    router.refresh()
  }

  return (
    <div>
      {blackouts.length === 0 ? (
        <p className="text-ink-500 text-sm">No blackout dates.</p>
      ) : (
        <ul className="space-y-1">
          {blackouts.map((b) => (
            <li key={b.id} className="text-ink-700 flex items-center gap-2 text-sm">
              <span>
                {new Date(b.date).toLocaleDateString("en-CA", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
                {b.startTime && b.endTime ? ` · ${b.startTime}–${b.endTime}` : ""}
                {b.reason ? ` — ${b.reason}` : ""}
              </span>
              {b.fromRequest && (
                <span className="bg-ink-100 text-ink-500 rounded px-1.5 py-0.5 text-[10px] uppercase">
                  via request
                </span>
              )}
              <button
                onClick={() => remove(b.id)}
                className="text-hoop-600 cursor-pointer text-xs hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DateTimePicker
          mode="date"
          value={date}
          onChange={setDate}
          className="w-36"
        />
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="border-ink-200 rounded-lg border px-2 py-1 text-xs"
        />
        <Button size="sm" variant="secondary" onClick={add} disabled={busy || !date}>
          Add blackout
        </Button>
      </div>
    </div>
  )
}
