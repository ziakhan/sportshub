"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui"
import {
  assignmentWithMove,
  currentAssignment,
  diffAssignments,
  gradeGymStrip,
  gymCountsSentence,
  hoursPreviewSentence,
  packShownPlacements,
  planSummary,
  railSuggestions,
  resolveWeekendGyms,
  shiftClock,
  suggestFor,
  venuesWithoutUnit,
  weekendDemand,
  weekendLoad,
  weekendShortDays,
  weekendStory,
  type AssignmentDiffSummary,
  type GradeStripCell,
  type HoursPreview,
  type PlacementReason,
  type PlannerLever,
  type PlannerState,
  type PlannerSuggestion,
  type PlannerUnit,
  type PlannerWeekend,
  type PlanSummary,
  type SuggestionMove,
  type WeekendDiff,
} from "@/lib/scheduler/planner-core"
import type { VenueGrid } from "@/lib/seasons/venue-grid"
import { venueShortName } from "@/lib/seasons/venue-strip"
import {
  CARD_TONE,
  FRACTION_FOR_TONE,
  PILL_TONE,
  fractionTone,
  hueFor,
  planVenueHues,
  type Armed,
} from "./plan-shared"
import {
  Fraction,
  GLYPH_LEGEND,
  REASON_GLYPH,
  ReasonGlyph,
  WhyPopover,
} from "./plan-ui"
import { Segmented, StripView, type StripSide } from "./season-strip"
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
 *
 * Two views of the SAME calendar (owner 2026-08-02): the board, which is where
 * a month gets rearranged, and the season strip, which reads a grade's whole
 * season left to right and names the gyms each weekend. This component owns
 * every piece of state; the views only draw it.
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
  hours:
    "These change WHEN your gyms are open, not who plays which weekend. One hour, every weekend, every gym. Nothing is booked until you apply it.",
}

const LEVERS: Array<{ lever: PlannerLever; label: string; note: string }> = [
  { lever: "balance", label: "Even weekends", note: "Proposed: the flattest weekends. Keep it, or drag first." },
  { lever: "compact", label: "Fewest weekends", note: "Proposed: as few weekends in use as your gyms allow." },
  { lever: "spread", label: "Use every weekend", note: "Proposed: every weekend of the season in use." },
  {
    lever: "one-gym",
    label: "Pack one gym",
    note: "Proposed: every weekend inside one building, even where that makes a weekend heavier.",
  },
]

/** Hours, not grouping (owner 2026-08-02). Each chip moves the day window an
 *  hour and says what that does to this plan before anything is booked. */
interface HoursChip {
  key: string
  label: string
  hint: string
  deltaStartMinutes: number
  deltaEndMinutes: number
}

const HOURS_CHIPS: HoursChip[] = [
  {
    key: "start-early",
    label: "Start early",
    hint: "Every gym opens an hour earlier",
    deltaStartMinutes: -60,
    deltaEndMinutes: 0,
  },
  {
    key: "start-late",
    label: "Start late",
    hint: "Every gym opens an hour later",
    deltaStartMinutes: 60,
    deltaEndMinutes: 0,
  },
  {
    key: "finish-early",
    label: "Finish early",
    hint: "Every gym closes an hour earlier",
    deltaStartMinutes: 0,
    deltaEndMinutes: -60,
  },
]

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** How many boards back an operator can step. Ten is more than anybody has
 *  ever wanted, and it costs two small objects a move. */
const UNDO_DEPTH = 10

/** The whole board, as it was before a move: the calendar and the gyms
 *  somebody had decided. Everything else on screen is derived from these two. */
interface BoardSnapshot {
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  /** Whether the plan had unsaved changes at that point, so undoing back to
   *  the saved calendar puts the Keep button back to sleep. */
  dirty: boolean
}

/** Which building each grade plays in, as the plan has it SAVED: sessionId →
 *  (unit key → venueId). The board carries this next to the assignment and
 *  hands it back on Apply, so a kept calendar keeps its gyms too. */
function savedVenueMap(state: PlannerState): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const byUnit = w.assignedVenues ?? {}
      if (Object.keys(byUnit).length > 0) out[w.sessionId] = { ...byUnit }
    }
  }
  return out
}

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

