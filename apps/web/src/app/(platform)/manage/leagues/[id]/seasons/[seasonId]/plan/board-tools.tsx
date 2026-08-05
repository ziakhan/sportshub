"use client"

import { Button } from "@/components/ui"
import { hoursPreviewSentence, type HoursPreview, type PlannerLever } from "@/lib/scheduler/planner-core"
import {
  PLAN_COPY,
  isReferencePlan,
  planStateLine,
  suggestPlanName,
  type PlanRow,
} from "@/lib/scheduler/plan-documents"
import { PlanSaveControls } from "./plan-picker"
import { COPY, HOURS_CHIPS, LEVERS, type HoursChip } from "./board-shared"

/**
 * THE ROW UNDER THE CALENDAR, and the two panels behind it.
 *
 * The quiet door to the levers, the hours group (which changes WHEN the gyms
 * are open, not who plays which weekend), the compare lens, and the one set of
 * controls that actually persists this board: onto a plan.
 *
 * Everything here acts on the proposal, which is why the whole thing is drawn
 * only while the board is interactive and is not showing the kept calendar.
 */
export function BoardTools({
  showRules,
  showHours,
  onToggleRules,
  onToggleHours,
  kept,
  view,
  comparing,
  onToggleCompare,
  busy,
  dirty,
  worldUsable,
  onPlanWorld,
  hoursChip,
  hoursPreview,
  hoursError,
  previewHours,
  applyHours,
  onCancelHours,
  runLever,
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
  showRules: boolean
  showHours: boolean
  onToggleRules: () => void
  onToggleHours: () => void
  /** The calendar the league kept, or null while it has never kept one. */
  kept: Record<string, string[]> | null
  view: "board" | "strip"
  comparing: boolean
  onToggleCompare: () => void
  busy: string | null
  dirty: boolean
  /** A plan with no gym time to solve in: the levers have nothing to answer. */
  worldUsable: boolean
  /** The board is drawing the plan's own saved world, so the hours group, which
   *  measures and writes the SEASON's hours, has nothing true to say. */
  onPlanWorld: boolean
  hoursChip: HoursChip | null
  hoursPreview: HoursPreview | null
  hoursError: string | null
  previewHours: (chip: HoursChip) => void
  applyHours: (chip: HoursChip) => void
  onCancelHours: () => void
  runLever: (lever: PlannerLever) => void
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
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleRules()
            }}
            aria-expanded={showRules}
            className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors"
          >
            Adjust grouping rules
          </button>
          {/* The second group, and it changes something else: the
              hours, not who plays which weekend. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleHours()
            }}
            aria-expanded={showHours}
            data-testid="hours-toggle"
            className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors"
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
                onToggleCompare()
              }}
              aria-pressed={comparing}
              data-testid="compare-toggle"
              className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors"
            >
              {comparing ? "Stop comparing" : "Compare with the kept calendar"}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The rentals behind this plan are counted in the work
              rail now (owner ruling 2026-08-04): everything that
              describes what is LEFT belongs in the column that stays
              on screen, not in the row of buttons at the bottom. */}
          <span className="text-ink-400 text-xs" data-testid="plan-state">
            {planStateLine({ selected: selectedPlan, active: activePlan, dirty })}
          </span>
          {/* One step back through the moves lives in the board
              header now (owner ruling 2026-08-05): it has to be on
              screen the moment a move happens, not at the foot of a
              five-month calendar. */}
          {dirty && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={onRevert}
            >
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
                disabled={busy !== null || !worldUsable}
                onClick={() => runLever(l.lever)}
              >
                {l.label}
              </Button>
            ))}
          </div>
          {/* EVERY LEVER SOLVES IN THE WORLD ON SCREEN NOW (owner
              ruling 2026-08-05, #1). They used to be switched off on a
              plan-scoped board because the proposal came from the
              season; the solve is the plan's own now, so the only
              reason a lever cannot run is a plan with no gym time. */}
          {!worldUsable && (
            <p className="text-ink-400 mt-2 text-[11px]" data-testid="lever-no-world">
              {COPY.worldFirst}.
            </p>
          )}
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
                disabled={busy !== null || onPlanWorld}
                onClick={() => previewHours(chip)}
              >
                {busy === `hours:${chip.key}` ? "Working…" : chip.label}
              </Button>
            ))}
          </div>
          {/* The preview measures the SEASON's hours, and applying
              writes them, so neither belongs on a board showing an
              older plan's world. */}
          {onPlanWorld && (
            <p
              className="text-ink-400 mt-2 text-[11px]"
              data-testid="hours-snapshot-note"
            >
              {PLAN_COPY.hoursSnapshot}
            </p>
          )}
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
                  onClick={onCancelHours}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
