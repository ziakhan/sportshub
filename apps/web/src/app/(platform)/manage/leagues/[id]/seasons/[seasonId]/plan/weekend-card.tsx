"use client"

import { useState } from "react"
import {
  courtCapKey,
  courtsCapacityAt,
  courtsNeeded,
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
} from "@/lib/scheduler/planner-core"
import { PLAN_COPY } from "@/lib/scheduler/plan-documents"
import type { BuildingRoom } from "@/lib/scheduler/plan-world"
import { venueShortName } from "@/lib/seasons/venue-strip"
import {
  BTN_SECONDARY,
  BTN_SM,
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
  Fraction,
  GymMenu,
  MoveMenu,
  type MoveTarget,
  SplitMenu,
  WhyPopover,
  type BlockStatus,
  type SplitAxis,
} from "./plan-ui"
import {
  FILTER_DIM,
  FILTER_MATCH,
  NOT_TARGET,
  TARGET_OFFER,
  TARGET_RING,
  courtsWord,
  plural,
  armAfterDragStarts,
  type CardPreview,
} from "./board-shared"
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
  interactive,
  dragging,
  highlight,
  gymHighlight,
  flash,
  flashUnits,
  ghosts,
  courtOverrides,
  fridayWhen = "6-10 PM",
  hoursFor,
  placedGyms,
  strandedKeys,
  poolGyms,
  roomsFor,
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
  splitAxesFor,
  onDisarm,
  preview = null,
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
  interactive: boolean
  /** A mouse is mid-drag (owner ruling 2026-08-05, #1). The colours light up
   *  exactly the same, but the dashed OFFERS stay shut: a button appearing under
   *  a moving cursor moves the drop point out from under it. */
  dragging: boolean
  /** The grades the operator is picking out, or null while the filter is off
   *  (owner ruling 2026-08-05, #4). Purely visual: nothing about the plan moves. */
  highlight: Set<string> | null
  /** The gyms the operator is picking out, or null while that lens is off (owner
   *  ruling 2026-08-06, #4). It combines with the grade lens as an INTERSECTION:
   *  "Grade 8 at Six Park" is one question. */
  gymHighlight: Set<string> | null
  /** The rail just sent somebody here. */
  flash: boolean
  /** The grades that just landed here, keyed "<sessionId>|<unitKey>" (owner
   *  ruling 2026-08-05, #3a): the chip itself wears the mark, not only its card. */
  flashUnits: string[]
  /** "Grade 8 was here", for the grades that just left this weekend. */
  ghosts: GhostChip[]
  courtOverrides: Record<string, number>
  /** The hours one gym runs on THIS weekend, and whether they are this date's own
   *  rather than the gym's usual range (owner ruling 2026-08-06, #5). What the ⋯
   *  menu opens on. */
  /** The league's Friday window in words, from the state. */
  fridayWhen?: string
  hoursFor: (venueId: string) => { startTime: string; endTime: string; custom: boolean }
  /** Gyms the operator put on this weekend that have no games in them yet (owner
   *  ruling 2026-08-06, #2). Each one is drawn as an empty container: a real
   *  building on a real date, costing nothing, ready to be filled. */
  placedGyms: Set<string>
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
    /** A single grade could change into this building (owner ruling
     *  2026-08-05, #1 and #2): the card has already done the room arithmetic. */
    canTakeChip: boolean
  ) => void
  onPlaceVenue: (sessionId: string, venueId: string, unitKeys: string[], games: number) => void
  onCorrectCourts: (sessionId: string, venueId: string, courts: number) => void
  /** Take the Friday evening back off this gym on this weekend. */
  onDropFriday?: (sessionId: string, venueId: string) => void
  /** This gym, this date, these hours. Null puts it back on its usual range. */
  onSetHours: (
    sessionId: string,
    venueId: string,
    window: { startTime: string; endTime: string } | null
  ) => void
  onOpenWeekend: (sessionId: string) => void
  splitAxesFor: (sessionId: string, unitKeys: string[]) => SplitAxis[]
  onDisarm: () => void
  /** This card is one end of a previewed suggestion (owner T-019 ruling):
   *  what would arrive or leave, and its numbers before and after. Null in
   *  the ordinary case, which draws nothing extra. */
  preview?: CardPreview | null
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

  // The whole story of the weekend, in numbers, composed in the pure core and
  // only rendered here (owner 2026-08-02: which gym filled, which grade
  // spilled where, how many games, and why anybody stayed put).
  const story = weekendStory(units, weekend, gyms, cameFrom)

  /** Games already sitting in each building this weekend, off the sections
   *  this card is about to draw. */
  const gamesAt = new Map(gyms.sections.map((s) => [s.venueId, s.games]))

  /**
   * WHAT EVERY BUILDING ON THIS WEEKEND COULD HOLD (owner rulings 2026-08-05, #1
   * and #2). The home gym with room left, a pool building we could rent more of,
   * and the backup gyms the operator could assert — priced against what each one
   * is already holding, not against the courts this calendar happens to rent.
   *
   * Every drop affordance on this card is answered from these rows and nothing
   * else, which is the whole of ruling #1: the board offers a destination only
   * where the arithmetic says the load really fits.
   */
  const rooms = roomsFor(Object.fromEntries(gamesAt))
  const roomAt = (venueId: string): BuildingRoom | null =>
    rooms.find((r) => r.venueId === venueId) ?? null
  /**
   * ONE READING OF "ROOM", FOR EVERYTHING (owner ruling 2026-08-06, #3).
   *
   * There used to be two. A single chip was measured against every building
   * behind this weekend, backups included, because taking a backup is the
   * operator asserting they have it. A whole SECTION was measured against only
   * the gyms this plan already had, so the board would light a weekend up for one
   * grade and refuse the section that grade was in, and a date with nothing on it
   * was a target for neither.
   *
   * Both count what the drop MAY assert now, and moveSection asserts it (see
   * board-verbs), so the offer and the refusal can never disagree again.
   */
  const freeAll = rooms.reduce((sum, r) => sum + r.freeGames, 0)
  /**
   * THE OTHER BUILDINGS THIS BLOCK COULD MOVE INTO, ON THIS WEEKEND (owner
   * ruling 2026-08-06, #4). Same rooms arithmetic every drop is measured
   * against, so the menu can never offer a move the board would then refuse:
   * the gym itself is out, and so is anything that could not hold the games.
   *
   * The status is what moving there WOULD be, in the operator's own vocabulary:
   * a booking the plan has (the gym is on this weekend and confirmed), one the
   * solver assumed, or a building the plan has not claimed at all, where
   * choosing it is the claim.
   */
  const moveTargetsFor = (fromVenueId: string, unitKeys: string[], games: number): MoveTarget[] => {
    if (unitKeys.length === 0) return []
    // The grades that are moving do not count against the room they land in.
    const free = roomsFor(
      Object.fromEntries(
        [...gamesAt].map(([venueId, count]) => [
          venueId,
          venueId === fromVenueId ? Math.max(0, count - games) : count,
        ])
      )
    )
    /**
     * EVERY GYM IN THE ROSTER (owner ruling 2026-08-06). The ones this weekend
     * already has say what they are holding; the ones it does not say what
     * taking them would mean. Nothing is hidden for being unbooked — that is
     * availability, and availability is not a gate — and the only row that
     * cannot be tapped is one whose games leave no room.
     */
    return free
      .filter((r) => r.venueId !== fromVenueId)
      .map((r) => {
        const venue = weekend.venues.find((v) => v.venueId === r.venueId)
        const status: MoveTarget["status"] = !venue
          ? "asserts"
          : statusOf(weekend.sessionId, r.venueId) === "assumed"
            ? "assumed"
            : "booked"
        const perCourt = Math.max(1, r.capacityGames / Math.max(1, r.courts))
        return {
          venueId: r.venueId,
          name: venueShortName(r.name),
          courts: venue ? courtsNeeded(venue, games) : Math.max(1, Math.ceil(games / perCourt)),
          status,
          note: venue
            ? `${plural(r.usedGames, "game", "games")} here now, room for ${r.freeGames} more`
            : "New booking, placing asserts availability",
          full: r.freeGames < games,
        }
      })
  }
  /** Games a set of grades would bring to THIS weekend, at its own rate. */
  const bringing = (unitKeys: string[]) => weekendDemand(units, weekend, unitKeys)

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
  /** Games each section is really holding, which is what a gym placed on it
   *  would have to take. */
  const sectionGamesOf = (venueId: string, fallback: number) =>
    rentedBlock.get(venueId)?.games ?? fallback

  /* ------------------ VALID TARGETS ONLY (owner ruling #1) ----------------- */

  /**
   * The three things that can be dropped ON THE WEEKEND AS A WHOLE, each one
   * measured against the room this weekend really has. A weekend with no gym
   * time is not a target, and neither is one whose buildings are full: the board
   * offers the move only where it would take it.
   */
  const armedGames = armed ? bringing([armed.unitKey]) : 0
  const blockGames = armedBlock ? bringing(armedBlock.unitKeys) : 0
  const sectionGames = armedSection ? bringing(armedSection.unitKeys) : 0
  const inMonth = (win: string | undefined) => win === windowLabel
  /**
   * IS THERE ANYWHERE ON THIS WEEKEND TO PUT ANYTHING? The attached capacity used
   * to answer this, which quietly ruled out every date the plan had no gym on —
   * including the empty ones a gym can simply be placed on (owner ruling
   * 2026-08-06, #2). Room is room, whoever has to assert it.
   */
  const anyRoom = freeAll > 0
  const canTakeArmed =
    Boolean(armed) &&
    interactive &&
    anyRoom &&
    inMonth(armed?.window) &&
    armed?.fromSessionId !== weekend.sessionId &&
    freeAll >= armedGames
  /** A stranded block is looking for a lighter weekend, and this is one that can
   *  really hold it: the same month, not the one it is on, and room for all of it. */
  const canTakeBlock =
    Boolean(armedBlock) &&
    interactive &&
    anyRoom &&
    inMonth(armedBlock?.window) &&
    armedBlock?.sessionId !== weekend.sessionId &&
    freeAll >= blockGames
  /** A whole section is picked up and this weekend can take every grade in it
   *  (owner rulings 2026-08-05 #4, 2026-08-06 #3). The same arithmetic a single
   *  chip is offered on, so a group is never refused a weekend the board just
   *  offered one of its grades. */
  const canTakeSection =
    Boolean(armedSection) &&
    interactive &&
    anyRoom &&
    inMonth(armedSection?.window) &&
    armedSection?.sessionId !== weekend.sessionId &&
    freeAll >= sectionGames

  /**
   * And the two things that land on ONE BUILDING of this weekend.
   *
   * A grade in the operator's hand can change building here, which is the move
   * the retired ⇄ used to guess at (ruling #2). It is offered per gym, so the
   * operator names the destination and the board only lights the ones with room.
   */
  /**
   * THE BUILDINGS ON THIS CARD, sections and empty containers alike (owner ruling
   * 2026-08-06, #2). An empty gym is a building on a real date with room in it,
   * so it takes a chip and a section exactly as a filled one does.
   */
  const emptyGymRows = [...placedGyms]
    .filter((venueId) => !gyms.sections.some((s) => s.venueId === venueId))
    .map((venueId) => roomAt(venueId))
    .filter((room): room is BuildingRoom => room !== null)
  const dropTargets: Array<{ venueId: string; games: number }> = [
    ...gyms.sections.map((s) => ({ venueId: s.venueId, games: s.games })),
    ...emptyGymRows.map((r) => ({ venueId: r.venueId, games: 0 })),
  ]

  const chipTargets = new Set<string>()
  if (armed && interactive && inMonth(armed.window) && armed.fromSessionId) {
    for (const s of dropTargets) {
      const sameSpot =
        armed.fromSessionId === weekend.sessionId && playsIn[armed.unitKey] === s.venueId
      if (sameSpot) continue
      if ((roomAt(s.venueId)?.freeGames ?? 0) >= armedGames) chipTargets.add(s.venueId)
    }
  }
  /** The buildings a whole armed section could move INTO. */
  const sectionTargets = new Set<string>()
  if (armedSection && interactive && inMonth(armedSection.window)) {
    for (const s of dropTargets) {
      const sameSpot =
        armedSection.sessionId === weekend.sessionId && armedSection.venueId === s.venueId
      if (sameSpot) continue
      if ((roomAt(s.venueId)?.freeGames ?? 0) >= sectionGames) sectionTargets.add(s.venueId)
    }
  }
  /** A gym is picked up out of the gym list, and this is what it could hold here. */
  const canTakeVenue = interactive && Boolean(armedVenue)
  const armedRoom = armedVenue ? roomAt(armedVenue) : null
  const venueRoom = armedRoom?.freeGames ?? 0
  const takesGymAt = (venueId: string, games: number) =>
    canTakeVenue && Boolean(armedRoom) && venueId !== armedVenue && venueRoom >= games
  const takesGymInSlot = canTakeVenue && Boolean(armedRoom) && venueRoom >= (emptyBlock?.games ?? 0)
  /**
   * DROP A GYM ANYWHERE, INCLUDING ON A DATE WITH NOTHING ON IT (owner ruling
   * 2026-08-06, #2). Where the weekend has games looking for a building, the slot
   * takes the gym and houses them. Where it has none, the whole card takes it and
   * the gym lands as an empty container: a building placed is not a booking.
   */
  const takesGymBare =
    canTakeVenue &&
    Boolean(armedRoom) &&
    !emptyBlock &&
    !placedGyms.has(armedVenue as string) &&
    !gyms.sections.some((s) => s.venueId === armedVenue)

  /**
   * SOMETHING IS IN THE OPERATOR'S HAND, and this weekend either can take it or
   * cannot. A weekend that cannot steps back a little so the ones that can are
   * the only thing the eye lands on; the weekend it CAME FROM never dims, because
   * that is where the operator is looking when they pick something up.
   */
  const holding = Boolean(armed || armedBlock || armedSection || armedVenue)
  const isSource =
    (armed != null && armed.fromSessionId === weekend.sessionId) ||
    armedBlock?.sessionId === weekend.sessionId ||
    armedSection?.sessionId === weekend.sessionId
  const isTarget =
    canTakeArmed ||
    canTakeBlock ||
    canTakeSection ||
    chipTargets.size > 0 ||
    sectionTargets.size > 0 ||
    takesGymInSlot ||
    takesGymBare ||
    gyms.sections.some(
      (s) => s.role === "pool" && takesGymAt(s.venueId, sectionGamesOf(s.venueId, s.games))
    )
  /** A drop is refused at the browser level where the board would refuse it
   *  anyway: no preventDefault, no drop, no argument afterwards. */
  const droppable =
    interactive && (!holding ? anyRoom : canTakeArmed || canTakeSection || takesGymBare)
  /** The whole card steps back: nothing held can land anywhere on it. */
  const cardDim = holding && !isTarget && !isSource

  /**
   * THE TWO LENSES (owner rulings 2026-08-05 #4 and 2026-08-06 #4). A grade lens,
   * a gym lens, and they COMBINE: a chip is lit when the grade is picked out AND
   * it plays in a picked-out building. Either lens on its own reads as "any" for
   * the other. Nothing under either of them moves by one game.
   */
  const anyLens = highlight != null || gymHighlight != null
  const lit = (key: string, venueId: string | null) =>
    (highlight == null || highlight.has(key)) &&
    (gymHighlight == null || (venueId != null && gymHighlight.has(venueId)))
  const highlighted = anyLens && keys.some((k) => lit(k, playsIn[k] ?? null))
  /** A gym the lens is on wears the ring itself, even with nothing in it. */
  const litGym = (venueId: string) => gymHighlight != null && gymHighlight.has(venueId)

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
    const games = weekendDemand(units, weekend, [key])
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
        highlight={!anyLens ? null : lit(key, venueId) ? "on" : "off"}
        onArm={onArm}
        // A drag lights the board up the same way a tap does (ruling #1).
        onDragState={(drag) => {
          onDragging(drag)
          onArm(
            drag
              ? {
                  unitKey: key,
                  label: unit.label,
                  fromSessionId: weekend.sessionId,
                  window: windowLabel,
                }
              : null
          )
        }}
        onRemove={() => onRemove(key, weekend.sessionId)}
      />
    )
  }

  /** The whole weekend as one number. It wears the story when there is one. */
  const headerChip = (
    <Fraction
      is={packed.demand}
      of={packed.capacity}
      label="games"
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
        // A GYM ONTO A BARE DATE (owner ruling 2026-08-06, #2): no games here to
        // house, so the building lands empty and waits to be filled.
        else if (armedVenue && takesGymBare)
          onPlaceVenue(weekend.sessionId, armedVenue, [], 0)
        else onDisarm()
      }}
      onDragOver={(e) => {
        if (droppable) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!droppable) return
        if (armedVenue && takesGymBare) {
          onDropVenue(e, weekend.sessionId, [], 0)
          return
        }
        onDrop(e, weekend.sessionId, windowLabel)
      }}
      data-session-id={weekend.sessionId}
      data-flash={flash ? "1" : undefined}
      // The three facts a drive (and a human) can read straight off the card:
      // is this a place the held thing can go, is it standing back, and does a
      // picked-out grade play here.
      data-target={holding ? (isTarget ? "1" : "0") : undefined}
      data-highlight={!anyLens ? undefined : highlighted ? "1" : "0"}
      className={`mb-2.5 rounded-xl border shadow-sm motion-safe:transition-opacity ${
        // An empty weekend earns a slim row, not a full card (QA T-008.4) —
        // it grows back the moment something is held over the board.
        tone === "empty" && !holding ? "px-2.5 py-0.5 opacity-80" : "px-2.5 py-2"
      } ${
        CARD_TONE[tone]
      } ${canTakeArmed || canTakeBlock || canTakeSection ? TARGET_RING : ""} ${
        cardDim ? NOT_TARGET : ""
      } ${highlighted ? "ring-court-400 ring-1" : ""} ${
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

      {/**
        * ONE END OF A PREVIEWED MOVE (owner T-019 ruling, 2026-08-11). The
        * destination shows the ghost of what would land; the source shows
        * what would leave, and when the move would release this weekend it
        * says so in words. Both ends wear before → after in the same
        * fraction language the header chip speaks. Dashed, because nothing
        * here has happened yet — the confirm in the rail is what does it.
        */}
      {preview && (
        <div
          data-testid="weekend-preview"
          data-role={preview.role}
          className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed px-2 py-1.5 ${
            preview.role === "to" ? "border-court-400 bg-court-50/70" : "border-ink-300 bg-ink-50/70"
          }`}
        >
          <span
            data-testid="preview-landing"
            className={`text-[11px] font-bold ${
              preview.role === "to" ? "text-court-800" : "text-ink-600"
            }`}
          >
            {preview.role === "to"
              ? `+ ${preview.unitLabel} · ${plural(preview.games, "game", "games")} lands here`
              : `− ${preview.unitLabel} · ${plural(preview.games, "game", "games")} leaves${
                  preview.after === null ? ". This weekend comes off the plan" : ""
                }`}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Fraction
              is={preview.before.demand}
              of={preview.before.capacity}
              tone={fractionTone(preview.before.demand, preview.before.capacity)}
              title={`${weekend.label} before this move: ${preview.before.demand} of ${preview.before.capacity}`}
            />
            <span aria-hidden className="text-ink-400 text-[11px] font-bold">
              →
            </span>
            {preview.after ? (
              <Fraction
                is={preview.after.demand}
                of={preview.after.capacity}
                tone={fractionTone(preview.after.demand, preview.after.capacity)}
                title={`${weekend.label} after this move: ${preview.after.demand} of ${preview.after.capacity}`}
                testId="preview-after"
              />
            ) : (
              <b data-testid="preview-after" className="text-court-800 text-[11px]">
                off the plan
              </b>
            )}
          </span>
        </div>
      )}

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
          /** What the games here need, before anybody said they rented more: the
           *  "4" in "4 used of 6 rented" (owner ruling 2026-08-06, #5). */
          const usedCourts = section.rentedCourts
          const chips = section.unitKeys.filter((k) => !slotKeys.has(k))
          const games = block?.games ?? section.games
          // Only a RENTED section takes a gym from the tray. The gym you own is
          // not a rental to re-let, and ringing it as a target would say the
          // opposite. And the gym in hand has to have room for these games,
          // otherwise it is not a target at all (owner ruling 2026-08-05, #1).
          const takesGym = section.role === "pool" && takesGymAt(section.venueId, games)
          // What the gym has wired here, and what somebody said it can actually
          // give this weekend. `capped` is null unless there is a correction.
          const venue = weekend.venues.find((v) => v.venueId === section.venueId)
          const wired = venue ? courtsWiredAt(venue) : 0
          const capped = courtOverrides[courtCapKey(weekend.sessionId, section.venueId)] ?? null
          /** What the ⋯ menu opens on: the courts we hold here, which is what
           *  somebody said we hold, else what this section is really using, and
           *  the whole building where the league owns it. */
          const heldCourts =
            capped ?? (section.role === "pool" ? Math.max(rentedCourts, usedCourts) : wired)
          const hoursHere = hoursFor(section.venueId)
          /** Games this section really has room for. */
          const held =
            section.role === "pool" && venue
              ? courtsCapacityAt(venue, rentedCourts)
              : section.capacityGames
          /* Courts used / total / free for the row (approved design):
             home is measured against the building; a rental against the
             larger of used and rented, inside the building's walls. */
          const courtsTotalHere = Math.max(1, wired || rentedCourts || 1)
          const courtsUsedHere =
            section.role === "pool"
              ? Math.min(courtsTotalHere, Math.max(usedCourts, 0))
              : held > 0
                ? Math.min(courtsTotalHere, Math.ceil((section.games * courtsTotalHere) / Math.max(1, held)))
                : 0
          const courtsFreeHere = Math.max(
            0,
            courtsTotalHere -
              (section.role === "pool" ? Math.max(usedCourts, rentedCourts) : courtsUsedHere)
          )
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
           *  weekend of the same month (owner ruling 2026-08-05, #4) — and only
           *  where the whole group would fit, per ruling #1. */
          const takesSection = sectionTargets.has(section.venueId)
          /** A single grade in the operator's hand could change building into
           *  this one: the move the ⇄ used to guess, now named (ruling #2). */
          const takesChip = chipTargets.has(section.venueId)
          const armedHere =
            armedSection?.sessionId === weekend.sessionId &&
            armedSection?.venueId === section.venueId
          /**
           * Something is held and this building is not where it can go. Only on a
           * card that is itself standing forward: a dimmed card dimming its own
           * sections again would put them out altogether.
           */
          const asideHere =
            holding &&
            !cardDim &&
            !takesSection &&
            !takesChip &&
            !takesGym &&
            !armedHere &&
            !(canTakeArmed || canTakeBlock || canTakeSection)
          /** Nothing the operator picked out is in this building: no picked grade
           *  plays here, or the gym lens is on and this is not one of its gyms. */
          const filteredOut =
            anyLens && !section.unitKeys.some((k) => lit(k, section.venueId))
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
              data-target={holding ? (takesSection || takesChip || takesGym ? "1" : "0") : undefined}
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
                  : // ONE GRADE INTO THIS BUILDING (owner ruling 2026-08-05, #2).
                    // The ⇄ is retired; the operator picks the chip up and taps
                    // the gym they mean, and only the gyms with room take the tap.
                    takesChip && armed?.fromSessionId
                    ? (e) => {
                        e.stopPropagation()
                        onMoveSection(
                          [armed.unitKey],
                          armed.fromSessionId as string,
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
              // A drop is allowed where the board would take it, and nowhere
              // else: no preventDefault means the browser refuses it outright.
              onDragOver={
                interactive && (takesSection || takesChip || takesGym)
                  ? (e) => e.preventDefault()
                  : undefined
              }
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
                        section.role === "pool" && takesGym,
                        takesChip
                      )
                  : undefined
              }
              /* THE GYM IS A BOX IN ITS OWN COLOUR (owner 2026-08-10) — and
                 an assumed rental wears a dashed edge, words beside it. */
              className={`${paint.box ?? "border-ink-200"} ${
                status === "assumed" ? "border-dashed" : ""
              } rounded-lg border bg-white/70 px-1.5 py-1 motion-safe:transition-opacity ${
                takesGym || takesSection || takesChip ? TARGET_RING : ""
              } ${armedHere ? "ring-play-500 ring-2" : ""} ${asideHere ? NOT_TARGET : ""} ${
                filteredOut ? FILTER_DIM : litGym(section.venueId) ? FILTER_MATCH : ""
              }`}
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
                  // The drag arms the section too, so the destinations light up
                  // under the cursor (owner ruling 2026-08-05, #1) — a frame
                  // later, or the arming cancels the drag it came from.
                  armAfterDragStarts(() => {
                    onDragging(true)
                    onArmSection(asArmed())
                  })
                }}
                onDragEnd={() => {
                  onDragging(false)
                  onArmSection(null)
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
                  className={`min-w-[36px] flex-1 truncate text-[12.5px] font-bold ${paint.name}`}
                  title={section.name}
                >
                  {venueShortName(section.name)}
                </span>
                {canMoveAll && (
                  <MoveMenu
                    gymName={venueShortName(section.name)}
                    weekendLabel={weekend.label}
                    armed={Boolean(armedHere)}
                    targets={() => moveTargetsFor(section.venueId, section.unitKeys, games)}
                    onMoveTo={(venueId) =>
                      onMoveSection(section.unitKeys, weekend.sessionId, weekend.sessionId, venueId)
                    }
                    onArmForWeekend={() => onArmSection(armedHere ? null : asArmed())}
                    tint={paint.action}
                  />
                )}
                {interactive && wired > 0 && (
                  <GymMenu
                    gymName={venueShortName(section.name)}
                    weekendLabel={weekend.label}
                    wired={wired}
                    courts={heldCourts}
                    usedCourts={usedCourts}
                    hours={hoursHere}
                    hoursOverridden={hoursHere.custom}
                    fridayCourts={venue?.fridayCourts}
                    fridayWhen={fridayWhen}
                    onDropFriday={
                      (venue?.fridayCourts ?? 0) > 0 && onDropFriday
                        ? () => onDropFriday(weekend.sessionId, section.venueId)
                        : undefined
                    }
                    onCourts={(n) => onCorrectCourts(weekend.sessionId, section.venueId, n)}
                    onHours={(startTime, endTime) =>
                      onSetHours(weekend.sessionId, section.venueId, { startTime, endTime })
                    }
                    onResetHours={() => onSetHours(weekend.sessionId, section.venueId, null)}
                    splitWhat={
                      section.unitKeys.length > 0
                        ? `the ${venueShortName(section.name)} block`
                        : undefined
                    }
                    splitAxes={
                      section.unitKeys.length > 0
                        ? () => splitAxesFor(weekend.sessionId, section.unitKeys)
                        : undefined
                    }
                    tint={paint.action}
                  />
                )}
              </div>
              {/* THE DATA LINE (owner 2026-08-11: the header was too crowded —
                  "put the courts information on the second line"). Line one is
                  the gym's NAME and its two buttons, nothing else; this second
                  line counts courts (approved two-number law, 2026-08-10) and
                  carries the exceptional marks — an assumed booking, a
                  paying-for-more rental, a correction, custom hours. */}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-3.5">
                <span
                  data-testid="gym-fraction"
                  title={`${venueShortName(section.name)}: ${section.games} games of ${held}${
                    section.role === "pool" ? " rented" : ""
                  } · ${courtsUsedHere} of ${courtsTotalHere} courts${
                    courtsFreeHere > 0 ? `, ${courtsFreeHere} free` : ""
                  }`}
                  className={`text-[11px] font-bold tabular-nums ${
                    section.over > 0 ? "text-hoop-800" : "text-ink-600"
                  }`}
                >
                  {courtsUsedHere}/{courtsTotalHere} courts
                  {courtsFreeHere > 0 && (
                    <span className="text-court-700 font-bold"> · {courtsFreeHere} free</span>
                  )}
                </span>
                {status === "assumed" && <BlockStatusMark status={status} />}
                {section.role === "pool" && rentedCourts > usedCourts && (
                  <span data-testid="rental-mark" className="text-ink-600 text-[10px] font-bold">
                    rented {rentedCourts}
                  </span>
                )}
                {capped != null && capped < wired && (
                  <span
                    data-testid="courts-corrected"
                    className="border-gold-400 bg-gold-50 text-gold-600 rounded-md border px-1.5 text-[10px] font-bold"
                  >
                    {courtsWord(capped)} of {wired} this weekend
                  </span>
                )}
                {hoursHere.custom && (
                  <span
                    data-testid="hours-custom"
                    className="border-gold-400 bg-gold-50 text-gold-600 rounded-md border px-1.5 text-[10px] font-bold tabular-nums"
                  >
                    {hoursHere.startTime} to {hoursHere.endTime}
                  </span>
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
                  (owner ruling 2026-08-05, #4). It is drawn only for the tap
                  path: a button appearing under a moving cursor would shift the
                  drop out from under the drag (ruling #1). */}
              {takesSection && armedSection && !dragging && (
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
                  className={`mt-1 w-full rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold ${TARGET_OFFER}`}
                >
                  Move {plural(armedSection.unitKeys.length, "grade", "grades")} into{" "}
                  {venueShortName(section.name)}
                </button>
              )}
              {/* The same offer for ONE grade, which is what replaced the ⇄
                  (owner ruling 2026-08-05, #2): the operator says which gym. */}
              {takesChip && armed?.fromSessionId && !dragging && (
                <button
                  type="button"
                  data-testid="move-chip-into"
                  data-venue-id={section.venueId}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveSection(
                      [armed.unitKey],
                      armed.fromSessionId as string,
                      weekend.sessionId,
                      section.venueId
                    )
                  }}
                  aria-label={`Move ${armed.label} into ${venueShortName(section.name)} on ${weekend.label}`}
                  className={`mt-1 w-full rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold ${TARGET_OFFER}`}
                >
                  Move {armed.label} into {venueShortName(section.name)}
                </button>
              )}
            </div>
          )
        })}

        {/* A BUILDING WITH NOTHING IN IT YET (owner ruling 2026-08-06, #2). The
            operator put this gym on this date, so it is here: a real container on
            a real weekend, costing nothing until a grade lands in it, and a drop
            target like any other section. */}
        {emptyGymRows.map((room) => {
          const paint = hueFor(hue, room.venueId)
          const takesSection = sectionTargets.has(room.venueId)
          const takesChip = chipTargets.has(room.venueId)
          const hoursHere = hoursFor(room.venueId)
          const wired = room.courts
          return (
            <div
              key={`empty-${room.venueId}`}
              data-testid="empty-gym"
              data-venue-id={room.venueId}
              data-role={room.role}
              data-target={holding ? (takesSection || takesChip ? "1" : "0") : undefined}
              onClick={
                takesSection && armedSection
                  ? (e) => {
                      e.stopPropagation()
                      onMoveSection(
                        armedSection.unitKeys,
                        armedSection.sessionId,
                        weekend.sessionId,
                        room.venueId
                      )
                    }
                  : takesChip && armed?.fromSessionId
                    ? (e) => {
                        e.stopPropagation()
                        onMoveSection(
                          [armed.unitKey],
                          armed.fromSessionId as string,
                          weekend.sessionId,
                          room.venueId
                        )
                      }
                    : undefined
              }
              onDragOver={
                interactive && (takesSection || takesChip) ? (e) => e.preventDefault() : undefined
              }
              onDrop={
                interactive
                  ? (e) =>
                      onDropSection(
                        e,
                        weekend.sessionId,
                        windowLabel,
                        room.venueId,
                        [],
                        0,
                        false,
                        takesChip
                      )
                  : undefined
              }
              className={`border-ink-300 rounded-lg border border-dashed bg-white/60 px-1.5 py-1 motion-safe:transition-opacity ${
                takesSection || takesChip ? TARGET_RING : ""
              } ${litGym(room.venueId) ? FILTER_MATCH : anyLens ? FILTER_DIM : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <i aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${paint.swatch}`} />
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] font-bold ${paint.name}`}
                  title={room.name}
                >
                  {venueShortName(room.name)}
                </span>
                {interactive && wired > 0 && (
                  <GymMenu
                    gymName={venueShortName(room.name)}
                    weekendLabel={weekend.label}
                    wired={wired}
                    courts={
                      courtOverrides[courtCapKey(weekend.sessionId, room.venueId)] ?? room.courts
                    }
                    usedCourts={0}
                    hours={hoursHere}
                    fridayWhen={fridayWhen}
                    hoursOverridden={hoursHere.custom}
                    onCourts={(n) => onCorrectCourts(weekend.sessionId, room.venueId, n)}
                    onHours={(startTime, endTime) =>
                      onSetHours(weekend.sessionId, room.venueId, { startTime, endTime })
                    }
                    onResetHours={() => onSetHours(weekend.sessionId, room.venueId, null)}
                  />
                )}
              </div>
              {/* Same two-line shape as a full section (owner 2026-08-11):
                  the name owns line one, the state lives on line two. */}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-3.5">
                <span className="text-ink-500 text-[10.5px] font-bold">empty</span>
                <span className="text-ink-400 text-[10.5px] font-semibold">drop grades here</span>
                {hoursHere.custom && (
                  <span
                    data-testid="hours-custom"
                    className="border-gold-400 bg-gold-50 text-gold-600 rounded-md border px-1.5 text-[10px] font-bold tabular-nums"
                  >
                    {hoursHere.startTime} to {hoursHere.endTime}
                  </span>
                )}
              </div>
              {takesSection && armedSection && !dragging && (
                <button
                  type="button"
                  data-testid="move-section-into"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveSection(
                      armedSection.unitKeys,
                      armedSection.sessionId,
                      weekend.sessionId,
                      room.venueId
                    )
                  }}
                  aria-label={`Move all ${armedSection.unitKeys.length} grades from ${armedSection.gym} into ${venueShortName(room.name)} on ${weekend.label}`}
                  className={`mt-1 w-full rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold ${TARGET_OFFER}`}
                >
                  Move {plural(armedSection.unitKeys.length, "grade", "grades")} into{" "}
                  {venueShortName(room.name)}
                </button>
              )}
              {takesChip && armed?.fromSessionId && !dragging && (
                <button
                  type="button"
                  data-testid="move-chip-into"
                  data-venue-id={room.venueId}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveSection(
                      [armed.unitKey],
                      armed.fromSessionId as string,
                      weekend.sessionId,
                      room.venueId
                    )
                  }}
                  aria-label={`Move ${armed.label} into ${venueShortName(room.name)} on ${weekend.label}`}
                  className={`mt-1 w-full rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold ${TARGET_OFFER}`}
                >
                  Move {armed.label} into {venueShortName(room.name)}
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
            data-target={holding ? (takesGymInSlot ? "1" : "0") : undefined}
            onClick={
              takesGymInSlot && armedVenue
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
            // Only a gym that could really hold these games takes the drop
            // (owner ruling 2026-08-05, #1).
            onDragOver={interactive && takesGymInSlot ? (e) => e.preventDefault() : undefined}
            onDrop={
              interactive && takesGymInSlot
                ? (e) => onDropVenue(e, weekend.sessionId, emptyBlock.unitKeys, emptyBlock.games)
                : undefined
            }
            className={`border-hoop-300 bg-hoop-50/70 rounded-lg border border-dashed px-1.5 py-1 ${
              takesGymInSlot ? TARGET_RING : ""
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

        {keys.length === 0 && emptyGymRows.length === 0 && (
          <span className="text-ink-300 text-[11px]">
            {load.capacity > 0 ? "No grades here" : "No gym on this date yet"}
          </span>
        )}
      </div>

      {/* A GYM CAN LAND ON A DATE WITH NOTHING ON IT (owner ruling 2026-08-06,
          #2), so the offer is written down there too, for the tap path. */}
      {takesGymBare && armedVenue && !dragging && (
        <button
          type="button"
          data-testid="place-gym-here"
          data-venue-id={armedVenue}
          onClick={(e) => {
            e.stopPropagation()
            onPlaceVenue(weekend.sessionId, armedVenue, [], 0)
          }}
          aria-label={`Put ${armedRoom?.name ?? "this gym"} on ${weekend.label}`}
          className={`mt-1.5 w-full rounded-lg border px-2 py-1 text-[11px] font-semibold ${TARGET_OFFER}`}
        >
          Put {venueShortName(armedRoom?.name ?? "this gym")} here
        </button>
      )}

      {canTakeArmed && armed && !dragging && (
        <button
          type="button"
          data-testid="move-here"
          onClick={(e) => {
            e.stopPropagation()
            onMove(armed.unitKey, armed.fromSessionId, weekend.sessionId)
          }}
          aria-label={`Move ${armed.label} to ${weekend.label}`}
          className={`mt-1.5 w-full rounded-lg border px-2 py-1 text-[11px] font-semibold ${TARGET_OFFER}`}
        >
          Move {armed.label} here
        </button>
      )}

      {/* The same offer for a whole section: one tap, every grade in it (owner
          ruling 2026-08-05, #4). Cross-weekend, which is the move the section
          grip exists for. */}
      {canTakeSection && armedSection && !dragging && (
        <button
          type="button"
          data-testid="move-section-here"
          onClick={(e) => {
            e.stopPropagation()
            onMoveSection(armedSection.unitKeys, armedSection.sessionId, weekend.sessionId, null)
          }}
          aria-label={`Move all ${armedSection.unitKeys.length} grades from ${armedSection.gym} to ${weekend.label}`}
          className={`mt-1.5 w-full rounded-lg border px-2 py-1 text-[11px] font-semibold ${TARGET_OFFER}`}
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
            className={`${BTN_SECONDARY} ${BTN_SM}`}
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
          className={`${BTN_SECONDARY} ${BTN_SM}`}
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
