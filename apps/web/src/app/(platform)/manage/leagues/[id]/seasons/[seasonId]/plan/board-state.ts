"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  applyCourtCaps,
  courtCapKey,
  currentAssignment,
  packShownPlacements,
  planSummary,
  rentalAsk,
  suggestFor,
  weekendDemand,
  withRentedCourts,
  type PlacementReason,
  type PlannerState,
  type PlannerSuggestion,
  type PlannerWeekend,
  type ShownPlacements,
} from "@/lib/scheduler/planner-core"
import { planDrift, type PlanSettings } from "@/lib/scheduler/plan-documents"
import {
  bareWeekend,
  boardColumns,
  strandedPlacements,
  weekendRooms,
  weekendGymHours,
  withAssertedGyms,
  withWeekendHours,
  type BoardColumn,
  type BuildingRoom,
  type StrandedPlacement,
} from "@/lib/scheduler/plan-world"
import type { VenueGrid } from "@/lib/seasons/venue-grid"
import { venueShortName } from "@/lib/seasons/venue-strip"
import { planVenueHues, type Armed, type ArmedBlock, type ArmedSection, type GhostChip } from "./plan-shared"
import type { BlockStatus, TrayGym } from "./plan-ui"
import { usePlanSession } from "./plan-session"
import type { StripSide } from "./season-strip"
import type { PlanHeaderInfo } from "./teams-step"
import {
  LOCKED_STATUSES,
  blockKey,
  savedVenueMap,
  type BoardSnapshot,
  type PendingDrop,
} from "./board-shared"

/**
 * THE WORKING COPY, AND EVERYTHING DERIVED FROM IT.
 *
 * The board is a working copy of ONE named plan: a calendar, the gyms it puts
 * each grade in, the rentals behind it and the corrections somebody made to
 * them. This hook owns every atom of that copy and every number the screen
 * reads off it, in ONE derivation each, so the board, the strip, the rail, the
 * zoom and the ask sheet can never disagree about the same weekend.
 *
 * Nothing here writes: the verbs (board-verbs) change the copy and the plan
 * document (board-plans) is the only thing that persists it. The order matters
 * on mount — this hook loads the world, board-plans opens the chosen plan into
 * it, and board-verbs is what a click then does to it.
 */
