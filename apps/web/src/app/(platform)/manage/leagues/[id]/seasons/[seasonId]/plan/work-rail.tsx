"use client"

import { useMemo, useState } from "react"
import {
  assignmentWithMove,
  gradeGymStrip,
  gradeHomeGym,
  gymCountsSentence,
  packedWeekendLoad,
  railSuggestions,
  venuesWithoutUnit,
  weekendDemand,
  type GradeStripCell,
  type PlannerState,
  type PlannerSuggestion,
  type PlannerWeekend,
  type RentalBlock,
  type SuggestionMove,
} from "@/lib/scheduler/planner-core"
import { PLAN_COPY } from "@/lib/scheduler/plan-documents"
import { strandedSentence, type StrandedPlacement } from "@/lib/scheduler/plan-world"
import { PILL_TONE, fractionTone, hueFor } from "./plan-shared"
import { BlockSummary, CountChip, Fraction, WhyPopover } from "./plan-ui"
import { plural } from "./board-shared"

/* ----------------------------- the rail ---------------------------------- */

/**
 * What a move buys, in two words. Green fixes a problem, indigo tidies.
 *
 * "fills the weekend" is gone with the move behind it (owner ruling 2026-08-05,
 * #5): the rail no longer offers to put an empty Saturday to work, because
 * running one more Saturday is the second most expensive thing a plan can do and
 * an idle chosen weekend is compact-first succeeding.
 */
const OUTCOME: Record<SuggestionMove["resolves"], { words: string; tone: string }> = {
  shortage: { words: "clears shortage", tone: "bg-court-50 text-court-800" },
  "two-building": { words: "one building", tone: "bg-play-50 text-play-700" },
}

/**
 * THE WORK RAIL (owner ruling 2026-08-04, from the approved prototype). A
 * column that does not move while five months of calendar scroll past it,
 * because what is LEFT TO DO is the one thing an operator should never have to
 * go and find.
 *
 * Loudest first, and the count is the loudest thing of all: "2 open" at the top
 * says whether this plan is finished before a single row is read. Then the
 * standing facts about the season's rentals, then the weekends that do not fit,
 * then the moves worth taking. Every row names a weekend and every row is a
 * JUMP: clicking it brings that weekend under the rail rather than asking
 * somebody to scroll for it.
 *
 * The move rows are unchanged from 2026-08-02: the move as a sentence, the two
 * numbers that decide it, the full maths one tap away, and what it costs said
 * out loud. The ideas past the first two still fold away.
 */
