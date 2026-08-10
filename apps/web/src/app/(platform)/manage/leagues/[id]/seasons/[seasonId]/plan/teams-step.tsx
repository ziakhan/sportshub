"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { planningTeams, type PlannerState, type PlannerUnit } from "@/lib/scheduler/planner-core"
import { isReferencePlan, PLAN_COPY, type PlanWorld } from "@/lib/scheduler/plan-documents"
import { unitIncluded, withUnitIncluded, withUnitRemoved, withUnitTeams } from "@/lib/scheduler/plan-world"
import { PlanChooser, PlanEmptyState, usePlanSession } from "./plan-session"
import { BTN_MD, BTN_SECONDARY, BTN_SM } from "./plan-shared"
import { NoticeSlot } from "./plan-ui"

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
 *
 * A PLAN OWNS ITS WORLD (owner ruling 2026-08-05, the architecture; write-
 * through died 2026-08-07). These numbers belong to the PLAN, not the season,
 * so where they are written depends on which plan is open and nothing else:
 *
 *   - any chosen plan that is not the read-only reference, the active plan
 *     included → the plan document's own world. The season's divisions never
 *     move from here; only the generate button, elsewhere, takes a plan's
 *     numbers on for the season.
 *   - the imported reference → read only. It is the record of what the league
 *     published, estimates included.
 *   - nothing open → the season's rows, READ ONLY: there is no plan to write
 *     to, and there is no season write path left either (see `worldReadOnly`).
 *     Add-a-grade is the one exception, a season fact untouched by sandboxing.
 *
 * IN OR OUT is part of it (owner: "grade estimates + in/out"). A grade taken out
 * of a plan asks for no games and places no chip on step 3, and it keeps its
 * number so putting it back costs nothing. REMOVE is the stronger sibling
 * (owner ruling 2026-08-07, #8 first half): it drops the grade from the
 * plan's units entirely, and the grade comes back as the ordinary
 * "not planned yet" season fold-in row — the ADD path is the restore path.
 *
 * TEAM-EXCLUDE (owner ruling 2026-08-07, #8 second half) is the other half of
 * removal: a plan can keep a grade but leave specific REGISTERED teams out of
 * it. `world.excludedTeamIds` carries the list; see the Manage teams
 * disclosure on each grade row.
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

/** One editable row of step 1: the grade, the number this plan runs on, whether
 *  the plan holds it at all, and the registration overlay beside it. */
interface GradeRow {
  key: string
  label: string
  divisionIds: string[]
  /** What the plan (or the season) has as the estimate. */
  expected: number
  /** Teams really registered. Overlay only, never a floor. */
  approved: number
  included: boolean
  /**
   * AN OPERATOR HAS ANSWERED THE QUESTION for this grade, zero included. A
   * saved 0 is "this grade runs no teams"; only a grade NOBODY has estimated
   * seeds its stepper from registrations. Conflating the two is the bug where
   * minus-to-0 bounced back to the registration count after the save landed.
   */
  hasEstimate: boolean
  /**
   * IS THIS ROW REALLY A UNIT OBJECT IN THE PLAN'S WORLD (owner ruling
   * 2026-08-07, #8 first half), or is it here only because it folded in from
   * the season? "Remove from this plan" only makes sense on the former — a
   * folded-in row has nothing of the plan's to remove yet.
   */
  inPlanUnits: boolean
}

/** A registered team, as the exclude picker needs it: who it is and which
 *  grade cluster it belongs to. Read off `GET /api/seasons/[id]`'s own
 *  `teamSubmissions` — the same field the console's teams tab already reads —
 *  because there is no dedicated per-grade roster endpoint, and this file may
 *  not add one. */
interface RegisteredTeam {
  teamId: string
  name: string
  divisionId: string | null
}

/**
 * TEAM-EXCLUDE (owner ruling 2026-08-07, #8 second half) widens PlanWorld
 * with the one field this ruling adds. Declared locally rather than in
 * plan-documents.ts — that file is not this file's to touch, and the other
 * agent building the server contract declared the very same shape locally in
 * season-plans.ts for the same reason. A zod-parsed world structurally
 * satisfies it either way, and passing one to `session.saveWorld` (typed
 * `PlanWorld`) is fine: an object with one extra optional property is still
 * a `PlanWorld`.
 */
type PlanWorldWithExclusions = PlanWorld & {
  excludedTeamIds?: string[]
  /**
   * DIVISIONS ARE MADE FROM REAL NUMBERS AT PLAN TIME (owner ruling
   * 2026-08-09): per grade cluster, how many divisions it runs as. Plan-
   * scoped intent like everything else in the sandbox; it becomes real
   * Division rows (teams snake-dealt deterministically, fine-tuning board
   * to follow) only when the one button generates. Key = the grade row key.
   */
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
  /** Registered teams for the exclude picker (owner ruling 2026-08-07, #8
   *  second half): the season's own teamSubmissions, read only, independent
   *  of which plan is open. */
  const [teams, setTeams] = useState<RegisteredTeam[]>([])
  /** Which grade's "Manage teams" disclosure is open, one at a time — the
   *  same pattern step 2's bookings picker uses. */
  const [teamsOpenFor, setTeamsOpenFor] = useState<string | null>(null)

  /**
   * WHOSE NUMBERS THESE ARE. The plan ROW decides it and is known the instant
   * the operator chooses; the DOCUMENT arrives a moment later, and until it does
   * the steppers are disabled. The season is never the fallback in that gap —
   * the 2026-08-05 drive caught exactly that on step 2, where a click in the gap
   * wrote to the league's real calendar.
   */
  /**
   * TWO QUESTIONS, NOT ONE (the old-plan fix, 2026-08-06 wave): whose numbers
   * are DRAWN, and whose are WRITTEN. Any chosen plan with a world draws it,
   * the active plan and the read-only reference both included, so this step
   * and the board can never show two different plans. Only a plan that is not
   * the reference writes it.
   */
  const readsWorld = session.readsPlanWorld
  const pending = session.editsPlanWorld && session.world === null
  const editsWorld = session.editsPlanWorld && session.world !== null
  const readOnly = locked || isReferencePlan(session.chosen) || pending
  /**
   * THE STEPPER NEEDS A PLAN'S WORLD TO WRITE INTO (owner ruling 2026-08-07,
   * #1 and #2: plans are sandboxes, full stop, and write-through died). With
   * nothing open there is no season fallback any more, so the numbers still
   * SHOW the season's own (readsWorld is false, so `rows` already falls back
   * to the live season units) but cannot be typed into until a plan is
   * chosen. Add-a-grade is exempt — it is a season fact, not sandboxed
   * content, so it keeps the plainer `readOnly` gate below.
   */
  const worldReadOnly = readOnly || !session.planId

  // Refs so the debounced save always sends the LATEST numbers without
  // re-arming itself on every keystroke of the stepper.
  const countsRef = useRef(counts)
  const unitsRef = useRef<PlannerUnit[]>([])
  const dirtyRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The plan's world as the pending save will send it, so a stepper moved
   *  three times in a second lands as one write of the latest numbers. */
  const worldRef = useRef<PlanWorld | null>(null)

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
    setLastSeason(data.lastSeasonTeams ?? null)
    setLocked(LOCKED_STATUSES.includes(data.seasonStatus))
    onLoaded?.({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })

    /**
     * REGISTERED TEAMS, FOR THE EXCLUDE PICKER (owner ruling 2026-08-07, #8
     * second half). No dedicated per-grade roster endpoint exists, so this
     * reads the same season payload the console's own teams tab already
     * builds `teams` from (`GET /api/seasons/[id]` → `teamSubmissions`).
     * Read only, and optional: a failed read just leaves the disclosure with
     * nothing to list, which is honest rather than blocking the screen.
     */
    const seasonRes = await fetch(`/api/seasons/${seasonId}`, { cache: "no-store" }).catch(
      () => null
    )
    const seasonData = seasonRes?.ok ? await seasonRes.json().catch(() => null) : null
    const submissions = (seasonData?.teamSubmissions ?? []) as Array<{
      status: string
      divisionId: string | null
      team: { id: string; name: string }
    }>
    setTeams(
      submissions
        .filter((s) => s.status === "APPROVED")
        .map((s) => ({ teamId: s.team.id, name: s.team.name, divisionId: s.divisionId }))
    )
  }, [seasonId, onLoaded])

  useEffect(() => {
    load()
  }, [load])

  /**
   * THE ROWS THIS SCREEN EDITS. On any chosen plan, active included, they are
   * the plan's units; with nothing open they are the season's, read only.
   *
   * Either way the season's live grades are folded in, so a grade added to the
   * season after the plan was made shows up here as a row the operator can put a
   * number on rather than as something they have to go and find. It arrives OUT
   * of the plan, because a plan never placed a grade it has not heard of. A
   * grade REMOVED from the plan (withUnitRemoved) folds in the very same way —
   * that fold-in IS the restore path.
   */
  const rows: GradeRow[] = useMemo(() => {
    const live = state?.units ?? []
    if (!readsWorld) {
      return live.map((u) => ({
        key: u.key,
        label: u.label,
        divisionIds: u.divisionIds,
        expected: u.expected,
        approved: u.approved,
        included: u.expected > 0,
        hasEstimate: u.source === "expected",
        inPlanUnits: false,
      }))
    }
    const world = session.world as PlanWorld
    const byKey = new Map((world.units ?? []).map((u) => [u.key, u]))
    const order = [
      ...(world.units ?? []).map((u) => u.key),
      ...live.map((u) => u.key).filter((k) => !byKey.has(k)),
    ]
    return [...new Set(order)].map((key) => {
      const inPlan = byKey.get(key)
      const inSeason = live.find((u) => u.key === key)
      return {
        key,
        label: inPlan?.label ?? inSeason?.label ?? key.replace(/^age:/, ""),
        divisionIds: inSeason?.divisionIds ?? inPlan?.divisionIds ?? [],
        expected: inPlan?.teams ?? 0,
        // Registration is the SEASON's, always: it is what really happened, and
        // a plan's snapshot of it goes stale the day somebody signs up.
        approved: inSeason?.approved ?? 0,
        included: inPlan ? unitIncluded(inPlan) : false,
        // Older documents never stamped `source`, so a positive number is its
        // own proof; a zero counts only when the write stamped it.
        hasEstimate: inPlan ? inPlan.source === "expected" || inPlan.teams > 0 : false,
        inPlanUnits: Boolean(inPlan),
      }
    })
  }, [state, readsWorld, session.world])

  const gamesPerTeam = readsWorld
    ? (session.world?.gamesPerTeam ?? 0)
    : (state?.gamesPerTeam ?? 0)

  // The steppers start from what is saved, whichever document that is. A grade
  // NOBODY has estimated starts from the teams already registered, so + counts
  // up from reality instead of from zero — a hint, never a floor. A SAVED
  // estimate is the answer whatever it is: a deliberate 0 stays 0.
  useEffect(() => {
    const seeded = Object.fromEntries(
      // Reality leads (owner 2026-08-10): once real registrations pass a
      // saved estimate, the real count IS the number — a stale forecast
      // must never under-read a grade that already filled up.
      rows.map((r) => [r.key, r.hasEstimate ? Math.max(r.expected, r.approved) : r.approved])
    )
    // Every save's response lands back here (the doc version moves), and the
    // document it carries predates any click made while the write was in
    // flight. A grade still mid-edit keeps the operator's number.
    for (const key of dirtyRef.current) {
      if (key in countsRef.current) seeded[key] = countsRef.current[key]
    }
    setCounts(seeded)
    countsRef.current = seeded
    unitsRef.current = rows.map((r) => ({
      key: r.key,
      label: r.label,
      divisionIds: r.divisionIds,
      teams: r.expected,
      approved: r.approved,
      expected: r.expected,
      source: r.hasEstimate ? "expected" : "none",
    }))
    worldRef.current = session.world
    // Keyed on the DOCUMENT, so switching plans reseeds; a save reseeds too
    // (the version bumps), which is why dirty grades are carried over above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.planId, session.docVersion, state])

  /**
   * Send every grade touched since the last flush, into the plan's own
   * world. One PATCH of the whole world, whichever plan is open.
   *
   * THE SEASON PATCH BRANCH IS GONE (owner ruling 2026-08-07, #1 and #2:
   * plans are sandboxes, full stop, and write-through died). It used to write
   * expected-team updates straight onto the season's divisions, for the
   * active plan and for "nothing open" alike; there is no plan world to write
   * into in either of those states any more that the season may stand in
   * for, so with nothing open the stepper is disabled (`worldReadOnly`) and
   * this function is simply never called.
   */
  const flush = useCallback(async () => {
    const keys = [...dirtyRef.current]
    dirtyRef.current.clear()
    if (keys.length === 0) return
    // The plan's world has not arrived, so there is nothing to write it into.
    if (pending) return
    // Nothing open, or the reference plan: no plan world exists to hold
    // this. The stepper is disabled in that state (worldReadOnly), so this
    // guard should not normally be reached.
    if (!editsWorld) return

    let world = worldRef.current ?? session.world
    if (!world) return
    for (const key of keys) {
      const teams = countsRef.current[key] ?? 0
      // A grade the plan has never held has to be added before it can be
      // numbered, or the edit would land on nothing.
      if (!(world.units ?? []).some((u) => u.key === key)) {
        const row = unitsRef.current.find((u) => u.key === key)
        world = {
          ...world,
          units: [
            ...(world.units ?? []),
            {
              key,
              label: row?.label ?? key.replace(/^age:/, ""),
              divisionIds: row?.divisionIds ?? [],
              teams: 0,
              approved: row?.approved ?? 0,
              expected: 0,
              source: "none",
              included: false,
            },
          ],
        }
      }
      world = withUnitTeams(world, key, teams)
    }
    worldRef.current = world
    const ok = await session.saveWorld(world)
    setSaving(ok ? "saved" : "idle")
    setError(ok ? null : "That didn't save. Try again.")
  }, [editsWorld, pending, session])

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

  const bump = (row: GradeRow, delta: number) => {
    if (worldReadOnly) return
    setCounts((prev) => {
      const now = Math.min(MAX_PER_GRADE, Math.max(0, (prev[row.key] ?? 0) + delta))
      return { ...prev, [row.key]: now }
    })
    dirtyRef.current.add(row.key)
    setSaving("saving")
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void flush()
    }, SAVE_DEBOUNCE_MS)
  }

  /**
   * IN OR OUT OF THIS PLAN (owner ruling 2026-08-05). Only a plan can hold a
   * grade out: on the season's own rows "out" would mean deleting the division,
   * which is a different and much bigger thing than "this plan does not run it".
   */
  const setIncluded = async (row: GradeRow, included: boolean) => {
    if (readOnly || !editsWorld) return
    await flushNow()
    const world = worldRef.current ?? session.world
    if (!world) return
    setSaving("saving")
    const next = withUnitIncluded(world, row.key, included)
    worldRef.current = next
    const ok = await session.saveWorld(next)
    setSaving(ok ? "saved" : "idle")
    if (!ok) setError("That didn't save. Try again.")
  }

  /**
   * REMOVE FROM THIS PLAN, ENTIRELY (owner ruling 2026-08-07, #8 first half).
   * Stronger than the in/out toggle: this drops the unit object outright, so
   * the grade falls back to the ordinary "not planned yet" season fold-in row
   * — add-a-grade's stepper is the restore path, and confirming re-adds it
   * with a fresh number, not the one just discarded. Confirmed first when
   * there is a real number to lose.
   */
  const removeGrade = async (row: GradeRow) => {
    if (readOnly || !editsWorld || !row.inPlanUnits) return
    const value = countsRef.current[row.key] ?? row.expected
    if (
      value > 0 &&
      !window.confirm(
        `Remove ${row.label} from this plan? It is set to ${value} team${value === 1 ? "" : "s"}, and this plan will forget that number. You can add it back any time.`
      )
    ) {
      return
    }
    // A pending stepper edit for this grade is about to be discarded with
    // the row itself, so it must not fire afterward and quietly re-add what
    // was just removed.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    dirtyRef.current.delete(row.key)
    const world = worldRef.current ?? session.world
    if (!world) return
    setSaving("saving")
    const next = withUnitRemoved(world, row.key)
    worldRef.current = next
    const ok = await session.saveWorld(next)
    setSaving(ok ? "saved" : "idle")
    if (!ok) setError("That didn't save. Try again.")
  }

  /**
   * TEAM-EXCLUDE (owner ruling 2026-08-07, #8 second half): the registered
   * teams one grade cluster has, and which of the plan's excluded ids they
   * carry. `excludedTeamIds` only means anything inside a plan's own world,
   * so it reads null outside `readsWorld`.
   */
  const gradeTeams = useCallback(
    (divisionIds: string[]) => teams.filter((t) => t.divisionId && divisionIds.includes(t.divisionId)),
    [teams]
  )
  const excludedTeamIds = useMemo(() => {
    const world = readsWorld ? (session.world as PlanWorldWithExclusions | null) : null
    return new Set(world?.excludedTeamIds ?? [])
  }, [readsWorld, session.world])
  const toggleExcludedTeam = async (teamId: string) => {
    if (!editsWorld || readOnly) return
    const world = (worldRef.current ?? session.world) as PlanWorldWithExclusions | null
    if (!world) return
    const current = new Set(world.excludedTeamIds ?? [])
    if (current.has(teamId)) current.delete(teamId)
    else current.add(teamId)
    const next: PlanWorldWithExclusions = { ...world, excludedTeamIds: [...current] }
    worldRef.current = next
    setSaving("saving")
    const ok = await session.saveWorld(next)
    setSaving(ok ? "saved" : "idle")
    if (!ok) setError("That didn't save. Try again.")
  }

  /**
   * One tap that turns the teams already in into an estimate, for the grades
   * that have no estimate at all. Still the operator's decision, and still
   * their number after: a grade they already put a number on is left exactly
   * as they left it, even when more teams than that have registered.
   */
  const startFromRegistrations = () => {
    if (worldReadOnly) return
    const next = { ...countsRef.current }
    for (const r of rows) {
      if (r.approved <= 0 || r.hasEstimate) continue
      next[r.key] = Math.min(MAX_PER_GRADE, r.approved)
      dirtyRef.current.add(r.key)
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
    if (!ageGroup || addingGrade || readOnly) return
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
      // operator's estimate per grade, and only that. A grade this plan holds
      // OUT asks for nothing, so it counts for nothing.
      teams: rows.reduce(
        (sum, r) => sum + (r.included || !readsWorld ? planningTeams(r.approved, counts[r.key] ?? 0) : 0),
        0
      ),
      // The season's promise to a team, straight off the world on screen.
      gamesPerTeam,
    }),
    [rows, counts, gamesPerTeam, readsWorld]
  )

  if (!state) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Loading your grades…"}</p>
  }

  const games = Math.round((totals.teams * totals.gamesPerTeam) / 2)
  const anyApproved = rows.some((r) => r.approved > 0)
  // Grades with teams in and no estimate at all: the season has entries the
  // plan leaves out entirely. One tap fixes every one of them at once. A
  // grade DELIBERATELY set to 0 is not one of these — that question is
  // answered.
  const unplanned = rows.filter((r) => r.approved > 0 && !r.hasEstimate)
  const allUnplanned = rows.length > 0 && unplanned.length === rows.length

  return (
    <div className="border-ink-200 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-200 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">How many teams do you expect?</p>
          <p className="text-ink-500 text-xs">
            Estimate your teams. Registrations inform the numbers, they never decide them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* THE PLAN IS CHOSEN HERE (owner ruling 2026-08-05, #1) — and ONLY
              here, one control at a time (2026-08-06, B2): with nothing open
              the big card below is the chooser, so the header shows this one
              only once a plan is in hand. Two pickers on one screen was the
              duplication the analysis called out. */}
          {session.planId && <PlanChooser locked={locked} testId="step1-plan-chooser" />}
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
            detail="A plan is one named calendar for this season. Open one of yours, or start a new one and the planner builds a balanced calendar you can change. The numbers below are read only until you do — every plan is its own sandbox now, so there is no season fallback to write into."
            testId="step1-plan-empty"
          />
        </div>
      )}
      {session.planId && (
        <p
          className="border-ink-100 bg-court-50/60 text-court-900 border-b px-5 py-2 text-[12px]"
          data-testid="step1-plan-line"
          data-world={pending ? "loading" : "plan"}
        >
          Working in <b>{session.chosen?.name ?? "your plan"}</b>.{" "}
          {isReferencePlan(session.chosen)
            ? "This is the imported reference, so its numbers are read only. Start a plan of your own to change them."
            : pending
              ? "Opening this plan's numbers…"
              : "These numbers belong to this plan."}
        </p>
      )}

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so team counts are read only now.
          </p>
        )}
        {!locked && isReferencePlan(session.chosen) && (
          <p
            className="border-ink-200 bg-ink-50 text-ink-600 mb-4 rounded-xl border px-4 py-2.5 text-sm"
            data-testid="step1-reference-note"
          >
            {PLAN_COPY.reference}
          </p>
        )}
        <NoticeSlot testId="step1-notice" error={error} className="mb-4" />

        {/* Entries are in and nothing is planned. Offer the shortcut once,
            as a suggestion the operator commits with one tap. Needs a plan's
            world to write into, same as the steppers (worldReadOnly). */}
        {!worldReadOnly && unplanned.length > 0 && (
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

        {rows.length === 0 ? (
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
              {rows.map((row) => {
                const value = counts[row.key] ?? 0
                // Units are grade clusters keyed "age:<ageGroup>", which is
                // exactly how last season's counts come back.
                const ageGroup = row.key.startsWith("age:") ? row.key.slice(4) : row.label
                const history = lastSeason?.[ageGroup]
                // What this grade actually plans on, the way the server reads
                // it: the operator's estimate. Growth is measured against that.
                const planned = planningTeams(row.approved, value)
                // More teams came than were planned for. Not an error, and it
                // does not quietly grow the plan: the operator decides whether
                // to raise the number.
                const over = row.approved > value
                // Nobody has estimated this grade yet, so whatever the stepper
                // is showing is a hint, not a plan. A saved 0 does not land
                // here: that grade IS planned, at nothing.
                const notPlanned = !row.hasEstimate
                /** Out of THIS plan: the row stays, greyed, with its number
                 *  intact, because putting it back must not cost a retype. */
                const out = readsWorld && !row.included
                /** The "+" of this row's stepper, so the empty-estimate chip can
                 *  hand the operator straight to the control that fills it. */
                const plusId = `grade-plus-${row.key.replace(/[^a-z0-9]+/gi, "-")}`
                return (
                  <tr
                    key={row.key}
                    data-testid="grade-row"
                    data-grade={row.key}
                    data-in={out ? "0" : "1"}
                    className={`border-ink-100 border-t ${out ? "opacity-55" : ""}`}
                  >
                    <td className="text-ink-900 py-2.5 pr-4 text-sm font-bold">{row.label}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        role="group"
                        aria-label={`Expected teams for ${row.label}`}
                        className="border-ink-300 inline-flex h-9 items-center rounded-lg border bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          disabled={worldReadOnly || out || value <= 0}
                          onClick={() => bump(row, -1)}
                          aria-label={`One fewer ${row.label} team`}
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
                          id={plusId}
                          disabled={worldReadOnly || out || value >= MAX_PER_GRADE}
                          onClick={() => bump(row, 1)}
                          aria-label={`One more ${row.label} team`}
                          className="text-ink-700 hover:bg-ink-100 hover:text-ink-900 h-full w-9 cursor-pointer rounded-r-lg text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* IN OR OUT of this plan (owner ruling 2026-08-05).
                            Only a plan can hold a grade out: on the season's
                            own rows that would mean deleting the division. */}
                        {editsWorld && !readOnly && (
                          <button
                            type="button"
                            data-testid="grade-in-out"
                            data-in={out ? "0" : "1"}
                            aria-pressed={!out}
                            disabled={session.docBusy}
                            onClick={() => void setIncluded(row, out)}
                            className={`min-h-[26px] cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              out
                                ? "border-ink-300 text-ink-600 hover:border-ink-400 hover:bg-ink-50 bg-white"
                                : "border-court-200 bg-court-50 text-court-800 hover:border-court-400"
                            }`}
                          >
                            {out ? "Not in this plan" : "In this plan"}
                          </button>
                        )}
                        {/* REMOVE FROM THIS PLAN, ENTIRELY (owner ruling
                            2026-08-07, #8 first half). Stronger than the
                            in/out toggle above: that keeps the row and its
                            number for a free restore, this drops the unit
                            object outright. Only offered on a row that IS a
                            unit in the plan's world — a folded-in season row
                            has nothing of the plan's to remove yet. */}
                        {editsWorld && !readOnly && row.inPlanUnits && (
                          <button
                            type="button"
                            data-testid="grade-remove"
                            onClick={() => void removeGrade(row)}
                            className="text-ink-400 hover:text-hoop-700 cursor-pointer text-[11px] font-semibold underline decoration-dotted underline-offset-2"
                          >
                            Remove from this plan
                          </button>
                        )}
                        {/* Planning currency, and nothing else: what this
                            grade asks the season for. Not a link to its
                            games — those do not exist yet, and this is the
                            planning phase (owner ruling 2026-08-03). */}
                        {!out && planned > 0 && totals.gamesPerTeam > 0 && (
                          <span data-testid="grade-games" className={CHIP_QUIET}>
                            {Math.round((planned * totals.gamesPerTeam) / 2)} games
                          </span>
                        )}
                        {row.approved > 0 && (
                          <span
                            data-testid="registered-chip"
                            data-over={over ? "1" : "0"}
                            className={over && !out ? CHIP_WARN : CHIP_QUIET}
                          >
                            {over && !out
                              ? `${row.approved} registered, over the estimate`
                              : `${row.approved} registered`}
                          </span>
                        )}
                        {/**
                          * A GRADE WITH NO ESTIMATE (owner 2026-08-06: "not user
                          * friendly or obvious it can be clicked").
                          *
                          * This was four grey words at the end of a row. It reads
                          * as a status the operator has to accept, when it is
                          * really the one row on the table with something left to
                          * do — and the thing that does it, the stepper, is a few
                          * inches to the left with nothing pointing at it.
                          *
                          * So it wears the treatment every other actionable thing
                          * on this screen wears: a dashed outline, a pointer, a
                          * hover, and copy that names the next move. It changes
                          * NOTHING about the plan; it puts the cursor on the
                          * control that always did the work.
                          */}
                        {notPlanned && !out && !worldReadOnly && (
                          <button
                            type="button"
                            data-testid="not-planned"
                            aria-label={`${row.label} has no estimate yet. Add one.`}
                            onClick={() => document.getElementById(plusId)?.focus()}
                            /* SOLIDLY OUTLINED, DARK LABEL (owner ruling
                               2026-08-06, the affordance sweep, second
                               occurrence). Dashed grey is for EMPTY STATES; a
                               control that reads as one is a control nobody
                               presses. */
                            className={`${BTN_SECONDARY} ${BTN_SM} rounded-full`}
                          >
                            Not in the plan yet · add an estimate
                          </button>
                        )}
                        {notPlanned && !out && worldReadOnly && (
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
                      {/* TEAM-EXCLUDE (owner ruling 2026-08-07, #8 second
                          half): a plan can keep a grade but leave specific
                          registered teams out of it. Only meaningful inside a
                          plan's own world, so only offered while readsWorld —
                          and only when this grade actually has registered
                          teams to manage. */}
                      {/* Division formation LEFT this page (owner ruling
                          2026-08-09): planning is gyms and capacity; divisions
                          are a SCHEDULING decision made when the league locks,
                          in their own guided flow. Grade counts are all
                          planning ever needed. */}
                      {readsWorld && gradeTeams(row.divisionIds).length > 0 && (
                        <TeamsDisclosure
                          teams={gradeTeams(row.divisionIds)}
                          excluded={excludedTeamIds}
                          canEdit={editsWorld && !readOnly}
                          open={teamsOpenFor === row.key}
                          onToggleOpen={() =>
                            setTeamsOpenFor(teamsOpenFor === row.key ? null : row.key)
                          }
                          onToggleTeam={(teamId) => void toggleExcludedTeam(teamId)}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Add a grade here rather than sending the operator to a settings
            tab mid-plan. Same endpoint the settings tab uses: a grade is a
            SEASON fact (a division exists or it does not), and whether a plan
            runs it is the in/out toggle on the row. */}
        {!readOnly && (
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
                className={`${BTN_SECONDARY} ${BTN_MD}`}
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
        {rows.length > 0 && (
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
            Next you&apos;ll name the buildings that hold them.
          </div>
        )}

        <p className="text-ink-400 mt-3 h-4 text-xs" aria-live="polite">
          {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved." : ""}
        </p>
      </div>
    </div>
  )
}

/**
 * "MANAGE TEAMS (N)" — collapsed, one grade at a time (owner ruling
 * 2026-08-07, #8 second half). A plan can keep a grade but leave specific
 * registered teams out of the calendar it draws; this lists them by name
 * with an exclude toggle each. Excluded teams read struck through, with
 * "not in this plan" — the same honesty the grade row's own out state wears.
 */
function TeamsDisclosure({
  teams,
  excluded,
  canEdit,
  open,
  onToggleOpen,
  onToggleTeam,
}: {
  teams: RegisteredTeam[]
  excluded: Set<string>
  /** False while nothing is open, on the reference, or while a chosen plan's
   *  world is still loading — the toggle is shown but goes quiet. */
  canEdit: boolean
  open: boolean
  onToggleOpen: () => void
  onToggleTeam: (teamId: string) => void
}) {
  return (
    <div className="mt-1.5 w-full">
      <button
        type="button"
        data-testid="manage-teams-open"
        onClick={onToggleOpen}
        className="text-ink-500 hover:text-ink-800 cursor-pointer text-[11px] font-bold underline underline-offset-2"
      >
        {open ? "Hide teams" : `Manage teams (${teams.length})`}
      </button>
      {open && (
        <ul
          data-testid="manage-teams-list"
          className="border-ink-100 mt-1.5 flex flex-col gap-1 rounded-lg border bg-white p-2"
        >
          {teams.map((t) => {
            const isOut = excluded.has(t.teamId)
            return (
              <li key={t.teamId} className="flex items-center justify-between gap-2 text-[12px]">
                <span className={isOut ? "text-ink-400 line-through" : "text-ink-800"}>
                  {t.name}
                  {isOut && (
                    <span className="text-ink-400 ml-1.5 text-[10.5px] no-underline">
                      not in this plan
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  data-testid="team-exclude-toggle"
                  data-team-id={t.teamId}
                  data-excluded={isOut ? "1" : "0"}
                  disabled={!canEdit}
                  onClick={() => onToggleTeam(t.teamId)}
                  className={`min-h-[24px] shrink-0 cursor-pointer rounded-full border px-2 text-[10.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                    isOut
                      ? "border-court-200 bg-court-50 text-court-800 hover:border-court-400"
                      : "border-ink-300 text-ink-600 hover:border-ink-400 hover:bg-ink-50 bg-white"
                  }`}
                >
                  {isOut ? "Include" : "Exclude"}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
