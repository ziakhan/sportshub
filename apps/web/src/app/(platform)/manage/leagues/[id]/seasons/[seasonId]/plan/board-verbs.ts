"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  assignBlocksFromPool,
  assignmentWithMove,
  courtCapKey,
  courtsNeeded,
  courtsWiredAt,
  packPlanVenues,
  planCost,
  planPrice,
  proposePlan,
  splitAcrossGyms,
  splitAcrossWeekends,
  splitPriceSentence,
  venuesWithoutUnit,
  weekendDemand,
  type PlannerLever,
  type PlannerState,
} from "@/lib/scheduler/planner-core"
import type { WindowPhase } from "@/lib/scheduler/plan-documents"
import type { FridayFit } from "@/lib/scheduler/plan-world"
import {
  bookingStatusFor,
  drawnGyms,
  solvableState,
  weekendRooms,
  withWeekend,
  withWeekendInState,
  worldWeekends,
  type GhostDate,
} from "@/lib/scheduler/plan-world"
import type { BlockStatus, SplitAxis } from "./plan-ui"
import type { ArmedSection, GhostChip } from "./plan-shared"
import {
  COPY,
  LEVERS,
  UNDO_DEPTH,
  blockKey,
  courtsWord,
  nameList,
  plural,
  type DragPayload,
  type GhostIntent,
  type PendingDrop,
} from "./board-shared"
import type { BoardModel } from "./board-state"

/**
 * EVERY VERB ON THE BOARD, IN ONE PLACE.
 *
 * A grade moved, a whole section moved, a block sent to another weekend, a gym
 * placed by hand, "I don't have this" on a gym's courts, a calendar drawn from
 * the solver, a block split, a weekend added, the hours shifted — and the one
 * step back that undoes any of them.
 *
 * Two rules hold for all of them and are the reason they live together:
 *  - every route that changes where something plays lands on the WORKING COPY,
 *    is one entry on the undo stack, says what it did, and rings both ends of
 *    the move (see flashMove). A drag, a tap and a rail click read the same;
 *  - nothing here writes to the server except the two that really are season
 *    structure (adding a weekend, and applying gym hours), and both say so.
 */
