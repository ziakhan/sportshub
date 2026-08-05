"use client"

import { useMemo, useState } from "react"
import {
  weekendDemand,
  type PlacementReason,
  type PlannerState,
  type PlannerUnit,
  type RentalBlock,
  type WeekendDiff,
} from "@/lib/scheduler/planner-core"
import type { BuildingRoom } from "@/lib/scheduler/plan-world"
import type { Armed, ArmedBlock, ArmedSection, GhostChip } from "./plan-shared"
import { GLYPH_LEGEND, ReasonGlyph, type BlockStatus, type SplitAxis } from "./plan-ui"
import { EMPTY_GHOSTS, EMPTY_KEYS } from "./board-shared"
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
  placing,
  interactive,
  scrollRef,
  flashSessions,
  flashUnits,
  ghosts,
  addable,
  courtCaps,
  strandedAt,
  poolOn,
  roomsOn,
  onArm,
  onArmBlock,
  onArmSection,
  onMove,
  onMoveBlock,
  onMoveSection,
  onRemove,
  onSwitchGym,
  onDrop,
  onDropVenue,
  onDropSection,
  onPlaceVenue,
  onCorrectCourts,
  onOpenWeekend,
  onAddWeekend,
  splitAxesFor,
  compare,
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
  /** True while the operator is placing gyms by hand, which is what turns the
   *  slots and the rented sections into drop targets. */
  placing: boolean
  interactive: boolean
  /** The horizontal scroller, so the rail can bring a weekend into view. */
  scrollRef: React.RefObject<HTMLDivElement>
  /** Weekends ringed for a moment: where the rail just jumped, and both ends
   *  of the move that just happened. */
  flashSessions: string[]
  /** The chips that just landed, keyed "<sessionId>|<unitKey>". */
  flashUnits: string[]
  /** "Grade 8 was here", for a few seconds, wherever a grade just left. */
  ghosts: GhostChip[]
  /** Saturdays each month is not using yet, for the ghost card at the foot of
   *  the column. */
  addable: Map<string, Array<{ satDateISO: string; label: string }>>
  /** Gyms somebody corrected, so a section can say it is not the whole
   *  building this weekend. */
  courtCaps: Record<string, number>
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
  onMove: (unitKey: string, from: string | null, to: string) => void
  onMoveBlock: (unitKeys: string[], from: string, to: string) => void
  onMoveSection: (
    unitKeys: string[],
    from: string,
    to: string,
    toVenueId: string | null
  ) => void
  onRemove: (unitKey: string, from: string) => void
  onSwitchGym: (sessionId: string, unitKey: string, venueId: string) => void
  onDrop: (e: React.DragEvent, to: string, toWindow: string) => void
  onDropVenue: (e: React.DragEvent, sessionId: string, unitKeys: string[], games: number) => void
  onDropSection: (
    e: React.DragEvent,
    sessionId: string,
    windowLabel: string,
    venueId: string,
    unitKeys: string[],
    games: number,
    canPlaceGym: boolean
  ) => void
  onPlaceVenue: (sessionId: string, venueId: string, unitKeys: string[], games: number) => void
  onCorrectCourts: (sessionId: string, venueId: string, courts: number) => void
  onOpenWeekend: (sessionId: string) => void
  onAddWeekend: (satDateISO: string, label: string) => void
  splitAxesFor: (sessionId: string, unitKeys: string[]) => SplitAxis[]
  compare: { byWeekend: Map<string, WeekendDiff>; keptOn: Map<string, string> } | null
}) {
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
    <div className="overflow-x-auto pb-2" ref={scrollRef} data-testid="board-scroll">
      <div
        className="grid gap-2.5"
        style={{
          // 260 is the narrowest a column can be and still read (owner
          // 2026-08-02: "the meters are barely visible, the lines are too
          // short"). A long season scrolls sideways on purpose; it does not
          // crush its own columns to fit.
          gridTemplateColumns: `repeat(${state.windows.length}, minmax(280px, 1fr))`,
          minWidth: `${state.windows.length * 280}px`,
          // A two-month season should not stretch its columns across the whole
          // page just because there is room. The ceiling went up with the
          // full-bleed workspace (owner ruling 2026-08-04): the screen is wider
          // now, and a column that can breathe is the whole point of taking it.
          maxWidth: `${state.windows.length * 380}px`,
        }}
      >
        {state.windows.map((win, i) => {
          const inWindow = new Set(win.weekends.flatMap((w) => assignment[w.sessionId] ?? []))
          const missing = state.units.filter((u) => u.teams > 0 && !inWindow.has(u.key))
          /** WHAT A BENCHED GRADE WOULD BRING (owner ruling 2026-08-05). A chip
           *  waiting to be dragged carries the same games count as a chip
           *  already on a weekend, read off this month's own rate — so the
           *  number an operator is about to move is on the thing they pick up,
           *  not only on the thing they drop. */
          const monthRate =
            win.weekends.find((w) => w.chosen !== false && w.capacityGames > 0) ?? win.weekends[0]
          return (
            <section
              key={win.label}
              className="border-ink-200 bg-ink-50 rounded-2xl border p-2.5 shadow-sm"
            >
              <h3 className="text-ink-600 border-ink-200 mb-2 border-b pb-1.5 pl-1 text-[11.5px] font-bold uppercase tracking-[0.08em]">
                Session {i + 1} · {win.label.split(" ")[0]}
              </h3>
              {win.weekends.map((w) => (
                <WeekendCard
                  key={w.sessionId}
                  weekend={w}
                  windowLabel={win.label}
                  units={state.units}
                  keys={assignment[w.sessionId] ?? []}
                  playsIn={playsIn[w.sessionId] ?? {}}
                  whyIn={whyIn[w.sessionId] ?? {}}
                  cameFrom={cameFrom[w.sessionId] ?? {}}
                  blocks={blocksBySession.get(w.sessionId) ?? []}
                  statusOf={statusOf}
                  unitByKey={unitByKey}
                  hue={hue}
                  armed={armed}
                  armedVenue={armedVenue}
                  armedBlock={armedBlock}
                  armedSection={armedSection}
                  placing={placing}
                  interactive={interactive}
                  flash={flashSessions.includes(w.sessionId)}
                  flashUnits={flashUnits}
                  ghosts={ghostsBySession.get(w.sessionId) ?? EMPTY_GHOSTS}
                  courtCaps={courtCaps}
                  strandedKeys={strandedAt.get(w.sessionId) ?? EMPTY_KEYS}
                  poolGyms={poolOn(w.sessionId)}
                  roomsFor={(used) => roomsOn(w.sessionId, used)}
                  onArm={onArm}
                  onArmBlock={onArmBlock}
                  onArmSection={onArmSection}
                  onMove={onMove}
                  onMoveBlock={onMoveBlock}
                  onMoveSection={onMoveSection}
                  onRemove={onRemove}
                  onSwitchGym={onSwitchGym}
                  onDrop={onDrop}
                  onDropVenue={onDropVenue}
                  onDropSection={onDropSection}
                  onPlaceVenue={onPlaceVenue}
                  onCorrectCourts={onCorrectCourts}
                  onOpenWeekend={onOpenWeekend}
                  splitAxesFor={splitAxesFor}
                  onDisarm={() => onArm(null)}
                  diff={compare?.byWeekend.get(w.sessionId)}
                  keptOn={compare?.keptOn}
                />
              ))}

              {/* ADD A WEEKEND (owner ruling 2026-08-04). The month ends with
                  the Saturdays it is not using. This one really writes, so it
                  says so and asks first. */}
              {interactive && (addable.get(win.label)?.length ?? 0) > 0 && (
                <AddWeekendCard
                  monthLabel={win.label}
                  saturdays={addable.get(win.label) ?? []}
                  onAdd={onAddWeekend}
                />
              )}

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
                        onArm={onArm}
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

/* ------------------------- the adding verb -------------------------------- */

/**
 * ADD A WEEKEND (owner ruling 2026-08-04). Every month column ends with the
 * Saturdays it is not using, because "there is no room in November" and "we
 * never put the 21st on the season" look identical on a board that only draws
 * the weekends that exist.
 *
 * Shut by default: a column of unused dates under every month would be louder
 * than the plan. One tap opens the list, one tap shuts it, and the dates
 * themselves are the only things that write anything.
 */
function AddWeekendCard({
  monthLabel,
  saturdays,
  onAdd,
}: {
  monthLabel: string
  saturdays: Array<{ satDateISO: string; label: string }>
  onAdd: (satDateISO: string, label: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      data-testid="add-weekend-card"
      className="border-ink-200 rounded-xl border border-dashed p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        data-testid="add-weekend-toggle"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="text-ink-600 hover:text-ink-900 flex min-h-[32px] w-full cursor-pointer items-center gap-1.5 rounded-md px-1 text-left text-[11.5px] font-bold transition-colors hover:bg-white"
      >
        <span aria-hidden className="text-[13px] leading-none">
          +
        </span>
        Add a weekend
        <span className="text-ink-400 ml-auto font-semibold tabular-nums">
          {saturdays.length} free
        </span>
      </button>
      {open && (
        <div className="mt-1.5" data-testid="add-weekend-list">
          <p className="text-ink-400 text-[10.5px]">
            Saturdays {monthLabel.split(" ")[0]} is not using yet. Adding one creates the weekend
            and puts your home gym on it.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {saturdays.map((sat) => (
              <button
                key={sat.satDateISO}
                type="button"
                data-testid="add-weekend-option"
                data-sat={sat.satDateISO}
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd(sat.satDateISO, sat.label)
                }}
                className="border-ink-300 text-ink-800 hover:border-play-400 hover:bg-play-50 hover:text-play-700 min-h-[32px] cursor-pointer rounded-lg border bg-white px-2 text-[11.5px] font-bold shadow-sm transition-colors"
              >
                {sat.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
