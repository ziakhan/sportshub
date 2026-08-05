"use client"

import { useState } from "react"
import {
  courtCapKey,
  courtsCapacityAt,
  courtsWiredAt,
  gradeLine,
  packedWeekendLoad,
  resolveWeekendGyms,
  weekendDemand,
  weekendLoad,
  weekendStory,
  type PlacementReason,
  type PlannerUnit,
  type PlannerWeekend,
  type RentalBlock,
  type WeekendDiff,
} from "@/lib/scheduler/planner-core"
import { PLAN_COPY } from "@/lib/scheduler/plan-documents"
import type { BuildingRoom } from "@/lib/scheduler/plan-world"
import { venueShortName } from "@/lib/seasons/venue-strip"
import {
  CARD_TONE,
  FRACTION_FOR_TONE,
  fractionTone,
  hueFor,
  type Armed,
  type ArmedBlock,
  type ArmedSection,
  type GhostChip,
} from "./plan-shared"
import {
  BlockStatusMark,
  CourtCorrection,
  Fraction,
  SplitMenu,
  WhyPopover,
  type BlockStatus,
  type SplitAxis,
} from "./plan-ui"
import { courtsWord, plural } from "./board-shared"
import { GhostMark, GradeChip } from "./grade-chip"

/** One weekend: the date, one fraction chip, and its grades UNDER THE GYM THEY
 *  PLAY IN, each gym with its own colour, meter and chip. No sentences: the
 *  red pill and the maxed meter already say "over by 7", and the story is one
 *  tap away on the pill. Also the drop target, and the tap-move destination. */
