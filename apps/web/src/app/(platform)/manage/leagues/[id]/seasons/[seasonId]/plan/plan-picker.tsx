"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { isReferencePlan, PLAN_COPY, planMarkers, type PlanRow } from "@/lib/scheduler/plan-documents"

/**
 * THE PICKER (owner 2026-08-02, moved to step 1 by the 2026-08-05 entry
 * ruling). The wizard works in ONE named plan, and this says which one and
 * swaps it. A plan that drives the season says "active"; the league's own
 * imported calendar says "reference", and says it in the list rather than
 * waiting for somebody to try saving onto it. Making a plan is a sibling
 * button (PlanChooser), not a row hidden inside this list.
 *
 * Every row carries three quiet actions now (owner ruling 2026-08-07, #4,
 * autosave): rename, save a copy, delete. Saving what is ON the board is no
 * longer a decision anybody makes here — the board saves itself — so the
 * save controls this file used to hold (PlanSaveControls) are gone with the
 * buttons that drove them; "save a copy" is what is left of that row, moved
 * into the picker beside rename and delete.
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
/** A pencil, so "rename" is an affordance rather than a word competing with the
 *  plan's own name (owner ruling 2026-08-05, #2). */
function PencilMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3.5 w-3.5"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

/** Two overlapping squares: "save a copy", kept apart from the pencil and the
 *  bin so a row of three still reads as three different verbs at a glance
 *  (owner ruling 2026-08-07, #4). */
function CopyMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3.5 w-3.5"
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

/** A bin. Same reasoning: the row is a name, not a sentence of verbs. */
function TrashMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3.5 w-3.5"
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}

export function PlanPicker({
  plans,
  selectedId,
  busy,
  creating,
  label,
  variant = "field",
  testId = "plan-picker",
  canWrite = false,
  onSelect,
  onRename,
  onCopy,
  onDelete,
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
  /** The season is not finalized, so a row may be renamed and thrown away. */
  canWrite?: boolean
  onSelect: (planId: string) => void
  onRename?: (planId: string) => void
  /** "Save a copy" (owner ruling 2026-08-07, #4): duplicate this row's stored
   *  document under a new name. Any row, open or not. */
  onCopy?: (planId: string) => void
  onDelete?: (planId: string) => void
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
                /** The reference plan is the only record of what the league
                 *  published, and the active plan is what the season runs. Both
                 *  can be renamed; neither can be thrown away, and the row says
                 *  so on the button rather than after pressing it. */
                const undeletable = isReferencePlan(plan)
                  ? PLAN_COPY.deleteReference
                  : plan.isActive
                    ? PLAN_COPY.deleteActive
                    : null
                return (
                  <div
                    key={plan.id}
                    className={`flex items-center gap-0.5 rounded-lg ${on ? "bg-ink-50" : "hover:bg-ink-50"}`}
                  >
                    <button
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
                      className={`${ROW} min-w-0 flex-1 ${on ? "text-ink-900" : "text-ink-700"}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{plan.name}</span>
                      {planMarkers(plan).map((word) => (
                        <Marker key={word} word={word} />
                      ))}
                    </button>
                    {canWrite && onRename && (
                      <button
                        type="button"
                        data-testid="plan-rename-open"
                        data-plan-id={plan.id}
                        title={`Rename ${plan.name}`}
                        aria-label={`Rename ${plan.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(false)
                          onRename(plan.id)
                        }}
                        className="text-ink-400 hover:text-ink-800 hover:bg-ink-100 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md"
                      >
                        <PencilMark />
                      </button>
                    )}
                    {canWrite && onCopy && (
                      <button
                        type="button"
                        data-testid="plan-copy-open"
                        data-plan-id={plan.id}
                        title={`Save a copy of ${plan.name}`}
                        aria-label={`Save a copy of ${plan.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(false)
                          onCopy(plan.id)
                        }}
                        className="text-ink-400 hover:text-ink-800 hover:bg-ink-100 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md"
                      >
                        <CopyMark />
                      </button>
                    )}
                    {canWrite && onDelete && (
                      <button
                        type="button"
                        data-testid="plan-delete"
                        data-plan-id={plan.id}
                        data-blocked={undeletable ? "1" : "0"}
                        disabled={Boolean(undeletable)}
                        title={undeletable ?? `Delete ${plan.name}`}
                        aria-label={undeletable ?? `Delete ${plan.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(false)
                          onDelete(plan.id)
                        }}
                        className="text-ink-400 hover:text-hoop-700 hover:bg-hoop-50 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                      >
                        <TrashMark />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
