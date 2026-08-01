"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

interface SimDiff {
  backToBackTeamDays: number
  bigGapTeamDays: number
  splitVenueTeamDays: number
  preferenceViolations: number
  requestViolations: number
  unscheduled: number
}
interface SimResult {
  diff: SimDiff
  requestingTeam: { name: string; after: { ok: number; total: number } | null }
  withRequest: { tradeoffs: string[] }
}

/**
 * Pending schedule requests (owner 2026-08-01): the league sees the COST of
 * approving before deciding — Simulate diffs a full schedule run with and
 * without the request. Best effort either way.
 */
export function ScheduleRequestActions({
  seasonId,
  requestId,
  summary,
}: {
  seasonId: string
  requestId: string
  summary: string
}) {
  const router = useRouter()
  const [sim, setSim] = useState<SimResult | null>(null)
  const [simError, setSimError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"sim" | "approve" | "decline" | null>(null)

  const simulate = async () => {
    setBusy("sim")
    setSimError(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/schedule/simulate-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setSimError(data.error || "Couldn't simulate")
      else setSim(data)
    } finally {
      setBusy(null)
    }
  }

  const decide = async (action: "approve" | "decline") => {
    const note = window.prompt(
      action === "approve"
        ? `Approve "${summary}"? Optional note for the club:`
        : `Decline "${summary}"? Note for the club:`
    )
    if (note === null) return
    setBusy(action)
    try {
      const res = await fetch(`/api/schedule-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        window.alert(data.error || "Couldn't update the request")
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const deltaChip = (label: string, v: number, invert = false) => {
    const bad = invert ? v < 0 : v > 0
    const tone = v === 0 ? "text-ink-500" : bad ? "text-hoop-700" : "text-court-700"
    return (
      <span key={label} className={`${tone} whitespace-nowrap`}>
        {label} {v > 0 ? `+${v}` : v}
      </span>
    )
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={simulate} disabled={busy !== null}>
          {busy === "sim" ? "Simulating…" : "Simulate cost"}
        </Button>
        <Button size="sm" tone="court" onClick={() => decide("approve")} disabled={busy !== null}>
          Approve
        </Button>
        <Button size="sm" variant="subtle" onClick={() => decide("decline")} disabled={busy !== null}>
          Decline
        </Button>
      </div>
      {simError && <p className="text-hoop-700 mt-1 text-xs">{simError}</p>}
      {sim && (
        <div className="border-ink-100 bg-ink-25 mt-2 rounded-lg border p-2 text-xs">
          <p className="text-ink-800 font-medium">
            Cost of approving{" "}
            {Object.values(sim.diff).every((v) => v === 0) ? (
              <span className="text-court-700">— none, everyone else is unaffected.</span>
            ) : (
              <span>— changes vs today&apos;s plan:</span>
            )}
          </p>
          <div className="text-ink-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {deltaChip("unplaced games", sim.diff.unscheduled)}
            {deltaChip("back-to-backs", sim.diff.backToBackTeamDays)}
            {deltaChip("weekend-preference misses", sim.diff.preferenceViolations)}
            {deltaChip("request misses", sim.diff.requestViolations)}
            {deltaChip("two-gym days", sim.diff.splitVenueTeamDays)}
            {deltaChip("big gaps", sim.diff.bigGapTeamDays)}
          </div>
          {sim.requestingTeam.after && (
            <p className="text-ink-600 mt-1">
              {sim.requestingTeam.name} would have {sim.requestingTeam.after.ok} of{" "}
              {sim.requestingTeam.after.total} affected games inside the requested window.
            </p>
          )}
          <p className="text-ink-400 mt-1">
            Best effort — approving doesn&apos;t guarantee the scheduler can always honor it.
          </p>
        </div>
      )}
    </div>
  )
}
