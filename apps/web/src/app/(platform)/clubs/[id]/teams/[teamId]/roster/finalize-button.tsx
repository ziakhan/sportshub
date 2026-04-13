"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function FinalizeButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    assignments: { playerName: string; jerseyNumber: number | null; status: string }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFinalize = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/teams/${teamId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to finalize")
      }

      setResult(data)
      setTimeout(() => router.refresh(), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 className="text-court-700 mb-3 text-lg font-semibold">Roster Finalized!</h3>
          <div className="space-y-2">
            {result.assignments.map((a, i) => (
              <div
                key={i}
                className="bg-court-50 flex items-center justify-between rounded-xl px-3 py-2 text-sm"
              >
                <span className="font-medium">{a.playerName}</span>
                {a.jerseyNumber !== null ? (
                  <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-xs font-bold">
                    #{a.jerseyNumber}
                  </span>
                ) : (
                  <span className="text-ink-500 text-xs">No preference available</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-ink-500 mt-3 text-xs">
            All remaining pending offers have been expired. Page will refresh shortly.
          </p>
        </div>
      </div>
    )
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
      >
        Finalize Roster
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-ink-900 mb-2 text-lg font-semibold">Finalize {teamName} Roster?</h3>
        <p className="text-ink-600 mb-4 text-sm">
          This will assign jersey numbers based on player preferences (first-come, first-served) and
          expire all remaining pending offers.
        </p>

        {error && (
          <div className="text-hoop-700 mb-4 rounded-xl bg-red-50 p-3 text-sm">{error}</div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleFinalize}
            disabled={isSubmitting}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Finalizing..." : "Confirm & Finalize"}
          </button>
        </div>
      </div>
    </div>
  )
}
