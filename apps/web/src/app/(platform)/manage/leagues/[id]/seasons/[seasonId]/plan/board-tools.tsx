"use client"

import { Button } from "@/components/ui"
import { isReferencePlan, planStateLine, suggestPlanName, type PlanRow } from "@/lib/scheduler/plan-documents"
import { PlanSaveControls } from "./plan-picker"

/**
 * THE ROW UNDER THE CALENDAR: what this board is, and the one set of controls
 * that persists it onto a plan.
 *
 * IT USED TO HIDE THREE THINGS (owner ruling 2026-08-06, #6), and all three are
 * gone rather than moved down:
 *  - "Adjust grouping rules" opened a row of levers. Three of the four are the
 *    same answer Redraw already gives; the fourth is a button beside Redraw now.
 *  - "Change the hours" moved every gym on every weekend by an hour, which is not
 *    a thing anybody negotiates. Hours are agreed one building and one date at a
 *    time, in the ⋯ menu on the section they are about.
 *  - "Compare with the kept plan" repainted every chip against the saved
 *    calendar. The strip shows both calendars whole, side by side, which is the
 *    reading an operator actually does.
 *
 * What is left is what the row was always for: saving.
 */
export function BoardTools({
  busy,
  dirty,
  plans,
  selectedPlan,
  activePlan,
  naming,
  setNaming,
  onRevert,
  onSaveNew,
  onSavePlan,
  onActivate,
}: {
  busy: string | null
  dirty: boolean
  plans: PlanRow[]
  selectedPlan: PlanRow | null
  activePlan: PlanRow | null
  naming: string | null
  setNaming: (name: string | null) => void
  onRevert: () => void
  onSaveNew: () => void
  onSavePlan: () => void
  onActivate: () => void
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      {/* The rentals behind this plan are counted in the work rail (owner ruling
          2026-08-04): everything that describes what is LEFT belongs in the
          column that stays on screen. */}
      <span className="text-ink-400 mr-auto text-xs" data-testid="plan-state">
        {planStateLine({ selected: selectedPlan, active: activePlan, dirty })}
      </span>
      {dirty && (
        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onRevert}>
          Undo changes
        </Button>
      )}
      {/* The one way to persist this board: onto a plan. */}
      <PlanSaveControls
        plans={plans}
        selected={selectedPlan}
        dirty={dirty}
        busy={busy}
        naming={naming}
        onNamingChange={setNaming}
        onStartNaming={() =>
          setNaming(
            suggestPlanName(
              plans,
              selectedPlan && !isReferencePlan(selectedPlan) && !dirty
                ? `${selectedPlan.name} copy`
                : "Our plan"
            )
          )
        }
        onCancelNaming={() => setNaming(null)}
        onSaveNew={onSaveNew}
        onSavePlan={onSavePlan}
        onActivate={onActivate}
      />
    </div>
  )
}
