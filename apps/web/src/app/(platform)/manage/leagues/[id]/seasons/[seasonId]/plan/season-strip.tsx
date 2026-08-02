"use client"

import { useMemo } from "react"
import {
  weekendDemand,
  weekendLoad,
  weekendShortDays,
  type PlannerState,
  type PlannerUnit,
  type PlannerWeekend,
} from "@/lib/scheduler/planner-core"
import {
  resolveUnitVenue,
  resolveWeekendVenues,
  seasonVenueOrder,
  venueHueSlots,
  venueLine,
  type StripVenue,
} from "@/lib/seasons/venue-strip"
import type { VenueGrid } from "@/lib/seasons/venue-grid"
import { METER_TONE, type Armed } from "./plan-shared"

/**
 * The season strip (owner 2026-08-02: "show me some sort of great view from
 * the left side to the right side of where they are playing... we can then
 * maybe toggle between the proposed plan and this plan. Right now we're
 * making assumptions that both gyms are available").
 *
 * One row per grade, one column per weekend, October on the left and February
 * on the right. Three things the board cannot show at once:
 *
 *   1. A grade's whole season reads across in one line.
 *   2. The gym row says which gyms you actually have that weekend, so nothing
 *      is assumed.
 *   3. The kept calendar and the working proposal are one tap apart, in the
 *      same shape, so they can be read against each other.
 *
 * It never invents a fact: we plan grades onto weekends, not onto buildings,
 * so a weekend running two gyms says "both gyms available" rather than
 * claiming a grade plays in one of them.
 */

/** Copy with real apostrophes lives here, as JS, so nothing needs escaping. */
const COPY = {
  kept: "The calendar you kept. Switch to Proposal to change anything.",
  proposal: "Tap a grade, then tap another weekend that month to move it.",
  readOnly: "Where every grade plays, left to right.",
  gyms:
    "Turn a gym on or off for a weekend back in step 2. Each grade plays one gym per weekend, and keeps that gym all season whenever the courts allow. A cell that only counts games is one nobody has picked a gym for yet.",
}

/**
 * A gym's colour, from the families the design system already uses. Pale fill,
 * saturated stripe, ink text — and the gym's NAME travels with it everywhere,
 * because colour never carries the fact on its own.
 */
const VENUE_HUES = [
  { fill: "bg-court-50", stripe: "border-l-court-500", swatch: "bg-court-500" },
  { fill: "bg-play-50", stripe: "border-l-play-500", swatch: "bg-play-500" },
  { fill: "bg-gold-50", stripe: "border-l-gold-500", swatch: "bg-gold-500" },
  { fill: "bg-hoop-50", stripe: "border-l-hoop-500", swatch: "bg-hoop-500" },
]

/** The first column stays put while the season scrolls under it. */
const STICKY = "border-ink-100 sticky left-0 border-r bg-white text-left"

export type StripSide = "kept" | "proposal"

