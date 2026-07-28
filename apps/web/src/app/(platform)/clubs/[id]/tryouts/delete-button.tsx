"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface DeleteButtonProps {
  tryoutId: string
  title: string
  registrationCount: number
}

/**
 * Program deletion with a consequences flow (owner ruling 2026-07-24,
 * QA-204): deleting is allowed even with active registrations — the confirm
 * dialog spells out what happens instead of the button being locked away.
 */
export function DeleteButton({ tryoutId, title, registrationCount }: DeleteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${title}"? This permanently removes the program and its ${registrationCount} registration${registrationCount === 1 ? "" : "s"}. Every registered family is notified. Unpaid fees are cancelled automatically. If families already PAID through the platform, you must process their refunds. If you collected money outside the platform (cash/e-transfer), refunding those families is your responsibility — the platform takes no part in offline payments. This cannot be undone.`
    )
    if (!confirmed) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tryouts/${tryoutId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't delete the tryout.")
      }
      router.refresh()
    } catch (e: any) {
      setError(e?.message || "Couldn't delete the tryout.")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="text-sm text-red-500 hover:text-hoop-700 disabled:opacity-50"
      >
        {loading ? "..." : "Delete"}
      </button>
      {error && <p className="text-hoop-600 text-xs">{error}</p>}
    </div>
  )
}
