"use client"

import {
  courtCapKey,
  courtsWiredAt,
  heldBackPhrase,
  packedWeekendLoad,
  resolveWeekendGyms,
  weekendDays,
  weekendDemand,
  weekendLoad,
  weekendStory,
  type PlacementReason,
  type PlannerUnit,
  type PlannerWeekend,
  type RentalBlock,
} from "@/lib/scheduler/planner-core"
import { venueShortName } from "@/lib/seasons/venue-strip"
import { FRACTION_FOR_TONE, fractionTone, hueFor } from "./plan-shared"
import {
  BlockStatusMark,
  CourtCorrection,
  Fraction,
  REASON_GLYPH,
  ReasonGlyph,
  SplitMenu,
  type BlockStatus,
  type SplitAxis,
} from "./plan-ui"
import { courtsWord, plural } from "./board-shared"

/* --------------------------- altitude two --------------------------------- */

/**
 * ONE WEEKEND, IN PLANNING CURRENCY (owner ruling 2026-08-04).
 *
 * The SAME objects the board draws, drawn bigger: gym sections with their
 * meters and fractions, grade chips with their game counts, what the weekend
 * rents, the hours behind it, the courts held back, and the weekend's own
 * story in the words the pure core composed.
 *
 * What is deliberately NOT here: team names, fixtures, and a court grid. Those
 * are the scheduling phase, which happens after registration closes and after
 * this plan is published. A planning screen that showed a fixture would be
 * inventing one, and an operator who saw it would believe it.
 *
 * Client state, not a route: the working copy IS the page. Going back restores
 * the board exactly as it was, because it was never taken down.
 */
