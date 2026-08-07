"use client"

import { useEffect, useState } from "react"
import type { PlannerUnit, PlannerWeekend } from "@/lib/scheduler/planner-core"
import { PLAN_COPY, isReferencePlan, type PlanRow } from "@/lib/scheduler/plan-documents"
import {
  strandedSentence,
  type StrandedPlacement,
  type WorldGap,
} from "@/lib/scheduler/plan-world"
import {
  BTN_LG,
  BTN_MD,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SM,
  PILL_TONE,
  type Armed,
  type ArmedBlock,
  type ArmedSection,
} from "./plan-shared"
import { WhyPopover } from "./plan-ui"
import { PlanBadge } from "./plan-session"
import { Segmented } from "./season-strip"
import { COPY, nameList, type BoardSnapshot } from "./board-shared"

/**
 * EVERYTHING AROUND THE CALENDAR. The head the screen wears, the line that says
 * what is in the operator's hand, the one button an empty board leads with, the
 * two banners that name a real problem, and the colour key.
 *
 * None of it draws a weekend. It is all here so calendar-step can be read as
 * what it is — the composition — instead of as four hundred lines of furniture
 * with a board somewhere in the middle.
 */

/**
 * THE SCREEN HEAD: which plan is on the board, one step back, the whole
 * calendar back from the solver, the two views, and the loudest true thing
 * about the plan as a pill.
 */
