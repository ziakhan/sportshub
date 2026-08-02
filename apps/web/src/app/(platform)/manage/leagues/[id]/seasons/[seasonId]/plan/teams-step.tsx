"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  expectedTeamUpdates,
  planningTeams,
  type PlannerState,
  type PlannerUnit,
} from "@/lib/scheduler/planner-core"

/**
 * Step 1, teams (owner-approved mock, 2026-08-02). The flow opens where the
 * operator's own summer starts: a guess about how many teams show up, one
 * number per grade. No dates, no venues, no jargon.
 *
 * Two rules the screen is built around:
 *   - last season is a HINT, never a default we quietly commit them to. It
 *     shows only where there is real history, and never as a zero.
 *   - planning is the operator's call (owner ruling 2026-08-02). Every grade
 *     stays editable while the season is unlocked, registered or not; the
 *     plan then runs on their number and never below what has registered
 *     (planningTeams), so a grade that fills up keeps its real floor.
 */

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]
/** Room for the biggest grade any real league runs, with headroom. */
const MAX_PER_GRADE = 200
const SAVE_DEBOUNCE_MS = 600

export interface PlanHeaderInfo {
  leagueName?: string | null
  seasonLabel?: string | null
}

/** "1,020" — big estimates read friendlier on a round number, and "about"
 *  is honest about the rounding. Small ones stay exact. */
function friendlyGames(games: number): string {
  const rounded = games >= 200 ? Math.floor(games / 10) * 10 : games
  return rounded.toLocaleString("en-CA")
}