export function WeekendZoom({
  weekend,
  units,
  keys,
  playsIn,
  whyIn,
  cameFrom,
  blocks,
  statusOf,
  unitByKey,
  hue,
  courtOverrides,
  interactive,
  onBack,
  onCorrectCourts,
  splitAxesFor,
}: {
  weekend: PlannerWeekend
  units: PlannerUnit[]
  keys: string[]
  playsIn: Record<string, string>
  whyIn: Record<string, PlacementReason>
  cameFrom: Record<string, string>
  blocks: RentalBlock[]
  statusOf: (sessionId: string, venueId: string) => BlockStatus
  unitByKey: Map<string, PlannerUnit>
  hue: Map<string, number>
  courtOverrides: Record<string, number>
  interactive: boolean
  onBack: () => void
  onCorrectCourts: (sessionId: string, venueId: string, courts: number) => void
  splitAxesFor: (sessionId: string, unitKeys: string[]) => SplitAxis[]
}) {
  const load = weekendLoad(units, weekend, keys)
  // The same packed truth the board card shows: home plus what we rent.
  const packed = packedWeekendLoad(units, weekend, keys, blocks)
  const gyms = resolveWeekendGyms(units, weekend, keys, playsIn, whyIn)
  const tone = gyms.overflow > 0 ? "over" : packed.tone
  const story = weekendStory(units, weekend, gyms, cameFrom)
  const held = heldBackPhrase(weekend.venues)
  const emptyBlock = blocks.find((b) => b.venueId === null && (b.games > 0 || b.courts > 0)) ?? null
  const rentedBlock = new Map(
    blocks.filter((b) => b.venueId !== null).map((b) => [b.venueId as string, b])
  )
  const slotKeys = new Set(emptyBlock?.unitKeys ?? [])

  return (
    <section
      data-testid="weekend-zoom"
      data-session-id={weekend.sessionId}
      className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="border-ink-100 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-b px-4 py-3">
        <button
          type="button"
          data-testid="weekend-zoom-back"
          onClick={onBack}
          className="text-ink-500 hover:text-play-700 inline-flex min-h-[28px] items-center gap-1.5 text-[12.5px] font-semibold"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="h-3.5 w-3.5"
          >
            <path d="M9.6 3.4 5 8l4.6 4.6" />
          </svg>
          Back to the season
        </button>
        <h2 className="text-ink-900 text-[19px] font-bold tracking-[-0.02em]">{weekend.label}</h2>
        <span className="text-ink-500 text-[12.5px]">{weekendDays(weekend.label)}</span>
        <Fraction
          is={packed.demand}
          of={packed.capacity}
          tone={FRACTION_FOR_TONE[tone]}
          title={`${weekend.label}: ${packed.demand} games of ${packed.capacity} we hold`}
          testId="zoom-fraction"
        />
        {held && (
          <span className="border-gold-400 bg-gold-50 text-gold-600 rounded-md border px-1.5 py-[1px] text-[11px] font-bold">
            {held}
          </span>
        )}
      </header>

      {/* The weekend's own story, in full. On the board it is behind the
          fraction because a 260px column has no room for a sentence; here
          there is room, so it is simply written down. */}
      {story.caption && (
        <p
          className="border-ink-100 text-ink-600 border-b px-4 py-2.5 text-[12.5px]"
          data-testid="zoom-story"
        >
          {story.caption}
        </p>
      )}

      <div className="space-y-3 p-4">
        {gyms.sections.map((section) => {
          const paint = hueFor(hue, section.venueId)
          const filled =
            section.capacityGames > 0
              ? Math.min(100, Math.round((section.games / section.capacityGames) * 100))
              : 100
          const block = rentedBlock.get(section.venueId)
          const status =
            section.role === "pool" ? statusOf(weekend.sessionId, section.venueId) : null
          const venue = weekend.venues.find((v) => v.venueId === section.venueId)
          const wired = venue ? courtsWiredAt(venue) : 0
          const capped = courtOverrides[courtCapKey(weekend.sessionId, section.venueId)] ?? null
          const hours = block ? Math.round(block.hoursNeeded) : null
          return (
            <div
              key={section.venueId}
              data-testid="zoom-gym-section"
              data-venue-id={section.venueId}
              data-role={section.role}
              className={`rounded-xl border border-l-[3px] p-3 ${paint.fill} ${paint.stripe} border-ink-100`}
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <i aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${paint.swatch}`} />
                <span className={`text-[14px] font-bold ${paint.name}`}>{section.name}</span>
                {section.role === "home" ? (
                  <span
                    data-testid="zoom-home-mark"
                    className="text-ink-400 text-[10.5px] font-bold uppercase tracking-[0.06em]"
                  >
                    home gym, no rent
                  </span>
                ) : (
                  <>
                    <span className="text-ink-600 text-[11.5px] font-bold tabular-nums">
                      rented {courtsWord(block?.courts ?? section.rentedCourts)}
                    </span>
                    {status === "assumed" && <BlockStatusMark status={status} />}
                  </>
                )}
                <Fraction
                  is={section.games}
                  of={section.capacityGames}
                  tone={fractionTone(section.games, section.capacityGames)}
                  title={`${venueShortName(section.name)}: ${section.games} games of ${
                    section.capacityGames
                  }`}
                  className="ml-auto"
                />
              </div>

              <span aria-hidden className="bg-ink-100 mt-2 block h-2 overflow-hidden rounded-full">
                <i
                  className={`block h-full rounded-full ${
                    section.over > 0 ? "bg-hoop-600" : paint.bar
                  }`}
                  style={{ width: `${filled}%` }}
                />
              </span>

              {/* The numbers a gym is actually quoted on, spelled out because
                  there is room to spell them out. */}
              <div className="text-ink-500 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] tabular-nums">
                <span>
                  {courtsWord(capped ?? wired)} on the floor
                  {capped != null && <b className="text-gold-600 font-bold"> of {wired} we hold</b>}
                </span>
                {venue?.days != null && <span>{plural(venue.days, "day", "days")}</span>}
                {hours != null && hours > 0 && <span>about {hours} court-hours</span>}
                {section.over > 0 && (
                  <span className="text-hoop-800 font-bold">
                    {plural(section.over, "game", "games")} past its courts
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {section.unitKeys
                  .filter((k) => !slotKeys.has(k))
                  .map((k) => {
                    const unit = unitByKey.get(k)
                    if (!unit) return null
                    const glyph = whyIn[k] ? REASON_GLYPH[whyIn[k]] : undefined
                    return (
                      <span
                        key={k}
                        data-testid="zoom-grade-chip"
                        className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-bold ${paint.chip}`}
                      >
                        {unit.label}
                        <span className={`text-[11.5px] tabular-nums ${paint.chipQuiet}`}>
                          {plural(weekendDemand(units, weekend, [k]), "game", "games")}
                        </span>
                        {glyph && <ReasonGlyph glyph={glyph} className={paint.chipQuiet} />}
                      </span>
                    )
                  })}
              </div>

              {interactive && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {section.role === "pool" && wired > 0 && (
                    <CourtCorrection
                      gymName={venueShortName(section.name)}
                      weekendLabel={weekend.label}
                      wired={wired}
                      current={capped ?? wired}
                      onApply={(n) => onCorrectCourts(weekend.sessionId, section.venueId, n)}
                      testId="zoom-court-correction"
                    />
                  )}
                  {section.unitKeys.length > 0 && (
                    <SplitMenu
                      what={`the ${venueShortName(section.name)} block`}
                      axes={() => splitAxesFor(weekend.sessionId, section.unitKeys)}
                      testId="zoom-split-menu"
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}

        {emptyBlock && (
          <div
            data-testid="zoom-rental-slot"
            className="border-hoop-300 bg-hoop-50/70 rounded-xl border border-dashed p-3"
          >
            <p className="text-hoop-800 text-[13px] font-bold">This block has no building</p>
            <p className="text-ink-600 mt-1 text-[12px] tabular-nums">
              Needs {courtsWord(emptyBlock.courts)} · {plural(emptyBlock.games, "game", "games")} ·
              about {Math.round(emptyBlock.hoursNeeded)} court-hours ·{" "}
              {plural(emptyBlock.courtDays, "court-day", "court-days")}
            </p>
            {emptyBlock.unitKeys.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emptyBlock.unitKeys.map((k) => {
                  const unit = unitByKey.get(k)
                  if (!unit) return null
                  return (
                    <span
                      key={k}
                      data-testid="zoom-grade-chip"
                      className="border-hoop-200 bg-hoop-50 text-hoop-800 inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-bold"
                    >
                      {unit.label}
                      <span className="text-hoop-600 text-[11.5px] tabular-nums">
                        {plural(weekendDemand(units, weekend, [k]), "game", "games")}
                      </span>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {gyms.sections.length === 0 && !emptyBlock && (
          <p className="text-ink-500 text-[12.5px]">
            Nothing is planned on this weekend yet. Go back to the season and drag a grade onto it.
          </p>
        )}

        <p className="text-ink-400 text-[11px]" data-testid="zoom-phase-note">
          Who plays who, and at what time, is worked out in step 5 once registration closes. This is
          the plan: which grades, which buildings, how many courts.
        </p>
      </div>
    </section>
  )
}
