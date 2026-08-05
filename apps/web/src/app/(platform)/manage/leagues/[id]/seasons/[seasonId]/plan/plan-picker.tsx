"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  isReferencePlan,
  PLAN_COPY,
  PLAN_NAME_MAX,
  planMarkers,
  type PlanRow,
} from "@/lib/scheduler/plan-documents"

/**
 * The two controls plans as documents adds to the wizard (owner 2026-08-02,
 * moved to step 1 by the 2026-08-05 entry ruling).
 *
 *  1. THE PICKER. The wizard works in ONE named plan, and this says which one
 *     and swaps it. A plan that drives the season says "active"; the league's
 *     own imported calendar says "reference", and says it in the list rather
 *     than waiting for somebody to try saving onto it. Making a plan is a
 *     sibling button now (PlanChooser), not a row hidden inside this list.
 *  2. THE SAVE CONTROLS. One way to persist: save these changes to the plan
 *     you are in, or save them as a plan of your own. Applying a plan to the
 *     season is a separate, quieter button, because it is a separate decision.
 *
 * Both are drawn here and driven from the step that owns the state.
 */

/* ------------------------------ the picker ------------------------------- */

const PANEL_WIDTH = 288

/** Every row of the panel is the same row, so the list reads as one list. A
 *  44px row: this is a list somebody taps on a laptop trackpad in a gym. */
const ROW =
  "flex w-full min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-bold"

/** A quiet fact next to a plan's name. Never colour alone, never an icon
 *  alone: the word itself is the marker. */
function Marker({ word }: { word: string }) {
  return (
    <span
      className={`rounded-full px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-[0.04em] ${
        word === "active" ? "bg-court-50 text-court-800" : "bg-ink-100 text-ink-500"
      }`}
    >
      {word}
    </span>
  )
}

/**
 * Which plan the board is showing, and every other plan this season holds.
 *
 * A real listbox rather than a select: the rows carry markers a native option
 * cannot draw, and the panel is portalled to the body because the step's card
 * is `overflow-hidden` and would clip anything absolutely positioned inside it.
 */
