"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  isReferencePlan,
  planOpenState,
  suggestPlanName,
  PLAN_NAME_MAX,
  type PlanDocument,
  type PlanOpenState,
  type PlanRow,
  type PlanWorld,
} from "@/lib/scheduler/plan-documents"
import { PlanPicker } from "./plan-picker"
import { BTN_MD, BTN_PRIMARY, BTN_SECONDARY } from "./plan-shared"

/**
 * WHICH PLAN THE WIZARD IS WORKING IN (owner rulings 2026-08-05, #1 and #2).
 *
 * Two rules, and they are the reason this state lives above the steps rather
 * than inside the board:
 *
 *  1. THE PLAN IS CHOSEN AT STEP 1. Creating or opening a plan document is the
 *     first thing an operator does, not something they discover on the board
 *     five months of calendar later. So the picker and "New plan" are drawn in
 *     step 1's header only; every other step just says which plan it is in
 *     (PlanBadge) and links back to step 1 to change it.
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
  /**
   * THE SELECTED PLAN'S WHOLE DOCUMENT, held HERE (owner ruling 2026-08-05, the
   * architecture): steps 1, 2 and 3 all read and write this one object, so the
   * numbers on step 1, the gyms on step 2 and the calendar on step 3 can never
   * be three different answers. Null while nothing is open or the fetch is in
   * flight.
   */
  doc: PlanDocument | null
  /** The plan's own world, or null on a row saved before plans had one. */
  world: PlanWorld | null
  /**
   * Bumped every time the document changes. Step 3 keys its board on this, so
   * coming back from step 2 ALWAYS re-derives the calendar from the plan as it
   * stands now rather than from whatever was on screen before (owner ruling
   * 2026-08-05, #4 — the staleness fix).
   */
  docVersion: number
  /** True while the plan's own world is what the steps are editing: any plan of
   *  the operator's own that the season does not run. On the ACTIVE plan the
   *  steps write through to the season instead, because it IS the season. */
  editsPlanWorld: boolean
  /**
   * True while the plan's own world is what the steps DRAW: any non-active
   * plan that has one, the read-only reference included. The board has always
   * drawn those worlds; steps 1 and 2 read the same document or the walk shows
   * one plan on the calendar and a different one on its own numbers (the
   * old-plan step-2 bug, fixed 2026-08-06 wave).
   */
  readsPlanWorld: boolean
  /** The plan the season actually runs. It drives everything downstream of the
   *  wizard; it is deliberately NOT what the wizard opens on. */
  active: PlanRow | null
  loading: boolean
  /** True while the document is being fetched or written. */
  docBusy: boolean
  /**
   * The last read of the OPEN plan's document failed, so the board is holding a
   * world that is not that plan's and waiting will not change it (the cold-open
   * fix, 2026-08-06). Cleared the moment a read is attempted again.
   */
  docFailed: boolean
  /** Where the open plan stands: chosen, read, or neither. Every surface that
   *  draws or writes a plan asks this and nothing else. */
  openState: PlanOpenState
  creating: boolean
  error: string | null
  /** The plan just created, so a step can say so once. */
  lastCreatedId: string | null
  choose: (planId: string | null) => void
  /** A plan named by the operator, with the season's grades and NO gym time
   *  assumed (owner ruling 2026-08-05). */
  createNew: (name: string) => Promise<PlanRow | null>
  /** The name to put in the box when they press New plan. */
  suggestName: () => string
  rename: (planId: string, name: string) => Promise<boolean>
  remove: (planId: string) => Promise<{ ok: boolean; error?: string }>
  /** Write the plan's own world. Steps 1 and 2 call this and nothing else. */
  saveWorld: (world: PlanWorld) => Promise<boolean>
  /** Re-read the open document (after a season-side edit on the active plan). */
  refreshDoc: () => Promise<PlanDocument | null>
  /** Re-read the list (after a save, an activate, a rename). */
  refresh: () => Promise<PlanRow[]>
  /** Let a step hand back the list it already fetched. */
  setPlans: (plans: PlanRow[]) => void
  /** Let step 3 hand back the document it just saved, so nothing refetches. */
  setDoc: (doc: PlanDocument | null) => void
}

const Ctx = createContext<PlanSession | null>(null)

export function usePlanSession(): PlanSession {
  const value = useContext(Ctx)
  if (!value) throw new Error("usePlanSession outside PlanSessionProvider")
  return value
}

