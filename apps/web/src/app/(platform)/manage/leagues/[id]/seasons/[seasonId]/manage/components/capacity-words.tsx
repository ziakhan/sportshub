"use client"

import { useEffect, useState } from "react"

/**
 * Capacity math IN WORDS (IA redesign §5.3) — sits at the very top of the
 * Schedule tab, before any buttons: "you need N slots, sessions provide M,
 * ✓/✗" in plain sentences, so the planner numbers below have context.
 */
export function CapacityWords({
  seasonId,
  league,
  scheduleGamesCount,
}: {
  seasonId: string
  league: any
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
        if (!alive || !data?.sessions?.length) return
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

  if (!cap) return null

  const approvedTeams = (league?.teams ?? []).filter((t: any) => t.status === "APPROVED").length
  const games = league?.gamesGuaranteed
  const fits = cap.provided >= cap.needed
  const spare = cap.provided - cap.needed

  return (
    <div
      className={`reveal mb-6 rounded-2xl border p-4 ${
        fits ? "border-court-200 bg-court-50" : "border-hoop-200 bg-hoop-50"
      }`}
    >
      <p className="text-ink-900 text-sm">
        <span className="mr-1.5">{fits ? "✓" : "✗"}</span>
        You need <span className="font-bold">{cap.needed} game slots</span>
        {approvedTeams > 0 && games ? (
          <span className="text-ink-600">
            {" "}
            ({approvedTeams} approved teams × {games} games each, two teams per game)
          </span>
        ) : null}
        . Your {cap.sessions} session{cap.sessions === 1 ? "" : "s"} currently provide{" "}
        <span className="font-bold">{cap.provided}</span>.{" "}
        {fits ? (
          <span className="text-court-700 font-semibold">
            That fits{spare > 0 ? ` with ${spare} slot${spare === 1 ? "" : "s"} to spare` : " exactly"}.
          </span>
        ) : (
          <span className="text-hoop-700 font-semibold">
            You are {-spare} slot{spare === -1 ? "" : "s"} short — add session days, courts or
            venues below.
          </span>
        )}
      </p>
      <p className="text-ink-500 mt-1 text-xs">
        The per-session breakdown further down shows where the slots come from and lets you
        leave a division out of a session.
      </p>
    </div>
  )
}
