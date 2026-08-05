"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui"
import {
  applyCourtCaps,
  assignBlocksFromPool,
  assignmentWithMove,
  courtCapKey,
  courtsCapacityAt,
  courtsNeeded,
  courtsWiredAt,
  currentAssignment,
  diffAssignments,
  gradeGymStrip,
  gradeHomeGym,
  gradeLine,
  gymCountsSentence,
  heldBackPhrase,
  hoursPreviewSentence,
  lightestWeekendIn,
  packPlanVenues,
  packShownPlacements,
  packedWeekendLoad,
  planCost,
  planPrice,
  planSummary,
  proposePlan,
  railSuggestions,
  rentalAsk,
  resolveWeekendGyms,
  shiftClock,
  splitAcrossGyms,
  splitAcrossWeekends,
  splitPriceSentence,
  suggestFor,
  venuesWithoutUnit,
  weekendDays,
  weekendDemand,
  weekendLoad,
  weekendShortDays,
  weekendStory,
  type AssignmentDiffSummary,
  type GradeStripCell,
  type HoursPreview,
  type PlacementReason,
  type PlannerLever,
  type PlannerState,
  type PlannerSuggestion,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
  type PlanSummary,
  type RentalBlock,
  type ShownPlacements,
  type SuggestionMove,
  type WeekendDiff,
} from "@/lib/scheduler/planner-core"
import {
  activateConfirmText,
  isReferencePlan,
  PLAN_COPY,
  planDrift,
  planStateLine,
  suggestPlanName,
  type PlanDocument,
  type PlanRow,
  type PlanSettings,
} from "@/lib/scheduler/plan-documents"
import {
  planStateFrom,
  solvableState,
  strandedPlacements,
  strandedSentence,
  weekendRooms,
  withAssertedGyms,
  withAssertedGymsInWorld,
  worldFromState,
  type BuildingRoom,
  type StrandedPlacement,
} from "@/lib/scheduler/plan-world"
import type { VenueGrid } from "@/lib/seasons/venue-grid"
import { venueShortName, type StripVenue } from "@/lib/seasons/venue-strip"
import {
  CARD_TONE,
  FRACTION_FOR_TONE,
  PILL_TONE,
  fractionTone,
  hueFor,
  planVenueHues,
  type Armed,
  type ArmedBlock,
  type ArmedSection,
  type GhostChip,
} from "./plan-shared"
import {
  AskSheet,
  BlockStatusMark,
  BlockSummary,
  CountChip,
  CourtCorrection,
  Fraction,
  GLYPH_LEGEND,
  REASON_GLYPH,
  ReasonGlyph,
  SplitMenu,
  VenueTray,
  WhyPopover,
  type BlockStatus,
  type SplitAxis,
  type TrayGym,
} from "./plan-ui"
import { PlanSaveControls } from "./plan-picker"
import { PlanChooser, PlanEmptyState, usePlanSession } from "./plan-session"
import { Segmented, StripView, type StripSide } from "./season-strip"
import type { PlanHeaderInfo } from "./teams-step"

/**
 * Step 3, the calendar (owner-approved mock, 2026-08-02). The screen the
 * whole flow exists for: the operator's own hand-drawn season calendar,
 * computed in a second.
 *
 * The rule the screen is built around: it OPENS on the answer. A season with
 * nothing planned yet asks the solver for the balanced plan before first
 * paint, so nobody has to press a button to see a calendar. That opening
 * plan is unsaved and says so; a season that already has one opens on it.
 *
 * Grouping rules are league truths, not preferences, so they are not a step.
 * The three levers live behind a quiet link for the operator who cares.
 *
 * Two views of the SAME calendar (owner 2026-08-02): the board, which is where
 * a month gets rearranged, and the season strip, which reads a grade's whole
 * season left to right and names the gyms each weekend. This component owns
 * every piece of state; the views only draw it.
 *
 * PLANS AS DOCUMENTS (owner 2026-08-02: "we can have multiple plans, we can
 * save them, we can name them ... when I do it fresh it should be our own").
 * The board is a working copy of ONE named plan, chosen in the picker. Saving
 * writes to that plan and nowhere else, which is why the direct planner/apply
 * call is gone: a plan the season runs is written through on save, a plan it
 * does not run waits for "Use for the season", and the league's own imported
 * calendar is read only so there is always something to compare against.
 *
 * A PLAN REMEMBERS ITS WORLD (owner 2026-08-02: "a new plan also could have
 * different venues. It could have different settings, so how are you going to
 * save it and how do you remember? It could be a different team combination").
 * Every plan carries the gyms, hours, fill order and team estimates it was
 * drawn under, so opening one puts the board back in THAT world: the fractions,
 * the meters and the ideas are the ones the operator saw when they saved it,
 * not this month's. Where the season has since moved on, the board says so
 * above the calendar instead of quietly re-drawing the plan under new numbers.
 *
 * Two things follow from that, and both are deliberate:
 *  - the levers and the hours chips are DISABLED on a plan drawn in its own
 *    saved world. They solve against the season as it stands, so their answer
 *    would be in a different world from the board it landed on.
 *  - activating still applies the CALENDAR only. The season keeps its own
 *    gyms, hours and estimates, and the confirmation says so out loud.
 */

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

/** Strings with real apostrophes live here as JS expressions, so nothing
 *  needs escaping and the copy stays readable. */
const COPY = {
  opened:
    "We placed every grade for you, balanced across your gym time. Drag anything you'd do differently, then keep it.",
  rules:
    "Grouping is automatic because these are league truths, not choices: oldest grades together, youngest together, the middle split by size, the two biggest grades kept apart, and each grade leaning to the gym it usually plays in. These three only change how tightly the weekends pack.",
  oneWeekendPerMonth:
    "Every grade gets one weekend a month, so move it to another weekend in the same month.",
  compareSame: "This is the kept calendar, unchanged.",
  compareLegend:
    "Green agrees with what you kept, amber moved to another weekend that month, and a dashed chip is where the kept calendar had that grade.",
  hours:
    "These change WHEN your gyms are open, not who plays which weekend. One hour, every weekend, every gym. Nothing is booked until you apply it.",
  /** The two ways a weekend that needs a rented gym gets one (owner ruling
   *  2026-08-03). Both act on the calendar in front of you and neither books
   *  anything. */
  assignSolve: "We take the cheapest gym in your pool that can hold the games. Nothing is booked.",
  assignPlace: "Drag a gym onto a weekend that needs one, or tap the gym and then tap the weekend.",
  nothingToFill: "Every weekend already has a building. There is nothing to fill.",
  noPool: "Your pool has no gym free on those weekends. Turn one on for them back in step 2.",
  /**
   * THE EMPTY BOARD LEADS WITH ONE BUTTON (owner ruling 2026-08-05, #1). A plan
   * that has its weekends and its gym time but no calendar yet is one tap from
   * the answer, and that tap must not be hidden behind "adjust grouping rules".
   */
  drawTitle: "Draw the calendar",
  drawHint:
    "The planner fills your chosen weekends from your gyms. Nothing is booked or saved until you say so.",
  /** The same board with no world to solve in. The fix is a step back, not a
   *  button here, so the hero points at step 2 instead of pretending. */
  worldFirst: "Pick your weekends and gym time in step 2 first",
  worldFirstHint:
    "A plan runs the weekends you choose, in the gyms you give it. Choose those and the calendar draws itself here.",
  worldFirstLink: "Go to step 2",
  /** Said once the solver has answered, whichever button asked it. */
  drawn:
    "Here is the calendar. Every grade is on one of the weekends you chose, in the gyms this plan has. Nothing is saved until you save it.",
  redrawn:
    "Redrawn from your weekends and your gyms. The plan you saved has not changed until you save this.",
  resolved:
    "Redrawn in this plan's world, so nothing is left in a gym this plan does not have. Nothing is saved until you save it.",
  /** Before a redraw throws away hand work. */
  redrawConfirm:
    "Redraw replaces the calendar on the board. Your saved plan is untouched until you save.",
  redraw: "Redraw calendar",
}

const LEVERS: Array<{ lever: PlannerLever; label: string; note: string }> = [
  {
    lever: "balance",
    label: "Even weekends",
    note: "Proposed: the flattest weekends. Keep it, or drag first.",
  },
  {
    lever: "compact",
    label: "Fewest weekends",
    note: "Proposed: as few weekends in use as your gyms allow.",
  },
  {
    lever: "spread",
    label: "Use every weekend",
    note: "Proposed: every weekend of the season in use.",
  },
  {
    lever: "one-gym",
    label: "Pack one gym",
    note: "Proposed: every weekend inside one building, even where that makes a weekend heavier.",
  },
]

/** Hours, not grouping (owner 2026-08-02). Each chip moves the day window an
 *  hour and says what that does to this plan before anything is booked. */
interface HoursChip {
  key: string
  label: string
  hint: string
  deltaStartMinutes: number
  deltaEndMinutes: number
}

const HOURS_CHIPS: HoursChip[] = [
  {
    key: "start-early",
    label: "Start early",
    hint: "Every gym opens an hour earlier",
    deltaStartMinutes: -60,
    deltaEndMinutes: 0,
  },
  {
    key: "start-late",
    label: "Start late",
    hint: "Every gym opens an hour later",
    deltaStartMinutes: 60,
    deltaEndMinutes: 0,
  },
  {
    key: "finish-early",
    label: "Finish early",
    hint: "Every gym closes an hour earlier",
    deltaStartMinutes: 0,
    deltaEndMinutes: -60,
  },
]

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Courts in a phrase, because a rental is quoted in them. */
const courtsWord = (n: number) => plural(n, "court", "courts")

/** Things in a sentence: "a", "a and b", "a, b and c". */
function nameList(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/** How many boards back an operator can step. Ten is more than anybody has
 *  ever wanted, and it costs two small objects a move. */
const UNDO_DEPTH = 10

/** The whole board, as it was before a move: the calendar and the gyms
 *  somebody had decided. Everything else on screen is derived from these two. */
interface BoardSnapshot {
  /** What the step back would put right, in the operator's own words: "move
   *  Grade 8". The Undo button wears it, so nobody has to press it to find
   *  out what it does (owner ruling 2026-08-05). */
  label: string
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  /** Where each rental stood: "<sessionId>|<venueId>" → assumed | confirmed.
   *  Filling the gaps from the pool is one step back, gyms and statuses
   *  together, because those two are one decision. */
  blockStatus: Record<string, BlockStatus>
  /** The courts each gym was giving that weekend, where somebody corrected it
   *  ("<sessionId>|<venueId>" → courts). A correction repacks the whole board,
   *  so undoing one has to put the courts back before anything else. */
  courtCaps: Record<string, number>
  /** The backup gyms the operator had asserted, weekend by weekend (owner ruling
   *  2026-08-05, #1): sessionId → venueIds. Undoing a placement onto a backup gym
   *  has to take the assertion back with it, or the board would keep computing on
   *  gym time nobody claimed. */
  assertedGyms: Record<string, string[]>
  /** Whether the plan had unsaved changes at that point, so undoing back to
   *  the saved calendar puts the Keep button back to sleep. */
  dirty: boolean
}

/** One rental, keyed the way the working copy remembers it. */
const blockKey = (sessionId: string, venueId: string) => `${sessionId}|${venueId}`

/**
 * WHAT SOMEBODY IS DRAGGING. Three things travel on this board, all on the same
 * one-line JSON payload: a grade chip, a gym out of the tray, and — since the
 * 2026-08-05 section ruling — a whole gym section with every grade in it.
 */
type DragPayload =
  | {
      unitKey?: string
      fromSessionId?: string | null
      venueId?: string
      section?: boolean
      sessionId?: string
      unitKeys?: string[]
      window?: string
    }
  | null

/** One shared empty set, so a weekend with nothing stranded does not hand a new
 *  object down on every repaint. */
const EMPTY_KEYS: Set<string> = new Set()

/** The same, for a weekend nobody has just moved anything off. */
const EMPTY_GHOSTS: GhostChip[] = []

/** Which building each grade plays in, as the plan has it SAVED: sessionId →
 *  (unit key → venueId). The board carries this next to the assignment and
 *  hands it back on Apply, so a kept calendar keeps its gyms too. */
function savedVenueMap(state: PlannerState): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const byUnit = w.assignedVenues ?? {}
      if (Object.keys(byUnit).length > 0) out[w.sessionId] = { ...byUnit }
    }
  }
  return out
}

