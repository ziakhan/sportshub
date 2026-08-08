"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  currentAssignment,
  gradeAbbrev,
  overPlanSentence,
  registrationBars,
  weekendsNeedingAttention,
  type PlannerState,
  type PlannerSuggestion,
} from "@/lib/scheduler/planner-core"
import type { PlanHeaderInfo } from "./teams-step"
import { BTN_MD, BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, BTN_SM } from "./plan-shared"
import { NoticeSlot } from "./plan-ui"
import { PlanStepPointer, usePlanSession } from "./plan-session"

/**
 * Step 5, schedule (owner-approved mock, 2026-08-02). Scheduling is the
 * follow-through, not a second product, so this step is a watch screen first:
 * real sign-ups against the step-1 estimate, one bar per grade, updating
 * while registration runs.
 *
 * The rule the screen is built around: the moment actuals break a weekend it
 * says so, in October, while a court can still be booked. The numbers behind
 * that are the same ones the calendar board uses, and the sentences are the
 * ones the planner already writes, so amber here means what amber means
 * there.
 *
 * Generating is one press now (owner ruling 2026-08-07, THE ONE BUTTON): the
 * button applies the open plan to the season and builds the schedule in the
 * same call, then lands on the summary screen this season already has. No
 * second door — with no plan open there is nothing yet to press, so the
 * screen points back to where one is chosen instead of offering a shortcut
 * that skips it.
 */

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

/** Registration moves in hours, not seconds. Half a minute is live enough to
 *  be true and quiet enough to cost nothing. */
const POLL_MS = 30_000

/** How many alert sentences show before the rest go behind "See options". */
const ALERT_PREVIEW = 2

// Real apostrophes live here as JS expressions, so nothing needs escaping.
const COPY = {
  locked:
    "This season is finalized, so the plan behind these bars is read only. Scheduling still runs from here.",
  noGrades:
    "There is nothing to watch yet. Say how many teams you expect in step 1 and every grade shows up here as a bar.",
  noEstimate:
    "This season never saved an estimate, so nothing is planned for these grades yet. These bars are the teams that registered. Set a number per grade in step 1 and the plan follows it.",
  waiting:
    "You can wait for entries to lock, or use this calendar now with the teams already in. Either way the gyms, hours, weekends and groupings come from steps 2 and 3.",
  ready:
    "Your grades are at or past what you planned for. One button turns everything already entered into a schedule.",
  final:
    "Entries for this season are closed. Everything the scheduler needs is already here: gyms, hours, weekends and groupings.",
  noPlan:
    "No weekend holds a grade yet, so there is nothing here to measure against. Build the calendar in step 3 and keep it, then this screen watches it.",
  noPlanLocked:
    "This season was finalized without a kept calendar, so there is nothing here to measure against. These bars are the teams that registered.",
  reuse: "uses your plan, nothing to re-enter",
  footer:
    "Generating writes the games straight onto this season and lands you on the summary screen you already have for reading them.",
}

const clockTime = (at: number) =>
  new Date(at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })

