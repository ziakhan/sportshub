"use client"

// Tiny staff action next to an "unsigned" waiver chip: push + email the
// family fresh signing links right now (owner 2026-07-20 — the game-day
// nudge instead of a hard block).

import { useState } from "react"

export function RemindWaiverButton({
  playerId,
  seasonId,
  tenantId,
}: {
  playerId: string
  seasonId?: string
  tenantId?: string
}) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle")

  async function remind() {
    if (state === "busy" || state === "sent") return
    setState("busy")
    try {
      const res = await fetch("/api/waivers/remind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, seasonId, tenantId }),
      })
      setState(res.ok ? "sent" : "error")
      if (res.ok) setTimeout(() => setState("idle"), 4000)
    } catch {
      setState("error")
    }
  }

  return (
    <button
      type="button"
      onClick={remind}
      disabled={state === "busy"}
      title="Send the family a push notification and email with the signing link"
      className={`ml-2 rounded-lg border px-2 py-0.5 text-xs font-semibold transition ${
        state === "sent"
          ? "border-court-200 bg-court-50 text-court-700"
          : state === "error"
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-800"
      }`}
    >
      {state === "busy" ? "Sending..." : state === "sent" ? "Sent ✓" : state === "error" ? "Retry" : "Remind"}
    </button>
  )
}