/**
 * A plan's world, back in the shape the board computes on, lives in
 * lib/scheduler/plan-world.ts now (owner ruling 2026-08-05: "a pure
 * planStateFrom(plan) ... so all three steps render any plan identically"). The
 * board used to own that reading privately, which is exactly why step 2 and step
 * 3 could disagree about the same plan.
 */

/** The header verdict: the loudest true thing about the plan on screen. */
function headerPill(summary: PlanSummary): { tone: keyof typeof PILL_TONE; text: string } {
  if (summary.over > 0)
    return { tone: "bad", text: `${plural(summary.over, "weekend", "weekends")} over` }
  if (summary.unplaced > 0)
    return { tone: "warn", text: `${plural(summary.unplaced, "grade", "grades")} not placed` }
  if (summary.tight > 0)
    return { tone: "warn", text: `${plural(summary.tight, "weekend", "weekends")} tight` }
  return { tone: "ok", text: "All grades fit" }
}

/**
 * The verdict on the board against the calendar the league kept: how much of
 * their own plan we reproduce, and what we do differently. Zero clauses are
 * left out, because "0 missing" is a sentence nobody needs to read.
 */
function compareLine(summary: AssignmentDiffSummary): string {
  const { placements, agreedCount, moved, missing, extra } = summary
  const parts: string[] = []
  if (moved.length > 0) parts.push(`${moved.length} moved`)
  if (missing.length > 0) parts.push(`${missing.length} missing`)
  if (extra.length > 0) parts.push(`${extra.length} added`)
  if (parts.length === 0 && agreedCount === placements) return COPY.compareSame
  const lead = `Agrees with the kept calendar on ${agreedCount} of ${plural(
    placements,
    "placement",
    "placements"
  )}.`
  return parts.length > 0 ? `${lead} ${parts.join(", ")}.` : lead
}

