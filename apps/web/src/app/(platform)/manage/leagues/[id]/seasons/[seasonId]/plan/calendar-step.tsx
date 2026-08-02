"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui"
import {
  currentAssignment,
  diffAssignments,
  planSummary,
  weekendLoad,
  type AssignmentDiffSummary,
  type PlannerLever,
  type PlannerState,
  type PlannerSuggestion,
  type PlannerUnit,
  type PlannerWeekend,
  type PlanSummary,
  type WeekendDiff,
  type WeekendLoad,
} from "@/lib/scheduler/planner-core"
import type { PlanHeaderInfo } from "./teams-step"

/**
 * Step 3, the calendar (owner-approved mock, 2026-08-02). The screen the
 * whole flow exists for: the operator's own hand-drawn season calendar,
 * computed in a second.
 *
 * The rule the screen is built around: it OPENS on the answer. A season with
 * nothing planned yet asks the solver for the balanced plan before first
 * paint, so nobody has to press a button to see a calendar. That opening
 * plan is unsaved and says so; a season that already has one opens on it.
 *
 * Grouping rules are league truths, not preferences, so they are not a step.
 * The three levers live behind a quiet link for the operator who cares.
 */

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

/** Strings with real apostrophes live here as JS expressions, so nothing
 *  needs escaping and the copy stays readable. */
const COPY = {
  opened:
    "We placed every grade for you, balanced across your gym time. Drag anything you'd do differently, then keep it.",
  rules:
    "Grouping is automatic because these are league truths, not choices: oldest grades together, youngest together, the middle split by size, the two biggest grades kept apart, and each grade leaning to the gym it usually plays in. These three only change how tightly the weekends pack.",
  saved: "Saved. Everything after this step follows this calendar.",
  unsaved: "Nothing is saved until you keep it.",
  oneWeekendPerMonth:
    "Every grade gets one weekend a month, so move it to another weekend in the same month.",
  compareSame: "This is the kept calendar, unchanged.",
  compareLegend:
    "Green agrees with what you kept, amber moved to another weekend that month, and a dashed chip is where the kept calendar had that grade.",
}

const LEVERS: Array<{ lever: PlannerLever; label: string; note: string }> = [
  { lever: "balance", label: "Even weekends", note: "Proposed: the flattest weekends. Keep it, or drag first." },
  { lever: "compact", label: "Fewest weekends", note: "Proposed: as few weekends in use as your gyms allow." },
  { lever: "spread", label: "Use every weekend", note: "Proposed: every weekend of the season in use." },
]

const CARD_TONE: Record<WeekendLoad["tone"], string> = {
  over: "border-hoop-300 bg-hoop-50",
  tight: "border-gold-200 bg-gold-50",
  unavailable: "border-ink-200 border-dashed bg-ink-50/70",
  empty: "border-ink-100 bg-white",
  roomy: "border-ink-100 bg-white",
}

const METER_TONE: Record<WeekendLoad["tone"], string> = {
  over: "text-hoop-800",
  tight: "text-gold-800",
  unavailable: "text-ink-400",
  empty: "text-ink-400",
  roomy: "text-ink-500",
}