export function TeamsStep({
  seasonId,
  leagueId,
  onLoaded,
}: {
  seasonId: string
  leagueId: string
  onLoaded?: (info: PlanHeaderInfo) => void
}) {
  const [state, setState] = useState<PlannerState | null>(null)
  const [lastSeason, setLastSeason] = useState<Record<string, number> | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [locked, setLocked] = useState(false)
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState<string | null>(null)

  // Refs so the debounced save always sends the LATEST numbers without
  // re-arming itself on every keystroke of the stepper.
  const countsRef = useRef(counts)
  const unitsRef = useRef<PlannerUnit[]>([])
  const dirtyRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    countsRef.current = counts
  }, [counts])

  const load = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/planner`).catch(() => null)
    if (!res?.ok) {
      setError("Couldn't load your grades")
      return
    }
    const data = await res.json()
    const next: PlannerState = data.state
    setState(next)
    unitsRef.current = next.units
    // The stepper edits the ESTIMATE. A grade that never got one starts from
    // the teams already registered, so + counts up from reality instead of
    // from zero — seeded only, never saved until the operator moves it.
    const seeded = Object.fromEntries(
      next.units.map((u) => [u.key, u.expected > 0 ? u.expected : u.approved])
    )
    setCounts(seeded)
    countsRef.current = seeded
    setLastSeason(data.lastSeasonTeams ?? null)
    setLocked(LOCKED_STATUSES.includes(data.seasonStatus))
    onLoaded?.({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })
  }, [seasonId, onLoaded])

  useEffect(() => {
    load()
  }, [load])

  /** Send every grade touched since the last flush. A grade cluster can span
   *  several divisions, so each one expands to per-division rows the way the
   *  planner board saves them. */
  const flush = useCallback(async () => {
    const keys = [...dirtyRef.current]
    dirtyRef.current.clear()
    const updates = keys.flatMap((key) => {
      const unit = unitsRef.current.find((u) => u.key === key)
      return unit ? expectedTeamUpdates(unit.divisionIds, countsRef.current[key] ?? 0) : []
    })
    if (updates.length === 0) return
    const res = await fetch(`/api/seasons/${seasonId}/planner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected: updates }),
    }).catch(() => null)
    if (!res?.ok) {
      setSaving("idle")
      setError("That didn't save. Try again.")
      return
    }
    setError(null)
    setSaving("saved")
  }, [seasonId])

  // A pending change must not die with the screen when the operator jumps
  // straight to step 2.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        void flush()
      }
    },
    [flush]
  )

  const bump = (unit: PlannerUnit, delta: number) => {
    if (locked) return
    setCounts((prev) => {
      const now = Math.min(MAX_PER_GRADE, Math.max(0, (prev[unit.key] ?? 0) + delta))
      return { ...prev, [unit.key]: now }
    })
    dirtyRef.current.add(unit.key)
    setSaving("saving")
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void flush()
    }, SAVE_DEBOUNCE_MS)
  }

  const totals = useMemo(
    () => ({
      // Same rule the server plans on, so the line matches the plan: the
      // operator's number per grade, floored at the teams already in.
      teams: (state?.units ?? []).reduce(
        (sum, u) => sum + planningTeams(u.approved, counts[u.key] ?? 0),
        0
      ),
      // The season's promise to a team, straight off the planner state.
      gamesPerTeam: state?.gamesPerTeam ?? 0,
    }),
    [state, counts]
  )

  if (!state) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Loading your grades…"}</p>
  }

  const games = Math.round((totals.teams * totals.gamesPerTeam) / 2)
  const anyApproved = state.units.some((u) => u.approved > 0)

  return (
    <div className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">How many teams do you expect?</p>
          <p className="text-ink-500 text-xs">
            One number per grade. Pre-filled from last season where there is history.
          </p>
        </div>
        <span className="border-ink-100 bg-ink-50 text-ink-500 rounded-full border px-2.5 py-0.5 text-[11px] font-bold">
          Step 1 of 5
        </span>
      </div>

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so team counts are read only now.
          </p>
        )}
        {error && (
          <p className="border-hoop-200 bg-hoop-50 text-hoop-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {error}
          </p>
        )}

        {state.units.length === 0 ? (
          <div className="border-ink-200 rounded-xl border border-dashed px-4 py-6 text-center">
            <p className="text-ink-500 text-sm">
              This season has no grades yet. Add them once and every grade shows up here as a
              row.
            </p>
            <Link
              href={`/manage/leagues/${leagueId}/seasons/${seasonId}/manage?tab=settings#divisions`}
              className="text-play-700 hover:text-play-800 mt-2 inline-block text-sm font-semibold"
            >
              Add your grades →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-ink-500 text-[11px] font-bold uppercase tracking-wide">
                <th scope="col" className="pb-2 text-left">
                  Grade
                </th>
                <th scope="col" className="pb-2 text-left">
                  Expected teams
                </th>
                <th scope="col" className="pb-2 text-left" />
              </tr>
            </thead>
            <tbody>
              {state.units.map((unit) => {
                const value = counts[unit.key] ?? 0
                // Units are grade clusters keyed "age:<ageGroup>", which is
                // exactly how last season's counts come back.
                const ageGroup = unit.key.startsWith("age:") ? unit.key.slice(4) : unit.label
                const history = lastSeason?.[ageGroup]
                // What this grade actually plans on, the way the server
                // reads it: growth is measured against that, not against a
                // number the season has already outgrown.
                const planned = planningTeams(unit.approved, value)
                return (
                  <tr key={unit.key} className="border-ink-100 border-t">
                    <td className="text-ink-900 py-2.5 pr-4 text-sm font-bold">{unit.label}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        role="group"
                        aria-label={`Expected teams for ${unit.label}`}
                        className="border-ink-200 bg-ink-50 inline-flex h-9 items-center rounded-lg border"
                      >
                        <button
                          type="button"
                          disabled={locked || value <= 0}
                          onClick={() => bump(unit, -1)}
                          aria-label={`One fewer ${unit.label} team`}
                          className="text-ink-700 hover:text-ink-900 h-full w-9 text-base font-bold disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          −
                        </button>
                        <b
                          aria-live="polite"
                          className="text-ink-900 min-w-[34px] text-center text-sm tabular-nums"
                        >
                          {value}
                        </b>
                        <button
                          type="button"
                          disabled={locked || value >= MAX_PER_GRADE}
                          onClick={() => bump(unit, 1)}
                          aria-label={`One more ${unit.label} team`}
                          className="text-ink-700 hover:text-ink-900 h-full w-9 text-base font-bold disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="text-ink-400 py-2.5 text-xs">
                      {[
                        unit.approved > 0 ? `${unit.approved} registered` : null,
                        history !== undefined ? `${history} last season` : null,
                        history !== undefined && planned > history ? "growing" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {anyApproved && (
          <p className="text-ink-400 mt-3 text-xs">
            Planning uses your number, and never less than the teams already registered.
          </p>
        )}

        {/* The one line that turns the numbers into a season. */}
        {state.units.length > 0 && (
          <div className="border-court-200 bg-court-50 text-court-900 mt-4 rounded-xl border px-4 py-3 text-sm">
            <b>
              {totals.teams} team{totals.teams === 1 ? "" : "s"}
              {totals.gamesPerTeam > 0 && games > 0
                ? ` · about ${friendlyGames(games)} game${games === 1 ? "" : "s"}`
                : ""}
            </b>
            {totals.gamesPerTeam > 0 && games > 0
              ? ` at ${totals.gamesPerTeam} game${totals.gamesPerTeam === 1 ? "" : "s"} each.`
              : "."}{" "}
            Next we&apos;ll find the gym time to hold them.
          </div>
        )}

        <p className="text-ink-400 mt-3 h-4 text-xs" aria-live="polite">
          {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved." : ""}
        </p>
      </div>
    </div>
  )
}
