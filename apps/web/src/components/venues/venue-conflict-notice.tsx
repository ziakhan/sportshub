"use client"

import { useEffect, useState } from "react"

interface ConflictResult {
  sameOrg: { title: string }[]
  otherOrgCount: number
  hasAny: boolean
}

/**
 * Non-blocking venue booking advisory. Debounce-checks the venue for
 * overlapping point-in-time bookings once a venue + start time are chosen and
 * shows a soft nudge. Same-org matches name the clashing item; cross-org stays
 * generic (privacy). Never blocks the form — it's a "please confirm", not a gate.
 */
export function VenueConflictNotice({
  venueId,
  startAt,
  durationMinutes,
  tenantId,
  excludeTryoutId,
}: {
  venueId?: string
  startAt?: string
  durationMinutes?: number
  tenantId: string
  excludeTryoutId?: string
}) {
  const [result, setResult] = useState<ConflictResult | null>(null)

  useEffect(() => {
    if (!venueId || !startAt || !tenantId) {
      setResult(null)
      return
    }
    const start = new Date(startAt)
    if (Number.isNaN(start.getTime())) {
      setResult(null)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          start: start.toISOString(),
          duration: String(durationMinutes || 90),
          tenantId,
        })
        if (excludeTryoutId) qs.set("excludeTryoutId", excludeTryoutId)
        const res = await fetch(`/api/venues/${venueId}/conflicts?${qs.toString()}`, {
          signal: ctrl.signal,
        })
        if (!res.ok) {
          setResult(null)
          return
        }
        const data = (await res.json()) as ConflictResult
        setResult(data.hasAny ? data : null)
      } catch {
        // Advisory only — swallow failures.
      }
    }, 400)
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [venueId, startAt, durationMinutes, tenantId, excludeTryoutId])

  if (!result?.hasAny) return null

  const names = result.sameOrg.map((c) => c.title).filter(Boolean).join(", ")

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <span className="font-semibold">Heads up: </span>
        {result.sameOrg.length > 0 && names
          ? `your club already has ${names} at this venue around this time. Double-check before scheduling.`
          : "this venue may already be booked at this time. Please confirm with the venue before scheduling."}
      </span>
    </div>
  )
}
