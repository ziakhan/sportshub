"use client"

import { useMemo, useState } from "react"
import {
  weekendDemand,
  type PlacementReason,
  type PlannerState,
  type PlannerUnit,
  type RentalBlock,
} from "@/lib/scheduler/planner-core"
import { fridayWindowLabel } from "@/lib/scheduler/plan-world"
import type { BoardColumn, BuildingRoom, GhostDate } from "@/lib/scheduler/plan-world"
import { BTN_SECONDARY } from "./plan-shared"
import type { Armed, ArmedBlock, ArmedSection, GhostChip } from "./plan-shared"
import { GLYPH_LEGEND, ReasonGlyph, type BlockStatus, type SplitAxis } from "./plan-ui"
import {
  EMPTY_GHOSTS,
  EMPTY_KEYS,
  NOT_TARGET,
  TARGET_RING,
  ghostIntentFromDrag,
  plural,
  type GhostIntent,
} from "./board-shared"
import { GradeChip } from "./grade-chip"
import { WeekendCard } from "./weekend-card"

/** The board: one column per month window, weekends stacked inside. Where a
 *  month gets rearranged, which is what a column is good at. */
export function BoardView({
  state,
  assignment,
  playsIn,
  whyIn,
  cameFrom,
  blocks,
  statusOf,
  unitByKey,
  hue,
  armed,
  armedVenue,
  armedBlock,
  armedSection,
  interactive,
  dragging,
  highlight,
  gymHighlight,
  scrollRef,
  flashSessions,
  flashUnits,
  ghosts,
  columns,
  ghostRoom,
  gymShort,
  courtOverrides,
  hoursOn,
  placedGyms,
  strandedAt,
  poolOn,
  roomsOn,
  onArm,
  onArmBlock,
  onArmSection,
  onDragging,
  onMove,
  onMoveBlock,
  onMoveSection,
  onRemove,
  onDrop,
  onDropVenue,
  onDropSection,
  onPlaceVenue,
  onCorrectCourts,
  onDropFriday,
  onSetHours,
  onOpenWeekend,
  onGhostDrop,
  splitAxesFor,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  /** Where every grade plays, for the whole calendar: sessionId → (unit key →
   *  venueId), from the step's one chronological pass. */
  playsIn: Record<string, Record<string, string>>
  /** Why each grade is there, from the same pass. */
  whyIn: Record<string, Record<string, PlacementReason>>
  /** The gym each grade was playing BEFORE that weekend, so a caption can
   *  name the building somebody was moved out of. */
  cameFrom: Record<string, Record<string, string>>
  /** Every rental the calendar needs, from the same pass: what each weekend
   *  rents, and where it has nothing at all. */
  blocks: RentalBlock[]
  /** Where a rental stands, so a section can wear it. */
  statusOf: (sessionId: string, venueId: string) => BlockStatus
  unitByKey: Map<string, PlannerUnit>
  /** venueId → colour family. The step's one mapping, so a gym is the same
   *  colour here as it is on the strip. */
  hue: Map<string, number>
  armed: Armed | null
  /** A gym picked up from the tray, waiting for a weekend. */
  armedVenue: string | null
  /** A whole block picked up and looking for a lighter weekend. */
  armedBlock: ArmedBlock | null
  /** A whole gym section picked up, looking for a building or a weekend. */
  armedSection: ArmedSection | null
  interactive: boolean
  /** A mouse is mid-drag: the colours light up, the dashed offers stay shut. */
  dragging: boolean
  /** The grades the operator picked out, or null while that lens is off. */
  highlight: Set<string> | null
  /** The gyms the operator picked out, or null while that lens is off. The two
   *  combine as an intersection (owner ruling 2026-08-06, #4). */
  gymHighlight: Set<string> | null
  /** The horizontal scroller, so the rail can bring a weekend into view. */
  scrollRef: React.RefObject<HTMLDivElement>
  /** Weekends ringed for a moment: where the rail just jumped, and both ends
   *  of the move that just happened. */
  flashSessions: string[]
  /** The chips that just landed, keyed "<sessionId>|<unitKey>". */
  flashUnits: string[]
  /** "Grade 8 was here", for a few seconds, wherever a grade just left. */
  ghosts: GhostChip[]
  /** THE WHOLE SEASON, month by month (owner ruling 2026-08-06, slice B2): every
   *  Saturday it spans, as a card where the plan uses it and as a thin ghost row
   *  where it does not. */
  columns: BoardColumn[]
  /** What a date with nothing on it could hold, if the operator asserted the
   *  gyms behind it, either across the whole date or at one named building. The
   *  one number a ghost's drop offer is measured against. */
  ghostRoom: (key: string, dayCount: number, venueId?: string) => number
  /** A gym in the words a one-line offer has room for. */
  gymShort: (venueId: string) => string
  /** Gyms somebody gave a court number of their own, so a section can say it is
   *  not the whole building this weekend, or that we rented more of it. */
  courtOverrides: Record<string, number>
  /** The hours one gym runs on one weekend, and whether that is an exception. */
  hoursOn: (
    sessionId: string,
    venueId: string
  ) => { startTime: string; endTime: string; custom: boolean }
  /** Gyms placed on a weekend with no games in them yet: sessionId → venueIds. */
  placedGyms: Map<string, Set<string>>
  /** Grades whose building this plan no longer has, per weekend (owner ruling
   *  2026-08-05, #4): sessionId → the grades stranded there. */
  strandedAt: Map<string, Set<string>>
  /** The pool gyms a weekend actually holds, for the prompt a stranded block
   *  asks. */
  poolOn: (sessionId: string) => Array<{ venueId: string; short: string }>
  /** What each building on a weekend could hold, given what it already has. */
  roomsOn: (sessionId: string, used: Record<string, number>) => BuildingRoom[]
  onArm: (armed: Armed | null) => void
  onArmBlock: (block: ArmedBlock | null) => void
  onArmSection: (section: ArmedSection | null) => void
  /** A mouse picked something up, or put it down. */
  onDragging: (dragging: boolean) => void
  onMove: (unitKey: string, from: string | null, to: string) => void
  onMoveBlock: (unitKeys: string[], from: string, to: string) => void
  onMoveSection: (
    unitKeys: string[],
    from: string,
    to: string,
    toVenueId: string | null
  ) => void
  onRemove: (unitKey: string, from: string) => void
  onDrop: (e: React.DragEvent, to: string, toWindow: string) => void
  onDropVenue: (e: React.DragEvent, sessionId: string, unitKeys: string[], games: number) => void
  onDropSection: (
    e: React.DragEvent,
    sessionId: string,
    windowLabel: string,
    venueId: string,
    unitKeys: string[],
    games: number,
    canPlaceGym: boolean,
    canTakeChip: boolean
  ) => void
  onPlaceVenue: (sessionId: string, venueId: string, unitKeys: string[], games: number) => void
  onCorrectCourts: (sessionId: string, venueId: string, courts: number) => void
  /** Take a Friday evening back off a gym on a weekend (owner ruling
   *  2026-08-06). Absent on a board nobody may edit. */
  onDropFriday?: (sessionId: string, venueId: string) => void
  onSetHours: (
    sessionId: string,
    venueId: string,
    window: { startTime: string; endTime: string } | null
  ) => void
  onOpenWeekend: (sessionId: string) => void
  /** A gym or some grades landed on a date this plan was not using. The verb
   *  creates the weekend where the season has none, then lands the drop. */
  onGhostDrop: (ghost: GhostDate, windowLabel: string, intent: GhostIntent) => void
  splitAxesFor: (sessionId: string, unitKeys: string[]) => SplitAxis[]
}) {
  /**
   * A MONTH'S LEADING RUN OF UNUSED DATES, FOLDED (owner's 2026-08-06
   * analysis, C2). A season has more open Saturdays than played ones, and the
   * pile of thin ghost rows an operator has to scroll past before the first
   * card was most of every column. The leading run collapses to one thin row
   * per month; one tap opens it, and anything in the hand opens every month —
   * a drop target that is folded away is a drop that cannot land.
   */
  const [openGhosts, setOpenGhosts] = useState<Set<string>>(new Set())

  /** The rentals of each weekend, so a card never filters the whole season. */
  const blocksBySession = useMemo(() => {
    const out = new Map<string, RentalBlock[]>()
    for (const b of blocks) out.set(b.sessionId, [...(out.get(b.sessionId) ?? []), b])
    return out
  }, [blocks])

  /** The ghosts of each weekend, same reason. */
  const ghostsBySession = useMemo(() => {
    const out = new Map<string, GhostChip[]>()
    for (const g of ghosts) out.set(g.sessionId, [...(out.get(g.sessionId) ?? []), g])
    return out
  }, [ghosts])

  return (
    // Figure/ground (QA T-008.5): the board surface is faintly tinted so the
    // white cards separate from the page instead of white-on-white.
    <div
      className="bg-ink-50/60 overflow-x-auto rounded-2xl p-2 pb-2"
      ref={scrollRef}
      data-testid="board-scroll"
    >
      <div
        className="grid gap-2.5"
        style={{
          // 260 is the narrowest a column can be and still read (owner
          // 2026-08-02: "the meters are barely visible, the lines are too
          // short"). A long season scrolls sideways on purpose; it does not
          // crush its own columns to fit.
          gridTemplateColumns: `repeat(${columns.length}, minmax(280px, 1fr))`,
          minWidth: `${columns.length * 280}px`,
          // A two-month season should not stretch its columns across the whole
          // page just because there is room. The ceiling went up with the
          // full-bleed workspace (owner ruling 2026-08-04): the screen is wider
          // now, and a column that can breathe is the whole point of taking it.
          maxWidth: `${columns.length * 380}px`,
        }}
      >
        {columns.map((win, i) => {
          const inWindow = new Set(win.weekends.flatMap((w) => assignment[w.sessionId] ?? []))
          const missing = state.units.filter((u) => u.teams > 0 && !inWindow.has(u.key))
          /** WHAT A BENCHED GRADE WOULD BRING (owner ruling 2026-08-05). A chip
           *  waiting to be dragged carries the same games count as a chip
           *  already on a weekend, read off this month's own rate — so the
           *  number an operator is about to move is on the thing they pick up,
           *  not only on the thing they drop. */
          const monthRate =
            win.weekends.find((w) => w.chosen !== false && w.capacityGames > 0) ??
            win.weekends[0] ?? { targetGamesPerTeam: 2 }
          return (
            <section
              key={win.label}
              className="border-ink-200 bg-ink-50 rounded-2xl border p-2.5 shadow-sm"
            >
              <h3 className="text-ink-600 border-ink-200 mb-2 flex items-center justify-between gap-2 border-b pb-1.5 pl-1 text-[11.5px] font-bold uppercase tracking-[0.08em]">
                <span>
                  {win.roundName ?? `Session ${i + 1}`} · {win.label.split(" ")[0]}
                </span>
              </h3>
              {(() => {
                const holding = Boolean(armed || armedVenue || armedBlock || armedSection)
                let lead = 0
                while (lead < win.dates.length && win.dates[lead].kind === "ghost") lead++
                const open = openGhosts.has(win.label) || dragging || holding
                const collapsed = !open && lead >= 2
                const shown = collapsed ? win.dates.slice(lead) : win.dates
                const leads = win.dates
                  .slice(0, lead)
                  .flatMap((d) => (d.kind === "ghost" ? [d.ghost] : []))
                const range =
                  leads.length >= 2 ? `${leads[0].label} to ${leads[leads.length - 1].label}` : ""
                return (
                  <>
                    {collapsed && (
                      <button
                        type="button"
                        data-testid="ghost-collapse"
                        data-window={win.label}
                        data-count={lead}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenGhosts((prev) => new Set(prev).add(win.label))
                        }}
                        className="border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700 mb-1.5 flex min-h-[30px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed bg-white/50 px-2.5 text-left text-[11px] transition-colors"
                      >
                        <span>
                          {plural(lead, "open weekend", "open weekends")} · {range}
                        </span>
                        <span className="text-play-700 font-bold">Show</span>
                      </button>
                    )}
                    {!collapsed && lead >= 2 && openGhosts.has(win.label) && (
                      <button
                        type="button"
                        data-testid="ghost-collapse-hide"
                        data-window={win.label}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenGhosts((prev) => {
                            const next = new Set(prev)
                            next.delete(win.label)
                            return next
                          })
                        }}
                        className="text-ink-400 hover:text-ink-600 mb-1 flex min-h-[24px] w-full cursor-pointer items-center justify-end px-1 text-[10.5px] font-semibold"
                      >
                        Hide open weekends
                      </button>
                    )}
                    {shown.map((date) =>
                date.kind === "ghost" ? (
                  /* A DATE THIS PLAN IS NOT USING (owner ruling 2026-08-06,
                     slice B2). One thin dashed row, and a full drop target: the
                     first thing dropped on it turns it into a card. */
                  <GhostDateRow
                    key={date.key}
                    ghost={date.ghost}
                    windowLabel={win.label}
                    interactive={interactive}
                    dragging={dragging}
                    roomFor={(venueId) =>
                      ghostRoom(date.ghost.sessionId ?? date.key, date.ghost.dayCount, venueId)
                    }
                    units={state.units}
                    rate={monthRate}
                    armed={armed}
                    armedVenue={armedVenue}
                    armedBlock={armedBlock}
                    armedSection={armedSection}
                    gymShort={gymShort}
                    onGhostDrop={onGhostDrop}
                  />
                ) : (
                  <WeekendCard
                    key={date.weekend.sessionId}
                    weekend={date.weekend}
                    fridayWhen={fridayWindowLabel(state)}
                    windowLabel={win.label}
                    units={state.units}
                    keys={assignment[date.weekend.sessionId] ?? []}
                    playsIn={playsIn[date.weekend.sessionId] ?? {}}
                    whyIn={whyIn[date.weekend.sessionId] ?? {}}
                    cameFrom={cameFrom[date.weekend.sessionId] ?? {}}
                    blocks={blocksBySession.get(date.weekend.sessionId) ?? []}
                    statusOf={statusOf}
                    unitByKey={unitByKey}
                    hue={hue}
                    armed={armed}
                    armedVenue={armedVenue}
                    armedBlock={armedBlock}
                    armedSection={armedSection}
                    interactive={interactive}
                    dragging={dragging}
                    highlight={highlight}
                    gymHighlight={gymHighlight}
                    flash={flashSessions.includes(date.weekend.sessionId)}
                    flashUnits={flashUnits}
                    ghosts={ghostsBySession.get(date.weekend.sessionId) ?? EMPTY_GHOSTS}
                    courtOverrides={courtOverrides}
                    hoursFor={(venueId) => hoursOn(date.weekend.sessionId, venueId)}
                    placedGyms={placedGyms.get(date.weekend.sessionId) ?? EMPTY_KEYS}
                    strandedKeys={strandedAt.get(date.weekend.sessionId) ?? EMPTY_KEYS}
                    poolGyms={poolOn(date.weekend.sessionId)}
                    roomsFor={(used) => roomsOn(date.weekend.sessionId, used)}
                    onArm={onArm}
                    onArmBlock={onArmBlock}
                    onArmSection={onArmSection}
                    onDragging={onDragging}
                    onMove={onMove}
                    onMoveBlock={onMoveBlock}
                    onMoveSection={onMoveSection}
                    onRemove={onRemove}
                    onDrop={onDrop}
                    onDropVenue={onDropVenue}
                    onDropSection={onDropSection}
                    onPlaceVenue={onPlaceVenue}
                    onCorrectCourts={onCorrectCourts}
                    onDropFriday={onDropFriday}
                    onSetHours={onSetHours}
                    onOpenWeekend={onOpenWeekend}
                    splitAxesFor={splitAxesFor}
                    onDisarm={() => onArm(null)}
                  />
                )
              )}
                  </>
                )
              })()}

              {missing.length > 0 && (
                <div
                  className="border-ink-200 rounded-xl border border-dashed p-2"
                  data-testid="bench-group"
                >
                  <p className="text-ink-400 text-[10px] font-bold uppercase tracking-wide">
                    Not playing this month
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {missing.map((u) => (
                      <GradeChip
                        key={u.key}
                        unit={u}
                        games={monthRate ? weekendDemand(state.units, monthRate, [u.key]) : undefined}
                        fromSessionId={null}
                        windowLabel={win.label}
                        weekendLabel="the bench"
                        armed={armed}
                        interactive={interactive}
                        // A benched grade is in no building, so the GYM lens can
                        // never light it: it is dimmed whenever that lens is on.
                        highlight={
                          highlight == null && gymHighlight == null
                            ? null
                            : gymHighlight == null && highlight?.has(u.key)
                              ? "on"
                              : "off"
                        }
                        onArm={onArm}
                        // A benched grade dragged off the bench lights the board
                        // up the same way one already on a weekend does.
                        onDragState={(drag) => {
                          onDragging(drag)
                          onArm(
                            drag
                              ? {
                                  unitKey: u.key,
                                  label: u.label,
                                  fromSessionId: null,
                                  window: win.label,
                                }
                              : null
                          )
                        }}
                        muted
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* The glyphs, in words, once. A chip's mark is never the only place a
          reason is said: it is also in the chip's own popover and in the aria
          label the strip carries. */}
      <div
        className="text-ink-400 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px]"
        data-testid="board-legend"
      >
        {GLYPH_LEGEND.map((entry) => (
          <span key={entry.glyph} className="inline-flex items-center gap-1">
            <ReasonGlyph glyph={entry.glyph} />
            {entry.words}
          </span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------- a date nobody is using ------------------------ */

/**
 * A GHOST DATE (owner ruling 2026-08-06, slice B2). The board shows the whole
 * season, so every Saturday the season spans is here — and the ones this plan
 * is not using are one thin dashed row each: the date, and the words "not
 * planned".
 *
 * IT REPLACES "ADD A WEEKEND", which was a disclosure at the foot of every month
 * hiding the unused Saturdays behind a toggle and a confirm dialog. Two things
 * were wrong with it: the dates a plan could grow into were the one thing an
 * operator had to go looking for, and a date that exists but is not used looked
 * exactly like a date that does not exist at all.
 *
 * A ghost is a FULL drop target under the board's one capacity rule (ruling
 * 2026-08-06, #3): what counts is what a drop MAY assert, and nothing is
 * attached to an unused date, so every gym in the plan's roster is behind it.
 * Drop a gym and the building lands there empty; drop grades and they bring a
 * building with them. Either way the first drop turns the ghost into a card.
 *
 * THIN IS THE POINT. A season has more unused Saturdays than used ones, so this
 * row stays one line high and one shade quieter than everything around it. When
 * it is a live target it says what would happen IN THAT SAME LINE — the offer
 * replaces the "not planned", so nothing below it ever moves under the cursor.
 */
function GhostDateRow({
  ghost,
  windowLabel,
  interactive,
  dragging,
  roomFor,
  units,
  rate,
  armed,
  armedVenue,
  armedBlock,
  armedSection,
  gymShort,
  onGhostDrop,
}: {
  ghost: GhostDate
  windowLabel: string
  interactive: boolean
  /** A mouse is mid-drag, so the written offer stays shut: a button appearing
   *  under a moving cursor moves the drop point out from under it. */
  dragging: boolean
  /** Games this date could hold if the gyms behind it were asserted: across the
   *  whole date, or at one named building. */
  roomFor: (venueId?: string) => number
  units: PlannerUnit[]
  /** The month's own games rate, so a grade brings the same number here it
   *  would bring to any card in this column. */
  rate: { targetGamesPerTeam: number }
  armed: Armed | null
  armedVenue: string | null
  armedBlock: ArmedBlock | null
  armedSection: ArmedSection | null
  gymShort: (venueId: string) => string
  onGhostDrop: (ghost: GhostDate, windowLabel: string, intent: GhostIntent) => void
}) {
  const holding = Boolean(armed || armedBlock || armedSection || armedVenue)
  const inMonth = (win: string | undefined) => win === windowLabel
  const room = roomFor()
  const bringing = (unitKeys: string[]) => weekendDemand(units, rate, unitKeys)
  const fits = (unitKeys: string[]) => room >= bringing(unitKeys)

  /**
   * WHAT WOULD LAND HERE, and whether this date can really take it. A grade
   * stays inside its own month, because a grade plays one weekend a month; a gym
   * has no month of its own and can go on any date — but it has to be a building
   * that could really open here, or the offer would be one the board then argues
   * with (owner ruling 2026-08-05, #1: valid targets only).
   */
  const offer: { intent: GhostIntent; label: string } | null = armedVenue
    ? roomFor(armedVenue) > 0
      ? { intent: { kind: "gym", venueId: armedVenue }, label: `Put ${gymShort(armedVenue)} here` }
      : null
    : armedSection && inMonth(armedSection.window) && fits(armedSection.unitKeys)
      ? {
          intent: {
            kind: "grades",
            unitKeys: armedSection.unitKeys,
            fromSessionId: armedSection.sessionId,
          },
          label: `Move ${plural(armedSection.unitKeys.length, "grade", "grades")} here`,
        }
      : armedBlock && inMonth(armedBlock.window) && fits(armedBlock.unitKeys)
        ? {
            intent: {
              kind: "grades",
              unitKeys: armedBlock.unitKeys,
              fromSessionId: armedBlock.sessionId,
            },
            label: `Move ${plural(armedBlock.unitKeys.length, "grade", "grades")} here`,
          }
        : armed && inMonth(armed.window) && fits([armed.unitKey])
          ? {
              intent: {
                kind: "grades",
                unitKeys: [armed.unitKey],
                fromSessionId: armed.fromSessionId,
              },
              label: `Move ${armed.label} here`,
            }
          : null
  const canTake = interactive && room > 0 && offer !== null

  return (
    <div
      data-testid="ghost-date"
      data-date={ghost.dateISO.slice(0, 10)}
      data-session-id={ghost.sessionId ?? undefined}
      data-target={holding ? (canTake ? "1" : "0") : undefined}
      onClick={(e) => {
        if (!canTake || !offer) return
        e.stopPropagation()
        onGhostDrop(ghost, windowLabel, offer.intent)
      }}
      // A drop is refused at the browser level where the board would refuse it,
      // so there is never an argument about it afterwards. A drag arms whatever
      // it is carrying, which is why the same test answers for both paths.
      onDragOver={(e) => {
        if (canTake) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!canTake) return
        const intent = ghostIntentFromDrag(e)
        if (!intent) return
        if (intent.kind === "gym" ? roomFor(intent.venueId) <= 0 : !fits(intent.unitKeys)) return
        e.preventDefault()
        e.stopPropagation()
        onGhostDrop(ghost, windowLabel, intent)
      }}
      className={`border-ink-200 mb-1.5 flex min-h-[28px] items-center gap-2 rounded-lg border border-dashed px-2 py-0.5 motion-safe:transition-opacity ${
        canTake ? `${TARGET_RING} bg-court-50/60` : holding ? NOT_TARGET : ""
      }`}
    >
      <span className="text-ink-500 text-[11.5px] font-semibold">{ghost.label}</span>
      {canTake && offer && !dragging ? (
        <button
          type="button"
          data-testid="ghost-offer"
          onClick={(e) => {
            e.stopPropagation()
            onGhostDrop(ghost, windowLabel, offer.intent)
          }}
          aria-label={`${offer.label}, ${ghost.label}`}
          className="text-court-800 ml-auto cursor-pointer truncate text-[10.5px] font-bold underline decoration-dotted underline-offset-2"
        >
          {offer.label}
        </button>
      ) : (
        <span className="text-ink-300 ml-auto text-[10.5px]">Not planned</span>
      )}
    </div>
  )
}