export function PlanPicker({
  plans,
  selectedId,
  busy,
  creating,
  label,
  variant = "field",
  testId = "plan-picker",
  onSelect,
}: {
  plans: PlanRow[]
  selectedId: string | null
  /** True while the step is doing something; the picker waits its turn. */
  busy: boolean
  /** The solver is building a plan right now, which takes a few seconds and
   *  has to say so where the operator asked for it. */
  creating?: boolean
  /** Overrides the "Plan · <name>" face: what the empty state's button says. */
  label?: string
  /** `field` reads as the control it is; `button` is the outlined button the
   *  empty state offers beside "Start a new plan". */
  variant?: "field" | "button"
  testId?: string
  onSelect: (planId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.min(
      Math.max(8, rect.right - PANEL_WIDTH),
      Math.max(8, window.innerWidth - PANEL_WIDTH - 8)
    )
    setAt({ left, top: rect.bottom + 6 })
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (trigger.current?.contains(target) || panel.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, place])

  // A season with no plans at all has nothing to pick between. Making one is a
  // button of its own now, so this control simply has nothing to say.
  if (plans.length === 0) return null
  const selected = plans.find((p) => p.id === selectedId) ?? null

  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-testid={testId}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          if (open) {
            setOpen(false)
            return
          }
          place()
          setOpen(true)
        }}
        className={`inline-flex min-h-[36px] max-w-[300px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          variant === "button"
            ? "border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 bg-white"
            : "border-ink-300 hover:border-ink-400 hover:bg-ink-50 bg-white"
        }`}
      >
        {label ? (
          <span className="text-ink-800">{label}</span>
        ) : (
          <>
            <span className="text-ink-500 font-semibold">Plan</span>
            <span className="text-ink-900 min-w-0 truncate">
              {creating ? "Building a new plan…" : (selected?.name ?? "None open")}
            </span>
          </>
        )}
        {!label &&
          !creating &&
          selected &&
          planMarkers(selected).map((word) => <Marker key={word} word={word} />)}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-ink-400 h-3 w-3 shrink-0"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open &&
        at &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panel}
            data-testid="plan-menu"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: at.left, top: at.top, width: PANEL_WIDTH }}
            className="border-ink-200 z-50 max-h-[320px] overflow-y-auto rounded-xl border bg-white p-1 shadow-lg"
          >
            <div role="listbox" aria-label="Plans for this season">
              {plans.map((plan) => {
                const on = plan.id === selectedId
                return (
                  <button
                    key={plan.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-testid="plan-option"
                    data-plan-id={plan.id}
                    data-active={plan.isActive ? "true" : "false"}
                    data-source={plan.source}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(false)
                      if (!on) onSelect(plan.id)
                    }}
                    className={`${ROW} ${on ? "bg-ink-50 text-ink-900" : "text-ink-700 hover:bg-ink-50"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{plan.name}</span>
                    {planMarkers(plan).map((word) => (
                      <Marker key={word} word={word} />
                    ))}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

/* --------------------------- the save controls --------------------------- */

const QUIET =
  "border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
const PRIMARY =
  "border-court-600 bg-court-600 text-white hover:bg-court-700 hover:border-court-700 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"

/**
 * One way to persist the board (owner 2026-08-02). What is offered depends on
 * the plan you are standing in, and nothing else:
 *
 *  - the imported reference, changed → save it as a plan of your own, because
 *    the reference is the only record of what the league published
 *  - your own plan, changed → save to it, and say out loud when that writes
 *    straight through to the season's calendar
 *  - any plan of your own → save a copy, changed or not
 *  - a plan the season is not running → use it for the season, once the board
 *    has nothing unsaved to lose
 */
export function PlanSaveControls({
  plans,
  selected,
  dirty,
  busy,
  naming,
  onNamingChange,
  onStartNaming,
  onCancelNaming,
  onSaveNew,
  onSavePlan,
  onActivate,
}: {
  plans: PlanRow[]
  selected: PlanRow | null
  dirty: boolean
  /** The step's one busy key, so every button here goes quiet together. */
  busy: string | null
  /** What is in the name box, or null while the box is shut. */
  naming: string | null
  onNamingChange: (name: string) => void
  onStartNaming: () => void
  onCancelNaming: () => void
  onSaveNew: () => void
  onSavePlan: () => void
  onActivate: () => void
}) {
  const reference = isReferencePlan(selected)
  /** No plan drives this season yet, so the first one saved has to. */
  const takesOver = !plans.some((p) => p.isActive)
  const canSaveHere = Boolean(selected) && !reference && dirty
  /** Always offered: it is the only route out of the reference plan, and on a
   *  calendar with nothing changed yet it is how an operator takes the
   *  league's plan and makes it their own (owner 2026-08-02: "when I do it
   *  fresh it should be our own"). */
  const newLabel = takesOver ? "Save this calendar" : dirty ? "Save as new plan" : "Save a copy"
  /** Loud only when it is the way out: unsaved work that cannot be saved where
   *  it stands. Copying a plan you already saved is a quiet errand. */
  const newIsPrimary = dirty && !canSaveHere
  const working = busy !== null

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {selected && !selected.isActive && (
          <button
            type="button"
            data-testid="activate-plan"
            disabled={working || dirty}
            title={dirty ? PLAN_COPY.saveFirst : undefined}
            onClick={(e) => {
              e.stopPropagation()
              onActivate()
            }}
            className={QUIET}
          >
            {busy === "activate" ? "Switching…" : "Use for the season"}
          </button>
        )}
        <button
          type="button"
          data-testid="save-as-new"
          disabled={working}
          aria-expanded={naming !== null}
          onClick={(e) => {
            e.stopPropagation()
            if (naming === null) onStartNaming()
            else onCancelNaming()
          }}
          className={newIsPrimary ? PRIMARY : QUIET}
        >
          {newLabel}
        </button>
        {canSaveHere && (
          <button
            type="button"
            data-testid="save-plan"
            disabled={working}
            onClick={(e) => {
              e.stopPropagation()
              onSavePlan()
            }}
            className={PRIMARY}
          >
            {busy === "save-plan" ? "Saving…" : `Save to ${selected?.name}`}
          </button>
        )}
      </div>

      {/* What the buttons above do NOT say on their faces. */}
      {canSaveHere && selected?.isActive && (
        <p className="text-ink-400 text-[11px]" data-testid="write-through-note">
          {PLAN_COPY.writeThrough}
        </p>
      )}
      {selected && !selected.isActive && dirty && (
        <p className="text-ink-400 text-[11px]">{PLAN_COPY.saveFirst}</p>
      )}

      {naming !== null && (
        <div
          className="mt-1 flex flex-wrap items-center justify-end gap-2"
          data-testid="plan-name-row"
        >
          <label htmlFor="plan-name" className="text-ink-500 text-[11px] font-semibold">
            Call it
          </label>
          <input
            id="plan-name"
            data-testid="plan-name-input"
            value={naming}
            maxLength={PLAN_NAME_MAX}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onNamingChange(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter" && naming.trim().length > 0) onSaveNew()
              if (e.key === "Escape") onCancelNaming()
            }}
            className="border-ink-200 focus:border-play-400 w-48 rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none"
          />
          <button
            type="button"
            data-testid="save-new-confirm"
            disabled={working || naming.trim().length === 0}
            onClick={(e) => {
              e.stopPropagation()
              onSaveNew()
            }}
            className={PRIMARY}
          >
            {busy === "save-new" ? "Saving…" : "Save plan"}
          </button>
          <button
            type="button"
            data-testid="save-new-cancel"
            disabled={working}
            onClick={(e) => {
              e.stopPropagation()
              onCancelNaming()
            }}
            className={QUIET}
          >
            Cancel
          </button>
          {takesOver && (
            <p className="text-ink-400 w-full text-right text-[11px]">{PLAN_COPY.takesOver}</p>
          )}
        </div>
      )}
    </div>
  )
}
