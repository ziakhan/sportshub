"use client"

import { useEffect, useState } from "react"

/**
 * Schedule readiness (owner ruling 2026-08-07: the one-button preflight
 * inside Generate now owns "can you run this" — Preview just tries and
 * shows what's wrong). All this keeps is a single thin line for the one
 * case the preflight can't self-diagnose before a run: the season isn't
 * finalized, a division is too thin, or sessions/capacity aren't there
 * yet. Nothing to say when ready means nothing renders.
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
  const [cap, setCap] = useState<{
    needed: number
    provided: number
    sessions: number
    running: number
  } | null>(null)

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
          // Honest denominator (owner ruling 7, 2026-08-07): this report is
          // already REGULAR-phase only, but a session row can still exist
          // with no gym attached yet. "Running" = it actually has courts —
          // the only count worth putting in front of the operator.
          running: sessions.filter((s) => (s.courts ?? 0) > 0).length,
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
  // Nothing loading, nothing wrong, or still loading: say nothing — the
  // preflight inside Generate carries the "can you run this" words now.
  if (ready || (!cap && blockers.length === 0)) return null

  return (
    <p className="text-amber-700 text-xs">
      Not ready to generate yet: {blockers.join(" · ")}
    </p>
  )
}