export function WorkRail({
  state,
  assignment,
  venues,
  playsIn,
  suggestions,
  blocks,
  blockCounts,
  stranded,
  hue,
  gymShort,
  aboutLabel = "this calendar",
  interactive,
  onMove,
  onJump,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  /** The gyms somebody DECIDED, which is what a move carries forward. */
  venues: Record<string, Record<string, string>>
  /** Where every grade plays on the board right now, for the row's tint. */
  playsIn: Record<string, Record<string, string>>
  suggestions: PlannerSuggestion[]
  /** Every rental the calendar needs, so the rail can lead with the ones that
   *  have no building. */
  blocks: RentalBlock[]
  blockCounts: { total: number; confirmed: number; assumed: number; needed: number }
  /** Placements whose gym or weekend this plan no longer has (owner ruling
   *  2026-08-05, #4). Counted as OPEN, because they are: those games have
   *  nowhere to play until somebody moves them. */
  stranded: StrandedPlacement[]
  hue: Map<string, number>
  gymShort: (venueId: string) => string
  /** Whose calendar this is critiquing, in the operator's own words. The rail
   *  is read next to a board that could be any season, so it says which one. */
  aboutLabel?: string
  interactive: boolean
  onMove: (unitKey: string, from: string | null, to: string) => void
  /** Put a weekend under the rail. */
  onJump: (sessionId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => railSuggestions(suggestions), [suggestions])
  const weekendById = useMemo(() => {
    const out = new Map<string, PlannerWeekend>()
    for (const win of state.windows) for (const w of win.weekends) out.set(w.sessionId, w)
    return out
  }, [state])

  const problems = rows.filter((s) => !s.move)
  const ideas = rows.filter((s) => s.move)
  const shownIdeas = expanded ? ideas : ideas.slice(0, 2)
  const folded = ideas.length - shownIdeas.length

  /** The first weekend with a rental nobody has a building for: where "needs a
   *  building" sends you. */
  const firstNeeded = blocks.find((b) => b.venueId === null && b.games > 0)?.sessionId ?? null

  /** WHAT IS STILL OPEN. A weekend over its courts, a rental with no building,
   *  and a placement whose gym this plan lost are the three things that stop a
   *  plan being finishable; an assumed booking is a phone call, not a hole, so
   *  it is warned about and not counted. */
  const open = problems.length + blockCounts.needed + stranded.length

  return (
    <section
      className="border-ink-300 shadow-panel bg-ink-50 overflow-hidden rounded-2xl border"
      aria-live="polite"
      data-testid="suggestion-rail"
    >
      {/* THE RAIL IS NOT ANOTHER CARD (owner ruling 2026-08-05). It is the
          control panel beside the work: a darker head, its own background tone
          and a real border, so the eye never mistakes it for a weekend. */}
      <div className="border-ink-300 bg-ink-100 flex items-baseline gap-2 border-b px-3 py-2.5">
        <h2 className="text-ink-900 text-[14px] font-bold uppercase tracking-[0.05em]">
          What is left
        </h2>
        <span
          data-testid="rail-open-count"
          className={`ml-auto rounded-full border px-2 py-[1px] text-[11px] font-bold tabular-nums ${
            open > 0 ? PILL_TONE.bad : PILL_TONE.ok
          }`}
        >
          {open === 0 ? "all clear" : `${open} open`}
        </span>
      </div>

      <div className="space-y-1.5 p-2.5">
        {/* Whose calendar the rail is talking about. Said even when every row is
            a problem, because a problem belongs to a season too. */}
        <p className="text-ink-500 px-1 text-[11.5px] font-semibold" data-testid="rail-about">
          Ideas for {aboutLabel}
        </p>

        {/* A GYM THIS PLAN NO LONGER HAS, counted where what-is-left is counted
            (owner ruling 2026-08-05, #4). First, because it is the loudest thing
            true about the calendar: those games have nowhere to play. */}
        {stranded.length > 0 && (
          <RailStanding
            tone="bad"
            title={`${plural(stranded.length, "placement has", "placements have")} no building`}
            detail={strandedSentence(stranded) ?? PLAN_COPY.gymGone}
            onJump={() => onJump(stranded[0].sessionId)}
          />
        )}

        {/* THE STANDING FACTS about what this calendar rents. Loud when a
            rental has no building, quiet gold while one is only assumed. */}
        {blockCounts.total > 0 && (
          <RailStanding
            tone={blockCounts.needed > 0 ? "bad" : "good"}
            title={
              blockCounts.needed > 0
                ? `${plural(blockCounts.needed, "rental needs", "rentals need")} a building`
                : "Every rental has a building"
            }
            detail={
              blockCounts.needed > 0
                ? "Fill them from your pool, place a gym by hand, or move the games."
                : `${plural(blockCounts.total, "rental", "rentals")} behind this calendar.`
            }
            onJump={firstNeeded ? () => onJump(firstNeeded) : undefined}
          />
        )}
        {blockCounts.assumed > 0 && (
          <RailStanding
            tone="warn"
            title={`${plural(blockCounts.assumed, "booking is", "bookings are")} assumed`}
            detail="A gym our pool answered, that nobody has phoned yet."
          />
        )}

        {problems.map((s, i) => {
          const weekend = weekendById.get(s.sessionId)
          if (!weekend) return null
          // The same packed truth the board card wears, so the rail and the
          // weekend it is pointing at can never read different numbers.
          const load = packedWeekendLoad(
            state.units,
            weekend,
            assignment[s.sessionId] ?? [],
            blocks.filter((b) => b.sessionId === s.sessionId)
          )
          return (
            <div
              key={`problem-${s.sessionId}-${i}`}
              data-testid="rail-problem"
              onClick={() => onJump(s.sessionId)}
              className="border-hoop-300 bg-hoop-50 hover:bg-hoop-100 flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-sm transition-colors"
            >
              <button
                type="button"
                data-testid="rail-jump"
                onClick={(e) => {
                  e.stopPropagation()
                  onJump(s.sessionId)
                }}
                aria-label={`Show ${weekend.label} on the board`}
                className="text-hoop-800 hover:text-hoop-900 min-h-[24px] cursor-pointer text-[12.5px] font-bold underline decoration-dotted underline-offset-2"
              >
                {weekend.label}
              </button>
              <WhyPopover
                text={s.text}
                label={`What ${weekend.label} is short of`}
                testId="problem-why"
              >
                <Fraction
                  is={load.demand}
                  of={load.capacity}
                  tone="over"
                  title={`${weekend.label}: ${load.demand} games of ${load.capacity} we hold`}
                />
              </WhyPopover>
            </div>
          )
        })}

        {shownIdeas.map((s, i) => (
          <SuggestionRow
            key={`idea-${s.sessionId}-${s.move?.unitKey}-${i}`}
            state={state}
            assignment={assignment}
            venues={venues}
            playsIn={playsIn}
            move={s.move as SuggestionMove}
            text={s.text}
            toWeekend={weekendById.get((s.move as SuggestionMove).toSessionId)}
            hue={hue}
            gymShort={gymShort}
            interactive={interactive}
            onMove={onMove}
            onJump={onJump}
          />
        ))}

        {rows.length === 0 && blockCounts.total === 0 && (
          <p className="text-ink-500 px-1 text-[12px]">
            Nothing to fix and nothing to rent. Every weekend fits in the gym you own.
          </p>
        )}

        {folded > 0 && (
          <button
            type="button"
            data-testid="more-ideas"
            aria-expanded={false}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(true)
            }}
            className="text-ink-500 hover:text-ink-800 cursor-pointer px-1 py-1 text-[12.5px] font-semibold"
          >
            {folded} more {folded === 1 ? "idea" : "ideas"}
          </button>
        )}
        {expanded && ideas.length > 2 && (
          <button
            type="button"
            data-testid="more-ideas"
            aria-expanded
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
            className="text-ink-500 hover:text-ink-800 cursor-pointer px-1 py-1 text-[12.5px] font-semibold"
          >
            Fewer ideas
          </button>
        )}
      </div>

      {/* The rentals behind this plan, counted, at the foot of the column that
          is about what is left (owner ruling 2026-08-04). */}
      <div className="border-ink-300 bg-ink-100/70 border-t px-3 py-2">
        <BlockSummary
          total={blockCounts.total}
          confirmed={blockCounts.confirmed}
          assumed={blockCounts.assumed}
          needed={blockCounts.needed}
        />
        {blockCounts.total === 0 && <span className="text-ink-500 text-xs">Nothing to rent.</span>}
      </div>
    </section>
  )
}

