"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { suggestPlanName, type PlanDocument, type PlanRow } from "@/lib/scheduler/plan-documents"
import { PlanPicker } from "./plan-picker"

/**
 * WHICH PLAN THE WIZARD IS WORKING IN (owner rulings 2026-08-05, #1 and #2).
 *
 * Two rules, and they are the reason this state lives above the steps rather
 * than inside the board:
 *
 *  1. THE PLAN IS CHOSEN AT STEP 1. Creating or opening a plan document is the
 *     first thing an operator does, not something they discover on the board
 *     five months of calendar later. So the picker and "New plan" are drawn in
 *     step 1's header, and step 3 keeps a compact copy for switching mid-flight.
 *  2. NOTHING IS SELECTED UNTIL SOMEBODY SELECTS IT. A visit starts with no
 *     plan open, whatever the season is running: the board and step 1 both ask
 *     "open a plan or start a new one" instead of quietly putting the league's
 *     imported reference calendar under the operator's hands.
 *
 * The selection lives for the visit. Walking step 1 → 2 → 3 keeps the plan you
 * chose; a reload starts clean, which is the point of rule 2.
 */

export interface PlanSession {
  /** Every plan this season holds, active first. */
  plans: PlanRow[]
  /** The plan the operator opened THIS VISIT. Null means nothing is open, and
   *  that is the state every visit starts in. */
  planId: string | null
  chosen: PlanRow | null
  /** The plan the season actually runs. It drives everything downstream of the
   *  wizard; it is deliberately NOT what the wizard opens on. */
  active: PlanRow | null
  loading: boolean
  creating: boolean
  error: string | null
  /** The plan the solver just built for us, so the board can say so once. */
  lastCreatedId: string | null
  choose: (planId: string | null) => void
  createNew: () => Promise<PlanRow | null>
  /** Re-read the list (after a save, an activate, a rename). */
  refresh: () => Promise<PlanRow[]>
  /** Let a step hand back the list it already fetched. */
  setPlans: (plans: PlanRow[]) => void
}

const Ctx = createContext<PlanSession | null>(null)

export function usePlanSession(): PlanSession {
  const value = useContext(Ctx)
  if (!value) throw new Error("usePlanSession outside PlanSessionProvider")
  return value
}

