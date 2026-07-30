"use client"

import { useEffect, useState } from "react"

/**
 * Schedule readiness — answers ONE question in plain words at the top of
 * the Schedule tab (owner 2026-07-30): "can you generate the season's
 * schedule right now?" ✓ yes, or ✗ with exactly what's in the way.
 * Regular-season sessions only; playoff weekends are separate machinery.
 */
export function ScheduleReadiness({
  seasonId,
  league,
  divisions,
  scheduleGamesCount,
}: {
  seasonId: string
  league: any
  divisions: any[]
  scheduleGamesCount: number
}) {
  const [cap, setCap] = useState<{ needed: number; provided: number; sessions: number } | null>(
    null
  )

  useEffect(() => {
    let alive = true
    fetch(`/api/seasons/${seasonId}/schedule/capacity`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data?.sessions) return
        const sessions: any[] = data.sessions
        setCap({
          needed: sessions.reduce((sum, s) => sum + (s.gamesNeededAll ?? 0), 0),
          provided: sessions.reduce((sum, s) => sum + (s.slotsTotal ?? 0), 0),
          sessions: sessions.length,
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [seasonId, scheduleGamesCount])

  const status: string = league?.leagueStatus ?? "DRAFT"
  const finalized = ["FINALIZED", "IN_PROGRESS", "COMPLETED"].includes(status)
  const thinDivisions = divisions.filter((d: any) => (d._count?.teams ?? 0) < 2)

  const blockers: string[] = []
  if (!finalized)
    blockers.push(
      status === "REGISTRATION_CLOSED"
        ? "the season isn't finalized yet (finalize from the checklist on Overview)"
        : "registration is still open — close and finalize first (checklist on Overview)"
    )
  if (thinDivisions.length > 0)
    blockers.push(
      `${thinDivisions.map((d: any) => d.name).join(", ")} ${thinDivisions.length === 1 ? "has" : "have"} fewer than 2 teams`
    )
  if (cap && cap.needed > 0 && cap.provided < cap.needed)
    blockers.push(
      `your sessions provide ${cap.provided} game slots but ${cap.needed} are needed — add days or courts below`
    )
  if (cap && cap.sessions === 0) blockers.push("no regular-season sessions exist yet")

  const ready = blockers.length === 0 && cap !== null
  if (!cap && blockers.length === 0) return null // still loading

  return (
    <div
      className={`reveal rounded-2xl border p-4 ${
        ready ? "border-court-200 bg-court-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      {ready ? (
        <p className="text-ink-900 text-sm">
          <span className="text-court-700 font-bold">✓ You can generate the season&apos;s
          schedule.</span>{" "}
          <span className="text-ink-600">
            Your {cap!.sessions} regular-season session{cap!.sessions === 1 ? "" : "s"} provide{" "}
            {cap!.provided} game slots for the {cap!.needed} needed
            {scheduleGamesCount > 0
              ? ` · ${scheduleGamesCount} game${scheduleGamesCount === 1 ? "" : "s"} committed so far`
              : ""}
            .
          </span>
        </p>
      ) : (
        <div className="text-sm">
          <p className="text-amber-800 font-bold">✗ Not ready to generate the full schedule yet:</p>
          <ul className="text-amber-700 mt-1 list-inside list-disc space-y-0.5 text-xs">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
