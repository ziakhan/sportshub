"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  applyCourtCaps,
  currentAssignment,
  diffAssignments,
  packShownPlacements,
  planSummary,
  rentalAsk,
  suggestFor,
  weekendDemand,
  weekendShortDays,
  type HoursPreview,
  type PlacementReason,
  type PlannerState,
  type PlannerSuggestion,
  type PlannerWeekend,
  type ShownPlacements,
} from "@/lib/scheduler/planner-core"
import { planDrift, type PlanSettings } from "@/lib/scheduler/plan-documents"
import {
  strandedPlacements,
  weekendRooms,
  withAssertedGyms,
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
  compareLine,
  savedVenueMap,
  type BoardSnapshot,
  type HoursChip,
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
   * "I DON'T HAVE THIS", in the working copy (owner ruling 2026-08-04):
   * "<sessionId>|<venueId>" → the courts that gym can actually give that
   * weekend. Step 2 knows how many courts a building has; only the operator
   * knows how many of them the gym offered for one Saturday in November.
   *
   * The board computes on a state with these applied, so a correction repacks
   * everything downstream of it and nothing has to know it happened. They are
   * written onto the weekend's own attachment on save, and only for the plan
   * the season actually runs.
   */
  const [courtCaps, setCourtCaps] = useState<Record<string, number>>({})
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
  /** Which way rentals get filled: the pool answers, or the operator places.
   *  Two modes, said out loud, because "who chose this gym" is the question an
   *  operator has about every rented weekend. */
  const [assignMode, setAssignMode] = useState<"solve" | "place">("solve")
  /** A gym picked up from the tray, waiting for a weekend. The touch half of
   *  the drag, and the same arm-then-tap pattern the grade chips use. */
  const [armedVenue, setArmedVenue] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState<Armed | null>(null)
  const [showRules, setShowRules] = useState(false)
  /** The hours group: which chip is open, and what the server says it does. */
  const [showHours, setShowHours] = useState(false)
  const [hoursChip, setHoursChip] = useState<HoursChip | null>(null)
  const [hoursPreview, setHoursPreview] = useState<HoursPreview | null>(null)
  const [hoursError, setHoursError] = useState<string | null>(null)
  /** The calendar as SAVED, captured before any proposal touches the board.
   *  Null until the league has kept one. This is what compare mode measures
   *  against, so it must never be the working assignment. */
  const [kept, setKept] = useState<Record<string, string[]> | null>(null)
  /** The gyms that kept calendar was saved with, so the strip can show the
   *  buildings you kept rather than the ones you are trying out. */
  const [keptVenues, setKeptVenues] = useState<Record<string, Record<string, string>>>({})
  const [comparing, setComparing] = useState(false)
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
    setCourtCaps({})
    setAssertedGyms({})
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
  // re-ruled the same day, #2).
  useEffect(() => {
    const anythingArmed = Boolean(armed || armedVenue || armedBlock || armedSection)
    const anythingMarked = ghosts.length > 0 || flashUnits.length > 0
    if (!anythingArmed && !anythingMarked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setArmed(null)
      setArmedVenue(null)
      setArmedBlock(null)
      setArmedSection(null)
      setFlashUnits([])
      setGhosts([])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [armed, armedVenue, armedBlock, armedSection, ghosts, flashUnits])

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
  const board = useMemo(
    () => (state ? applyCourtCaps(withAssertedGyms(state, assertedGyms), courtCaps) : null),
    [state, assertedGyms, courtCaps]
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
  const blocks = shown.blocks
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
        if (v.role !== "pool") continue
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
    const poolOnSeason = new Set(
      (venueGrid?.venues ?? []).filter((v) => v.role === "pool").map((v) => v.venueId)
    )
    const courtsOnSeason = new Map(
      (venueGrid?.venues ?? []).map((v) => [v.venueId, v.courtsAvailable ?? v.courtCount ?? 0])
    )
    return gyms.order
      .filter((g) => seen.has(g.venueId) || poolOnSeason.has(g.venueId))
      .map((g) => ({
        venueId: g.venueId,
        name: g.name,
        short: g.short,
        courts: seen.get(g.venueId)?.courts ?? courtsOnSeason.get(g.venueId) ?? 0,
        weekends: seen.get(g.venueId)?.weekends ?? 0,
      }))
  }, [gyms.order, weekendById, venueGrid])

  /**
   * The gyms in the roster that no weekend of this plan has (owner ruling
   * 2026-08-05, #1). The tray tags them and so does the colour key above the
   * board, off this one set, so the two can never disagree about which gym is
   * the spare.
   */
  const backupGyms = useMemo(
    () => new Set(trayGyms.filter((g) => g.weekends === 0).map((g) => g.venueId)),
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
      return board && weekend ? weekendRooms(board, weekend, used, courtCaps) : []
    },
    [board, weekendById, courtCaps]
  )

  const unitByKey = useMemo(() => new Map((board?.units ?? []).map((u) => [u.key, u])), [board])

  const summary = useMemo(
    // A grade on a weekend this plan stopped running is NOT placed, and the
    // header pill has to say so rather than counting it as settled.
    () => (board ? planSummary(board, gone.assignment) : null),
    [board, gone]
  )

  /** Compare mode is a lens, not a freeze: this recomputes on every drag, tap
   *  and lever, so the diff always describes the board on screen. A board
   *  lens, deliberately: the strip shows the two calendars whole instead. */
  const compare = useMemo(() => {
    if (view !== "board" || !comparing || !board || !kept) return null
    const diff = diffAssignments(board, kept, assignment)
    const byWeekend = new Map(diff.weekends.map((w) => [w.sessionId, w]))
    const days = new Map<string, string>()
    for (const win of board.windows)
      for (const w of win.weekends) days.set(w.sessionId, weekendShortDays(w.label))
    // For a grade that landed on a new weekend: which weekend the kept
    // calendar plays it on, keyed the way the chip asks for it.
    const keptOn = new Map<string, string>()
    for (const m of diff.summary.moved) {
      keptOn.set(`${m.toSessionId}|${m.unitKey}`, days.get(m.fromSessionId) ?? "")
    }
    return { line: compareLine(diff.summary), byWeekend, keptOn }
  }, [view, comparing, board, kept, assignment])

  /**
   * SATURDAYS THIS SEASON IS NOT USING, month by month (owner ruling
   * 2026-08-04). Step 2's grid already enumerates every Saturday in the
   * season's span and marks the ones no session has claimed; a month column
   * offers exactly those, so the two screens can never disagree about which
   * weekends exist.
   */
  const addable = useMemo(() => {
    const out = new Map<string, Array<{ satDateISO: string; label: string }>>()
    if (!board || !venueGrid) return out
    const monthOf = (iso: string) => iso.slice(0, 7)
    const free = (venueGrid.weekends ?? []).filter((w) => !w.sessionId && w.satDateISO)
    for (const win of board.windows) {
      const months = new Set(win.weekends.map((w) => monthOf(w.dateISO)))
      out.set(
        win.label,
        free
          .filter((w) => months.has(monthOf(w.satDateISO as string)))
          .map((w) => ({ satDateISO: w.satDateISO as string, label: w.label }))
      )
    }
    return out
  }, [board, venueGrid])

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
    courtCaps,
    setCourtCaps,
    assertedGyms,
    setAssertedGyms,
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
    assignMode,
    setAssignMode,
    locked,
    busy,
    setBusy,
    notice,
    setNotice,
    error,
    setError,
    showRules,
    setShowRules,
    showHours,
    setShowHours,
    hoursChip,
    setHoursChip,
    hoursPreview,
    setHoursPreview,
    hoursError,
    setHoursError,
    view,
    setView,
    side,
    setSide,
    comparing,
    setComparing,
    naming,
    setNaming,
    /* the calendar the league kept, for compare */
    kept,
    setKept,
    keptVenues,
    setKeptVenues,
    keptShown,
    compare,
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
    summary,
    addable,
  }
}

/** The whole working copy, as the verbs and the plan document see it. */
export type BoardModel = ReturnType<typeof useBoardState>