export function PlanSessionProvider({
  seasonId,
  initialPlanId = null,
  children,
}: {
  seasonId: string
  /**
   * THE URL CARRIES THE PLAN (owner's 2026-08-06 analysis, B1). A visit still
   * starts with nothing open — rule 2 stands — but a reload, a bookmark or a
   * shared link with ?plan= on it is somebody deliberately naming the plan
   * they were in, and the wizard puts them back in it. Restored once, after
   * the list arrives, and only if the plan still exists.
   */
  initialPlanId?: string | null
  children: ReactNode
}) {
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [planId, setPlanId] = useState<string | null>(null)
  const [doc, setDocState] = useState<PlanDocument | null>(null)
  const [docVersion, setDocVersion] = useState(0)
  const [docBusy, setDocBusy] = useState(false)
  /** The open plan's document could not be read (the cold-open fix). Kept apart
   *  from `error`, which every other verb on this screen also writes to. */
  const [docFailed, setDocFailed] = useState(false)
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

  /** The one URL restore, spent whether or not it lands: a stale id in a
   *  bookmark must not keep re-firing against every later refresh. */
  const restoreRef = useRef<string | null>(initialPlanId)
  useEffect(() => {
    const wanted = restoreRef.current
    if (!wanted || loading) return
    restoreRef.current = null
    if (plans.some((p) => p.id === wanted)) setPlanId(wanted)
  }, [plans, loading])

  /**
   * AND THE URL FOLLOWS THE SELECTION, on every step. replaceState rather than
   * a router navigation: nothing about the page changes, the address is simply
   * kept true so a reload or a copied link reopens this plan.
   */
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (planId) url.searchParams.set("plan", planId)
    else url.searchParams.delete("plan")
    window.history.replaceState(window.history.state, "", url)
  }, [planId])

  /** One document, held once. Every step reads it, so it is fetched here and
   *  nowhere else. */
  const setDoc = useCallback((next: PlanDocument | null) => {
    setDocState(next)
    setDocVersion((v) => v + 1)
  }, [])

  const fetchDoc = useCallback(
    async (id: string): Promise<PlanDocument | null> => {
      const res = await fetch(`/api/seasons/${seasonId}/plans/${id}`, { cache: "no-store" }).catch(
        () => null
      )
      const data = res?.ok ? await res.json().catch(() => null) : null
      return (data?.plan ?? null) as PlanDocument | null
    },
    [seasonId]
  )

  /**
   * THE OPEN PLAN'S DOCUMENT FOLLOWS THE SELECTION, always. Every step mounts
   * against the plan as the server holds it now, which is what makes coming back
   * from step 2 to step 3 show the edits instead of the board's memory of them.
   */
  useEffect(() => {
    if (!planId) {
      setDocState(null)
      setDocFailed(false)
      return
    }
    let live = true
    setDocBusy(true)
    setDocFailed(false)
    void fetchDoc(planId).then((next) => {
      if (!live) return
      setDocBusy(false)
      if (next) setDoc(next)
      else {
        // The board is holding somebody else's world and must not draw or save
        // it under this plan's name (the cold-open fix, 2026-08-06).
        setDocFailed(true)
        setError("Couldn't open that plan. Try again.")
      }
    })
    return () => {
      live = false
    }
  }, [planId, fetchDoc, setDoc])

  const refreshDoc = useCallback(async () => {
    if (!planId) return null
    setDocBusy(true)
    setDocFailed(false)
    const next = await fetchDoc(planId)
    setDocBusy(false)
    if (next) setDoc(next)
    else setDocFailed(true)
    return next
  }, [planId, fetchDoc, setDoc])

  /**
   * A NEW PLAN, NAMED BY THE OPERATOR AND STARTED FRESH (owner ruling
   * 2026-08-05). No solver call: a plan chooses its own weekends and its own gym
   * time, so there is nothing to solve against until the operator has said when
   * the league runs. The plan arrives with the season's grades and their
   * numbers, every weekend unchosen, and its pool listed with no availability.
   */
  const createNew = useCallback(
    async (name: string) => {
      const wanted = name.trim().slice(0, PLAN_NAME_MAX)
      if (!wanted) {
        setError("Give the plan a name.")
        return null
      }
      setCreating(true)
      setError(null)
      const res = await fetch(`/api/seasons/${seasonId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wanted, fresh: true, source: "manual" }),
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
      setDoc(plan)
      setLastCreatedId(plan.id)
      return rows.find((p) => p.id === plan.id) ?? null
    },
    [seasonId, refresh, setDoc]
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      const wanted = name.trim().slice(0, PLAN_NAME_MAX)
      if (!wanted) return false
      setError(null)
      const res = await fetch(`/api/seasons/${seasonId}/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wanted }),
      }).catch(() => null)
      const data = res ? await res.json().catch(() => null) : null
      if (!res?.ok || !data?.plan) {
        setError(data?.error ?? "That name didn't save. Try again.")
        return false
      }
      await refresh()
      if (id === planId) setDoc(data.plan as PlanDocument)
      return true
    },
    [seasonId, refresh, planId, setDoc]
  )

  const remove = useCallback(
    async (id: string) => {
      setError(null)
      const res = await fetch(`/api/seasons/${seasonId}/plans/${id}`, { method: "DELETE" }).catch(
        () => null
      )
      const data = res ? await res.json().catch(() => null) : null
      if (!res?.ok) {
        const message = data?.error ?? "That plan didn't delete. Try again."
        setError(message)
        return { ok: false, error: message }
      }
      const rows = await refresh()
      if (id === planId) {
        // Nothing is open again, which is the state every visit starts in.
        setPlanId(null)
        setDocState(null)
      }
      void rows
      return { ok: true }
    },
    [seasonId, refresh, planId]
  )

  /**
   * WRITE THE PLAN'S OWN WORLD. This is what steps 1 and 2 do on any plan the
   * season does not run: the estimates, the gyms, the courts, the hours, the
   * weekends and the buffer, all in the plan document and nowhere near the
   * season's rows.
   */
  const saveWorld = useCallback(
    async (world: PlanWorld) => {
      if (!planId) return false
      setDocBusy(true)
      setError(null)
      const res = await fetch(`/api/seasons/${seasonId}/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { state: world } }),
      }).catch(() => null)
      const data = res ? await res.json().catch(() => null) : null
      setDocBusy(false)
      if (!res?.ok || !data?.plan) {
        setError(data?.error ?? "That didn't save. Try again.")
        return false
      }
      setDoc(data.plan as PlanDocument)
      await refresh()
      return true
    },
    [seasonId, planId, refresh, setDoc]
  )

  const value = useMemo<PlanSession>(() => {
    const chosen = plans.find((p) => p.id === planId) ?? null
    return {
      plans,
      planId,
      chosen,
      doc: doc && doc.id === planId ? doc : null,
      world: doc && doc.id === planId ? (doc.settings?.state ?? null) : null,
      docFailed,
      openState: planOpenState(planId, doc, docFailed),
      docVersion,
      // The active plan IS the season, so its edits go to the season's rows. The
      // reference plan is content-locked, so its world is read only too.
      editsPlanWorld: Boolean(chosen) && !chosen?.isActive && !isReferencePlan(chosen),
      // Any non-active plan with a world of its own is DRAWN from it — writing
      // is a separate, narrower right.
      readsPlanWorld:
        Boolean(chosen) &&
        !chosen?.isActive &&
        Boolean(doc && doc.id === planId && doc.settings?.state),
      active: plans.find((p) => p.isActive) ?? null,
      loading,
      docBusy,
      creating,
      error,
      lastCreatedId,
      choose: (id) => {
        setPlanId(id)
        if (id !== lastCreatedId) setLastCreatedId(null)
      },
      createNew,
      suggestName: () => suggestPlanName(plans),
      rename,
      remove,
      saveWorld,
      refreshDoc,
      refresh,
      setPlans,
      setDoc,
    }
  }, [
    plans,
    planId,
    doc,
    docFailed,
    docVersion,
    loading,
    docBusy,
    creating,
    error,
    lastCreatedId,
    createNew,
    rename,
    remove,
    saveWorld,
    refreshDoc,
    refresh,
    setDoc,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ------------------------------ the controls ------------------------------ */

/** A real button, so a control never reads as a caption (2026-08-05 clarity
 *  pass): filled for the one that makes something, outlined for the rest. */
/**
 * ONE BUTTON SYSTEM FOR THE WHOLE WIZARD (owner ruling 2026-08-06). These two
 * predate it and are kept as names, because the plan controls import them by
 * name, but they ARE the shared tiers now: a second definition of "primary" is
 * how a screen ends up with two greys that nearly match.
 */
export const PLAN_BTN_PRIMARY = `${BTN_PRIMARY} ${BTN_MD}`
export const PLAN_BTN_QUIET = `${BTN_SECONDARY} ${BTN_MD}`

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
 * NAME IT WHEN YOU MAKE IT (owner ruling 2026-08-05, #2). A plan is a document
 * an operator will come back to and compare against three others, so it gets a
 * name at birth rather than "Our plan 6". The box arrives with a suggestion in
 * it, so nobody who does not care has to think.
 */
function NameBox({
  value,
  busy,
  confirmLabel,
  testId,
  onChange,
  onConfirm,
  onCancel,
}: {
  value: string
  busy: boolean
  confirmLabel: string
  testId: string
  onChange: (name: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
      <input
        data-testid={`${testId}-input`}
        value={value}
        maxLength={PLAN_NAME_MAX}
        autoFocus
        aria-label="Plan name"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Enter" && value.trim().length > 0) onConfirm()
          if (e.key === "Escape") onCancel()
        }}
        className="border-ink-300 focus:border-play-500 text-ink-900 h-9 w-44 rounded-lg border px-2.5 text-[12.5px] font-semibold outline-none"
      />
      <button
        type="button"
        data-testid={`${testId}-confirm`}
        disabled={busy || value.trim().length === 0}
        onClick={(e) => {
          e.stopPropagation()
          onConfirm()
        }}
        className={PLAN_BTN_PRIMARY}
      >
        {busy ? "Saving…" : confirmLabel}
      </button>
      <button
        type="button"
        data-testid={`${testId}-cancel`}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          onCancel()
        }}
        className={PLAN_BTN_QUIET}
      >
        Cancel
      </button>
    </span>
  )
}

/**
 * WHICH PLAN YOU ARE IN, SAID AND NOT ASKED (owner ruling 2026-08-06: the plan
 * is chosen at step 1 and nowhere else).
 *
 * There were three choosers — step 1, step 2 and the board — so the plan could
 * be swapped from under work in progress by a control that looked like a filter.
 * Steps 2 to 5 state which plan they are in and link back to step 1 to change
 * it, which is the one place that also creates, renames and deletes them.
 */
export function PlanBadge({ testId = "plan-badge" }: { testId?: string }) {
  const session = usePlanSession()
  const name = session.chosen?.name
  if (!name) return null
  /**
   * A LABEL, NOT A CONTROL (owner ruling 2026-08-06). It said "Change in step 1"
   * and linked there, which made it one more thing to press on a screen that is
   * already asking for decisions. They know where plans are chosen. This states
   * which plan they are in and stops.
   *
   * Solid ink-100 with a dark label: clearly visible, and clearly not a button,
   * which is the whole point of the distinction the sweep is drawing.
   */
  return (
    <span
      data-testid={testId}
      className="bg-ink-100 text-ink-900 border-ink-200 inline-flex min-h-[32px] items-center rounded-lg border px-2.5 text-[12px] font-bold"
    >
      Plan: {name}
    </span>
  )
}

export function PlanChooser({
  locked,
  testId = "plan-chooser",
}: {
  locked: boolean
  testId?: string
}) {
  const session = usePlanSession()
  const [naming, setNaming] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const working = session.creating
  const chosen = session.chosen

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <PlanPicker
        plans={session.plans}
        selectedId={session.planId}
        busy={working}
        creating={session.creating}
        canWrite={!locked}
        onSelect={(id) => session.choose(id)}
        onRename={(id) => {
          setNaming(null)
          setRenaming(session.plans.find((p) => p.id === id)?.name ?? "")
          if (id !== session.planId) session.choose(id)
        }}
        onDelete={async (id) => {
          const plan = session.plans.find((p) => p.id === id)
          if (!plan) return
          if (!window.confirm(`Delete ${plan.name}? This cannot be undone.`)) return
          const result = await session.remove(id)
          if (!result.ok && result.error) window.alert(result.error)
        }}
      />

      {/* Renaming the plan you are in, in place. */}
      {renaming !== null && chosen && !locked && (
        <NameBox
          value={renaming}
          busy={session.docBusy}
          confirmLabel="Rename"
          testId="plan-rename"
          onChange={setRenaming}
          onConfirm={async () => {
            if (await session.rename(chosen.id, renaming)) setRenaming(null)
          }}
          onCancel={() => setRenaming(null)}
        />
      )}

      {!locked && naming === null && renaming === null && (
        <button
          type="button"
          data-testid="plan-new"
          disabled={working}
          onClick={(e) => {
            e.stopPropagation()
            setNaming(session.suggestName())
          }}
          className={PLAN_BTN_PRIMARY}
        >
          <PlusMark />
          New plan
        </button>
      )}
      {!locked && naming !== null && (
        <NameBox
          value={naming}
          busy={session.creating}
          confirmLabel="Create plan"
          testId="plan-create"
          onChange={setNaming}
          onConfirm={async () => {
            const made = await session.createNew(naming)
            if (made) setNaming(null)
          }}
          onCancel={() => setNaming(null)}
        />
      )}
      {session.error && (
        <span className="text-hoop-700 text-[11.5px] font-semibold">{session.error}</span>
      )}
    </div>
  )
}

/**
 * NOTHING OPEN, ON A STEP THAT CANNOT CHOOSE (owner's 2026-08-06 analysis, B1:
 * the chooser lives at step 1 and nowhere else). Steps 2 to 5 never offer the
 * picker — they say what is missing and walk the operator to the one place
 * that fixes it, so the plan can never be swapped from under work in progress
 * by a control three screens from where plans are managed.
 */
export function PlanStepPointer({
  detail,
  onGoToStep,
  testId = "plan-pointer",
}: {
  detail: string
  /** The wizard's own step control; without it the card still says the way. */
  onGoToStep?: (step: number) => void
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      className="border-ink-200 bg-ink-50/70 rounded-2xl border border-dashed px-5 py-6 text-center"
    >
      <p className="text-ink-900 text-[15px] font-bold">No plan open</p>
      <p className="text-ink-600 mx-auto mt-1 max-w-md text-[12.5px]">{detail}</p>
      {onGoToStep && (
        <button
          type="button"
          data-testid={`${testId}-go`}
          onClick={() => onGoToStep(1)}
          className={`${PLAN_BTN_PRIMARY} mt-3.5`}
        >
          Choose a plan in step 1
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
  heading = "Open a plan or start a new one",
  detail,
  testId = "plan-empty",
}: {
  locked: boolean
  heading?: string
  detail?: string
  testId?: string
}) {
  const session = usePlanSession()
  const [naming, setNaming] = useState<string | null>(null)
  const none = session.plans.length === 0
  const said =
    detail ??
    (none
      ? "This season has no plans yet. Name one and you choose its weekends, its gyms and its grades from there."
      : "A plan is one named season: its own grades, its own gym time, its own calendar. Open one of yours, or start a new one.")
  return (
    <div
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
      className="border-ink-200 bg-ink-50/70 rounded-2xl border border-dashed px-5 py-6 text-center"
    >
      <p className="text-ink-900 text-[15px] font-bold">{heading}</p>
      <p className="text-ink-600 mx-auto mt-1 max-w-md text-[12.5px]">{said}</p>
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
        {!none && naming === null && (
          <PlanPicker
            plans={session.plans}
            selectedId={session.planId}
            busy={session.creating}
            canWrite={!locked}
            label="Open a plan"
            variant="button"
            testId="plan-open"
            onSelect={(id) => session.choose(id)}
            onDelete={async (id) => {
              const plan = session.plans.find((p) => p.id === id)
              if (!plan) return
              if (!window.confirm(`Delete ${plan.name}? This cannot be undone.`)) return
              const result = await session.remove(id)
              if (!result.ok && result.error) window.alert(result.error)
            }}
          />
        )}
        {!locked && naming === null && (
          <button
            type="button"
            data-testid="plan-start-new"
            disabled={session.creating}
            onClick={(e) => {
              e.stopPropagation()
              setNaming(session.suggestName())
            }}
            className={PLAN_BTN_PRIMARY}
          >
            <PlusMark />
            Start a new plan
          </button>
        )}
        {!locked && naming !== null && (
          <NameBox
            value={naming}
            busy={session.creating}
            confirmLabel="Create plan"
            testId="plan-create"
            onChange={setNaming}
            onConfirm={async () => {
              const made = await session.createNew(naming)
              if (made) setNaming(null)
            }}
            onCancel={() => setNaming(null)}
          />
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