const PILL_TONE = {
  ok: "border-court-200 bg-court-50 text-court-800",
  warn: "border-gold-200 bg-gold-50 text-gold-800",
  bad: "border-hoop-200 bg-hoop-50 text-hoop-800",
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The header verdict: the loudest true thing about the plan on screen. */
function headerPill(summary: PlanSummary): { tone: keyof typeof PILL_TONE; text: string } {
  if (summary.over > 0)
    return { tone: "bad", text: `${plural(summary.over, "weekend", "weekends")} over` }
  if (summary.unplaced > 0)
    return { tone: "warn", text: `${plural(summary.unplaced, "grade", "grades")} not placed` }
  if (summary.tight > 0)
    return { tone: "warn", text: `${plural(summary.tight, "weekend", "weekends")} tight` }
  return { tone: "ok", text: "All grades fit" }
}

/**
 * The verdict on the board against the calendar the league kept: how much of
 * their own plan we reproduce, and what we do differently. Zero clauses are
 * left out, because "0 missing" is a sentence nobody needs to read.
 */
function compareLine(summary: AssignmentDiffSummary): string {
  const { placements, agreedCount, moved, missing, extra } = summary
  const parts: string[] = []
  if (moved.length > 0) parts.push(`${moved.length} moved`)
  if (missing.length > 0) parts.push(`${missing.length} missing`)
  if (extra.length > 0) parts.push(`${extra.length} added`)
  if (parts.length === 0 && agreedCount === placements) return COPY.compareSame
  const lead = `Agrees with the kept calendar on ${agreedCount} of ${plural(
    placements,
    "placement",
    "placements"
  )}.`
  return parts.length > 0 ? `${lead} ${parts.join(", ")}.` : lead
}

/**
 * The weekend a chip's caption points back to. A grade only ever moves inside
 * its own month column, so the leading month is noise: "Oct 24–25" becomes
 * "24–25". A weekend that straddles two months keeps the second one, because
 * "31–1" tells nobody anything.
 */
function keptDayLabel(label: string): string {
  const [from, to] = label.split("–")
  if (!to) return label
  return `${from.match(/\d+/)?.[0] ?? from.trim()}–${to.trim()}`
}

interface Armed {
  unitKey: string
  label: string
  fromSessionId: string | null
  /** A grade plays ONE weekend per month window, so it only ever moves
   *  inside the column it is already in. */
  window: string
}

export function CalendarStep({
  seasonId,
  onLoaded,
}: {
  seasonId: string
  onLoaded?: (info: PlanHeaderInfo) => void
}) {
  const [state, setState] = useState<PlannerState | null>(null)
  const [assignment, setAssignment] = useState<Record<string, string[]>>({})
  const [suggestions, setSuggestions] = useState<PlannerSuggestion[]>([])
  const [locked, setLocked] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState<Armed | null>(null)
  const [showRules, setShowRules] = useState(false)
  /** The calendar as SAVED, captured before any proposal touches the board.
   *  Null until the league has kept one. This is what compare mode measures
   *  against, so it must never be the working assignment. */
  const [kept, setKept] = useState<Record<string, string[]> | null>(null)
  const [comparing, setComparing] = useState(false)

  const propose = useCallback(
    async (lever: PlannerLever) => {
      const res = await fetch(`/api/seasons/${seasonId}/planner/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lever }),
      }).catch(() => null)
      if (!res?.ok) return null
      return (await res.json()) as {
        assignment: Record<string, string[]>
        suggestions: PlannerSuggestion[]
      }
    },
    [seasonId]
  )

  /** Load, then open on an answer: the saved plan when there is one, the
   *  balanced proposal when there is not. A locked season only ever shows
   *  what was actually saved. */
  const load = useCallback(async () => {
    // no-store: capacity moves when a gym or a court does, and this screen
    // must never draw a weekend on a cached court count.
    const res = await fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(
      () => null
    )
    if (!res?.ok) {
      setError("Couldn't load your calendar")
      return
    }
    const data = await res.json()
    const next: PlannerState = data.state
    const isLocked = LOCKED_STATUSES.includes(data.seasonStatus)
    const saved = currentAssignment(next)
    const hasSaved = Object.values(saved).some((keys) => keys.length > 0)
    const planningIsPossible = next.windows.length > 0 && next.units.some((u) => u.teams > 0)

    // Ask the solver BEFORE first paint: the board must never flash an empty
    // calendar on its way to the recommendation.
    const opening =
      hasSaved || isLocked || !planningIsPossible ? null : await propose("balance")

    setState(next)
    setLocked(isLocked)
    setArmed(null)
    setKept(hasSaved ? saved : null)
    onLoaded?.({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })
    setAssignment(opening ? opening.assignment : saved)
    setSuggestions((opening ? opening.suggestions : data.suggestions) ?? [])
    setDirty(Boolean(opening))
    setNotice(opening ? COPY.opened : null)
  }, [seasonId, onLoaded, propose])

  useEffect(() => {
    load()
  }, [load])

  // Escape always cancels an armed chip, wherever the focus went.
  useEffect(() => {
    if (!armed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmed(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [armed])

  const runLever = async (lever: PlannerLever) => {
    setBusy(lever)
    setError(null)
    const result = await propose(lever)
    setBusy(null)
    if (!result) {
      setError("That proposal failed. Try again.")
      return
    }
    setAssignment(result.assignment)
    setSuggestions(result.suggestions ?? [])
    setArmed(null)
    setDirty(true)
    setNotice(LEVERS.find((l) => l.lever === lever)?.note ?? null)
  }

  const apply = async () => {
    setBusy("apply")
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/planner/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment }),
    }).catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      setError("That didn't save. Try again.")
      return
    }
    const data = await res.json()
    const savedNow = currentAssignment(data.state)
    setState(data.state)
    setAssignment(savedNow)
    // What was just kept becomes the calendar every later comparison is against.
    setKept(savedNow)
    setSuggestions(data.suggestions ?? [])
    setArmed(null)
    setDirty(false)
    setNotice(COPY.saved)
  }

  /** The one place a chip changes weekends: drag and tap both land here. */
  const move = (unitKey: string, fromSessionId: string | null, toSessionId: string) => {
    if (locked || fromSessionId === toSessionId) return
    setAssignment((prev) => {
      const next: Record<string, string[]> = {}
      for (const [sid, keys] of Object.entries(prev)) {
        next[sid] = sid === fromSessionId ? keys.filter((k) => k !== unitKey) : [...keys]
      }
      next[toSessionId] = [...new Set([...(next[toSessionId] ?? []), unitKey])]
      return next
    })
    setArmed(null)
    setDirty(true)
    setNotice(null)
  }

  const removeUnit = (unitKey: string, fromSessionId: string) => {
    if (locked) return
    setAssignment((prev) => ({
      ...prev,
      [fromSessionId]: (prev[fromSessionId] ?? []).filter((k) => k !== unitKey),
    }))
    setArmed(null)
    setDirty(true)
    setNotice(null)
  }

  const onDrop = (e: React.DragEvent, toSessionId: string, toWindow: string) => {
    e.preventDefault()
    try {
      const payload = JSON.parse(e.dataTransfer.getData("text/plain"))
      if (!payload?.unitKey) return
      if (payload.window !== toWindow) {
        setNotice(COPY.oneWeekendPerMonth)
        return
      }
      move(payload.unitKey, payload.fromSessionId ?? null, toSessionId)
    } catch {
      /* not one of our chips */
    }
  }

  const unitByKey = useMemo(
    () => new Map((state?.units ?? []).map((u) => [u.key, u])),
    [state]
  )

  const summary = useMemo(
    () => (state ? planSummary(state, assignment) : null),
    [state, assignment]
  )

  /** Compare mode is a lens, not a freeze: this recomputes on every drag, tap
   *  and lever, so the diff always describes the board on screen. */
  const compare = useMemo(() => {
    if (!comparing || !state || !kept) return null
    const diff = diffAssignments(state, kept, assignment)
    const byWeekend = new Map(diff.weekends.map((w) => [w.sessionId, w]))
    const days = new Map<string, string>()
    for (const win of state.windows)
      for (const w of win.weekends) days.set(w.sessionId, keptDayLabel(w.label))
    // For a grade that landed on a new weekend: which weekend the kept
    // calendar plays it on, keyed the way the chip asks for it.
    const keptOn = new Map<string, string>()
    for (const m of diff.summary.moved) {
      keptOn.set(`${m.toSessionId}|${m.unitKey}`, days.get(m.fromSessionId) ?? "")
    }
    return { line: compareLine(diff.summary), byWeekend, keptOn }
  }, [comparing, state, kept, assignment])

  /** Most weekends run the same set of gyms. Naming one on every card is
   *  noise, so a card only names its gyms when they differ from the season's
   *  usual pair. */
  const usualVenues = useMemo(() => {
    if (!state) return ""
    const counts = new Map<string, number>()
    for (const win of state.windows) {
      for (const w of win.weekends) {
        if (w.capacityGames <= 0) continue
        const sig = w.venues.map((v) => v.venueId).sort().join("|")
        counts.set(sig, (counts.get(sig) ?? 0) + 1)
      }
    }
    let best = ""
    let bestCount = 0
    for (const [sig, count] of counts) {
      if (count > bestCount) {
        best = sig
        bestCount = count
      }
    }
    return best
  }, [state])

  if (!state) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Working out your calendar…"}</p>
  }

  const pill = summary ? headerPill(summary) : null
  const interactive = !locked

  return (
    <div
      className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white"
      onClick={() => setArmed(null)}
    >
      {/* Screen head */}
      <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">
            {dirty ? "Proposed calendar" : "Your calendar"}
          </p>
          <p className="text-ink-500 text-xs">
            {interactive
              ? "Drag a grade to move it · math updates live"
              : "The calendar this season was finalized on"}
          </p>
        </div>
        {pill && (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${PILL_TONE[pill.tone]}`}
          >
            {pill.text}
          </span>
        )}
      </div>

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so the calendar is read only now.
          </p>
        )}
        {error && (
          <p className="border-hoop-200 bg-hoop-50 text-hoop-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {error}
          </p>
        )}
        {compare && !error && (
          <div
            className="border-gold-400 bg-gold-50 mb-4 rounded-xl border px-4 py-2.5"
            aria-live="polite"
            data-testid="compare-banner"
          >
            <p className="text-ink-900 text-sm font-semibold">{compare.line}</p>
            <p className="text-ink-500 mt-0.5 text-xs">{COPY.compareLegend}</p>
          </div>
        )}
        {notice && !error && !compare && (
          <p className="border-court-200 bg-court-50 text-court-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {notice}
          </p>
        )}
        {state.errors.length > 0 && (
          <p className="text-ink-500 mb-4 text-xs">{state.errors.join(" · ")}</p>
        )}

        {state.windows.length === 0 ? (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            This season has no weekends yet. Add them in step 2 and the calendar builds itself
            here.
          </p>
        ) : (
          <>
            {armed && (
              <p className="text-play-700 mb-3 text-xs font-semibold" aria-live="polite">
                {armed.label} is ready to move. Tap another weekend that month, or press Escape.
              </p>
            )}

            {/* The board: one column per month window, weekends stacked inside. */}
            <div className="overflow-x-auto pb-2">
              <div
                className="grid gap-2.5"
                style={{
                  gridTemplateColumns: `repeat(${state.windows.length}, minmax(172px, 1fr))`,
                  minWidth: `${state.windows.length * 172}px`,
                  // A two-month season should not stretch its columns across
                  // the whole page just because there is room.
                  maxWidth: `${state.windows.length * 260}px`,
                }}
              >
                {state.windows.map((win, i) => {
                  const inWindow = new Set(win.weekends.flatMap((w) => assignment[w.sessionId] ?? []))
                  const missing = state.units.filter((u) => u.teams > 0 && !inWindow.has(u.key))
                  return (
                    <section
                      key={win.label}
                      className="border-ink-100 bg-ink-50/50 rounded-2xl border p-2.5"
                    >
                      <h3 className="text-ink-500 mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em]">
                        Session {i + 1} · {win.label.split(" ")[0]}
                      </h3>
                      {win.weekends.map((w) => (
                        <WeekendCard
                          key={w.sessionId}
                          weekend={w}
                          windowLabel={win.label}
                          units={state.units}
                          keys={assignment[w.sessionId] ?? []}
                          unitByKey={unitByKey}
                          namesGyms={
                            w.venues.length > 0 &&
                            w.venues.map((v) => v.venueId).sort().join("|") !== usualVenues
                          }
                          armed={armed}
                          interactive={interactive}
                          onArm={setArmed}
                          onMove={move}
                          onRemove={removeUnit}
                          onDrop={onDrop}
                          onDisarm={() => setArmed(null)}
                          diff={compare?.byWeekend.get(w.sessionId)}
                          keptOn={compare?.keptOn}
                        />
                      ))}

                      {missing.length > 0 && (
                        <div className="border-ink-200 rounded-xl border border-dashed p-2">
                          <p className="text-ink-400 text-[10px] font-bold uppercase tracking-wide">
                            Not playing this month
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {missing.map((u) => (
                              <GradeChip
                                key={u.key}
                                unit={u}
                                fromSessionId={null}
                                windowLabel={win.label}
                                weekendLabel="the bench"
                                armed={armed}
                                interactive={interactive}
                                onArm={setArmed}
                                muted
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            </div>

            {/* What the math noticed, in plain language. */}
            {suggestions.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {suggestions.slice(0, 6).map((s, i) => (
                  <p
                    key={`${s.sessionId}-${s.kind}-${i}`}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      s.kind === "overflow"
                        ? "border-hoop-200 bg-hoop-50 text-hoop-900"
                        : s.kind === "idle-weekend"
                          ? "border-ink-100 bg-ink-50 text-ink-500"
                          : "border-gold-200 bg-gold-50 text-gold-900"
                    }`}
                  >
                    {s.text}
                  </p>
                ))}
                {suggestions.length > 6 && (
                  <p className="text-ink-400 px-1 text-xs">
                    and {suggestions.length - 6} more like these.
                  </p>
                )}
              </div>
            )}

            {/* The quiet door to the levers, and the one button that commits. */}
            {interactive && (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowRules((v) => !v)
                      }}
                      aria-expanded={showRules}
                      className="text-play-700 hover:text-play-800 text-sm font-semibold"
                    >
                      Adjust grouping rules
                    </button>
                    {kept && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setComparing((v) => !v)
                        }}
                        aria-pressed={comparing}
                        data-testid="compare-toggle"
                        className="text-play-700 hover:text-play-800 text-sm font-semibold"
                      >
                        {comparing ? "Stop comparing" : "Compare with the kept calendar"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-400 text-xs">
                      {dirty ? COPY.unsaved : "This calendar is saved."}
                    </span>
                    {dirty && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={load}
                      >
                        Undo changes
                      </Button>
                    )}
                    <Button
                      size="sm"
                      tone="court"
                      disabled={busy !== null || !dirty}
                      onClick={apply}
                    >
                      {busy === "apply" ? "Saving…" : "Keep this calendar"}
                    </Button>
                  </div>
                </div>

                {showRules && (
                  <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                    <p className="text-ink-500 text-xs">{COPY.rules}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {LEVERS.map((l) => (
                        <Button
                          key={l.lever}
                          size="sm"
                          variant="secondary"
                          disabled={busy !== null}
                          onClick={() => runLever(l.lever)}
                        >
                          {busy === l.lever ? "Working…" : l.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** One weekend: the date, its grades, and the court math in the mock's
 *  phrasing. Also the drop target, and the tap-move destination. */
function WeekendCard({
  weekend,
  windowLabel,
  units,
  keys,
  unitByKey,
  namesGyms,
  armed,
  interactive,
  onArm,
  onMove,
  onRemove,
  onDrop,
  onDisarm,
  diff,
  keptOn,
}: {
  weekend: PlannerWeekend
  windowLabel: string
  units: PlannerUnit[]
  keys: string[]
  unitByKey: Map<string, PlannerUnit>
  namesGyms: boolean
  armed: Armed | null
  interactive: boolean
  onArm: (a: Armed | null) => void
  onMove: (unitKey: string, from: string | null, to: string) => void
  onRemove: (unitKey: string, from: string) => void
  onDrop: (e: React.DragEvent, to: string, toWindow: string) => void
  onDisarm: () => void
  /** Set only in compare mode: this weekend against the kept calendar. */
  diff?: WeekendDiff
  /** "<sessionId>|<unitKey>" → the days the kept calendar plays it on. */
  keptOn?: Map<string, string>
}) {
  const load = weekendLoad(units, weekend, keys)
  const droppable = interactive && load.capacity > 0
  const canTakeArmed =
    Boolean(armed) &&
    droppable &&
    armed?.window === windowLabel &&
    armed?.fromSessionId !== weekend.sessionId

  const captions: string[] = []
  if (load.tone === "over") captions.push(`${load.demand - load.capacity} short`)
  if (load.tone === "tight") captions.push("full house")
  if (load.twoBuildings) captions.push("both gyms")
  if (load.tone === "empty") captions.push("spare capacity")

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        if (armed && canTakeArmed) onMove(armed.unitKey, armed.fromSessionId, weekend.sessionId)
        else onDisarm()
      }}
      onDragOver={(e) => {
        if (droppable) e.preventDefault()
      }}
      onDrop={(e) => droppable && onDrop(e, weekend.sessionId, windowLabel)}
      data-session-id={weekend.sessionId}
      className={`mb-2 rounded-xl border px-2.5 py-2 ${CARD_TONE[load.tone]} ${
        canTakeArmed ? "ring-play-400 ring-2" : ""
      }`}
    >
      <p
        className={`text-[12.5px] font-bold ${
          load.tone === "unavailable" ? "text-ink-400" : "text-ink-900"
        }`}
      >
        {weekend.label}
      </p>

      <div className="my-1.5 flex flex-wrap items-start gap-1">
        {keys.map((k) => {
          const unit = unitByKey.get(k)
          if (!unit) return null
          const agreed = diff?.agreed.includes(k)
          const changed = diff?.added.includes(k)
          const keptDays = keptOn?.get(`${weekend.sessionId}|${k}`)
          return (
            <GradeChip
              key={k}
              unit={unit}
              fromSessionId={weekend.sessionId}
              windowLabel={windowLabel}
              weekendLabel={weekend.label}
              armed={armed}
              interactive={interactive}
              onArm={onArm}
              onRemove={() => onRemove(k, weekend.sessionId)}
              diffTone={agreed ? "agreed" : changed ? "changed" : undefined}
              caption={
                changed ? (keptDays ? `kept: ${keptDays}` : "not in the kept plan") : undefined
              }
            />
          )
        })}
        {/* Where the kept calendar plays a grade this weekend and the board
            no longer does: a hole you can see, in its place. */}
        {(diff?.removed ?? []).map((k) => {
          const unit = unitByKey.get(k)
          if (!unit) return null
          return (
            <span
              key={`kept-${k}`}
              className="border-ink-300 text-ink-400 inline-flex items-center rounded-lg border border-dashed px-1.5 py-0.5 text-[11px] font-bold"
            >
              {unit.label} · kept here
            </span>
          )
        })}
        {keys.length === 0 && (diff?.removed.length ?? 0) === 0 && (
          <span className="text-ink-300 text-[11px]">
            {load.capacity > 0 ? "No grades here" : "Gym not yours"}
          </span>
        )}
      </div>

      <p className={`text-[11px] ${METER_TONE[load.tone]}`}>
        {load.capacity <= 0 && load.demand === 0 ? (
          "no gym this weekend"
        ) : (
          <>
            {namesGyms ? `${weekend.venues.map((v) => v.name).join(" + ")} ` : "courts "}
            <b className={load.tone === "roomy" || load.tone === "empty" ? "text-ink-900" : ""}>
              {load.demand} / {load.capacity}
            </b>
            {captions.length > 0 && ` · ${captions.join(" · ")}`}
          </>
        )}
      </p>

      {canTakeArmed && armed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMove(armed.unitKey, armed.fromSessionId, weekend.sessionId)
          }}
          aria-label={`Move ${armed.label} to ${weekend.label}`}
          className="border-play-300 bg-play-50 text-play-700 mt-1.5 w-full rounded-lg border border-dashed px-2 py-1 text-[11px] font-semibold"
        >
          Move {armed.label} here
        </button>
      )}
    </div>
  )
}

/** A grade. Draggable for a mouse, tappable for everything else: one tap
 *  arms it, the next tap on a weekend moves it. */
function GradeChip({
  unit,
  fromSessionId,
  windowLabel,
  weekendLabel,
  armed,
  interactive,
  onArm,
  onRemove,
  muted,
  diffTone,
  caption,
}: {
  unit: PlannerUnit
  fromSessionId: string | null
  windowLabel: string
  weekendLabel: string
  armed: Armed | null
  interactive: boolean
  onArm: (a: Armed | null) => void
  onRemove?: () => void
  muted?: boolean
  /** Compare mode: agrees with the kept calendar, or sits somewhere new. */
  diffTone?: "agreed" | "changed"
  /** Compare mode: where the kept calendar plays this grade instead. */
  caption?: string
}) {
  const isArmed = armed?.unitKey === unit.key && armed?.fromSessionId === fromSessionId
  // Arming is a live action, so it outranks the compare ring while it lasts.
  const ring = isArmed
    ? "ring-play-500 ring-2"
    : diffTone === "agreed"
      ? "ring-court-400 ring-1"
      : diffTone === "changed"
        ? "ring-gold-500 ring-1"
        : ""
  const chip = (
    <span
      draggable={interactive}
      onDragStart={(e) =>
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ unitKey: unit.key, fromSessionId, window: windowLabel })
        )
      }
      data-diff={diffTone}
      className={`inline-flex items-center gap-0.5 rounded-lg border pl-1.5 text-[11px] font-bold ${
        muted
          ? "border-ink-200 bg-ink-50 text-ink-500"
          : "border-court-200 bg-court-50 text-court-800"
      } ${interactive ? "cursor-grab active:cursor-grabbing" : ""} ${ring}`}
    >
      <button
        type="button"
        disabled={!interactive}
        aria-pressed={isArmed}
        aria-label={`${unit.label} on ${weekendLabel}`}
        onClick={(e) => {
          e.stopPropagation()
          if (!interactive) return
          onArm(
            isArmed
              ? null
              : { unitKey: unit.key, label: unit.label, fromSessionId, window: windowLabel }
          )
        }}
        className="py-0.5 pr-0.5 disabled:cursor-default"
      >
        {unit.label}
      </button>
      {interactive && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Take ${unit.label} off ${weekendLabel}`}
          className="text-court-500 hover:text-hoop-700 px-1 py-0.5"
        >
          ×
        </button>
      )}
    </span>
  )

  if (!caption) return chip
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {chip}
      <span className="text-gold-600 pl-0.5 text-[9px] font-bold leading-none">{caption}</span>
    </span>
  )
}