export function BoardHead({
  planId,
  dirty,
  interactive,
  locked,
  busy,
  view,
  pill,
  selectedPlan,
  undoStack,
  worldUsable,
  onGoToStep,
  onUndo,
  onRedraw,
  onRedrawSpread,
  onFillFromPool,
  onViewChange,
}: {
  planId: string | null
  dirty: boolean
  interactive: boolean
  locked: boolean
  busy: string | null
  view: "board" | "strip"
  /** The header verdict, or null before there is a calendar to judge. */
  pill: { tone: keyof typeof PILL_TONE; text: string } | null
  selectedPlan: PlanRow | null
  /** The boards behind this one: the top of it is what Undo says it will do. */
  undoStack: BoardSnapshot[]
  worldUsable: boolean
  /** Back to step 1, where plans are chosen (owner ruling 2026-08-06). */
  onGoToStep?: (step: number) => void
  onUndo: () => void
  onRedraw: () => void
  /** The same solve, told to use every weekend instead of as few as it can
   *  (owner ruling 2026-08-06, #6, replacing the lever row). */
  onRedrawSpread: () => void
  /** Every weekend with no building takes the cheapest gym in the pool that is
   *  free that weekend. A verb, not half of a mode (owner ruling 2026-08-06). */
  onFillFromPool: () => void
  onViewChange: (next: "board" | "strip") => void
}) {
  return (
    <div className="border-ink-200 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <div>
        <p className="text-ink-900 text-[15px] font-bold">
          {!planId ? "No plan open" : dirty ? "Proposed calendar" : "Your calendar"}
        </p>
        <p className="text-ink-500 text-xs">
          {!planId
            ? "Open one of this season's plans, or start a new one."
            : !interactive
              ? // A locked season can still be read through the picker, and a
                // plan it never ran must not be described as the one it did.
                selectedPlan && !selectedPlan.isActive
                ? `${selectedPlan.name}: a plan this season did not run`
                : "The calendar this season was finalized on"
              : view === "board"
                ? "Drag a grade to move it · math updates live"
                : "Every grade across the season · math updates live"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {/* One step back, ALWAYS in reach while there is one to take
              (owner ruling 2026-08-05): it says what it will undo, so an
              accidental drag never has to be hunted for. */}
          {undoStack.length > 0 && interactive && (
            <button
              type="button"
              data-testid="undo-last"
              data-undo="move"
              disabled={busy !== null}
              onClick={(e) => {
                e.stopPropagation()
                onUndo()
              }}
              className={`${BTN_SECONDARY} ${BTN_MD}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              >
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
              </svg>
              Undo: {undoStack[undoStack.length - 1].label}
            </button>
          )}
          {/* ALWAYS IN REACH (owner ruling 2026-08-05, #3): the whole calendar
              back from the solver, next to the one step back, whenever a plan
              is open and its world can hold a calendar. It asks first if the
              board has hand work on it, and it never touches what is saved. */}
          {planId && interactive && worldUsable && (
            <button
              type="button"
              data-testid="redraw"
              disabled={busy !== null}
              onClick={(e) => {
                e.stopPropagation()
                onRedraw()
              }}
              className={`${BTN_SECONDARY} ${BTN_MD}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              >
                <path d="M21 12a9 9 0 1 1-3.1-6.8" />
                <path d="M21 4v5h-5" />
              </svg>
              {COPY.redraw}
            </button>
          )}
          {/* THE ONE ALTERNATIVE SHAPE, BESIDE THE BUTTON IT IS AN ALTERNATIVE TO
              (owner ruling 2026-08-06, #6). It used to be a chip behind "adjust
              grouping rules", which describes nothing it does. */}
          {planId && interactive && worldUsable && (
            <button
              type="button"
              data-testid="redraw-spread"
              disabled={busy !== null}
              onClick={(e) => {
                e.stopPropagation()
                onRedrawSpread()
              }}
              className={`${BTN_SECONDARY} ${BTN_SM}`}
            >
              {COPY.redrawSpread}
            </button>
          )}
          {/* FILLING THE GAPS IS A VERB (owner ruling 2026-08-06, #6). It used to
              be drawn only in "assign gyms for me" mode, which meant the operator
              had to find a mode switch before they could find the button. */}
          {planId && interactive && view === "board" && (
            <button
              type="button"
              data-testid="assign-from-pool"
              title={COPY.fillHint}
              disabled={busy !== null}
              onClick={(e) => {
                e.stopPropagation()
                onFillFromPool()
              }}
              className={`${BTN_PRIMARY} ${BTN_MD}`}
            >
              {COPY.fillFromPool}
            </button>
          )}
          {/* WHICH PLAN THIS BOARD IS A COPY OF, SAID AND NOT ASKED (owner
              ruling 2026-08-06). The compact switcher lived here and could swap
              the plan out from under a calendar somebody was in the middle of;
              choosing a plan is step 1's job, and this links back to it. */}
          <PlanBadge testId="board-plan-badge" />
          {planId && (
            <Segmented
              label="How to view the calendar"
              value={view}
              testId="calendar-view"
              options={[
                { value: "board" as const, label: "Board" },
                { value: "strip" as const, label: "Strip" },
              ]}
              onChange={onViewChange}
            />
          )}
          {planId && pill && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${PILL_TONE[pill.tone]}`}
            >
              {pill.text}
            </span>
          )}
        </div>
        {/* Said before anybody tries to save onto it, not after. */}
        {isReferencePlan(selectedPlan) && (
          <p className="text-ink-400 text-[11px]" data-testid="plan-reference-note">
            {PLAN_COPY.reference}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * ONE STEP BACK, WHEREVER YOU ARE ON THE PAGE (owner ruling 2026-08-05, #3).
 *
 * The header Undo stays where it is, and it is the right place for it — until
 * the operator has scrolled four months across and two screens down, at which
 * point the one control they want after a mistaken drag is off the top of the
 * window. So the same verb, with the same words on it, also rides the bottom
 * right corner of the viewport for as long as there is a step to take.
 *
 * It never sits on the work rail: on xl the rail is a 340px column pinned to the
 * right of the stage, so the pill steps in past it. Below xl the rail is not
 * beside the board at all and the corner is free.
 */
export function UndoFloat({
  label,
  busy,
  onUndo,
}: {
  /** What the step back would put right: "move Grade 8". */
  label: string
  busy: boolean
  onUndo: () => void
}) {
  // Fades in on arrival for anyone who has not asked for less motion; for
  // anyone who has, it simply appears, which is the same information.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return (
    <button
      type="button"
      data-testid="undo-float"
      data-undo="move"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        onUndo()
      }}
      className={`border-ink-800 bg-ink-900 hover:bg-ink-800 fixed bottom-5 right-5 z-50 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 text-[13px] font-bold text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 xl:right-[372px] ${
        shown ? "opacity-100" : "opacity-0"
      } motion-safe:transition-opacity motion-safe:duration-200`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-4 w-4 shrink-0"
      >
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
      </svg>
      Undo: {label}
    </button>
  )
}

/**
 * THE GRADE HIGHLIGHT (owner ruling 2026-08-05, #4).
 *
 * A season board is five months of chips, and the question an operator asks it
 * most often is about ONE grade: where does Grade 8 play, and in whose gym. This
 * is that question as a strip of toggles above the calendar. Pick any number of
 * grades and they stay at full strength with a quiet ring; everything else steps
 * well back so a grade's whole season reads across the columns in one look.
 *
 * It changes NOTHING. No placement moves, no gym changes, nothing is saved and
 * nothing is dirty afterwards. Escape clears it, and so does the word that says
 * what is on.
 */
export function GradeFilter({
  units,
  selected,
  gymsShowing,
  onToggle,
  onClear,
}: {
  units: PlannerUnit[]
  selected: string[]
  /** The gyms the OTHER lens is on, in full names (owner ruling 2026-08-06, #4).
   *  The two lenses combine as an intersection, so they share one "showing" line
   *  and one Clear: two of them would leave the board half hidden. */
  gymsShowing: string[]
  onToggle: (key: string) => void
  onClear: () => void
}) {
  if (units.length === 0) return null
  const picked = units.filter((u) => selected.includes(u.key))
  const showing = [
    picked.length > 0 ? nameList(picked.map((u) => u.label)) : null,
    gymsShowing.length > 0 ? nameList(gymsShowing) : null,
  ].filter(Boolean) as string[]
  return (
    <div
      data-testid="grade-filter"
      data-count={picked.length}
      onClick={(e) => e.stopPropagation()}
      className="border-ink-200 bg-ink-50/70 mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border px-2.5 py-2"
    >
      <span className="text-ink-500 text-[11px] font-bold uppercase tracking-[0.06em]">
        Highlight
      </span>
      {units.map((u) => {
        const on = selected.includes(u.key)
        return (
          <button
            key={u.key}
            type="button"
            data-testid="grade-filter-chip"
            data-unit={u.key}
            aria-pressed={on}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(u.key)
            }}
            className={`inline-flex min-h-[30px] cursor-pointer items-center rounded-lg border px-2 text-[11.5px] font-bold transition-colors ${
              on
                ? "border-court-600 bg-court-600 text-white"
                : "border-ink-300 text-ink-700 hover:border-ink-400 hover:bg-white bg-white/70"
            }`}
          >
            {u.label}
          </button>
        )
      })}
      {showing.length > 0 && (
        <span className="text-ink-600 ml-auto inline-flex items-center gap-2 text-[11.5px] font-semibold">
          <span data-testid="grade-filter-showing">Showing {showing.join(" at ")}</span>
          <button
            type="button"
            data-testid="grade-filter-clear"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="text-play-700 hover:text-play-800 min-h-[30px] cursor-pointer font-bold underline decoration-dotted underline-offset-2"
          >
            Clear
          </button>
        </span>
      )}
    </div>
  )
}

/**
 * WHAT IS IN YOUR HAND, said out loud. A grade, a gym off the tray, a whole
 * block looking for a lighter weekend, or a whole gym section. One at a time,
 * always, and Escape always puts it down.
 */
export function ArmedLines({
  armed,
  armedVenue,
  armedBlock,
  armedSection,
  gymShort,
  gradeList,
}: {
  armed: Armed | null
  armedVenue: string | null
  armedBlock: ArmedBlock | null
  armedSection: ArmedSection | null
  gymShort: (venueId: string) => string
  /** The grades in a block or a section, in the operator's own words. */
  gradeList: (unitKeys: string[]) => string
}) {
  return (
    <>
      {armed && (
        <p className="text-play-700 mb-3 text-xs font-semibold" aria-live="polite">
          {armed.label} is ready to move. Tap another weekend that month, or press Escape.
        </p>
      )}
      {armedVenue && (
        <p
          className="text-play-700 mb-3 text-xs font-semibold"
          aria-live="polite"
          data-testid="armed-venue"
        >
          {gymShort(armedVenue)} is ready to place. Tap a weekend that needs a gym, or press
          Escape.
        </p>
      )}
      {armedBlock && (
        <p
          className="text-play-700 mb-3 text-xs font-semibold"
          aria-live="polite"
          data-testid="armed-block"
        >
          {gradeList(armedBlock.unitKeys)} from {armedBlock.label} is looking for a weekend.
          Tap a lighter one that month, or press Escape.
        </p>
      )}
      {armedSection && (
        <p
          className="text-play-700 mb-3 text-xs font-semibold"
          aria-live="polite"
          data-testid="armed-section"
        >
          {gradeList(armedSection.unitKeys)} at {armedSection.gym} on{" "}
          {armedSection.weekendLabel} will move together. Tap another gym that month, or a
          weekend, or press Escape.
        </p>
      )}
    </>
  )
}

/**
 * A GYM THIS PLAN NO LONGER HAS (owner ruling 2026-08-05, #4). Loud, named, and
 * above the calendar, because it is the reason some games below have moved into
 * the dashed block.
 *
 * TWO WAYS OUT, AS BUTTONS (owner ruling 2026-08-05, #2): the whole calendar
 * redrawn in the world this plan has now, or just these games sent to a weekend
 * that month with room for them. Both are ordinary undoable edits to the
 * working copy.
 */
export function StrandedBanner({
  stranded,
  interactive,
  busy,
  strandedMove,
  onResolve,
  onMoveStranded,
}: {
  stranded: StrandedPlacement[]
  interactive: boolean
  busy: string | null
  /** The one move these games can actually take, when there is one. */
  strandedMove: { fromSessionId: string; unitKeys: string[]; to: PlannerWeekend } | null
  onResolve: () => void
  onMoveStranded: () => void
}) {
  if (stranded.length === 0) return null
  return (
    <div
      data-testid="stranded-gyms"
      data-count={stranded.length}
      aria-live="polite"
      className="border-hoop-300 bg-hoop-50 mb-2.5 rounded-xl border px-4 py-2.5"
    >
      <p className="text-hoop-900 text-[13px] font-bold">{PLAN_COPY.gymGone}</p>
      <p className="text-hoop-800 mt-0.5 text-[12px]">
        {strandedSentence(stranded)} Fill them from your pool, place a gym by hand, or move
        the games.
      </p>
      {/* TWO WAYS OUT, AS BUTTONS (owner ruling 2026-08-05, #2): the
          whole calendar redrawn in the world this plan has now, or just
          these games sent to a weekend that month with room for them.
          Both are ordinary undoable edits to the working copy. */}
      {interactive && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="resolve-world"
            disabled={busy !== null}
            onClick={(e) => {
              e.stopPropagation()
              onResolve()
            }}
            className={`${BTN_PRIMARY} ${BTN_MD} border-hoop-700 bg-hoop-600 hover:bg-hoop-700 hover:border-hoop-800`}
          >
            Re-solve in this world
          </button>
          {strandedMove && (
            <button
              type="button"
              data-testid="move-stranded"
              data-to={strandedMove.to.sessionId}
              disabled={busy !== null}
              onClick={(e) => {
                e.stopPropagation()
                onMoveStranded()
              }}
              className={`${BTN_SECONDARY} ${BTN_MD} border-hoop-300 text-hoop-900 hover:bg-hoop-50 hover:border-hoop-500`}
            >
              Move these games to {strandedMove.to.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
/**
 * THE EMPTY BOARD'S ONE BUTTON (owner ruling 2026-08-05, #1).
 *
 * A plan that has said when it runs and where, and has no calendar yet, is one
 * tap from the whole answer. That tap gets the middle of the screen: a plan whose
 * board is five empty months and a row of quiet links reads as broken, and the
 * operator's next move is not a guess anybody should have to make.
 *
 * The other half is the honest version of the same screen. A plan with no chosen
 * weekend, or with no home gym to fill one from, has nothing for the solver to
 * work with, so the hero does not offer a button that would draw five empty
 * months again. It names WHICH of the two is missing (owner ruling 2026-08-06)
 * and goes to the step that fixes it: "pick your weekends and gym time" was
 * unactionable from the day choosing a weekend stopped attaching a gym.
 */
/** "Has this person ever drawn a calendar" — a fact about the person, not any
 *  one plan, so it lives in the browser. */
const DREW_ONCE_KEY = "planner-drew-once"

export function DrawHero({
  usable,
  gap,
  busy,
  onDraw,
  onGoToStep,
}: {
  usable: boolean
  /** What the plan is short of, when it is short of something. */
  gap: WorldGap | null
  busy: boolean
  onDraw: () => void
  onGoToStep?: (step: number) => void
}) {
  const missing = gap ?? "both"
  /**
   * COMPACT ONCE THE BUTTON NEEDS NO INTRODUCTION (owner's 2026-08-06
   * analysis, C3). The first empty board a person ever meets gets the
   * full-size invitation; after their first draw anywhere the ceremony is
   * noise, so the card drops to one row. What the draw DOES lives in an info
   * popover either way — one tap for whoever asks, no paragraph for whoever
   * does not.
   */
  const [drewOnce] = useState(() => {
    try {
      return window.localStorage.getItem(DREW_ONCE_KEY) === "1"
    } catch {
      return false
    }
  })
  const draw = () => {
    try {
      window.localStorage.setItem(DREW_ONCE_KEY, "1")
    } catch {
      /* private mode: the hero simply stays full-size next time */
    }
    onDraw()
  }
  const compact = usable && drewOnce

  const how = (
    <WhyPopover
      text={`${COPY.drawHow} ${COPY.drawHint}`}
      label="How the draw works"
      testId="draw-how"
    >
      <span className="text-play-700 text-[11.5px] font-semibold underline decoration-dotted underline-offset-2">
        How it works
      </span>
    </WhyPopover>
  )

  return (
    <div
      data-testid="draw-hero"
      data-usable={usable ? "1" : "0"}
      data-gap={usable ? "" : missing}
      data-size={compact ? "compact" : "full"}
      onClick={(e) => e.stopPropagation()}
      className={`border-court-200 bg-court-50/70 mb-3 rounded-2xl border ${
        compact
          ? "flex flex-wrap items-center gap-3 px-3 py-2"
          : "px-5 py-5 text-center"
      }`}
    >
      {usable ? (
        <>
          <button
            type="button"
            data-testid="draw-calendar"
            disabled={busy}
            onClick={draw}
            className={`${BTN_PRIMARY} ${
              compact ? BTN_MD : "min-h-[44px] gap-2 rounded-xl px-6 text-[14px]"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="h-4 w-4 shrink-0"
            >
              <path d="M4 5h16v15H4z" />
              <path d="M4 10h16M9 5V3M15 5V3" />
            </svg>
            {COPY.drawTitle}
          </button>
          {compact ? (
            how
          ) : (
            <p className="mx-auto mt-2 max-w-md text-[12.5px]">
              <span className="text-ink-500">Nothing is saved until you say so. </span>
              {how}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-ink-900 text-[15px] font-bold">{COPY.worldFirst[missing]}</p>
          <p className="text-ink-500 mx-auto mt-1 max-w-md text-[12.5px]">
            {COPY.worldFirstHint[missing]}
          </p>
          <button
            type="button"
            data-testid="world-first"
            onClick={() => onGoToStep?.(2)}
            className={`${BTN_PRIMARY} ${BTN_LG} mt-3 rounded-xl`}
          >
            {COPY.worldFirstLink}
          </button>
        </>
      )}
    </div>
  )
}

/**
 * THE COLOUR KEY IS THE GYM LIST NOW (owner ruling 2026-08-06, #1).
 *
 * There used to be a legend here: a row that named every gym in its colour and
 * could not be touched, sitting directly above a tray of the same gyms that
 * could. Two rows, one question, and the backup gym appeared in both wearing two
 * different tags. GymList (plan-ui) is the single row: same colours, same names,
 * same tags, and every card both picks its gym up and spotlights it.
 */
