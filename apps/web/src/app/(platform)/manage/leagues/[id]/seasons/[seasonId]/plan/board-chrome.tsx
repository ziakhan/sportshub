"use client"

import type { PlannerWeekend } from "@/lib/scheduler/planner-core"
import { PLAN_COPY, isReferencePlan, type PlanRow } from "@/lib/scheduler/plan-documents"
import { strandedSentence, type StrandedPlacement } from "@/lib/scheduler/plan-world"
import type { StripVenue } from "@/lib/seasons/venue-strip"
import {
  PILL_TONE,
  hueFor,
  type Armed,
  type ArmedBlock,
  type ArmedSection,
} from "./plan-shared"
import { WhyPopover } from "./plan-ui"
import { PlanChooser } from "./plan-session"
import { Segmented } from "./season-strip"
import { COPY, type BoardSnapshot } from "./board-shared"

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
  onUndo,
  onRedraw,
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
  onUndo: () => void
  onRedraw: () => void
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
              className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-100 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
              className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-100 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
          {/* Which of this season's plans the board is a copy of. Switching
              mid-flight lives here; CHOOSING one is step 1's job. */}
          <PlanChooser
            locked={locked}
            busy={busy !== null}
            compact
            testId="board-plan-chooser"
            onBeforeChange={() => !dirty || window.confirm(PLAN_COPY.discard)}
          />
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
            className="border-hoop-600 bg-hoop-600 hover:bg-hoop-700 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border px-3 text-[12.5px] font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
              className="border-hoop-300 text-hoop-900 hover:border-hoop-400 hover:bg-hoop-100 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
 * weekend, or with gyms that are shut on every weekend it chose, has nothing for
 * the solver to fill, so the hero does not offer a button that would draw five
 * empty months again. It names the step that fixes it and goes there.
 */
export function DrawHero({
  usable,
  busy,
  onDraw,
  onGoToStep,
}: {
  usable: boolean
  busy: boolean
  onDraw: () => void
  onGoToStep?: (step: number) => void
}) {
  return (
    <div
      data-testid="draw-hero"
      data-usable={usable ? "1" : "0"}
      onClick={(e) => e.stopPropagation()}
      className="border-court-200 bg-court-50/70 mb-3 rounded-2xl border px-5 py-7 text-center"
    >
      {usable ? (
        <>
          <button
            type="button"
            data-testid="draw-calendar"
            disabled={busy}
            onClick={onDraw}
            className="border-court-700 bg-court-600 hover:bg-court-700 inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border px-6 text-[15px] font-bold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
          <p className="text-ink-500 mx-auto mt-2.5 max-w-md text-[12.5px]">{COPY.drawHint}</p>
        </>
      ) : (
        <>
          <p className="text-ink-900 text-[15px] font-bold">{COPY.worldFirst}</p>
          <p className="text-ink-500 mx-auto mt-1 max-w-md text-[12.5px]">{COPY.worldFirstHint}</p>
          <button
            type="button"
            data-testid="world-first"
            onClick={() => onGoToStep?.(2)}
            className="border-court-700 bg-court-600 hover:bg-court-700 mt-3 inline-flex min-h-[40px] cursor-pointer items-center rounded-xl border px-4 text-[13px] font-bold text-white shadow-sm transition-colors"
          >
            {COPY.worldFirstLink}
          </button>
        </>
      )}
    </div>
  )
}

/**
 * The one line that says this plan was drawn in a different world (owner
 * 2026-08-02: "a new plan also could have different venues. It could have
 * different settings, so how are you going to save it and how do you
 * remember?").
 *
 * Quiet gold, above the calendar, leading with the difference that matters
 * most and counting the rest; the whole list is one tap away. It is never an
 * alarm: a plan saved in October under October's gyms is not broken, it is
 * simply older than the season it sits in, and the operator is the one who
 * decides whether that matters.
 */
export function DriftLine({
  drift,
  unknown,
  onPlanWorld,
}: {
  drift: string[]
  /** The plan predates world-tracking, so there is nothing to compare. */
  unknown: boolean
  /** The board is drawing the plan's own settings rather than the season's. */
  onPlanWorld: boolean
}) {
  if (!unknown && drift.length === 0) return null
  const lead = unknown ? PLAN_COPY.driftUnknown : PLAN_COPY.drift(drift[0], drift.length - 1)
  const whole = [
    ...(unknown ? [PLAN_COPY.driftUnknown] : drift),
    onPlanWorld ? PLAN_COPY.driftBoard : PLAN_COPY.driftActive,
  ].join(" ")
  return (
    // A thin gold spine over a pale wash, the same gold the step's other
    // notices wear. Deliberately NOT gold TEXT: the palette stops at gold-600,
    // which is too light to read at this size.
    <p
      className="border-gold-400 bg-gold-50 text-ink-800 mb-2.5 flex flex-wrap items-center gap-2 rounded-lg border-l-[3px] px-2.5 py-1.5 text-[11.5px]"
      data-testid="plan-drift"
    >
      <span className="font-semibold">{lead}</span>
      <WhyPopover
        text={whole}
        label="What is different about this plan's settings"
        testId="plan-drift-why"
      >
        <span className="text-play-700 font-semibold underline decoration-dotted underline-offset-2">
          What changed
        </span>
      </WhyPopover>
    </p>
  )
}

/**
 * Which colour is which gym (owner 2026-08-02: "there is no clear indication
 * that blue is Burlington and the green is Six Park"). It sits ABOVE the
 * calendar, in both views, because a key nobody scrolls to is not a key, and it
 * names the gyms in full: the columns and the strip abbreviate, this does not.
 *
 * The glyph legend under the board answers a different question, so the two
 * stay apart.
 *
 * EVERY GYM IN THE ROSTER IS NAMED HERE (owner ruling 2026-08-05, #1). That
 * includes the backup nobody has phoned: it has no weekend, so it has no colour
 * anywhere on the calendar, and a key that skipped it left the operator hunting
 * for a gym he knew he had added. It gets a hollow dot and says what it is.
 */
export function GymLegend({
  order,
  hue,
  fillsFirst,
  backup,
}: {
  order: StripVenue[]
  hue: Map<string, number>
  /** The building the league owns, if it has one. */
  fillsFirst: string | null
  /** The pool gyms this plan has no weekend on: real, rentable, unasked. */
  backup: Set<string>
}) {
  if (order.length === 0) return null
  return (
    <div
      className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-1"
      data-testid="gym-legend"
    >
      {order.map((gym) => {
        const paint = hueFor(hue, gym.venueId)
        const spare = backup.has(gym.venueId)
        return (
          <span key={gym.venueId} className="inline-flex items-center gap-1.5 text-[11.5px]">
            <i
              aria-hidden
              className={`h-2.5 w-2.5 flex-none rounded-full ${
                spare ? "border-ink-400 border border-dashed" : paint.swatch
              }`}
            />
            <b className={`font-bold ${spare ? "text-ink-700" : paint.name}`}>{gym.name}</b>
            {gym.venueId === fillsFirst && (
              <span className="text-ink-400 font-semibold">home gym</span>
            )}
            {spare && (
              <span
                data-testid="legend-backup"
                data-venue-id={gym.venueId}
                className="border-ink-300 text-ink-500 rounded-md border border-dashed px-1 text-[10.5px] font-semibold"
              >
                backup
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