export function CalendarStep({
  seasonId,
  onLoaded,
  onGoToStep,
}: {
  seasonId: string
  onLoaded?: (info: PlanHeaderInfo) => void
  /** The wizard's own step control, so a board with no world to solve in can
   *  send the operator back to the step that gives it one (owner ruling
   *  2026-08-05, #1). */
  onGoToStep?: (step: number) => void
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

  /** What an hour would do, against the calendar ON SCREEN — proposal
   *  included. Read only: the endpoint rebuilds the plan on a shifted window
   *  in memory and writes nothing. */
  const previewHours = async (chip: HoursChip) => {
    setBusy(`hours:${chip.key}`)
    setHoursError(null)
    setHoursChip(chip)
    setHoursPreview(null)
    const res = await fetch(`/api/seasons/${seasonId}/planner/preview-hours`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deltaStartMinutes: chip.deltaStartMinutes,
        deltaEndMinutes: chip.deltaEndMinutes,
        assignment,
      }),
    }).catch(() => null)
    setBusy(null)
    const data = res?.ok ? await res.json().catch(() => null) : null
    if (!data?.preview) {
      setHoursError("Couldn't work that one out. Try again.")
      return
    }
    setHoursPreview(data.preview as HoursPreview)
  }

  /** Book it for real: the same season-venue hours route step 2 saves with,
   *  once per gym, then the board reloads on the new gym time. */
  const applyHours = async (chip: HoursChip) => {
    const rows = (venueGrid?.venues ?? []).filter((v) => v.simpleOpen && v.simpleClose)
    if (rows.length === 0) {
      setHoursError("Set the hours for your gyms on step 2 first.")
      return
    }
    const writes = rows.map((venue) => ({
      venue,
      start: shiftClock(venue.simpleOpen as string, chip.deltaStartMinutes),
      end: shiftClock(venue.simpleClose as string, chip.deltaEndMinutes),
    }))
    if (writes.some((w) => w.start >= w.end)) {
      setHoursError("That would close a gym before it opens.")
      return
    }
    setBusy("hours-apply")
    setHoursError(null)
    const results = await Promise.all(
      writes.map((w) =>
        fetch(`/api/seasons/${seasonId}/venues/${w.venue.seasonVenueId}/hours`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // The step-2 hours model: one range, Saturday and Sunday alike.
            hours: [
              { dayOfWeek: 6, openTime: w.start, closeTime: w.end },
              { dayOfWeek: 0, openTime: w.start, closeTime: w.end },
            ],
          }),
        })
          .then((res) => res.ok)
          .catch(() => false)
      )
    )
    setBusy(null)
    if (results.some((ok) => !ok)) {
      setHoursError("Some gyms did not take the new hours. Try again.")
      return
    }
    setHoursChip(null)
    setHoursPreview(null)
    await load()
    setNotice(
      writes.length === 1
        ? `${writes[0].venue.name} runs ${writes[0].start} to ${writes[0].end} every weekend now.`
        : `${writes.length} gyms moved their hours. The calendar is back on your real gym time.`
    )
  }

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
   * Open a plan on the board: its calendar, its gyms, its WORLD, and a clean
   * slate. The working copy is thrown away, so an operator who has unsaved work
   * is asked first — unless they asked for this themselves ("Undo changes").
   *
   * A plan the season does not run is drawn under the settings it was SAVED
   * with, so every fraction, meter and idea on screen is the one the operator
   * saw when they saved it. The plan the season runs is drawn under the
   * season's own world, because that world is the one it is running in.
   */
  const openPlan = (plan: PlanDocument) => {
    drawnPlan.current = `${plan.id}|${planVersion}`
    setError(null)
    const settings = plan.settings ?? null
    const ownWorld = Boolean(settings) && !plan.isActive
    setPlanSettings(settings)
    setOnPlanWorld(ownWorld)
    // The plan's own world, read the one shared way. A plan the season RUNS is
    // drawn under the season's world, because that world is the one it runs in.
    const own = ownWorld ? planStateFrom(seasonId, plan) : null
    if (own) setState(own)
    else if (liveState) setState(liveState)
    setAssignment(plan.assignment ?? {})
    setVenues(plan.venues ?? {})
    // A plan document holds a calendar, not bookings: the statuses come back
    // from the gyms themselves (step 2's grid) the moment a plan is opened.
    setBlockStatus({})
    setCourtCaps({})
    // The plan's own world says which gyms it has on which weekends, so nothing
    // is asserted on a board that has only just opened.
    setAssertedGyms({})
    setFlashUnits([])
    setGhosts([])
    setArmedSection(null)
    setUndoStack([])
    setDirty(false)
    setFromLever(false)
    setArmed(null)
    setArmedVenue(null)
    setNaming(null)
    setNotice(
      session.lastCreatedId === plan.id
        ? `${plan.name} is a fresh calendar from the planner. Adjust anything, then use it for the season.`
        : plan.isActive
          ? `${plan.name} is on the board. This is the calendar the season runs.`
          : ownWorld
            ? `${plan.name} is on the board, under the settings it was saved with.`
            : `${plan.name} is on the board.`
    )
  }

  /**
   * OPEN WHAT THE OPERATOR CHOSE, AT THE VERSION IT IS NOW (owner ruling
   * 2026-08-05, #2 and #4). The plan lives above the steps, so the board is a
   * follower: it draws whatever plan the wizard is in, at whatever version the
   * wizard holds, and draws nothing at all until somebody opens one.
   *
   * THE VERSION IS IN THE KEY, and that is the staleness fix. Step 2 writes the
   * plan, the wizard's document changes, and stepping to step 3 redraws the
   * board from THAT document — never from a board state that outlived the plan
   * it was drawn from. A save made here sets skipRedraw, because it has already
   * put its own result on screen.
   */
  useEffect(() => {
    if (!state || !planId || !planDoc || planDoc.id !== planId) return
    const key = `${planId}|${planVersion}`
    if (drawnPlan.current === key) return
    if (skipRedraw.current) {
      skipRedraw.current = false
      drawnPlan.current = key
      return
    }
    openPlan(planDoc)
    // openPlan is recreated every render and is deliberately not a dependency:
    // the ref above is what makes this run exactly once per (plan, version).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, planVersion, planDoc, state])

  /**
   * WHERE "ASSUMED" IS WRITTEN DOWN (the 2026-08-03 wiring decision, and the
   * one place this file writes anything about a booking).
   *
   * A plan document holds a calendar and its gyms; where a BOOKING stands lives
   * on the gym's attachment to the weekend (SeasonSessionDayVenue.bookingStatus),
   * which is step 2's own truth and what the grid reads back. So:
   *
   *  - while an operator is thinking, the statuses live in the working copy;
   *  - they are written through only for the plan the season actually RUNS,
   *    where "this rented weekend is not booked yet" is a true fact about the
   *    season. A plan the season does not run must never mark anybody's gym;
   *  - the grid is re-read afterwards, so the base every status falls back to
   *    is the one the season just recorded.
   */
  const writeBookingStatus = async () => {
    const rows = Object.entries(blockStatus)
    if (rows.length === 0) return
    await Promise.all(
      rows.map(([key, bookingStatus]) => {
        const [sessionId, venueId] = key.split("|")
        if (!sessionId || !venueId) return Promise.resolve(null)
        return fetch(`/api/seasons/${seasonId}/sessions/${sessionId}/venues/${venueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingStatus }),
        }).catch(() => null)
      })
    )
    const res = await fetch(`/api/seasons/${seasonId}/planner/venues`, { cache: "no-store" }).catch(
      () => null
    )
    const data = res?.ok ? await res.json().catch(() => null) : null
    if (data?.grid) setVenueGrid(data.grid)
  }

  /** Back to what the selected plan says, re-read from the server so "undo my
   *  changes" cannot land on a document that moved while the board was open. */
  const revert = async () => {
    if (planId) {
      setBusy(`plan:${planId}`)
      const fresh = await session.refreshDoc()
      setBusy(null)
      if (fresh) openPlan(fresh)
      else setError("Couldn't reopen that plan. Try again.")
      return
    }
    await load()
  }

  /** Save the board as a NEW plan. Nothing is applied: the plan lands beside
   *  the others until somebody uses it for the season — except on a season
   *  that runs nothing yet, where the first plan saved IS the calendar.
   *
   *  The world it records is the season's, read on the server at save time. So
   *  a copy taken while an older plan's world was on the board comes back in
   *  today's world, and the board follows it there rather than keeping numbers
   *  the new plan does not claim. */
  const saveAsNew = async () => {
    const name = (naming ?? "").trim()
    if (!name) return
    setBusy("save-new")
    setError(null)
    // Save the buildings the board is SHOWING — the same chronological pass
    // both views draw from. A preview the operator kept is a promise about
    // where a family drives, so it is written down like a hand pick.
    const res = await fetch(`/api/seasons/${seasonId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        assignment,
        venues: shown.venues,
        source: fromLever ? "proposed" : "manual",
        // A COPY CARRIES THE WORLD IT WAS DRAWN IN (owner ruling 2026-08-05). A
        // plan owns its world, so a copy taken while that world is on the board
        // is a copy of the world too — otherwise the numbers would change under
        // the operator the moment they pressed Save a copy. Any backup gym the
        // operator asserted is part of that world (ruling #1).
        ...(onPlanWorld && planSettings
          ? { settings: { ...planSettings, state: worldWithAssertions() ?? planSettings.state } }
          : {}),
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!res?.ok || !data?.plan) {
      setBusy(null)
      setError(data?.error ?? "That didn't save. Try again.")
      return
    }
    const plan = data.plan as PlanDocument
    const takesOver = !plans.some((p) => p.isActive)
    let fresh: PlannerState | null = null
    if (takesOver) {
      await fetch(`/api/seasons/${seasonId}/plans/${plan.id}/activate`, { method: "POST" }).catch(
        () => null
      )
      // The season runs this calendar now, so where its rentals stand and which
      // gyms gave fewer courts are facts about the season, not only about the
      // board. Both are written through here and nowhere else.
      fresh = await writeSeasonFacts()
      setKept(assignment)
      setKeptVenues(shown.venues)
    }
    const wasOnPlanWorld = onPlanWorld
    // The board is ALREADY drawing this plan, so the wizard is told which plan
    // it is in without the open-on-choice effect redrawing it underneath.
    skipRedraw.current = true
    await session.refresh()
    session.choose(plan.id)
    session.setDoc(plan)
    setPlanSettings(plan.settings ?? null)
    // A copy that carried its world keeps drawing that world; one saved in the
    // season's world goes back to the season's numbers.
    setOnPlanWorld(Boolean(plan.settings) && wasOnPlanWorld && !takesOver)
    // A correction the save just wrote moved the season's own capacity, so THAT
    // is the world the board lands in. Without this the stale live world would
    // quietly put the courts back.
    if (wasOnPlanWorld && !takesOver && plan.settings) {
      const own = planStateFrom(seasonId, plan)
      if (own) setState(own)
    } else if (fresh) setState(fresh)
    else if (liveState) setState(liveState)
    setVenues(shown.venues)
    setBlockStatus({})
    // A plan the season does not run never marked anybody's gym, so its
    // corrections are still only the board's opinion and they stay on it.
    if (takesOver) setCourtCaps({})
    // The new plan's world carries the assertions (or the season does, where this
    // save took over), so the working copy hands them over.
    setAssertedGyms({})
    setUndoStack([])
    setDirty(false)
    setFromLever(false)
    setNaming(null)
    setArmed(null)
    setArmedVenue(null)
    setBusy(null)
    setNotice(
      takesOver
        ? `Saved as ${plan.name}. It is the calendar this season runs.`
        : wasOnPlanWorld
          ? `Saved as ${plan.name}, with the gyms and estimates this plan was drawn in.`
          : `Saved as ${plan.name}. Use it for the season when you are ready.`
    )
  }

  /** Save the board onto the plan it came from. On the plan the season runs,
   *  the server writes it through to the calendar everyone sees. */
  const savePlan = async () => {
    const plan = selectedPlan
    if (!plan) return
    setBusy("save-plan")
    setError(null)
    // A gym the operator asserted travels with the calendar, EXCEPT on the plan
    // the season runs: there it is the season's own attachment, written through
    // by writeSeasonFacts below.
    const assertedWorld = plan.isActive ? null : worldWithAssertions()
    const res = await fetch(`/api/seasons/${seasonId}/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignment,
        venues: shown.venues,
        ...(assertedWorld ? { settings: { state: assertedWorld } } : {}),
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(null)
    if (!res?.ok || !data?.plan) {
      // The reference plan refuses content and says why. Say it in the
      // operator's own words and open the one door that is not shut: a plan
      // of their own, with these changes in it.
      if (res?.status === 409 && data?.error) {
        setNotice(data.error)
        setNaming(suggestPlanName(plans))
        return
      }
      setError(data?.error ?? "That didn't save. Try again.")
      return
    }
    const saved = data.plan as PlanDocument
    const wasOnPlanWorld = onPlanWorld
    // The active plan IS the season's calendar, so where its rentals stand and
    // any gym it corrected are written through with it. A plan the season does
    // not run leaves the gyms alone (writeBookingStatus explains why).
    const fresh = plan.isActive ? await writeSeasonFacts() : null
    /**
     * THE PLAN KEEPS ITS OWN WORLD (owner ruling 2026-08-05). Saving a calendar
     * onto a plan used to re-snapshot the season over the plan's world, which
     * silently moved every number on the board; the server leaves it alone now,
     * so the board stays in the world the operator was working in.
     */
    skipRedraw.current = true
    session.setDoc(saved)
    setPlanSettings(saved.settings ?? null)
    setOnPlanWorld(Boolean(saved.settings) && !plan.isActive)
    if (!plan.isActive && saved.settings) {
      const own = planStateFrom(seasonId, saved)
      if (own) setState(own)
    } else if (fresh) setState(fresh)
    else if (liveState) setState(liveState)
    setVenues(shown.venues)
    setBlockStatus({})
    if (plan.isActive) setCourtCaps({})
    // The assertion is written down now — in the plan's world, or on the season's
    // attachment — so the working copy stops carrying it.
    setAssertedGyms({})
    setUndoStack([])
    setDirty(false)
    setFromLever(false)
    setArmed(null)
    setArmedVenue(null)
    setArmedSection(null)
    await session.refresh()
    if (plan.isActive) {
      // The write-through happened, so this is what every later comparison is
      // against.
      setKept(assignment)
      setKeptVenues(shown.venues)
    }
    setNotice(
      plan.isActive
        ? `Saved to ${plan.name}. Everything after this step follows this calendar.`
        : wasOnPlanWorld
          ? `Saved to ${plan.name}, in its own gyms and estimates.`
          : `Saved to ${plan.name}.`
    )
  }

  /**
   * Make the selected plan the one the season runs. The CALENDAR is all that
   * moves: the season keeps its own gyms, hours and estimates, so a plan drawn
   * in an older world is asked about first, with the differences named, and the
   * confirmation says plainly what will not change.
   */
  const activatePlan = async () => {
    const plan = selectedPlan
    if (!plan || plan.isActive) return
    if (!window.confirm(activateConfirmText(plan.name, drift))) return
    setBusy("activate")
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/plans/${plan.id}/activate`, {
      method: "POST",
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(null)
    if (!res?.ok || !data?.state) {
      setError(data?.error ?? "That didn't take. Try again.")
      return
    }
    const next = data.state as PlannerState
    const savedNow = currentAssignment(next)
    const savedVenuesNow = savedVenueMap(next)
    setState(next)
    setLiveState(next)
    /**
     * THE SEASON TOOK THE WHOLE PLAN (owner ruling 2026-08-05, #5): its calendar
     * AND its gym setup. So the plan's world and the season's are the same world
     * now, the board draws the live one, and the drift line has nothing to say —
     * which is the truth rather than a silence.
     */
    setOnPlanWorld(false)
    setPlanSettings(null)
    skipRedraw.current = true
    setAssignment(savedNow)
    setVenues(savedVenuesNow)
    setKept(savedNow)
    setKeptVenues(savedVenuesNow)
    setBlockStatus({})
    setCourtCaps({})
    setAssertedGyms({})
    setUndoStack([])
    setArmed(null)
    setArmedVenue(null)
    setArmedSection(null)
    setDirty(false)
    setFromLever(false)
    await session.refresh()
    await session.refreshDoc()
    // A gym a GAME is already on could not be released, and that is a real
    // difference between the plan and the season the operator has to hear.
    const blocked = Number(data.world?.blocked ?? 0)
    setNotice(
      blocked > 0
        ? `${plan.name} is the season's calendar and gym setup now, except ${plural(blocked, "weekend", "weekends")} that kept a gym because a game is already scheduled there.`
        : `${plan.name} is the season's calendar and gym setup now. Everything after this step follows it.`
    )
  }

  /** The board as it stands, remembered before something changes it, WITH the
   *  name of the thing about to happen so the Undo button can say what it puts
   *  back (owner ruling 2026-08-05). */
  const remember = (label: string) =>
    setUndoStack((prev) =>
      [
        ...prev,
        { label, assignment, venues, blockStatus, courtCaps, assertedGyms, dirty },
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
  }, [])

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
    setCourtCaps(last.courtCaps)
    setAssertedGyms(last.assertedGyms)
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

  /** The one place a grade changes BUILDING: the chip's gym switcher. A hand
   *  pick is a decision, so it sticks even if that gym then reads full — and a
   *  backup gym is a legitimate destination, which is what the assertion below
   *  makes true on the board (owner ruling 2026-08-05, #1 and #2). */
  const switchGym = (sessionId: string, unitKey: string, venueId: string) => {
    if (locked) return
    const label = unitByKey.get(unitKey)?.label ?? "that grade"
    const backup = isBackupGym(sessionId, venueId)
    const short = gymShort(venueId)
    const left = ghostFor(sessionId, unitKey, short)
    remember(`move ${label} to ${short}`)
    if (backup) {
      setAssertedGyms((prev) => withAssertion(prev, sessionId, venueId))
      // The operator asserted the building, so the rental in it is theirs to
      // book rather than something the pool assumed.
      setBlockStatus((prev) => ({ ...prev, [blockKey(sessionId, venueId)]: "confirmed" }))
    }
    setVenues((prev) => ({
      ...prev,
      [sessionId]: { ...(prev[sessionId] ?? {}), [unitKey]: venueId },
    }))
    setArmed(null)
    setDirty(true)
    setFromLever(false)
    flashMove([sessionId], [{ sessionId, unitKey }], left)
    setNotice(
      backup
        ? `${label} moved: ${short} on ${weekendName(sessionId)}. You placed it, so it is yours to book.`
        : `${label} moved: ${short} on ${weekendName(sessionId)}`
    )
  }

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
  }, [])

  // The ring is a pointer, not a state: it goes out on its own.
  useEffect(() => {
    if (flashSessions.length === 0) return
    const timer = window.setTimeout(() => setFlashSessions([]), 1600)
    return () => window.clearTimeout(timer)
  }, [flashSessions])

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
    remember(`the courts at ${gymShort(venueId)}`)
    setCourtCaps((prev) => {
      const next = { ...prev }
      // Back at the full building is not a correction, it is the absence of
      // one, so the entry goes rather than sitting there saying nothing.
      if (courts >= wired) delete next[courtCapKey(sessionId, venueId)]
      else next[courtCapKey(sessionId, venueId)] = Math.max(0, courts)
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
      courts >= wired
        ? `${gymShort(venueId)} is back to all ${courtsWord(wired)} on ${weekend.label}.`
        : `${gymShort(venueId)} gives ${courtsWord(courts)} on ${weekend.label}. Anything that no longer fits is below, waiting for somewhere to go.`
    )
  }

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
    fromSessionId: string,
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
    const rooms = weekendRooms(board, to, used, courtCaps)
    const room = toVenueId ? rooms.find((r) => r.venueId === toVenueId) : null
    const free = toVenueId
      ? (room?.freeGames ?? 0)
      : // A weekend, not a building: only the gyms this plan HAS there count.
        // Asserting a backup gym is something the operator does by naming it.
        rooms.reduce((sum, r) => sum + (r.backup ? 0 : r.freeGames), 0)
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
    if (backup && toVenueId) {
      setAssertedGyms((prev) => withAssertion(prev, toSessionId, toVenueId))
      setBlockStatus((prev) => ({ ...prev, [blockKey(toSessionId, toVenueId)]: "confirmed" }))
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
        backup ? ". You placed it, so it is yours to book." : ""
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
    // Only the weekends this plan RUNS. The world keeps the ones it did not take
    // so the operator can see them; the solver never gets to fill them.
    const runs = solvableState(world)
    const assignment = proposePlan(runs, lever)
    return { assignment, venues: packPlanVenues(runs, assignment) }
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
   */
  const drawCalendar = (lever: PlannerLever, said: string, undoLabel: string) => {
    if (!board || locked) return
    const next = solveOn(board, lever)
    remember(undoLabel)
    setAssignment(next.assignment)
    setVenues(next.venues)
    setBlockStatus({})
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
    setNotice(said)
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

  /**
   * ADD A WEEKEND (owner ruling 2026-08-04). The one verb here that is not a
   * working copy: a weekend is season structure, so this really does create a
   * session and attach the building the league owns. Everything else about the
   * plan is left alone, and the board reloads onto the wider season.
   *
   * The pool is deliberately NOT attached: nobody has asked those gyms about a
   * Saturday that did not exist a second ago, and the tray says so.
   */
  const addWeekend = async (satDateISO: string, label: string) => {
    if (locked || !fillsFirst) return
    const home = gyms.order.find((g) => g.venueId === fillsFirst)?.name ?? "your home gym"
    if (
      !window.confirm(
        `Add ${label} to this season?\n\nThis one is real: it creates the weekend and puts ${home} on it. Your gyms you rent are not added, because nobody has asked them about ${label} yet.\n\nThe calendar on your board is not changed and nothing is booked.`
      )
    )
      return
    setBusy("add-weekend")
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/weekends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ satDate: satDateISO, venueId: fillsFirst }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(null)
    if (!res?.ok || !data?.success) {
      setError(data?.error ?? "That weekend did not save. Try again.")
      return
    }
    await load()
    setNotice(
      `${label} is on the season now, with ${home} on it. Nothing else moved, so drag a grade onto it when you want it used.`
    )
  }

  /**
   * WHAT THE WORKING COPY OWES THE SEASON on save: where its rentals stand, and
   * any gym it corrected. Both are facts about the SEASON rather than about a
   * calendar, so both are written only for the plan the season actually runs
   * (writeBookingStatus explains why), and both are re-read afterwards so the
   * board's base is the one the season just recorded.
   */
  const writeCourtCaps = async (): Promise<PlannerState | null> => {
    const rows = Object.entries(courtCaps)
    if (rows.length === 0) return null
    await Promise.all(
      rows.map(([key, courts]) => {
        const [sessionId, venueId] = key.split("|")
        if (!sessionId || !venueId) return Promise.resolve(null)
        return fetch(`/api/seasons/${seasonId}/sessions/${sessionId}/venues/${venueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courts }),
        }).catch(() => null)
      })
    )
    // Capacity moved, so the season's own world moved with it.
    const res = await fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(
      () => null
    )
    const data = res?.ok ? await res.json().catch(() => null) : null
    const fresh = (data?.state ?? null) as PlannerState | null
    if (fresh) setLiveState(fresh)
    return fresh
  }

  /**
   * THE BACKUP GYMS THE OPERATOR ASSERTED, written onto the SEASON (owner ruling
   * 2026-08-05, #1). Only for the plan the season runs, where "we have Haber that
   * Saturday" is a fact about the season's own gym time — the same attachment
   * step 2 makes when a cell is turned on. A plan the season does not run keeps
   * its assertion in its own world instead (see savePlan).
   */
  const writeAssertedGyms = async () => {
    const pairs = Object.entries(assertedGyms).flatMap(([sessionId, venueIds]) =>
      (venueIds ?? []).map((venueId) => ({ sessionId, venueId }))
    )
    if (pairs.length === 0) return
    await Promise.all(
      pairs.map(({ sessionId, venueId }) =>
        fetch(`/api/seasons/${seasonId}/sessions/${sessionId}/venues/${venueId}`, {
          method: "POST",
        }).catch(() => null)
      )
    )
  }

  /**
   * Everything the working copy owes the season, in one errand, handing back
   * the season's world if a correction moved it. The caller decides which world
   * the board lands in, so a stale `liveState` can never overwrite a capacity
   * the save just changed.
   */
  const writeSeasonFacts = async (): Promise<PlannerState | null> => {
    // The gyms first: a correction to a gym the season did not have yet would
    // otherwise be written against nothing.
    await writeAssertedGyms()
    await writeBookingStatus()
    return writeCourtCaps()
  }

  /**
   * THE PLAN'S WORLD, WITH THE ASSERTIONS IN IT (owner ruling 2026-08-05, #1).
   * What a save sends for a plan the season does not run: the world the board has
   * been drawing, plus every backup gym the operator put on a weekend, so
   * reopening the plan finds that gym really there.
   *
   * A plan that never remembered a world gets one built from the state on screen.
   * That is not a new claim: the server already re-snapshots the season over a
   * world-less plan on any content write, so this only makes the snapshot include
   * what the operator just told us.
   */
  const worldWithAssertions = () => {
    if (Object.values(assertedGyms).every((ids) => (ids ?? []).length === 0)) return null
    const base = planSettings?.state ?? (state ? worldFromState(state) : null)
    if (!base) return null
    return withAssertedGymsInWorld(base, assertedGyms)
  }

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
   * Refusals are down to true impossibilities: a building whose own courts cannot
   * hold the games even if we rented all of them, and a weekend whose spill is
   * games rather than a whole grade to move. Anything that lands is CONFIRMED,
   * because an operator who placed it is asserting the building is theirs.
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
    const room = weekendRooms(board, weekend, usageOn(sessionId, unitKeys), courtCaps).find(
      (r) => r.venueId === venueId
    )
    if (!room) {
      setNotice(
        `${short} has no gym time we can use on ${weekend.label}. Give it hours back in step 2.`
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
    setBlockStatus((prev) => ({ ...prev, [blockKey(sessionId, venueId)]: "confirmed" }))
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
    canPlaceGym: boolean
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
    if (payload?.venueId && canPlaceGym) {
      e.preventDefault()
      e.stopPropagation()
      placeVenue(sessionId, payload.venueId, unitKeys, games)
    }
  }

  /** Arming a section puts everything else down: one thing is in the operator's
   *  hand at a time, whichever thing it is. */
  const armSection = (section: ArmedSection | null) => {
    setArmedSection(section)
    setArmed(null)
    setArmedVenue(null)
    setArmedBlock(null)
    setGhosts([])
  }

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

  if (!board) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Working out your calendar…"}</p>
  }

  const pill = summary ? headerPill(summary) : null
  const interactive = !locked
  /** The strip can show the calendar the league KEPT, which is read only and
   *  is not what the levers, the suggestions or Keep act on. */
  const showingKept = view === "strip" && side === "kept" && kept !== null

  /** The weekend the operator is standing inside, if any. Zoom is a board
   *  altitude, so the strip never has one. */
  const zoomWeekend =
    view === "board" && zoomSession ? (weekendById.get(zoomSession) ?? null) : null

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

  return (
    <div
      className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white"
      /**
       * ANY interaction with the board ends the last move's marks, and it has to
       * be seen BEFORE the thing that was touched gets to act (owner re-ruling
       * 2026-08-05, #2). Capture does that: the marks clear, then the handler
       * runs, so a click that starts a new move writes its own marks over the
       * cleared ones and every other click simply puts them out.
       */
      onClickCapture={endMoveMarks}
      onKeyDownCapture={endMoveMarks}
      onDragStartCapture={endMoveMarks}
      onClick={() => {
        setArmed(null)
        setArmedVenue(null)
        setArmedBlock(null)
        setArmedSection(null)
      }}
    >
      {/* Screen head */}
      <div className="border-ink-200 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">
            {!planId ? "No plan open" : dirty ? "Proposed calendar" : "Your calendar"}
          </p>
          <p className="text-ink-500 text-xs">
            {!planId
              ? "Open one of this season's plans, or start a new one."
              : !interactive
                ? // A locked season can still be read through the picker, and a
                  // plan it never ran must not be described as the one it did.
                  selectedPlan && !selectedPlan.isActive
                  ? `${selectedPlan.name}: a plan this season did not run`
                  : "The calendar this season was finalized on"
                : view === "board"
                  ? "Drag a grade to move it · math updates live"
                  : "Every grade across the season · math updates live"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {/* One step back, ALWAYS in reach while there is one to take
                (owner ruling 2026-08-05): it says what it will undo, so an
                accidental drag never has to be hunted for. */}
            {undoStack.length > 0 && interactive && (
              <button
                type="button"
                data-testid="undo-last"
                data-undo="move"
                disabled={busy !== null}
                onClick={(e) => {
                  e.stopPropagation()
                  undoMove()
                }}
                className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-100 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0"
                >
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
                </svg>
                Undo: {undoStack[undoStack.length - 1].label}
              </button>
            )}
            {/* ALWAYS IN REACH (owner ruling 2026-08-05, #3): the whole calendar
                back from the solver, next to the one step back, whenever a plan
                is open and its world can hold a calendar. It asks first if the
                board has hand work on it, and it never touches what is saved. */}
            {planId && interactive && worldUsable && (
              <button
                type="button"
                data-testid="redraw"
                disabled={busy !== null}
                onClick={(e) => {
                  e.stopPropagation()
                  redraw()
                }}
                className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-100 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0"
                >
                  <path d="M21 12a9 9 0 1 1-3.1-6.8" />
                  <path d="M21 4v5h-5" />
                </svg>
                {COPY.redraw}
              </button>
            )}
            {/* Which of this season's plans the board is a copy of. Switching
                mid-flight lives here; CHOOSING one is step 1's job. */}
            <PlanChooser
              locked={locked}
              busy={busy !== null}
              compact
              testId="board-plan-chooser"
              onBeforeChange={() => !dirty || window.confirm(PLAN_COPY.discard)}
            />
            {planId && (
              <Segmented
                label="How to view the calendar"
                value={view}
                testId="calendar-view"
                options={[
                  { value: "board" as const, label: "Board" },
                  { value: "strip" as const, label: "Strip" },
                ]}
                onChange={(next) => {
                  setView(next)
                  setArmed(null)
                }}
              />
            )}
            {planId && pill && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${PILL_TONE[pill.tone]}`}
              >
                {pill.text}
              </span>
            )}
          </div>
          {/* Said before anybody tries to save onto it, not after. */}
          {isReferencePlan(selectedPlan) && (
            <p className="text-ink-400 text-[11px]" data-testid="plan-reference-note">
              {PLAN_COPY.reference}
            </p>
          )}
        </div>
      </div>

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so the calendar is read only now.
          </p>
        )}
        {error && (
          <p className="border-hoop-200 bg-hoop-50 text-hoop-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {error}
          </p>
        )}
        {compare && !error && (
          <div
            className="border-gold-400 bg-gold-50 mb-4 rounded-xl border px-4 py-2.5"
            aria-live="polite"
            data-testid="compare-banner"
          >
            <p className="text-ink-900 text-sm font-semibold">{compare.line}</p>
            <p className="text-ink-500 mt-0.5 text-xs">{COPY.compareLegend}</p>
          </div>
        )}
        {notice && !error && !compare && (
          <p
            className="border-court-200 bg-court-50 text-court-900 mb-4 rounded-xl border px-4 py-2.5 text-sm"
            data-testid="board-notice"
            aria-live="polite"
          >
            {notice}
          </p>
        )}
        {board.errors.length > 0 && (
          <p className="text-ink-500 mb-4 text-xs">{board.errors.join(" · ")}</p>
        )}

        {!planId ? (
          /* NOTHING OPEN (owner ruling 2026-08-05, #2). A visit that has not
             chosen a plan gets the chooser, not the league's imported
             calendar quietly loaded under its hands. */
          <PlanEmptyState locked={locked} busy={busy !== null} />
        ) : board.windows.length === 0 ? (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            This season has no weekends yet. Add them in step 2 and the calendar builds itself here.
          </p>
        ) : (
          <>
            {armed && (
              <p className="text-play-700 mb-3 text-xs font-semibold" aria-live="polite">
                {armed.label} is ready to move. Tap another weekend that month, or press Escape.
              </p>
            )}
            {armedVenue && (
              <p
                className="text-play-700 mb-3 text-xs font-semibold"
                aria-live="polite"
                data-testid="armed-venue"
              >
                {gymShort(armedVenue)} is ready to place. Tap a weekend that needs a gym, or press
                Escape.
              </p>
            )}
            {armedBlock && (
              <p
                className="text-play-700 mb-3 text-xs font-semibold"
                aria-live="polite"
                data-testid="armed-block"
              >
                {gradeList(armedBlock.unitKeys)} from {armedBlock.label} is looking for a weekend.
                Tap a lighter one that month, or press Escape.
              </p>
            )}
            {armedSection && (
              <p
                className="text-play-700 mb-3 text-xs font-semibold"
                aria-live="polite"
                data-testid="armed-section"
              >
                {gradeList(armedSection.unitKeys)} at {armedSection.gym} on{" "}
                {armedSection.weekendLabel} will move together. Tap another gym that month, or a
                weekend, or press Escape.
              </p>
            )}

            {/* AN EMPTY CALENDAR LEADS WITH THE BUTTON (owner ruling 2026-08-05,
                #1). A plan with weekends and gym time is one tap from its
                calendar, so the board says so in the middle of the screen instead
                of leaving five empty months and a row of quiet links. A plan with
                no world to solve in points at the step that gives it one. */}
            {calendarEmpty && interactive && !showingKept && (
              <DrawHero
                usable={worldUsable}
                busy={busy !== null}
                onDraw={() => draw(COPY.drawn)}
                onGoToStep={onGoToStep}
              />
            )}

            {/* A GYM THIS PLAN NO LONGER HAS (owner ruling 2026-08-05, #4).
                Loud, named, and above the calendar, because it is the reason
                some games below have moved into the dashed block. */}
            {stranded.length > 0 && (
              <div
                data-testid="stranded-gyms"
                data-count={stranded.length}
                aria-live="polite"
                className="border-hoop-300 bg-hoop-50 mb-2.5 rounded-xl border px-4 py-2.5"
              >
                <p className="text-hoop-900 text-[13px] font-bold">{PLAN_COPY.gymGone}</p>
                <p className="text-hoop-800 mt-0.5 text-[12px]">
                  {strandedSentence(stranded)} Fill them from your pool, place a gym by hand, or move
                  the games.
                </p>
                {/* TWO WAYS OUT, AS BUTTONS (owner ruling 2026-08-05, #2): the
                    whole calendar redrawn in the world this plan has now, or just
                    these games sent to a weekend that month with room for them.
                    Both are ordinary undoable edits to the working copy. */}
                {interactive && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="resolve-world"
                      disabled={busy !== null}
                      onClick={(e) => {
                        e.stopPropagation()
                        draw(COPY.resolved, "redrawing the calendar")
                      }}
                      className="border-hoop-600 bg-hoop-600 hover:bg-hoop-700 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border px-3 text-[12.5px] font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Re-solve in this world
                    </button>
                    {strandedMove && (
                      <button
                        type="button"
                        data-testid="move-stranded"
                        data-to={strandedMove.to.sessionId}
                        disabled={busy !== null}
                        onClick={(e) => {
                          e.stopPropagation()
                          moveBlock(
                            strandedMove.unitKeys,
                            strandedMove.fromSessionId,
                            strandedMove.to.sessionId
                          )
                        }}
                        className="border-hoop-300 text-hoop-900 hover:border-hoop-400 hover:bg-hoop-100 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Move these games to {strandedMove.to.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* The world this plan was saved in, where it is not the world the
                season is in now. Above the calendar, because it is a fact about
                every number below it. */}
            <DriftLine drift={drift} unknown={worldUnknown} onPlanWorld={onPlanWorld} />

            {/* The colour key for the whole step, above the calendar in both
                views: which gym is which colour, in full names. */}
            <GymLegend
              order={gyms.order}
              hue={gyms.hue}
              fillsFirst={fillsFirst}
              backup={backupGyms}
            />

            {/* WHO CHOOSES THE RENTED GYMS (owner ruling 2026-08-03). Two modes,
                above the board, because the answer changes what the board is
                for: reading the pool's answer, or placing gyms yourself. */}
            {view === "board" && interactive && !showingKept && (
              <div className="mb-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Segmented
                    label="How rented gyms get chosen"
                    value={assignMode}
                    testId="assign-mode"
                    options={[
                      { value: "solve" as const, label: "Assign gyms for me" },
                      { value: "place" as const, label: "I will place them" },
                    ]}
                    onChange={(next) => {
                      setAssignMode(next)
                      setArmed(null)
                      setArmedVenue(null)
                    }}
                  />
                  {assignMode === "solve" && (
                    <button
                      type="button"
                      data-testid="assign-from-pool"
                      disabled={busy !== null}
                      onClick={(e) => {
                        e.stopPropagation()
                        fillFromPool()
                      }}
                      className="border-play-600 bg-play-600 hover:bg-play-700 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border px-3 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Fill the gaps from my pool
                    </button>
                  )}
                  <span className="text-ink-400 text-[11.5px]">
                    {assignMode === "solve" ? COPY.assignSolve : COPY.assignPlace}
                  </span>
                </div>
                {/**
                 * THE TRAY IS ALWAYS THERE (owner ruling 2026-08-05, the tray
                 * regression). It used to be drawn only in "I will place them"
                 * mode, and when the compact-first pass made "Assign gyms for
                 * me" the default the pool simply vanished from the board — an
                 * operator could not see which gyms they had to rent, let alone
                 * pick one up, without first finding a mode switch.
                 *
                 * So it is rendered whenever a plan is open on the board. The
                 * mode still says who CHOOSES by default; picking a gym up is a
                 * decision the operator is allowed to make either way, and doing
                 * so arms the drop targets (see `placing`).
                 */}
                <VenueTray
                  gyms={trayGyms}
                  hue={gyms.hue}
                  armedVenueId={armedVenue}
                  onArm={setArmedVenue}
                />
              </div>
            )}

            {/**
             * THE STAGE AND THE RAIL (owner ruling 2026-08-04). The calendar
             * scrolls sideways under a column that does not move: what is left
             * to do is the one thing an operator should never have to go and
             * find, so it stays on screen at every altitude and every scroll
             * position.
             *
             * The rail is sticky against the PAGE, which is why the full-bleed
             * stage takes overflow-x: clip off <main> rather than hidden: a
             * scroll container that never scrolls kills sticky outright.
             */}
            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                {view === "board" ? (
                  zoomWeekend ? (
                    <WeekendZoom
                      weekend={zoomWeekend}
                      units={board.units}
                      keys={assignment[zoomWeekend.sessionId] ?? []}
                      playsIn={shown.venues[zoomWeekend.sessionId] ?? {}}
                      whyIn={whyIn[zoomWeekend.sessionId] ?? {}}
                      cameFrom={shown.homes[zoomWeekend.sessionId] ?? {}}
                      blocks={blocks.filter((b) => b.sessionId === zoomWeekend.sessionId)}
                      statusOf={statusOf}
                      unitByKey={unitByKey}
                      hue={gyms.hue}
                      courtCaps={courtCaps}
                      interactive={interactive}
                      onBack={() => setZoomSession(null)}
                      onCorrectCourts={correctCourts}
                      splitAxesFor={splitAxesFor}
                    />
                  ) : (
                    <BoardView
                      state={board}
                      assignment={assignment}
                      playsIn={shown.venues}
                      whyIn={whyIn}
                      cameFrom={shown.homes}
                      blocks={blocks}
                      statusOf={statusOf}
                      unitByKey={unitByKey}
                      hue={gyms.hue}
                      armed={armed}
                      // A gym picked up from the tray is a decision, whichever
                      // mode the board is in: the sections become drop targets
                      // for as long as one is armed.
                      armedVenue={armedVenue}
                      armedBlock={armedBlock}
                      armedSection={armedSection}
                      placing={interactive && (assignMode === "place" || armedVenue !== null)}
                      interactive={interactive}
                      scrollRef={boardScroll}
                      flashSessions={flashSessions}
                      flashUnits={flashUnits}
                      ghosts={ghosts}
                      addable={addable}
                      courtCaps={courtCaps}
                      strandedAt={strandedAt}
                      poolOn={poolOn}
                      roomsOn={roomsOn}
                      onArm={setArmed}
                      onArmBlock={setArmedBlock}
                      onArmSection={armSection}
                      onMove={move}
                      onMoveBlock={moveBlock}
                      onMoveSection={moveSection}
                      onRemove={removeUnit}
                      onSwitchGym={switchGym}
                      onDrop={onDrop}
                      onDropVenue={onDropVenue}
                      onDropSection={onDropSection}
                      onPlaceVenue={placeVenue}
                      onCorrectCourts={correctCourts}
                      onOpenWeekend={setZoomSession}
                      onAddWeekend={addWeekend}
                      splitAxesFor={splitAxesFor}
                      compare={compare}
                    />
                  )
                ) : (
                  <StripView
                    state={board}
                    shown={showingKept ? (kept ?? assignment) : assignment}
                    playsIn={showingKept ? keptShown.venues : shown.venues}
                    whyIn={showingKept ? keptShown.reasons : whyIn}
                    hasKept={Boolean(kept)}
                    side={side}
                    onSide={(next) => {
                      setSide(next)
                      setArmed(null)
                    }}
                    venueGrid={venueGrid}
                    interactive={interactive && !showingKept}
                    armed={armed}
                    onArm={setArmed}
                    onMove={move}
                  />
                )}
              </div>

              {/* The work rail, and the two things an operator reads next to
                  it: what this calendar rents, and what they have to go and
                  book. All three follow the board down the page. */}
              {!showingKept && (
                <aside
                  className="flex flex-col gap-2.5 xl:sticky xl:top-3"
                  data-testid="work-rail"
                  aria-label="What is left to do"
                >
                  <WorkRail
                    state={board}
                    assignment={gone.assignment}
                    venues={gone.venues}
                    playsIn={shown.venues}
                    suggestions={suggestions}
                    blocks={blocks}
                    blockCounts={blockCounts}
                    stranded={stranded}
                    hue={gyms.hue}
                    gymShort={gymShort}
                    // The rail critiques the plan on the board, and now the plan
                    // has a name the operator chose.
                    aboutLabel={selectedPlan?.name}
                    interactive={interactive}
                    onMove={move}
                    onJump={jumpToWeekend}
                  />
                  {/* WHAT YOU NEED TO BOOK (owner ruling 2026-08-03): the
                      season's whole off-home ask, with no dates in it, where an
                      operator picks up the phone. */}
                  {ask && blocks.length > 0 && <AskSheet ask={ask} blocks={blockRows} />}
                </aside>
              )}
            </div>

            {/* The quiet door to the levers, and the one button that commits.
                Both act on the proposal, so neither is offered while the kept
                calendar is the thing on screen. */}
            {interactive && !showingKept && (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowRules((v) => !v)
                      }}
                      aria-expanded={showRules}
                      className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors"
                    >
                      Adjust grouping rules
                    </button>
                    {/* The second group, and it changes something else: the
                        hours, not who plays which weekend. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowHours((v) => !v)
                        setHoursChip(null)
                        setHoursPreview(null)
                        setHoursError(null)
                      }}
                      aria-expanded={showHours}
                      data-testid="hours-toggle"
                      className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors"
                    >
                      Change the hours
                    </button>
                    {/* The board's own lens. The strip has the two calendars
                        side by side already, so it does not need it. */}
                    {kept && view === "board" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setComparing((v) => !v)
                        }}
                        aria-pressed={comparing}
                        data-testid="compare-toggle"
                        className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-[12.5px] font-bold transition-colors"
                      >
                        {comparing ? "Stop comparing" : "Compare with the kept calendar"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The rentals behind this plan are counted in the work
                        rail now (owner ruling 2026-08-04): everything that
                        describes what is LEFT belongs in the column that stays
                        on screen, not in the row of buttons at the bottom. */}
                    <span className="text-ink-400 text-xs" data-testid="plan-state">
                      {planStateLine({ selected: selectedPlan, active: activePlan, dirty })}
                    </span>
                    {/* One step back through the moves lives in the board
                        header now (owner ruling 2026-08-05): it has to be on
                        screen the moment a move happens, not at the foot of a
                        five-month calendar. */}
                    {dirty && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={revert}
                      >
                        Undo changes
                      </Button>
                    )}
                    {/* The one way to persist this board: onto a plan. */}
                    <PlanSaveControls
                      plans={plans}
                      selected={selectedPlan}
                      dirty={dirty}
                      busy={busy}
                      naming={naming}
                      onNamingChange={setNaming}
                      onStartNaming={() =>
                        setNaming(
                          suggestPlanName(
                            plans,
                            selectedPlan && !isReferencePlan(selectedPlan) && !dirty
                              ? `${selectedPlan.name} copy`
                              : "Our plan"
                          )
                        )
                      }
                      onCancelNaming={() => setNaming(null)}
                      onSaveNew={saveAsNew}
                      onSavePlan={savePlan}
                      onActivate={activatePlan}
                    />
                  </div>
                </div>

                {showRules && (
                  <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                    <p className="text-ink-500 text-xs">{COPY.rules}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {LEVERS.map((l) => (
                        <Button
                          key={l.lever}
                          size="sm"
                          variant="secondary"
                          disabled={busy !== null || !worldUsable}
                          onClick={() => runLever(l.lever)}
                        >
                          {l.label}
                        </Button>
                      ))}
                    </div>
                    {/* EVERY LEVER SOLVES IN THE WORLD ON SCREEN NOW (owner
                        ruling 2026-08-05, #1). They used to be switched off on a
                        plan-scoped board because the proposal came from the
                        season; the solve is the plan's own now, so the only
                        reason a lever cannot run is a plan with no gym time. */}
                    {!worldUsable && (
                      <p className="text-ink-400 mt-2 text-[11px]" data-testid="lever-no-world">
                        {COPY.worldFirst}.
                      </p>
                    )}
                  </div>
                )}

                {/* Hours. Its own group, labelled by what it changes, and
                    every chip previews before it books (owner 2026-08-02). */}
                {showHours && (
                  <div
                    className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3"
                    data-testid="hours-panel"
                  >
                    <p className="text-ink-400 text-[11px] font-bold uppercase tracking-[0.06em]">
                      Gym hours
                    </p>
                    <p className="text-ink-500 mt-1 text-xs">{COPY.hours}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {HOURS_CHIPS.map((chip) => (
                        <Button
                          key={chip.key}
                          size="sm"
                          variant="secondary"
                          tone={hoursChip?.key === chip.key ? "play" : "brand"}
                          disabled={busy !== null || onPlanWorld}
                          onClick={() => previewHours(chip)}
                        >
                          {busy === `hours:${chip.key}` ? "Working…" : chip.label}
                        </Button>
                      ))}
                    </div>
                    {/* The preview measures the SEASON's hours, and applying
                        writes them, so neither belongs on a board showing an
                        older plan's world. */}
                    {onPlanWorld && (
                      <p
                        className="text-ink-400 mt-2 text-[11px]"
                        data-testid="hours-snapshot-note"
                      >
                        {PLAN_COPY.hoursSnapshot}
                      </p>
                    )}
                    {hoursError && (
                      <p className="text-hoop-700 mt-2 text-xs font-semibold">{hoursError}</p>
                    )}
                    {hoursChip && hoursPreview && (
                      <div
                        className="border-ink-100 mt-2.5 rounded-lg border bg-white px-3 py-2"
                        data-testid="hours-preview"
                      >
                        <p className="text-ink-900 text-xs font-semibold" aria-live="polite">
                          {hoursPreviewSentence(hoursChip.label, hoursPreview)}
                        </p>
                        <p className="text-ink-400 mt-0.5 text-[11px]">
                          {hoursChip.hint}. Applying writes it to every gym, every weekend.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            tone="court"
                            disabled={busy !== null}
                            onClick={() => applyHours(hoursChip)}
                          >
                            {busy === "hours-apply" ? "Applying…" : "Apply these hours"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => {
                              setHoursChip(null)
                              setHoursPreview(null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * THE EMPTY BOARD'S ONE BUTTON (owner ruling 2026-08-05, #1).
 *
 * A plan that has said when it runs and where, and has no calendar yet, is one
 * tap from the whole answer. That tap gets the middle of the screen: a plan whose
 * board is five empty months and a row of quiet links reads as broken, and the
 * operator's next move is not a guess anybody should have to make.
 *
 * The other half is the honest version of the same screen. A plan with no chosen
 * weekend, or with gyms that are shut on every weekend it chose, has nothing for
 * the solver to fill, so the hero does not offer a button that would draw five
 * empty months again. It names the step that fixes it and goes there.
 */
function DrawHero({
  usable,
  busy,
  onDraw,
  onGoToStep,
}: {
  usable: boolean
  busy: boolean
  onDraw: () => void
  onGoToStep?: (step: number) => void
}) {
  return (
    <div
      data-testid="draw-hero"
      data-usable={usable ? "1" : "0"}
      onClick={(e) => e.stopPropagation()}
      className="border-court-200 bg-court-50/70 mb-3 rounded-2xl border px-5 py-7 text-center"
    >
      {usable ? (
        <>
          <button
            type="button"
            data-testid="draw-calendar"
            disabled={busy}
            onClick={onDraw}
            className="border-court-700 bg-court-600 hover:bg-court-700 inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border px-6 text-[15px] font-bold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="h-4 w-4 shrink-0"
            >
              <path d="M4 5h16v15H4z" />
              <path d="M4 10h16M9 5V3M15 5V3" />
            </svg>
            {COPY.drawTitle}
          </button>
          <p className="text-ink-500 mx-auto mt-2.5 max-w-md text-[12.5px]">{COPY.drawHint}</p>
        </>
      ) : (
        <>
          <p className="text-ink-900 text-[15px] font-bold">{COPY.worldFirst}</p>
          <p className="text-ink-500 mx-auto mt-1 max-w-md text-[12.5px]">{COPY.worldFirstHint}</p>
          <button
            type="button"
            data-testid="world-first"
            onClick={() => onGoToStep?.(2)}
            className="border-court-700 bg-court-600 hover:bg-court-700 mt-3 inline-flex min-h-[40px] cursor-pointer items-center rounded-xl border px-4 text-[13px] font-bold text-white shadow-sm transition-colors"
          >
            {COPY.worldFirstLink}
          </button>
        </>
      )}
    </div>
  )
}

/**
 * The one line that says this plan was drawn in a different world (owner
 * 2026-08-02: "a new plan also could have different venues. It could have
 * different settings, so how are you going to save it and how do you
 * remember?").
 *
 * Quiet gold, above the calendar, leading with the difference that matters
 * most and counting the rest; the whole list is one tap away. It is never an
 * alarm: a plan saved in October under October's gyms is not broken, it is
 * simply older than the season it sits in, and the operator is the one who
 * decides whether that matters.
 */
function DriftLine({
  drift,
  unknown,
  onPlanWorld,
}: {
  drift: string[]
  /** The plan predates world-tracking, so there is nothing to compare. */
  unknown: boolean
  /** The board is drawing the plan's own settings rather than the season's. */
  onPlanWorld: boolean
}) {
  if (!unknown && drift.length === 0) return null
  const lead = unknown ? PLAN_COPY.driftUnknown : PLAN_COPY.drift(drift[0], drift.length - 1)
  const whole = [
    ...(unknown ? [PLAN_COPY.driftUnknown] : drift),
    onPlanWorld ? PLAN_COPY.driftBoard : PLAN_COPY.driftActive,
  ].join(" ")
  return (
    // A thin gold spine over a pale wash, the same gold the step's other
    // notices wear. Deliberately NOT gold TEXT: the palette stops at gold-600,
    // which is too light to read at this size.
    <p
      className="border-gold-400 bg-gold-50 text-ink-800 mb-2.5 flex flex-wrap items-center gap-2 rounded-lg border-l-[3px] px-2.5 py-1.5 text-[11.5px]"
      data-testid="plan-drift"
    >
      <span className="font-semibold">{lead}</span>
      <WhyPopover
        text={whole}
        label="What is different about this plan's settings"
        testId="plan-drift-why"
      >
        <span className="text-play-700 font-semibold underline decoration-dotted underline-offset-2">
          What changed
        </span>
      </WhyPopover>
    </p>
  )
}

/**
 * Which colour is which gym (owner 2026-08-02: "there is no clear indication
 * that blue is Burlington and the green is Six Park"). It sits ABOVE the
 * calendar, in both views, because a key nobody scrolls to is not a key, and it
 * names the gyms in full: the columns and the strip abbreviate, this does not.
 *
 * The glyph legend under the board answers a different question, so the two
 * stay apart.
 *
 * EVERY GYM IN THE ROSTER IS NAMED HERE (owner ruling 2026-08-05, #1). That
 * includes the backup nobody has phoned: it has no weekend, so it has no colour
 * anywhere on the calendar, and a key that skipped it left the operator hunting
 * for a gym he knew he had added. It gets a hollow dot and says what it is.
 */
function GymLegend({
  order,
  hue,
  fillsFirst,
  backup,
}: {
  order: StripVenue[]
  hue: Map<string, number>
  /** The building the league owns, if it has one. */
  fillsFirst: string | null
  /** The pool gyms this plan has no weekend on: real, rentable, unasked. */
  backup: Set<string>
}) {
  if (order.length === 0) return null
  return (
    <div
      className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-1"
      data-testid="gym-legend"
    >
      {order.map((gym) => {
        const paint = hueFor(hue, gym.venueId)
        const spare = backup.has(gym.venueId)
        return (
          <span key={gym.venueId} className="inline-flex items-center gap-1.5 text-[11.5px]">
            <i
              aria-hidden
              className={`h-2.5 w-2.5 flex-none rounded-full ${
                spare ? "border-ink-400 border border-dashed" : paint.swatch
              }`}
            />
            <b className={`font-bold ${spare ? "text-ink-700" : paint.name}`}>{gym.name}</b>
            {gym.venueId === fillsFirst && (
              <span className="text-ink-400 font-semibold">home gym</span>
            )}
            {spare && (
              <span
                data-testid="legend-backup"
                data-venue-id={gym.venueId}
                className="border-ink-300 text-ink-500 rounded-md border border-dashed px-1 text-[10.5px] font-semibold"
              >
                backup
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/** The board: one column per month window, weekends stacked inside. Where a
 *  month gets rearranged, which is what a column is good at. */
function BoardView({
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

/** One weekend: the date, one fraction chip, and its grades UNDER THE GYM THEY
 *  PLAY IN, each gym with its own colour, meter and chip. No sentences: the
 *  red pill and the maxed meter already say "over by 7", and the story is one
 *  tap away on the pill. Also the drop target, and the tap-move destination. */
function WeekendCard({
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

/**
 * "GRADE 8 MOVED TO NOV 15" (owner ruling 2026-08-05, #3b, re-ruled the same day
 * as #2). The empty slot a grade left behind, in hoop red so the eye finds it in
 * a column of gym colours, and it names the destination rather than only the
 * departure: an origin that says "was here" leaves the operator hunting for
 * where it went.
 *
 * No animation and no clock. It stands until the board is touched again or the
 * move is undone, so there is nothing to catch.
 */
function GhostMark({ label, to }: { label: string; to: string }) {
  return (
    <span
      data-testid="move-ghost"
      data-unit={label}
      data-to={to}
      className="border-hoop-400 bg-hoop-50/60 text-hoop-700 inline-flex min-h-[34px] items-center rounded-lg border border-dashed px-1.5 text-[11px] font-bold"
    >
      {label} moved to {to}
    </span>
  )
}

/* ----------------------------- the rail ---------------------------------- */

/** What a move buys, in two words. Green fixes a problem, indigo tidies. */
const OUTCOME: Record<SuggestionMove["resolves"], { words: string; tone: string }> = {
  shortage: { words: "clears shortage", tone: "bg-court-50 text-court-800" },
  "two-building": { words: "one building", tone: "bg-play-50 text-play-700" },
  "idle-weekend": { words: "fills the weekend", tone: "bg-play-50 text-play-700" },
}

/**
 * THE WORK RAIL (owner ruling 2026-08-04, from the approved prototype). A
 * column that does not move while five months of calendar scroll past it,
 * because what is LEFT TO DO is the one thing an operator should never have to
 * go and find.
 *
 * Loudest first, and the count is the loudest thing of all: "2 open" at the top
 * says whether this plan is finished before a single row is read. Then the
 * standing facts about the season's rentals, then the weekends that do not fit,
 * then the moves worth taking. Every row names a weekend and every row is a
 * JUMP: clicking it brings that weekend under the rail rather than asking
 * somebody to scroll for it.
 *
 * The move rows are unchanged from 2026-08-02: the move as a sentence, the two
 * numbers that decide it, the full maths one tap away, and what it costs said
 * out loud. The ideas past the first two still fold away.
 */
function WorkRail({
  state,
  assignment,
  venues,
  playsIn,
  suggestions,
  blocks,
  blockCounts,
  stranded,
  hue,
  gymShort,
  aboutLabel = "this calendar",
  interactive,
  onMove,
  onJump,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  /** The gyms somebody DECIDED, which is what a move carries forward. */
  venues: Record<string, Record<string, string>>
  /** Where every grade plays on the board right now, for the row's tint. */
  playsIn: Record<string, Record<string, string>>
  suggestions: PlannerSuggestion[]
  /** Every rental the calendar needs, so the rail can lead with the ones that
   *  have no building. */
  blocks: RentalBlock[]
  blockCounts: { total: number; confirmed: number; assumed: number; needed: number }
  /** Placements whose gym or weekend this plan no longer has (owner ruling
   *  2026-08-05, #4). Counted as OPEN, because they are: those games have
   *  nowhere to play until somebody moves them. */
  stranded: StrandedPlacement[]
  hue: Map<string, number>
  gymShort: (venueId: string) => string
  /** Whose calendar this is critiquing, in the operator's own words. The rail
   *  is read next to a board that could be any season, so it says which one. */
  aboutLabel?: string
  interactive: boolean
  onMove: (unitKey: string, from: string | null, to: string) => void
  /** Put a weekend under the rail. */
  onJump: (sessionId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => railSuggestions(suggestions), [suggestions])
  const weekendById = useMemo(() => {
    const out = new Map<string, PlannerWeekend>()
    for (const win of state.windows) for (const w of win.weekends) out.set(w.sessionId, w)
    return out
  }, [state])

  const problems = rows.filter((s) => !s.move)
  const ideas = rows.filter((s) => s.move)
  const shownIdeas = expanded ? ideas : ideas.slice(0, 2)
  const folded = ideas.length - shownIdeas.length

  /** The first weekend with a rental nobody has a building for: where "needs a
   *  building" sends you. */
  const firstNeeded = blocks.find((b) => b.venueId === null && b.games > 0)?.sessionId ?? null

  /** WHAT IS STILL OPEN. A weekend over its courts, a rental with no building,
   *  and a placement whose gym this plan lost are the three things that stop a
   *  plan being finishable; an assumed booking is a phone call, not a hole, so
   *  it is warned about and not counted. */
  const open = problems.length + blockCounts.needed + stranded.length

  return (
    <section
      className="border-ink-300 shadow-panel bg-ink-50 overflow-hidden rounded-2xl border"
      aria-live="polite"
      data-testid="suggestion-rail"
    >
      {/* THE RAIL IS NOT ANOTHER CARD (owner ruling 2026-08-05). It is the
          control panel beside the work: a darker head, its own background tone
          and a real border, so the eye never mistakes it for a weekend. */}
      <div className="border-ink-300 bg-ink-100 flex items-baseline gap-2 border-b px-3 py-2.5">
        <h2 className="text-ink-900 text-[14px] font-bold uppercase tracking-[0.05em]">
          What is left
        </h2>
        <span
          data-testid="rail-open-count"
          className={`ml-auto rounded-full border px-2 py-[1px] text-[11px] font-bold tabular-nums ${
            open > 0 ? PILL_TONE.bad : PILL_TONE.ok
          }`}
        >
          {open === 0 ? "all clear" : `${open} open`}
        </span>
      </div>

      <div className="space-y-1.5 p-2.5">
        {/* Whose calendar the rail is talking about. Said even when every row is
            a problem, because a problem belongs to a season too. */}
        <p className="text-ink-500 px-1 text-[11.5px] font-semibold" data-testid="rail-about">
          Ideas for {aboutLabel}
        </p>

        {/* A GYM THIS PLAN NO LONGER HAS, counted where what-is-left is counted
            (owner ruling 2026-08-05, #4). First, because it is the loudest thing
            true about the calendar: those games have nowhere to play. */}
        {stranded.length > 0 && (
          <RailStanding
            tone="bad"
            title={`${plural(stranded.length, "placement has", "placements have")} no building`}
            detail={strandedSentence(stranded) ?? PLAN_COPY.gymGone}
            onJump={() => onJump(stranded[0].sessionId)}
          />
        )}

        {/* THE STANDING FACTS about what this calendar rents. Loud when a
            rental has no building, quiet gold while one is only assumed. */}
        {blockCounts.total > 0 && (
          <RailStanding
            tone={blockCounts.needed > 0 ? "bad" : "good"}
            title={
              blockCounts.needed > 0
                ? `${plural(blockCounts.needed, "rental needs", "rentals need")} a building`
                : "Every rental has a building"
            }
            detail={
              blockCounts.needed > 0
                ? "Fill them from your pool, place a gym by hand, or move the games."
                : `${plural(blockCounts.total, "rental", "rentals")} behind this calendar.`
            }
            onJump={firstNeeded ? () => onJump(firstNeeded) : undefined}
          />
        )}
        {blockCounts.assumed > 0 && (
          <RailStanding
            tone="warn"
            title={`${plural(blockCounts.assumed, "booking is", "bookings are")} assumed`}
            detail="A gym our pool answered, that nobody has phoned yet."
          />
        )}

        {problems.map((s, i) => {
          const weekend = weekendById.get(s.sessionId)
          if (!weekend) return null
          // The same packed truth the board card wears, so the rail and the
          // weekend it is pointing at can never read different numbers.
          const load = packedWeekendLoad(
            state.units,
            weekend,
            assignment[s.sessionId] ?? [],
            blocks.filter((b) => b.sessionId === s.sessionId)
          )
          return (
            <div
              key={`problem-${s.sessionId}-${i}`}
              data-testid="rail-problem"
              onClick={() => onJump(s.sessionId)}
              className="border-hoop-300 bg-hoop-50 hover:bg-hoop-100 flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-sm transition-colors"
            >
              <button
                type="button"
                data-testid="rail-jump"
                onClick={(e) => {
                  e.stopPropagation()
                  onJump(s.sessionId)
                }}
                aria-label={`Show ${weekend.label} on the board`}
                className="text-hoop-800 hover:text-hoop-900 min-h-[24px] cursor-pointer text-[12.5px] font-bold underline decoration-dotted underline-offset-2"
              >
                {weekend.label}
              </button>
              <WhyPopover
                text={s.text}
                label={`What ${weekend.label} is short of`}
                testId="problem-why"
              >
                <Fraction
                  is={load.demand}
                  of={load.capacity}
                  tone="over"
                  title={`${weekend.label}: ${load.demand} games of ${load.capacity} we hold`}
                />
              </WhyPopover>
            </div>
          )
        })}

        {shownIdeas.map((s, i) => (
          <SuggestionRow
            key={`idea-${s.sessionId}-${s.move?.unitKey}-${i}`}
            state={state}
            assignment={assignment}
            venues={venues}
            playsIn={playsIn}
            move={s.move as SuggestionMove}
            text={s.text}
            toWeekend={weekendById.get((s.move as SuggestionMove).toSessionId)}
            hue={hue}
            gymShort={gymShort}
            interactive={interactive}
            onMove={onMove}
            onJump={onJump}
          />
        ))}

        {rows.length === 0 && blockCounts.total === 0 && (
          <p className="text-ink-500 px-1 text-[12px]">
            Nothing to fix and nothing to rent. Every weekend fits in the gym you own.
          </p>
        )}

        {folded > 0 && (
          <button
            type="button"
            data-testid="more-ideas"
            aria-expanded={false}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(true)
            }}
            className="text-ink-500 hover:text-ink-800 cursor-pointer px-1 py-1 text-[12.5px] font-semibold"
          >
            {folded} more {folded === 1 ? "idea" : "ideas"}
          </button>
        )}
        {expanded && ideas.length > 2 && (
          <button
            type="button"
            data-testid="more-ideas"
            aria-expanded
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
            className="text-ink-500 hover:text-ink-800 cursor-pointer px-1 py-1 text-[12.5px] font-semibold"
          >
            Fewer ideas
          </button>
        )}
      </div>

      {/* The rentals behind this plan, counted, at the foot of the column that
          is about what is left (owner ruling 2026-08-04). */}
      <div className="border-ink-300 bg-ink-100/70 border-t px-3 py-2">
        <BlockSummary
          total={blockCounts.total}
          confirmed={blockCounts.confirmed}
          assumed={blockCounts.assumed}
          needed={blockCounts.needed}
        />
        {blockCounts.total === 0 && <span className="text-ink-500 text-xs">Nothing to rent.</span>}
      </div>
    </section>
  )
}

/** One standing fact about the season, in the rail's own three tones. A row
 *  with somewhere to go is a jump; one that is only a statement is not. */
function RailStanding({
  tone,
  title,
  detail,
  onJump,
}: {
  tone: "bad" | "warn" | "good"
  title: string
  detail: string
  onJump?: () => void
}) {
  const paint =
    tone === "bad"
      ? "border-hoop-200 bg-hoop-50 text-hoop-800"
      : tone === "warn"
        ? "border-gold-400 bg-gold-50 text-gold-600"
        : "border-court-200 bg-court-50 text-court-800"
  const body = (
    <>
      <span className="block text-[12.5px] font-bold">{title}</span>
      <span className="text-ink-600 mt-0.5 block text-[11.5px]">{detail}</span>
    </>
  )
  if (!onJump) {
    return (
      <div data-testid="rail-standing" className={`rounded-lg border px-3 py-1.5 ${paint}`}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      data-testid="rail-standing"
      onClick={(e) => {
        e.stopPropagation()
        onJump()
      }}
      className={`w-full rounded-lg border px-3 py-1.5 text-left ${paint} hover:brightness-[0.98]`}
    >
      {body}
    </button>
  )
}

/**
 * One move, as a sentence with the two numbers that decide it (owner
 * 2026-08-02: "it's not very clear that 27 is a number of games... do we
 * really have to put the capacity, the current capacity, the usage of the
 * gym").
 *
 * The lead says what would happen and the number wears its unit. Beside it,
 * only what is load bearing: what is wrong where the grade is now, and what is
 * left where it would go. Under it, what the move COSTS, because a row that
 * reads like free money is a lie: the games the destination takes on, and the
 * building the grade ends up in when that is not its own. The full capacity
 * maths is in the lead's popover, in the words the core composed.
 */
function SuggestionRow({
  state,
  assignment,
  venues,
  playsIn,
  move,
  text,
  toWeekend,
  hue,
  gymShort,
  interactive,
  onMove,
  onJump,
}: {
  state: PlannerState
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  playsIn: Record<string, Record<string, string>>
  move: SuggestionMove
  /** The whole thing in prose, composed in the pure core. The row lays out the
   *  headline; this is what the popover says. */
  text: string
  /** The weekend the grade would land on, for the games it brings there. A
   *  weekend can run a different games-per-team than the one it leaves. */
  toWeekend?: PlannerWeekend
  hue: Map<string, number>
  gymShort: (venueId: string) => string
  interactive: boolean
  onMove: (unitKey: string, from: string | null, to: string) => void
  /** Both weekends a move names are jump targets: the rail is the index and
   *  the board is the page. */
  onJump: (sessionId: string) => void
}) {
  const before = useMemo(
    () => gradeGymStrip(state, assignment, venues, move.unitKey),
    [state, assignment, venues, move.unitKey]
  )
  // The same calendar with this one move made, packed the same way the board
  // will pack it the moment the button is pressed. Nothing here is mutated.
  const after = useMemo(
    () =>
      gradeGymStrip(
        state,
        assignmentWithMove(assignment, move.unitKey, move.fromSessionId, move.toSessionId),
        venuesWithoutUnit(venues, move.unitKey, [move.fromSessionId, move.toSessionId]),
        move.unitKey
      ),
    [state, assignment, venues, move.unitKey, move.fromSessionId, move.toSessionId]
  )
  const paint = hueFor(hue, playsIn[move.fromSessionId]?.[move.unitKey])
  const outcome = OUTCOME[move.resolves]
  /** The building this grade plays most: its home, by the core's own rule.
   *  The miniature outlines against it and the cost line names it. */
  const home = gradeHomeGym(before)
  /** Where the move stands the grade on the weekend it lands on. */
  const lands = after.find((c) => c.sessionId === move.toSessionId)?.venueId ?? null
  const story = `${gymCountsSentence(before, after, gymShort)}${move.lands ? ` ${move.lands}` : ""}`

  const lead = `Move ${move.unitLabel}'s ${plural(move.games, "game", "games")}`
  const over = Math.max(0, move.fromBefore.demand - move.fromBefore.capacity)
  const left = move.toAfter.capacity - move.toAfter.demand
  /** Games the destination takes on, counted on ITS own weekend. */
  const takes = toWeekend ? weekendDemand(state.units, toWeekend, [move.unitKey]) : move.games
  const cost = [
    `${move.toLabel} takes ${plural(takes, "more game", "more games")}.`,
    // The move.lands data says the same thing in the popover; the row says it
    // in the words a parent would use.
    lands && home && lands !== home
      ? `${move.unitLabel} plays at ${gymShort(lands)} that weekend.`
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className="border-ink-200 rounded-xl border bg-white px-3 py-2 shadow-sm"
      data-testid="rail-idea"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <i aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${paint.swatch}`} />
        <WhyPopover
          text={text}
          label={`${lead}. The numbers behind this move.`}
          testId="idea-why"
          className="text-ink-900 inline-flex min-h-[32px] items-center px-0.5 text-[12.5px] font-bold"
        >
          {lead}
        </WhyPopover>
        <RailJump label={move.fromLabel} sessionId={move.fromSessionId} onJump={onJump} />
        {over > 0 && (
          <CountChip
            tone="over"
            words={`${plural(over, "game", "games")} over`}
            testId="idea-problem"
          />
        )}
        <span aria-hidden className="text-ink-300 font-bold">
          →
        </span>
        <RailJump label={move.toLabel} sessionId={move.toSessionId} onJump={onJump} />
        <CountChip
          tone={fractionTone(move.toAfter.demand, move.toAfter.capacity)}
          words={
            left >= 0
              ? `fits, ${plural(left, "slot", "slots")} left`
              : `${plural(-left, "game", "games")} over`
          }
          testId="idea-destination"
        />
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${outcome.tone}`}>
          {outcome.words}
        </span>
        <ImpactStrip
          before={before}
          after={after}
          home={home}
          hue={hue}
          story={story}
          unitLabel={move.unitLabel}
        />
        {interactive && (
          <button
            type="button"
            data-testid="suggestion-move"
            data-unit-key={move.unitKey}
            onClick={(e) => {
              e.stopPropagation()
              onMove(move.unitKey, move.fromSessionId, move.toSessionId)
            }}
            aria-label={`Move ${move.unitLabel} from ${move.fromLabel} to ${move.toLabel}`}
            className="border-play-300 bg-play-50 text-play-700 hover:bg-play-100 ml-auto min-h-[40px] shrink-0 cursor-pointer rounded-lg border px-3 text-[12px] font-bold"
          >
            Move
          </button>
        )}
      </div>
      {/* What it costs, every time. */}
      <p className="text-ink-500 mt-1 px-0.5 text-[11.5px]" data-testid="idea-cost">
        {cost}
      </p>
    </div>
  )
}

/** A weekend named in the rail, and a way to go and look at it. */
function RailJump({
  label,
  sessionId,
  onJump,
}: {
  label: string
  sessionId: string
  onJump: (sessionId: string) => void
}) {
  return (
    <button
      type="button"
      data-testid="rail-jump"
      onClick={(e) => {
        e.stopPropagation()
        onJump(sessionId)
      }}
      aria-label={`Show ${label} on the board`}
      className="text-ink-600 hover:text-play-700 min-h-[24px] cursor-pointer whitespace-nowrap text-[12px] font-semibold underline decoration-dotted underline-offset-2"
    >
      {label}
    </button>
  )
}

/**
 * A grade's season in miniature, before and after: one cell per weekend it
 * plays, in date order, coloured by the gym. A cell that the move sends
 * somewhere other than the grade's home gym is outlined, so the one thing that
 * changed is the one thing you see. Static, on purpose: nothing on this screen
 * blinks at you.
 */
function ImpactStrip({
  before,
  after,
  home,
  hue,
  story,
  unitLabel,
}: {
  before: GradeStripCell[]
  after: GradeStripCell[]
  /** The grade's own gym, worked out by the row so the outline here and the
   *  cost line under it can never mean different buildings. */
  home: string | null
  hue: Map<string, number>
  story: string
  unitLabel: string
}) {
  const cells = (list: GradeStripCell[], mark: boolean) => (
    <span className="inline-flex gap-[2px]">
      {list.map((cell, i) => {
        const moved = mark && before[i] && before[i].venueId !== cell.venueId
        return (
          <i
            key={`${cell.sessionId}-${i}`}
            aria-hidden
            data-venue-id={cell.venueId}
            className={`block h-3 w-[9px] rounded-[3px] ${hueFor(hue, cell.venueId).swatch} ${
              moved && cell.venueId !== home
                ? "outline-gold-500 outline outline-2 outline-offset-1"
                : ""
            }`}
          />
        )
      })}
    </span>
  )

  return (
    <WhyPopover
      text={story}
      label={`${unitLabel}: its season before and after this move`}
      testId="impact-strip"
      className="inline-flex min-h-[32px] items-center gap-1.5 px-1"
    >
      {cells(before, false)}
      <span aria-hidden className="text-ink-300 text-[11px] font-bold">
        →
      </span>
      {cells(after, true)}
    </WhyPopover>
  )
}

/** A grade, in the colour of the gym it plays in. Draggable for a mouse,
 *  tappable for everything else: one tap arms it, the next tap on a weekend
 *  moves it. Its games ride on it as a number, and the reason it sits where it
 *  sits rides on it as a mark you can tap for the sentence. */
function GradeChip({
  unit,
  games,
  tint,
  quiet,
  reason,
  why,
  fromSessionId,
  windowLabel,
  weekendLabel,
  armed,
  interactive,
  flash,
  onArm,
  onRemove,
  switchTo,
  onSwitchGym,
  muted,
  diffTone,
  caption,
}: {
  unit: PlannerUnit
  /** Games this grade brings. On a weekend, what it brings there; on the bench,
   *  what it would bring to that month (owner ruling 2026-08-05 — the count is
   *  on the chip you pick up, not only on the one you put down). */
  games?: number
  /** The gym's colour, as chip classes. */
  tint?: string
  /** The quieter ink inside the chip, from the same family. */
  quiet?: string
  /** Why it is in this building, for the mark it wears. */
  reason?: PlacementReason | null
  /** The sentence behind that mark. */
  why?: string
  fromSessionId: string | null
  windowLabel: string
  weekendLabel: string
  armed: Armed | null
  interactive: boolean
  /** THIS is the grade that just moved (owner ruling 2026-08-05, #3a). It wears a
   *  stronger mark than the card it landed on, because the card is where to look
   *  and the chip is what happened, and it keeps it until the next interaction. */
  flash?: boolean
  onArm: (a: Armed | null) => void
  onRemove?: () => void
  /** The next building with room for this grade, when this weekend has one.
   *  `backup` means the plan has no gym time there and taking it is the
   *  operator's own assertion (owner ruling 2026-08-05, #1). */
  switchTo?: { venueId: string; short: string; backup?: boolean }
  onSwitchGym?: () => void
  muted?: boolean
  /** Compare mode: agrees with the kept calendar, or sits somewhere new. */
  diffTone?: "agreed" | "changed"
  /** Compare mode only: where the kept calendar plays this grade instead. */
  caption?: string
}) {
  const isArmed = armed?.unitKey === unit.key && armed?.fromSessionId === fromSessionId
  // Arming is a live action, so it outranks the compare ring while it lasts, and
  // the mark on the grade that JUST MOVED outranks everything: it is the answer
  // to "what did I just do", and it stands until the board is touched again.
  const ring = flash
    ? "outline-play-600 outline outline-[3px] outline-offset-1 motion-safe:transition-all"
    : isArmed
      ? "ring-play-500 ring-2"
      : diffTone === "agreed"
        ? "ring-court-400 ring-1"
        : diffTone === "changed"
          ? "ring-gold-500 ring-1"
          : ""
  const ink = muted ? "text-ink-400" : (quiet ?? "text-ink-400")
  const glyph = reason ? REASON_GLYPH[reason] : undefined
  const chip = (
    <span
      draggable={interactive}
      onDragStart={(e) =>
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ unitKey: unit.key, fromSessionId, window: windowLabel })
        )
      }
      data-testid="grade-chip"
      data-diff={diffTone}
      data-flash={flash ? "1" : undefined}
      data-unit={unit.key}
      data-reason={reason ?? undefined}
      className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border pl-1 text-[12px] font-bold shadow-sm ${
        muted ? "border-ink-200 bg-ink-50 text-ink-500" : (tint ?? "border-ink-300 bg-white")
      } ${interactive ? "cursor-grab active:cursor-grabbing" : ""} ${ring}`}
    >
      {/* THE GRIP (owner ruling 2026-08-05). A chip you can pick up says so
          before you try: six dots and a grab cursor, the way every draggable
          thing on this board is marked. */}
      {interactive && (
        <svg
          viewBox="0 0 10 16"
          aria-hidden
          focusable="false"
          className={`h-3.5 w-2 shrink-0 ${ink}`}
        >
          <circle cx="3" cy="4" r="1.1" fill="currentColor" />
          <circle cx="7" cy="4" r="1.1" fill="currentColor" />
          <circle cx="3" cy="8" r="1.1" fill="currentColor" />
          <circle cx="7" cy="8" r="1.1" fill="currentColor" />
          <circle cx="3" cy="12" r="1.1" fill="currentColor" />
          <circle cx="7" cy="12" r="1.1" fill="currentColor" />
        </svg>
      )}
      <button
        type="button"
        disabled={!interactive}
        aria-pressed={isArmed}
        aria-label={`${unit.label} on ${weekendLabel}`}
        onClick={(e) => {
          e.stopPropagation()
          if (!interactive) return
          onArm(
            isArmed
              ? null
              : { unitKey: unit.key, label: unit.label, fromSessionId, window: windowLabel }
          )
        }}
        className="min-h-[34px] cursor-pointer pr-0.5 disabled:cursor-default"
      >
        {unit.label}
      </button>
      {games != null && games > 0 && (
        <span className={`text-[11px] font-bold tabular-nums ${ink}`} aria-hidden>
          {games}
        </span>
      )}
      {/* The reason, drawn. The tap target is the whole height of the chip,
          never the 12px mark on its own, and the sentence is behind it. */}
      {glyph && why && (
        <WhyPopover
          text={why}
          label={`Why ${unit.label} plays here`}
          testId="chip-why"
          className={`inline-flex min-h-[32px] items-center px-0.5 ${ink}`}
        >
          <ReasonGlyph glyph={glyph} />
        </WhyPopover>
      )}
      {/* One tap sends the grade to the next gym of this weekend. The chip
          already sits under the gym it plays in, so this is the move. */}
      {/* The switch is drawn ONLY where the other gym has room for this grade
          this weekend (owner ruling 2026-08-05). No mistake paths into full
          buildings, and no greyed arrow keeping a secret about why. */}
      {interactive && switchTo && onSwitchGym && (
        <button
          type="button"
          data-testid="switch-gym"
          data-to={switchTo.venueId}
          data-backup={switchTo.backup ? "1" : undefined}
          onClick={(e) => {
            e.stopPropagation()
            onSwitchGym()
          }}
          aria-label={
            switchTo.backup
              ? `Move ${unit.label} to ${switchTo.short}, a gym this plan has not asked about`
              : `Move ${unit.label} to ${switchTo.short}`
          }
          title={
            switchTo.backup
              ? `Move to ${switchTo.short} — your backup gym. Taking it says you have it that weekend.`
              : `Move to ${switchTo.short}`
          }
          className={`border-ink-300 hover:border-ink-400 hover:text-ink-900 ml-0.5 inline-flex min-h-[26px] cursor-pointer items-center rounded-md border bg-white/70 px-1 text-[11px] font-bold transition-colors hover:bg-white ${ink}`}
        >
          ⇄
        </button>
      )}
      {interactive && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Take ${unit.label} off ${weekendLabel}`}
          className={`hover:text-hoop-700 min-h-[34px] cursor-pointer px-1.5 ${ink}`}
        >
          ×
        </button>
      )}
    </span>
  )

  if (!caption) return chip
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {chip}
      <span
        className={`pl-0.5 text-[10px] font-bold leading-none ${
          diffTone === "changed" ? "text-gold-600" : "text-ink-400"
        }`}
      >
        {caption}
      </span>
    </span>
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
function WeekendZoom({
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
  courtCaps,
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
  courtCaps: Record<string, number>
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
          const capped = courtCaps[courtCapKey(weekend.sessionId, section.venueId)] ?? null
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
