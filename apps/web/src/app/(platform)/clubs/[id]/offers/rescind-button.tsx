"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/** Club-side withdraw of a PENDING offer (editability audit wave 2). */
export function RescindButton({ offerId, playerName }: { offerId: string; playerName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const rescind = async () => {
    if (
      !window.confirm(
        `Withdraw the offer to ${playerName}? The family will be notified and can no longer accept it.`
      )
    )
      return
    setBusy(true)
    try {
      const res = await fetch(`/api/offers/${offerId}/rescind`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        window.alert(data.error || "Couldn't rescind the offer")
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={rescind}
      disabled={busy}
      className="border-ink-200 text-hoop-700 hover:border-hoop-200 hover:bg-hoop-50 inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1 text-xs font-semibold transition disabled:opacity-50"
      title="Withdraw this offer"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
        <circle cx="12" cy="12" r="10" />
        <path d="M4.9 4.9l14.2 14.2" />
      </svg>
      {busy ? "..." : "Rescind"}
    </button>
  )
}
