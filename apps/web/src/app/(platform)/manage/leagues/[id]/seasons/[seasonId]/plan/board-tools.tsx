"use client"

import { useEffect, useRef, useState } from "react"
import { isReferencePlan, suggestPlanName, type PlanRow } from "@/lib/scheduler/plan-documents"
import { NameBox, PLAN_BTN_PRIMARY } from "./plan-session"

/**
 * THE ROW UNDER THE CALENDAR: what this board is, and the one thing left to
 * do about it by hand.
 *
 * AUTOSAVE ATE THE REST OF THIS ROW (owner ruling 2026-08-07, #4). "Save to
 * <plan>", "Save as new plan" and "Undo changes" are gone: the board saves
 * itself about a second after the working copy goes quiet, and the undo
 * stack in the header covers a mistake better than reverting to a save point
 * that autosave keeps almost-now anyway. "Use for the season" is gone too —
 * that used to be the whole point of activating a plan, but the single
 * generate button elsewhere is the one door into the season now (ruling
 * 2026-08-07, #3), and no control in this file may open a second one.
 *
 * What is left: the line that says whose plan this is and whether it just
 * saved, and — on the read-only reference only — "Save a copy", its one
 * escape into a plan of your own.
 */
export function BoardTools({
  busy,
  dirty,
  plans,
  selectedPlan,
  naming,
  setNaming,
  onSaveNew,
}: {
  busy: string | null
  dirty: boolean
  plans: PlanRow[]
  selectedPlan: PlanRow | null
  /** What is in the copy's name box, or null while it is shut. */
  naming: string | null
  setNaming: (name: string | null) => void
  onSaveNew: () => void
}) {
  const reference = isReferencePlan(selectedPlan)

  /** "Saved just now", briefly, the moment autosave clears dirty — the one
   *  thing this row still has to announce, and only for a moment (owner
   *  ruling 2026-08-07, #4). */
  const [justSaved, setJustSaved] = useState(false)
  const wasDirty = useRef(dirty)
  useEffect(() => {
    const was = wasDirty.current
    wasDirty.current = dirty
    if (!was || dirty) return
    setJustSaved(true)
    const t = setTimeout(() => setJustSaved(false), 2000)
    return () => clearTimeout(t)
  }, [dirty])

  const line = !selectedPlan
    ? ""
    : reference
      ? "Reference plan, read only. Save a copy to change it."
      : dirty
        ? "Saving…"
        : justSaved
          ? "Saved just now."
          : `Every change saves to ${selectedPlan.name}.`

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      {/* The rentals behind this plan are counted in the work rail (owner ruling
          2026-08-04): everything that describes what is LEFT belongs in the
          column that stays on screen. */}
      <span className="text-ink-400 mr-auto text-xs" data-testid="plan-state">
        {line}
      </span>
      {/* THE REFERENCE PLAN'S ONE ESCAPE (owner ruling 2026-08-07, #4). It is
          read only, so there is nothing here to autosave — this is the only
          board control the reference keeps. */}
      {reference && naming === null && (
        <button
          type="button"
          data-testid="save-as-new"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation()
            setNaming(suggestPlanName(plans, `${selectedPlan?.name ?? "Our plan"} copy`))
          }}
          className={PLAN_BTN_PRIMARY}
        >
          Save a copy
        </button>
      )}
      {reference && naming !== null && (
        <NameBox
          value={naming}
          busy={busy === "save-new"}
          confirmLabel="Save plan"
          testId="save-as-new"
          onChange={setNaming}
          onConfirm={onSaveNew}
          onCancel={() => setNaming(null)}
        />
      )}
    </div>
  )
}