export function CalendarStep({
  seasonId,
  onLoaded,
}: {
  seasonId: string
  onLoaded?: (info: PlanHeaderInfo) => void
}) {
  const [state, setState] = useState<PlannerState | null>(null)
  const [assignment, setAssignment] = useState<Record<string, string[]>>({})
  /** The gym each grade plays in, weekend by weekend. Decisions only: a
   *  weekend nobody has decided is absent and the board packs a preview. */
  const [venues, setVenues] = useState<Record<string, Record<string, string>>>({})
  /** The last few boards, newest last, so a move taken by mistake is one tap
   *  from undone. Local only: the plan is temporary until Keep, and leaving
   *  the page throws the whole thing away, stack included. */
  const [undoStack, setUndoStack] = useState<BoardSnapshot[]>([])
  const [locked, setLocked] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState<Armed | null>(null)
  const [showRules, setShowRules] = useState(false)
  /** The hours group: which chip is open, and what the server says it does. */
  const [showHours, setShowHours] = useState(false)
  const [hoursChip, setHoursChip] = useState<HoursChip | null>(null)
  const [hoursPreview, setHoursPreview] = useState<HoursPreview | null>(null)
  const [hoursError, setHoursError] = useState<string | null>(null)
  /** The calendar as SAVED, captured before any proposal touches the board.
   *  Null until the league has kept one. This is what compare mode measures
   *  against, so it must never be the working assignment. */
  const [kept, setKept] = useState<Record<string, string[]> | null>(null)
  /** The gyms that kept calendar was saved with, so the strip can show the
   *  buildings you kept rather than the ones you are trying out. */
  const [keptVenues, setKeptVenues] = useState<Record<string, Record<string, string>>>({})
  const [comparing, setComparing] = useState(false)
  /** Board by default: it is where a month gets rearranged. The strip is the
   *  season read left to right, and it is one tap away. */
  const [view, setView] = useState<"board" | "strip">("board")
  const [side, setSide] = useState<StripSide>("proposal")
  /** Step 2's gyms-and-weekends answer, so the strip can say which gyms you
   *  actually have each weekend instead of assuming both. */
  const [venueGrid, setVenueGrid] = useState<VenueGrid | null>(null)

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
        /** The buildings the proposal was scored on. Apply sends them back
         *  unchanged, so what you saw is what gets saved. */
        venues?: Record<string, Record<string, string>>
        suggestions: PlannerSuggestion[]
      }
    },
    [seasonId]
  )

  /** Load, then open on an answer: the saved plan when there is one, the
   *  balanced proposal when there is not. A locked season only ever shows
   *  what was actually saved. */
  const load = useCallback(async () => {
    // no-store on both: capacity moves when a gym or a court does, and this
    // screen must never draw a weekend on a cached court count.
    const [res, venueRes] = await Promise.all([
      fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(() => null),
      fetch(`/api/seasons/${seasonId}/planner/venues`, { cache: "no-store" }).catch(() => null),
    ])
    if (!res?.ok) {
      setError("Couldn't load your calendar")
      return
    }
    const data = await res.json()
    // The gym row is extra truth, not a dependency: if it fails the strip
    // falls back to the venues the planner itself found capacity at.
    const venueData = venueRes?.ok ? await venueRes.json().catch(() => null) : null
    const next: PlannerState = data.state
    const isLocked = LOCKED_STATUSES.includes(data.seasonStatus)
    const saved = currentAssignment(next)
    const hasSaved = Object.values(saved).some((keys) => keys.length > 0)
    const planningIsPossible = next.windows.length > 0 && next.units.some((u) => u.teams > 0)

    // Ask the solver BEFORE first paint: the board must never flash an empty
    // calendar on its way to the recommendation.
    const opening =
      hasSaved || isLocked || !planningIsPossible ? null : await propose("balance")

    const savedVenues = savedVenueMap(next)

    setState(next)
    setVenueGrid(venueData?.grid ?? null)
    setLocked(isLocked)
    setArmed(null)
    setKept(hasSaved ? saved : null)
    setKeptVenues(hasSaved ? savedVenues : {})
    if (!hasSaved) setSide("proposal")
    onLoaded?.({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })
    setAssignment(opening ? opening.assignment : saved)
    setVenues(opening ? (opening.venues ?? {}) : savedVenues)
    setUndoStack([])
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

  /**
   * Which building every grade plays in, for the WHOLE calendar at once: one
   * chronological pass, carrying each grade's gym from October through to
   * February (owner rule 2026-08-02 — a grade keeps its gym and only moves
   * when capacity forces it). Both views read this one answer, and so does
   * Keep, so the board, the strip and the saved plan can never disagree.
   *
   * Packing a weekend on its own could not do this: December had no idea where
   * a grade had been playing, so the biggest grade took the gym that fills
   * first and a resident was quietly moved out of its own building.
   */
  const shown = useMemo(
    () =>
      state
        ? packShownPlacements(state, assignment, venues)
        : { venues: {}, reasons: {}, homes: {} },
    [state, assignment, venues]
  )
  /** The same walk over the calendar the league KEPT, so the strip's kept side
   *  names the buildings that were saved rather than the ones on trial. */
  const keptShown = useMemo(
    () =>
      state && kept
        ? packShownPlacements(state, kept, keptVenues)
        : { venues: {}, reasons: {}, homes: {} },
    [state, kept, keptVenues]
  )

  /**
   * The suggestion rail, worked out from the board ON SCREEN. It used to be
   * whatever the server last said, which went stale the moment anything moved;
   * suggestFor is pure and reads the same gyms both views draw, so a move
   * taken from the rail immediately changes what the rail says next.
   */
  const suggestions: PlannerSuggestion[] = useMemo(
    () => (state ? suggestFor(state, assignment, venues) : []),
    [state, assignment, venues]
  )

  /**
   * The gym is the colour, everywhere (owner-approved mock 2026-08-02). ONE
   * mapping for the whole step, from the same two inputs the strip uses, so a
   * building is the same colour on the board, on the strip and in the rail.
   */
  const gyms = useMemo(
    () =>
      planVenueHues(
        venueGrid,
        (state?.windows ?? []).flatMap((win) => win.weekends)
      ),
    [venueGrid, state]
  )
  /** A gym in the words the columns have room for, by id. */
  const gymShort = useCallback(
    (venueId: string) => gyms.order.find((v) => v.venueId === venueId)?.short ?? "another gym",
    [gyms]
  )

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
    setVenues(result.venues ?? {})
    // A whole new calendar is not a move, so it is not something to step back
    // through one grade at a time. "Undo changes" reloads the saved plan.
    setUndoStack([])
    setArmed(null)
    setDirty(true)
    setNotice(LEVERS.find((l) => l.lever === lever)?.note ?? null)
  }

  /** What an hour would do, against the calendar ON SCREEN — proposal
   *  included. Read only: the endpoint rebuilds the plan on a shifted window
   *  in memory and writes nothing. */
  const previewHours = async (chip: HoursChip) => {
    setBusy(`hours:${chip.key}`)
    setHoursError(null)
    setHoursChip(chip)
    setHoursPreview(null)
    const res = await fetch(`/api/seasons/${seasonId}/planner/preview-hours`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deltaStartMinutes: chip.deltaStartMinutes,
        deltaEndMinutes: chip.deltaEndMinutes,
        assignment,
      }),
    }).catch(() => null)
    setBusy(null)
    const data = res?.ok ? await res.json().catch(() => null) : null
    if (!data?.preview) {
      setHoursError("Couldn't work that one out. Try again.")
      return
    }
    setHoursPreview(data.preview as HoursPreview)
  }

  /** Book it for real: the same season-venue hours route step 2 saves with,
   *  once per gym, then the board reloads on the new gym time. */
  const applyHours = async (chip: HoursChip) => {
    const rows = (venueGrid?.venues ?? []).filter((v) => v.simpleOpen && v.simpleClose)
    if (rows.length === 0) {
      setHoursError("Set the hours for your gyms on step 2 first.")
      return
    }
    const writes = rows.map((venue) => ({
      venue,
      start: shiftClock(venue.simpleOpen as string, chip.deltaStartMinutes),
      end: shiftClock(venue.simpleClose as string, chip.deltaEndMinutes),
    }))
    if (writes.some((w) => w.start >= w.end)) {
      setHoursError("That would close a gym before it opens.")
      return
    }
    setBusy("hours-apply")
    setHoursError(null)
    const results = await Promise.all(
      writes.map((w) =>
        fetch(`/api/seasons/${seasonId}/venues/${w.venue.seasonVenueId}/hours`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // The step-2 hours model: one range, Saturday and Sunday alike.
            hours: [
              { dayOfWeek: 6, openTime: w.start, closeTime: w.end },
              { dayOfWeek: 0, openTime: w.start, closeTime: w.end },
            ],
          }),
        })
          .then((res) => res.ok)
          .catch(() => false)
      )
    )
    setBusy(null)
    if (results.some((ok) => !ok)) {
      setHoursError("Some gyms did not take the new hours. Try again.")
      return
    }
    setHoursChip(null)
    setHoursPreview(null)
    await load()
    setNotice(
      writes.length === 1
        ? `${writes[0].venue.name} runs ${writes[0].start} to ${writes[0].end} every weekend now.`
        : `${writes.length} gyms moved their hours. The calendar is back on your real gym time.`
    )
  }

  const apply = async () => {
    setBusy("apply")
    setError(null)
    // Save the buildings the board is SHOWING — the same chronological pass
    // both views draw from. A preview the operator kept is a promise about
    // where a family drives, so it is written down like a hand pick.
    const res = await fetch(`/api/seasons/${seasonId}/planner/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment, venues: shown.venues }),
    }).catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      setError("That didn't save. Try again.")
      return
    }
    const data = await res.json()
    const savedNow = currentAssignment(data.state)
    const savedVenuesNow = savedVenueMap(data.state)
    setState(data.state)
    setAssignment(savedNow)
    setVenues(savedVenuesNow)
    // What was just kept becomes the calendar every later comparison is against.
    setKept(savedNow)
    setKeptVenues(savedVenuesNow)
    setUndoStack([])
    setArmed(null)
    setDirty(false)
    setNotice(COPY.saved)
  }

  /** The board as it stands, remembered before something changes it. */
  const remember = () =>
    setUndoStack((prev) => [...prev, { assignment, venues, dirty }].slice(-UNDO_DEPTH))

  /** The one place a chip changes weekends: drag, tap and the suggestion rail
   *  all land here, so every route through the board is undoable and every one
   *  of them treats the gyms the same way. */
  const move = (unitKey: string, fromSessionId: string | null, toSessionId: string) => {
    if (locked || fromSessionId === toSessionId) return
    remember()
    setAssignment((prev) => assignmentWithMove(prev, unitKey, fromSessionId, toSessionId))
    // The gym travels with the chip: the weekend it left forgets it, and the
    // weekend it lands on packs it fresh against whatever is already there.
    setVenues((prev) => venuesWithoutUnit(prev, unitKey, [fromSessionId, toSessionId]))
    setArmed(null)
    setDirty(true)
    setNotice(null)
  }

  /** Step one move back. Local only: what is on screen is what Keep saves, and
   *  nothing here has been written down yet. */
  const undoMove = () => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    setAssignment(last.assignment)
    setVenues(last.venues)
    setDirty(last.dirty)
    setUndoStack(undoStack.slice(0, -1))
    setArmed(null)
    setNotice(null)
  }

  const removeUnit = (unitKey: string, fromSessionId: string) => {
    if (locked) return
    remember()
    setAssignment((prev) => ({
      ...prev,
      [fromSessionId]: (prev[fromSessionId] ?? []).filter((k) => k !== unitKey),
    }))
    setVenues((prev) => venuesWithoutUnit(prev, unitKey, [fromSessionId]))
    setArmed(null)
    setDirty(true)
    setNotice(null)
  }

  /** The one place a grade changes BUILDING: the chip's gym switcher. A hand
   *  pick is a decision, so it sticks even if that gym then reads full. */
  const switchGym = (sessionId: string, unitKey: string, venueId: string) => {
    if (locked) return
    remember()
    setVenues((prev) => ({
      ...prev,
      [sessionId]: { ...(prev[sessionId] ?? {}), [unitKey]: venueId },
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
   *  and lever, so the diff always describes the board on screen. A board
   *  lens, deliberately: the strip shows the two calendars whole instead. */
  const compare = useMemo(() => {
    if (view !== "board" || !comparing || !state || !kept) return null
    const diff = diffAssignments(state, kept, assignment)
    const byWeekend = new Map(diff.weekends.map((w) => [w.sessionId, w]))
    const days = new Map<string, string>()
    for (const win of state.windows)
      for (const w of win.weekends) days.set(w.sessionId, weekendShortDays(w.label))
    // For a grade that landed on a new weekend: which weekend the kept
    // calendar plays it on, keyed the way the chip asks for it.
    const keptOn = new Map<string, string>()
    for (const m of diff.summary.moved) {
      keptOn.set(`${m.toSessionId}|${m.unitKey}`, days.get(m.fromSessionId) ?? "")
    }
    return { line: compareLine(diff.summary), byWeekend, keptOn }
  }, [view, comparing, state, kept, assignment])

  if (!state) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Working out your calendar…"}</p>
  }

  const pill = summary ? headerPill(summary) : null
  const interactive = !locked
  /** The strip can show the calendar the league KEPT, which is read only and
   *  is not what the levers, the suggestions or Keep act on. */
  const showingKept = view === "strip" && side === "kept" && kept !== null

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
            {!interactive
              ? "The calendar this season was finalized on"
              : view === "board"
                ? "Drag a grade to move it · math updates live"
                : "Every grade across the season · math updates live"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented
            label="How to view the calendar"
            value={view}
            testId="calendar-view"
            options={[
              { value: "board" as const, label: "Board" },
              { value: "strip" as const, label: "Strip" },
            ]}
            onChange={(next) => {
              setView(next)
              setArmed(null)
            }}
          />
          {pill && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${PILL_TONE[pill.tone]}`}
            >
              {pill.text}
            </span>
          )}
        </div>
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

            {view === "board" ? (
              <BoardView
                state={state}
                assignment={assignment}
                playsIn={shown.venues}
                whyIn={shown.reasons}
                cameFrom={shown.homes}
                unitByKey={unitByKey}
                hue={gyms.hue}
                armed={armed}
                interactive={interactive}
                onArm={setArmed}
                onMove={move}
                onRemove={removeUnit}
                onSwitchGym={switchGym}
                onDrop={onDrop}
                compare={compare}
              />
            ) : (
              <StripView
                state={state}
                shown={showingKept ? (kept ?? assignment) : assignment}
                playsIn={showingKept ? keptShown.venues : shown.venues}
                whyIn={showingKept ? keptShown.reasons : shown.reasons}
                hasKept={Boolean(kept)}
                side={side}
                onSide={(next) => {
                  setSide(next)
                  setArmed(null)
                }}
                venueGrid={venueGrid}
                interactive={interactive && !showingKept}
                armed={armed}
                onArm={setArmed}
                onMove={move}
              />
            )}

            {/* What the math noticed. It describes the proposal, so it stays
                quiet while the kept calendar is up. */}
            {!showingKept && (
              <SuggestionRail
                state={state}
                assignment={assignment}
                venues={venues}
                playsIn={shown.venues}
                suggestions={suggestions}
                hue={gyms.hue}
                gymShort={gymShort}
                interactive={interactive}
                onMove={move}
              />
            )}

            {/* The quiet door to the levers, and the one button that commits.
                Both act on the proposal, so neither is offered while the kept
                calendar is the thing on screen. */}
            {interactive && !showingKept && (
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
                    {/* The second group, and it changes something else: the
                        hours, not who plays which weekend. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowHours((v) => !v)
                        setHoursChip(null)
                        setHoursPreview(null)
                        setHoursError(null)
                      }}
                      aria-expanded={showHours}
                      data-testid="hours-toggle"
                      className="text-play-700 hover:text-play-800 text-sm font-semibold"
                    >
                      Change the hours
                    </button>
                    {/* The board's own lens. The strip has the two calendars
                        side by side already, so it does not need it. */}
                    {kept && view === "board" && (
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
                    {/* One step back through the moves, however they were
                        made: dragged, tapped, or taken from a suggestion. */}
                    {undoStack.length > 0 && (
                      <button
                        type="button"
                        data-testid="undo-move"
                        disabled={busy !== null}
                        onClick={(e) => {
                          e.stopPropagation()
                          undoMove()
                        }}
                        className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        Undo move
                      </button>
                    )}
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

                {/* Hours. Its own group, labelled by what it changes, and
                    every chip previews before it books (owner 2026-08-02). */}
                {showHours && (
                  <div
                    className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3"
                    data-testid="hours-panel"
                  >
                    <p className="text-ink-400 text-[11px] font-bold uppercase tracking-[0.06em]">
                      Gym hours
                    </p>
                    <p className="text-ink-500 mt-1 text-xs">{COPY.hours}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {HOURS_CHIPS.map((chip) => (
                        <Button
                          key={chip.key}
                          size="sm"
                          variant="secondary"
                          tone={hoursChip?.key === chip.key ? "play" : "brand"}
                          disabled={busy !== null}
                          onClick={() => previewHours(chip)}
                        >
                          {busy === `hours:${chip.key}` ? "Working…" : chip.label}
                        </Button>
                      ))}
                    </div>
                    {hoursError && (
                      <p className="text-hoop-700 mt-2 text-xs font-semibold">{hoursError}</p>
                    )}
                    {hoursChip && hoursPreview && (
                      <div
                        className="border-ink-100 mt-2.5 rounded-lg border bg-white px-3 py-2"
                        data-testid="hours-preview"
                      >
                        <p className="text-ink-900 text-xs font-semibold" aria-live="polite">
                          {hoursPreviewSentence(hoursChip.label, hoursPreview)}
                        </p>
                        <p className="text-ink-400 mt-0.5 text-[11px]">
                          {hoursChip.hint}. Applying writes it to every gym, every weekend.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            tone="court"
                            disabled={busy !== null}
                            onClick={() => applyHours(hoursChip)}
                          >
                            {busy === "hours-apply" ? "Applying…" : "Apply these hours"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => {
                              setHoursChip(null)
                              setHoursPreview(null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
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

/** The board: one column per month window, weekends stacked inside. Where a
 *  month gets rearranged, which is what a column is good at. */
function BoardView({
  state,
  assignment,
  playsIn,
  whyIn,
  cameFrom,
  unitByKey,
  hue,
  armed,
  interactive,
  onArm,
  onMove,
  onRemove,
  onSwitchGym,
  onDrop,
  compare,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  /** Where every grade plays, for the whole calendar: sessionId → (unit key →
   *  venueId), from the step's one chronological pass. */
  playsIn: Record<string, Record<string, string>>
  /** Why each grade is there, from the same pass. */
  whyIn: Record<string, Record<string, PlacementReason>>
  /** The gym each grade was playing BEFORE that weekend, so a caption can
   *  name the building somebody was moved out of. */
  cameFrom: Record<string, Record<string, string>>
  unitByKey: Map<string, PlannerUnit>
  /** venueId → colour family. The step's one mapping, so a gym is the same
   *  colour here as it is on the strip. */
  hue: Map<string, number>
  armed: Armed | null
  interactive: boolean
  onArm: (armed: Armed | null) => void
  onMove: (unitKey: string, from: string | null, to: string) => void
  onRemove: (unitKey: string, from: string) => void
  onSwitchGym: (sessionId: string, unitKey: string, venueId: string) => void
  onDrop: (e: React.DragEvent, to: string, toWindow: string) => void
  compare: { byWeekend: Map<string, WeekendDiff>; keptOn: Map<string, string> } | null
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: `repeat(${state.windows.length}, minmax(200px, 1fr))`,
          minWidth: `${state.windows.length * 200}px`,
          // A two-month season should not stretch its columns across the whole
          // page just because there is room.
          maxWidth: `${state.windows.length * 280}px`,
        }}
      >
        {state.windows.map((win, i) => {
          const inWindow = new Set(win.weekends.flatMap((w) => assignment[w.sessionId] ?? []))
          const missing = state.units.filter((u) => u.teams > 0 && !inWindow.has(u.key))
          return (
            <section key={win.label} className="border-ink-100 bg-ink-50/50 rounded-2xl border p-2.5">
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
                  playsIn={playsIn[w.sessionId] ?? {}}
                  whyIn={whyIn[w.sessionId] ?? {}}
                  cameFrom={cameFrom[w.sessionId] ?? {}}
                  unitByKey={unitByKey}
                  hue={hue}
                  armed={armed}
                  interactive={interactive}
                  onArm={onArm}
                  onMove={onMove}
                  onRemove={onRemove}
                  onSwitchGym={onSwitchGym}
                  onDrop={onDrop}
                  onDisarm={() => onArm(null)}
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
                        onArm={onArm}
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

      {/* The glyphs, in words, once. A chip's mark is never the only place a
          reason is said: it is also in the chip's own popover and in the aria
          label the strip carries. */}
      <div
        className="text-ink-400 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px]"
        data-testid="board-legend"
      >
        {GLYPH_LEGEND.map((entry) => (
          <span key={entry.glyph} className="inline-flex items-center gap-1">
            <ReasonGlyph glyph={entry.glyph} />
            {entry.words}
          </span>
        ))}
      </div>
    </div>
  )
}

/** One weekend: the date, one fraction chip, and its grades UNDER THE GYM THEY
 *  PLAY IN, each gym with its own colour, meter and chip. No sentences: the
 *  red pill and the maxed meter already say "over by 7", and the story is one
 *  tap away on the pill. Also the drop target, and the tap-move destination. */
function WeekendCard({
  weekend,
  windowLabel,
  units,
  keys,
  playsIn,
  whyIn,
  cameFrom,
  unitByKey,
  hue,
  armed,
  interactive,
  onArm,
  onMove,
  onRemove,
  onSwitchGym,
  onDrop,
  onDisarm,
  diff,
  keptOn,
}: {
  weekend: PlannerWeekend
  windowLabel: string
  units: PlannerUnit[]
  keys: string[]
  /** Where each grade on this weekend plays: unit key → venueId, taken from
   *  the season-long pass so a resident keeps the gym it has been playing.
   *  Sections are shaped from it, never packed again here. */
  playsIn: Record<string, string>
  /** Why each of them is there, from that same pass. */
  whyIn: Record<string, PlacementReason>
  /** The gym each grade played before this weekend. */
  cameFrom: Record<string, string>
  unitByKey: Map<string, PlannerUnit>
  /** venueId → colour family, the step's one mapping. */
  hue: Map<string, number>
  armed: Armed | null
  interactive: boolean
  onArm: (a: Armed | null) => void
  onMove: (unitKey: string, from: string | null, to: string) => void
  onRemove: (unitKey: string, from: string) => void
  onSwitchGym: (sessionId: string, unitKey: string, venueId: string) => void
  onDrop: (e: React.DragEvent, to: string, toWindow: string) => void
  onDisarm: () => void
  /** Set only in compare mode: this weekend against the kept calendar. */
  diff?: WeekendDiff
  /** "<sessionId>|<unitKey>" → the days the kept calendar plays it on. */
  keptOn?: Map<string, string>
}) {
  const load = weekendLoad(units, weekend, keys)
  // Grouping only: the buildings are already decided by the season-long pass,
  // and handing them in as the decided gyms is what shapes them into sections
  // (with each gym's games against its courts) without repacking anything.
  const gyms = resolveWeekendGyms(units, weekend, keys, playsIn, whyIn)
  // A weekend whose buildings cannot hold a grade whole is short of courts
  // even when the totals say otherwise, and it reads red either way.
  const tone = gyms.overflow > 0 ? "over" : load.tone
  const droppable = interactive && load.capacity > 0
  const canTakeArmed =
    Boolean(armed) &&
    droppable &&
    armed?.window === windowLabel &&
    armed?.fromSessionId !== weekend.sessionId

  /** The next gym in fill order, for the chip's one-tap switch. */
  const nextGym = (venueId: string | null) => {
    if (weekend.venues.length < 2) return null
    const at = weekend.venues.findIndex((v) => v.venueId === venueId)
    return weekend.venues[(at + 1) % weekend.venues.length]
  }

  // The whole story of the weekend, in numbers, composed in the pure core and
  // only rendered here (owner 2026-08-02: which gym filled, which grade
  // spilled where, how many games, and why anybody stayed put).
  const story = weekendStory(units, weekend, gyms, cameFrom)

  /** One grade, wherever it sits: in a gym section, or with no gym at all. */
  const chipFor = (key: string, venueId: string | null) => {
    const unit = unitByKey.get(key)
    if (!unit) return null
    const agreed = diff?.agreed.includes(key)
    const changed = diff?.added.includes(key)
    const keptDays = keptOn?.get(`${weekend.sessionId}|${key}`)
    const next = interactive ? nextGym(venueId) : null
    return (
      <GradeChip
        key={key}
        unit={unit}
        games={weekendDemand(units, weekend, [key])}
        tint={venueId ? hueFor(hue, venueId).chip : "border-hoop-200 bg-hoop-50 text-hoop-800"}
        quiet={venueId ? hueFor(hue, venueId).chipQuiet : "text-hoop-600"}
        reason={whyIn[key] ?? null}
        // The sentence the core composed for this grade, now behind the mark
        // rather than printed under the chip.
        why={story.chipCaptions[key]}
        fromSessionId={weekend.sessionId}
        windowLabel={windowLabel}
        weekendLabel={weekend.label}
        armed={armed}
        interactive={interactive}
        onArm={onArm}
        onRemove={() => onRemove(key, weekend.sessionId)}
        switchTo={next ? { venueId: next.venueId, short: venueShortName(next.name) } : undefined}
        onSwitchGym={next ? () => onSwitchGym(weekend.sessionId, key, next.venueId) : undefined}
        diffTone={agreed ? "agreed" : changed ? "changed" : undefined}
        // Comparing is a live question about this grade, and the answer is a
        // date the card has nowhere else to put, so the lens keeps its caption.
        caption={changed ? (keptDays ? `kept: ${keptDays}` : "not in the kept plan") : undefined}
      />
    )
  }

  /** The whole weekend as one number. It wears the story when there is one. */
  const headerChip = (
    <Fraction
      is={load.demand}
      of={load.capacity}
      tone={FRACTION_FOR_TONE[tone]}
      title={`${weekend.label}: ${load.demand} games of ${load.capacity}`}
      testId="weekend-fraction"
    />
  )

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
      className={`mb-2 rounded-xl border px-2.5 py-2 ${CARD_TONE[tone]} ${
        canTakeArmed ? "ring-play-400 ring-2" : ""
      }`}
    >
      {/* The date, and the one number that describes the whole weekend. The
          story behind that number is a tap away, and nowhere else. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p
          className={`whitespace-nowrap text-[13px] font-bold ${
            tone === "unavailable" ? "text-ink-400" : "text-ink-900"
          }`}
        >
          {weekend.label}
        </p>
        {(load.capacity > 0 || load.demand > 0) &&
          (story.caption ? (
            <WhyPopover
              text={story.caption}
              label={`What happens on ${weekend.label}`}
              testId="weekend-why"
            >
              {headerChip}
            </WhyPopover>
          ) : (
            headerChip
          ))}
      </div>

      {/* Grades sit under the gym they play in: one building per grade, and
          a family drives to one address (owner 2026-08-02). The gym owns a
          colour, and its NAME is always in the header with it. */}
      <div className="my-1.5 space-y-2">
        {gyms.sections.map((section) => {
          const paint = hueFor(hue, section.venueId)
          const filled =
            section.capacityGames > 0
              ? Math.min(100, Math.round((section.games / section.capacityGames) * 100))
              : 100
          return (
            <div
              key={section.venueId}
              data-testid="weekend-gym-section"
              data-venue-id={section.venueId}
            >
              <div className="flex items-center gap-1.5">
                <i aria-hidden className={`h-2 w-2 flex-none rounded-full ${paint.swatch}`} />
                {/* The gym's NAME, never shortened away to make room for its
                    own meter: the meter gives up its width first. */}
                <span
                  className={`max-w-[104px] flex-none truncate text-[11px] font-bold ${paint.name}`}
                >
                  {venueShortName(section.name)}
                </span>
                <span
                  aria-hidden
                  className="bg-ink-100 h-[5px] min-w-[14px] flex-1 overflow-hidden rounded-full"
                >
                  <i
                    className={`block h-full rounded-full ${
                      section.over > 0 ? "bg-hoop-600" : paint.bar
                    }`}
                    style={{ width: `${section.over > 0 ? 100 : filled}%` }}
                  />
                </span>
                <Fraction
                  is={section.games}
                  of={section.capacityGames}
                  tone={fractionTone(section.games, section.capacityGames)}
                  title={`${venueShortName(section.name)}: ${section.games} games of ${
                    section.capacityGames
                  }`}
                  className="px-1.5"
                  testId="gym-fraction"
                />
              </div>
              <div className="mt-1 flex flex-wrap items-start gap-1">
                {section.unitKeys.map((k) => chipFor(k, section.venueId))}
              </div>
            </div>
          )
        })}

        {/* Grades on a weekend with no gym at all: still on the board, still
            movable, and honestly labelled. */}
        {gyms.unplaced.length > 0 && (
          <div>
            <span className="text-hoop-700 text-[10px] font-bold uppercase tracking-[0.06em]">
              No gym
            </span>
            <div className="mt-1 flex flex-wrap items-start gap-1">
              {gyms.unplaced.map((k) => chipFor(k, null))}
            </div>
          </div>
        )}

        {/* Where the kept calendar plays a grade this weekend and the board
            no longer does: a hole you can see, in its place. */}
        {(diff?.removed.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-start gap-1">
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
          </div>
        )}
        {keys.length === 0 && (diff?.removed.length ?? 0) === 0 && (
          <span className="text-ink-300 text-[11px]">
            {load.capacity > 0 ? "No grades here" : "Gym not yours"}
          </span>
        )}
      </div>

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

/* ----------------------------- the rail ---------------------------------- */

/** What a move buys, in two words. Green fixes a problem, indigo tidies. */
const OUTCOME: Record<SuggestionMove["resolves"], { words: string; tone: string }> = {
  shortage: { words: "clears shortage", tone: "bg-court-50 text-court-800" },
  "two-building": { words: "one building", tone: "bg-play-50 text-play-700" },
  "idle-weekend": { words: "fills the weekend", tone: "bg-play-50 text-play-700" },
}

/**
 * The rail: problems first, then the moves worth taking, one row each.
 *
 * Every row is the same sentence the core composes, laid out instead of read:
 * which grade, from which weekend at what load, to which weekend at what load,
 * what it buys, and what it does to that grade's season. The recap rows that
 * only described what a card already draws are gone (railSuggestions), and the
 * ideas past the first two fold away.
 */
function SuggestionRail({
  state,
  assignment,
  venues,
  playsIn,
  suggestions,
  hue,
  gymShort,
  interactive,
  onMove,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  /** The gyms somebody DECIDED, which is what a move carries forward. */
  venues: Record<string, Record<string, string>>
  /** Where every grade plays on the board right now, for the row's tint. */
  playsIn: Record<string, Record<string, string>>
  suggestions: PlannerSuggestion[]
  hue: Map<string, number>
  gymShort: (venueId: string) => string
  interactive: boolean
  onMove: (unitKey: string, from: string | null, to: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => railSuggestions(suggestions), [suggestions])
  const weekendById = useMemo(() => {
    const out = new Map<string, PlannerWeekend>()
    for (const win of state.windows) for (const w of win.weekends) out.set(w.sessionId, w)
    return out
  }, [state])

  const problems = rows.filter((s) => !s.move)
  const ideas = rows.filter((s) => s.move)
  const shownIdeas = expanded ? ideas : ideas.slice(0, 2)
  const folded = ideas.length - shownIdeas.length

  if (rows.length === 0) return null

  return (
    <div className="mt-4 space-y-1.5" aria-live="polite" data-testid="suggestion-rail">
      {problems.map((s, i) => {
        const weekend = weekendById.get(s.sessionId)
        if (!weekend) return null
        const load = weekendLoad(state.units, weekend, assignment[s.sessionId] ?? [])
        return (
          <div
            key={`problem-${s.sessionId}-${i}`}
            data-testid="rail-problem"
            className="border-hoop-200 bg-hoop-50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5"
          >
            <span className="text-hoop-800 text-[12.5px] font-bold">{weekend.label}</span>
            <WhyPopover
              text={s.text}
              label={`What ${weekend.label} is short of`}
              testId="problem-why"
            >
              <Fraction
                is={load.demand}
                of={load.capacity}
                tone="over"
                title={`${weekend.label}: ${load.demand} games of ${load.capacity}`}
              />
            </WhyPopover>
          </div>
        )
      })}

      {shownIdeas.map((s, i) => (
        <SuggestionRow
          key={`idea-${s.sessionId}-${s.move?.unitKey}-${i}`}
          state={state}
          assignment={assignment}
          venues={venues}
          playsIn={playsIn}
          move={s.move as SuggestionMove}
          hue={hue}
          gymShort={gymShort}
          interactive={interactive}
          onMove={onMove}
        />
      ))}

      {folded > 0 && (
        <button
          type="button"
          data-testid="more-ideas"
          aria-expanded={false}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          className="text-ink-500 hover:text-ink-800 cursor-pointer px-1 py-1 text-[12.5px] font-semibold"
        >
          {folded} more {folded === 1 ? "idea" : "ideas"}
        </button>
      )}
      {expanded && ideas.length > 2 && (
        <button
          type="button"
          data-testid="more-ideas"
          aria-expanded
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(false)
          }}
          className="text-ink-500 hover:text-ink-800 cursor-pointer px-1 py-1 text-[12.5px] font-semibold"
        >
          Fewer ideas
        </button>
      )}
    </div>
  )
}

/** One move, laid out: the grade, both weekends with their loads, what it
 *  buys, the grade's season before and after, and the button that does it. */
function SuggestionRow({
  state,
  assignment,
  venues,
  playsIn,
  move,
  hue,
  gymShort,
  interactive,
  onMove,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  playsIn: Record<string, Record<string, string>>
  move: SuggestionMove
  hue: Map<string, number>
  gymShort: (venueId: string) => string
  interactive: boolean
  onMove: (unitKey: string, from: string | null, to: string) => void
}) {
  const before = useMemo(
    () => gradeGymStrip(state, assignment, venues, move.unitKey),
    [state, assignment, venues, move.unitKey]
  )
  // The same calendar with this one move made, packed the same way the board
  // will pack it the moment the button is pressed. Nothing here is mutated.
  const after = useMemo(
    () =>
      gradeGymStrip(
        state,
        assignmentWithMove(assignment, move.unitKey, move.fromSessionId, move.toSessionId),
        venuesWithoutUnit(venues, move.unitKey, [move.fromSessionId, move.toSessionId]),
        move.unitKey
      ),
    [state, assignment, venues, move.unitKey, move.fromSessionId, move.toSessionId]
  )
  const paint = hueFor(hue, playsIn[move.fromSessionId]?.[move.unitKey])
  const outcome = OUTCOME[move.resolves]
  const story = `${gymCountsSentence(before, after, gymShort)}${move.lands ? ` ${move.lands}` : ""}`

  return (
    <div className="border-ink-100 flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-2">
      <span
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[12px] font-bold ${paint.chip}`}
      >
        {move.unitLabel}
        <span className={`text-[11px] tabular-nums ${paint.chipQuiet}`} aria-hidden>
          {move.games}
        </span>
      </span>
      <span className="text-ink-700 whitespace-nowrap text-[12px] font-bold">
        {move.fromLabel}
      </span>
      <Fraction
        is={move.fromBefore.demand}
        of={move.fromBefore.capacity}
        tone={fractionTone(move.fromBefore.demand, move.fromBefore.capacity)}
        title={`${move.fromLabel} now: ${move.fromBefore.demand} games of ${move.fromBefore.capacity}`}
      />
      <span aria-hidden className="text-ink-300 font-bold">
        →
      </span>
      <span className="text-ink-700 whitespace-nowrap text-[12px] font-bold">{move.toLabel}</span>
      <Fraction
        is={move.toAfter.demand}
        of={move.toAfter.capacity}
        tone={fractionTone(move.toAfter.demand, move.toAfter.capacity)}
        title={`${move.toLabel} after the move: ${move.toAfter.demand} games of ${move.toAfter.capacity}`}
      />
      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${outcome.tone}`}>
        {outcome.words}
      </span>
      <ImpactStrip
        before={before}
        after={after}
        hue={hue}
        story={story}
        unitLabel={move.unitLabel}
      />
      {interactive && (
        <button
          type="button"
          data-testid="suggestion-move"
          data-unit-key={move.unitKey}
          onClick={(e) => {
            e.stopPropagation()
            onMove(move.unitKey, move.fromSessionId, move.toSessionId)
          }}
          aria-label={`Move ${move.unitLabel} from ${move.fromLabel} to ${move.toLabel}`}
          className="border-play-300 bg-play-50 text-play-700 hover:bg-play-100 ml-auto min-h-[40px] shrink-0 cursor-pointer rounded-lg border px-3 text-[12px] font-bold"
        >
          Move
        </button>
      )}
    </div>
  )
}

/**
 * A grade's season in miniature, before and after: one cell per weekend it
 * plays, in date order, coloured by the gym. A cell that the move sends
 * somewhere other than the grade's home gym is outlined, so the one thing that
 * changed is the one thing you see. Static, on purpose: nothing on this screen
 * blinks at you.
 */
function ImpactStrip({
  before,
  after,
  hue,
  story,
  unitLabel,
}: {
  before: GradeStripCell[]
  after: GradeStripCell[]
  hue: Map<string, number>
  story: string
  unitLabel: string
}) {
  /** The building this grade plays most: its home, whatever one weekend does. */
  const home = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of before) counts.set(c.venueId, (counts.get(c.venueId) ?? 0) + 1)
    let best: string | null = null
    for (const [venueId, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = venueId
    return best
  }, [before])

  const cells = (list: GradeStripCell[], mark: boolean) => (
    <span className="inline-flex gap-[2px]">
      {list.map((cell, i) => {
        const moved = mark && before[i] && before[i].venueId !== cell.venueId
        return (
          <i
            key={`${cell.sessionId}-${i}`}
            aria-hidden
            data-venue-id={cell.venueId}
            className={`block h-3 w-[9px] rounded-[3px] ${hueFor(hue, cell.venueId).swatch} ${
              moved && cell.venueId !== home ? "outline-gold-500 outline outline-2 outline-offset-1" : ""
            }`}
          />
        )
      })}
    </span>
  )

  return (
    <WhyPopover
      text={story}
      label={`${unitLabel}: its season before and after this move`}
      testId="impact-strip"
      className="inline-flex min-h-[32px] items-center gap-1.5 px-1"
    >
      {cells(before, false)}
      <span aria-hidden className="text-ink-300 text-[11px] font-bold">
        →
      </span>
      {cells(after, true)}
    </WhyPopover>
  )
}

/** A grade, in the colour of the gym it plays in. Draggable for a mouse,
 *  tappable for everything else: one tap arms it, the next tap on a weekend
 *  moves it. Its games ride on it as a number, and the reason it sits where it
 *  sits rides on it as a mark you can tap for the sentence. */
function GradeChip({
  unit,
  games,
  tint,
  quiet,
  reason,
  why,
  fromSessionId,
  windowLabel,
  weekendLabel,
  armed,
  interactive,
  onArm,
  onRemove,
  switchTo,
  onSwitchGym,
  muted,
  diffTone,
  caption,
}: {
  unit: PlannerUnit
  /** Games this grade brings to this weekend. Absent on the bench. */
  games?: number
  /** The gym's colour, as chip classes. */
  tint?: string
  /** The quieter ink inside the chip, from the same family. */
  quiet?: string
  /** Why it is in this building, for the mark it wears. */
  reason?: PlacementReason | null
  /** The sentence behind that mark. */
  why?: string
  fromSessionId: string | null
  windowLabel: string
  weekendLabel: string
  armed: Armed | null
  interactive: boolean
  onArm: (a: Armed | null) => void
  onRemove?: () => void
  /** The next gym in fill order, when this weekend runs more than one. */
  switchTo?: { venueId: string; short: string }
  onSwitchGym?: () => void
  muted?: boolean
  /** Compare mode: agrees with the kept calendar, or sits somewhere new. */
  diffTone?: "agreed" | "changed"
  /** Compare mode only: where the kept calendar plays this grade instead. */
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
  const ink = muted ? "text-ink-400" : (quiet ?? "text-ink-400")
  const glyph = reason ? REASON_GLYPH[reason] : undefined
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
      data-reason={reason ?? undefined}
      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border pl-2 text-[12px] font-bold ${
        muted ? "border-ink-200 bg-ink-50 text-ink-500" : (tint ?? "border-ink-200 bg-white")
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
        className="min-h-[32px] pr-0.5 disabled:cursor-default"
      >
        {unit.label}
      </button>
      {games != null && games > 0 && (
        <span className={`text-[11px] font-bold tabular-nums ${ink}`} aria-hidden>
          {games}
        </span>
      )}
      {/* The reason, drawn. The tap target is the whole height of the chip,
          never the 12px mark on its own, and the sentence is behind it. */}
      {glyph && why && (
        <WhyPopover
          text={why}
          label={`Why ${unit.label} plays here`}
          testId="chip-why"
          className={`inline-flex min-h-[32px] items-center px-0.5 ${ink}`}
        >
          <ReasonGlyph glyph={glyph} />
        </WhyPopover>
      )}
      {/* One tap sends the grade to the next gym of this weekend. The chip
          already sits under the gym it plays in, so this is the move. */}
      {interactive && switchTo && onSwitchGym && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSwitchGym()
          }}
          aria-label={`Move ${unit.label} to ${switchTo.short}`}
          title={`Move to ${switchTo.short}`}
          className={`min-h-[32px] px-0.5 text-[11px] font-bold ${ink} hover:text-ink-900`}
        >
          ⇄
        </button>
      )}
      {interactive && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Take ${unit.label} off ${weekendLabel}`}
          className={`hover:text-hoop-700 min-h-[32px] px-1.5 ${ink}`}
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
      <span
        className={`pl-0.5 text-[10px] font-bold leading-none ${
          diffTone === "changed" ? "text-gold-600" : "text-ink-400"
        }`}
      >
        {caption}
      </span>
    </span>
  )
}
