"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  expectedTeamUpdates,
  planningTeams,
  type PlannerState,
  type PlannerUnit,
} from "@/lib/scheduler/planner-core"
import { PlanChooser, PlanEmptyState, usePlanSession } from "./plan-session"

/**
 * Step 1, teams (owner-approved mock, 2026-08-02). The flow opens where the
 * operator's own summer starts: a guess about how many teams show up, one
 * number per grade. No dates, no venues, no jargon.
 *
 * Three rules the screen is built around:
 *   - last season is a HINT, never a default we quietly commit them to. It
 *     shows only where there is real history, and never as a zero.
 *   - the plan is the operator's estimate and nothing else (owner ruling
 *     2026-08-02: "the planning phase should not be looking at the real teams
 *     until we get to the real scheduling"). Registration is an overlay on
 *     these rows, never a floor under them.
 *   - registration going PAST an estimate is worth a quiet warning, not a
 *     silent bigger plan: that is the gold chip on the row, and the bars on
 *     step 5.
 */

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]
/** Room for the biggest grade any real league runs, with headroom. */
const MAX_PER_GRADE = 200
const SAVE_DEBOUNCE_MS = 600
/** A grade label is a label, not an essay. */
const MAX_GRADE_LABEL = 40

const CHIP = "rounded-full border px-2 py-0.5 text-[11px] font-bold"
const CHIP_QUIET = `${CHIP} border-ink-100 bg-ink-50 text-ink-500`
/** Caution, not failure: the season still works, the operator just planned
 *  for fewer teams than showed up. */
