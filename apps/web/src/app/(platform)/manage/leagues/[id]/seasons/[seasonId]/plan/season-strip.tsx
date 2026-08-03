"use client"

import { useMemo } from "react"
import {
  reasonPhrase,
  weekendDemand,
  weekendLoad,
  weekendShortDays,
  type PlacementReason,
  type PlannerState,
  type PlannerUnit,
  type PlannerWeekend,
} from "@/lib/scheduler/planner-core"
import {
  resolveUnitVenue,
  resolveWeekendVenues,
  type StripVenue,
} from "@/lib/seasons/venue-strip"
import type { VenueGrid } from "@/lib/seasons/venue-grid"
import { METER_TONE, VENUE_HUES, planVenueHues, type Armed } from "./plan-shared"
import { REASON_GLYPH, ReasonGlyph } from "./plan-ui"

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
 * Every cell names ONE gym, because one gym per grade-weekend is the model
 * (owner 2026-08-02) and the board already draws it that way: the decided
 * building where somebody picked one, and otherwise the building the calendar
 * packs the grade into. Both views read ONE packShownVenues pass, computed by
 * the step that owns the calendar, so the strip's December and the board's
 * December can never name different buildings — and neither can differ from
 * what Keep writes down. A weekend with no gym on it at all still says exactly
 * that, and names nothing.
 */

/** Copy with real apostrophes lives here, as JS, so nothing needs escaping. */
const COPY = {
  kept: "The calendar you kept. Switch to Proposal to change anything.",
  proposal: "Tap a grade, then tap another weekend that month to move it.",
  readOnly: "Where every grade plays, left to right.",
  gyms:
    "Turn a gym on or off for a weekend back in step 2. Each grade plays one gym per weekend, and keeps that gym all season whenever the courts allow. A cell that only counts games is a weekend with no gym booked.",
}

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
  playsIn,
  whyIn,
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
  /** Which building every grade plays in, for the whole calendar on screen:
   *  sessionId → (unit key → venueId). One chronological packShownVenues pass,
   *  owned by the step, so the strip says exactly what the board says. */
  playsIn: Record<string, Record<string, string>>
  /** Why each grade is in that building, from the same pass: a cell says it
   *  in its label whenever the answer is not simply "the gyms filled up". */
  whyIn: Record<string, Record<string, PlacementReason>>
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
  const gymsOn = useMemo(
    () => resolveWeekendVenues(venueGrid, weekends.map((c) => c.weekend)),
    [venueGrid, weekends]
  )
  // The step's ONE gym colouring, from the same two inputs the board hands it,
  // so a building is the same colour in both views.
  const { order: gymOrder, hue } = useMemo(
    () => planVenueHues(venueGrid, weekends.map((c) => c.weekend)),
    [venueGrid, weekends]
  )

  /**
   * The ONE gym each grade plays in, weekend by weekend, as a gym the strip can
   * paint: sessionId → (unit key → gym). The buildings themselves are the
   * step's single chronological pass, so a cell here and a chip on the board
   * always name the same one; this only turns venue ids into named, coloured
   * gyms.
   *
   * Step 2 still outranks the plan on availability: a weekend the operator has
   * released both gyms for names none, whatever capacity the planner last
   * cached for it.
   */
  const playsAt = useMemo(() => {
    const byId = new Map(gymOrder.map((v) => [v.venueId, v]))
    const out = new Map<string, Map<string, StripVenue>>()
    for (const { weekend } of weekends) {
      const keys = shown[weekend.sessionId] ?? []
      const open = gymsOn.get(weekend.sessionId) ?? []
      if (keys.length === 0 || open.length === 0) continue
      const here = new Map<string, StripVenue>()
      for (const [unitKey, venueId] of Object.entries(playsIn[weekend.sessionId] ?? {})) {
        const gym = resolveUnitVenue(open, venueId) ?? byId.get(venueId)
        if (gym) here.set(unitKey, gym)
      }
      out.set(weekend.sessionId, here)
    }
    return out
  }, [gymOrder, gymsOn, playsIn, shown, weekends])

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
                    playsAt={playsAt.get(weekend.sessionId)?.get(unit.key) ?? null}
                    why={whyIn[weekend.sessionId]?.[unit.key] ?? null}
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
  why,
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
  /** The one building this grade plays in that weekend, decided or packed.
   *  Null only when the weekend has no gym at all. */
  playsAt: StripVenue | null
  /** Why it is that building. Said out loud whenever it is not simply the
   *  gyms filling in order. */
  why: PlacementReason | null
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
    // One gym per grade-weekend, always: the cell either names the building
    // the plan puts this grade in — the same one the board draws it under —
    // or says the weekend has no gym at all. There is no third answer, and a
    // packed gym reads exactly like a picked one, because on the board it is
    // exactly as real.
    const tone = playsAt
      ? VENUE_HUES[hue.get(playsAt.venueId) ?? 0]
      : { fill: "bg-hoop-50", stripe: "border-l-hoop-500" }
    const lead = playsAt ? playsAt.short : `${games} games`
    const note = playsAt ? `${games} games` : "no gym booked"
    const isArmed = armed?.unitKey === unit.key && armed?.fromSessionId === weekend.sessionId
    // The reason, drawn: the same four marks the board uses. The words stay in
    // the cell's own label, so the mark is never the only place it is said.
    const glyph = playsAt && why ? REASON_GLYPH[why] : undefined
    const body = (
      <>
        <span className="text-ink-900 flex items-center gap-1 text-[11.5px] font-bold">
          <span className="truncate">{lead}</span>
          {glyph && <ReasonGlyph glyph={glyph} className="text-ink-400" />}
        </span>
        <span
          className={`block truncate text-[10px] font-semibold ${
            playsAt ? "text-ink-500" : "text-hoop-700"
          }`}
        >
          {note}
        </span>
      </>
    )
    const cls = `border-ink-100 block w-full min-h-[44px] rounded-lg border border-l-[3px] px-1.5 py-1 text-left ${tone.fill} ${tone.stripe} ${
      isArmed ? "ring-play-500 ring-2" : ""
    }`
    const where = playsAt ? `at ${playsAt.short}` : "with no gym booked"
    // The gym is on the cell; the REASON is what the cell has no room for, so
    // it rides in the label and the tooltip. Fill order is the ordinary case
    // and says nothing (owner 2026-08-02).
    const because = playsAt ? reasonPhrase(why ?? "fill") : null
    const label = `${unit.label} plays ${weekend.label} ${where}, ${games} games${
      because ? `, ${because}` : ""
    }`

    return (
      <td className={cell}>
        {interactive ? (
          <button
            type="button"
            aria-pressed={isArmed}
            aria-label={label}
            title={because ? `${playsAt?.name}: ${because}` : playsAt?.name}
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
          <span className={cls} data-testid="strip-pill" aria-label={label} title={label}>
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