export function WeekendCard({
  weekend,
  windowLabel,
  units,
  keys,
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
  flash,
  flashUnits,
  ghosts,
  courtCaps,
  strandedKeys,
  poolGyms,
  roomsFor,
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
  splitAxesFor,
  onDisarm,
  diff,
  keptOn,
}: {
  weekend: PlannerWeekend
  windowLabel: string
  units: PlannerUnit[]
  keys: string[]
  /** Where each grade on this weekend plays: unit key → venueId, taken from
   *  the season-long pass so a resident keeps the gym it has been playing.
   *  Sections are shaped from it, never packed again here. */
  playsIn: Record<string, string>
  /** Why each of them is there, from that same pass. */
  whyIn: Record<string, PlacementReason>
  /** The gym each grade played before this weekend. */
  cameFrom: Record<string, string>
  /** What this weekend rents, and what it has no building for. */
  blocks: RentalBlock[]
  statusOf: (sessionId: string, venueId: string) => BlockStatus
  unitByKey: Map<string, PlannerUnit>
  /** venueId → colour family, the step's one mapping. */
  hue: Map<string, number>
  armed: Armed | null
  armedVenue: string | null
  armedBlock: ArmedBlock | null
  /** A whole gym section picked up, waiting for a building or a weekend. */
  armedSection: ArmedSection | null
  placing: boolean
  interactive: boolean
  /** The rail just sent somebody here. */
  flash: boolean
  /** The grades that just landed here, keyed "<sessionId>|<unitKey>" (owner
   *  ruling 2026-08-05, #3a): the chip itself wears the mark, not only its card. */
  flashUnits: string[]
  /** "Grade 8 was here", for the grades that just left this weekend. */
  ghosts: GhostChip[]
  courtCaps: Record<string, number>
  /** Grades on THIS weekend whose building this plan no longer has (owner ruling
   *  2026-08-05, #4). Their games are already in the dashed block below; this is
   *  what makes the card say WHY. */
  strandedKeys: Set<string>
  /** The pool gyms this weekend actually holds, for the stranded block's own
   *  prompt. */
  poolGyms: Array<{ venueId: string; short: string }>
  /** WHERE A GRADE COULD GO on this weekend, given what each building is already
   *  holding (owner ruling 2026-08-05, #2). The card knows the usage; the board
   *  knows the plan's whole world, so it answers. */
  roomsFor: (used: Record<string, number>) => BuildingRoom[]
  onArm: (a: Armed | null) => void
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
  splitAxesFor: (sessionId: string, unitKeys: string[]) => SplitAxis[]
  onDisarm: () => void
  /** Set only in compare mode: this weekend against the kept calendar. */
  diff?: WeekendDiff
  /** "<sessionId>|<unitKey>" → the days the kept calendar plays it on. */
  keptOn?: Map<string, string>
}) {
  const load = weekendLoad(units, weekend, keys)
  // Grouping only: the buildings are already decided by the season-long pass,
  // and handing them in as the decided gyms is what shapes them into sections
  // (with each gym's games against its courts) without repacking anything.
  const gyms = resolveWeekendGyms(units, weekend, keys, playsIn, whyIn)
  // A weekend whose buildings cannot hold a grade whole is short of courts
  // even when the totals say otherwise, and it reads red either way.
  /**
   * WHAT THE WEEKEND ACTUALLY HAS (owner ruling 2026-08-05). The chip on the
   * header counts the home gym plus the courts this calendar RENTS, never the
   * full wiring of a pool building nobody has phoned, so the number here, the
   * blocks below it and the ask sheet are one story. `load` is still the
   * attached capacity, and it stays exactly where it belongs: deciding whether
   * a weekend can be dropped on at all.
   */
  const packed = packedWeekendLoad(units, weekend, keys, blocks)
  const tone = gyms.overflow > 0 ? "over" : packed.tone
  const droppable = interactive && load.capacity > 0
  const canTakeArmed =
    Boolean(armed) &&
    droppable &&
    armed?.window === windowLabel &&
    armed?.fromSessionId !== weekend.sessionId

  // The whole story of the weekend, in numbers, composed in the pure core and
  // only rendered here (owner 2026-08-02: which gym filled, which grade
  // spilled where, how many games, and why anybody stayed put).
  const story = weekendStory(units, weekend, gyms, cameFrom)

  /** Games already sitting in each building this weekend, off the sections
   *  this card is about to draw. */
  const gamesAt = new Map(gyms.sections.map((s) => [s.venueId, s.games]))

  /**
   * WHERE A GRADE COULD ACTUALLY GO (owner rulings 2026-08-05, #2 and #1).
   *
   * The switch is offered where the building on the other end could HOLD this
   * grade — the home gym with room left, a pool building we could rent more of,
   * or a backup gym the operator is willing to assert. It used to test the courts
   * this calendar already rents, which are demand-sized, so every destination read
   * full after the first move and the arrow quietly disappeared.
   *
   * Where nothing has room it is still not drawn at all: a disabled arrow with no
   * reason on it is a mistake path with a mystery attached.
   */
  const rooms = roomsFor(Object.fromEntries(gamesAt))
  /** The next building along with room in it, wrapping round from where this
   *  grade sits now. A gym the plan HAS is always offered before a backup: the
   *  backup costs a phone call and a booking, so it is the answer only when
   *  nothing the league already holds can take the grade. */
  const nextWithRoom = (list: BuildingRoom[], venueId: string | null, games: number) => {
    if (list.length === 0) return null
    const at = list.findIndex((r) => r.venueId === venueId)
    for (let i = 1; i <= list.length; i++) {
      const room = list[(at + i + list.length) % list.length]
      if (!room || room.venueId === venueId) continue
      if (room.freeGames >= games) return room
    }
    return null
  }
  const switchTarget = (venueId: string | null, games: number): BuildingRoom | null =>
    nextWithRoom(
      rooms.filter((r) => !r.backup),
      venueId,
      games
    ) ?? nextWithRoom(rooms.filter((r) => r.backup), venueId, games)

  /**
   * WHAT THIS WEEKEND RENTS, and what it has nowhere to put (owner ruling
   * 2026-08-03). The block with no building is the EMPTY SLOT somebody has to
   * go and rent, and the grades it names are drawn inside it rather than in the
   * gym the packing parked them in for want of anywhere else to draw them.
   */
  const emptyBlock = blocks.find((b) => b.venueId === null && (b.games > 0 || b.courts > 0)) ?? null
  const slotKeys = new Set(emptyBlock?.unitKeys ?? [])
  const rentedBlock = new Map(
    blocks.filter((b) => b.venueId !== null).map((b) => [b.venueId as string, b])
  )
  /** A gym is picked up and this weekend can be told to take it. */
  const canTakeVenue = placing && Boolean(armedVenue)
  /** A stranded block is looking for a lighter weekend, and this is one it
   *  could land on: the same month, and not the one it is already on. */
  const canTakeBlock =
    Boolean(armedBlock) &&
    interactive &&
    load.capacity > 0 &&
    armedBlock?.window === windowLabel &&
    armedBlock?.sessionId !== weekend.sessionId
  /** A whole section is picked up and this weekend is one it could land on:
   *  the same month, and not the weekend it is already on (owner ruling
   *  2026-08-05, #4). Whether it FITS is answered when it lands, in one place,
   *  with the refusal naming what would. */
  const canTakeSection =
    Boolean(armedSection) &&
    interactive &&
    load.capacity > 0 &&
    armedSection?.window === windowLabel &&
    armedSection?.sessionId !== weekend.sessionId
  /** The grades that just left this weekend, by the gym they left. */
  const ghostsAt = (venueId: string | null) =>
    ghosts.filter((g) => (venueId === null ? g.venueId === null : g.venueId === venueId))
  /** Ghosts whose gym is gone from the card, so they still have somewhere to sit. */
  const orphanGhosts = ghosts.filter(
    (g) => g.venueId !== null && !gyms.sections.some((s) => s.venueId === g.venueId)
  )

  /** One grade, wherever it sits: in a gym section, or with no gym at all. */
  const chipFor = (key: string, venueId: string | null) => {
    const unit = unitByKey.get(key)
    if (!unit) return null
    const agreed = diff?.agreed.includes(key)
    const changed = diff?.added.includes(key)
    const keptDays = keptOn?.get(`${weekend.sessionId}|${key}`)
    const games = weekendDemand(units, weekend, [key])
    const next = interactive ? switchTarget(venueId, games) : null
    return (
      <GradeChip
        key={key}
        unit={unit}
        games={games}
        tint={venueId ? hueFor(hue, venueId).chip : "border-hoop-200 bg-hoop-50 text-hoop-800"}
        quiet={venueId ? hueFor(hue, venueId).chipQuiet : "text-hoop-600"}
        reason={whyIn[key] ?? null}
        // The sentence the core composed for this grade, now behind the mark
        // rather than printed under the chip.
        why={story.chipCaptions[key]}
        fromSessionId={weekend.sessionId}
        windowLabel={windowLabel}
        weekendLabel={weekend.label}
        armed={armed}
        interactive={interactive}
        // THE CHIP THAT MOVED (owner ruling 2026-08-05, #3a).
        flash={flashUnits.includes(`${weekend.sessionId}|${key}`)}
        onArm={onArm}
        onRemove={() => onRemove(key, weekend.sessionId)}
        switchTo={
          next
            ? { venueId: next.venueId, short: venueShortName(next.name), backup: next.backup }
            : undefined
        }
        onSwitchGym={next ? () => onSwitchGym(weekend.sessionId, key, next.venueId) : undefined}
        diffTone={agreed ? "agreed" : changed ? "changed" : undefined}
        // Comparing is a live question about this grade, and the answer is a
        // date the card has nowhere else to put, so the lens keeps its caption.
        caption={changed ? (keptDays ? `kept: ${keptDays}` : "not in the kept plan") : undefined}
      />
    )
  }

  /** The whole weekend as one number. It wears the story when there is one. */
  const headerChip = (
    <Fraction
      is={packed.demand}
      of={packed.capacity}
      tone={FRACTION_FOR_TONE[tone]}
      title={`${weekend.label}: ${packed.demand} games of ${packed.capacity} we hold`}
      testId="weekend-fraction"
    />
  )

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        if (armedSection && canTakeSection)
          onMoveSection(
            armedSection.unitKeys,
            armedSection.sessionId,
            weekend.sessionId,
            null
          )
        else if (armedBlock && canTakeBlock)
          onMoveBlock(armedBlock.unitKeys, armedBlock.sessionId, weekend.sessionId)
        else if (armed && canTakeArmed)
          onMove(armed.unitKey, armed.fromSessionId, weekend.sessionId)
        else onDisarm()
      }}
      onDragOver={(e) => {
        if (droppable) e.preventDefault()
      }}
      onDrop={(e) => droppable && onDrop(e, weekend.sessionId, windowLabel)}
      data-session-id={weekend.sessionId}
      data-flash={flash ? "1" : undefined}
      className={`mb-2.5 rounded-xl border px-2.5 py-2 shadow-sm ${CARD_TONE[tone]} ${
        canTakeArmed || canTakeBlock || canTakeSection ? "ring-play-400 ring-2" : ""
      } ${
        flash
          ? "outline-play-500 outline outline-2 outline-offset-2 motion-safe:transition-all"
          : ""
      }`}
    >
      {/* The date, and the one number that describes the whole weekend. The
          story behind that number is a tap away, and nowhere else.

          THE DATE IS THE DOOR (owner ruling 2026-08-04): it opens the weekend
          at its own altitude, in the same planning objects, without leaving the
          working copy behind. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <button
          type="button"
          data-testid="weekend-open"
          onClick={(e) => {
            e.stopPropagation()
            onOpenWeekend(weekend.sessionId)
          }}
          aria-label={`Open ${weekend.label}`}
          title={`Open ${weekend.label}`}
          className={`hover:text-play-700 -ml-1 inline-flex min-h-[28px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-1 text-[13px] font-bold underline decoration-dotted underline-offset-[3px] transition-colors hover:bg-white/70 ${
            tone === "unavailable" ? "text-ink-400" : "text-ink-900"
          }`}
        >
          {weekend.label}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="text-ink-400 h-3 w-3"
          >
            <path d="M6.4 3.4 11 8l-4.6 4.6" />
          </svg>
        </button>
        {(load.capacity > 0 || load.demand > 0) &&
          (story.caption ? (
            <WhyPopover
              text={story.caption}
              label={`What happens on ${weekend.label}`}
              testId="weekend-why"
            >
              {headerChip}
            </WhyPopover>
          ) : (
            headerChip
          ))}
      </div>

      {/* THE BUILDING WENT (owner ruling 2026-08-05, #4). Named on the card the
          games were on, so the dashed block below is never a mystery. */}
      {strandedKeys.size > 0 && (
        <p
          data-testid="weekend-gym-gone"
          data-count={strandedKeys.size}
          className="border-hoop-300 bg-hoop-100 text-hoop-900 mt-1 rounded-md border px-1.5 py-1 text-[10.5px] font-bold"
        >
          {PLAN_COPY.gymGone}:{" "}
          {gradeLine([...strandedKeys].map((k) => unitByKey.get(k)?.label ?? k))}
        </p>
      )}

      {/* Grades sit under the gym they play in: one building per grade, and
          a family drives to one address (owner 2026-08-02). The gym owns a
          colour, and its NAME is always in the header with it. */}
      <div className="my-1.5 space-y-2">
        {gyms.sections.map((section) => {
          const paint = hueFor(hue, section.venueId)
          const block = rentedBlock.get(section.venueId)
          // The home gym is nobody's to book, so only a rented section has a
          // standing at all.
          const status =
            section.role === "pool" ? statusOf(weekend.sessionId, section.venueId) : null
          /**
           * WHAT THIS SECTION IS MEASURED AGAINST (owner ruling 2026-08-05).
           * The home gym is measured against itself. A RENTED gym is measured
           * against the courts we rent there, never the whole building: the
           * rest of it belongs to somebody else until we ask, and counting it
           * made the sections add up to more than the weekend does.
           */
          const rentedCourts = block?.courts ?? section.rentedCourts
          const chips = section.unitKeys.filter((k) => !slotKeys.has(k))
          const games = block?.games ?? section.games
          // Only a RENTED section takes a gym from the tray. The gym you own is
          // not a rental to re-let, and ringing it as a target would say the
          // opposite; a grade leaves the home gym through its own switch.
          const takesGym = canTakeVenue && section.role === "pool"
          // What the gym has wired here, and what somebody said it can actually
          // give this weekend. `capped` is null unless there is a correction.
          const venue = weekend.venues.find((v) => v.venueId === section.venueId)
          const wired = venue ? courtsWiredAt(venue) : 0
          const capped = courtCaps[courtCapKey(weekend.sessionId, section.venueId)] ?? null
          /** Games this section really has room for. */
          const held =
            section.role === "pool" && venue
              ? courtsCapacityAt(venue, rentedCourts)
              : section.capacityGames
          const meter =
            section.over > 0 || held <= 0
              ? 100
              : Math.min(100, Math.round((section.games / held) * 100))
          /** A rental is bought to fit, so a full rented section is the
           *  ordinary case and reads green. Only games past it are a problem. */
          const sectionTone =
            section.role === "pool"
              ? section.games > held
                ? ("over" as const)
                : ("fits" as const)
              : fractionTone(section.games, held)
          /** This section is armed and looking for somewhere: is THIS the place?
           *  Another building on this weekend, or this building on another
           *  weekend of the same month (owner ruling 2026-08-05, #4). */
          const takesSection =
            Boolean(armedSection) &&
            interactive &&
            armedSection?.window === windowLabel &&
            !(
              armedSection?.sessionId === weekend.sessionId &&
              armedSection?.venueId === section.venueId
            )
          const armedHere =
            armedSection?.sessionId === weekend.sessionId &&
            armedSection?.venueId === section.venueId
          /** Everything the grip and the "Move all" button both need to say what
           *  is travelling: one description of this section, written once. */
          const asArmed = (): ArmedSection => ({
            sessionId: weekend.sessionId,
            venueId: section.venueId,
            unitKeys: section.unitKeys,
            window: windowLabel,
            gym: venueShortName(section.name),
            weekendLabel: weekend.label,
          })
          const canMoveAll = interactive && section.unitKeys.length > 0
          return (
            <div
              key={section.venueId}
              data-testid="weekend-gym-section"
              data-venue-id={section.venueId}
              data-role={section.role}
              data-status={status ?? undefined}
              // A rented section is a place to put a gym: dropping one here
              // moves this block into that building. It is also where a whole
              // section lands.
              onClick={
                takesSection && armedSection
                  ? (e) => {
                      e.stopPropagation()
                      onMoveSection(
                        armedSection.unitKeys,
                        armedSection.sessionId,
                        weekend.sessionId,
                        section.venueId
                      )
                    }
                  : takesGym && armedVenue
                    ? (e) => {
                        e.stopPropagation()
                        onPlaceVenue(weekend.sessionId, armedVenue, section.unitKeys, games)
                      }
                    : undefined
              }
              onDragOver={interactive ? (e) => e.preventDefault() : undefined}
              onDrop={
                interactive
                  ? (e) =>
                      onDropSection(
                        e,
                        weekend.sessionId,
                        windowLabel,
                        section.venueId,
                        section.unitKeys,
                        games,
                        // The gym you OWN is not a rental to re-let, so only a
                        // rented section takes a gym out of the tray.
                        section.role === "pool"
                      )
                  : undefined
              }
              className={`border-ink-200 rounded-lg border bg-white/70 px-1.5 py-1 ${
                takesGym || takesSection ? "ring-play-400 ring-2" : ""
              } ${armedHere ? "ring-play-500 ring-2" : ""}`}
            >
              {/* THE SECTION IS ONE THING YOU CAN PICK UP (owner-approved
                  suggestion 2026-08-05, #4): its header is the handle, so every
                  grade under this gym moves as one action. Drag it for a mouse;
                  tap the grip and then tap the destination for a thumb. */}
              <div
                className={`flex items-center gap-1.5 ${
                  interactive && section.unitKeys.length > 0
                    ? "cursor-grab active:cursor-grabbing"
                    : ""
                }`}
                draggable={interactive && section.unitKeys.length > 0}
                data-testid={
                  interactive && section.unitKeys.length > 0 ? "section-handle" : undefined
                }
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "text/plain",
                    JSON.stringify({
                      section: true,
                      sessionId: weekend.sessionId,
                      venueId: section.venueId,
                      unitKeys: section.unitKeys,
                      window: windowLabel,
                    })
                  )
                }}
              >
                {canMoveAll && (
                  <button
                    type="button"
                    data-testid="section-grip"
                    aria-pressed={Boolean(armedHere)}
                    aria-label={`Move every grade at ${venueShortName(section.name)} on ${weekend.label}`}
                    title={`Move all ${section.unitKeys.length} grades at ${venueShortName(section.name)}`}
                    onClick={(e) => {
                      /**
                       * ONE THING IN YOUR HAND AT A TIME. Something else is
                       * already picked up — a gym from the tray, a grade, a block,
                       * another section — so the grip gets out of the way and lets
                       * the section itself take the tap. Without this the grip
                       * would sit exactly where an operator taps to put a gym
                       * down, and it would quietly steal it.
                       */
                      if (armedVenue || armed || armedBlock || (armedSection && !armedHere)) return
                      e.stopPropagation()
                      onArmSection(armedHere ? null : asArmed())
                    }}
                    className="text-ink-400 hover:text-ink-700 -ml-0.5 inline-flex min-h-[22px] cursor-grab items-center px-0.5"
                  >
                    <svg viewBox="0 0 10 16" aria-hidden focusable="false" className="h-3.5 w-2">
                      <circle cx="3" cy="4" r="1.1" fill="currentColor" />
                      <circle cx="7" cy="4" r="1.1" fill="currentColor" />
                      <circle cx="3" cy="8" r="1.1" fill="currentColor" />
                      <circle cx="7" cy="8" r="1.1" fill="currentColor" />
                      <circle cx="3" cy="12" r="1.1" fill="currentColor" />
                      <circle cx="7" cy="12" r="1.1" fill="currentColor" />
                    </svg>
                  </button>
                )}
                <i aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${paint.swatch}`} />
                {/* The gym's NAME is the thing this row is about, so it is read
                    at 13px and truncates only once the meter is at its floor
                    (owner ruling 2026-08-05: gym names were too small). */}
                <span
                  className={`min-w-0 max-w-[150px] truncate text-[13px] font-bold ${paint.name}`}
                >
                  {venueShortName(section.name)}
                </span>
                <span
                  aria-hidden
                  className="bg-ink-100 h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full"
                >
                  <i
                    className={`block h-full rounded-full ${
                      section.over > 0 ? "bg-hoop-600" : paint.bar
                    }`}
                    style={{ width: `${meter}%` }}
                  />
                </span>
                <Fraction
                  is={section.games}
                  of={held}
                  tone={sectionTone}
                  title={`${venueShortName(section.name)}: ${section.games} games of ${held}${
                    section.role === "pool" ? " rented" : ""
                  }`}
                  className="px-1.5"
                  testId="gym-fraction"
                />
              </div>
              {/* WHAT THIS SECTION IS (owner ruling 2026-08-03): the building
                  you own wears a quiet mark, and a building you rent says how
                  many courts of it this weekend takes, with where that booking
                  stands. */}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-3.5">
                {section.role === "home" ? (
                  <span
                    data-testid="home-mark"
                    className="text-ink-400 text-[10px] font-bold uppercase tracking-[0.06em]"
                  >
                    home
                  </span>
                ) : (
                  <>
                    {/* The courts of the BLOCK, not of the section: on a gym
                        somebody has crammed past its courts, the block is what
                        this building can actually give and the empty slot below
                        carries the rest. Two numbers that add up to the ask,
                        instead of two readings of the whole of it. */}
                    <span
                      data-testid="rental-mark"
                      className="text-ink-600 text-[10.5px] font-bold"
                    >
                      rented {rentedCourts} of {courtsWord(wired || rentedCourts)}
                    </span>
                    {/* "Confirmed" is the default and says nothing, so it is
                        never drawn (owner ruling 2026-08-05). Only a booking
                        nobody has made yet is worth a chip. */}
                    {status === "assumed" && <BlockStatusMark status={status} />}
                  </>
                )}
                {/* A gym somebody has already corrected says so, so a smaller
                    meter never reads as a mistake. */}
                {capped != null && (
                  <span
                    data-testid="courts-corrected"
                    className="border-gold-400 bg-gold-50 text-gold-600 rounded-md border px-1.5 text-[10px] font-bold"
                  >
                    {courtsWord(capped)} of {wired} this weekend
                  </span>
                )}
                {/**
                 * MOVE THE WHOLE SECTION, SAID OUT LOUD (owner ruling
                 * 2026-08-05, #3). The grip does this already, and the owner
                 * never found it: six dots are a handle for somebody who
                 * suspects there is one. This is the same verb with its name on
                 * it, in the row where the section's other verbs live, and one
                 * tap arms exactly what the grip arms.
                 *
                 * Unlike the grip it never steps aside for something already in
                 * the operator's hand: a button that says "Move all" and then
                 * quietly puts a gym down instead would be lying. Arming drops
                 * whatever else was held, which is the board's standing rule of
                 * one thing at a time.
                 */}
                {canMoveAll && (
                  <button
                    type="button"
                    data-testid="move-all"
                    aria-pressed={Boolean(armedHere)}
                    aria-label={`Move all ${section.unitKeys.length} grades at ${venueShortName(section.name)} on ${weekend.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onArmSection(armedHere ? null : asArmed())
                    }}
                    className={`inline-flex min-h-[28px] cursor-pointer items-center rounded-md border px-2 text-[10.5px] font-bold shadow-sm transition-colors ${
                      armedHere
                        ? "border-play-500 bg-play-50 text-play-700 ring-play-400 ring-2"
                        : "border-ink-300 text-ink-700 hover:border-ink-400 hover:bg-ink-100 hover:text-ink-900 bg-white"
                    }`}
                  >
                    {armedHere ? "Pick somewhere" : "Move all…"}
                  </button>
                )}
                {/* THE TWO CORRECTING VERBS, quiet until somebody needs them.
                    A rented building is the one you have to ask for, so it is
                    the one that can turn out smaller than the plan thought. */}
                {interactive && section.role === "pool" && wired > 0 && (
                  <CourtCorrection
                    gymName={venueShortName(section.name)}
                    weekendLabel={weekend.label}
                    wired={wired}
                    current={capped ?? wired}
                    onApply={(n) => onCorrectCourts(weekend.sessionId, section.venueId, n)}
                  />
                )}
                {interactive && section.unitKeys.length > 0 && (
                  <SplitMenu
                    what={`the ${venueShortName(section.name)} block`}
                    axes={() => splitAxesFor(weekend.sessionId, section.unitKeys)}
                  />
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-start gap-1">
                {chips.map((k) => chipFor(k, section.venueId))}
                {/* WHAT WAS HERE, AND WHERE IT WENT (owner ruling 2026-08-05,
                    #3b, re-ruled #2: it stands until the next interaction). */}
                {ghostsAt(section.venueId).map((g) => (
                  <GhostMark key={`ghost-${g.unitKey}`} label={g.label} to={g.to} />
                ))}
              </div>
              {/* A section is armed and this building could be where it goes: the
                  offer is written down rather than left as "tap somewhere here"
                  (owner ruling 2026-08-05, #4). */}
              {takesSection && armedSection && (
                <button
                  type="button"
                  data-testid="move-section-into"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveSection(
                      armedSection.unitKeys,
                      armedSection.sessionId,
                      weekend.sessionId,
                      section.venueId
                    )
                  }}
                  aria-label={`Move all ${armedSection.unitKeys.length} grades from ${armedSection.gym} into ${venueShortName(section.name)} on ${weekend.label}`}
                  className="border-play-300 bg-play-50 text-play-700 mt-1 w-full rounded-md border border-dashed px-1.5 py-0.5 text-[10.5px] font-bold"
                >
                  Move {plural(armedSection.unitKeys.length, "grade", "grades")} into{" "}
                  {venueShortName(section.name)}
                </button>
              )}
            </div>
          )
        })}

        {/* NO BUILDING FOR IT (owner ruling 2026-08-03): the slot somebody has
            to go and rent, sized in the units a gym quotes on, with the grades
            that have nowhere to play sitting inside it. */}
        {emptyBlock && (
          <div
            data-testid="rental-slot-empty"
            onClick={
              canTakeVenue && armedVenue
                ? (e) => {
                    e.stopPropagation()
                    onPlaceVenue(
                      weekend.sessionId,
                      armedVenue,
                      emptyBlock.unitKeys,
                      emptyBlock.games
                    )
                  }
                : undefined
            }
            onDragOver={placing ? (e) => e.preventDefault() : undefined}
            onDrop={
              placing
                ? (e) => onDropVenue(e, weekend.sessionId, emptyBlock.unitKeys, emptyBlock.games)
                : undefined
            }
            className={`border-hoop-300 bg-hoop-50/70 rounded-lg border border-dashed px-1.5 py-1 ${
              canTakeVenue ? "ring-play-400 ring-2" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <i
                aria-hidden
                className="border-hoop-400 h-2 w-2 flex-none rounded-full border border-dashed"
              />
              <span className="text-hoop-800 text-[11px] font-bold">
                Needs {courtsWord(emptyBlock.courts)} · {plural(emptyBlock.games, "game", "games")}{" "}
                · ~{Math.round(emptyBlock.hoursNeeded)} hours
              </span>
            </div>
            {emptyBlock.unitKeys.length > 0 && (
              <div className="mt-1 flex flex-wrap items-start gap-1">
                {emptyBlock.unitKeys.map((k) => chipFor(k, null))}
              </div>
            )}
            {/* WHERE SHOULD THESE GAMES GO? (owner ruling 2026-08-04). A drop
                is never refused for want of room: the games that do not fit
                turn up here and the board ASKS, right where the problem is,
                instead of putting a sentence somewhere else. */}
            {interactive && (
              <StrandedPrompt
                weekend={weekend}
                windowLabel={windowLabel}
                block={emptyBlock}
                poolGyms={poolGyms}
                armedBlock={armedBlock}
                onPlaceVenue={onPlaceVenue}
                onArmBlock={onArmBlock}
                splitAxesFor={splitAxesFor}
              />
            )}
          </div>
        )}

        {/* Grades on a weekend with no gym at all: still on the board, still
            movable, and honestly labelled. The empty slot above says it in
            court-days, so anything it already names is not repeated here. */}
        {gyms.unplaced.filter((k) => !slotKeys.has(k)).length > 0 && (
          <div>
            <span className="text-hoop-700 text-[10px] font-bold uppercase tracking-[0.06em]">
              No gym
            </span>
            <div className="mt-1 flex flex-wrap items-start gap-1">
              {gyms.unplaced.filter((k) => !slotKeys.has(k)).map((k) => chipFor(k, null))}
            </div>
          </div>
        )}

        {/* The grades that left a gym this card no longer draws, or left with no
            gym at all: their ghost still belongs on this weekend, because this is
            the weekend they were on (owner ruling 2026-08-05, #3b). */}
        {[...ghostsAt(null), ...orphanGhosts].length > 0 && (
          <div className="flex flex-wrap items-start gap-1">
            {[...ghostsAt(null), ...orphanGhosts].map((g) => (
              <GhostMark key={`ghost-loose-${g.unitKey}`} label={g.label} to={g.to} />
            ))}
          </div>
        )}

        {/* Where the kept calendar plays a grade this weekend and the board
            no longer does: a hole you can see, in its place. */}
        {(diff?.removed.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-start gap-1">
            {(diff?.removed ?? []).map((k) => {
              const unit = unitByKey.get(k)
              if (!unit) return null
              return (
                <span
                  key={`kept-${k}`}
                  className="border-ink-300 text-ink-400 inline-flex items-center rounded-lg border border-dashed px-1.5 py-0.5 text-[11px] font-bold"
                >
                  {unit.label} · kept here
                </span>
              )
            })}
          </div>
        )}
        {keys.length === 0 && (diff?.removed.length ?? 0) === 0 && (
          <span className="text-ink-300 text-[11px]">
            {load.capacity > 0 ? "No grades here" : "Gym not yours"}
          </span>
        )}
      </div>

      {canTakeArmed && armed && (
        <button
          type="button"
          data-testid="move-here"
          onClick={(e) => {
            e.stopPropagation()
            onMove(armed.unitKey, armed.fromSessionId, weekend.sessionId)
          }}
          aria-label={`Move ${armed.label} to ${weekend.label}`}
          className="border-play-300 bg-play-50 text-play-700 mt-1.5 w-full rounded-lg border border-dashed px-2 py-1 text-[11px] font-semibold"
        >
          Move {armed.label} here
        </button>
      )}

      {/* The same offer for a whole section: one tap, every grade in it (owner
          ruling 2026-08-05, #4). */}
      {canTakeSection && armedSection && (
        <button
          type="button"
          data-testid="move-section-here"
          onClick={(e) => {
            e.stopPropagation()
            onMoveSection(armedSection.unitKeys, armedSection.sessionId, weekend.sessionId, null)
          }}
          aria-label={`Move all ${armedSection.unitKeys.length} grades from ${armedSection.gym} to ${weekend.label}`}
          className="border-play-300 bg-play-50 text-play-700 mt-1.5 w-full rounded-lg border border-dashed px-2 py-1 text-[11px] font-semibold"
        >
          Move {plural(armedSection.unitKeys.length, "grade", "grades")} here
        </button>
      )}
    </div>
  )
}

/* ---------------------- the prompt a stranded block asks ------------------ */

/**
 * WHERE SHOULD THESE GAMES GO? (owner ruling 2026-08-04.)
 *
 * A drop is never refused for want of room. Games that do not fit become this:
 * the dashed block, and inside it the question, asked where the problem is
 * rather than in a notice somewhere else. Three honest answers, and only the
 * ones that are really available:
 *
 *  - a pool gym THIS WEEKEND HOLDS. Never one it does not: that would be the
 *    board asserting availability nobody has;
 *  - a different weekend, which arms the whole block and lights up the lighter
 *    weekends of its own month;
 *  - leave it open, which is a real answer. A season with a hole in it that
 *    somebody knows about beats a season that quietly pretends.
 */
function StrandedPrompt({
  weekend,
  windowLabel,
  block,
  poolGyms,
  armedBlock,
  onPlaceVenue,
  onArmBlock,
  splitAxesFor,
}: {
  weekend: PlannerWeekend
  windowLabel: string
  block: RentalBlock
  poolGyms: Array<{ venueId: string; short: string }>
  armedBlock: ArmedBlock | null
  onPlaceVenue: (sessionId: string, venueId: string, unitKeys: string[], games: number) => void
  onArmBlock: (block: ArmedBlock | null) => void
  splitAxesFor: (sessionId: string, unitKeys: string[]) => SplitAxis[]
}) {
  const [dismissed, setDismissed] = useState(false)
  const armedHere = armedBlock?.sessionId === weekend.sessionId
  const label = block.unitKeys.length > 0 ? "these games" : "the overflow"

  if (armedHere) {
    return (
      <p
        className="text-play-700 mt-1 text-[10.5px] font-bold"
        data-testid="stranded-armed"
        aria-live="polite"
      >
        Pick a lighter weekend in {windowLabel.split(" ")[0]}, or press Escape.
      </p>
    )
  }

  if (dismissed) {
    return (
      <p className="text-ink-400 mt-1 text-[10.5px]" data-testid="stranded-open">
        Left open on purpose. {plural(block.games, "game", "games")} still need a building.
      </p>
    )
  }

  return (
    <div className="mt-1.5" data-testid="stranded-prompt" onClick={(e) => e.stopPropagation()}>
      <p className="text-hoop-800 text-[10.5px] font-bold">Where should {label} go?</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {poolGyms.map((gym) => (
          <button
            key={gym.venueId}
            type="button"
            data-testid="stranded-gym"
            data-venue-id={gym.venueId}
            onClick={(e) => {
              e.stopPropagation()
              onPlaceVenue(weekend.sessionId, gym.venueId, block.unitKeys, block.games)
            }}
            className="border-play-400 bg-play-50 text-play-700 hover:bg-play-100 hover:border-play-500 min-h-[32px] cursor-pointer rounded-lg border px-2 text-[11px] font-bold shadow-sm transition-colors"
          >
            {gym.short}
          </button>
        ))}
        {block.unitKeys.length > 0 && (
          <button
            type="button"
            data-testid="stranded-other-weekend"
            onClick={(e) => {
              e.stopPropagation()
              onArmBlock({
                sessionId: weekend.sessionId,
                unitKeys: block.unitKeys,
                window: windowLabel,
                label: weekend.label,
              })
            }}
            className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 min-h-[32px] cursor-pointer rounded-lg border bg-white px-2 text-[11px] font-bold shadow-sm transition-colors"
          >
            A different weekend
          </button>
        )}
        {block.unitKeys.length > 1 && (
          <SplitMenu
            what={label}
            axes={() => splitAxesFor(weekend.sessionId, block.unitKeys)}
            testId="split-menu-block"
          />
        )}
        <button
          type="button"
          data-testid="stranded-leave-open"
          onClick={(e) => {
            e.stopPropagation()
            setDismissed(true)
          }}
          className="border-ink-300 text-ink-700 hover:border-ink-400 hover:bg-ink-50 min-h-[32px] cursor-pointer rounded-lg border bg-white px-2 text-[11px] font-bold transition-colors"
        >
          Leave it open
        </button>
      </div>
      {poolGyms.length === 0 && (
        <p className="text-ink-400 mt-1 text-[10.5px]">
          No gym you rent is on {weekend.label}. Turn one on for it back in step 2, or find a
          building.
        </p>
      )}
    </div>
  )
}