export function ScheduleStep({
  seasonId,
  leagueId,
  onLoaded,
  onGoToStep,
}: {
  seasonId: string
  leagueId: string
  onLoaded?: (info: PlanHeaderInfo) => void
  onGoToStep?: (step: number) => void
}) {
  const [state, setState] = useState<PlannerState | null>(null)
  const [suggestions, setSuggestions] = useState<PlannerSuggestion[]>([])
  const [locked, setLocked] = useState(false)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  // THE ONE BUTTON (owner ruling 2026-08-07, #3): which plan this wizard
  // visit has open, so the button knows what to press "use" onto the season.
  const { planId } = usePlanSession()
  const [genBusy, setGenBusy] = useState(false)

  // The page header is named once. A poll every half minute must not hand it
  // a fresh object and re-render the whole wizard for nothing.
  const namedRef = useRef(false)

  const load = useCallback(async () => {
    // no-store: this screen polls to be true about right now, so a cached
    // response would be the one thing it cannot afford.
    const res = await fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(
      () => null
    )
    if (!res?.ok) {
      setError("Couldn't load your registration")
      return
    }
    const data = await res.json()
    setState(data.state)
    // The rail's sentences, computed by the planner on the saved plan.
    setSuggestions(data.suggestions ?? [])
    setLocked(LOCKED_STATUSES.includes(data.seasonStatus))
    setCheckedAt(Date.now())
    setError(null)
    if (!namedRef.current) {
      namedRef.current = true
      onLoaded?.({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })
    }
  }, [seasonId, onLoaded])

  useEffect(() => {
    load()
  }, [load])

  /** "Updating live as teams sign up": a light poll while the operator is
   *  actually looking at it, and an immediate refresh when they come back to
   *  the tab rather than a stale screen for up to half a minute. A finalized
   *  season has nothing left to sign up, so it is not polled at all. */
  useEffect(() => {
    if (locked) return
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load, locked])

  /**
   * THE ONE BUTTON, pressed (owner ruling 2026-08-07, #3 and #5). One POST
   * makes the open plan the season and builds its schedule; the only thing it
   * may ask first is the two sufficiency questions the preflight already
   * checked against what this board showed. `confirmed` is the SECOND call,
   * made only after the operator has read those sentences and said "anyway".
   */
  const runGenerate = useCallback(
    async (confirmed: boolean) => {
      if (!planId) return
      setGenBusy(true)
      setError(null)
      const res = await fetch(`/api/seasons/${seasonId}/plans/${planId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmed ? { confirm: true } : {}),
      }).catch(() => null)
      const data = res ? await res.json().catch(() => null) : null
      if (!res?.ok) {
        setGenBusy(false)
        // The auditor's findings ARE the product's voice (v2 contract):
        // plain words, real arithmetic, concrete options — never swallowed
        // behind a generic line.
        const details = Array.isArray(data?.errors) ? (data.errors as string[]) : []
        setError(
          details.length > 0
            ? details.join("\n")
            : (data?.error ?? "Couldn't generate the schedule. Try again.")
        )
        return
      }
      if (data?.needsConfirm) {
        setGenBusy(false)
        const findings = (data.findings ?? []) as string[]
        if (window.confirm(`${findings.join("\n")}\n\nGenerate anyway?`)) void runGenerate(true)
        return
      }
      // A hard navigation: the summary screen needs the games this call just
      // wrote, not whatever a client cache remembers from before it ran.
      window.location.href = `/manage/leagues/${leagueId}/seasons/${seasonId}/manage?tab=schedule`
    },
    [planId, seasonId, leagueId]
  )

  const bars = useMemo(() => registrationBars(state?.units ?? []), [state])
  const attention = useMemo(
    () => (state ? weekendsNeedingAttention(state, currentAssignment(state)) : []),
    [state]
  )
  const lead = useMemo(() => overPlanSentence(bars), [bars])

  /**
   * A saved calendar where no weekend holds a grade has zero demand, so every
   * weekend reads comfortable and the pill went green while step 3 was
   * showing the proposal in red. That green was a lie: there is no plan yet.
   * Grades with teams and nothing kept means "not started", not "on plan".
   */
  const noCalendar = useMemo(() => {
    if (!state) return false
    const assignment = currentAssignment(state)
    const kept = Object.values(assignment).some((keys) => keys.length > 0)
    return !kept && state.units.some((u) => u.teams > 0)
  }, [state])

  /** What the operator should do about it, in the planner's own words. A
   *  weekend the rail had nothing to add about still gets its numbers said
   *  out loud: being one game from full IS the news. */
  const lines = useMemo(() => {
    const out: string[] = []
    for (const w of attention) {
      const said = suggestions.filter(
        (s) => s.sessionId === w.sessionId && s.kind !== "idle-weekend"
      )
      if (said.length > 0) out.push(...said.map((s) => s.text))
      else
        out.push(`${w.label} is nearly full: ${w.load.demand} games in ${w.load.capacity} slots.`)
    }
    return out
  }, [attention, suggestions])

  if (!state) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Loading your registration…"}</p>
  }

  const shownLines = showOptions ? lines : lines.slice(0, ALERT_PREVIEW)
  const hasAlert = Boolean(lead) || lines.length > 0
  // Scheduling stops being early once every grade that HAD an estimate has
  // met it. Grades nobody estimated cannot vote on that question.
  const planned = bars.filter((b) => b.expected > 0)
  const allIn = planned.length > 0 && planned.every((b) => b.approved >= b.expected)

  return (
    <div className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">Registration vs plan</p>
          <p className="text-ink-500 text-xs">
            {locked ? "the counts this season was finalized on" : "updating live as teams sign up"}
          </p>
        </div>
        <span
          data-testid="attention-pill"
          data-state={noCalendar ? "no-plan" : attention.length > 0 ? "attention" : "on-plan"}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
            noCalendar
              ? "border-ink-200 bg-ink-50 text-ink-600"
              : attention.length > 0
                ? "border-gold-200 bg-gold-50 text-gold-800"
                : "border-court-200 bg-court-50 text-court-800"
          }`}
        >
          {noCalendar
            ? "No calendar kept yet"
            : attention.length > 0
              ? `${attention.length} weekend${attention.length === 1 ? "" : "s"} need${
                  attention.length === 1 ? "s" : ""
                } attention`
              : "On plan"}
        </span>
      </div>

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {COPY.locked}
          </p>
        )}
        <NoticeSlot testId="step5-notice" error={error} className="mb-4" />

        {bars.length === 0 ? (
          <div className="border-ink-200 rounded-xl border border-dashed px-4 py-6 text-center">
            <p className="text-ink-500 text-sm">{COPY.noGrades}</p>
            {onGoToStep && !locked && (
              <button
                type="button"
                onClick={() => onGoToStep(1)}
                className={`${BTN_SECONDARY} ${BTN_MD} mt-2`}
              >
                Go to step 1 &rarr;
              </button>
            )}
          </div>
        ) : (
          <div data-testid="registration-bars" className="space-y-2">
            {bars.map((bar) => (
              <div
                key={bar.key}
                data-testid="registration-bar"
                data-grade={bar.label}
                data-approved={bar.approved}
                data-expected={bar.expected}
                data-over={bar.over ? "1" : "0"}
                className="flex items-center gap-3"
              >
                <span
                  title={bar.label}
                  className="text-ink-700 w-12 shrink-0 text-xs font-bold sm:w-16"
                >
                  {gradeAbbrev(bar.label)}
                </span>
                <span className="bg-ink-100 h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
                  {/* Green measures against a plan. A grade nobody estimated
                      has no plan to measure against, so its bar stays grey
                      rather than posing as a target met. */}
                  <span
                    className={`block h-full rounded-full ${
                      bar.expected === 0 ? "bg-ink-300" : bar.over ? "bg-gold-500" : "bg-court-500"
                    }`}
                    style={{ width: `${Math.round(bar.fill * 100)}%` }}
                  />
                </span>
                <span className="text-ink-500 w-[136px] shrink-0 text-right text-xs tabular-nums">
                  {bar.expected > 0 ? (
                    <>
                      {bar.over ? (
                        <b className="text-gold-600">{bar.approved}</b>
                      ) : (
                        <b className="text-ink-900">{bar.approved}</b>
                      )}{" "}
                      of {bar.expected} expected
                    </>
                  ) : (
                    <>
                      <b className="text-ink-900">{bar.approved}</b> registered
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {bars.length > 0 && planned.length === 0 && (
          <p className="text-ink-400 mt-3 text-xs">{COPY.noEstimate}</p>
        )}

        {/* What the numbers just broke, and what to do about it. */}
        {hasAlert && (
          <div
            data-testid="attention-alert"
            className="border-gold-200 bg-gold-50 mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3"
          >
            <span className="text-gold-900 min-w-0 flex-1 text-sm">
              {lead && <b>{lead} </b>}
              {shownLines.join(" ")}
            </span>
            {lines.length > ALERT_PREVIEW && (
              <button
                type="button"
                data-testid="see-options"
                onClick={() => setShowOptions((v) => !v)}
                aria-expanded={showOptions}
                className={`${BTN_QUIET} ${BTN_SM} shrink-0`}
              >
                {showOptions ? "Fewer options" : "See options"}
              </button>
            )}
          </div>
        )}

        {/* Nothing kept means nothing to watch. Say it, and hand over the
            step that fixes it. */}
        {noCalendar && (
          <p data-testid="no-plan-line" className="text-ink-500 mt-4 max-w-2xl text-sm">
            {locked ? COPY.noPlanLocked : COPY.noPlan}{" "}
            {onGoToStep && !locked && (
              <button
                type="button"
                onClick={() => onGoToStep(3)}
                className={`${BTN_SECONDARY} ${BTN_SM}`}
              >
                Go to step 3 &rarr;
              </button>
            )}
          </p>
        )}

        {/* THE ONE DOOR (owner ruling 2026-08-07, #3): one press makes the
            open plan the season and builds its schedule. It needs a plan
            open to know which one; with none, the wizard's own pointer back
            to step 1 stands rather than a shortcut that skips it. */}
        <p className="text-ink-600 mt-5 max-w-2xl text-sm">
          {locked ? COPY.final : allIn ? COPY.ready : COPY.waiting}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          {planId ? (
            <button
              type="button"
              data-testid="step5-generate"
              disabled={genBusy}
              onClick={() => void runGenerate(false)}
              className={`${BTN_PRIMARY} ${BTN_MD}`}
            >
              {genBusy ? "Generating…" : "Use this calendar and generate the schedule"}
            </button>
          ) : (
            <PlanStepPointer
              detail="Generating turns an open plan's calendar into real games. Open one in step 1 first."
              onGoToStep={onGoToStep}
              testId="step5-plan-pointer"
            />
          )}
          <span className="border-ink-100 bg-ink-50 text-ink-500 rounded-full border px-2.5 py-0.5 text-[11px] font-bold">
            {COPY.reuse}
          </span>
        </div>

        <p className="text-ink-400 mt-3 max-w-2xl text-xs">{COPY.footer}</p>
        {/* Only a screen that keeps checking says when it last checked. */}
        <p className="text-ink-400 mt-2 h-4 text-xs" aria-live="polite">
          {checkedAt && !locked ? `Checked at ${clockTime(checkedAt)}` : ""}
        </p>
      </div>
    </div>
  )
}