/** One standing fact about the season, in the rail's own three tones. A row
 *  with somewhere to go is a jump; one that is only a statement is not. */
function RailStanding({
  tone,
  title,
  detail,
  onJump,
}: {
  tone: "bad" | "warn" | "good"
  title: string
  detail: string
  onJump?: () => void
}) {
  const paint =
    tone === "bad"
      ? "border-hoop-200 bg-hoop-50 text-hoop-800"
      : tone === "warn"
        ? "border-gold-400 bg-gold-50 text-gold-600"
        : "border-court-200 bg-court-50 text-court-800"
  const body = (
    <>
      <span className="block text-[12.5px] font-bold">{title}</span>
      <span className="text-ink-600 mt-0.5 block text-[11.5px]">{detail}</span>
    </>
  )
  if (!onJump) {
    return (
      <div data-testid="rail-standing" className={`rounded-lg border px-3 py-1.5 ${paint}`}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      data-testid="rail-standing"
      onClick={(e) => {
        e.stopPropagation()
        onJump()
      }}
      className={`w-full rounded-lg border px-3 py-1.5 text-left ${paint} hover:brightness-[0.98]`}
    >
      {body}
    </button>
  )
}

/**
 * One move, as a sentence with the two numbers that decide it (owner
 * 2026-08-02: "it's not very clear that 27 is a number of games... do we
 * really have to put the capacity, the current capacity, the usage of the
 * gym").
 *
 * The lead says what would happen and the number wears its unit. Beside it,
 * only what is load bearing: what is wrong where the grade is now, and what is
 * left where it would go. Under it, what the move COSTS, because a row that
 * reads like free money is a lie: the games the destination takes on, and the
 * building the grade ends up in when that is not its own. The full capacity
 * maths is in the lead's popover, in the words the core composed.
 */
function SuggestionRow({
  state,
  assignment,
  venues,
  playsIn,
  move,
  text,
  toWeekend,
  hue,
  gymShort,
  interactive,
  onMove,
  onJump,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  playsIn: Record<string, Record<string, string>>
  move: SuggestionMove
  /** The whole thing in prose, composed in the pure core. The row lays out the
   *  headline; this is what the popover says. */
  text: string
  /** The weekend the grade would land on, for the games it brings there. A
   *  weekend can run a different games-per-team than the one it leaves. */
  toWeekend?: PlannerWeekend
  hue: Map<string, number>
  gymShort: (venueId: string) => string
  interactive: boolean
  onMove: (unitKey: string, from: string | null, to: string) => void
  /** Both weekends a move names are jump targets: the rail is the index and
   *  the board is the page. */
  onJump: (sessionId: string) => void
}) {
  const before = useMemo(
    () => gradeGymStrip(state, assignment, venues, move.unitKey),
    [state, assignment, venues, move.unitKey]
  )
  // The same calendar with this one move made, packed the same way the board
  // will pack it the moment the button is pressed. Nothing here is mutated.
  const after = useMemo(
    () =>
      gradeGymStrip(
        state,
        assignmentWithMove(assignment, move.unitKey, move.fromSessionId, move.toSessionId),
        venuesWithoutUnit(venues, move.unitKey, [move.fromSessionId, move.toSessionId]),
        move.unitKey
      ),
    [state, assignment, venues, move.unitKey, move.fromSessionId, move.toSessionId]
  )
  const paint = hueFor(hue, playsIn[move.fromSessionId]?.[move.unitKey])
  const outcome = OUTCOME[move.resolves]
  /** The building this grade plays most: its home, by the core's own rule.
   *  The miniature outlines against it and the cost line names it. */
  const home = gradeHomeGym(before)
  /** Where the move stands the grade on the weekend it lands on. */
  const lands = after.find((c) => c.sessionId === move.toSessionId)?.venueId ?? null
  const story = `${gymCountsSentence(before, after, gymShort)}${move.lands ? ` ${move.lands}` : ""}`

  const lead = `Move ${move.unitLabel}'s ${plural(move.games, "game", "games")}`
  const over = Math.max(0, move.fromBefore.demand - move.fromBefore.capacity)
  const left = move.toAfter.capacity - move.toAfter.demand
  /** Games the destination takes on, counted on ITS own weekend. */
  const takes = toWeekend ? weekendDemand(state.units, toWeekend, [move.unitKey]) : move.games
  const cost = [
    `${move.toLabel} takes ${plural(takes, "more game", "more games")}.`,
    // The move.lands data says the same thing in the popover; the row says it
    // in the words a parent would use.
    lands && home && lands !== home
      ? `${move.unitLabel} plays at ${gymShort(lands)} that weekend.`
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className="border-ink-200 rounded-xl border bg-white px-3 py-2 shadow-sm"
      data-testid="rail-idea"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <i aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${paint.swatch}`} />
        <WhyPopover
          text={text}
          label={`${lead}. The numbers behind this move.`}
          testId="idea-why"
          className="text-ink-900 inline-flex min-h-[32px] items-center px-0.5 text-[12.5px] font-bold"
        >
          {lead}
        </WhyPopover>
        <RailJump label={move.fromLabel} sessionId={move.fromSessionId} onJump={onJump} />
        {over > 0 && (
          <CountChip
            tone="over"
            words={`${plural(over, "game", "games")} over`}
            testId="idea-problem"
          />
        )}
        <span aria-hidden className="text-ink-300 font-bold">
          →
        </span>
        <RailJump label={move.toLabel} sessionId={move.toSessionId} onJump={onJump} />
        <CountChip
          tone={fractionTone(move.toAfter.demand, move.toAfter.capacity)}
          words={
            left >= 0
              ? `fits, ${plural(left, "slot", "slots")} left`
              : `${plural(-left, "game", "games")} over`
          }
          testId="idea-destination"
        />
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${outcome.tone}`}>
          {outcome.words}
        </span>
        <ImpactStrip
          before={before}
          after={after}
          home={home}
          hue={hue}
          story={story}
          unitLabel={move.unitLabel}
        />
        {interactive && (
          <button
            type="button"
            data-testid="suggestion-move"
            data-unit-key={move.unitKey}
            onClick={(e) => {
              e.stopPropagation()
              onMove(move.unitKey, move.fromSessionId, move.toSessionId)
            }}
            aria-label={`Move ${move.unitLabel} from ${move.fromLabel} to ${move.toLabel}`}
            className="border-play-300 bg-play-50 text-play-700 hover:bg-play-100 ml-auto min-h-[40px] shrink-0 cursor-pointer rounded-lg border px-3 text-[12px] font-bold"
          >
            Move
          </button>
        )}
      </div>
      {/* What it costs, every time. */}
      <p className="text-ink-500 mt-1 px-0.5 text-[11.5px]" data-testid="idea-cost">
        {cost}
      </p>
    </div>
  )
}

