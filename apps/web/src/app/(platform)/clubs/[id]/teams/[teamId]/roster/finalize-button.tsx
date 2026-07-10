"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

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
      <div className="bg-ink-950/50 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="reveal w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl">
          <h3 className="font-condensed text-court-700 mb-3 text-xl font-bold uppercase tracking-wide">
            Roster Finalized!
          </h3>
          <div className="space-y-2">
            {result.assignments.map((a, i) => (
              <div
                key={i}
                className="reveal bg-court-50 flex items-center justify-between rounded-xl px-3 py-2 text-sm"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="font-medium">{a.playerName}</span>
                {a.jerseyNumber !== null ? (
                  <span className="font-condensed rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-sm font-bold text-[color:var(--brand-ink)]">
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
    return <Button onClick={() => setShowConfirm(true)}>Finalize Roster</Button>
  }

  return (
    <div className="bg-ink-950/50 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="reveal w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl">
        <h3 className="font-condensed text-ink-950 mb-2 text-xl font-bold uppercase tracking-wide">
          Finalize {teamName} Roster?
        </h3>
        <p className="text-ink-600 mb-4 text-sm">
          This will assign jersey numbers based on player preferences (first-come, first-served) and
          expire all remaining pending offers.
        </p>

        {error && (
          <div className="text-hoop-700 border-hoop-200 mb-4 rounded-xl border bg-red-50 p-3 text-sm">{error}</div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="subtle" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button onClick={handleFinalize} disabled={isSubmitting}>
            {isSubmitting ? "Finalizing..." : "Confirm & Finalize"}
          </Button>
        </div>
      </div>
    </div>
  )
}
