"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function FinalizeButton({
  teamId,
  teamName,
}: {
  teamId: string
  teamName: string
}) {
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
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-green-700 mb-3">
            Roster Finalized!
          </h3>
          <div className="space-y-2">
            {result.assignments.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{a.playerName}</span>
                {a.jerseyNumber !== null ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                    #{a.jerseyNumber}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">No preference available</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
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
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
      >
        Finalize Roster
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Finalize {teamName} Roster?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          This will assign jersey numbers based on player preferences (first-come, first-served)
          and expire all remaining pending offers.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleFinalize}
            disabled={isSubmitting}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? "Finalizing..." : "Confirm & Finalize"}
          </button>
        </div>
      </div>
    </div>
  )
}