export function PlanSessionProvider({
  seasonId,
  children,
}: {
  seasonId: string
  children: ReactNode
}) {
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [planId, setPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/plans`, { cache: "no-store" }).catch(
      () => null
    )
    const data = res?.ok ? await res.json().catch(() => null) : null
    const rows = (data?.plans ?? []) as PlanRow[]
    setPlans(rows)
    setLoading(false)
    return rows
  }, [seasonId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /**
   * A brand new plan, made BY the system (owner 2026-08-02: "I want the system
   * to make a new plan, not me manually generate it"). The solver builds a
   * balanced calendar in the season's own world, it is written down as a plan
   * with a name nobody had to invent, and it becomes the plan this visit is
   * working in. Nothing is applied to the season.
   */
  const createNew = useCallback(async () => {
    setCreating(true)
    setError(null)
    const proposal = await fetch(`/api/seasons/${seasonId}/planner/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lever: "balance" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
    if (!proposal?.assignment) {
      setCreating(false)
      setError("Couldn't build a new plan. Try again.")
      return null
    }
    const res = await fetch(`/api/seasons/${seasonId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: suggestPlanName(plans),
        assignment: proposal.assignment,
        venues: proposal.venues ?? {},
        source: "proposed",
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setCreating(false)
    if (!res?.ok || !data?.plan) {
      setError(data?.error ?? "That plan didn't save. Try again.")
      return null
    }
    const plan = data.plan as PlanDocument
    const rows = await refresh()
    setPlanId(plan.id)
    setLastCreatedId(plan.id)
    return rows.find((p) => p.id === plan.id) ?? null
  }, [seasonId, plans, refresh])

  const value = useMemo<PlanSession>(
    () => ({
      plans,
      planId,
      chosen: plans.find((p) => p.id === planId) ?? null,
      active: plans.find((p) => p.isActive) ?? null,
      loading,
      creating,
      error,
      lastCreatedId,
      choose: (id) => {
        setPlanId(id)
        if (id !== lastCreatedId) setLastCreatedId(null)
      },
      createNew,
      refresh,
      setPlans,
    }),
    [plans, planId, loading, creating, error, lastCreatedId, createNew, refresh]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ------------------------------ the controls ------------------------------ */

/** A real button, so a control never reads as a caption (2026-08-05 clarity
 *  pass): filled for the one that makes something, outlined for the rest. */
export const PLAN_BTN_PRIMARY =
  "border-play-600 bg-play-600 text-white hover:bg-play-700 hover:border-play-700 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
export const PLAN_BTN_QUIET =
  "border-ink-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"

function PlusMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
      className="h-3.5 w-3.5 shrink-0"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/**
 * The plan controls, wherever a step puts them: which plan you are in, and the
 * one button that makes another. Step 1 wears the full version in its header;
 * step 3 wears the same thing, compact, so switching mid-flight is one tap.
 */
export function PlanChooser({
  locked,
  busy = false,
  compact = false,
  onBeforeChange,
  testId = "plan-chooser",
}: {
  locked: boolean
  /** The step is mid-write, so the controls wait their turn. */
  busy?: boolean
  compact?: boolean
  /** Return false to keep the current plan (unsaved work the operator kept). */
  onBeforeChange?: () => boolean
  testId?: string
}) {
  const session = usePlanSession()
  const guard = () => (onBeforeChange ? onBeforeChange() : true)
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <PlanPicker
        plans={session.plans}
        selectedId={session.planId}
        busy={busy || session.creating}
        creating={session.creating}
        onSelect={(id) => {
          if (!guard()) return
          session.choose(id)
        }}
      />
      {!locked && (
        <button
          type="button"
          data-testid="plan-new"
          disabled={busy || session.creating}
          onClick={(e) => {
            e.stopPropagation()
            if (!guard()) return
            void session.createNew()
          }}
          className={compact ? PLAN_BTN_QUIET : PLAN_BTN_PRIMARY}
        >
          <PlusMark />
          {session.creating ? "Building a new plan…" : "New plan"}
        </button>
      )}
    </div>
  )
}

/**
 * NOTHING IS OPEN YET (owner ruling 2026-08-05, #2). The fresh working state:
 * two clear buttons and no calendar under them, because the league's own
 * imported plan is not something the wizard should put in your hands without
 * being asked.
 */
export function PlanEmptyState({
  locked,
  busy = false,
  heading = "Open a plan or start a new one",
  detail,
  testId = "plan-empty",
}: {
  locked: boolean
  busy?: boolean
  heading?: string
  detail?: string
  testId?: string
}) {
  const session = usePlanSession()
  const none = session.plans.length === 0
  const said =
    detail ??
    (none
      ? "This season has no plans yet. Start one and the planner builds a balanced calendar you can change."
      : "A plan is one named calendar for this season. Open one of yours, or start a new one and the planner builds it for you.")
  return (
    <div
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
      className="border-ink-200 bg-ink-50/70 rounded-2xl border border-dashed px-5 py-6 text-center"
    >
      <p className="text-ink-900 text-[15px] font-bold">{heading}</p>
      <p className="text-ink-600 mx-auto mt-1 max-w-md text-[12.5px]">{said}</p>
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
        {!none && (
          <PlanPicker
            plans={session.plans}
            selectedId={session.planId}
            busy={busy || session.creating}
            label="Open a plan"
            variant="button"
            testId="plan-open"
            onSelect={(id) => session.choose(id)}
          />
        )}
        {!locked && (
          <button
            type="button"
            data-testid="plan-start-new"
            disabled={busy || session.creating}
            onClick={(e) => {
              e.stopPropagation()
              void session.createNew()
            }}
            className={PLAN_BTN_PRIMARY}
          >
            <PlusMark />
            {session.creating ? "Building a new plan…" : "Start a new plan"}
          </button>
        )}
      </div>
      {session.error && (
        <p className="text-hoop-700 mt-2 text-[11.5px] font-semibold">{session.error}</p>
      )}
      {locked && none && (
        <p className="text-ink-400 mt-2 text-[11.5px]">
          This season is finalized, so no new plan can be written.
        </p>
      )}
    </div>
  )
}