const CHIP_WARN = `${CHIP} border-gold-400 bg-gold-50 text-gold-600`

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
  onLoaded,
}: {
  seasonId: string
  onLoaded?: (info: PlanHeaderInfo) => void
}) {
  /** Which plan the wizard is working in. Chosen here, carried to every step. */
  const session = usePlanSession()
  const [state, setState] = useState<PlannerState | null>(null)
  const [lastSeason, setLastSeason] = useState<Record<string, number> | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [locked, setLocked] = useState(false)
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState<string | null>(null)
  const [newGrade, setNewGrade] = useState("")
  const [addingGrade, setAddingGrade] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

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
    // no-store everywhere in the wizard: the plan is only worth what its
    // numbers are worth, and a cached response is yesterday's.
    const res = await fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(
      () => null
    )
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
    // from zero. A hint, never a floor: nothing is saved, and until it is
    // saved the row says the grade is not in the plan yet.
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
    // The save answers with the whole planner state, so the rows learn which
    // estimates are really saved (and stop saying "not in the plan yet")
    // without a second round trip. Counts stay as typed: the operator may
    // have moved a stepper again while this was in flight.
    const data = await res.json().catch(() => null)
    if (data?.state) {
      const next = data.state as PlannerState
      setState(next)
      unitsRef.current = next.units
    }
    setError(null)
    setSaving("saved")
  }, [seasonId])

  /** Save whatever is pending right now, ahead of anything that reloads the
   *  season from the server. */
  const flushNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await flush()
  }, [flush])

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

  /**
   * One tap that turns the teams already in into an estimate, for the grades
   * that have no estimate at all. Still the operator's decision, and still
   * their number after: a grade they already put a number on is left exactly
   * as they left it, even when more teams than that have registered.
   */
  const startFromRegistrations = () => {
    if (locked || !state) return
    const next = { ...countsRef.current }
    for (const u of state.units) {
      if (u.approved <= 0 || u.expected > 0) continue
      next[u.key] = Math.min(MAX_PER_GRADE, u.approved)
      dirtyRef.current.add(u.key)
    }
    setCounts(next)
    countsRef.current = next
    setSaving("saving")
    void flushNow()
  }

  /**
   * Add a grade without leaving the wizard. Same endpoint the season's
   * settings tab posts to (POST /api/seasons/[id]/divisions), so a grade added
   * here is the same object, named the same derived way. Single birth year
   * (Canada): the field is one label, never a range.
   */
  const addGrade = async () => {
    const ageGroup = newGrade.trim()
    if (!ageGroup || addingGrade || locked) return
    setAddingGrade(true)
    setAddError(null)
    // Anything half-typed into a stepper goes first: the reload below reads
    // the season back and would otherwise drop it.
    await flushNow()
    const res = await fetch(`/api/seasons/${seasonId}/divisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageGroup, tier: 1 }),
    }).catch(() => null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setAddError(data?.error ?? "That grade didn't save. Try again.")
      setAddingGrade(false)
      return
    }
    setNewGrade("")
    await load()
    setAddingGrade(false)
  }

  const totals = useMemo(
    () => ({
      // Same rule the server plans on, so the line matches the plan: the
      // operator's estimate per grade, and only that.
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
  // Grades with teams in and no estimate at all: the season has entries the
  // plan leaves out entirely. One tap fixes every one of them at once.
  const unplanned = state.units.filter((u) => u.approved > 0 && u.expected === 0)
  const allUnplanned = unplanned.length === state.units.length

  return (
    <div className="border-ink-200 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-200 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">How many teams do you expect?</p>
          <p className="text-ink-500 text-xs">
            One number per grade. Pre-filled from last season where there is history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* THE PLAN IS CHOSEN HERE (owner ruling 2026-08-05, #1). Opening or
              creating the plan document is the first move of the walk, not
              something to find on the board three steps later. */}
          <PlanChooser locked={locked} testId="step1-plan-chooser" />
          <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-bold">
            Step 1 of 5
          </span>
        </div>
      </div>

      {/* Nothing open yet: the same two buttons the board offers, at the top of
          the walk where the choice belongs. */}
      {!session.planId && (
        <div className="px-5 pt-5">
          <PlanEmptyState
            locked={locked}
            heading="Which plan are you working in?"
            detail="A plan is one named calendar for this season. Open one of yours, or start a new one and the planner builds a balanced calendar you can change. The numbers below stay editable either way."
            testId="step1-plan-empty"
          />
        </div>
      )}
      {session.planId && (
        <p
          className="border-ink-100 bg-court-50/60 text-court-900 border-b px-5 py-2 text-[12px]"
          data-testid="step1-plan-line"
        >
          Working in <b>{session.chosen?.name ?? "your plan"}</b>. These numbers are the
          season&apos;s own, and every step stays editable.
        </p>
      )}

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

        {/* Entries are in and nothing is planned. Offer the shortcut once,
            as a suggestion the operator commits with one tap. */}
        {!locked && unplanned.length > 0 && (
          <div
            data-testid="start-from-registrations"
            className="border-court-200 bg-court-50 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
          >
            <p className="text-court-900 min-w-0 flex-1 text-sm">
              {allUnplanned
                ? "Teams have registered but no grade has an estimate yet, so the plan is still empty."
                : `${unplanned.length} grade${unplanned.length === 1 ? " has" : "s have"} teams registered and no estimate, so the plan leaves ${unplanned.length === 1 ? "it" : "them"} out.`}{" "}
              Start from the teams already in, then change any number.
            </p>
            <button
              type="button"
              onClick={startFromRegistrations}
              className="border-court-300 text-court-900 hover:bg-court-100 hover:border-court-400 inline-flex min-h-[36px] shrink-0 cursor-pointer items-center rounded-lg border bg-white px-3 text-xs font-bold transition-colors"
            >
              Start from registrations
            </button>
          </div>
        )}

        {state.units.length === 0 ? (
          <div className="border-ink-200 rounded-xl border border-dashed px-4 py-6 text-center">
            <p className="text-ink-500 text-sm">
              This season has no grades yet. Add one below and it shows up here as a row.
            </p>
            {/* No door out of planning here (owner ruling 2026-08-03, phase
                separation): the field that fixes this is on this screen, and
                sending an operator into the season console mid-plan is how
                they end up on a schedule they have not built yet. */}
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
                // What this grade actually plans on, the way the server reads
                // it: the operator's estimate. Growth is measured against that.
                const planned = planningTeams(unit.approved, value)
                // More teams came than were planned for. Not an error, and it
                // does not quietly grow the plan: the operator decides whether
                // to raise the number.
                const over = unit.approved > value
                // The saved estimate is still zero, so this grade asks for no
                // games yet, whatever the stepper is showing.
                const notPlanned = unit.expected === 0
                return (
                  <tr key={unit.key} className="border-ink-100 border-t">
                    <td className="text-ink-900 py-2.5 pr-4 text-sm font-bold">{unit.label}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        role="group"
                        aria-label={`Expected teams for ${unit.label}`}
                        className="border-ink-300 inline-flex h-9 items-center rounded-lg border bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          disabled={locked || value <= 0}
                          onClick={() => bump(unit, -1)}
                          aria-label={`One fewer ${unit.label} team`}
                          className="text-ink-700 hover:bg-ink-100 hover:text-ink-900 h-full w-9 cursor-pointer rounded-l-lg text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
                          className="text-ink-700 hover:bg-ink-100 hover:text-ink-900 h-full w-9 cursor-pointer rounded-r-lg text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Planning currency, and nothing else: what this
                            grade asks the season for. Not a link to its
                            games — those do not exist yet, and this is the
                            planning phase (owner ruling 2026-08-03). */}
                        {planned > 0 && totals.gamesPerTeam > 0 && (
                          <span data-testid="grade-games" className={CHIP_QUIET}>
                            {Math.round((planned * totals.gamesPerTeam) / 2)} games
                          </span>
                        )}
                        {unit.approved > 0 && (
                          <span
                            data-testid="registered-chip"
                            data-over={over ? "1" : "0"}
                            className={over ? CHIP_WARN : CHIP_QUIET}
                          >
                            {over
                              ? `${unit.approved} registered, over the estimate`
                              : `${unit.approved} registered`}
                          </span>
                        )}
                        {notPlanned && (
                          <span data-testid="not-planned" className="text-ink-400 text-xs">
                            Not in the plan yet
                          </span>
                        )}
                        {history !== undefined && (
                          <span className="text-ink-400 text-xs">
                            {history} last season
                            {planned > history ? " · growing" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Add a grade here rather than sending the operator to a settings
            tab mid-plan. Same endpoint the settings tab uses. */}
        {!locked && (
          <div className="border-ink-100 mt-4 border-t pt-4">
            <label
              htmlFor="add-grade"
              className="text-ink-500 text-[11px] font-bold uppercase tracking-wide"
            >
              Add a grade
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                id="add-grade"
                value={newGrade}
                maxLength={MAX_GRADE_LABEL}
                placeholder="Grade 4"
                onChange={(e) => setNewGrade(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void addGrade()
                  }
                }}
                className="border-ink-200 focus:border-play-500 text-ink-900 h-9 w-40 rounded-lg border px-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => void addGrade()}
                disabled={!newGrade.trim() || addingGrade}
                className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex h-9 cursor-pointer items-center rounded-lg border bg-white px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                {addingGrade ? "Adding…" : "Add"}
              </button>
              <span className="text-ink-400 text-xs">One grade per row, counting from zero.</span>
            </div>
            {addError && <p className="text-hoop-700 mt-1.5 text-xs">{addError}</p>}
          </div>
        )}

        {anyApproved && (
          <p className="text-ink-400 mt-3 text-xs">
            Planning runs on your numbers. Teams that sign up past a grade&apos;s estimate show up
            here and on the step 5 bars, so you can raise the number or leave it.
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