/** The one segmented control this screen uses, for both toggles. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  testId?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className="border-ink-200 inline-flex rounded-lg border p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
            onClick={(e) => {
              e.stopPropagation()
              onChange(o.value)
            }}
            className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${
              on ? "bg-court-600 text-white" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function StripView({
  state,
  shown,
  shownVenues,
  hasKept,
  side,
  onSide,
  venueGrid,
  interactive,
  armed,
  onArm,
  onMove,
}: {
  state: PlannerState
  /** The calendar on screen: the working proposal, or the one you kept. */
  shown: Record<string, string[]>
  /** Which gym each grade plays, weekend by weekend, for the calendar on
   *  screen: sessionId → (unit key → venueId). Empty until anything is
   *  decided, and then the cell names the building instead of the weekend. */
  shownVenues: Record<string, Record<string, string>>
  hasKept: boolean
  side: StripSide
  onSide: (side: StripSide) => void
  /** Step 2's own answer about gyms. Null until it loads, or if it fails. */
  venueGrid: VenueGrid | null
  interactive: boolean
  armed: Armed | null
  onArm: (armed: Armed | null) => void
  onMove: (unitKey: string, from: string | null, to: string) => void
}) {
  const weekends = useMemo(
    () => state.windows.flatMap((win) => win.weekends.map((w) => ({ weekend: w, window: win.label }))),
    [state]
  )
  const gymOrder = useMemo(
    () => seasonVenueOrder(venueGrid, weekends.map((c) => c.weekend)),
    [venueGrid, weekends]
  )
  const gymsOn = useMemo(
    () => resolveWeekendVenues(venueGrid, weekends.map((c) => c.weekend)),
    [venueGrid, weekends]
  )
  const hue = useMemo(
    () => venueHueSlots(gymOrder.map((v) => v.venueId), VENUE_HUES.length),
    [gymOrder]
  )

  const note = !interactive ? (side === "kept" ? COPY.kept : COPY.readOnly) : COPY.proposal

  return (
    <div className="border-ink-100 overflow-hidden rounded-2xl border" data-testid="season-strip">
      <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
        <p className="text-ink-500 text-[11.5px]">{note}</p>
        {hasKept && (
          <Segmented
            label="Which calendar"
            value={side}
            testId="strip-side"
            options={[
              { value: "kept", label: "Kept plan" },
              { value: "proposal", label: "Proposal" },
            ]}
            onChange={onSide}
          />
        )}
      </div>

      {/* The strip scrolls sideways in here, and only in here. */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">
            Every grade of the season by weekend, with the gyms available each weekend
          </caption>
          <thead>
            <tr>
              {/* A phone gives the season more room than it gives the label. */}
              <th
                className={`${STICKY} z-20 w-[104px] min-w-[104px] sm:w-[132px] sm:min-w-[132px]`}
                aria-hidden
              />
              {state.windows.map((win, i) => (
                <th
                  key={win.label}
                  scope="colgroup"
                  colSpan={win.weekends.length}
                  className={`text-ink-400 px-2 pb-1 pt-2 text-left text-[10px] font-bold uppercase tracking-[0.08em] ${
                    i > 0 ? "border-ink-100 border-l" : ""
                  }`}
                >
                  {win.label.split(" ")[0]}
                </th>
              ))}
            </tr>
            <tr>
              <th
                scope="col"
                className={`${STICKY} text-ink-400 border-ink-100 z-20 border-b px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em]`}
              >
                Grade
              </th>
              {weekends.map(({ weekend }) => {
                const load = weekendLoad(state.units, weekend, shown[weekend.sessionId] ?? [])
                const caption =
                  load.tone === "over"
                    ? `${load.demand - load.capacity} short`
                    : load.tone === "tight"
                      ? "full house"
                      : null
                return (
                  <th
                    key={weekend.sessionId}
                    scope="col"
                    data-testid="strip-weekend"
                    className={`border-ink-100 min-w-[98px] border-b px-1.5 pb-1.5 text-left align-bottom ${
                      load.capacity <= 0 ? "bg-ink-50/70" : ""
                    }`}
                  >
                    <span className="text-ink-900 block text-[11.5px] font-bold">
                      {weekendShortDays(weekend.label)}
                    </span>
                    <span
                      className={`block text-[10.5px] font-semibold ${METER_TONE[load.tone]}`}
                      data-testid="strip-capacity"
                    >
                      {load.demand} / {load.capacity}
                    </span>
                    {caption && (
                      <span
                        className={`block text-[9.5px] font-semibold ${
                          load.tone === "over" ? "text-hoop-700" : "text-gold-700"
                        }`}
                      >
                        {caption}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {/* The row the owner asked for: which gyms you actually have. */}
            <tr data-testid="strip-gyms">
              <th
                scope="row"
                className={`${STICKY} border-ink-100 z-10 border-b px-2 py-1.5 align-middle`}
              >
                <span className="text-ink-700 block text-[11.5px] font-bold">Gyms</span>
              </th>
              {weekends.map(({ weekend }) => {
                const gyms = gymsOn.get(weekend.sessionId) ?? []
                return (
                  <td
                    key={weekend.sessionId}
                    className={`border-ink-100 border-b px-1.5 py-1.5 align-middle ${
                      gyms.length === 0 ? "bg-ink-50/70" : ""
                    }`}
                  >
                    {gyms.length === 0 ? (
                      <span className="border-ink-300 text-ink-400 block rounded border border-dashed px-1 py-0.5 text-center text-[10px] font-semibold">
                        no gym
                      </span>
                    ) : (
                      // One gym per line: a column this narrow wraps whatever
                      // you do, and a wrapped list reads worse than a stack.
                      gyms.map((gym) => (
                        <span key={gym.venueId} className="flex items-center gap-1">
                          <i
                            aria-hidden
                            className={`h-2 w-2 flex-none rounded-full ${
                              VENUE_HUES[hue.get(gym.venueId) ?? 0].swatch
                            }`}
                          />
                          <span className="text-ink-700 truncate text-[10.5px] font-semibold">
                            {gym.short}
                          </span>
                          {gyms.length === 1 && gymOrder.length > 1 && (
                            <span className="text-ink-400 text-[10px]">only</span>
                          )}
                        </span>
                      ))
                    )}
                  </td>
                )
              })}
            </tr>

            {state.units.map((unit) => (
              <tr key={unit.key} data-testid="strip-row">
                <th scope="row" className={`${STICKY} z-10 px-2 py-1.5 align-middle`}>
                  <span className="text-ink-900 block text-[12px] font-bold">{unit.label}</span>
                  <span className="text-ink-400 block text-[10.5px] font-semibold">
                    {unit.teams > 0 ? `${unit.teams} teams` : "no teams yet"}
                  </span>
                </th>
                {weekends.map(({ weekend, window }) => (
                  <StripCell
                    key={weekend.sessionId}
                    unit={unit}
                    units={state.units}
                    weekend={weekend}
                    window={window}
                    assigned={(shown[weekend.sessionId] ?? []).includes(unit.key)}
                    gyms={gymsOn.get(weekend.sessionId) ?? []}
                    playsAt={shownVenues[weekend.sessionId]?.[unit.key] ?? null}
                    seasonGyms={gymOrder.length}
                    hue={hue}
                    interactive={interactive}
                    armed={armed}
                    onArm={onArm}
                    onMove={onMove}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Which colour is which gym, in words. */}
      <div className="border-ink-100 flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2">
        {gymOrder.map((gym) => (
          <span key={gym.venueId} className="text-ink-500 inline-flex items-center gap-1.5 text-[11px]">
            <i
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full ${VENUE_HUES[hue.get(gym.venueId) ?? 0].swatch}`}
            />
            <b className="text-ink-700">{gym.short}</b>
            <span className="text-ink-400">{gym.name}</span>
          </span>
        ))}
      </div>
      <p className="text-ink-400 border-ink-100 border-t px-3 py-2 text-[11px]">
        {COPY.gyms}
      </p>
    </div>
  )
}

/** One grade on one weekend: a pill when it plays, a landing spot when a
 *  grade from this row is looking for somewhere to go, otherwise nothing. */
function StripCell({
  unit,
  units,
  weekend,
  window,
  assigned,
  gyms,
  playsAt,
  seasonGyms,
  hue,
  interactive,
  armed,
  onArm,
  onMove,
}: {
  unit: PlannerUnit
  units: PlannerUnit[]
  weekend: PlannerWeekend
  window: string
  assigned: boolean
  gyms: StripVenue[]
  /** The building the plan puts this grade in, when it says. */
  playsAt: string | null
  seasonGyms: number
  hue: Map<string, number>
  interactive: boolean
  armed: Armed | null
  onArm: (armed: Armed | null) => void
  onMove: (unitKey: string, from: string | null, to: string) => void
}) {
  const noGym = weekend.capacityGames <= 0 || gyms.length === 0
  const cell = `border-ink-100 border-b px-1.5 py-1 align-middle ${noGym ? "bg-ink-50/70" : ""}`

  if (assigned) {
    const games = weekendDemand(units, weekend, [unit.key])
    // The gym the plan actually put this grade in leads. Only when nothing is
    // decided does the cell fall back to describing the weekend's gyms.
    const single = resolveUnitVenue(gyms, playsAt) ?? (gyms.length === 1 ? gyms[0] : null)
    const tone = single
      ? VENUE_HUES[hue.get(single.venueId) ?? 0]
      : gyms.length === 0
        ? { fill: "bg-hoop-50", stripe: "border-l-hoop-500" }
        : { fill: "bg-ink-50", stripe: "border-l-ink-400" }
    // Names the gym only when the weekend HAS one gym. Two gyms means the
    // grade's building is not decided yet, and the strip does not pretend.
    const lead = single ? single.short : `${games} games`
    const note = single
      ? `${games} games`
      : gyms.length === 0
        ? "no gym booked"
        : gyms.length === 2
          ? "both gyms"
          : `${gyms.length} gyms`
    const isArmed = armed?.unitKey === unit.key && armed?.fromSessionId === weekend.sessionId
    const body = (
      <>
        <span className="text-ink-900 block truncate text-[11.5px] font-bold">{lead}</span>
        <span
          className={`block truncate text-[10px] font-semibold ${
            gyms.length === 0 ? "text-hoop-700" : "text-ink-500"
          }`}
        >
          {note}
        </span>
      </>
    )
    const cls = `border-ink-100 block w-full min-h-[44px] rounded-lg border border-l-[3px] px-1.5 py-1 text-left ${tone.fill} ${tone.stripe} ${
      isArmed ? "ring-play-500 ring-2" : ""
    }`
    const where = single
      ? `at ${single.short}`
      : gyms.length === 0
        ? "with no gym booked"
        : `across ${venueLine(gyms, seasonGyms)}`

    return (
      <td className={cell}>
        {interactive ? (
          <button
            type="button"
            aria-pressed={isArmed}
            aria-label={`${unit.label} plays ${weekend.label} ${where}, ${games} games`}
            data-testid="strip-pill"
            onClick={(e) => {
              e.stopPropagation()
              onArm(
                isArmed
                  ? null
                  : {
                      unitKey: unit.key,
                      label: unit.label,
                      fromSessionId: weekend.sessionId,
                      window,
                    }
              )
            }}
            className={cls}
          >
            {body}
          </button>
        ) : (
          <span className={cls} data-testid="strip-pill">
            {body}
          </span>
        )}
      </td>
    )
  }

  // A grade only ever moves inside its own month, and only onto a weekend
  // that has a gym.
  const canTake =
    interactive &&
    !noGym &&
    armed?.unitKey === unit.key &&
    armed.window === window &&
    armed.fromSessionId !== weekend.sessionId

  return (
    <td className={cell}>
      {canTake ? (
        <button
          type="button"
          aria-label={`Move ${unit.label} to ${weekend.label}`}
          onClick={(e) => {
            e.stopPropagation()
            onMove(unit.key, armed.fromSessionId, weekend.sessionId)
          }}
          className="border-play-300 bg-play-50 text-play-700 block min-h-[44px] w-full rounded-lg border border-dashed px-1 text-[10.5px] font-semibold"
        >
          Move here
        </button>
      ) : (
        <span className="block min-h-[44px]" />
      )}
    </td>
  )
}