export function useBoardState({
  seasonId,
  onLoaded,
}: {
  seasonId: string
  onLoaded?: (info: PlanHeaderInfo) => void
}) {
  /** The world the board computes in: the season's, or the plan's own saved
   *  one while a snapshot plan is open. */
  const [state, setState] = useState<PlannerState | null>(null)
  /** The season as it stands right now, always. Kept next to `state` because
   *  drift is the difference between the two, and because the levers, the
   *  hours and every write still act on THIS world. */
  const [liveState, setLiveState] = useState<PlannerState | null>(null)
  /** The world the selected plan was saved in, or null when it predates
   *  world-tracking (an older row) or no plan is selected. */
  const [planSettings, setPlanSettings] = useState<PlanSettings | null>(null)
  /** True while the board is drawn in the plan's saved world rather than the
   *  season's. The levers go quiet, and the board says which world it is in. */
  const [onPlanWorld, setOnPlanWorld] = useState(false)
  const [assignment, setAssignment] = useState<Record<string, string[]>>({})
  /** The gym each grade plays in, weekend by weekend. Decisions only: a
   *  weekend nobody has decided is absent and the board packs a preview. */
  const [venues, setVenues] = useState<Record<string, Record<string, string>>>({})
  /** The last few boards, newest last, so a move taken by mistake is one tap
   *  from undone. Local only: the plan is temporary until Keep, and leaving
   *  the page throws the whole thing away, stack included. */
  const [undoStack, setUndoStack] = useState<BoardSnapshot[]>([])
  /**
   * WHERE EACH RENTAL STANDS, in the working copy only (owner ruling
   * 2026-08-03): "<sessionId>|<venueId>" → assumed | confirmed.
   *
   * A rental the pool answered is "assumed" — a gym nobody has phoned. One the
   * operator placed by hand is "confirmed", because they asserted it. What is
   * NOT in this map falls back to the gym's attachment as step 2 saved it, so
   * the board never invents a booking.
   */
  const [blockStatus, setBlockStatus] = useState<Record<string, BlockStatus>>({})
  /**
   * THE COURTS WE HOLD AT ONE GYM ON ONE DATE, in the working copy (owner ruling
   * 2026-08-04, made two-way 2026-08-06 #5): "<sessionId>|<venueId>" → courts.
   *
   * Step 2 knows how many courts a building has; only the operator knows what
   * happened when they phoned it about one Saturday in November. Both answers are
   * the same number read in two directions:
   *
   *  - BELOW the demand-sized rental it is "I don't have this": capacity shrinks,
   *    the board repacks around it, and whatever no longer fits comes back as
   *    games looking for a building.
   *  - ABOVE it, the operator rented more of the building than the games needed.
   *    Capacity was never the constraint, so nothing repacks; the block is billed
   *    at what they booked and the section says "4 used of 6 rented".
   *
   * Written onto the weekend's own attachment on save, and only for the plan the
   * season actually runs.
   */
  const [courtOverrides, setCourtOverrides] = useState<Record<string, number>>({})
  /**
   * THE HOURS ONE GYM RUNS ON ONE DATE (owner ruling 2026-08-06, #5):
   * "<sessionId>|<venueId>" → the window the operator was given. The other half
   * of the ⋯ menu, keyed the same way as the courts, and applied to the state the
   * board draws so every capacity below it follows at once.
   */
  const [hourOverrides, setHourOverrides] = useState<
    Record<string, { startTime: string; endTime: string }>
  >({})
  /**
   * A GYM PUT ON A DATE THAT HAS NOTHING IN IT YET (owner ruling 2026-08-06, #2):
   * sessionId → the venueIds the operator placed there with no games.
   *
   * Placing a building is not a booking, so this costs nothing anywhere: it is
   * not a rental block, it is not in the ask, and it never will be until a grade
   * lands in it. It is here so the board can DRAW the container the operator just
   * put down, and so one Undo takes it away again.
   */
  const [emptyGyms, setEmptyGyms] = useState<Record<string, string[]>>({})
  /**
   * BACKUP GYMS THE OPERATOR ASSERTED, in the working copy (owner ruling
   * 2026-08-05, #1): sessionId → the venueIds they put on that weekend.
   *
   * A pool gym this plan has no availability for is a legitimate overflow
   * backup, and dropping it on a weekend IS the assertion that they have it (his
   * standing rule: a drag means they checked). The board computes on it at once,
   * so the placement reads as an ordinary rented block; saving writes it into the
   * plan's own world, or onto the season's attachment on the plan it runs.
   */
  const [assertedGyms, setAssertedGyms] = useState<Record<string, string[]>>({})
  /**
   * A DROP THAT LANDED ON A DATE THE PLAN WAS NOT USING (owner ruling
   * 2026-08-06, slice B2): what the operator dropped, and the weekend it is
   * waiting for.
   *
   * A ghost date may have no session behind it at all, in which case the drop
   * creates one; either way the board has to be DRAWING that weekend before the
   * ordinary verbs can land anything on it, and a verb cannot see a weekend that
   * was added in the same tick. So the intent waits here for exactly one render
   * and board-verbs lands it the moment the weekend exists.
   */
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null)
  /** The weekend the operator is standing inside, or null on the season board.
   *  Client state, not a route: the working copy IS the page, and a navigation
   *  would throw it away to show the same numbers bigger. */
  const [zoomSession, setZoomSession] = useState<string | null>(null)
  /**
   * The weekends the board just touched, ringed for a moment: where a rail
   * click sent the eye, and BOTH ENDS of a move (owner ruling 2026-08-05) so a
   * grade that jumps two columns is never a thing that happened off screen.
   * Reduced motion is honoured — the ring appears, it just does not animate.
   */
  const [flashSessions, setFlashSessions] = useState<string[]>([])
  /**
   * THE CHIP THAT MOVED, ringed (owner ruling 2026-08-05, #3a): "<sessionId>|
   * <unitKey>" for each grade the last edit put somewhere. Ringing the two cards
   * was not enough on a card with eight chips on it — the thing that moved has to
   * wear the mark itself.
   */
  const [flashUnits, setFlashUnits] = useState<string[]>([])
  /**
   * WHERE IT WAS (owner ruling 2026-08-05, #3b). A dashed "Grade 8 was here"
   * left at the origin for a few seconds, so a move always reads as a move rather
   * than as a grade that appeared somewhere.
   */
  const [ghosts, setGhosts] = useState<GhostChip[]>([])
  /** A whole rental block picked up, looking for a different weekend: the
   *  second half of the two-choice prompt a stranded block offers. */
  const [armedBlock, setArmedBlock] = useState<ArmedBlock | null>(null)
  /** A whole gym section picked up, looking for another building or another
   *  weekend (owner-approved suggestion 2026-08-05, #4). */
  const [armedSection, setArmedSection] = useState<ArmedSection | null>(null)
  /** The board's horizontal scroller, so the rail can bring a weekend to the
   *  operator instead of asking them to go and find it. */
  const boardScroll = useRef<HTMLDivElement>(null)
  /**
   * THE MODE IS GONE (owner ruling 2026-08-06, #6). There used to be a switch
   * above the board saying who chooses the rented gyms, "assign gyms for me" or
   * "I will place them", and it decided whether the pool was even drawn. It was a
   * setting standing in front of two verbs: filling the gaps is a button now, and
   * picking a gym up has always been something the operator can just do.
   */
  /** A gym picked up from the gym list, waiting for a weekend. The touch half of
   *  the drag, and the same arm-then-tap pattern the grade chips use. */
  const [armedVenue, setArmedVenue] = useState<string | null>(null)
  /**
   * A MOUSE IS MID-DRAG (owner ruling 2026-08-05, #1). Dragging arms whatever is
   * being dragged, so the valid destinations light up under the cursor exactly
   * as they do for the tap path. This one bit is what keeps the DASHED OFFERS
   * shut while it happens: a button appearing under a moving cursor moves the
   * drop point out from under the drag.
   */
  const [dragging, setDragging] = useState(false)
  /**
   * THE GRADE HIGHLIGHT (owner ruling 2026-08-05, #4): the grades the operator
   * picked out of the strip above the board, by unit key. Purely a lens — no
   * placement, no gym and no number below it changes — so it lives nowhere near
   * the working copy and is never saved.
   */
  const [gradeFilter, setGradeFilter] = useState<string[]>([])
  /**
   * THE GYM LENS (owner ruling 2026-08-06, #4): the buildings the operator picked
   * out of the gym list, by venueId. The same kind of lens as the grade one and
   * it combines with it as an INTERSECTION — "Grade 8 at Six Park" is a question
   * with one answer, not two overlapping highlights. Nothing under it moves.
   */
  const [gymFilter, setGymFilter] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState<Armed | null>(null)
  /**
   * THE THREE DISCLOSURES UNDER THE BOARD ARE GONE (owner ruling 2026-08-06, #6).
   * "Adjust grouping rules" hid a row of levers behind a word nobody pressed, and
   * the one lever worth reaching for is now a button beside Redraw. "Change the
   * hours" moved every gym on every weekend at once, which is not a thing anybody
   * phones a gym about; per-date hours live in the ⋯ menu on the section they are
   * about. "Compare with the kept plan" was a lens over a question the strip
   * already answers side by side.
   */
  /** The calendar as SAVED, captured before any proposal touches the board.
   *  Null until the league has kept one, and what the strip's kept side draws. */
  const [kept, setKept] = useState<Record<string, string[]> | null>(null)
  /** The gyms that kept calendar was saved with, so the strip can show the
   *  buildings you kept rather than the ones you are trying out. */
  const [keptVenues, setKeptVenues] = useState<Record<string, Record<string, string>>>({})
  /** Board by default: it is where a month gets rearranged. The strip is the
   *  season read left to right, and it is one tap away. */
  const [view, setView] = useState<"board" | "strip">("board")
  const [side, setSide] = useState<StripSide>("proposal")
  /** Step 2's gyms-and-weekends answer, so the strip can say which gyms you
   *  actually have each weekend instead of assuming both. */
  const [venueGrid, setVenueGrid] = useState<VenueGrid | null>(null)
  /**
   * WHICH PLAN THE WIZARD IS IN. It lives above the steps now (owner ruling
   * 2026-08-05): the plan is chosen at step 1, the board follows that choice,
   * and a visit where nobody chose anything opens on nothing at all.
   */
  const session = usePlanSession()
  const plans = session.plans
  const planId = session.planId
  /** The plan the BOARD is currently drawing, so the effect below opens a
   *  chosen plan once and a save that already drew it is left alone. */
  const drawnPlan = useRef<string | null>(null)
  /** True while the board is a solver's answer nobody has touched by hand, so
   *  a save can honestly call itself "proposed" rather than the operator's own
   *  work. Any hand edit clears it. */
  const [fromLever, setFromLever] = useState(false)
  /** What is in the name box, or null while the box is shut. */
  const [naming, setNaming] = useState<string | null>(null)

  /**
   * The solve lives with the other verbs now (see `drawCalendar` below). It used
   * to POST /api/seasons/[id]/planner/propose, which rebuilds the SEASON's world
   * on the server: correct for the plan the season runs and wrong for every
   * other plan, which is why the levers used to be switched off on a plan-scoped
   * board. The endpoint still exists for other callers.
   */

  /**
   * ONE DOCUMENT, HELD ABOVE THE STEPS (owner ruling 2026-08-05, the staleness
   * fix). The board no longer fetches the plan itself: the wizard holds it, and
   * the board draws whatever version the wizard has. That is what makes coming
   * back from step 2 show step 2's edits.
   */
  const planDoc = session.doc
  const planVersion = session.docVersion
  /** Set right before a save that has ALREADY put the result on the board, so
   *  the redraw effect below does not undo the notice and the local state. */
  const skipRedraw = useRef(false)

  /**
   * Load the world the board computes in, and NOTHING ELSE (owner ruling
   * 2026-08-05, #2). The board no longer opens the season's active plan on
   * arrival, and it no longer asks the solver for an opening proposal: a visit
   * where the operator has not chosen a plan shows the chooser, because the
   * league's imported reference calendar is not something to put under
   * somebody's hands unasked.
   *
   * What still loads: the season as it stands, the gyms, and the calendar the
   * season has SAVED, which is what compare mode measures against.
   */
  const load = useCallback(async () => {
    // no-store on both: capacity moves when a gym or a court does, and this
    // screen must never draw a weekend on a cached court count.
    const [res, venueRes] = await Promise.all([
      fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(() => null),
      fetch(`/api/seasons/${seasonId}/planner/venues`, { cache: "no-store" }).catch(() => null),
    ])
    if (!res?.ok) {
      setError("Couldn't load your calendar")
      return
    }
    const data = await res.json()
    // The gym row is extra truth, not a dependency: if it fails the strip
    // falls back to the venues the planner itself found capacity at.
    const venueData = venueRes?.ok ? await venueRes.json().catch(() => null) : null
    const next: PlannerState = data.state
    const isLocked = LOCKED_STATUSES.includes(data.seasonStatus)
    const saved = currentAssignment(next)
    const hasSaved = Object.values(saved).some((keys) => keys.length > 0)
    const savedVenues = savedVenueMap(next)

    setState(next)
    setLiveState(next)
    setPlanSettings(null)
    setOnPlanWorld(false)
    setVenueGrid(venueData?.grid ?? null)
    setLocked(isLocked)
    setArmed(null)
    setArmedVenue(null)
    // Statuses come back from the gyms themselves on a fresh load: whatever
    // the working copy was thinking is gone with the board it was thinking on.
    setBlockStatus({})
    setCourtOverrides({})
    setHourOverrides({})
    setAssertedGyms({})
    setEmptyGyms({})
    setFlashUnits([])
    setGhosts([])
    setArmedSection(null)
    setKept(hasSaved ? saved : null)
    setKeptVenues(hasSaved ? savedVenues : {})
    if (!hasSaved) setSide("proposal")
    onLoaded?.({ leagueName: data.leagueName, seasonLabel: data.seasonLabel })
    // An empty board until a plan is opened. Nothing is selected by default.
    setAssignment({})
    setVenues({})
    setUndoStack([])
    setDirty(false)
    setNaming(null)
    setFromLever(false)
    setNotice(null)
    drawnPlan.current = null
  }, [seasonId, onLoaded])

  useEffect(() => {
    load()
  }, [load])

  // Escape always cancels an armed chip, gym, block or section, wherever focus
  // went. It also ends the marks the last move left: pressing Escape is an
  // interaction, and they last "until the next one" (owner ruling 2026-08-05,
  // re-ruled the same day, #2). And it clears the grade highlight, because a
  // lens the operator cannot get out of is a trap (owner ruling 2026-08-05, #4).
  useEffect(() => {
    const anythingArmed = Boolean(armed || armedVenue || armedBlock || armedSection)
    const anythingMarked = ghosts.length > 0 || flashUnits.length > 0
    const anyLens = gradeFilter.length > 0 || gymFilter.length > 0
    if (!anythingArmed && !anythingMarked && !anyLens) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setArmed(null)
      setArmedVenue(null)
      setArmedBlock(null)
      setArmedSection(null)
      setFlashUnits([])
      setGhosts([])
      // BOTH LENSES (owner ruling 2026-08-06, #4). They combine, so they clear
      // together: leaving one of them on would be a board still hiding things
      // after the operator asked for it back.
      setGradeFilter([])
      setGymFilter([])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [armed, armedVenue, armedBlock, armedSection, ghosts, flashUnits, gradeFilter, gymFilter])

  /**
   * Which building every grade plays in, for the WHOLE calendar at once: one
   * chronological pass, carrying each grade's gym from October through to
   * February (owner rule 2026-08-02 — a grade keeps its gym and only moves
   * when capacity forces it). Both views read this one answer, and so does
   * Keep, so the board, the strip and the saved plan can never disagree.
   *
   * Packing a weekend on its own could not do this: December had no idea where
   * a grade had been playing, so the biggest grade took the gym that fills
   * first and a resident was quietly moved out of its own building.
   */
  /**
   * THE WORLD THE BOARD COMPUTES IN: the plan's world with every "I don't have
   * this" correction applied on top (owner ruling 2026-08-04).
   *
   * One derivation, at the top, so a corrected gym is smaller EVERYWHERE at
   * once: the section meter, the weekend fraction, the rental blocks, the ask
   * sheet, the suggestions and the solver's own view of the weekend. Nothing
   * downstream needs to know a correction exists, and a board with no
   * corrections gets the identical object back, so it costs nothing.
   */
  /**
   * The asserted backup gyms go in FIRST and the corrections on top of them
   * (owner ruling 2026-08-05, #1 and #4): a gym somebody put on a weekend by hand
   * is part of the world the board computes in, and "they only gave us three
   * courts" is a correction to that world like any other.
   */
  /**
   * The order is load-bearing. The gyms an operator asserted go in FIRST, because
   * a gym that is not on the weekend yet cannot be given hours or courts; the
   * per-date HOURS come next, because they re-derive the capacity a court
   * correction is then a fraction of; and the courts land last (owner ruling
   * 2026-08-06, #5).
   */
  const board = useMemo(
    () =>
      state
        ? applyCourtCaps(
            withWeekendHours(withAssertedGyms(state, assertedGyms), hourOverrides),
            courtOverrides
          )
        : null,
    [state, assertedGyms, hourOverrides, courtOverrides]
  )

  /**
   * IS THERE A WORLD TO SOLVE IN (owner ruling 2026-08-05, #1)? One weekend this
   * plan runs, with some gym time on it. Capacity answers both halves in one
   * number: a weekend the plan does not run carries no gyms, and a weekend whose
   * gyms are shut carries no games, so either way there is nothing to fill.
   */
  const worldUsable = useMemo(
    () =>
      (board?.windows ?? []).some((win) =>
        win.weekends.some((w) => w.chosen !== false && w.capacityGames > 0)
      ),
    [board]
  )
  /** Nothing placed anywhere. Not "no plan open": a plan whose calendar has not
   *  been drawn yet, which is the state the hero exists for. */
  const calendarEmpty = useMemo(
    () => Object.values(assignment).every((keys) => (keys ?? []).length === 0),
    [assignment]
  )

  /**
   * THE PLAN'S WORLD MOVED UNDER THE CALENDAR (owner ruling 2026-08-05, #4). The
   * operator went back to step 2 and took a gym off a weekend the calendar was
   * already using, or turned the weekend off outright.
   *
   * Nothing is quietly re-drawn somewhere else. The stale decision is dropped —
   * which is what sends those games into the dashed block that needs a building,
   * because that is exactly what they are — and the fact is kept so the banner,
   * the chip and the rail can all say the same true thing.
   */
  const gone = useMemo(
    () =>
      board
        ? strandedPlacements(board, assignment, venues)
        : { assignment, venues, stranded: [] as StrandedPlacement[] },
    [board, assignment, venues]
  )
  const stranded = gone.stranded
  /** The weekends and grades a gone gym or weekend has stranded, for the chips
   *  and the section headers that have to wear it. */
  const strandedAt = useMemo(() => {
    const out = new Map<string, Set<string>>()
    for (const s of stranded) {
      const at = out.get(s.sessionId) ?? new Set<string>()
      at.add(s.unitKey)
      out.set(s.sessionId, at)
    }
    return out
  }, [stranded])

  /**
   * THE ONE MOVE THE STRANDED GAMES CAN ACTUALLY TAKE (owner ruling 2026-08-05,
   * #2). A weekend in the SAME MONTH that this plan runs and that still has room
   * for them, because a grade plays one weekend a month and no button may offer a
   * move the board would then refuse.
   *
   * One weekend at a time, deliberately: the button names the weekend it moves
   * to, so it acts on the group it names. A second stranded weekend gets its own
   * click, and each one is its own step on the undo stack.
   */
  const strandedMove = useMemo(() => {
    if (!board || stranded.length === 0) return null
    const groups = new Map<string, string[]>()
    for (const s of stranded) {
      const at = groups.get(s.sessionId) ?? []
      if (!at.includes(s.unitKey)) at.push(s.unitKey)
      groups.set(s.sessionId, at)
    }
    for (const [fromSessionId, unitKeys] of groups) {
      const win = board.windows.find((w) =>
        w.weekends.some((x) => x.sessionId === fromSessionId)
      )
      if (!win) continue
      let best: PlannerWeekend | null = null
      let bestRatio = Infinity
      for (const w of win.weekends) {
        if (w.sessionId === fromSessionId) continue
        // No gym time is no weekend: an unchosen one reads zero, so this is the
        // "chosen, with room" test in one number.
        if (w.capacityGames <= 0) continue
        const here = weekendDemand(board.units, w, gone.assignment[w.sessionId] ?? [])
        const need = weekendDemand(board.units, w, unitKeys)
        if (need <= 0 || here + need > w.capacityGames) continue
        const ratio = (here + need) / w.capacityGames
        if (ratio < bestRatio) {
          best = w
          bestRatio = ratio
        }
      }
      if (best) return { fromSessionId, unitKeys, to: best }
    }
    return null
  }, [board, stranded, gone.assignment])

  const shown: ShownPlacements = useMemo(
    () =>
      board
        ? // The packer computes on the calendar MINUS the placements whose
          // building this plan no longer has, so a game in a gym we lost reads
          // as needing one instead of as settled.
          packShownPlacements(board, gone.assignment, gone.venues)
        : { venues: {}, reasons: {}, homes: {}, blocks: [] },
    [board, gone]
  )
  /** The same walk over the calendar the league KEPT, so the strip's kept side
   *  names the buildings that were saved rather than the ones on trial. */
  const keptShown: ShownPlacements = useMemo(
    () =>
      board && kept
        ? packShownPlacements(board, kept, keptVenues)
        : { venues: {}, reasons: {}, homes: {}, blocks: [] },
    [board, kept, keptVenues]
  )

  /**
   * The suggestion rail, worked out from the board ON SCREEN. It used to be
   * whatever the server last said, which went stale the moment anything moved;
   * suggestFor is pure and reads the same gyms both views draw, so a move
   * taken from the rail immediately changes what the rail says next.
   */
  const suggestions: PlannerSuggestion[] = useMemo(
    // On the calendar the plan's world can actually hold, so an idea is never
    // about a gym this plan no longer has.
    () => (board ? suggestFor(board, gone.assignment, gone.venues) : []),
    [board, gone]
  )

  /**
   * The gym is the colour, everywhere (owner-approved mock 2026-08-02). ONE
   * mapping for the whole step, from the same two inputs the strip uses, so a
   * building is the same colour on the board, on the strip and in the rail.
   */
  const gyms = useMemo(
    () =>
      planVenueHues(
        venueGrid,
        (board?.windows ?? []).flatMap((win) => win.weekends)
      ),
    [venueGrid, board]
  )
  /** The building the league OWNS (owner ruling 2026-08-03). It fills before
   *  anything is rented, and the legend says so, because "why is that one
   *  always full" is the first question the colours raise. */
  const fillsFirst = useMemo(() => {
    for (const win of board?.windows ?? []) {
      for (const w of win.weekends) {
        const home = w.venues.find((v) => v.role === "home")
        if (home) return home.venueId
      }
    }
    return null
  }, [board])
  /** A gym in the words the columns have room for, by id. */
  const gymShort = useCallback(
    (venueId: string) => gyms.order.find((v) => v.venueId === venueId)?.short ?? "another gym",
    [gyms]
  )

  /* --------------------------- what this rents --------------------------- */

  /** Every weekend of the season, by id. The rentals, the ask sheet and the
   *  tray all have to name a weekend, and none of them holds the columns. */
  const weekendById = useMemo(() => {
    const out = new Map<string, PlannerWeekend>()
    for (const win of board?.windows ?? []) for (const w of win.weekends) out.set(w.sessionId, w)
    return out
  }, [board])

  /**
   * The rentals behind the calendar ON SCREEN (owner ruling 2026-08-03), read
   * off the same chronological pass the board draws its sections from, so the
   * blocks, the sections and the ask sheet can never disagree. The planner APIs
   * hand blocks back too; the board deliberately ignores them, because a
   * working copy is not what the server last said.
   */
  /**
   * Billed at what the operator says they RENTED, where that is more than the
   * games needed (owner ruling 2026-08-06, #5). Everything downstream reads this
   * one list — the sections, the weekend fraction, the rail and the ask sheet —
   * so "4 used of 6 rented" is one fact and not four opinions.
   */
  const blocks = useMemo(
    () => withRentedCourts(shown.blocks, courtOverrides),
    [shown.blocks, courtOverrides]
  )
  const ask = useMemo(() => (board ? rentalAsk(board, blocks) : null), [board, blocks])

  /** How the gyms themselves stand, from step 2's own grid: the base every
   *  status reads from, so the board never invents a booking. */
  const bookedStatus = useMemo(() => {
    const out = new Map<string, BlockStatus>()
    for (const row of venueGrid?.venues ?? []) {
      for (const cell of row.cells) {
        if (!cell.sessionId || !cell.bookingStatus) continue
        out.set(blockKey(cell.sessionId, row.venueId), cell.bookingStatus)
      }
    }
    return out
  }, [venueGrid])

  /** Where one rental stands: what the working copy decided, else what the gym
   *  itself says, else booked (a gym on a weekend nobody has questioned). */
  const statusOf = useCallback(
    (sessionId: string, venueId: string): BlockStatus =>
      blockStatus[blockKey(sessionId, venueId)] ??
      bookedStatus.get(blockKey(sessionId, venueId)) ??
      "confirmed",
    [blockStatus, bookedStatus]
  )

  /** The blocks as the ask sheet reads them out: weekend, building, standing. */
  const blockRows = useMemo(
    () =>
      blocks.map((b, i) => ({
        key: `${b.sessionId}-${b.venueId ?? "none"}-${i}`,
        weekend: weekendById.get(b.sessionId)?.label ?? "",
        gym: b.venueId ? gymShort(b.venueId) : null,
        status: b.venueId ? statusOf(b.sessionId, b.venueId) : ("needed" as BlockStatus),
      })),
    [blocks, weekendById, gymShort, statusOf]
  )

  const blockCounts = useMemo(
    () => ({
      total: blockRows.length,
      confirmed: blockRows.filter((b) => b.status === "confirmed").length,
      assumed: blockRows.filter((b) => b.status === "assumed").length,
      needed: blockRows.filter((b) => b.status === "needed").length,
    }),
    [blockRows]
  )

  /**
   * Why each grade is where it is, with the ONE correction the working copy
   * owes the operator: a gym the POOL answered is not "your pick". The venues
   * map is the only channel a placement travels on, so the pass calls every
   * entry decided; the status map is what knows the difference.
   */
  const whyIn = useMemo(() => {
    if (Object.keys(blockStatus).length === 0) return shown.reasons
    const out: Record<string, Record<string, PlacementReason>> = {}
    for (const [sessionId, byUnit] of Object.entries(shown.reasons)) {
      const next: Record<string, PlacementReason> = { ...byUnit }
      for (const [key, reason] of Object.entries(byUnit)) {
        const venueId = venues[sessionId]?.[key]
        if (!venueId || reason !== "decided") continue
        if (blockStatus[blockKey(sessionId, venueId)] === "assumed") next[key] = "rented"
      }
      out[sessionId] = next
    }
    return out
  }, [shown.reasons, venues, blockStatus])

  /**
   * The pool, as something you can pick up: the gyms this season RENTS, with
   * the courts they have and the weekends they are free on. Availability is
   * counted off the planner's own weekends, which is exactly the set a drop can
   * land on, so the tray never offers a weekend the board would refuse.
   */
  const trayGyms: TrayGym[] = useMemo(() => {
    const seen = new Map<string, { courts: number; weekends: number }>()
    for (const w of weekendById.values()) {
      for (const v of w.venues) {
        // EVERY GYM, THE ONE THE LEAGUE OWNS INCLUDED (owner ruling 2026-08-06,
        // #1). The tray listed only the pool because only a rental could be
        // placed; the merged list is also the colour key, and a key that skips
        // the home gym is a key with a hole where the busiest building goes.
        const at = seen.get(v.venueId) ?? { courts: 0, weekends: 0 }
        at.courts = Math.max(at.courts, v.courts ?? v.courtDays ?? 0)
        at.weekends += 1
        seen.set(v.venueId, at)
      }
    }
    /**
     * A POOL GYM NOBODY HAS ASKED ANYTHING (owner ruling 2026-08-04, the Haber
     * case). It is on the season and it is attached to no weekend, so the
     * planner's own weekends never mention it and it used to be invisible here.
     *
     * Invisible is the wrong answer: the league added that gym on purpose, and
     * a tray that hides it reads as "we have one gym to rent" when the truth is
     * "we have two and we have not phoned one of them". It shows, with zero
     * weekends, and the tray draws that as unpickable and says why.
     */
    const onSeason = new Map((venueGrid?.venues ?? []).map((v) => [v.venueId, v]))
    return gyms.order
      .filter((g) => seen.has(g.venueId) || onSeason.has(g.venueId))
      .map((g) => {
        const row = onSeason.get(g.venueId)
        return {
          venueId: g.venueId,
          name: g.name,
          short: g.short,
          courts:
            seen.get(g.venueId)?.courts ?? row?.courtsAvailable ?? row?.courtCount ?? 0,
          weekends: seen.get(g.venueId)?.weekends ?? 0,
          role: (g.venueId === fillsFirst || row?.role === "home" ? "home" : "pool") as
            | "home"
            | "pool",
        }
      })
  }, [gyms.order, weekendById, venueGrid, fillsFirst])

  /**
   * The gyms in the roster that no weekend of this plan has (owner ruling
   * 2026-08-05, #1). The gym list tags them off this one set, and the board reads
   * the same set, so the two can never disagree about which gym is the spare.
   */
  const backupGyms = useMemo(
    () => new Set(trayGyms.filter((g) => g.role === "pool" && g.weekends === 0).map((g) => g.venueId)),
    [trayGyms]
  )

  /* ------------------------- plans as documents ------------------------- */

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId])
  const activePlan = useMemo(() => plans.find((p) => p.isActive) ?? null, [plans])

  /**
   * Where the plan on screen and the season have parted company: the gyms, the
   * courts, the hours, the fill order and the estimates it was saved under,
   * against the ones the season holds now. Empty when they still agree, which
   * is the ordinary case and says nothing.
   */
  const drift = useMemo(
    () =>
      selectedPlan && planSettings && liveState ? planDrift(planSettings.state, liveState) : [],
    [selectedPlan, planSettings, liveState]
  )
  /** A plan saved before plans remembered their world. Not drift: an absence,
   *  and the board says so once, quietly, instead of pretending to compare. */
  const worldUnknown = Boolean(selectedPlan) && planSettings === null

  /**
   * THE GYMS A WEEKEND COULD ACTUALLY TAKE, for the prompt a stranded block
   * asks (owner ruling 2026-08-04, "drops never reject"). The pool gyms the
   * season holds on THAT weekend, and nothing else: a gym nobody has attached
   * is not an option, it is a phone call.
   */
  const poolOn = useCallback(
    (sessionId: string) => {
      const weekend = weekendById.get(sessionId)
      if (!weekend) return []
      return weekend.venues
        .filter((v) => v.role === "pool" && v.capacityGames > 0)
        .map((v) => ({ venueId: v.venueId, short: venueShortName(v.name) }))
    },
    [weekendById]
  )

  /**
   * WHERE A GRADE COULD GO ON ONE WEEKEND (owner ruling 2026-08-05, #2). The card
   * knows what each of its buildings is holding; this answers what each of them
   * COULD hold, in the plan's own world, so the ⇄ is offered wherever a move is
   * really possible — the home gym with room, a pool building we can rent more of,
   * or a backup gym the operator is willing to assert.
   */
  const roomsOn = useCallback(
    (sessionId: string, used: Record<string, number>): BuildingRoom[] => {
      const weekend = weekendById.get(sessionId)
      return board && weekend ? weekendRooms(board, weekend, used, courtOverrides) : []
    },
    [board, weekendById, courtOverrides]
  )

  /**
   * THE HOURS ONE GYM RUNS ON ONE DATE, and whether they are that date's own
   * (owner ruling 2026-08-06, #5). Read off the board's world, so the ⋯ menu
   * opens on exactly the window every capacity below it was computed from.
   */
  const hoursOn = useCallback(
    (sessionId: string, venueId: string) => {
      const weekend = weekendById.get(sessionId)
      const base =
        board && weekend
          ? weekendGymHours(board, weekend, venueId)
          : { startTime: "09:00", endTime: "21:00" }
      return { ...base, custom: Boolean(hourOverrides[courtCapKey(sessionId, venueId)]) }
    },
    [board, weekendById, hourOverrides]
  )

  const unitByKey = useMemo(() => new Map((board?.units ?? []).map((u) => [u.key, u])), [board])

  /**
   * The grades the filter strip offers, and the picked set as the board reads
   * it. Null while nothing is picked, which is the ordinary case: every surface
   * downstream treats null as "the filter is off" and draws itself normally.
   */
  const filterUnits = useMemo(
    () => (board?.units ?? []).filter((u) => u.teams > 0),
    [board]
  )
  const highlight = useMemo(
    () => (gradeFilter.length === 0 ? null : new Set(gradeFilter)),
    [gradeFilter]
  )
  /** The same, for the buildings (owner ruling 2026-08-06, #4). Null while the
   *  gym lens is off, which every surface downstream reads as "draw normally". */
  const gymHighlight = useMemo(
    () => (gymFilter.length === 0 ? null : new Set(gymFilter)),
    [gymFilter]
  )
  /** One grade in or out of the highlight. */
  const toggleGrade = useCallback(
    (key: string) =>
      setGradeFilter((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      ),
    []
  )
  /** One gym in or out of the lens. */
  const toggleGym = useCallback(
    (venueId: string) =>
      setGymFilter((prev) =>
        prev.includes(venueId) ? prev.filter((v) => v !== venueId) : [...prev, venueId]
      ),
    []
  )
  /** Both lenses off, in one verb: the Clear the strip offers, and what Escape
   *  does from anywhere. */
  const clearLenses = useCallback(() => {
    setGradeFilter([])
    setGymFilter([])
  }, [])
  /** The gyms the lens is on, in the operator's own words, for the shared
   *  "showing" line. */
  const lensGyms = useMemo(
    () => trayGyms.filter((g) => gymFilter.includes(g.venueId)).map((g) => g.name),
    [trayGyms, gymFilter]
  )

  /**
   * THE GYMS THE OPERATOR PUT ON A DATE THAT HAS NOTHING IN IT (owner ruling
   * 2026-08-06, #2): sessionId → venueIds, whether the gym had to be asserted or
   * was already on the weekend with no games in it. The card draws a container
   * for each one it is not already drawing a section for.
   */
  const placedGyms = useMemo(() => {
    const out = new Map<string, Set<string>>()
    for (const [sessionId, venueIds] of Object.entries(emptyGyms)) {
      if ((venueIds ?? []).length > 0) out.set(sessionId, new Set(venueIds))
    }
    return out
  }, [emptyGyms])

  const summary = useMemo(
    // A grade on a weekend this plan stopped running is NOT placed, and the
    // header pill has to say so rather than counting it as settled.
    () => (board ? planSummary(board, gone.assignment) : null),
    [board, gone]
  )

  /**
   * COMPARE IS GONE FROM THE BOARD (owner ruling 2026-08-06, #6). It was a lens
   * that repainted every chip against the kept calendar, and the strip already
   * shows the two calendars whole, side by side, which is the reading anybody
   * actually does. diffAssignments and the rest of the pure diff are untouched in
   * the core: the strip and the API still use them.
   */

  /**
   * THE WHOLE SEASON, MONTH BY MONTH (owner ruling 2026-08-06, slice B2). Every
   * Saturday the season spans has a place on the board: the ones this plan uses
   * as cards, the ones it does not as thin ghost rows.
   *
   * Two sources, one answer. The plan's own weekends give the cards and the
   * ghosts for dates the season already has a session for; step 2's grid gives
   * the Saturdays no session has ever claimed, which is the half that used to be
   * hidden behind "Add a weekend". They can never disagree about which dates
   * exist, because the grid enumerates the season's span and the merge keys on
   * the date itself.
   */
  const columns: BoardColumn[] = useMemo(
    () =>
      board
        ? boardColumns(
            board,
            venueGrid?.weekends ?? [],
            (sessionId) =>
              (assignment[sessionId] ?? []).length > 0 ||
              (emptyGyms[sessionId] ?? []).length > 0
          )
        : [],
    [board, venueGrid, assignment, emptyGyms]
  )

  /**
   * WHAT A DATE WITH NOTHING ON IT COULD HOLD (owner ruling 2026-08-06, slice
   * B2, under the one capacity rule of #3). No gym is attached to a ghost, so
   * every gym in the plan's roster reads as a backup — and a backup is a real
   * destination, because taking one IS the operator asserting they have it.
   *
   * The same weekendRooms arithmetic every other drop on this board is measured
   * against, so a ghost can never be offered a load a card would refuse. Named
   * with a gym it answers for THAT building, which is what a gym dropped from
   * the gym list is measured against; without one it answers for the date.
   */
  const ghostRoom = useCallback(
    (key: string, dayCount: number, venueId?: string) => {
      if (!board) return 0
      const rooms = weekendRooms(board, bareWeekend(key, dayCount), {}, courtOverrides)
      return venueId
        ? (rooms.find((r) => r.venueId === venueId)?.freeGames ?? 0)
        : rooms.reduce((sum, r) => sum + r.freeGames, 0)
    },
    [board, courtOverrides]
  )

  return {
    seasonId,
    /* the world, and the plan's own copy of it */
    state,
    setState,
    liveState,
    setLiveState,
    planSettings,
    setPlanSettings,
    onPlanWorld,
    setOnPlanWorld,
    board,
    worldUsable,
    calendarEmpty,
    load,
    /* the calendar on the board */
    assignment,
    setAssignment,
    venues,
    setVenues,
    undoStack,
    setUndoStack,
    blockStatus,
    setBlockStatus,
    courtOverrides,
    setCourtOverrides,
    hourOverrides,
    setHourOverrides,
    assertedGyms,
    setAssertedGyms,
    emptyGyms,
    setEmptyGyms,
    placedGyms,
    dirty,
    setDirty,
    fromLever,
    setFromLever,
    /* what the operator is holding, and where the eye was just sent */
    armed,
    setArmed,
    armedVenue,
    setArmedVenue,
    armedBlock,
    setArmedBlock,
    armedSection,
    setArmedSection,
    dragging,
    setDragging,
    /* the two lenses over the board, which change nothing under them */
    gradeFilter,
    setGradeFilter,
    gymFilter,
    setGymFilter,
    filterUnits,
    highlight,
    gymHighlight,
    lensGyms,
    toggleGrade,
    toggleGym,
    clearLenses,
    pendingDrop,
    setPendingDrop,
    zoomSession,
    setZoomSession,
    flashSessions,
    setFlashSessions,
    flashUnits,
    setFlashUnits,
    ghosts,
    setGhosts,
    boardScroll,
    /* the screen's own switches */
    locked,
    busy,
    setBusy,
    notice,
    setNotice,
    error,
    setError,
    view,
    setView,
    side,
    setSide,
    naming,
    setNaming,
    /* the calendar the league kept, which the strip reads beside the proposal */
    kept,
    setKept,
    keptVenues,
    setKeptVenues,
    keptShown,
    /* the plan document the board is a copy of */
    session,
    plans,
    planId,
    planDoc,
    planVersion,
    drawnPlan,
    skipRedraw,
    selectedPlan,
    activePlan,
    drift,
    worldUnknown,
    /* one derivation each, for every number on the screen */
    gone,
    stranded,
    strandedAt,
    strandedMove,
    shown,
    suggestions,
    gyms,
    fillsFirst,
    gymShort,
    weekendById,
    unitByKey,
    blocks,
    ask,
    statusOf,
    blockRows,
    blockCounts,
    whyIn,
    trayGyms,
    backupGyms,
    venueGrid,
    setVenueGrid,
    poolOn,
    roomsOn,
    hoursOn,
    summary,
    columns,
    ghostRoom,
  }
}

/** The whole working copy, as the verbs and the plan document see it. */
export type BoardModel = ReturnType<typeof useBoardState>