export function useBoardVerbs(m: BoardModel) {
  const {
    seasonId,
    board,
    locked,
    setState,
    setLiveState,
    planSettings,
    setPlanSettings,
    setVenueGrid,
    pendingDrop,
    setPendingDrop,
    assignment,
    setAssignment,
    venues,
    setVenues,
    blockStatus,
    setBlockStatus,
    courtOverrides,
    setCourtOverrides,
    hourOverrides,
    setHourOverrides,
    assertedGyms,
    setAssertedGyms,
    fences,
    setFences,
    fridays,
    setFridays,
    emptyGyms,
    setEmptyGyms,
    undoStack,
    setUndoStack,
    dirty,
    setDirty,
    setFromLever,
    setArmed,
    setArmedVenue,
    setArmedBlock,
    setArmedSection,
    setZoomSession,
    flashSessions,
    setFlashSessions,
    setFlashUnits,
    setGhosts,
    boardScroll,
    setBusy,
    setError,
    setNotice,
    blocks,
    gymShort,
    weekendById,
    unitByKey,
    shown,
  } = m

  /**
   * THE SEASON-WIDE HOURS CHIPS ARE GONE (owner ruling 2026-08-06, #6). They
   * previewed and then wrote an hour onto every gym on every weekend at once,
   * which is a thing nobody negotiates and a thing an operator could not undo.
   * Hours are agreed one building and one date at a time, so they are edited on
   * the section they are about (setWeekendHours below), and the season-wide
   * range stays where it always belonged, on step 2.
   */

  /** The board as it stands, remembered before something changes it, WITH the
   *  name of the thing about to happen so the Undo button can say what it puts
   *  back (owner ruling 2026-08-05). */
  const remember = (label: string) =>
    setUndoStack((prev) =>
      [
        ...prev,
        {
          label,
          assignment,
          venues,
          blockStatus,
          courtOverrides,
          hourOverrides,
          assertedGyms,
          emptyGyms,
          fences,
          fridays,
          dirty,
        },
      ].slice(-UNDO_DEPTH)
    )

  /**
   * SAY THE MOVE, AND SHOW IT (owner ruling 2026-08-05). Every route that
   * changes where something plays lands here or beside it, and every one of
   * them does the same two things: name what happened in the notice, and ring
   * BOTH cards for a moment so an accidental drag is never silent.
   */
  const flashCards = (...sessionIds: Array<string | null | undefined>) =>
    setFlashSessions(sessionIds.filter((id): id is string => Boolean(id)))

  /** One moved grade, keyed the way a chip asks whether it is the one that just
   *  moved. */
  const unitFlashKey = (sessionId: string, unitKey: string) => `${sessionId}|${unitKey}`

  /**
   * THE MOVE, AT GRADE LEVEL (owner ruling 2026-08-05, #3, re-ruled the same
   * day). Three things at once, for every route that moves anything: the cards
   * ring, the CHIPS THAT MOVED wear a stronger ring of their own, and the origin
   * keeps a dashed hoop-red slot naming where that grade went. Every verb on
   * this board goes through here, so a switch, a drag, a tap, a rail click and a
   * block move all read the same.
   *
   * NOTHING HERE IS ON A TIMER. The first pass faded the ring at 1.6s and the
   * ghost at 4s, and the owner could not read either of them in time. They stand
   * until the operator touches the board again — a click, a drag or a key — or
   * until Undo takes the move back. Only the LAST move is ever marked, because
   * the interaction that starts the next move is itself what clears the previous
   * one.
   */
  const flashMove = (
    cards: Array<string | null | undefined>,
    landed: Array<{ sessionId: string; unitKey: string }>,
    left: GhostChip[]
  ) => {
    flashCards(...cards)
    setFlashUnits(landed.map((m) => unitFlashKey(m.sessionId, m.unitKey)))
    setGhosts(left)
  }

  /**
   * THE NEXT INTERACTION (owner re-ruling 2026-08-05, #2). Anything the operator
   * does to the board ends the marks the last move left. It runs in the CAPTURE
   * phase from the step's own root, so it fires before the handler that was
   * clicked: a click that starts a new move clears the old marks and then writes
   * its own, and no handler can hide from it with stopPropagation.
   */
  const endMoveMarks = useCallback(() => {
    setFlashUnits((prev) => (prev.length === 0 ? prev : []))
    setGhosts((prev) => (prev.length === 0 ? prev : []))
    // The setters are React's own and never change identity, so this callback
    // is created once whatever the board is doing.
  }, [setFlashUnits, setGhosts])

  /** The gym a grade was playing in on a weekend, as the board has it drawn. */
  const gymOf = (sessionId: string | null | undefined, unitKey: string): string | null =>
    (sessionId ? shown.venues[sessionId]?.[unitKey] : null) ?? null

  /** The ghost a grade leaves behind on the weekend and in the gym it left,
   *  carrying the destination so the origin says where to look next. */
  const ghostFor = (
    sessionId: string | null | undefined,
    unitKey: string,
    to: string
  ): GhostChip[] =>
    sessionId
      ? [
          {
            sessionId,
            venueId: gymOf(sessionId, unitKey),
            unitKey,
            label: unitByKey.get(unitKey)?.label ?? unitKey,
            to,
          },
        ]
      : []

  /** A weekend in the words the notice uses. */
  const weekendName = (sessionId: string | null | undefined) =>
    (sessionId ? weekendById.get(sessionId)?.label : null) ?? "the bench"

  /** The one place a chip changes weekends: drag, tap and the suggestion rail
   *  all land here, so every route through the board is undoable and every one
   *  of them treats the gyms the same way. */
  const move = (unitKey: string, fromSessionId: string | null, toSessionId: string) => {
    if (locked || fromSessionId === toSessionId) return
    const label = unitByKey.get(unitKey)?.label ?? "that grade"
    remember(`move ${label}`)
    setAssignment((prev) => assignmentWithMove(prev, unitKey, fromSessionId, toSessionId))
    // The gym travels with the chip: the weekend it left forgets it, and the
    // weekend it lands on packs it fresh against whatever is already there.
    setVenues((prev) => venuesWithoutUnit(prev, unitKey, [fromSessionId, toSessionId]))
    setArmed(null)
    setDirty(true)
    // A hand edit: whatever the solver said, this board is the operator's now.
    setFromLever(false)
    flashMove(
      [fromSessionId, toSessionId],
      [{ sessionId: toSessionId, unitKey }],
      ghostFor(fromSessionId, unitKey, weekendName(toSessionId))
    )
    setNotice(`${label} moved: ${weekendName(fromSessionId)} → ${weekendName(toSessionId)}`)
  }

  /** Step one move back. Local only: what is on screen is what Keep saves, and
   *  nothing here has been written down yet. */
  const undoMove = () => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    setAssignment(last.assignment)
    setVenues(last.venues)
    setBlockStatus(last.blockStatus)
    setCourtOverrides(last.courtOverrides)
    setHourOverrides(last.hourOverrides)
    setAssertedGyms(last.assertedGyms)
    setEmptyGyms(last.emptyGyms)
    setFences(last.fences)
    setFridays(last.fridays)
    setDirty(last.dirty)
    setUndoStack(undoStack.slice(0, -1))
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    // The board is back where it was, so the marks about the move that is no
    // longer there go with it.
    setFlashUnits([])
    setGhosts([])
    setNotice(`Undone: ${last.label}.`)
  }

  const removeUnit = (unitKey: string, fromSessionId: string) => {
    if (locked) return
    const label = unitByKey.get(unitKey)?.label ?? "that grade"
    remember(`take ${label} off ${weekendName(fromSessionId)}`)
    setAssignment((prev) => ({
      ...prev,
      [fromSessionId]: (prev[fromSessionId] ?? []).filter((k) => k !== unitKey),
    }))
    const left = ghostFor(fromSessionId, unitKey, "the bench")
    setVenues((prev) => venuesWithoutUnit(prev, unitKey, [fromSessionId]))
    setArmed(null)
    setDirty(true)
    setFromLever(false)
    flashMove([fromSessionId], [], left)
    setNotice(`${label} came off ${weekendName(fromSessionId)}.`)
  }

  /**
   * A BACKUP GYM, ASSERTED (owner ruling 2026-08-05, #1). The operator put a gym
   * this plan has no availability for onto a weekend, and by his standing rule
   * that IS the assertion. The next map, ready to be set beside whatever else the
   * verb is doing.
   */
  const withAssertion = (
    prev: Record<string, string[]>,
    sessionId: string,
    venueId: string
  ): Record<string, string[]> =>
    (prev[sessionId] ?? []).includes(venueId)
      ? prev
      : { ...prev, [sessionId]: [...(prev[sessionId] ?? []), venueId] }

  /** True when this plan has no gym time at that building on that weekend, so
   *  putting something there is an assertion rather than a placement. */
  const isBackupGym = (sessionId: string, venueId: string) =>
    !weekendById.get(sessionId)?.venues.some((v) => v.venueId === venueId)

  /**
   * A GRADE CHANGES BUILDING THROUGH moveSection NOW (owner ruling 2026-08-05,
   * #2). There used to be a `switchGym` verb here, behind the ⇄ on every chip,
   * and the ⇄ chose the destination itself: the next building along with room in
   * it, wrapping round. The owner's word for that was "it guesses".
   *
   * The verb is gone rather than left dead. Moving one grade into a named
   * building is a section move of one grade, and moveSection already owns every
   * part of that story: the weekend-rooms arithmetic, the refusal that names
   * what would fit, the backup-gym assertion, one undo step and one notice. Two
   * code paths for the same edit is how the two of them drifted apart in the
   * first place.
   */

  /* --------------------------- the four verbs ----------------------------- */

  /**
   * BRING A WEEKEND TO THE OPERATOR. The rail sits still while five months of
   * calendar scroll past it, so a row that names a weekend has to be able to
   * put that weekend under it. Horizontal scroll inside the board, vertical
   * scroll of the page, and a ring for a moment so the eye lands where the
   * click sent it.
   */
  const jumpToWeekend = useCallback((sessionId: string) => {
    setZoomSession(null)
    // The card exists after this paint at the latest: a rail click can arrive
    // while the board is showing the strip, and the frame gives it time.
    window.requestAnimationFrame(() => {
      const scroller = boardScroll.current
      const card = scroller?.querySelector<HTMLElement>(`[data-session-id="${sessionId}"]`)
      if (!scroller || !card) return
      const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
      const cardBox = card.getBoundingClientRect()
      const boxScroll = scroller.getBoundingClientRect()
      scroller.scrollTo({
        left: scroller.scrollLeft + (cardBox.left - boxScroll.left) - 24,
        behavior: calm ? "auto" : "smooth",
      })
      card.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" })
      setFlashSessions([sessionId])
    })
  }, [boardScroll, setFlashSessions, setZoomSession])

  // The ring is a pointer, not a state: it goes out on its own.
  useEffect(() => {
    if (flashSessions.length === 0) return
    const timer = window.setTimeout(() => setFlashSessions([]), 1600)
    return () => window.clearTimeout(timer)
  }, [flashSessions, setFlashSessions])

  /**
   * The chip's ring and the origin's ghost have NO TIMER (owner re-ruling
   * 2026-08-05, #2). They are the answer to "what did I just do", and an answer
   * that erases itself after a second and a half is one the operator has to
   * catch. They go when the board is touched again, or when Undo takes the move
   * back. The card ring above keeps its clock: that one is a pointer to where to
   * look, and the rail's jump uses it too.
   */

  /**
   * CORRECT — "I don't have this" (owner ruling 2026-08-04). The gym said three
   * courts, not six. It goes in the working copy, the whole board repacks
   * around it, and one Undo puts it back. Nothing is written anywhere until the
   * plan is saved, and then only for the plan the season runs.
   */
  const correctCourts = (sessionId: string, venueId: string, courts: number) => {
    if (locked) return
    const weekend = weekendById.get(sessionId)
    const venue = weekend?.venues.find((v) => v.venueId === venueId)
    if (!weekend || !venue) return
    const wired = courtsWiredAt(venue)
    const held = Math.max(0, Math.min(wired, Math.floor(courts)))
    /** What the games here actually need, which is what the rental was sized at
     *  before anybody said otherwise. */
    const block = blocks.find((b) => b.sessionId === sessionId && b.venueId === venueId)
    const used = block?.courts ?? 0
    remember(`the courts at ${gymShort(venueId)}`)
    setCourtOverrides((prev) => ({ ...prev, [courtCapKey(sessionId, venueId)]: held }))
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setDirty(true)
    setFromLever(false)
    flashCards(sessionId)
    setNotice(
      held > used
        ? // UP is not a correction: nothing repacks, and the ask grows.
          `You rented ${courtsWord(held)} at ${gymShort(venueId)} on ${weekend.label}. The games here use ${used}, and the ask sheet asks for all ${held}.`
        : held >= wired
          ? `${gymShort(venueId)} is back to all ${courtsWord(wired)} on ${weekend.label}.`
          : `${gymShort(venueId)} gives ${courtsWord(held)} on ${weekend.label}. Anything that no longer fits is below, waiting for somewhere to go.`
    )
  }

  /**
   * WHAT A MONTH IS FOR (owner ruling 2026-08-06, the March fence).
   *
   * A league's last month is usually not league games: playoffs come out of
   * standings that do not exist until the regular season ends. Fencing the month
   * takes it out of the solve entirely — nothing is placed there, no grade is
   * owed a weekend in it, and nothing in it reaches the ask — and the column
   * becomes one quiet band instead of a row of dates.
   *
   * An ordinary undoable edit to the working copy, like every other verb here.
   * It takes the month's gym time AND its games with it, because a month that is
   * not league games cannot be holding league games; one Undo hands the whole
   * month back.
   */
  const fenceWindow = (label: string, phase: WindowPhase) => {
    if (locked || !board) return
    const window = board.windows.find((w) => w.label === label)
    if (!window) return
    const sessions = window.weekends.map((w) => w.sessionId)
    const played = sessions.filter((id) => (assignment[id] ?? []).length > 0).length
    remember(phase === "playoffs" ? `fencing ${label}` : `${label} as regular season`)
    setFences((prev) => ({ ...prev, [label]: phase }))
    if (phase === "playoffs") {
      // Nothing plays in a fenced month, so the calendar lets it go with the
      // gym time. The grades land back on the bench of the months that remain.
      setAssignment((prev) => {
        const next = { ...prev }
        for (const id of sessions) delete next[id]
        return next
      })
      setVenues((prev) => {
        const next = { ...prev }
        for (const id of sessions) delete next[id]
        return next
      })
    }
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setZoomSession(null)
    setDirty(true)
    setFromLever(false)
    flashCards(...sessions)
    setNotice(
      phase === "playoffs"
        ? `${label} is playoffs. Nothing is planned there and no grade is owed a weekend in it${
            played > 0 ? `, so ${plural(played, "weekend", "weekends")} came off the calendar` : ""
          }.`
        : `${label} is back in the regular season. Choose the weekends it runs in step 2, then redraw.`
    )
  }

  /**
   * TAKE THE FRIDAY EVENING (owner ruling 2026-08-06). The rail suggests it; the
   * operator is the one who takes it, because a Friday is a phone call and an
   * evening of somebody's life.
   *
   * It goes on the SESSION as shared capacity: a session runs Friday to Sunday
   * and no grade is tied to a day at planning time, so nothing here assigns
   * anybody to the Friday. Scheduling distributes the games later under its own
   * rules. The operator took it, so it is CONFIRMED, and the ⋯ menu on that gym
   * can change or remove it afterwards.
   */
  const takeFriday = (fit: FridayFit) => {
    if (locked || !board) return
    const key = courtCapKey(fit.sessionId, fit.venueId)
    remember(`the Friday at ${gymShort(fit.venueId)}`)
    setFridays((prev) => ({ ...prev, [key]: fit.courts }))
    setBlockStatus((prev) => ({
      ...prev,
      [blockKey(fit.sessionId, fit.venueId)]: bookingStatusFor("operator") as BlockStatus,
    }))
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setDirty(true)
    setFromLever(false)
    flashCards(fit.sessionId)
    setNotice(
      `${weekendName(fit.sessionId)} runs Friday evening too: ${courtsWord(fit.courts)} at ${gymShort(fit.venueId)}, 6-10 PM. The games spread across the session when it is scheduled.`
    )
  }

  /** Take a Friday evening back off a weekend, from the gym's own ⋯ menu. */
  const dropFriday = (sessionId: string, venueId: string) => {
    if (locked) return
    remember(`the Friday at ${gymShort(venueId)}`)
    setFridays((prev) => ({ ...prev, [courtCapKey(sessionId, venueId)]: 0 }))
    setDirty(true)
    setFromLever(false)
    flashCards(sessionId)
    setNotice(`${weekendName(sessionId)} is back to the weekend only at ${gymShort(venueId)}.`)
  }

  /**
   * THIS GYM, THIS DATE, THESE HOURS (owner ruling 2026-08-06, #5). The other
   * half of the ⋯ menu, and an ordinary undoable edit to the working copy: the
   * capacity of that one building on that one weekend moves, everything derived
   * from it follows, and nothing is written anywhere until the plan is saved.
   */
  const setWeekendHours = (
    sessionId: string,
    venueId: string,
    /** Null puts the date back on the gym's usual range. */
    window: { startTime: string; endTime: string } | null
  ) => {
    if (locked) return
    const weekend = weekendById.get(sessionId)
    if (!weekend) return
    if (window && window.startTime >= window.endTime) {
      setNotice("That would close the gym before it opens.")
      return
    }
    remember(`the hours at ${gymShort(venueId)}`)
    setHourOverrides((prev) => {
      const next = { ...prev }
      if (window) next[courtCapKey(sessionId, venueId)] = window
      else delete next[courtCapKey(sessionId, venueId)]
      return next
    })
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setDirty(true)
    setFromLever(false)
    flashCards(sessionId)
    setNotice(
      window
        ? `${gymShort(venueId)} runs ${window.startTime} to ${window.endTime} on ${weekend.label}. Every number on that weekend follows.`
        : `${gymShort(venueId)} is back on its usual hours for ${weekend.label}.`
    )
  }



  /** A whole rental block sent to another weekend: every cohort in it moves
   *  together, because the block is the thing with nowhere to play. */
  const moveBlock = (unitKeys: string[], fromSessionId: string, toSessionId: string) => {
    if (locked || unitKeys.length === 0 || fromSessionId === toSessionId) return
    remember(`move ${gradeList(unitKeys)}`)
    const left = unitKeys.flatMap((key) => ghostFor(fromSessionId, key, weekendName(toSessionId)))
    let nextAssignment = assignment
    let nextVenues = venues
    for (const key of unitKeys) {
      nextAssignment = assignmentWithMove(nextAssignment, key, fromSessionId, toSessionId)
      nextVenues = venuesWithoutUnit(nextVenues, key, [fromSessionId, toSessionId])
    }
    setAssignment(nextAssignment)
    setVenues(nextVenues)
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setDirty(true)
    setFromLever(false)
    flashMove(
      [fromSessionId, toSessionId],
      unitKeys.map((unitKey) => ({ sessionId: toSessionId, unitKey })),
      left
    )
    setNotice(
      `${gradeList(unitKeys)} moved: ${weekendName(fromSessionId)} → ${weekendName(toSessionId)}`
    )
  }

  /* ----------------------- a whole section, as one move -------------------- */

  /** Games each building on a weekend is holding as the board has it drawn,
   *  optionally with some grades taken out of the count (the ones about to move
   *  out of it). */
  const usageOn = (sessionId: string, without: string[] = []): Record<string, number> => {
    const weekend = weekendById.get(sessionId)
    if (!board || !weekend) return {}
    const skip = new Set(without)
    const out: Record<string, number> = {}
    for (const key of assignment[sessionId] ?? []) {
      if (skip.has(key)) continue
      const venueId = shown.venues[sessionId]?.[key]
      if (!venueId) continue
      out[venueId] = (out[venueId] ?? 0) + weekendDemand(board.units, weekend, [key])
    }
    return out
  }

  /** The grades that WOULD fit in a room, smallest first, for a refusal that
   *  names what fits instead of only what does not (owner ruling 2026-08-05, #4). */
  const fitsInside = (sessionId: string, unitKeys: string[], room: number): string[] => {
    const weekend = weekendById.get(sessionId)
    if (!board || !weekend) return []
    const games = (key: string) => weekendDemand(board.units, weekend, [key])
    let left = room
    const fits: string[] = []
    for (const key of [...unitKeys].sort((a, b) => games(a) - games(b))) {
      const need = games(key)
      if (need > left) continue
      fits.push(key)
      left -= need
    }
    return fits
  }

  /**
   * MOVE A WHOLE GYM SECTION, AS ONE ACTION (owner-approved suggestion
   * 2026-08-05, #4). Every grade under one building travels together: onto
   * another building on the same weekend, or onto another weekend of the same
   * month, by drag or by arm-then-tap.
   *
   * It is validated the way ruling #2 validates everything else — against what
   * the destination BUILDING could hold, not against the courts we happen to rent
   * there — and a destination that cannot take the whole group refuses and names
   * what it could take, because a half-applied group move is not what anybody
   * dragged. One entry on the undo stack, labelled in grades.
   */
  const moveSection = (
    unitKeys: string[],
    /** Null for a grade coming off the bench, which is a section of one. */
    fromSessionId: string | null,
    toSessionId: string,
    /** The building it was dropped on, or null when it was dropped on the whole
     *  weekend and the packer gets to choose. */
    toVenueId: string | null
  ) => {
    if (!board || locked || unitKeys.length === 0) return
    const to = weekendById.get(toSessionId)
    if (!to) return
    const sameWeekend = fromSessionId === toSessionId
    if (sameWeekend && !toVenueId) return
    const need = weekendDemand(board.units, to, unitKeys)
    // A same-weekend move takes these grades OUT of the building they are in, so
    // that room counts as free for the group that is moving.
    const used = usageOn(toSessionId, sameWeekend ? unitKeys : [])
    const rooms = weekendRooms(board, to, used, courtOverrides)
    const room = toVenueId ? rooms.find((r) => r.venueId === toVenueId) : null
    /**
     * ONE CAPACITY RULE FOR THE WHOLE BOARD (owner ruling 2026-08-06, #3).
     *
     * A section used to be measured against the gyms this plan ALREADY has there,
     * while a single chip was measured against those plus the backups it could
     * asssert. Two readings of the same weekend meant the board could offer a
     * section a destination and then refuse it, or refuse one it was perfectly
     * willing to take a chip on. The offer and the refusal read the same number
     * now, and the number counts what the drop MAY assert: the home gym on a date
     * the plan runs, and the backup gyms behind it.
     */
    const free = toVenueId
      ? (room?.freeGames ?? 0)
      : rooms.reduce((sum, r) => sum + r.freeGames, 0)
    const where = toVenueId
      ? `${gymShort(toVenueId)} on ${to.label}`
      : `${to.label}`
    if (toVenueId && !room) {
      setNotice(`${gymShort(toVenueId)} is not a gym this plan has. Add it back in step 2.`)
      return
    }
    if (free < need) {
      const fits = fitsInside(toSessionId, unitKeys, free)
      const rest = unitKeys.filter((k) => !fits.includes(k))
      setNotice(
        fits.length === 0
          ? `${where} has room for ${plural(free, "game", "games")}, and this block is ${plural(need, "game", "games")}. Nothing of it fits.`
          : `${where} has room for ${gradeList(fits)}, not ${gradeList(rest)}. Move those on their own, or correct the courts.`
      )
      return
    }
    const backup = Boolean(toVenueId && room?.backup)
    /**
     * A DATE WITH NO ROOM OF ITS OWN TAKES THE GROUP BY ASSERTION (owner ruling
     * 2026-08-06, #3). The offer above counted the backup gyms behind this
     * weekend, so the move has to actually put one there: the cheapest way to
     * cover what the gyms this plan already has cannot, biggest room first, so
     * one building answers it wherever one can.
     */
    const assertHere: string[] = []
    if (!toVenueId) {
      let short = need - rooms.reduce((sum, r) => sum + (r.backup ? 0 : r.freeGames), 0)
      for (const r of [...rooms].filter((r) => r.backup).sort((a, b) => b.freeGames - a.freeGames)) {
        if (short <= 0) break
        assertHere.push(r.venueId)
        short -= r.freeGames
      }
    }
    remember(
      `move ${plural(unitKeys.length, "grade", "grades")} to ${
        toVenueId ? gymShort(toVenueId) : to.label
      }`
    )
    const left = unitKeys.flatMap((key) => ghostFor(fromSessionId, key, where))
    let nextAssignment = assignment
    let nextVenues = venues
    for (const key of unitKeys) {
      if (!sameWeekend) {
        nextAssignment = assignmentWithMove(nextAssignment, key, fromSessionId, toSessionId)
      }
      nextVenues = venuesWithoutUnit(nextVenues, key, [fromSessionId, toSessionId])
    }
    if (toVenueId) {
      nextVenues = {
        ...nextVenues,
        [toSessionId]: {
          ...(nextVenues[toSessionId] ?? {}),
          ...Object.fromEntries(unitKeys.map((key) => [key, toVenueId])),
        },
      }
    }
    const asserted = backup && toVenueId ? [toVenueId] : assertHere
    if (asserted.length > 0) {
      setAssertedGyms((prev) =>
        asserted.reduce((acc, venueId) => withAssertion(acc, toSessionId, venueId), prev)
      )
      setBlockStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(
          // The OPERATOR moved this, so they checked (owner ruling 2026-08-06,
          // the status inversion): confirmed, and silent.
          asserted.map((venueId) => [
            blockKey(toSessionId, venueId),
            bookingStatusFor("operator") as BlockStatus,
          ])
        ),
      }))
    }
    setAssignment(nextAssignment)
    setVenues(nextVenues)
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setDirty(true)
    setFromLever(false)
    flashMove(
      [fromSessionId, toSessionId],
      unitKeys.map((unitKey) => ({ sessionId: toSessionId, unitKey })),
      left
    )
    setNotice(
      `${gradeList(unitKeys)} moved: ${sameWeekend ? where : `${weekendName(fromSessionId)} → ${where}`}${
        asserted.length > 0
          ? `. You said you have ${nameList(asserted.map(gymShort))} that weekend, so it is yours to book.`
          : ""
      }`
    )
  }

  /* ------------------------ drawing a whole calendar ---------------------- */

  /**
   * THE SOLVE RUNS IN THE WORLD ON SCREEN (owner ruling 2026-08-05, #1 and #3).
   *
   * It used to be a POST to the season's propose endpoint, which rebuilds the
   * SEASON's state on the server. On a plan-scoped board — a plan with its own
   * weekends, its own gyms, its own courts and its own estimates — that answers a
   * question nobody asked, so the levers were disabled outright and an empty plan
   * had no way to get a calendar at all.
   *
   * proposePlan and packPlanVenues are pure and take a PlannerState, so the board
   * hands them the state it is DRAWING: the plan's world with every "I don't have
   * this" court correction already applied. One code path for the season's own
   * world and for a plan's, and the answer always matches the numbers on screen.
   */
  const solveOn = (world: PlannerState, lever: PlannerLever) => {
    // Only the weekends this plan RUNS, each of them able to hold something: the
    // world keeps the Saturdays it did not take so the operator can see them, and
    // the solver never gets to fill those. A chosen weekend with no gym time on
    // it yet is filled from the building the league owns (owner ruling
    // 2026-08-06), which is what solvableState puts on it.
    const runs = solvableState(world)
    const assignment = proposePlan(runs, lever)
    const venues = packPlanVenues(runs, assignment)
    return {
      assignment,
      venues,
      // The buildings the solve had to put down, so the board draws the same
      // gyms the calendar was worked out in. The rented ones come back marked
      // assumed: nobody has phoned them (owner ruling 2026-08-06).
      drawn: drawnGyms(world, assignment, venues),
    }
  }

  /**
   * DRAW THE WHOLE CALENDAR. The hero on an empty board, the redraw button in the
   * header, the stranded banner's re-solve and the lever row all land here, so
   * every one of them behaves like any other edit: it lands on the working copy,
   * it is one step on the undo stack, it rings the weekends it filled, and it
   * says what it did. Nothing is written anywhere until the plan is saved.
   *
   * The court CORRECTIONS survive on purpose: "Haber only gave us three that
   * Saturday" is a fact about a gym, and a different calendar does not make it
   * untrue. So does an asserted backup gym (owner ruling 2026-08-05, #1), for
   * exactly the same reason: "we have Haber that Saturday" is availability the
   * operator checked, and the solver should get to use it. What the working copy
   * thought about the OLD weekends' bookings does not survive, because those were
   * opinions about weekends this calendar may not even use.
   *
   * THE DRAW PUTS THE HOME GYM DOWN (owner ruling 2026-08-06, #3). Choosing a
   * weekend on step 2 attaches no building, so the solve fills a chosen weekend
   * from the gym the league owns; the same assertion a hand-placed gym makes is
   * recorded here for every weekend it really used, so the board draws real home
   * sections with meters and blocks instead of games in a building nothing on
   * screen has. It rides the same single undo step as the rest of the draw.
   */
  const drawCalendar = (lever: PlannerLever, said: string, undoLabel: string) => {
    if (!board || locked) return
    const next = solveOn(board, lever)
    remember(undoLabel)
    setAssignment(next.assignment)
    setVenues(next.venues)
    // EVERY RENTAL THE SOLVER MADE IS ASSUMED (owner ruling 2026-08-06). It put
    // those buildings down itself, so they are gold until somebody phones them;
    // the league's own gym is not in the list, because nobody phones their own.
    setBlockStatus(
      Object.fromEntries(
        next.drawn.assumed.map((a) => [
          blockKey(a.sessionId, a.venueId),
          bookingStatusFor("draw") as BlockStatus,
        ])
      )
    )
    setAssertedGyms((prev) =>
      Object.entries(next.drawn.added).reduce(
        (acc, [sessionId, venueIds]) =>
          venueIds.reduce((at, venueId) => withAssertion(at, sessionId, venueId), acc),
        prev
      )
    )
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setGhosts([])
    setZoomSession(null)
    setDirty(true)
    // Straight off the solver and untouched, so a save can honestly say so.
    setFromLever(true)
    flashCards(
      ...Object.entries(next.assignment)
        .filter(([, keys]) => keys.length > 0)
        .map(([sessionId]) => sessionId)
    )
    // The sections that just appeared on weekends that were empty are the
    // league's own building, and the notice says so rather than leaving it to be
    // worked out from the colours.
    /**
     * WHAT IT SPENT, AND WHAT IT ASSUMED (owner ruling 2026-08-06). Booked time
     * first, because that is the league's own money being used, then the gyms it
     * had to assume beyond it.
     */
    const rented = new Set(next.drawn.assumed.map((a) => a.venueId))
    const spent = new Set(next.drawn.booked.map((b) => b.venueId))
    setNotice(
      [
        said,
        spent.size > 0 ? COPY.drawnBooked(nameList([...spent].map(gymShort))) : null,
        rented.size > 0 ? COPY.drawnAssumed(nameList([...rented].map(gymShort))) : null,
      ]
        .filter(Boolean)
        .join(" ")
    )
  }

  /**
   * THE COMPACT-FIRST SOLVE, the one every button that says "draw" or "redraw"
   * runs. "balance" IS compact-first since the 2026-08-03 ruling (fewest weekends
   * first, then the cheapest rentals, then the flattest peak), so this is the
   * default answer and not a lever the operator had to find.
   */
  const draw = (said: string, undoLabel = "drawing the calendar") =>
    drawCalendar("balance", said, undoLabel)

  /** Redrawing over hand work is asked about first: the board is the only place
   *  those moves exist until somebody saves them. */
  const redraw = () => {
    if (dirty && !window.confirm(COPY.redrawConfirm)) return
    draw(COPY.redrawn, "redrawing the calendar")
  }

  const runLever = (lever: PlannerLever) =>
    drawCalendar(
      lever,
      LEVERS.find((l) => l.lever === lever)?.note ?? COPY.redrawn,
      "redrawing the calendar"
    )

  /**
   * THE ONE ALTERNATIVE SHAPE, AS A BUTTON (owner ruling 2026-08-06, #6). The
   * lever row lived behind "adjust grouping rules", a phrase that describes none
   * of what those buttons did. Three of the four levers are the same answer as
   * Redraw since the 2026-08-03 compact-first ruling; the one that is genuinely
   * different is "use every weekend", so it sits next to Redraw with its own
   * name on it and asks the same question before it throws hand work away.
   */
  const redrawSpread = () => {
    if (dirty && !window.confirm(COPY.redrawConfirm)) return
    runLever("spread")
  }

  /**
   * BREAK (owner ruling 2026-08-04). The pure core worked out the edit and its
   * price; this only lands it, the same way a drag lands, so it is one step on
   * the undo stack and nothing about it is special afterwards.
   */
  const applySplit = (
    next: { assignment: Record<string, string[]>; venues: Record<string, Record<string, string>> },
    said: string,
    /** The weekends the split touched, so both ends flash like any other move. */
    touched: Array<string | null> = []
  ) => {
    if (locked) return
    remember("that split")
    setAssignment(next.assignment)
    setVenues(next.venues)
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setArmedSection(null)
    setDirty(true)
    setFromLever(false)
    flashCards(...touched)
    setNotice(said)
  }

  /* ------------------------ dropping on a ghost date ---------------------- */

  /**
   * A DROP ON A DATE THE PLAN WAS NOT USING (owner ruling 2026-08-06, slice B2).
   *
   * This replaces "Add a weekend", which was a disclosure at the foot of every
   * month column hiding a list of dates behind a confirm dialog. The dates are
   * on the board now, as ghosts, and the drop IS the intent: the operator has
   * dragged a gym or a grade onto a Saturday, which is not something to ask them
   * about twice. No confirm, deliberately — the same standing rule the rest of
   * this board runs on ("a drag means they checked"), and one Undo takes the
   * placement back exactly like any other.
   *
   * Three cases, one path:
   *  - the date has a session this plan already draws: nothing to create;
   *  - it has a session the board is not drawing (the plan's world predates it):
   *    the weekend is put into the state the board computes on;
   *  - it has no session at all: one POST creates it first. The weekend alone,
   *    with NO gym attached — a weekend EXISTING is a fact about the season's
   *    shape, while which building is on it is this plan's business, and the
   *    ordinary assertion path below is what puts one there.
   *
   * The intent then waits one render (see pendingDrop): every verb on this board
   * reads the weekend it is acting on out of the state it was rendered with, so
   * a weekend added in this tick is not one they can see yet.
   */
  const dropOnGhost = async (ghost: GhostDate, windowLabel: string, intent: GhostIntent) => {
    if (locked || !board) return
    let sessionId = ghost.sessionId
    if (!sessionId) {
      setBusy("add-weekend")
      setError(null)
      const res = await fetch(`/api/seasons/${seasonId}/weekends`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ satDate: ghost.dateISO }),
      }).catch(() => null)
      const data = res ? await res.json().catch(() => null) : null
      setBusy(null)
      if (!res?.ok || !data?.sessionId) {
        setError(data?.error ?? "That weekend did not save. Try again.")
        return
      }
      sessionId = data.sessionId as string
    }
    if (!weekendById.has(sessionId)) {
      const weekend = {
        sessionId,
        label: ghost.label,
        dateISO: ghost.dateISO,
        dayCount: ghost.dayCount,
      }
      setState((prev) => (prev ? withWeekendInState(prev, windowLabel, weekend) : prev))
      // A plan owns its world, so the plan's own copy grows the same date. Saving
      // then finds the weekend really there, with whatever the drop asserted on
      // it, instead of a placement stranded on a Saturday the plan never had.
      if (planSettings) {
        setPlanSettings((prev) =>
          prev
            ? {
                ...prev,
                state: withWeekend(prev.state, windowLabel, {
                  ...weekend,
                  chosen: false,
                  venues: [],
                  capacityGames: 0,
                  largestVenueCapacity: 0,
                  // The rate the rest of this plan runs at, so the date reads
                  // the same in the plan's world as it does on the board.
                  targetGamesPerTeam: worldWeekends(prev.state)[0]?.targetGamesPerTeam ?? 2,
                }),
              }
            : prev
        )
      }
      refreshSeasonShape()
    }
    setPendingDrop({ sessionId, intent })
  }

  /**
   * THE SEASON GREW A WEEKEND, so the world the board falls back to grows with
   * it, and so does step 2's grid. Deliberately not awaited: the drop lands on
   * the working copy at once and neither of these changes a single number on it.
   * Without it a later save would put the board back in a season world where
   * that Saturday does not exist.
   */
  const refreshSeasonShape = () => {
    void (async () => {
      const [res, venueRes] = await Promise.all([
        fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(() => null),
        fetch(`/api/seasons/${seasonId}/planner/venues`, { cache: "no-store" }).catch(() => null),
      ])
      const data = res?.ok ? await res.json().catch(() => null) : null
      const venueData = venueRes?.ok ? await venueRes.json().catch(() => null) : null
      if (data?.state) setLiveState(data.state as PlannerState)
      if (venueData?.grid) setVenueGrid(venueData.grid)
    })()
  }

  /**
   * ...AND THEN IT LANDS, through the ordinary verbs and nothing else. A gym
   * becomes an empty container on that date; grades move onto it and assert the
   * building they need, which is exactly what they do on any other weekend with
   * room to assert. One undo step, one notice, both written by the verb that did
   * the work.
   *
   * The ref is the guard against a double landing: React remounts effects in
   * development, and a drop that applied twice would be two moves the operator
   * made once. Object identity is what it compares, so a second drop of the same
   * shape still lands.
   */
  const landed = useRef<PendingDrop | null>(null)
  useEffect(() => {
    if (!pendingDrop || landed.current === pendingDrop) return
    if (!weekendById.has(pendingDrop.sessionId)) return
    landed.current = pendingDrop
    setPendingDrop(null)
    const { sessionId, intent } = pendingDrop
    if (intent.kind === "gym") placeVenue(sessionId, intent.venueId, [], 0)
    else moveSection(intent.unitKeys, intent.fromSessionId, sessionId, null)
    // The verbs are rebuilt every render and are deliberately not dependencies:
    // the ref above is what makes this run exactly once per drop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDrop, weekendById])

  /* ----------------------- filling the rental blocks ---------------------- */

  /** Which grades a rental block houses, in the operator's own words. */
  const gradeList = (unitKeys: string[]) =>
    unitKeys.map((k) => unitByKey.get(k)?.label ?? k).join(", ")

  /**
   * FILL THE GAPS FROM THE POOL (owner ruling 2026-08-03, the "assign gyms for
   * me" half). The same pure function the season solves with, run on the board
   * in front of you: every weekend whose spill has no building takes the
   * cheapest gym in the pool that is free that weekend.
   *
   * It lands on the WORKING COPY and nothing else: the gyms go in beside a hand
   * pick, the statuses say "assumed" because nobody has phoned anybody, and one
   * Undo puts the whole thing back. Saving is still the only thing that writes.
   */
  const fillFromPool = () => {
    if (!board || locked) return
    const empty = blocks.filter((b) => b.venueId === null && b.games > 0)
    if (empty.length === 0) {
      setNotice(COPY.nothingToFill)
      return
    }
    const picks = assignBlocksFromPool(board, blocks)
    const nextVenues: Record<string, Record<string, string>> = { ...venues }
    const nextStatus: Record<string, BlockStatus> = { ...blockStatus }
    const took: string[] = []
    /** Weekends where the pool could answer but there is no whole grade to
     *  move: the spill is games past what a building holds. Said separately,
     *  because "no gym is free" would be a lie about those. */
    const noCohort: string[] = []
    for (const block of empty) {
      const pick = picks[block.sessionId]
      const weekend = weekendById.get(block.sessionId)
      if (!pick) continue
      if (block.unitKeys.length === 0) {
        noCohort.push(weekend?.label ?? "that weekend")
        continue
      }
      nextVenues[block.sessionId] = { ...(nextVenues[block.sessionId] ?? {}) }
      for (const key of block.unitKeys) nextVenues[block.sessionId][key] = pick.venueId
      nextStatus[blockKey(block.sessionId, pick.venueId)] = "assumed"
      took.push(`${gymShort(pick.venueId)} on ${weekend?.label ?? "that weekend"}`)
    }
    if (took.length === 0) {
      setNotice(
        noCohort.length > 0
          ? `${nameList(noCohort)} has more games than its buildings hold, and no whole grade to move. Move a grade or add courts back in step 2.`
          : COPY.noPool
      )
      return
    }
    remember("filling the gaps from your pool")
    setVenues(nextVenues)
    setBlockStatus(nextStatus)
    setArmed(null)
    setArmedVenue(null)
    setDirty(true)
    // The pool answered it, so this board is no longer a plain solver answer.
    setFromLever(false)
    setNotice(
      `Took ${took.join(", ")}. Nothing is booked yet, so these read as assumed until a gym says yes.`
    )
  }

  /**
   * PLACE A GYM BY HAND (owner ruling 2026-08-03, the "I will place them" half):
   * a gym dropped on a weekend takes the whole block sitting there.
   *
   * A BACKUP GYM IS A LEGITIMATE PLACE TO PUT GAMES (owner ruling 2026-08-05,
   * #1). This used to refuse a gym the plan has no availability for — "turn it on
   * back in step 2" — which is the board arguing with an operator who has just
   * told it something it did not know. The drop IS the availability assertion, so
   * it lands, and the working copy carries the assertion until the plan is saved.
   *
   * ONE REFUSAL IS LEFT (owner ruling 2026-08-06, the overriding one): the games
   * already in that building that weekend. Availability is not a restriction
   * anywhere on this board — placing IS the availability claim, for the whole day
   * and every court — so nothing here asks whether the gym was attached, phoned
   * or given hours. Anything that lands is CONFIRMED, because an operator who
   * placed it is asserting the building is theirs.
   */
  const placeVenue = (sessionId: string, venueId: string, unitKeys: string[], games: number) => {
    if (!board || locked) return
    setArmedVenue(null)
    const weekend = weekendById.get(sessionId)
    if (!weekend) return
    const short = gymShort(venueId)
    const backup = isBackupGym(sessionId, venueId)
    // What the BUILDING could hold here, with the grades that are moving into it
    // not counted against it (see weekendRooms: this is ruling #2's math).
    const room = weekendRooms(board, weekend, usageOn(sessionId, unitKeys), courtOverrides).find(
      (r) => r.venueId === venueId
    )
    if (!room) {
      // Not an availability refusal any more (owner ruling 2026-08-06): every
      // gym in the roster is a room on every weekend. The only way to land here
      // is a building with no courts at all, or one this plan no longer has.
      setNotice(`${short} has no courts this plan can use. Check it in step 2.`)
      return
    }
    /**
     * A BUILDING ON AN EMPTY DATE (owner ruling 2026-08-06, #2). Nothing plays
     * here yet, so there is nothing to fit and nothing to bill: the gym lands as
     * an empty container, the date now has a building on it, and the operator can
     * drop grades into it. Placing a building is not a booking. Filling it is.
     *
     * This is what the board used to refuse with "that weekend has more games
     * than its buildings hold", which was a sentence about a weekend that had no
     * games at all.
     */
    if (games <= 0 && unitKeys.length === 0) {
      remember(`placing ${short} on ${weekend.label}`)
      if (backup) setAssertedGyms((prev) => withAssertion(prev, sessionId, venueId))
      setEmptyGyms((prev) => withAssertion(prev, sessionId, venueId))
      setBlockStatus((prev) => ({
        ...prev,
        [blockKey(sessionId, venueId)]: bookingStatusFor("operator") as BlockStatus,
      }))
      setArmed(null)
      setDirty(true)
      setFromLever(false)
      flashMove([sessionId], [], [])
      setNotice(
        `${short} is on ${weekend.label} now, empty. Drop grades into it, and it costs nothing until you do.`
      )
      return
    }
    if (games > 0 && room.freeGames < games) {
      const venue = weekend.venues.find((v) => v.venueId === venueId)
      const needed = venue ? courtsNeeded(venue, games) : 0
      setNotice(
        venue && needed > room.courts
          ? `${short} has ${room.courts} of the ${needed} courts needed on ${weekend.label}.`
          : `${short} is already holding ${plural(room.usedGames, "game", "games")} of the ${
              room.capacityGames
            } it can on ${weekend.label}, so ${plural(games, "game", "games")} will not fit.`
      )
      return
    }
    if (unitKeys.length === 0) {
      setNotice(
        `${weekend.label} has more games than its buildings hold, and no whole grade to move. Add courts at ${short} back in step 2.`
      )
      return
    }
    remember(`placing ${short} on ${weekend.label}`)
    if (backup) setAssertedGyms((prev) => withAssertion(prev, sessionId, venueId))
    setVenues((prev) => {
      const next = { ...prev, [sessionId]: { ...(prev[sessionId] ?? {}) } }
      for (const key of unitKeys) next[sessionId][key] = venueId
      return next
    })
    setBlockStatus((prev) => ({
      ...prev,
      [blockKey(sessionId, venueId)]: bookingStatusFor("operator") as BlockStatus,
    }))
    setArmed(null)
    setDirty(true)
    setFromLever(false)
    flashMove(
      [sessionId],
      unitKeys.map((unitKey) => ({ sessionId, unitKey })),
      []
    )
    setNotice(
      backup
        ? `${gradeList(unitKeys)} plays ${short} on ${weekend.label}. You said you have it that weekend, so it is yours to book.`
        : `${gradeList(unitKeys)} plays ${short} on ${weekend.label}. You placed it, so it is yours to book.`
    )
  }

  /** A gym dragged out of the tray and dropped on a weekend. */
  const onDropVenue = (
    e: React.DragEvent,
    sessionId: string,
    unitKeys: string[],
    games: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const payload = JSON.parse(e.dataTransfer.getData("text/plain")) as DragPayload
      if (!payload?.venueId) return
      placeVenue(sessionId, payload.venueId, unitKeys, games)
    } catch {
      /* not one of our gyms */
    }
  }

  const onDrop = (e: React.DragEvent, toSessionId: string, toWindow: string) => {
    e.preventDefault()
    try {
      const payload = JSON.parse(e.dataTransfer.getData("text/plain")) as DragPayload
      // A WHOLE SECTION, dropped on a weekend (owner ruling 2026-08-05, #4): every
      // grade under that gym travels, and the packer picks their buildings here.
      if (payload?.section && Array.isArray(payload.unitKeys) && payload.sessionId) {
        if (payload.window !== toWindow) {
          setNotice(COPY.oneWeekendPerMonth)
          return
        }
        moveSection(payload.unitKeys, payload.sessionId, toSessionId, null)
        return
      }
      if (!payload?.unitKey) return
      if (payload.window !== toWindow) {
        setNotice(COPY.oneWeekendPerMonth)
        return
      }
      move(payload.unitKey, payload.fromSessionId ?? null, toSessionId)
    } catch {
      /* not one of our chips */
    }
  }

  /**
   * A DROP ON A GYM SECTION. Two payloads land here: a gym out of the tray (which
   * the section takes for its block) and a whole section (which moves into this
   * building). A grade chip is deliberately left to bubble up to the weekend card,
   * where a plain move already lives.
   */
  const onDropSection = (
    e: React.DragEvent,
    sessionId: string,
    windowLabel: string,
    venueId: string,
    unitKeys: string[],
    games: number,
    canPlaceGym: boolean,
    canTakeChip: boolean
  ) => {
    let payload: DragPayload = null
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain")) as DragPayload
    } catch {
      return
    }
    if (payload?.section && Array.isArray(payload.unitKeys) && payload.sessionId) {
      e.preventDefault()
      e.stopPropagation()
      if (payload.window !== windowLabel) {
        setNotice(COPY.oneWeekendPerMonth)
        return
      }
      if (payload.sessionId === sessionId && payload.venueId === venueId) return
      moveSection(payload.unitKeys, payload.sessionId, sessionId, venueId)
      return
    }
    /**
     * ONE GRADE, DROPPED ON THE GYM THE OPERATOR MEANT (owner ruling 2026-08-05,
     * #2). This is what the retired ⇄ used to do by guessing. The card has
     * already asked weekend-rooms whether this building can hold it, so a drop
     * that gets here is one the board will take; moveSection lands it.
     */
    if (payload?.unitKey && payload.fromSessionId && canTakeChip) {
      e.preventDefault()
      e.stopPropagation()
      if (payload.window !== windowLabel) {
        setNotice(COPY.oneWeekendPerMonth)
        return
      }
      moveSection([payload.unitKey], payload.fromSessionId, sessionId, venueId)
      return
    }
    if (payload?.venueId && canPlaceGym) {
      e.preventDefault()
      e.stopPropagation()
      placeVenue(sessionId, payload.venueId, unitKeys, games)
    }
  }

  /** Arming a section puts everything else down: one thing is in the operator's
   *  hand at a time, whichever thing it is.
   *
   *  Putting one DOWN leaves the marks alone: a drag ends by disarming, and the
   *  ghosts the drop just wrote are the answer to what it did. */
  const armSection = (section: ArmedSection | null) => {
    setArmedSection(section)
    if (!section) return
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setGhosts([])
  }

  /**
   * BREAK, priced (owner ruling 2026-08-04). Both axes and both prices come
   * from the same pure functions the board itself computes on, so the sentence
   * in the popover and the board after "Do it" are the same arithmetic.
   *
   * Called lazily, only while a split popover is open: pricing a split means
   * packing the whole season twice, and nobody is asking for that on every
   * repaint of every weekend.
   */
  const splitAxesFor = (sessionId: string, unitKeys: string[]): SplitAxis[] => {
    // The board is the only thing that offers a split, and it is not drawn until
    // there is a world to draw it in, so this never fires.
    if (!board) return []
    const before = planCost(board, assignment, venues)
    /** Priced at both scopes: the season leads, and the weekend in front of the
     *  operator speaks up when the season nets out to nothing. */
    const priceOf = (next: {
      assignment: Record<string, string[]>
      venues: Record<string, Record<string, string>>
      toSessionId: string | null
    }) => {
      const touched = new Set([sessionId, ...(next.toSessionId ? [next.toSessionId] : [])])
      return splitPriceSentence(
        planPrice(before, planCost(board, next.assignment, next.venues)),
        planPrice(
          planCost(board, assignment, venues, touched),
          planCost(board, next.assignment, next.venues, touched)
        )
      )
    }
    const say = (keys: string[]) => nameList(keys.map((k) => unitByKey.get(k)?.label ?? k))
    /** Who is left behind, named. Deliberately not "the rest stays where it
     *  is": the packer is free to re-sort everything the split did not pin, and
     *  it usually does, so the only honest promise is about these grades. */
    const stays = (moved: string[]) => {
      const left = unitKeys.filter((k) => !moved.includes(k))
      return left.length === 0 ? "" : ` ${say(left)} ${left.length === 1 ? "stays" : "stay"} put.`
    }
    const single =
      "There is one grade here. A grade plays one building on one weekend, so a family drives to one address."

    const acrossGyms = splitAcrossGyms(board, assignment, venues, sessionId, unitKeys)
    const acrossWeekends = splitAcrossWeekends(board, assignment, venues, sessionId, unitKeys)
    return [
      {
        key: "gyms",
        label: "Across gyms this weekend",
        detail: acrossGyms
          ? `${say(acrossGyms.moved)} moves to ${gymShort(acrossGyms.toVenueId as string)}.${stays(acrossGyms.moved)}`
          : unitKeys.length < 2
            ? single
            : "No second building on this weekend has room for any of it.",
        price: acrossGyms ? priceOf(acrossGyms) : null,
        onApply: () => {
          if (!acrossGyms) return
          applySplit(
            acrossGyms,
            `${say(acrossGyms.moved)} plays ${gymShort(acrossGyms.toVenueId as string)} that weekend. You split it, so both sides count as your pick.`,
            [sessionId]
          )
        },
      },
      {
        key: "weekends",
        label: "Across two weekends",
        detail: acrossWeekends
          ? `${say(acrossWeekends.moved)} moves to ${weekendById.get(acrossWeekends.toSessionId as string)?.label ?? "the lighter weekend"}, the emptiest weekend this month.${stays(acrossWeekends.moved)}`
          : unitKeys.length < 2
            ? single
            : "There is no other weekend with room this month.",
        price: acrossWeekends ? priceOf(acrossWeekends) : null,
        onApply: () => {
          if (!acrossWeekends) return
          applySplit(
            acrossWeekends,
            `${say(acrossWeekends.moved)} moves to ${weekendById.get(acrossWeekends.toSessionId as string)?.label ?? "the lighter weekend"}. The month now runs on two weekends.`,
            [sessionId, acrossWeekends.toSessionId]
          )
        },
      },
    ]
  }

  return {
    /* the marks the last move left, and the one step back */
    gradeList,
    endMoveMarks,
    undoMove,
    /* moving what is on the board */
    move,
    removeUnit,
    moveBlock,
    moveSection,
    armSection,
    placeVenue,
    fillFromPool,
    onDrop,
    onDropVenue,
    onDropSection,
    /* what the board computes for you */
    draw,
    fenceWindow,
    takeFriday,
    dropFriday,
    redraw,
    redrawSpread,
    runLever,
    splitAxesFor,
    /* one gym on one date, and the one verb that really writes */
    correctCourts,
    setWeekendHours,
    dropOnGhost,
    /* bringing a weekend to the operator */
    jumpToWeekend,
  }
}