/** A weekend named in the rail, and a way to go and look at it. */
function RailJump({
  label,
  sessionId,
  onJump,
}: {
  label: string
  sessionId: string
  onJump: (sessionId: string) => void
}) {
  return (
    <button
      type="button"
      data-testid="rail-jump"
      onClick={(e) => {
        e.stopPropagation()
        onJump(sessionId)
      }}
      aria-label={`Show ${label} on the board`}
      className="text-ink-600 hover:text-play-700 min-h-[24px] cursor-pointer whitespace-nowrap text-[12px] font-semibold underline decoration-dotted underline-offset-2"
    >
      {label}
    </button>
  )
}

/**
 * A grade's season in miniature, before and after: one cell per weekend it
 * plays, in date order, coloured by the gym. A cell that the move sends
 * somewhere other than the grade's home gym is outlined, so the one thing that
 * changed is the one thing you see. Static, on purpose: nothing on this screen
 * blinks at you.
 */
function ImpactStrip({
  before,
  after,
  home,
  hue,
  story,
  unitLabel,
}: {
  before: GradeStripCell[]
  after: GradeStripCell[]
  /** The grade's own gym, worked out by the row so the outline here and the
   *  cost line under it can never mean different buildings. */
  home: string | null
  hue: Map<string, number>
  story: string
  unitLabel: string
}) {
  const cells = (list: GradeStripCell[], mark: boolean) => (
    <span className="inline-flex gap-[2px]">
      {list.map((cell, i) => {
        const moved = mark && before[i] && before[i].venueId !== cell.venueId
        return (
          <i
            key={`${cell.sessionId}-${i}`}
            aria-hidden
            data-venue-id={cell.venueId}
            className={`block h-3 w-[9px] rounded-[3px] ${hueFor(hue, cell.venueId).swatch} ${
              moved && cell.venueId !== home
                ? "outline-gold-500 outline outline-2 outline-offset-1"
                : ""
            }`}
          />
        )
      })}
    </span>
  )

  return (
    <WhyPopover
      text={story}
      label={`${unitLabel}: its season before and after this move`}
      testId="impact-strip"
      className="inline-flex min-h-[32px] items-center gap-1.5 px-1"
    >
      {cells(before, false)}
      <span aria-hidden className="text-ink-300 text-[11px] font-bold">
        →
      </span>
      {cells(after, true)}
    </WhyPopover>
  )
}
