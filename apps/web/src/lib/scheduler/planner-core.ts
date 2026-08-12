/**
 * Season planner — PURE core (no DB imports): types, demand math, the
 * deterministic per-window search, and the suggestion rail. The client
 * board imports THIS module; planner.ts adds the prisma-backed load/apply.
 * Deterministic by owner ruling (2026-08-02): no model call in the solve
 * path — validated against NPH's official 2026-27 calendar
 * (scripts/analysis/validate-nph-calendar.ts).
 *
 * Sentences live here too, next to the numbers they describe: the board and
 * the strip RENDER copy, they never compose it, so what an operator reads is
 * unit-tested against the same packing the plan saves.
 */
import { venueShortName } from "../seasons/venue-strip"
// Type only: plan-documents is the leaf of this corner of the tree (it imports
// nothing), so naming its phase here costs no runtime edge.
import type { WindowPhase } from "./plan-documents"

/**
 * How a weekend is named everywhere an operator sees one: "Oct 24–25", or
 * "Oct 31–Nov 1" when it straddles months. Lives in the pure core because
 * the planner board, the gyms-and-weekends grid, and the published calendar
 * card must all spell the same weekend the same way.
 */
/**
 * THE DAYS A LEAGUE SESSION MAY SIT ON (QA T-015, tester ruling 2026-08-11):
 * Friday, Saturday, Sunday. Nothing else is planning supply — a Monday or a
 * Thursday must never appear as a runnable planning date. Read in UTC parts
 * on purpose: day rows are stored as midnight instants (local-midnight since
 * the TZ fix, UTC-midnight in older rows), and for a timezone west of UTC
 * both conventions put the intended calendar day in the instant's UTC date.
 */
export const LEAGUE_DAY_DOWS: ReadonlySet<number> = new Set([5, 6, 0])

export function isLeagueDay(date: Date | string): boolean {
  return LEAGUE_DAY_DOWS.has(new Date(date).getUTCDay())
}

export function weekendLabel(dates: Array<string | Date>): string {
  const ds = dates.map((x) => new Date(x)).sort((a, b) => a.getTime() - b.getTime())
  const fmt = (d: Date) =>
    `${d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`
  if (ds.length === 0) return "No days"
  if (ds.length === 1) return fmt(ds[0])
  const last = ds[ds.length - 1]
  const sameMonth = ds[0].getUTCMonth() === last.getUTCMonth()
  return `${fmt(ds[0])}–${sameMonth ? last.getUTCDate() : fmt(last)}`
}

/**
 * A wall-clock time moved by some minutes: "09:00" an hour earlier is
 * "08:00". Clamped to the day, so an early start can never wrap past
 * midnight into a window that reads backwards.
 *
 * ONE implementation on purpose (owner 2026-08-02, the hours chips): the
 * server previews a shifted day the same way the Apply writes it, so what the
 * chip promised is exactly what the season ends up running.
 */
export function shiftClock(time: string, deltaMinutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return time
  const total = Number(m[1]) * 60 + Number(m[2]) + deltaMinutes
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total))
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`
}

export interface PlannerUnit {
  key: string // "age:<ageGroup>"
  label: string
  divisionIds: string[]
  /** This grade should ALTERNATE buildings across weekends rather than keep
   *  one gym all season (travel fairness, owner 2026-08-02). For an
   *  alternating grade the carried gym is the one to AVOID next, not a home. */
  alternate?: boolean
  /** What the board plans on: the operator's step-1 estimate, and only that
   *  — `planningTeams(approved, expected)`. Everything that computes capacity
   *  reads THIS number. */
  teams: number
  /** Teams actually registered (approved submissions). Overlay only: it is
   *  drawn next to the plan, never folded into it. */
  approved: number
  /** What step 1 said to expect. Zero when nobody ever estimated this grade. */
  expected: number
  /** Whether the plan has a number for this grade at all. */
  source: "approved" | "expected" | "none"
}

/**
 * The number a grade plans on. Owner ruling 2026-08-02, which SUPERSEDES the
 * earlier max(approved, expected) rule: "The planning phase should not be
 * looking at the real teams until we get to the real scheduling. The estimate
 * should be the number entered by the human, not what's in the database. If
 * teams sign up below the estimates that's fine. If you go over, maybe a
 * slight warning somewhere."
 *
 * So the estimate is the plan, period. `approved` stays in the signature
 * because every caller holds both numbers and the screens show them side by
 * side, but registration never moves the plan: it is overlay data (the
 * "N registered" chip, the gold over-the-estimate warning, the step-5 bars).
 */
export function planningTeams(approved: number, expected: number): number {
  return expected
}

/** Whether a grade has a planning number: "expected" once the operator has
 *  estimated it, "none" while they have not. Never "approved" since the
 *  2026-08-02 ruling — registration counts do not drive planning — but the
 *  value stays in the union for signature stability. */
export function planningSource(
  approved: number,
  expected: number
): "approved" | "expected" | "none" {
  return expected > 0 ? "expected" : "none"
}

/**
 * What a gym IS to the league (owner ruling 2026-08-03, venue model v2 —
 * "fill order is dead"):
 *
 *  - "home": the building you own. It always fills first and it costs
 *    nothing, so every game it holds is a game nobody pays for. At most one
 *    per season.
 *  - "pool": a gym you rent by the court-day. The pool is UNORDERED — which
 *    one you take is a cost question the packer answers each weekend, not a
 *    ranking somebody set in a settings screen.
 */
export type VenueRole = "home" | "pool"

export interface PlannerVenue {
  /**
   * WHERE THIS BUILDING SITS IN THE LEAGUE'S OWN ORDER (owner ruling
   * 2026-08-06): 0 is the gym it owns, then the pool in the order the operator
   * put them in on step 2. It is a PREFERENCE, never a gate — occupancy is the
   * only gate — and it decides two things: which building the solver reaches for
   * when the money ties, and the order gyms are drawn in everywhere.
   *
   * Absent on a world nobody has ordered, where it reads as "after everything
   * ranked", so an older plan behaves exactly as it did.
   */
  rank?: number
  /**
   * THIS IS A BOOKING THE LEAGUE HAS (owner ruling 2026-08-06: confirmed
   * bookings are OBLIGATIONS). True when the plan really holds this gym on this
   * weekend — declared on step 2, or placed by the operator's own hand — as
   * opposed to a room the solver is merely allowed to book.
   *
   * The league is already paying for it, so the objective treats leaving it
   * empty as a real cost. Absent means "a room, not a booking".
   */
  booked?: boolean
  /** Courts held on the Friday evening of this weekend at this gym (owner
   *  ruling 2026-08-06). Extra capacity for the whole session, never the
   *  solver's doing: only the operator accepts one. */
  fridayCourts?: number
  venueId: string
  name: string
  capacityGames: number
  /** Owned or rented. The packer reads THIS, never the order of the array. */
  role: VenueRole
  /** DEAD since 2026-08-03 (the fill-order ruling). Still carried because a
   *  plan snapshot saved under the old model has it, and the drift sentence
   *  has to be able to read what that plan was made under. Nothing scores on
   *  it. */
  fillOrder: number
  /** Court-days behind `capacityGames` this weekend: how many (day × court)
   *  pairs the gym opens. Set by buildPlannerState; absent in hand-built
   *  states. It is what turns a capacity change into the number an operator
   *  thinks in — games per court per day — when the hours move. */
  courtDays?: number
  /** Courts wired at this gym for this weekend. With `days` it splits
   *  `courtDays` into the two numbers a rental is actually quoted in: how
   *  many courts, for how many days.
   *
   *  USABLE courts: the season's court buffer is already taken out of this
   *  number and out of `capacityGames`, so every capacity sum in this module
   *  is what the league is really willing to book. */
  courts?: number
  /** Courts the buffer is holding empty here this weekend (owner ruling
   *  2026-08-03). Nothing scores on it — the capacity above is already the
   *  truth — but the caption names it, so a smaller number never looks like
   *  a mistake. Absent (or 0) when the season plans to the full building. */
  courtsHeld?: number
  /** Days of this weekend the gym is open (2 for a Sat–Sun). */
  days?: number
  /** Hours one court is open per day here. What turns a court-day into the
   *  number a gym manager answers ("we need 24 court-hours"). */
  hoursPerCourtDay?: number
  /** THE HOURS THIS GYM RUNS ON THIS WEEKEND (owner ruling 2026-08-06, #5), when
   *  they are not simply the gym's usual range. Carried so the per-date editor
   *  can open on what is really booked instead of guessing, and so a world that
   *  round-trips through a plan document keeps the exception it was given. */
  startTime?: string | null
  endTime?: string | null
}

/** Courts wired at a gym. A hand-built venue that only knows its court-days
 *  is read as a single day's worth of courts, which is the honest reading of
 *  "one number, no days behind it". */
function courtsAt(venue: PlannerVenue): number {
  return Math.max(1, venue.courts ?? venue.courtDays ?? 1)
}

/** Days of the weekend a gym is open. */
function daysAt(venue: PlannerVenue): number {
  if (venue.days != null) return Math.max(1, venue.days)
  if (venue.courts != null && venue.courtDays != null && venue.courts > 0) {
    return Math.max(1, Math.round(venue.courtDays / venue.courts))
  }
  return 1
}

/** Games ONE court holds across the whole weekend at this gym. */
function gamesPerCourt(venue: PlannerVenue): number {
  return Math.max(1, venue.capacityGames / courtsAt(venue))
}

/**
 * Courts a run of games needs at a gym, rounded up: the demand-sized rental
 * (owner ruling 2026-08-03, and the shape NPH's own Six Park bookings take —
 * court-contiguous, courts 1..N, sized to the weekend).
 *
 * Deliberately NOT clamped to the courts currently wired. A cohort that needs
 * eight courts at a gym we have six of is an ask for eight, and hiding that
 * behind the wiring is how a season ends up short of courts in February.
 */
export function courtsNeeded(venue: PlannerVenue, games: number): number {
  if (games <= 0) return 0
  return Math.ceil(games / gamesPerCourt(venue))
}

/** What renting those courts costs, in the unit the owner prices: court-days. */
export function courtDaysNeeded(venue: PlannerVenue, games: number): number {
  return courtsNeeded(venue, games) * daysAt(venue)
}

/** The home gym of a weekend, when the season has one on it. */
function homeVenueOf(venues: PlannerVenue[]): PlannerVenue | undefined {
  return venues.find((v) => v.role === "home")
}

function venueOf(venues: PlannerVenue[], venueId: string): PlannerVenue | undefined {
  return venues.find((v) => v.venueId === venueId)
}

/**
 * The ONE order gyms are listed in, everywhere an operator sees them: the
 * home gym, then the pool biggest first, then by name. The pool is unordered
 * as a preference (2026-08-03) — this is presentation and determinism, not a
 * fill rule, and the packer never reads it.
 */
export const UNRANKED = Number.MAX_SAFE_INTEGER

/** The league's own order for one building, or "after everything ranked". */
export const rankOf = (venue: Pick<PlannerVenue, "rank">): number => venue.rank ?? UNRANKED

/**
 * THE LEAGUE'S OWN ORDER (owner ruling 2026-08-06: "select the home, then the
 * next one, and the following one"). Home first, then the rank the operator put
 * the pool in on step 2, and only then the old fallbacks for a world nobody has
 * ordered. Alphabetical is gone as anything but a last resort: it is why a draw
 * booked Haber over Six Park for no reason anybody could name.
 */
export function orderedVenues(venues: PlannerVenue[]): PlannerVenue[] {
  return [...venues].sort(
    (a, b) =>
      (a.role === "home" ? 0 : 1) - (b.role === "home" ? 0 : 1) ||
      rankOf(a) - rankOf(b) ||
      b.capacityGames - a.capacityGames ||
      a.name.localeCompare(b.name, "en") ||
      (a.venueId < b.venueId ? -1 : a.venueId > b.venueId ? 1 : 0)
  )
}

/**
 * The rate a weekend rents at when nothing better is known: the home gym's
 * own numbers, else the first gym on the weekend. It is what lets a weekend
 * with no pool gym still say how many courts it would need.
 */
export interface VenueRate {
  gamesPerCourt: number
  days: number
  hoursPerCourtDay: number
}

function rateOf(venue: PlannerVenue): VenueRate {
  return {
    gamesPerCourt: gamesPerCourt(venue),
    days: daysAt(venue),
    hoursPerCourtDay: venue.hoursPerCourtDay ?? 0,
  }
}

/** The gym whose numbers stand for "the rate this league runs at": the home
 *  gym, else the first gym that actually has capacity. A gym open zero hours
 *  is not a rate, and reading one off it produced a one-game court. */
function rateSource(venues: PlannerVenue[]): PlannerVenue | undefined {
  const home = homeVenueOf(venues)
  if (home && home.capacityGames > 0) return home
  return venues.find((v) => v.capacityGames > 0)
}

function weekendRate(venues: PlannerVenue[], fallback?: VenueRate): VenueRate | null {
  const venue = rateSource(venues)
  return venue ? rateOf(venue) : (fallback ?? null)
}

export interface PlannerWeekend {
  /** The round this weekend materializes, in the league's own words
   *  ("Session 1", "the October session"). Absent = no rounds defined. */
  roundName?: string
  sessionId: string
  label: string
  dateISO: string
  capacityGames: number
  largestVenueCapacity: number
  venues: PlannerVenue[]
  targetGamesPerTeam: number
  assigned: string[] // unit keys
  /** Which building each grade plays in this weekend, as saved:
   *  unit key → venueId. Empty when nobody has decided yet. */
  assignedVenues: Record<string, string>
  /** Days this weekend runs (2 for a Sat–Sun). Carried so a plan's own world
   *  can recompute capacity from hours without asking the season. */
  dayCount?: number
  /** Whether the plan on screen RUNS this weekend (owner ruling 2026-08-05,
   *  #3). Absent on the season's own state, where every weekend it has is a
   *  weekend it runs. */
  chosen?: boolean
}

/**
 * A gym the SEASON has, whether or not any weekend uses it (owner ruling
 * 2026-08-04, the Haber case, and 2026-08-05, plan worlds): a league adds a gym
 * on purpose, and a planner that only knows the gyms already attached to a
 * weekend cannot offer the one nobody has phoned yet.
 */
export interface PlannerGym {
  venueId: string
  name: string
  city?: string | null
  role: VenueRole
  /** Courts WIRED here, before the court buffer holds any back. */
  courts: number
  openTime?: string | null
  closeTime?: string | null
  /** The SeasonVenue link row, for the writes step 2 and activation make. */
  seasonVenueId?: string | null
}

export interface PlannerWindow {
  /** Set when every weekend of this window shares one round: the name the
   *  column wears instead of a derived "Session N". */
  roundName?: string
  label: string
  weekends: PlannerWeekend[]
  /** A month this plan has FENCED as playoffs (owner ruling 2026-08-06): no
   *  league games are placed in it and nothing is owed there. Absent means the
   *  ordinary regular-season month, which is every month of every older world. */
  phase?: WindowPhase
}

export interface PlannerState {
  seasonId: string
  units: PlannerUnit[]
  windows: PlannerWindow[]
  errors: string[]
  /** Games each team is promised across the whole season — the season's
   *  guarantee, not a weekend's share. Absent when the season has not said
   *  yet (step 1 then leaves the games clause off its summary). */
  gamesPerTeam?: number
  /** Courts held back at every gym, every day (Season.courtBuffer). Carried so
   *  a plan's world can recompute capacity the way buildSlots does. */
  courtBuffer?: number
  /** One game's slot in minutes, same reason. */
  gameSlotMinutes?: number
  /** The Friday-evening window this league may add to a weekend (owner
   *  2026-08-07, NJC/NSC constraint). Absent = the planner's 18:00-22:00
   *  default; Season.fridayStartTime/EndTime make it configuration. */
  fridayStart?: string
  fridayEnd?: string
  /** Every gym the season has, INCLUDING the ones no weekend uses yet. This is
   *  the roster a plan's world starts from. */
  gyms?: PlannerGym[]
}

export type PlannerLever = "balance" | "compact" | "spread" | "one-gym"

/**
 * A suggestion the operator can take with one tap: which grade goes where,
 * with the numbers on both ends so the button is never a leap of faith. The
 * board applies it through the same state change a drag makes.
 */
export interface SuggestionMove {
  unitKey: string
  unitLabel: string
  /** Games the grade brings, counted on the weekend it is leaving. */
  games: number
  fromSessionId: string
  fromLabel: string
  toSessionId: string
  toLabel: string
  /** The weekend it leaves, as it stands right now. */
  fromBefore: { demand: number; capacity: number }
  /** The weekend it lands on, with this grade already added. */
  toAfter: { demand: number; capacity: number }
  /**
   * What taking the move fixes.
   *
   * "idle-weekend" is gone (owner ruling 2026-08-05, #5): a move whose whole
   * point was to put an empty weekend to work ADDS a weekend, and a weekend is
   * the second most expensive thing on the price list. Under compact-first an
   * idle chosen weekend is the plan working, not a problem, so nothing offers a
   * button to undo it. The note itself still ships (see PlannerSuggestion.kind);
   * it simply has nothing to press.
   */
  resolves: "shortage" | "two-building"
  /** Where the grade ends up standing when it gets there, when that is not the
   *  building it has been playing: "Lands at Six Park (The Playground holds
   *  Grade 10, 42 of 48)." Empty for the ordinary case, where it keeps its own
   *  gym. The same clause the sentence carries, handed over as data so a
   *  surface can put it somewhere else without parsing prose. */
  lands: string
}

export interface PlannerSuggestion {
  kind: "overflow" | "extend-hours" | "move-unit" | "idle-weekend" | "two-building"
  sessionId: string
  text: string
  /** Present when the suggestion is one tap away from being done. Additive:
   *  a reader that does not know about it still has the whole sentence. */
  move?: SuggestionMove
}

/** Weekend demand in games for a set of assigned units. */
export function weekendDemand(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam">,
  assigned: string[]
): number {
  let games = 0
  for (const key of assigned) {
    const u = units.find((x) => x.key === key)
    if (u) games += Math.ceil((u.teams * weekend.targetGamesPerTeam) / 2)
  }
  return games
}

/**
 * Where a weekend stops being comfortable. Not a hard limit: at 85% of the
 * courts an operator is out of room to absorb a late entry or a double
 * booking, which is exactly when they want to see amber and think again.
 */
/** 0.95 since 2026-08-10 (QA T-008 badge restraint): at 0.85 a WELL-PACKED
 *  board — which is the solver's goal — wore amber everywhere, so real
 *  fires vanished. Amber now means "one more game might not fit". */
export const TIGHT_RATIO = 0.95

export type WeekendTone = "unavailable" | "empty" | "roomy" | "tight" | "over"

export interface WeekendLoad {
  demand: number
  capacity: number
  /** demand ÷ capacity. 0 on an empty weekend, Infinity when there is
   *  demand and no gym at all (callers clamp before painting a bar). */
  ratio: number
  tone: WeekendTone
  /** The weekend really opens a second building, as the packer places it.
   *  Read from packWeekendVenues, never guessed from the biggest gym: a
   *  guess and the packing disagreed, and the packing is what ships. */
  twoBuildings: boolean
}

/** The grades a weekend holds, deduped, in the order they were listed. */
function unitsOn(units: PlannerUnit[], assigned: string[]): PlannerUnit[] {
  const seen = new Set<string>()
  const out: PlannerUnit[] = []
  for (const key of assigned) {
    if (seen.has(key)) continue
    seen.add(key)
    const u = units.find((x) => x.key === key)
    if (u) out.push(u)
  }
  return out
}

/**
 * One weekend's whole visual state, in one deterministic place: the board,
 * the header pill and the published calendar card all read tone from here so
 * amber means the same thing on every surface.
 *
 * Tone order matters. "over" wins over "unavailable" when a weekend somehow
 * holds grades with no gym behind them, because that is a real problem the
 * operator must see, not a quiet dashed cell. A weekend with no gym AND no
 * grades is simply not theirs that weekend.
 */
export function weekendLoad(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "capacityGames" | "venues"> &
    Partial<Pick<PlannerWeekend, "assignedVenues">>,
  assigned: string[]
): WeekendLoad {
  const demand = weekendDemand(units, weekend, assigned)
  const capacity = weekend.capacityGames
  const ratio = capacity > 0 ? demand / capacity : demand > 0 ? Infinity : 0
  // Buildings come from the real packing, against whatever gyms the weekend
  // already has saved — the same answer the board draws its sections from.
  const packed = packWeekendVenues(unitsOn(units, assigned), weekend, weekend.assignedVenues ?? {})
  const twoBuildings = packed.opened.length > 1
  const tone: WeekendTone =
    demand > capacity
      ? "over"
      : capacity <= 0
        ? "unavailable"
        : demand === 0
          ? "empty"
          : ratio >= TIGHT_RATIO
            ? "tight"
            : "roomy"
  return { demand, capacity, ratio, tone, twoBuildings }
}

/**
 * WHAT A WEEKEND ACTUALLY HAS (owner ruling 2026-08-05, capacity honesty).
 *
 * `weekend.capacityGames` adds up every gym ATTACHED to the weekend, which is
 * not what the season holds: a pool building is not capacity until somebody
 * rents courts in it. So the number a screen shows is the packed truth —
 *
 *    the home gym's usable courts  +  the courts this calendar rents
 *
 * and nothing else. The rentals come from the same blocks the ask sheet reads,
 * so the fraction on a weekend card, the meters and the booking sheet can never
 * tell three different stories. A rental is demand-sized, so a weekend whose
 * spill is housed always reads at or under its capacity, and a weekend with an
 * empty block reads over it, which is exactly the fact worth seeing.
 */
export function packedCapacity(
  weekend: Pick<PlannerWeekend, "venues">,
  blocks: RentalBlock[]
): number {
  const home = homeVenueOf(weekend.venues)
  let capacity = home?.capacityGames ?? 0
  for (const block of blocks) {
    if (!block.venueId) continue
    const venue = venueOf(weekend.venues, block.venueId)
    if (!venue || venue.role !== "pool") continue
    capacity += courtsCapacityAt(venue, block.courts)
  }
  return capacity
}

/**
 * What N courts at this gym hold, in games: the unit a rented section is
 * really measured in. Never past what the whole building could give, even
 * where the rounding would say otherwise.
 */
export function courtsCapacityAt(venue: PlannerVenue, courts: number): number {
  if (courts <= 0) return 0
  return Math.min(venue.capacityGames, Math.round(courts * gamesPerCourt(venue)))
}

/**
 * WHAT THE BUILDING COULD HOLD, at N courts of it (owner ruling 2026-08-05, #2 —
 * the switch-guard fix).
 *
 * courtsCapacityAt answers the same question about the courts we ALREADY rent,
 * and clamps to them. That clamp is exactly what made every destination read
 * full: a rental is demand-sized, so "the courts we rent" minus "the games in
 * them" is always about nothing, and the ⇄ affordance disappeared after the
 * first move.
 *
 * This one is not clamped to the attachment. It asks what the building would
 * give if we rented more of it — which is precisely what moving a grade into it
 * does — at the rate the weekend already runs at (its hours, its days). A gym
 * that is SHUT still holds nothing: no hours is not a big empty building, it is
 * a closed one.
 */
export function buildingCapacityAt(venue: PlannerVenue, courts: number): number {
  if (courts <= 0 || venue.capacityGames <= 0) return 0
  return Math.max(0, Math.floor((venue.capacityGames / courtsAt(venue)) * courts))
}

/**
 * A weekend's load against the capacity it actually commits. Same tone ladder
 * as weekendLoad — one vocabulary on this screen — read off the packed number
 * so "over" means games with no court behind them rather than games past a
 * building nobody has phoned.
 */
export function packedWeekendLoad(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "capacityGames" | "venues"> &
    Partial<Pick<PlannerWeekend, "assignedVenues">>,
  assigned: string[],
  blocks: RentalBlock[]
): WeekendLoad {
  const full = weekendLoad(units, weekend, assigned)
  const capacity = packedCapacity(weekend, blocks)
  const ratio = capacity > 0 ? full.demand / capacity : full.demand > 0 ? Infinity : 0
  const tone: WeekendTone =
    full.demand > capacity
      ? "over"
      : capacity <= 0
        ? "unavailable"
        : full.demand === 0
          ? "empty"
          : ratio >= TIGHT_RATIO
            ? "tight"
            : "roomy"
  return { demand: full.demand, capacity, ratio, tone, twoBuildings: full.twoBuildings }
}

export interface PlanSummary {
  /** Nothing overflows and every grade has a weekend in every window. */
  fits: boolean
  over: number
  tight: number
  unavailable: number
  /** Grades (not weekends) missing from at least one window. */
  unplaced: number
  /** Total games the whole plan asks for. */
  games: number
}

/**
 * The one-line verdict behind the header pill. A grade counts as unplaced
 * when a window holds no weekend for it: the league promised that grade a
 * weekend that month, so a hand edit that drops it is a hole, not a choice.
 */
export function planSummary(
  state: PlannerState,
  assignment: Record<string, string[]>
): PlanSummary {
  let over = 0
  let tight = 0
  let unavailable = 0
  let games = 0
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const load = weekendLoad(state.units, w, assignment[w.sessionId] ?? [])
      games += load.demand
      if (load.tone === "over") over++
      else if (load.tone === "tight") tight++
      else if (load.tone === "unavailable") unavailable++
    }
  }

  const playing = state.units.filter((u) => u.teams > 0)
  const unplaced = playing.filter((u) =>
    state.windows.some(
      (win) => !win.weekends.some((w) => (assignment[w.sessionId] ?? []).includes(u.key))
    )
  ).length

  return { fits: over === 0 && unplaced === 0, over, tight, unavailable, unplaced, games }
}

/* ------------------------- step 5: registration vs plan ------------------ */

export interface AttentionWeekend {
  sessionId: string
  label: string
  load: WeekendLoad
}

/**
 * The weekends worth looking at before anything else: past their courts, or
 * close enough that one late entry breaks them. Same tone vocabulary as the
 * board, so amber on the watch screen means what amber means on the calendar.
 *
 * Broken weekends come first, then full ones, each in calendar order. A
 * screen that shows only its first couple of sentences must lead with the
 * weekend that is actually short of courts, not the one that merely has no
 * spare slot.
 *
 * It reads the units' `teams`, the planning number, which is the operator's
 * estimate. Registration is drawn against that estimate rather than folded
 * into it, so a grade that outgrows its number shows up as a warning here and
 * on the bars, in October, while a court can still be booked.
 */
export function weekendsNeedingAttention(
  state: PlannerState,
  assignment: Record<string, string[]>
): AttentionWeekend[] {
  const over: AttentionWeekend[] = []
  const tight: AttentionWeekend[] = []
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const load = weekendLoad(state.units, w, assignment[w.sessionId] ?? [])
      if (load.tone === "over") over.push({ sessionId: w.sessionId, label: w.label, load })
      else if (load.tone === "tight") tight.push({ sessionId: w.sessionId, label: w.label, load })
    }
  }
  return [...over, ...tight]
}

export interface RegistrationBar {
  key: string
  label: string
  /** Teams registered so far. */
  approved: number
  /** The step-1 estimate. Zero means nobody estimated this grade. */
  expected: number
  /** 0–1 of the track the solid registered bar fills. */
  fill: number
  /** There was a plan for this grade, and registration passed it. */
  over: boolean
}

/**
 * One bar per grade for the watch screen: what registered against what step 1
 * expected. A grade that beat its estimate fills the whole track (the track
 * grows to the real number) and says so, the way the approved mock reads
 * "30 of 27 expected".
 *
 * Grades nobody expected and nobody registered are not rows: an empty grade
 * is not news. A grade with teams but no estimate is a row with nothing to
 * measure against, never an "over plan" alarm.
 */
export function registrationBars(units: PlannerUnit[]): RegistrationBar[] {
  return units
    .filter((u) => u.approved > 0 || u.expected > 0)
    .map((u) => {
      const track = Math.max(u.expected, u.approved)
      return {
        key: u.key,
        label: u.label,
        approved: u.approved,
        expected: u.expected,
        fill: track > 0 ? u.approved / track : 0,
        over: u.expected > 0 && u.approved > u.expected,
      }
    })
}

/**
 * The lead line of the watch screen's alert: which grades outgrew the
 * estimate, and by how much. Null while registration is still inside the
 * plan, so the alert stays quiet when there is nothing to say.
 */
export function overPlanSentence(bars: RegistrationBar[]): string | null {
  const parts = bars
    .filter((b) => b.over)
    .map((b) => {
      const by = b.approved - b.expected
      return `${b.label} is ${by} team${by === 1 ? "" : "s"} over plan`
    })
  if (parts.length === 0) return null
  if (parts.length === 1) return `${parts[0]}.`
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.`
}

/** The words youth sport already abbreviates a particular way. Cutting
 *  "Junior" to its first two letters would read "Ju", which nobody writes. */
const KNOWN_HEADS: Record<string, string> = {
  junior: "Jr",
  senior: "Sr",
  juvenile: "Juv",
  varsity: "Var",
  novice: "Nov",
  intermediate: "Int",
  development: "Dev",
}

/**
 * A grade in poster shorthand: "Grade 7" → "Gr7", "U14" → "U14", "Junior
 * Girls" → "JrG". Published calendars have five columns and no room for
 * "Grade 11 Boys", and this is how operators already abbreviate on the
 * posters they hand-build today (owner-approved mock, 2026-08-02).
 */
export function gradeAbbrev(label: string): string {
  const trimmed = label.trim()
  const grade = trimmed.match(/^grade\s*(\d+)/i)
  if (grade) return `Gr${grade[1]}`
  const under = trimmed.match(/^u\s*(\d+)$/i)
  if (under) return `U${under[1]}`
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 0) return trimmed
  const raw = words[0].slice(0, words.length > 1 ? 2 : 3)
  const head = KNOWN_HEADS[words[0].toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
  const rest = words.slice(1).map((w) => w[0].toUpperCase())
  // Five characters is what a month column can hold without wrapping.
  return `${head}${rest.join("")}`.slice(0, 5)
}

/**
 * The grades on one weekend, the way a poster writes them: "Gr7 8 9 11 JrG".
 * A run of numbered grades keeps the "Gr" only on the first — repeating it
 * five times is noise, and this is exactly how the approved mock reads.
 */
export function gradeLine(labels: string[]): string {
  const out: string[] = []
  let previousWasGrade = false
  for (const label of labels) {
    const abbrev = gradeAbbrev(label)
    const numbered = abbrev.match(/^Gr(\d+)$/)
    out.push(numbered && previousWasGrade ? numbered[1] : abbrev)
    previousWasGrade = Boolean(numbered)
  }
  return out.join(" ")
}

/**
 * The day half of a weekend label, for surfaces that already say the month
 * in a column header: "Oct 24–25" → "24–25", "Oct 31–Nov 1" → "31–1".
 * Reads the numbers out of the label rather than reformatting dates, so it
 * can never disagree with weekendLabel() about which days a weekend is.
 */
export function weekendDays(label: string): string {
  return label
    .split("–")
    .map((part) => part.match(/\d+/)?.[0] ?? part.trim())
    .join("–")
}

/**
 * The same job for a column that already heads itself with a month, but
 * honest about the weekend that straddles two of them: "Oct 24–25" → "24–25",
 * "Oct 31–Nov 1" → "31–Nov 1". The board's chip captions and the season
 * strip's weekend headers both read this, so a weekend is never spelled two
 * ways on one screen.
 */
export function weekendShortDays(label: string): string {
  const [from, to] = label.split("–")
  if (!to) return label
  return `${from.match(/\d+/)?.[0] ?? from.trim()}–${to.trim()}`
}

export interface CalendarMonth {
  /** "Oct" — the window's month, which heads the column. */
  month: string
  weekends: Array<{
    sessionId: string
    /** "24–25" (the month lives in the column header). */
    days: string
    /** "Gr7 8 9 11 JrG" — the poster line, run-compressed. */
    grades: string
    /** ["Gr7", "Gr8", "Gr9", "Gr11", "JrG"] — one per chip on the web page,
     *  where each grade is its own thing a parent scans for. */
    gradeList: string[]
  }>
}

/**
 * The published season calendar: month columns, each listing only the
 * weekends that actually hold grades. ONE function behind both renderings —
 * the PNG card that travels to Instagram and the living view on the public
 * league page — so the poster and the page can never drift apart.
 */
export function seasonCalendarMonths(
  state: PlannerState,
  assignment: Record<string, string[]>
): CalendarMonth[] {
  const order = new Map(state.units.map((u, i) => [u.key, i]))
  const labelOf = new Map(state.units.map((u) => [u.key, u.label]))
  const months: CalendarMonth[] = []
  for (const win of state.windows) {
    const weekends: CalendarMonth["weekends"] = []
    for (const w of win.weekends) {
      const keys = (assignment[w.sessionId] ?? [])
        .filter((k) => labelOf.has(k))
        .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      if (keys.length === 0) continue
      const labels = keys.map((k) => labelOf.get(k) as string)
      weekends.push({
        sessionId: w.sessionId,
        days: weekendDays(w.label),
        grades: gradeLine(labels),
        gradeList: labels.map(gradeAbbrev),
      })
    }
    if (weekends.length === 0) continue
    // Windows are keyed "Oct 2026"; the card and the page head the column
    // with the month alone, the way the board already does.
    months.push({ month: win.label.split(" ")[0], weekends })
  }
  return months
}

/**
 * A grade's estimate, split across the divisions that make up that grade.
 * The operator counts in grades ("14 Grade 7 teams"); the season stores the
 * number per division, so a cluster spanning two divisions splits evenly
 * and the remainder lands on the first ones. Per-division precision is not
 * the point of a pre-registration estimate — the grade total is.
 */
export function expectedTeamUpdates(
  divisionIds: string[],
  total: number
): Array<{ divisionId: string; expectedTeams: number }> {
  if (divisionIds.length === 0) return []
  const per = Math.floor(total / divisionIds.length)
  let remainder = total - per * divisionIds.length
  return divisionIds.map((divisionId) => {
    const expectedTeams = per + (remainder > 0 ? 1 : 0)
    remainder--
    return { divisionId, expectedTeams }
  })
}

/* ----------------------------- WHAT THINGS COST -------------------------- */

/**
 * ONE PRICE LIST, read by both things that choose: the per-weekend packer
 * (packWeekendVenues) and the per-window search (proposePlan). They used to
 * score in different currencies — the packer in court-days, the search in
 * court-days plus weekends — and a board fill could therefore disagree with a
 * solve about the same weekend. Now they buy with the same money.
 *
 * The order the terms outrank each other, and WHY each gap is the size it is:
 *
 *   1. overflow            1,000,000 a game   a game with no court is not a plan
 *   2. AN IDLE CONFIRMED BOOKING 150,000 a booking  you are paying for it already
 *   3. a weekend used        100,000 a weekend bundle the month up
 *   4. A RENTAL BOOKING       25,000 a booking one big rental, not three small
 *   5. AN EMPTY CONFIRMED COURT-DAY 3,000 a court-day fill what you booked first
 *   6. a rented court-day      1,000 a court-day then buy the cheapest rooms
 *   7. back-to-back weekends  10,000 a grade   never two Saturdays in a row
 *   8. peak games                100 a game    then keep the busiest day sane
 *   9. the two giants apart        40          then the small courtesies
 *  10. a residency switch            5
 *
 * (7 sits out of numeric order on purpose: it is ranked between a booking and
 * a court-day by INTENT — it may spend courts to separate two weekends, never a
 * booking — and its number only has to beat the tiebreaks under it.)
 *
 * WHY THE TWO CONFIRMED TERMS SIT WHERE THEY DO (owner ruling 2026-08-06:
 * "confirmed bookings are obligations"). A booking the league has already made
 * is money out of the door whether anybody plays in it or not, so an empty one
 * is not a saving, it is waste:
 *
 *  - AN IDLE CONFIRMED BOOKING (2) outranks a weekend, so no lever — spread
 *    included — may strand a booked weekend to lay the season out flat. It sits
 *    UNDER overflow, because a game nobody can play is still worse than a room
 *    nobody used.
 *  - AN EMPTY CONFIRMED COURT-DAY (5) outranks a rented one (6) three to one, so
 *    the search fills space it has paid for before it rents any more, and sits
 *    UNDER a booking (4) so it can never buy one. That is "consume confirmed
 *    capacity before creating an assumed booking", as arithmetic.
 */

/**
 * WHAT A RENTED COURT-DAY COSTS THE SEARCH (owner ruling 2026-08-03: the
 * money is the rented courts, and consolidation outranks residency).
 *
 * A court-day at 1,000 beats ten games of peak (100 each), so the search will
 * happily take a heavier weekend in the home gym over a flatter one that rents
 * another court. Overflow stays a million a game, so nothing here can buy a
 * game that cannot be played.
 *
 * This replaces the pair that used to run the score: SECOND_BUILDING_COST
 * (150, or 1,500 under the one-gym lever) and GYM_VIOLATION_COST (25,000).
 * The 25,000 made residency outrank everything except overflow, which is
 * exactly the trade the owner reversed on 2026-08-03 after the NPH waste
 * audit: 17-30 Six Park court-days a season were being rented to keep grades
 * in the building they were used to.
 */
const RENTED_COURT_DAY_COST = 1_000

/**
 * WHAT A BOOKING COSTS (owner ruling 2026-08-05): "Just because I selected
 * multiple weekends and Six Park is available, you scheduled multiple smaller
 * 2-3 court sessions across weekends. Make it as big as possible — they can
 * split it later. Two smaller sessions on different weekends should combine
 * into one bigger session on one weekend."
 *
 * A booking is ONE rented building on ONE weekend: the phone call, the deposit,
 * the crew, the caretaker, the sign on the door. Court-days alone could not see
 * it — 3 courts twice and 6 courts once are the same twelve court-days — so the
 * search kept spreading a rental thin across a month and the operator kept
 * having to phone twice for it.
 *
 * WHY 25,000, between a weekend (100,000) and a court-day (1,000):
 *  (a) At equal court-days one booking always beats two, and by a margin no
 *      tiebreak under it can close: 25,000 is 250 games of peak and 5,000
 *      residency switches, so a 6-court booking wins over two 3-court ones even
 *      when consolidating doubles the busiest weekend's load.
 *  (b) It can never buy a weekend. Splitting a rental across two Saturdays is
 *      the only way one weekend's demand ever needs FEWER buildings, and a
 *      weekend costs four bookings, more than any real weekend opens (no world
 *      here has four pool gyms free on one Saturday).
 *  (c) It can never buy an overflow: a game with no court is forty bookings.
 *  (d) The home gym is not in it. Bookings are counted off the rental blocks,
 *      and the building the league owns never produces one, so a weekend that
 *      never leaves home still costs nothing at all.
 *  (e) It outranks court-days on purpose — fewest bookings, then court-days,
 *      then buildings — so the search will rent up to 25 extra court-days to
 *      keep a month's rental in one place. That is the ruling: make it big, and
 *      let the operator split it later if the gym asks them to.
 */
const RENTAL_BLOCK_COST = 25_000

/**
 * A CONFIRMED BOOKING WITH NOTHING IN IT (owner ruling 2026-08-06). The league
 * phoned that gym, holds that Saturday and is paying for it. Leaving it idle to
 * play somewhere else is the one waste the operator can see on their own bank
 * statement, so it costs more than opening a weekend (100,000) and less than a
 * game nobody can play (1,000,000).
 *
 * This is what makes SPREAD safe: laying the season out flat may rearrange the
 * grades inside the weekends the league has booked, and may never walk away from
 * one to use a Saturday it has not.
 */
const IDLE_CONFIRMED_BOOKING_COST = 150_000

/**
 * THE RENTALS THIS WEEKEND HAS ALREADY BOOKED (owner ruling 2026-08-06). Pool
 * gyms the plan really holds here — declared on step 2, or placed by the
 * operator's own hand — with the court-days behind them.
 *
 * The home gym is deliberately not in it: the league owns that building, there
 * is no booking to waste, and its court-days cost nothing either way.
 */
function confirmedRentals(weekend: Pick<PlannerWeekend, "venues">): {
  venues: Array<{ venueId: string; courtDays: number }>
  bookings: number
  courtDays: number
} {
  const venues = weekend.venues
    .filter((v) => v.booked === true && v.role === "pool")
    .map((v) => ({ venueId: v.venueId, courtDays: v.courtDays ?? 0 }))
  return {
    venues,
    bookings: venues.length,
    courtDays: venues.reduce((sum, v) => sum + v.courtDays, 0),
  }
}

/**
 * A CONFIRMED COURT-DAY NOBODY USED (owner ruling 2026-08-06). Three times what
 * renting a fresh one costs (1,000), so the search always fills space the league
 * has paid for before it books anything new — and well under a booking (25,000),
 * so it can never buy one of those to avoid a little slack.
 */
const UNUSED_CONFIRMED_COURT_DAY_COST = 3_000

/**
 * What a residency switch costs now: a tiebreak, and nothing more. Five is
 * under a twentieth of one game of peak, so it can separate two answers that
 * cost the same money and can never buy one that does not.
 */
const RESIDENCY_SWITCH_COST = 5

/**
 * WHAT A WEEKEND COSTS (owner ruling 2026-08-03: compact-first is the
 * default). A month that fits on one weekend runs on one weekend. Bundling big
 * is how a league actually wants to run — one address, one setup, one crew,
 * families out one Saturday instead of three — and everything else is a
 * refinement inside that shape.
 *
 * 100,000 puts it exactly where the ruling puts it: far under overflow (a
 * million a game, so a weekend is never bundled into a game that cannot be
 * played) and far over a rented court-day (1,000, so the search WILL rent
 * courts to keep the month on one weekend). A hundred court-days would have to
 * ride on one extra weekend before renting became the cheaper answer, and no
 * month rents anything like that.
 */
const WEEKEND_USED_COST = 100_000

/** The spread lever's mirror: what an IDLE weekend costs when the operator has
 *  asked for the season laid out flat. Left where it was, because spread is
 *  the alternative shape and not the default any more. */
const WEEKEND_IDLE_COST = 50_000

/**
 * NO BACK-TO-BACK WEEKENDS (owner ruling 2026-08-05): a grade must not play two
 * adjacent Saturdays, and the month boundary is not an excuse — Oct 31 then
 * Nov 7 is the same two weekends in a row to the family driving to both.
 *
 * WHY 10,000, and why it is ranked where it is:
 *  - UNDER a booking (25,000), a weekend (100,000) and overflow (1,000,000), so
 *    separating two weekends can never open a rental, run an extra Saturday, or
 *    strand a game. When the only free weekend is the adjacent one, the grade
 *    plays it: a plan that runs beats a plan that is polite.
 *  - OVER every tiebreak under it: 100 games of peak, 250 giant-courtesies,
 *    2,000 residency switches. No grade in any real league brings 100 games to
 *    a weekend, so moving one grade off an adjacent Saturday always wins on
 *    peak, which is the whole point — the solver must take the far weekend when
 *    there is one.
 *  - It may spend court-days (1,000) to get the gap, up to ten of them. That is
 *    deliberate: a couple of extra courts is a cheaper answer than a family
 *    playing two Saturdays running.
 */
const ADJACENT_WEEKEND_COST = 10_000

/** How close two weekends have to be to count as back-to-back. Eight days, so
 *  the next Saturday (7) is caught and the one after (14) is not, whichever day
 *  of the weekend a session happens to be dated on. */
const ADJACENT_DAYS = 8

/** Whole days between two weekend dates, or Infinity when either side is a date
 *  nobody has ("" on a world that never had one) — an unknown date is never
 *  called back-to-back with anything. */
function daysApart(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return Infinity
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Number.isFinite(ms) ? ms / 86_400_000 : Infinity
}

/** Are these two weekends the same grade's two Saturdays in a row? The same
 *  weekend twice is not: that is one weekend, however it got here. */
function backToBack(a: string | undefined, b: string | undefined): boolean {
  const days = daysApart(a, b)
  return days > 0 && days <= ADJACENT_DAYS
}

/* ------------------------- which gym a grade plays in -------------------- */

/**
 * WHY a grade ended up in the building it did (owner 2026-08-02: "why you kept
 * the grades — their home gym, that's where they play most of their games").
 * The board writes it in words, the strip says it in the cell's label, and
 * neither has to guess whether a gym was picked, kept, or forced.
 *
 *  - "decided":  somebody chose this gym. The saved plan, or a hand switch.
 *  - "home":     it is in the building the league owns, which costs nothing.
 *  - "rented":   the home gym was full, so this cohort is in a gym we pay for.
 *  - "resident": the grade went back to the rented gym it has been playing.
 *  - "bumped":   its own gym could not hold it, so it moved. For a grade that
 *                alternates buildings the same word means the mirror miss: it
 *                had to repeat the building it just played.
 *  - "avoided":  an alternating grade steered off the building it just played.
 *  - "overflow": no gym on the weekend can hold it whole.
 *  - "fill":     LEGACY, from the days when gyms filled in a fixed order. No
 *                packing produces it any more; the member stays so a caller
 *                that switches on the union still compiles.
 */
export type PlacementReason =
  | "decided"
  | "home"
  | "rented"
  | "resident"
  | "fill"
  | "bumped"
  | "avoided"
  | "overflow"

/**
 * One building a weekend RENTS: cohort-atomic (whole grades, never halves),
 * demand-sized (the courts those grades' games actually need), and priced in
 * the unit the owner buys — court-days.
 *
 * `venueId` is null when the demand is real and there is no pool gym to put
 * it in: the weekend has none attached, or the ones it has are full. That is
 * the empty slot an operator has to go and rent.
 */
export interface RentalBlock {
  /** The weekend. Set by planRentalBlocks; blocks from one weekend's own
   *  packing carry the session they were packed for. */
  sessionId: string
  /** The pool gym, or null when nothing on this weekend can take it. */
  venueId: string | null
  /** Courts to rent, for the whole weekend. Court numbers are not our
   *  concern — gyms rent contiguous courts and we ask for a count. */
  courts: number
  /** Days of the weekend those courts are needed. */
  days: number
  /** courts × days: what the rental costs. */
  courtDays: number
  /** Court-hours behind those court-days, which is what a gym quotes on. */
  hoursNeeded: number
  /** Games the cohorts in this block bring. */
  games: number
  /** The whole cohorts this block houses. */
  unitKeys: string[]
}

export interface WeekendVenuePacking {
  /** The one gym each grade plays in this weekend: unit key → venueId. */
  byUnit: Record<string, string>
  /** Why each grade is where it is: unit key → reason. Same keys as `byUnit`,
   *  plus any grade the weekend stranded with no gym at all. */
  reasonByUnit: Record<string, PlacementReason>
  /** Gyms that took at least one grade: the home gym first when it was used,
   *  then the pool buildings in the order they were opened. */
  opened: string[]
  /** Games no gym could hold. */
  overflow: number
  /** Residency switches: grades that did not get the building they had been
   *  playing. Since 2026-08-03 this is a soft tiebreak, never worth an extra
   *  rented court-day — the number is kept because the sentences read it. */
  violations: number
  /** Court-days this weekend RENTS. The home gym is free, so this is the
   *  whole cost of the weekend. */
  rentedCourtDays: number
  /** The rentals behind that number, one per pool building opened, plus one
   *  with a null venue for demand nothing could house. */
  blocks: RentalBlock[]
}

/** Games one grade asks for on one weekend. */
function unitGames(unit: PlannerUnit, targetGamesPerTeam: number): number {
  return Math.ceil((unit.teams * targetGamesPerTeam) / 2)
}

/**
 * The rentals behind a finished placement: whole cohorts grouped by the POOL
 * building they landed in, plus one block for demand nothing could house.
 *
 * ONE function derives every rental number in the product — the packer's own
 * cost, the board's blocks, and the ask sheet — from a placement map. That is
 * why the board and the blocks can never disagree: they are the same numbers,
 * read off the same answer.
 */
function rentalBlocksFrom(
  sessionId: string,
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues">,
  byUnit: Record<string, string>,
  /** Whole cohorts no building took. Cohort-atomic, so these are exact. */
  unhousedKeys: string[],
  fallback?: VenueRate
): RentalBlock[] {
  const target = weekend.targetGamesPerTeam
  const blocks: RentalBlock[] = []
  const gamesOf = (u: PlannerUnit) => unitGames(u, target)
  const byKey = new Map(units.map((u) => [u.key, u]))
  /** Games with nowhere to play: whole cohorts nothing could take, plus what
   *  spills past the courts of a building somebody put too much into. */
  let homeless = unhousedKeys.reduce((sum, key) => {
    const u = byKey.get(key)
    return sum + (u ? gamesOf(u) : 0)
  }, 0)

  const nowhere = new Set(unhousedKeys)
  for (const venue of orderedVenues(weekend.venues)) {
    // A cohort in `unhousedKeys` has no building. It may still appear in
    // `byUnit`, because the board has to draw it somewhere, and counting it
    // both as a rental here and as an empty slot would bill it twice.
    const here = units.filter(
      (u) => byUnit[u.key] === venue.venueId && !nowhere.has(u.key) && gamesOf(u) > 0
    )
    if (here.length === 0) continue
    const games = here.reduce((sum, u) => sum + gamesOf(u), 0)
    // A building can only be rented up to the courts it has. Anything past
    // that is not a bigger block here, it is demand with nowhere to go.
    const housed = Math.min(games, venue.capacityGames)
    homeless += games - housed
    if (venue.role !== "pool") continue
    const courts = courtsNeeded(venue, housed)
    const days = daysAt(venue)
    blocks.push({
      sessionId,
      venueId: venue.venueId,
      courts,
      days,
      courtDays: courts * days,
      hoursNeeded: courts * days * (venue.hoursPerCourtDay ?? 0),
      games,
      unitKeys: here.map((u) => u.key),
    })
  }

  if (homeless > 0) {
    // No gym for it: size the ask at the rate the league already runs at, so
    // "we need three more courts" is a number somebody can phone a gym with.
    // The keys are the whole cohorts nothing could take; games can be larger
    // than those cohorts when a building is also over its courts, and that
    // extra is real demand with no cohort of its own to name.
    const rate = weekendRate(weekend.venues, fallback)
    const courts = rate ? Math.ceil(homeless / rate.gamesPerCourt) : 0
    const days = rate?.days ?? 1
    blocks.push({
      sessionId,
      venueId: null,
      courts,
      days,
      courtDays: courts * days,
      hoursNeeded: courts * days * (rate?.hoursPerCourtDay ?? 0),
      games: homeless,
      unitKeys: unhousedKeys,
    })
  }

  return blocks
}

/**
 * One weekend's grades sorted into buildings (owner ruling 2026-08-03, venue
 * model v2 — fill order is dead).
 *
 * The rules, in the order they now outrank each other:
 *  1. A grade plays ONE gym per weekend. Never split across buildings — the
 *     whole point is that a family drives to one address.
 *  2. THE HOME GYM FILLS FIRST. It is the building the league owns, so every
 *     whole cohort it can hold is a cohort nobody pays for. Biggest cohort
 *     first, because a big one placed late is the one that opens a rental.
 *  3. What does not fit becomes RENTAL BLOCKS, and the packer buys the
 *     cheapest ones: fewest rented court-days first, then fewest buildings
 *     opened (adding a cohort to a building already rented usually costs
 *     nothing extra), and only then residency.
 *  4. CONSOLIDATION OUTRANKS RESIDENCY (the 2026-08-03 reversal). A grade
 *     going back to the building it has been playing is a tiebreak between
 *     equally priced answers, never a reason to rent another court-day. A
 *     grade flagged `alternate` inverts `prior`: that is the building to
 *     AVOID, and taking it anyway is the cost.
 *
 * `decided` names the grades somebody already chose a gym for. A decided gym
 * is seated first and unconditionally — even where it puts that building over
 * its courts — so the packing agrees with what the board draws.
 */
export function packWeekendVenues(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues"> &
    Partial<Pick<PlannerWeekend, "sessionId">>,
  prior: Record<string, string>,
  decided?: ReadonlySet<string>,
  fallbackRate?: VenueRate
): WeekendVenuePacking {
  const byUnit: Record<string, string> = {}
  const reasonByUnit: Record<string, PlacementReason> = {}
  const venues = weekend.venues
  const target = weekend.targetGamesPerTeam
  /** A picked gym is always the reason, whatever route the packing took to
   *  it: the operator's choice outranks every rule the packer applies. */
  const mark = (key: string, reason: PlacementReason) => {
    reasonByUnit[key] = decided?.has(key) ? "decided" : reason
  }

  if (units.length === 0 || venues.length === 0) {
    const strandedKeys: string[] = []
    for (const u of units) {
      if (unitGames(u, target) > 0) {
        reasonByUnit[u.key] = "overflow"
        strandedKeys.push(u.key)
      }
    }
    const blocks = rentalBlocksFrom(
      weekend.sessionId ?? "",
      units,
      weekend,
      byUnit,
      strandedKeys,
      fallbackRate
    )
    return {
      byUnit,
      reasonByUnit,
      opened: [],
      overflow: blocks.find((b) => b.venueId === null)?.games ?? 0,
      violations: 0,
      rentedCourtDays: 0,
      blocks,
    }
  }

  const remaining = venues.map((v) => v.capacityGames)
  const opened = venues.map(() => false)
  const indexOf = new Map<string, number>()
  venues.forEach((v, k) => indexOf.set(v.venueId, k))
  const homeIndex = venues.findIndex((v) => v.role === "home")
  let violations = 0
  const unhousedKeys: string[] = []

  /** Games already sitting in each building, so a marginal court-day is a
   *  real marginal: the sixth cohort into a building we already rent six
   *  courts of costs nothing at all. */
  const load = venues.map(() => 0)
  const seat = (k: number, u: PlannerUnit, games: number, reason: PlacementReason) => {
    byUnit[u.key] = venues[k].venueId
    mark(u.key, reason)
    opened[k] = true
    remaining[k] -= games
    load[k] += games
  }

  // 1. Decided gyms, seated before anything competes for the room. They win
  //    outright: an operator who pinned a grade to a building meant it.
  const queue: PlannerUnit[] = []
  const byKey = [...units].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  for (const u of byKey) {
    const games = unitGames(u, target)
    if (games <= 0) continue // a grade with no teams claims no gym
    const pinned = decided?.has(u.key) ? indexOf.get(prior[u.key] ?? "") : undefined
    if (pinned === undefined) {
      queue.push(u)
      continue
    }
    seat(pinned, u, games, "decided")
  }

  // 2. Everybody else, biggest cohort first. Ties by key, so two grades of
  //    the same size always sort out the same way.
  queue.sort((a, b) => b.teams - a.teams || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  for (const u of queue) {
    const games = unitGames(u, target)
    const avoid = u.alternate ? prior[u.key] : undefined
    const was = u.alternate ? undefined : prior[u.key]
    const wasIndex = was == null ? undefined : indexOf.get(was)
    const steered = avoid != null && indexOf.has(avoid)

    // The home gym, first and free, whenever the whole cohort fits.
    if (homeIndex >= 0 && remaining[homeIndex] >= games && venues[homeIndex].venueId !== avoid) {
      // Being in the building the league OWNS is the whole reason; whether
      // the grade was also here last weekend is not a second fact worth a
      // different word. The switch is still counted, for the tiebreak.
      if (wasIndex !== undefined && wasIndex !== homeIndex) violations++
      seat(homeIndex, u, games, "home")
      continue
    }

    // Otherwise it is a rental, and the packer buys the cheapest one. The
    // marginal cost of adding this cohort to a building is what matters: a
    // gym already rented at four courts absorbs a small grade for nothing.
    let pick = -1
    let pickCost = Infinity
    let pickResident = false
    let pickRank = UNRANKED
    let pickName = ""
    for (let k = 0; k < venues.length; k++) {
      const venue = venues[k]
      if (venue.role !== "pool") continue
      if (remaining[k] < games) continue
      if (venue.venueId === avoid) continue
      // THE SAME MONEY THE SEARCH SCORES IN (owner ruling 2026-08-05): a
      // building this weekend has not opened yet is a whole booking, and the
      // court-days inside it are the smaller number. So a cohort joins the
      // rental the weekend already has rather than open a second address to
      // save a court-day, and one weekend's answer is as few, as big bookings
      // as its rooms allow.
      const marginal = courtDaysNeeded(venue, load[k] + games) - courtDaysNeeded(venue, load[k])
      const cost = marginal * RENTED_COURT_DAY_COST + (opened[k] ? 0 : RENTAL_BLOCK_COST)
      const isResident = wasIndex === k
      const rank = rankOf(venue)
      /**
       * SAME MONEY, THE LEAGUE'S OWN ORDER (owner ruling 2026-08-06). Residency
       * first, because moving a grade costs it something real; then the gym the
       * operator ranked higher on step 2.
       *
       * This used to break ties on the gym's NAME, which is how a draw came back
       * having booked Haber over Six Park: identical capacity, identical cost,
       * and H sorts before S. Rank never beats money — a cheaper booking still
       * wins outright — it only decides which of two equal answers to take.
       */
      const better =
        cost < pickCost ||
        (cost === pickCost &&
          (isResident !== pickResident
            ? isResident
            : rank !== pickRank
              ? rank < pickRank
              : venue.name.localeCompare(pickName, "en") < 0))
      if (pick < 0 || better) {
        pick = k
        pickCost = cost
        pickResident = isResident
        pickRank = rank
        pickName = venue.name
      }
    }

    if (pick < 0 && avoid != null) {
      // Only the gym this grade just played still has room. Playing it twice
      // beats splitting the grade across two buildings — but it is a cost.
      for (let k = 0; k < venues.length; k++) {
        if (remaining[k] >= games) {
          violations++
          seat(k, u, games, "bumped")
          pick = -2
          break
        }
      }
      if (pick === -2) continue
    }

    if (pick < 0) {
      // Fits nowhere whole, and a cohort is atomic: half a grade cannot play.
      // So the WHOLE cohort is demand with nowhere to go — an empty rental
      // slot the operator has to fill, not games that quietly disappear into
      // a building that never had room for them. The rooms it could not use
      // stay free for the smaller cohorts still to come.
      unhousedKeys.push(u.key)
      reasonByUnit[u.key] = decided?.has(u.key) ? "decided" : "overflow"
      continue
    }

    if (wasIndex !== undefined && wasIndex !== pick) violations++
    seat(
      pick,
      u,
      games,
      wasIndex === pick
        ? "resident"
        : steered && venues[pick].venueId !== avoid
          ? "avoided"
          : "rented"
    )
  }

  const openedIds: string[] = []
  for (let k = 0; k < venues.length; k++) if (opened[k]) openedIds.push(venues[k].venueId)
  const blocks = rentalBlocksFrom(
    weekend.sessionId ?? "",
    units,
    weekend,
    byUnit,
    unhousedKeys,
    fallbackRate
  )
  return {
    byUnit,
    reasonByUnit,
    opened: openedIds,
    // Overflow IS the empty block: one number, read off the blocks, so the
    // meter and the ask sheet can never disagree about what has no room.
    overflow: blocks.find((b) => b.venueId === null)?.games ?? 0,
    violations,
    rentedCourtDays: blocks.reduce((sum, b) => sum + (b.venueId ? b.courtDays : 0), 0),
    blocks,
  }
}

export interface WeekendGymSection {
  venueId: string
  name: string
  /** Owned or rented — what decides whether this section costs anything. */
  role: VenueRole
  /** Grades playing here, in the order the caller listed them. */
  unitKeys: string[]
  /** Games these grades ask for. */
  games: number
  capacityGames: number
  /** Games past what this gym holds (0 on a gym that fits its grades). */
  over: number
  /** Courts this section rents. 0 at the home gym, which costs nothing. */
  rentedCourts: number
  /** courts × days: what those courts cost. 0 at the home gym. */
  rentedCourtDays: number
}

export interface WeekendGyms {
  /** unit key → venueId: the decided gym where there is one, the packed gym
   *  everywhere else. A grade the weekend has no building for is absent. */
  byUnit: Record<string, string>
  /** unit key → why it is in that building. Every grade the weekend holds has
   *  one, so a caption or a chip can always say what happened. */
  reasonByUnit: Record<string, PlacementReason>
  /** One section per gym that takes a grade: the home gym first, then the
   *  buildings the weekend rents. */
  sections: WeekendGymSection[]
  /** Grades with no building at all, because the weekend has no gym. */
  unplaced: string[]
  /** Games no gym on this weekend can hold. */
  overflow: number
  /** Court-days this weekend rents, across every pool building it opens. */
  rentedCourtDays: number
}

/**
 * One weekend's grades grouped by BUILDING, for a screen to draw (plan step 3,
 * owner 2026-08-02: the board's chips sit under the gym they play in).
 *
 * `decided` is what somebody already chose — the plan as saved, or a gym the
 * operator switched a grade to by hand — and it always wins, even when that
 * gym then reads over its courts. Anything undecided is packed by the same
 * rules the solver scored on (packWeekendVenues), with the decided grades
 * seated first so the packer works around them.
 *
 * Every grade the weekend holds comes back somewhere: in a section, or in
 * `unplaced` when the weekend has no gym at all. A grade with no teams yet
 * asks for no games, so it rides along in the gym that fills first rather
 * than vanishing off the board.
 *
 * `given` is for the caller that already knows WHY, and there is one: the
 * board hands this function the season-long pass's buildings purely to shape
 * them into sections, so every grade would otherwise read as "decided" here.
 * The reasons the caller passes win, and the ones it does not name are
 * worked out from this weekend alone.
 */
export function resolveWeekendGyms(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues">,
  assigned: string[],
  decided: Record<string, string> = {},
  given?: Record<string, PlacementReason>
): WeekendGyms {
  const here = unitsOn(units, assigned)
  const open = new Set(weekend.venues.map((v) => v.venueId))
  // A gym that is not on this weekend is not a decision, it is a leftover.
  const kept: Record<string, string> = {}
  for (const u of here) {
    const venueId = decided[u.key]
    if (venueId && open.has(venueId)) kept[u.key] = venueId
  }

  const packed = packWeekendVenues(here, weekend, kept, new Set(Object.keys(kept)))
  // A grade the packer could not house still has to be drawn somewhere, and
  // the home gym is where it belongs on screen: that is the building whose
  // meter should be reading over its courts.
  const fallback = (homeVenueOf(weekend.venues) ?? weekend.venues[0])?.venueId
  const byUnit: Record<string, string> = {}
  const reasonByUnit: Record<string, PlacementReason> = {}
  const unplaced: string[] = []
  for (const u of here) {
    const venueId = kept[u.key] ?? packed.byUnit[u.key] ?? fallback
    if (venueId) byUnit[u.key] = venueId
    else unplaced.push(u.key)
    reasonByUnit[u.key] =
      given?.[u.key] ??
      packed.reasonByUnit[u.key] ??
      (venueId
        ? venueOf(weekend.venues, venueId)?.role === "home"
          ? "home"
          : "rented"
        : "overflow")
  }

  const sections: WeekendGymSection[] = []
  let overflow = 0
  let rentedCourtDays = 0
  for (const venue of orderedVenues(weekend.venues)) {
    const unitKeys = here.filter((u) => byUnit[u.key] === venue.venueId).map((u) => u.key)
    if (unitKeys.length === 0) continue
    const games = unitKeys.reduce(
      (sum, key) =>
        sum + unitGames(here.find((u) => u.key === key) as PlannerUnit, weekend.targetGamesPerTeam),
      0
    )
    const over = Math.max(0, games - venue.capacityGames)
    overflow += over
    const rentedCourts = venue.role === "pool" ? courtsNeeded(venue, games) : 0
    const courtDays = rentedCourts * daysAt(venue)
    rentedCourtDays += courtDays
    sections.push({
      venueId: venue.venueId,
      name: venue.name,
      role: venue.role,
      unitKeys,
      games,
      capacityGames: venue.capacityGames,
      over,
      rentedCourts,
      rentedCourtDays: courtDays,
    })
  }
  for (const key of unplaced) {
    const u = here.find((x) => x.key === key)
    if (u) overflow += unitGames(u, weekend.targetGamesPerTeam)
  }

  return { byUnit, reasonByUnit, sections, unplaced, overflow, rentedCourtDays }
}

/* ------------------------- saying it in numbers -------------------------- */

/** Games in a sentence, so "1 game" never reads "1 games". */
const gamesWord = (n: number) => `${n} game${n === 1 ? "" : "s"}`

/** Things in a sentence: "Grade 8", "Grade 8 and Grade 10", "a, b and c". */
function nameList(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/**
 * The reason in three or four words, with no gym named: what the season
 * strip puts in a cell's label, where there is no room for the whole story
 * and the cell already says which gym it is. Null for the ordinary case, so a
 * caller can leave a plain placement plain.
 */
export function reasonPhrase(reason: PlacementReason): string | null {
  switch (reason) {
    case "decided":
      return "your pick"
    case "home":
      return "home gym"
    case "rented":
      return "rented, home gym full"
    case "resident":
      return "same gym as last time"
    case "bumped":
      return "moved, its gym was full"
    case "avoided":
      return "not the gym it just played"
    case "overflow":
      return "no room, short of courts"
    default:
      return null
  }
}

/** Courts in a sentence, so "1 courts" never happens. */
const courtsWord = (n: number) => `${n} court${n === 1 ? "" : "s"}`

/**
 * Courts the season is deliberately leaving empty on a weekend (the court
 * buffer, owner ruling 2026-08-03). Every capacity number already has these
 * taken out, so this exists purely to say so: a meter reading "54 of 60" when
 * the operator knows the gyms hold 72 is not a smaller season, it is a court
 * held back, and the caption says which.
 */
export function courtsHeldOn(venues: Array<Pick<PlannerVenue, "courtsHeld">>): number {
  return venues.reduce((sum, v) => sum + Math.max(0, v.courtsHeld ?? 0), 0)
}

/** "1 court held back", or null when the season plans to the whole building. */
export function heldBackPhrase(venues: Array<Pick<PlannerVenue, "courtsHeld">>): string | null {
  const held = courtsHeldOn(venues)
  return held > 0 ? `${courtsWord(held)} held back` : null
}

export interface WeekendStory {
  /** The weekend's one line under its meter, with the numbers in it. Empty
   *  when the meter has already said everything true about the weekend. */
  caption: string
  /** unit key → the short why for that grade's chip. Only the grades whose
   *  placement is worth explaining are in here. */
  chipCaptions: Record<string, string>
}

/**
 * What happened on one weekend, in numbers (owner 2026-08-02: "give the game
 * numbers, the capacity — this spills over from Playground into Six Park,
 * capacity 48 games, they require this many, this many moved over. Which grade
 * you moved that spilled over, and why you kept the grades").
 *
 * Reads the packing it is handed, never packs anything itself, so the sentence
 * and the sections on screen can never disagree. `homes` is where each grade
 * was playing before this weekend (packShownPlacements carries it), and it is
 * the only way a sentence can name the building a grade was moved OUT of.
 *
 * One line, because it sits in a 172px column: the buildings story, the
 * shortage, and ONE per-grade why. Every other why goes on its own chip.
 */
export function weekendStory(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues">,
  gyms: WeekendGyms,
  homes: Record<string, string> = {}
): WeekendStory {
  const byKey = new Map(units.map((u) => [u.key, u]))
  const shortOf = new Map(weekend.venues.map((v) => [v.venueId, venueShortName(v.name)]))
  const sectionOf = new Map(gyms.sections.map((s) => [s.venueId, s]))
  const labelOf = (key: string) => byKey.get(key)?.label ?? key
  const gamesOf = (key: string) => {
    const u = byKey.get(key)
    return u ? unitGames(u, weekend.targetGamesPerTeam) : 0
  }
  const gymName = (venueId: string | undefined) =>
    (venueId && shortOf.get(venueId)) || "another gym"

  const parts: string[] = []
  const home = gyms.sections.find((s) => s.role === "home") ?? null
  const rented = gyms.sections.filter((s) => s.role === "pool")

  // 1. Short of courts, which outranks everything else the weekend can say.
  for (const s of gyms.sections) {
    if (s.over > 0) {
      parts.push(`${venueShortName(s.name)} over by ${s.over} (${s.games} of ${s.capacityGames})`)
    }
  }
  if (gyms.unplaced.length > 0) {
    parts.push(`no gym for ${nameList(gyms.unplaced.map(labelOf))}`)
  }

  // 2. The buildings: what the home gym holds, and what the weekend had to
  //    rent to hold the rest (owner ruling 2026-08-03 — the rented courts ARE
  //    the cost, so they are what the sentence is about). A grade named here
  //    carries its own reason, so nothing is said twice.
  const named = new Set<string>()
  if (home) {
    const room = Math.max(0, home.capacityGames - home.games)
    const spilled = rented.flatMap((s) => s.unitKeys).filter((k) => gamesOf(k) > 0)
    const forced = spilled.some((k) => gamesOf(k) > room)
    if (rented.length > 0) {
      parts.push(
        `${venueShortName(home.name)} ${forced ? "full at " : ""}${home.games} of ${
          home.capacityGames
        }`
      )
    } else if (weekend.venues.length > 1) {
      parts.push(
        `fits in ${venueShortName(home.name)} alone, ${home.games} of ${home.capacityGames}`
      )
    }
  }
  for (const s of rented) {
    const movers = s.unitKeys.filter((k) => gamesOf(k) > 0)
    const numbers = `${s.games} of ${s.capacityGames}`
    const at = `${courtsWord(s.rentedCourts)} at ${venueShortName(s.name)}`
    if (movers.length === 0) {
      parts.push(`also open: ${venueShortName(s.name)} (${numbers})`)
      continue
    }
    for (const k of movers) named.add(k)
    const who = nameList(movers.map((k) => `${labelOf(k)} (${gamesWord(gamesOf(k))})`))
    const pick = movers.every((k) => gyms.reasonByUnit[k] === "decided") ? ", your pick" : ""
    parts.push(`${who} rented: ${at} (${numbers}${pick})`)
  }
  if (!home && rented.length === 0 && gyms.sections.length > 0) {
    const only = gyms.sections[0]
    parts.push(`${venueShortName(only.name)} ${only.games} of ${only.capacityGames}`)
  }

  // 3. ONE per-grade why, for a grade the buildings clause did not already
  //    explain: a grade moved out of the gym it was in first, then a grade
  //    that kept a rented building the home gym could have taken.
  const chipCaptions: Record<string, string> = {}
  let moved: string | null = null
  let stayed: string | null = null
  for (const key of Object.keys(gyms.reasonByUnit)) {
    const reason = gyms.reasonByUnit[key]
    const at = gyms.byUnit[key]
    const was = homes[key]
    const wasSection = was ? sectionOf.get(was) : undefined
    // A grade the buildings clause already named has had its say.
    const told = named.has(key)
    if (reason === "decided") {
      chipCaptions[key] = "your pick"
    } else if (reason === "bumped") {
      const wasShort = was ? gymName(was) : null
      chipCaptions[key] = wasShort ? `moved, ${wasShort} full` : "moved, its gym was full"
      if (!told && moved === null) {
        moved = wasSection
          ? `${labelOf(key)} moved to ${gymName(at)} (${wasShort} full, ${
              wasSection.games
            } of ${wasSection.capacityGames})`
          : wasShort
            ? `${labelOf(key)} moved to ${gymName(at)} (${wasShort} could not hold ${gamesWord(
                gamesOf(key)
              )})`
            : `${labelOf(key)} moved to ${gymName(at)}, its own gym was full`
      }
    } else if (reason === "home") {
      chipCaptions[key] = "home gym"
    } else if (reason === "resident") {
      // It kept a building the league RENTS. Worth saying out loud, because
      // consolidation would otherwise have brought it home.
      chipCaptions[key] = "same gym as last time"
      if (!told && stayed === null) {
        stayed = `${labelOf(key)} stays at ${gymName(at)} (same gym as last time)`
      }
    } else if (reason === "rented") {
      chipCaptions[key] = "rented"
    } else if (reason === "avoided") {
      chipCaptions[key] = "alternating"
    } else if (reason === "overflow") {
      chipCaptions[key] = "no room"
    }
  }
  // A bumped grade beats a resident one: it is the thing that changed.
  const why = moved ?? stayed
  if (why) parts.push(why)

  // 4. How full the weekend is, in the board's own two words.
  const placed = [...Object.keys(gyms.byUnit), ...gyms.unplaced]
  const demand = placed.reduce((sum, key) => sum + gamesOf(key), 0)
  const capacity = weekend.venues.reduce((sum, v) => sum + v.capacityGames, 0)
  if (capacity > 0 && demand === 0) parts.push("spare capacity")
  else if (capacity > 0 && gyms.overflow === 0 && demand / capacity >= TIGHT_RATIO)
    parts.push("full house")

  // 5. And what the season is holding empty on purpose, last, because it
  //    explains every number above rather than adding one of its own.
  const held = heldBackPhrase(weekend.venues)
  if (held) parts.push(held)

  return { caption: parts.join(" · "), chipCaptions }
}

/** Every weekend of a season in calendar order, windows flattened. */
function chronologicalWeekends(state: PlannerState): PlannerWeekend[] {
  return state.windows
    .flatMap((win) => win.weekends)
    .sort(
      (a, b) =>
        new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime() ||
        (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0)
    )
}

/** The grades a weekend holds, deduped, in the order they were listed — the
 *  same rule as unitsOn, against a lookup the caller already built once. */
function unitsFor(unitByKey: Map<string, PlannerUnit>, keys: string[] | undefined): PlannerUnit[] {
  const seen = new Set<string>()
  const out: PlannerUnit[] = []
  for (const key of keys ?? []) {
    if (seen.has(key)) continue
    seen.add(key)
    const u = unitByKey.get(key)
    if (u) out.push(u)
  }
  return out
}

/**
 * Pack a run of weekends in order, carrying each grade's building forward:
 * where a grade played last time is where it wants to play next time (or,
 * when it alternates, the one place it does not want to play next time).
 * Mutates `resident` so the caller can keep carrying it.
 */
function carryResidency(
  unitByKey: Map<string, PlannerUnit>,
  weekends: PlannerWeekend[],
  assignment: Record<string, string[]>,
  resident: Record<string, string>,
  collect?: Record<string, Record<string, string>>
): void {
  for (const w of weekends) {
    const packed = packWeekendVenues(unitsFor(unitByKey, assignment[w.sessionId]), w, resident)
    for (const key of Object.keys(packed.byUnit)) resident[key] = packed.byUnit[key]
    if (collect && Object.keys(packed.byUnit).length > 0) collect[w.sessionId] = packed.byUnit
  }
}

/**
 * WHEN each grade last played, carried forward the same way its building is
 * (owner ruling 2026-08-05, no back-to-back weekends). Mutates `lastPlayed`, and
 * walks in date order so a month with several weekends leaves the LATEST one
 * behind — that is the Saturday the next month has to keep its distance from.
 */
function carryLastPlayed(
  weekends: PlannerWeekend[],
  assignment: Record<string, string[]>,
  lastPlayed: Record<string, string>
): void {
  const inOrder = [...weekends].sort((a, b) => String(a.dateISO).localeCompare(String(b.dateISO)))
  for (const w of inOrder) {
    if (!w.dateISO) continue
    for (const key of assignment[w.sessionId] ?? []) lastPlayed[key] = w.dateISO
  }
}

/**
 * The whole season's buildings: sessionId → (unit key → venueId).
 *
 * Walks the calendar once, in order, so residency is real — a grade's gym in
 * February is the one it has been playing since October, not a fresh guess.
 * Weekends that place nobody are left out entirely, so a caller can tell
 * "no grades here" from "grades here with no gym decided".
 */
export function packPlanVenues(
  state: PlannerState,
  assignment: Record<string, string[]>
): Record<string, Record<string, string>> {
  const unitByKey = new Map(state.units.map((u) => [u.key, u]))
  const resident: Record<string, string> = {}
  const out: Record<string, Record<string, string>> = {}
  carryResidency(unitByKey, chronologicalWeekends(state), assignment, resident, out)
  return out
}

/**
 * One weekend of a PREVIEW walk: where every grade on screen plays, given the
 * gyms somebody already decided and the gym each grade has been playing.
 *
 * The same three rules as packWeekendVenues, plus the two a screen needs:
 *  - a DECIDED gym wins outright (the plan as saved, or a hand pick), even
 *    when it puts that gym over its courts. It is handed to the packer as the
 *    grade's home so everything else packs around it.
 *  - every grade the weekend holds gets a building, so nothing vanishes off
 *    the board. A grade with no teams asks for no games and the packer seats
 *    it nowhere, so it rides along in the gym it already plays in, or the one
 *    that fills first.
 */
function packWeekendShown(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues"> &
    Partial<Pick<PlannerWeekend, "sessionId">>,
  resident: Record<string, string>,
  decided: Record<string, string>,
  fallbackRate?: VenueRate
): {
  byUnit: Record<string, string>
  reasonByUnit: Record<string, PlacementReason>
  blocks: RentalBlock[]
} {
  const open = new Set(weekend.venues.map((v) => v.venueId))
  // A gym that is not on this weekend is not a decision, it is a leftover.
  const picked: Record<string, string> = {}
  for (const u of units) {
    const venueId = decided[u.key]
    if (venueId && open.has(venueId)) picked[u.key] = venueId
  }
  const packed = packWeekendVenues(
    units,
    weekend,
    { ...resident, ...picked },
    new Set(Object.keys(picked)),
    fallbackRate
  )
  const homeVenue = homeVenueOf(weekend.venues)
  const fallback = (homeVenue ?? weekend.venues[0])?.venueId
  const byUnit: Record<string, string> = {}
  const reasonByUnit: Record<string, PlacementReason> = {}
  for (const u of units) {
    // For a grade that alternates, the gym it carries is the one to AVOID, so
    // it is no fallback: that grade takes the home gym instead.
    const was = u.alternate ? undefined : resident[u.key]
    const wasIsOpen = Boolean(was && open.has(was))
    const venueId = picked[u.key] ?? packed.byUnit[u.key] ?? (wasIsOpen ? was : fallback)
    if (!venueId) continue
    byUnit[u.key] = venueId
    reasonByUnit[u.key] =
      picked[u.key] != null
        ? "decided"
        : // A grade the packer seated has its own reason; one it skipped (no
          // teams, so no games to place) is simply riding along in the gym it
          // already plays, or in the home gym.
          (packed.reasonByUnit[u.key] ??
          (wasIsOpen
            ? was === homeVenue?.venueId
              ? "home"
              : "resident"
            : venueId === homeVenue?.venueId
              ? "home"
              : "rented"))
  }
  // The blocks are derived from the placement the SCREEN ends up with, not
  // from the packer's private answer, so a hand pick moves the rental with it.
  // The packer is cohort-atomic, so a cohort it never seated is exactly the
  // demand with no building. byUnit's own fallback (the home gym) is for
  // DRAWING; it must not make an unhoused cohort look housed.
  const unhoused = units.filter(
    (u) => !packed.byUnit[u.key] && unitGames(u, weekend.targetGamesPerTeam) > 0
  )
  const blocks = rentalBlocksFrom(
    weekend.sessionId ?? "",
    units,
    weekend,
    byUnit,
    unhoused.map((u) => u.key),
    fallbackRate
  )
  return { byUnit, reasonByUnit, blocks }
}

/**
 * The buildings behind the calendar ON SCREEN: sessionId → (unit key → venueId).
 *
 * The preview twin of packPlanVenues, and the reason the board, the season
 * strip and Keep can never disagree. It walks the whole shown calendar in date
 * order carrying residency, so a grade that has been playing The Playground
 * since October is still in The Playground in December (owner rule 2026-08-02:
 * a grade is moved out of its gym only when capacity forces it). Packing one
 * weekend at a time could not know that, and handed the busiest weekend's
 * first gym to whichever grade happened to be biggest.
 *
 * `shown` is the calendar being drawn — the working proposal, or the one the
 * league kept — and `decided` the gyms already chosen for it. Weekends that
 * place nobody are left out, so a caller can tell "no grades here" from
 * "grades here with no gym".
 */
export function packShownVenues(
  state: PlannerState,
  shown: Record<string, string[]>,
  decided: Record<string, Record<string, string>> = {}
): Record<string, Record<string, string>> {
  return packShownPlacements(state, shown, decided).venues
}

export interface ShownPlacements {
  /** sessionId → (unit key → venueId): where every grade plays. */
  venues: Record<string, Record<string, string>>
  /** sessionId → (unit key → why it is there). */
  reasons: Record<string, Record<string, PlacementReason>>
  /** sessionId → (unit key → the gym that grade was playing BEFORE this
   *  weekend). Empty for a grade the season has not placed yet. This is what
   *  lets a sentence name the building a grade was moved out of. */
  homes: Record<string, Record<string, string>>
  /** Every rental this calendar needs, in weekend order. Derived from the
   *  SAME placements above, which is why the board and the blocks can never
   *  disagree (owner ruling 2026-08-03). */
  blocks: RentalBlock[]
}

/**
 * The rate the season rents at, for a weekend that has no gym of its own to
 * measure against: the home gym anywhere in the season, else the first gym
 * anywhere. Without it a weekend with every gym released could only say "some
 * games have no room", which is not something anybody can act on.
 */
function seasonRate(state: PlannerState): VenueRate | undefined {
  let first: PlannerVenue | undefined
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const home = homeVenueOf(w.venues)
      if (home && home.capacityGames > 0) return rateOf(home)
      if (!first) first = w.venues.find((v) => v.capacityGames > 0)
    }
  }
  return first ? rateOf(first) : undefined
}

/**
 * The same chronological walk as packShownVenues, with the three things a
 * sentence needs on top of the buildings: why each grade is where it is, which
 * gym it was in before that weekend, and what the weekend has to rent.
 */
export function packShownPlacements(
  state: PlannerState,
  shown: Record<string, string[]>,
  decided: Record<string, Record<string, string>> = {}
): ShownPlacements {
  const unitByKey = new Map(state.units.map((u) => [u.key, u]))
  const resident: Record<string, string> = {}
  const rate = seasonRate(state)
  const out: ShownPlacements = { venues: {}, reasons: {}, homes: {}, blocks: [] }
  for (const w of chronologicalWeekends(state)) {
    const units = unitsFor(unitByKey, shown[w.sessionId])
    if (units.length === 0) continue
    const home: Record<string, string> = {}
    for (const u of units) if (resident[u.key]) home[u.key] = resident[u.key]
    const packed = packWeekendShown(units, w, resident, decided[w.sessionId] ?? {}, rate)
    if (Object.keys(packed.byUnit).length === 0 && packed.blocks.length === 0) continue
    for (const key of Object.keys(packed.byUnit)) resident[key] = packed.byUnit[key]
    if (Object.keys(packed.byUnit).length > 0) {
      out.venues[w.sessionId] = packed.byUnit
      out.reasons[w.sessionId] = packed.reasonByUnit
      out.homes[w.sessionId] = home
    }
    out.blocks.push(...packed.blocks)
  }
  return out
}

/**
 * WHAT THE SEASON HAS TO RENT, weekend by weekend (owner ruling 2026-08-03).
 *
 * One entry per pool building a weekend opens, cohort-atomic and demand-sized,
 * plus one entry with a null venue wherever the demand is real and no gym on
 * that weekend can take it — the empty slot somebody has to go and book.
 *
 * The home gym never appears: it is owned, so it costs nothing and there is
 * nothing to ask anyone for.
 *
 * Built on the same chronological pass the board draws from, so a block can
 * never claim a building the calendar does not.
 */
export function planRentalBlocks(
  state: PlannerState,
  assignment: Record<string, string[]>,
  venues: Record<string, Record<string, string>> = {}
): RentalBlock[] {
  return packShownPlacements(state, assignment, venues).blocks
}

export interface AssignBlocksOptions {
  /** Gyms the operator has ruled out, whatever the availability says. */
  excludeVenueIds?: string[]
}

/** One weekend's answer: which pool gym takes the empty block, and how many
 *  courts of it. When the answer JOINS a booking this weekend already has, the
 *  numbers are the whole merged booking — one bigger rental is the answer, and
 *  that is the number somebody phones the gym with. */
export interface BlockAssignment {
  venueId: string
  courts: number
  days: number
  courtDays: number
  hoursNeeded: number
  /** The pick is a building this weekend already rents, so filling this gap
   *  makes that booking bigger instead of opening a second one. */
  joins?: boolean
}

/**
 * Fill the empty rental slots from the POOL (owner ruling 2026-08-03: a block
 * goes needed → assumed → confirmed, and this is the "assumed" step).
 *
 * Only blocks with no venue are answered; a block that already names a
 * building is the solver's or the operator's answer and is left alone. The
 * pool is unordered, so the choice is pure cost, in the order the price list
 * ranks it (owner ruling 2026-08-05): FEWEST BOOKINGS first — a gap that can go
 * into the building this weekend already rents makes that one booking bigger
 * rather than opening a second address — then fewest rented court-days, then
 * the gym whose name sorts first so two equal answers never wobble.
 *
 * Joining is only offered where the building can really hold both, because a
 * merge past its courts is not one bigger booking, it is spill: consolidation
 * must never manufacture a game with no court.
 *
 * Availability is honoured by construction: a weekend's `venues` are only the
 * gyms that are attached and not blocked out, which is what the season's
 * grid and the NJC/NSC marks already decided. A gym that is not on the
 * weekend can never be chosen here.
 */
export function assignBlocksFromPool(
  state: PlannerState,
  blocks: RentalBlock[],
  opts?: AssignBlocksOptions
): Record<string, BlockAssignment> {
  const excluded = new Set(opts?.excludeVenueIds ?? [])
  const weekendById = new Map<string, PlannerWeekend>()
  for (const w of chronologicalWeekends(state)) weekendById.set(w.sessionId, w)

  const out: Record<string, BlockAssignment> = {}
  for (const w of chronologicalWeekends(state)) {
    const here = blocks.filter((b) => b.sessionId === w.sessionId)
    const empty = here.find((b) => b.venueId === null)
    if (!empty || empty.games <= 0) continue
    /** Games this weekend already sends to each building it rents, so a merge
     *  can be priced as what it really adds — and refused where the building
     *  cannot hold both. */
    const already = new Map<string, number>()
    for (const b of here) {
      if (!b.venueId) continue
      already.set(b.venueId, (already.get(b.venueId) ?? 0) + b.games)
    }

    let pick: PlannerVenue | null = null
    let pickCost = Infinity
    let pickJoins = false
    let pickFits = false
    for (const venue of orderedVenues(w.venues)) {
      if (venue.role !== "pool") continue
      if (excluded.has(venue.venueId)) continue
      const held = already.get(venue.venueId) ?? 0
      // Can this building really take the gap on top of what it is already
      // holding? An assumed answer that overflows the moment it lands is not an
      // answer, and a merge past the courts is spill rather than one bigger
      // booking. When nothing fits, the cheapest gym still gives the operator a
      // number to phone with.
      const fits = held + empty.games <= venue.capacityGames
      const joins = fits && held > 0
      const cost = joins
        ? courtDaysNeeded(venue, held + empty.games) - courtDaysNeeded(venue, held)
        : courtDaysNeeded(venue, empty.games)
      // A gym that can hold it first, then fewest bookings, then the court-days.
      // orderedVenues is stable, so the first gym to reach a cost keeps it and
      // two equal answers never wobble.
      const better = fits !== pickFits ? fits : joins !== pickJoins ? joins : cost < pickCost
      if (!pick || better) {
        pick = venue
        pickCost = cost
        pickJoins = joins
        pickFits = fits
      }
    }
    if (!pick) continue
    // A merge is quoted as the WHOLE booking: the gym is being asked for one
    // rental of this size, not for two that happen to share an address.
    const games = pickJoins ? (already.get(pick.venueId) ?? 0) + empty.games : empty.games
    const courts = courtsNeeded(pick, games)
    const days = daysAt(pick)
    out[w.sessionId] = {
      venueId: pick.venueId,
      courts,
      days,
      courtDays: courts * days,
      hoursNeeded: courts * days * (pick.hoursPerCourtDay ?? 0),
      ...(pickJoins ? { joins: true } : {}),
    }
  }
  return out
}

/* ------------------------- the ask, without dates ------------------------ */

export interface RentalAskMonth {
  /** The window's own label, "Nov 2026". */
  label: string
  courtDays: number
  courtHours: number
  /** Weekends of the month that need a rental at all. */
  weekendsNeedingRent: number
  /** The SHAPE of the need in words, for a gym that wants to pick its own
   *  days: "two weekends of 3 courts, or one weekend of 6 courts". */
  chunks: string
}

export interface RentalAsk {
  season: {
    courtDays: number
    courtHours: number
    /** Games with no building at all: the part of the ask that is not a
     *  preference but a hole in the season. */
    gamesUnhoused: number
  }
  months: RentalAskMonth[]
}

/** Small counts read as words, because "2 weekends of 3 courts" next to
 *  "3 courts" makes an operator read the numbers twice. */
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"]
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n)

/**
 * THE ASK, with no dates in it (owner 2026-08-03: "tell the gym how many
 * hours we need, they pick the days, we re-solve around their offer").
 *
 * Every rental block counts, assigned or not: the ask is the whole off-home
 * demand, and the screen captions which part of it is already spoken for.
 *
 * HOW THE CHUNK PHRASE IS DERIVED, and the one rule it obeys — never describe
 * a shape the cohort maths cannot produce:
 *   1. Group the month's blocks by weekend. A weekend's ask is the courts of
 *      its blocks added up, because one building per grade per weekend still
 *      holds and two buildings on one weekend really are that many courts.
 *   2. The phrase lists those per-weekend court counts, fewest weekends last:
 *      "two weekends of 3 courts and one weekend of 5 courts".
 *   3. The alternative is the SAME cohorts collapsed onto one weekend of the
 *      month, sized at the rate the season already rents at: courts =
 *      ceil(month games ÷ games one court holds). It is offered only when the
 *      month really has two or more renting weekends (so there is something
 *      to collapse) and only when collapsing asks for fewer courts in total
 *      than the spread does. Cohorts stay whole in both readings, and a grade
 *      plays one weekend per month either way, so both shapes are plannable.
 */
export function rentalAsk(state: PlannerState, blocks: RentalBlock[]): RentalAsk {
  const rate = seasonRate(state)
  const season = { courtDays: 0, courtHours: 0, gamesUnhoused: 0 }
  for (const b of blocks) {
    season.courtDays += b.courtDays
    season.courtHours += b.hoursNeeded
    if (b.venueId === null) season.gamesUnhoused += b.games
  }

  const months: RentalAskMonth[] = []
  for (const win of state.windows) {
    const ids = new Set(win.weekends.map((w) => w.sessionId))
    const mine = blocks.filter((b) => ids.has(b.sessionId))
    if (mine.length === 0) continue

    const byWeekend = new Map<string, { courts: number; games: number }>()
    for (const b of mine) {
      const seen = byWeekend.get(b.sessionId) ?? { courts: 0, games: 0 }
      seen.courts += b.courts
      seen.games += b.games
      byWeekend.set(b.sessionId, seen)
    }
    const courtDays = mine.reduce((sum, b) => sum + b.courtDays, 0)
    const courtHours = mine.reduce((sum, b) => sum + b.hoursNeeded, 0)
    const games = mine.reduce((sum, b) => sum + b.games, 0)

    // Same-size weekends collapse into one clause: "two weekends of 3 courts".
    const tally = new Map<number, number>()
    for (const { courts } of byWeekend.values()) {
      if (courts <= 0) continue
      tally.set(courts, (tally.get(courts) ?? 0) + 1)
    }
    const clauses = [...tally.entries()]
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])
      .map(
        ([courts, weekends]) =>
          `${countWord(weekends)} weekend${weekends === 1 ? "" : "s"} of ${courtsWord(courts)}`
      )
    let chunks = nameList(clauses)

    const spreadCourts = [...byWeekend.values()].reduce((sum, w) => sum + w.courts, 0)
    if (byWeekend.size > 1 && rate && games > 0) {
      const together = Math.ceil(games / rate.gamesPerCourt)
      if (together < spreadCourts) {
        chunks = `${chunks}, or one weekend of ${courtsWord(together)}`
      }
    }

    months.push({
      label: win.label,
      courtDays,
      courtHours,
      weekendsNeedingRent: byWeekend.size,
      chunks: chunks || "nothing to rent",
    })
  }

  return { season, months }
}

/**
 * Deterministic per-window search. Every unit appears exactly once per
 * window (NPH's real rule: each grade plays one weekend per monthly
 * session). Overflow is forbidden when any overflow-free assignment
 * exists; ties break toward the two largest units on different weekends.
 *
 * THE OBJECTIVE is the price list above (§WHAT THINGS COST), in the order those
 * terms outrank each other: overflow, then weekends used, then RENTAL BOOKINGS,
 * then rented court-days, then back-to-back weekends, then peak games, then the
 * two giants apart, then residency.
 *
 * Levers:
 *  - balance: THE DEFAULT, and since 2026-08-03 it means compact-first —
 *    fewest weekends, then cheapest rentals, then flattest peak.
 *  - compact: the same objective, kept because the API and the board's lever
 *    row both still send it.
 *  - spread: the alternative shape — every weekend used, then the rest.
 *  - one-gym: kept for callers that still send it (the API accepts it), and
 *    the SAME objective as balance. Consolidation is no longer a lever an
 *    operator has to reach for: rented court-days are a dominant term of
 *    every solve, so "pack one gym" is what the search already does.
 *
 * Rentals are the score, not an afterthought: every candidate is really packed
 * into buildings (packWeekendVenues), and a month pays 25,000 for every
 * building-weekend it books plus 1,000 for every court-day inside it. That
 * booking term is what makes a month's rental gather onto as few weekends as its
 * rooms allow (owner ruling 2026-08-05) instead of thinning out into a 3-court
 * session on every Saturday the operator happened to choose.
 *
 * Months are decided in calendar order, so October's answer shapes November's
 * residency AND November's spacing, never the other way round.
 */
export function proposePlan(state: PlannerState, lever: PlannerLever): Record<string, string[]> {
  const units = state.units.filter((u) => u.teams > 0)
  const out: Record<string, string[]> = {}
  const giants = [...units]
    .sort((a, b) => b.teams - a.teams)
    .slice(0, 2)
    .map((u) => u.key)
  const unitByKey = new Map(units.map((u) => [u.key, u]))
  // Where each grade has been playing, as decided by the months already
  // settled. A window scores against THIS snapshot: no weekend of a month
  // feeds residency back into another weekend of the same month.
  const resident: Record<string, string> = {}
  // And WHEN each grade last played, for the same reason: the month boundary is
  // where back-to-back weekends hide (Oct 31 then Nov 7), so the spacing rule
  // needs the carry the same way residency does. A grade plays one weekend per
  // window, so its only neighbour is the weekend the previous month gave it.
  const lastPlayed: Record<string, string> = {}

  for (const win of state.windows) {
    const n = win.weekends.length
    if (n === 0) continue
    if (n === 1) {
      out[win.weekends[0].sessionId] = units.map((u) => u.key)
      carryResidency(unitByKey, win.weekends, out, resident)
      carryLastPlayed(win.weekends, out, lastPlayed)
      continue
    }
    let best: number[] | null = null
    let bestScore = Infinity
    const assign = new Array(units.length).fill(0)
    const combos = Math.pow(n, units.length)
    if (combos > 300_000) {
      // Too many units for an exact search. The greedy has to answer in the
      // SHAPE the objective asks for, or a big league would get the opposite
      // plan to a small one:
      //  - compact-first (the default): largest grade first into a weekend
      //    ALREADY in use that can still hold it, and only then a fresh one.
      //  - spread: the old utilization walk, which is what flat means.
      const loads = new Array(n).fill(0)
      const greedy = new Array(units.length).fill(0)
      const order = units
        .map((u, i) => ({ i, teams: u.teams }))
        .sort((a, b) => b.teams - a.teams || (units[a.i].key < units[b.i].key ? -1 : 1))
      const compactFirst = lever !== "spread"
      for (const { i } of order) {
        let pick = 0
        let pickUtil = Infinity
        let pickRank = -Infinity
        let pickTie = -Infinity
        let pickGap = false
        for (let k = 0; k < n; k++) {
          const cap = win.weekends[k].capacityGames || 1
          const add = Math.ceil((units[i].teams * win.weekends[k].targetGamesPerTeam) / 2)
          // The spacing rule, as a filter with a fallback: a weekend that is not
          // this grade's second Saturday in a row wins, but only after the
          // things that decide whether the plan runs at all. When every weekend
          // of the month is adjacent, the grade plays anyway.
          const gap = !backToBack(lastPlayed[units[i].key], win.weekends[k].dateISO)
          if (compactFirst) {
            const room = win.weekends[k].capacityGames - loads[k]
            const fits = add <= room
            // A weekend that can hold the grade beats one that cannot; among
            // those, a weekend already in use beats opening a new one; then a
            // weekend that is not back-to-back; then the tightest fit, so the
            // roomy weekends stay whole for what is left.
            const rank = (fits ? 4 : 0) + (fits && loads[k] > 0 ? 2 : 0) + (gap ? 1 : 0)
            const tie = fits ? -(room - add) : room
            if (rank > pickRank || (rank === pickRank && tie > pickTie)) {
              pickRank = rank
              pickTie = tie
              pick = k
            }
            continue
          }
          const util = (loads[k] + add) / cap
          if (gap !== pickGap ? gap : util < pickUtil) {
            pickUtil = util
            pickGap = gap
            pick = k
          }
        }
        greedy[i] = pick
        loads[pick] += Math.ceil((units[i].teams * win.weekends[pick].targetGamesPerTeam) / 2)
      }
      win.weekends.forEach((w, k) => {
        out[w.sessionId] = units.filter((_, i) => greedy[i] === k).map((u) => u.key)
      })
      carryResidency(unitByKey, win.weekends, out, resident)
      carryLastPlayed(win.weekends, out, lastPlayed)
      continue
    }
    // Packing every candidate is only worth it when the RENT can actually
    // differ: a month whose every weekend is the home gym alone, with nobody
    // alternating and nobody with a gym to keep, costs the same either way.
    const venueAware =
      win.weekends.some((w) => w.venues.some((v) => v.role === "pool")) ||
      units.some((u) => u.alternate || resident[u.key] != null)
    const loads = new Array(n).fill(0)
    const buckets: PlannerUnit[][] = Array.from({ length: n }, () => [])
    // Which weekends of this month would be a grade's second Saturday running,
    // worked out once per grade per weekend rather than per candidate: the
    // answer only depends on the month already settled behind it.
    const adjacent = units.map((u) =>
      win.weekends.map((w) => backToBack(lastPlayed[u.key], w.dateISO))
    )
    for (let mask = 0; mask < combos; mask++) {
      let m = mask
      for (let i = 0; i < units.length; i++) {
        assign[i] = m % n
        m = Math.floor(m / n)
      }
      loads.fill(0)
      for (let k = 0; k < n; k++) buckets[k].length = 0
      let backToBacks = 0
      for (let i = 0; i < units.length; i++) {
        loads[assign[i]] += Math.ceil(
          (units[i].teams * win.weekends[assign[i]].targetGamesPerTeam) / 2
        )
        buckets[assign[i]].push(units[i])
        if (adjacent[i][assign[i]]) backToBacks++
      }
      let overflow = 0
      let peakGames = 0
      let used = 0
      for (let k = 0; k < n; k++) {
        const cap = win.weekends[k].capacityGames
        if (loads[k] > 0) used++
        if (cap <= 0) {
          if (loads[k] > 0) overflow += loads[k]
          continue
        }
        if (loads[k] > cap) overflow += loads[k] - cap
        peakGames = Math.max(peakGames, loads[k])
      }
      // What this month costs in MONEY: the BOOKINGS it has to make, the
      // court-days inside them, and the small tiebreak for grades that changed
      // building (owner rulings 2026-08-03 — consolidation outranks residency —
      // and 2026-08-05 — one big rental beats two small ones).
      let venueCost = 0
      if (venueAware) {
        for (let k = 0; k < n; k++) {
          /**
           * A CONFIRMED BOOKING IS AN OBLIGATION (owner ruling 2026-08-06). It is
           * charged whether this candidate uses the weekend or not: a month that
           * leaves a booked Saturday empty is a month wasting money the league has
           * already spent, and that has to be visible to the search even when the
           * bucket is empty. This is what stops SPREAD from walking away from a
           * booking to lay the season out flat.
           */
          const owed = confirmedRentals(win.weekends[k])
          if (buckets[k].length === 0) {
            venueCost += owed.bookings * IDLE_CONFIRMED_BOOKING_COST
            venueCost += owed.courtDays * UNUSED_CONFIRMED_COURT_DAY_COST
            continue
          }
          const packed = packWeekendVenues(buckets[k], win.weekends[k], resident)
          // A booking is one rented building on one weekend. The empty block —
          // demand with no building at all — is not one: it is already charged
          // as overflow, and billing it twice would let the search buy its way
          // out of a hole by leaving games homeless.
          const bookings = packed.blocks.reduce((sum, b) => sum + (b.venueId ? 1 : 0), 0)
          /**
           * What this weekend used of the space it had already booked, so the
           * rest can be charged as the waste it is. A confirmed building the
           * packing never opened is an IDLE booking; one it opened and half
           * filled leaves empty court-days behind.
           */
          let usedConfirmedCourtDays = 0
          let idleConfirmed = 0
          for (const rental of owed.venues) {
            const block = packed.blocks.find((b) => b.venueId === rental.venueId)
            if (!block) {
              idleConfirmed++
              continue
            }
            usedConfirmedCourtDays += Math.min(rental.courtDays, block.courtDays)
          }
          venueCost +=
            idleConfirmed * IDLE_CONFIRMED_BOOKING_COST +
            Math.max(0, owed.courtDays - usedConfirmedCourtDays) *
              UNUSED_CONFIRMED_COURT_DAY_COST +
            bookings * RENTAL_BLOCK_COST +
            packed.rentedCourtDays * RENTED_COURT_DAY_COST +
            packed.violations * RESIDENCY_SWITCH_COST
        }
      }
      // Courts are the cost: rank by ABSOLUTE peak games (a flat 42% of a
      // huge weekend still rents more courts than a flat 74-game one).
      // Availability stays hard via overflow.
      let score = overflow * 1_000_000 + backToBacks * ADJACENT_WEEKEND_COST + peakGames * 100
      // Compact-first is the default now: balance, compact and one-gym are one
      // objective, and only spread asks for the season laid out flat.
      if (lever === "spread") score += (n - used) * WEEKEND_IDLE_COST
      else score += used * WEEKEND_USED_COST
      const gi = units.findIndex((u) => u.key === giants[0])
      const gj = units.findIndex((u) => u.key === giants[1])
      if (gi >= 0 && gj >= 0 && assign[gi] === assign[gj]) score += 40
      score += venueCost
      if (score < bestScore) {
        bestScore = score
        best = [...assign]
      }
    }
    win.weekends.forEach((w, k) => {
      out[w.sessionId] = units.filter((_, i) => best![i] === k).map((u) => u.key)
    })
    carryResidency(unitByKey, win.weekends, out, resident)
    carryLastPlayed(win.weekends, out, lastPlayed)
  }
  return out
}

/** Read the current assignment as sessionId → unit keys (for diffs/UI). */
export function currentAssignment(state: PlannerState): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const win of state.windows) for (const w of win.weekends) out[w.sessionId] = w.assigned
  return out
}

/* ------------------------- comparing two calendars ----------------------- */

export interface WeekendDiff {
  sessionId: string
  /** Grades the two calendars put on this weekend together. */
  agreed: string[]
  /** Grades this calendar has here that the reference does not. */
  added: string[]
  /** Grades the reference has here that this calendar does not. */
  removed: string[]
}

export interface AssignmentDiffSummary {
  /** Placements the reference calendar makes — the "of M" in the verdict. */
  placements: number
  /** Placements both calendars make on the same weekend. */
  agreedCount: number
  /** A grade the reference and the board both play that month, on different
   *  weekends of it. */
  moved: Array<{ unitKey: string; fromSessionId: string; toSessionId: string }>
  /** One unit key per reference placement the board never replaces anywhere
   *  in that month. A grade absent from two months appears twice, so
   *  agreedCount + moved + missing always adds up to `placements`. */
  missing: string[]
  /** One unit key per board placement the reference has nowhere that month. */
  extra: string[]
}

export interface AssignmentDiff {
  /** In board order: every weekend of every window, including the quiet ones,
   *  so a caller can look one up without worrying whether it differed. */
  weekends: WeekendDiff[]
  summary: AssignmentDiffSummary
}

/**
 * Two calendars for the same season, side by side: what the board currently
 * says against a reference calendar (in practice the one the league kept).
 *
 * The month is the unit of meaning, because the league's own rule is that a
 * grade plays one weekend per monthly session. So a grade the reference has on
 * one weekend of October and the board has on another weekend of October MOVED
 * — the operator still plays it that month, just elsewhere. A grade the
 * reference plays in October and the board plays nowhere in October is MISSING
 * from October, even if the board picked it up in November: November is a
 * different promise. The mirror case, a board placement the reference has
 * nowhere that month, is EXTRA.
 *
 * Only weekends the board draws (state.windows) and grades the board knows
 * (state.units) are compared: a diff can only talk about what is on screen.
 */
export function diffAssignments(
  state: PlannerState,
  reference: Record<string, string[]>,
  current: Record<string, string[]>
): AssignmentDiff {
  const order = new Map(state.units.map((u, i) => [u.key, i]))
  const known = (keys: string[] | undefined) => (keys ?? []).filter((k) => order.has(k))
  const sorted = (keys: string[]) =>
    [...new Set(keys)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))

  const weekends: WeekendDiff[] = []
  const summary: AssignmentDiffSummary = {
    placements: 0,
    agreedCount: 0,
    moved: [],
    missing: [],
    extra: [],
  }

  for (const win of state.windows) {
    // Per grade, which weekends of THIS month each calendar dropped it on.
    const refHomes = new Map<string, string[]>()
    const curHomes = new Map<string, string[]>()

    for (const w of win.weekends) {
      const ref = new Set(known(reference[w.sessionId]))
      const cur = new Set(known(current[w.sessionId]))
      const agreed: string[] = []
      const added: string[] = []
      const removed: string[] = []
      for (const key of cur) (ref.has(key) ? agreed : added).push(key)
      for (const key of ref) if (!cur.has(key)) removed.push(key)
      weekends.push({
        sessionId: w.sessionId,
        agreed: sorted(agreed),
        added: sorted(added),
        removed: sorted(removed),
      })
      summary.placements += ref.size
      summary.agreedCount += agreed.length
      for (const key of removed) refHomes.set(key, [...(refHomes.get(key) ?? []), w.sessionId])
      for (const key of added) curHomes.set(key, [...(curHomes.get(key) ?? []), w.sessionId])
    }

    // Pair each vacated weekend with a new one in the same month, in calendar
    // order: that pairing is the move. Whatever is left over is a hole (or,
    // on the board's side, something the reference never planned).
    for (const [unitKey, fromIds] of refHomes) {
      const toIds = curHomes.get(unitKey) ?? []
      const pairs = Math.min(fromIds.length, toIds.length)
      for (let i = 0; i < pairs; i++) {
        summary.moved.push({ unitKey, fromSessionId: fromIds[i], toSessionId: toIds[i] })
      }
      for (let i = pairs; i < fromIds.length; i++) summary.missing.push(unitKey)
      curHomes.set(unitKey, toIds.slice(pairs))
    }
    for (const [unitKey, toIds] of curHomes) {
      for (let i = 0; i < toIds.length; i++) summary.extra.push(unitKey)
    }
  }

  return { weekends, summary }
}

/* ------------------------- moving the day window ------------------------- */

export interface HoursPreviewWeekend {
  sessionId: string
  label: string
  capacityBefore: number
  capacityAfter: number
  /** Games this weekend's grades ask for. Hours never change this. */
  demand: number
  overflowBefore: number
  overflowAfter: number
  buildingsBefore: number
  buildingsAfter: number
}

/** What an earlier start (or an earlier finish) would do to a plan, weekend
 *  by weekend. Computed server-side by planHoursPreview; nothing is written. */
export interface HoursPreview {
  deltaStartMinutes: number
  deltaEndMinutes: number
  /** Games each court holds per day, gained or lost. Null when the season's
   *  gyms do not all move by the same number (different windows round the
   *  extra hour differently), and the sentence falls back to season totals. */
  perCourtDayDelta: number | null
  weekends: HoursPreviewWeekend[]
  totals: {
    capacityBefore: number
    capacityAfter: number
    overflowBefore: number
    overflowAfter: number
    twoBuildingBefore: number
    twoBuildingAfter: number
  }
  /** Weekends whose shortage this clears, by label. */
  cleared: string[]
  /** Weekends this puts short. */
  broke: string[]
  /** Weekends that fall back into a single building. */
  oneGymNow: string[]
  /** Weekends that have to open a second one. */
  twoGymNow: string[]
}

/** Weekends in a sentence: one, two by name, more by count. */
function weekendList(labels: string[]): string {
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.length} weekends`
}

/**
 * The one line an hours chip says before anybody books anything: what the
 * change buys in court time, and the one thing it fixes or breaks on the
 * calendar. Same voice as the board's own captions, because it is read three
 * inches from them.
 */
export function hoursPreviewSentence(label: string, preview: HoursPreview): string {
  const { perCourtDayDelta, totals, cleared, broke, oneGymNow, twoGymNow } = preview
  const games = totals.capacityAfter - totals.capacityBefore
  const quiet =
    cleared.length === 0 && broke.length === 0 && oneGymNow.length === 0 && twoGymNow.length === 0
  if (games === 0 && quiet) return `${label}: no change, the hour does not fit another game.`

  const parts: string[] = []
  if (perCourtDayDelta) {
    const n = Math.abs(perCourtDayDelta)
    parts.push(
      `${perCourtDayDelta > 0 ? "+" : "-"}${n} game${n === 1 ? "" : "s"} per court each day`
    )
  } else if (games !== 0) {
    const n = Math.abs(games)
    parts.push(`${games > 0 ? "+" : "-"}${n} game${n === 1 ? "" : "s"} of gym time this season`)
  } else {
    parts.push("the same gym time")
  }

  if (cleared.length > 0) parts.push(`clears the ${weekendList(cleared)} shortage`)
  if (broke.length > 0) parts.push(`puts ${weekendList(broke)} short`)
  if (cleared.length === 0 && broke.length === 0) {
    if (twoGymNow.length > 0) parts.push(`opens a second gym on ${weekendList(twoGymNow)}`)
    else if (oneGymNow.length > 0) parts.push(`keeps ${weekendList(oneGymNow)} in one gym`)
    else parts.push("no weekend changes")
  }
  return `${label}: ${parts.join(", ")}.`
}

/**
 * The destination weekend packed with this grade added: where everybody stands
 * once the move is taken. ONE packing, so the clause that names the landing and
 * the rule that vetoes the move can never disagree about where the grade ends
 * up.
 *
 * An approximation, and deliberately so: the destination is packed against the
 * residency the season already had going INTO it, not against a re-walk of
 * every later weekend. A move can ripple forward through residency; this
 * describes the weekend the operator is looking at.
 */
function packLanding(
  unit: PlannerUnit,
  to: PlannerWeekend,
  keysThere: string[],
  unitByKey: Map<string, PlannerUnit>,
  homes: Record<string, string>,
  decidedThere: Record<string, string>
): { there: PlannerUnit[]; packed: WeekendVenuePacking; landed: string | null } {
  const there = unitsFor(unitByKey, [...keysThere.filter((k) => k !== unit.key), unit.key])
  const packed = packWeekendVenues(
    there,
    to,
    { ...homes, ...decidedThere },
    new Set(Object.keys(decidedThere))
  )
  return { there, packed, landed: packed.byUnit[unit.key] ?? null }
}

/**
 * Where a grade would LAND if it were moved onto a weekend, when that is not
 * the gym it has been playing: "Lands at Six Park (The Playground holds Grade
 * 10, 42 of 48)." Empty when the grade keeps its own building, which is the
 * quiet, ordinary case nobody needs told about.
 */
function landingClause(
  unit: PlannerUnit,
  to: PlannerWeekend,
  keysThere: string[],
  unitByKey: Map<string, PlannerUnit>,
  homes: Record<string, string>,
  decidedThere: Record<string, string>
): string {
  const home = homes[unit.key]
  const open = new Map(to.venues.map((v) => [v.venueId, v]))
  if (!home || !open.has(home)) return ""
  const { there, packed, landed } = packLanding(unit, to, keysThere, unitByKey, homes, decidedThere)
  if (!landed || landed === home) return ""
  // Landing in the building the league OWNS is not a displacement worth
  // warning about (owner ruling 2026-08-03): it is the cheapest place a grade
  // can be, and saying "Playground has no room" of a gym that has plenty
  // would be a straight lie about why the grade went there.
  if (homeVenueOf(to.venues)?.venueId === landed) return ""
  const shortOf = (venueId: string) => venueShortName(open.get(venueId)?.name ?? "")
  const holders = there.filter((u) => u.key !== unit.key && packed.byUnit[u.key] === home)
  const held = holders.reduce((sum, u) => sum + unitGames(u, to.targetGamesPerTeam), 0)
  const capacity = open.get(home)?.capacityGames ?? 0
  const lands = `Lands at ${shortOf(landed) || "another gym"}`
  if (holders.length === 0) return `${lands} (${shortOf(home)} has no room, ${capacity} slots).`
  return `${lands} (${shortOf(home)} holds ${nameList(
    holders.map((u) => u.label)
  )}, ${held} of ${capacity}).`
}

/**
 * A grade's USUAL gym: the building it plays most across the season. Ties go
 * to the gym it plays first, so the answer is stable and a grade that splits
 * its season evenly still has one building to be sent back to.
 *
 * Not to be confused with the league's HOME gym since 2026-08-03 — that is
 * the building the league owns (PlannerVenue.role === "home"). This is only
 * "where has this grade been playing", which is now a tiebreak.
 */
function mostPlayed(venueIds: string[]): string | null {
  const counts = new Map<string, number>()
  let best: string | null = null
  for (const id of venueIds) {
    const n = (counts.get(id) ?? 0) + 1
    counts.set(id, n)
    if (!best || n > (counts.get(best) ?? 0)) best = id
  }
  return best
}

/** Every grade's usual gym across the calendar on screen, in one pass over
 *  the buildings the board is already drawing. */
function usualGyms(state: PlannerState, placement: ShownPlacements): Map<string, string> {
  const played = new Map<string, string[]>()
  for (const w of chronologicalWeekends(state)) {
    for (const [key, venueId] of Object.entries(placement.venues[w.sessionId] ?? {})) {
      played.set(key, [...(played.get(key) ?? []), venueId])
    }
  }
  const home = new Map<string, string>()
  for (const [key, venueIds] of played) {
    const best = mostPlayed(venueIds)
    if (best) home.set(key, best)
  }
  return home
}

/**
 * The suggestion rail: what the math noticed, said with the numbers behind it,
 * and wired to a button wherever there is a move that fixes it (owner
 * 2026-08-02: "suggestions must say moving from where to where, how many
 * games, how it solves the problem. Make those buttons clickable").
 *
 * Every sentence is self-contained, because the rail is read three inches from
 * a board that is already full of numbers and nobody should have to cross
 * reference. Every move stays inside its own month, since a grade plays one
 * weekend per monthly session and the board refuses anything else.
 *
 * `decided` is the gyms the caller has on screen, per weekend; where it says
 * nothing, the plan as saved stands. That is what makes the rail's buildings
 * the same buildings the board is drawing.
 *
 * Two rules decide which notes carry a button. Feasibility first: a shortage
 * move is always offered, because a weekend that cannot be played beats every
 * other consideration. Then residency: a move made only to close a second
 * building is offered ONLY when it leaves the grade in its own gym, so tidying
 * a weekend can never quietly cost a grade the building it plays in.
 *
 * THE RAIL BUYS WITH THE SAME MONEY AS THE SOLVER (owner ruling 2026-08-05, #5).
 * A third rule sits over both of the others, because the rail was still speaking
 * the old economics: it offered moves that spread a month back out across more
 * Saturdays and more bookings, which is exactly what compact-first exists to
 * stop, and it did it on a board that was already correct.
 *
 * The rule, in the price list's own two loudest terms (a weekend 100,000, a
 * booking 25,000):
 *
 *   NO SUGGESTED MOVE MAY RAISE THE BILL. A move is offered only when it runs no
 *   extra weekend, opens no extra rental booking and strands no extra game.
 *   Court-days may go up: the list already says the search will rent courts to
 *   keep a month in one place.
 *
 *   The ONE exception is feasibility. A weekend whose demand is past everything
 *   its buildings hold cannot be played at all, and that weekend has no
 *   same-weekend fix by construction — the overflow is measured against the
 *   whole of every building it has. Such a move ships whatever it costs, and
 *   even then a free way out is preferred over an expensive one.
 */
export function suggestFor(
  state: PlannerState,
  assignment: Record<string, string[]>,
  decided: Record<string, Record<string, string>> = {}
): PlannerSuggestion[] {
  const suggestions: PlannerSuggestion[] = []
  const unitByKey = new Map(state.units.map((u) => [u.key, u]))
  const decidedAll: Record<string, Record<string, string>> = {}
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const chosen = decided[w.sessionId] ?? w.assignedVenues ?? {}
      if (Object.keys(chosen).length > 0) decidedAll[w.sessionId] = chosen
    }
  }
  // ONE chronological pass for the whole calendar, the same one the board
  // draws from, so a suggestion never names a building the screen does not.
  const placement = packShownPlacements(state, assignment, decidedAll)
  /** Where each grade has been playing across this calendar, so a tidy-up
   *  move can be measured against the building it would give up. */
  const homeGym = usualGyms(state, placement)
  const demandOn = (w: PlannerWeekend) =>
    weekendDemand(state.units, w, assignment[w.sessionId] ?? [])
  const gamesOn = (unit: PlannerUnit, w: PlannerWeekend) =>
    Math.ceil((unit.teams * w.targetGamesPerTeam) / 2)
  /** Which gym every grade would bring to a weekend: the residency the season
   *  already had going into it, plus the moving grade's own current building,
   *  which is the home the move would be taking it away from. */
  const homesArriving = (to: PlannerWeekend, unit: PlannerUnit, fromSessionId: string) => {
    const homes = { ...(placement.homes[to.sessionId] ?? {}) }
    const at = placement.venues[fromSessionId]?.[unit.key]
    if (at) homes[unit.key] = at
    return homes
  }

  /**
   * WHAT THIS CALENDAR COSTS RIGHT NOW, once, so every candidate move can be
   * priced against it (owner ruling 2026-08-05, #5). Season scope on purpose:
   * a booking closed in December and one opened in January really do net out,
   * and the price list is a season's bill.
   */
  const billNow = planCost(state, assignment, decidedAll)
  /** The same bill with one move made. Nothing is mutated. */
  const billAfter = (unit: PlannerUnit, from: PlannerWeekend, to: PlannerWeekend) =>
    planCost(
      state,
      assignmentWithMove(assignment, unit.key, from.sessionId, to.sessionId),
      venuesWithoutUnit(decidedAll, unit.key, [from.sessionId, to.sessionId])
    )
  /**
   * A MOVE NOBODY HAS TO PAY FOR. No extra Saturday, no extra phone call to a
   * gym, no extra game left with nowhere to play. Court-days are deliberately
   * not in it: the price list already spends those to keep a month together.
   */
  const freeOfCharge = (unit: PlannerUnit, from: PlannerWeekend, to: PlannerWeekend) => {
    const price = planPrice(billNow, billAfter(unit, from, to))
    return price.weekendsAdded <= 0 && price.buildingsOpened <= 0 && price.gamesUnhoused <= 0
  }

  for (const win of state.windows) {
    for (const w of win.weekends) {
      const assigned = assignment[w.sessionId] ?? []
      const demand = demandOn(w)
      const here = unitsOn(state.units, assigned)

      /** The move, spelled out: both weekends, both loads, and where the
       *  grade ends up standing when it gets there. */
      const moveFor = (
        unit: PlannerUnit,
        to: PlannerWeekend,
        resolves: SuggestionMove["resolves"],
        fixes: string
      ): { move: SuggestionMove; text: string } => {
        const games = gamesOn(unit, w)
        const toBefore = demandOn(to)
        const toAfter = toBefore + gamesOn(unit, to)
        const short = demand - w.capacityGames
        const fromNumbers =
          short > 0
            ? `${demand} of ${w.capacityGames}, ${short} short`
            : `${demand} of ${w.capacityGames}`
        const lands = landingClause(
          unit,
          to,
          assignment[to.sessionId] ?? [],
          unitByKey,
          homesArriving(to, unit, w.sessionId),
          decidedAll[to.sessionId] ?? {}
        )
        return {
          move: {
            unitKey: unit.key,
            unitLabel: unit.label,
            games,
            fromSessionId: w.sessionId,
            fromLabel: w.label,
            toSessionId: to.sessionId,
            toLabel: to.label,
            fromBefore: { demand, capacity: w.capacityGames },
            toAfter: { demand: toAfter, capacity: to.capacityGames },
            resolves,
            lands,
          },
          text: `Move ${unit.label} (${gamesWord(games)}) from ${w.label} (${fromNumbers}) to ${
            to.label
          } (${toAfter} of ${to.capacityGames} after). ${fixes}${lands ? ` ${lands}` : ""}`,
        }
      }

      /** Weekends of this same month that could take a grade whole. */
      const roomFor = (unit: PlannerUnit) =>
        win.weekends.filter(
          (o) =>
            o.sessionId !== w.sessionId &&
            o.capacityGames > 0 &&
            demandOn(o) + gamesOn(unit, o) <= o.capacityGames
        )

      if (demand > w.capacityGames) {
        const short = demand - w.capacityGames
        suggestions.push({
          kind: "overflow",
          sessionId: w.sessionId,
          text: `${w.label} needs ${gamesWord(demand)} and has ${
            w.capacityGames
          } slots, ${short} short. Extend the hours, add a court, or move a grade to a lighter weekend.`,
        })
        // The smallest grade that actually clears it: moving a giant fixes the
        // weekend by breaking another one.
        const candidates = [...here].sort((a, b) => a.teams - b.teams)
        /**
         * THE CHEAPEST WAY OUT, AND FAILING THAT ANY WAY OUT (owner ruling
         * 2026-08-05, #5). This weekend cannot be played, so a move ships even
         * when it costs a Saturday or a booking — but a free destination is
         * taken over a paid one wherever the month has both, which is the whole
         * of the exception the price list allows.
         */
        let paid: { unit: PlannerUnit; to: PlannerWeekend } | null = null
        let free: { unit: PlannerUnit; to: PlannerWeekend } | null = null
        for (const unit of candidates) {
          if (demand - gamesOn(unit, w) > w.capacityGames) continue
          for (const to of roomFor(unit)) {
            if (!paid) paid = { unit, to }
            if (freeOfCharge(unit, w, to)) {
              free = { unit, to }
              break
            }
          }
          if (free) break
        }
        const clears = free ?? paid
        if (clears) {
          // Feasibility outranks residency: a shortage move ships even when it
          // takes the grade off its own gym, and `lands` is what says so.
          const { move, text } = moveFor(clears.unit, clears.to, "shortage", "Clears the shortage.")
          suggestions.push({ kind: "move-unit", sessionId: w.sessionId, text, move })
        }
      } else {
        // Buildings from the real packing, not from a guess at the biggest
        // gym: the two used to disagree, and the packing is what the plan
        // actually saves.
        const gyms = resolveWeekendGyms(
          state.units,
          w,
          assigned,
          placement.venues[w.sessionId] ?? {},
          placement.reasons[w.sessionId]
        )
        const rentedHere = gyms.sections.filter((s) => s.role === "pool")
        if (rentedHere.length > 0 && gyms.sections.length > 1) {
          const ownGym = gyms.sections.find((s) => s.role === "home")
          const rents = nameList(
            rentedHere.map(
              (s) =>
                `${courtsWord(s.rentedCourts)} at ${venueShortName(s.name)} (${s.games} of ${
                  s.capacityGames
                })`
            )
          )
          const owned = ownGym
            ? `fills ${venueShortName(ownGym.name)} (${ownGym.games} of ${ownGym.capacityGames}) and `
            : ""
          let text = `${w.label} ${owned}rents ${rents}, ${gamesWord(demand)} in all.`
          // The one grade whose leaving would end the rental.
          let move: SuggestionMove | undefined
          const spillUnits = rentedHere
            .flatMap((s) => s.unitKeys)
            .map((k) => unitByKey.get(k))
            .filter((u): u is PlannerUnit => Boolean(u && u.teams > 0))
          for (const unit of spillUnits) {
            const rest = unitsFor(
              unitByKey,
              assigned.filter((k) => k !== unit.key)
            )
            const without = packWeekendVenues(rest, w, {
              ...(placement.homes[w.sessionId] ?? {}),
              ...(decidedAll[w.sessionId] ?? {}),
            })
            if (without.rentedCourtDays > 0 || without.overflow > 0) continue
            const to = roomFor(unit)[0]
            if (!to) continue
            // The residency veto stays (owner 2026-08-02): tidying a weekend
            // must not quietly cost a grade the building it plays in. What it
            // no longer covers is a landing in the league's OWN gym — that is
            // the move the 2026-08-03 ruling exists to make, since it takes a
            // grade off a rented court and costs nobody anything.
            const usual = homeGym.get(unit.key)
            const { landed } = packLanding(
              unit,
              to,
              assignment[to.sessionId] ?? [],
              unitByKey,
              homesArriving(to, unit, w.sessionId),
              decidedAll[to.sessionId] ?? {}
            )
            const landsAtOwnGym = landed != null && homeVenueOf(to.venues)?.venueId === landed
            if (usual && landed && landed !== usual && !landsAtOwnGym) continue
            /**
             * AND IT HAS TO BE FREE (owner ruling 2026-08-05, #5). This is a
             * tidy-up, not a rescue: the weekend it is about fits. So it may
             * close a booking and it may not open one, and it may consolidate
             * onto a Saturday the month is already running but never start a new
             * one. Under the price list a weekend costs four bookings, so
             * "saves a rental" on an empty Saturday was the rail quietly
             * offering to make the plan more expensive.
             */
            if (!freeOfCharge(unit, w, to)) continue
            const saved = rentedHere.reduce((sum, s) => sum + s.rentedCourtDays, 0)
            const built = moveFor(
              unit,
              to,
              "two-building",
              saved > 0
                ? `Saves ${saved} rented court-day${saved === 1 ? "" : "s"} on ${w.label}.`
                : `Keeps ${w.label} in the home gym.`
            )
            move = built.move
            text = `${text} ${built.text}`
            break
          }
          suggestions.push({ kind: "two-building", sessionId: w.sessionId, text, move })
        }
      }

      /**
       * A CHOSEN WEEKEND WITH NOTHING ON IT (owner ruling 2026-08-05, #5).
       *
       * This used to carry a "put the empty weekend to work" button, and under
       * compact-first that button was backwards: bundling the month onto fewer
       * Saturdays is what the plan is FOR, so an idle weekend is the plan
       * working. The move it offered added a weekend at 100,000 to a board that
       * was already correct, and the owner watched the rail ask him to undo his
       * own plan on a 54-of-54 home weekend.
       *
       * The note stays, because "nothing is on the 14th" is a true thing about
       * the calendar that an operator may well want to see. It simply has
       * nothing to press. The one case where filling an empty weekend really is
       * the answer — a weekend somewhere in this month whose games do not fit
       * anywhere in its own buildings — is already answered above, by the
       * overflow branch on THAT weekend, which will send a grade here itself.
       */
      if (assigned.length === 0 && w.capacityGames > 0) {
        suggestions.push({
          kind: "idle-weekend",
          sessionId: w.sessionId,
          text: `${w.label} has ${w.capacityGames} open slots and no grades on it. Spare capacity, or another league's weekend.`,
        })
      }
    }
  }
  return suggestions
}

/**
 * What the RAIL shows, out of everything the math noticed (owner-approved
 * mock, 2026-08-02: the rail is for problems and for things you can do).
 *
 * A recap of what a weekend already draws — "fills The Playground and opens
 * Six Park" — is not either of those, so it leaves the rail: the card says it
 * in a meter and two chips. What stays is every shortage (the red problems,
 * which sort first) and every suggestion that is one tap from being done.
 *
 * suggestFor keeps composing all of them, because the API hands its
 * suggestions to callers this screen does not own.
 */
export function railSuggestions(all: PlannerSuggestion[]): PlannerSuggestion[] {
  const problems = all.filter((s) => s.kind === "overflow")
  const doable = all.filter((s) => s.kind !== "overflow" && s.move)
  return [...problems, ...doable]
}

/* ------------------------- a grade's season, in cells -------------------- */

/** One weekend of one grade's season: when it plays, and in which building. */
export interface GradeStripCell {
  sessionId: string
  dateISO: string
  venueId: string
}

/**
 * One grade's whole season as cells, in date order: the weekends it plays and
 * the building each one is in (owner-approved mock, 2026-08-02 — "the grade's
 * season in miniature, before and after").
 *
 * Built on the same chronological pass the board and the strip draw from, so
 * the miniature can never disagree with the calendar above it. Weekends the
 * grade does not play are simply absent: the strip is the grade's season, not
 * the season's weekends.
 */
export function gradeGymStrip(
  state: PlannerState,
  assignment: Record<string, string[]>,
  decided: Record<string, Record<string, string>>,
  unitKey: string
): GradeStripCell[] {
  const placed = packShownPlacements(state, assignment, decided)
  const out: GradeStripCell[] = []
  for (const w of chronologicalWeekends(state)) {
    const venueId = placed.venues[w.sessionId]?.[unitKey]
    if (venueId) out.push({ sessionId: w.sessionId, dateISO: w.dateISO, venueId })
  }
  return out
}

/**
 * A grade's USUAL gym read off its own season in cells: the building it plays
 * most. The same rule the suggestions are vetoed by, so the row that draws a
 * move and the core that offers it agree on which building the grade would be
 * giving up. Named for the old model; it has never meant the league's own
 * building, and since 2026-08-03 that distinction matters.
 */
export function gradeHomeGym(cells: GradeStripCell[]): string | null {
  return mostPlayed(cells.map((c) => c.venueId))
}

/**
 * The calendar with one grade moved to another weekend, as a NEW object: the
 * one place a move is spelled out, so the board's own move and the rail's
 * preview of that move can never mean different things. Nothing passed in is
 * touched.
 */
export function assignmentWithMove(
  assignment: Record<string, string[]>,
  unitKey: string,
  fromSessionId: string | null,
  toSessionId: string
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  for (const [sessionId, keys] of Object.entries(assignment)) {
    next[sessionId] = sessionId === fromSessionId ? keys.filter((k) => k !== unitKey) : [...keys]
  }
  next[toSessionId] = [...new Set([...(next[toSessionId] ?? []), unitKey])]
  return next
}

/**
 * Drop one grade's decided gym from the given weekends. The gym travels with
 * the chip: the weekend it left forgets it, and the weekend it lands on packs
 * it fresh against whatever is already there. Weekends that end up deciding
 * nothing drop out, so an empty map stays empty and nothing is mutated.
 */
export function venuesWithoutUnit(
  venues: Record<string, Record<string, string>>,
  unitKey: string,
  sessionIds: Array<string | null>
): Record<string, Record<string, string>> {
  const touched = new Set(sessionIds.filter((id): id is string => Boolean(id)))
  const next: Record<string, Record<string, string>> = {}
  for (const [sessionId, byUnit] of Object.entries(venues)) {
    if (!touched.has(sessionId)) {
      next[sessionId] = byUnit
      continue
    }
    const copy = { ...byUnit }
    delete copy[unitKey]
    if (Object.keys(copy).length > 0) next[sessionId] = copy
  }
  return next
}

/** Which buildings a run of cells uses, and how often, in the order they first
 *  appear — the order the season plays them in. */
function gymTally(
  cells: GradeStripCell[],
  nameOf: (venueId: string) => string
): Array<{ name: string; weekends: number }> {
  const counts = new Map<string, number>()
  for (const c of cells) counts.set(c.venueId, (counts.get(c.venueId) ?? 0) + 1)
  return [...counts].map(([venueId, weekends]) => ({ name: nameOf(venueId), weekends }))
}

/**
 * A grade's buildings before and after a move, counted in words: "Playground 6
 * weekends becomes Playground 5, Six Park 1." What the miniature says in
 * colour, said again for anybody the colour does not reach.
 */
export function gymCountsSentence(
  before: GradeStripCell[],
  after: GradeStripCell[],
  nameOf: (venueId: string) => string
): string {
  // The noun rides on the first side only, and only when one building holds
  // the whole season: "Playground 6 weekends becomes Playground 5, Six Park 1."
  const side = (cells: GradeStripCell[], withNoun: boolean) => {
    const tally = gymTally(cells, nameOf)
    if (tally.length === 0) return "no weekends"
    if (tally.length === 1 && withNoun) {
      const one = tally[0]
      return `${one.name} ${one.weekends} weekend${one.weekends === 1 ? "" : "s"}`
    }
    return tally.map((t) => `${t.name} ${t.weekends}`).join(", ")
  }
  return `${side(before, true)} becomes ${side(after, false)}.`
}

/* ======================================================================== *
 * THE FOUR VERBS (owner ruling 2026-08-04).
 *
 * Placing a gym already existed. These are the other three, and every one of
 * them is a PURE function over the working copy: the board hands in what it is
 * showing and gets back what it would be showing, so a price quoted before an
 * edit and the board after it are computed by the same code.
 * ======================================================================== */

/** One weekend's one gym, the way a working copy keys a court cap. */
export const courtCapKey = (sessionId: string, venueId: string) => `${sessionId}|${venueId}`

/** Courts a gym actually has wired on a weekend, which is the ceiling any
 *  correction is capped at. */
export function courtsWiredAt(venue: PlannerVenue): number {
  return courtsAt(venue)
}

/**
 * CORRECT — "I don't have this" (owner ruling 2026-08-04).
 *
 * A gym said they can only give three of their six courts that weekend. That
 * is not a smaller season and it is not a mistake in step 2: it is one gym, one
 * weekend, and the board has to repack around it immediately.
 *
 * The cap rewrites the venue's courts and the capacity behind them at the rate
 * that gym already runs at, so every downstream number — the section meter, the
 * weekend fraction, the rental blocks, the ask sheet — follows without any of
 * them knowing a correction happened. Weekends nobody corrected come back as
 * the very same objects, so a board with no corrections costs nothing.
 *
 * `caps` is keyed by courtCapKey. A cap at or above the wired courts is not a
 * correction and is ignored; a cap of 0 is a gym that gave nothing.
 */
export function applyCourtCaps(state: PlannerState, caps: Record<string, number>): PlannerState {
  if (Object.keys(caps).length === 0) return state
  let touchedAny = false
  const windows = state.windows.map((win) => {
    let touchedWindow = false
    const weekends = win.weekends.map((w) => {
      let touched = false
      const venues = w.venues.map((v) => {
        const cap = caps[courtCapKey(w.sessionId, v.venueId)]
        if (cap == null) return v
        const wired = courtsAt(v)
        const courts = Math.max(0, Math.min(wired, Math.floor(cap)))
        if (courts === wired) return v
        touched = true
        const perCourt = gamesPerCourt(v)
        const days = daysAt(v)
        return {
          ...v,
          courts,
          courtDays: courts * days,
          capacityGames: Math.max(0, Math.floor(perCourt * courts)),
        }
      })
      if (!touched) return w
      touchedWindow = true
      touchedAny = true
      return {
        ...w,
        venues,
        capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
        largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
      }
    })
    return touchedWindow ? { ...win, weekends } : win
  })
  return touchedAny ? { ...state, windows } : state
}

/**
 * "WE RENTED MORE OF IT THAN THAT" (owner ruling 2026-08-06, #5 — the other half
 * of the two-way court editor).
 *
 * A rental block is demand-sized: four courts, because four courts hold the games
 * that landed there. An operator who actually booked six is not correcting the
 * board's arithmetic, they are telling it what they bought — so the block is
 * billed at six, the section reads "4 used of 6 rented", and the ask sheet asks
 * the gym for six.
 *
 * It only ever raises. A number BELOW the demand-sized rental is the correction
 * that already exists (applyCourtCaps), which shrinks the building's capacity and
 * makes the block smaller on its own; billing that smaller block is right.
 *
 * `rented` is keyed by courtCapKey, the same map the correction uses, because
 * "the courts we hold at that gym on that date" is one fact with one home.
 * Blocks with no building are left alone: there is nothing rented to bill.
 */
export function withRentedCourts(
  blocks: RentalBlock[],
  rented: Record<string, number>
): RentalBlock[] {
  if (Object.keys(rented).length === 0) return blocks
  let touched = false
  const out = blocks.map((block) => {
    if (!block.venueId) return block
    const want = rented[courtCapKey(block.sessionId, block.venueId)]
    if (want == null || want <= block.courts) return block
    touched = true
    const courtDays = want * block.days
    // Court-hours per court-day are whatever this block was already quoted at,
    // so the hours follow the courts without the venue having to be handed in.
    const perCourtDay = block.courtDays > 0 ? block.hoursNeeded / block.courtDays : 0
    return { ...block, courts: want, courtDays, hoursNeeded: courtDays * perCourtDay }
  })
  return touched ? out : blocks
}

/**
 * WHAT A CALENDAR COSTS, in the three units an operator pays in: buildings they
 * have to open, court-days they have to rent, and weekends they have to run.
 *
 * Read off the same chronological pass the board draws from, so a price is
 * never a second opinion about the plan — it is the plan, counted.
 */
export interface PlanCost {
  /** Pool buildings opened across the season, counted once per weekend: two
   *  weekends at the same gym is two buildings to book. */
  buildingsOpened: number
  courtDaysRented: number
  /** Weekends that actually hold a grade. */
  weekendsUsed: number
  /** Games with no building at all. */
  gamesUnhoused: number
}

export function planCost(
  state: PlannerState,
  assignment: Record<string, string[]>,
  venues: Record<string, Record<string, string>> = {},
  /**
   * Count only these weekends. The whole season is the honest headline — an
   * edit that opens a building in October and closes one in January really has
   * cost nothing — but a season total can hide the thing in front of you, so a
   * caller can also ask what one weekend costs and say both.
   */
  only?: ReadonlySet<string>
): PlanCost {
  const blocks = packShownPlacements(state, assignment, venues).blocks
  const cost: PlanCost = {
    buildingsOpened: 0,
    courtDaysRented: 0,
    weekendsUsed: 0,
    gamesUnhoused: 0,
  }
  for (const b of blocks) {
    if (only && !only.has(b.sessionId)) continue
    cost.courtDaysRented += b.courtDays
    if (b.venueId) cost.buildingsOpened += 1
    else cost.gamesUnhoused += b.games
  }
  for (const w of chronologicalWeekends(state)) {
    if (only && !only.has(w.sessionId)) continue
    if ((assignment[w.sessionId] ?? []).length > 0) cost.weekendsUsed += 1
  }
  return cost
}

/** What one edit would change, term by term. Positive is more of it. */
export interface PlanPrice {
  buildingsOpened: number
  courtDaysRented: number
  weekendsAdded: number
  gamesUnhoused: number
}

export function planPrice(before: PlanCost, after: PlanCost): PlanPrice {
  return {
    buildingsOpened: after.buildingsOpened - before.buildingsOpened,
    courtDaysRented: after.courtDaysRented - before.courtDaysRented,
    weekendsAdded: after.weekendsUsed - before.weekendsUsed,
    gamesUnhoused: after.gamesUnhoused - before.gamesUnhoused,
  }
}

/** A signed count wearing its unit: "1 more building", "2 fewer court-days". */
function priceClause(delta: number, one: string, many: string): string | null {
  if (delta === 0) return null
  const n = Math.abs(delta)
  return `${n} ${delta > 0 ? "more" : "fewer"} ${n === 1 ? one : many}`
}

/**
 * THE PRICE, before anything is applied (owner ruling 2026-08-04: a split shows
 * what it costs first). Zero terms are left out, because "0 more weekends" is a
 * sentence nobody needs to read, and a split that costs nothing says so.
 */
function priceClauses(price: PlanPrice): string[] {
  return [
    priceClause(price.buildingsOpened, "building to open", "buildings to open"),
    priceClause(price.courtDaysRented, "court-day to rent", "court-days to rent"),
    priceClause(price.weekendsAdded, "weekend in use", "weekends in use"),
    priceClause(price.gamesUnhoused, "game with no building", "games with no building"),
  ].filter((p): p is string => p !== null)
}

export function planPriceSentence(price: PlanPrice): string {
  const parts = priceClauses(price)
  return parts.length === 0
    ? "Costs nothing: same buildings, same court-days."
    : `${nameList(parts)}.`
}

/**
 * THE PRICE AT BOTH SCOPES (owner ruling 2026-08-04, and the thing the first
 * drive of it caught).
 *
 * A grade moved into a building it will now keep can cost two courts in October
 * and save two in January, and the season total comes out at zero. That total is
 * true and it is the number that matters, but "costs nothing" printed under
 * "Grade 9 moves to Six Park" reads like the board is not paying attention.
 *
 * So: the season leads when it has anything to say, and when it comes out even
 * the weekend in front of the operator says what IT costs and the sentence says
 * plainly that the season absorbs it.
 */
export function splitPriceSentence(season: PlanPrice, weekend: PlanPrice): string {
  const seasonParts = priceClauses(season)
  if (seasonParts.length > 0) return `${nameList(seasonParts)} across the season.`
  const weekendParts = priceClauses(weekend)
  if (weekendParts.length === 0) return "Costs nothing: same buildings, same court-days."
  return `${nameList(weekendParts)} that weekend, and the season comes out even.`
}

/** A cohort's games on one weekend, for the caller sorting a split. */
function gamesOnWeekend(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam">,
  key: string
): number {
  const u = units.find((x) => x.key === key)
  return u ? unitGames(u, weekend.targetGamesPerTeam) : 0
}

/** What a split did, as data: the cohorts that moved and where they went. */
export interface SplitResult {
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
  /** The cohorts that moved. Never empty on a result. */
  moved: string[]
  /** The building they moved into, on a split across gyms. */
  toVenueId: string | null
  /** The weekend they moved onto, on a split across weekends. */
  toSessionId: string | null
}

/**
 * BREAK, axis one — ACROSS GYMS THIS WEEKEND (owner ruling 2026-08-04).
 *
 * The solver never does this: a weekend in two buildings costs a second address
 * and the search will take a heavier single building every time. This is the
 * operator overruling that, and it is the only thing that can.
 *
 * WHOLE COHORTS ONLY, which is the law the whole planner is built on — a grade
 * plays one building so a family drives to one address. So a run of cohorts is
 * dealt out largest-first into the second building until the first one fits,
 * and a single cohort cannot be split at all: it is one grade and it goes one
 * place. Null when there is nothing here to divide or nowhere to put it.
 */
export function splitAcrossGyms(
  state: PlannerState,
  assignment: Record<string, string[]>,
  venues: Record<string, Record<string, string>>,
  sessionId: string,
  unitKeys: string[]
): SplitResult | null {
  if (unitKeys.length < 2) return null
  const weekend = chronologicalWeekends(state).find((w) => w.sessionId === sessionId)
  if (!weekend) return null
  const placed = packShownPlacements(state, assignment, venues).venues[sessionId] ?? {}
  const from = placed[unitKeys[0]] ?? null
  // Everything being split has to start in one building, or this is not a
  // split, it is two things that are already apart.
  if (!from || unitKeys.some((k) => placed[k] !== from)) return null

  const source = weekend.venues.find((v) => v.venueId === from)
  const ordered = [...unitKeys].sort(
    (a, b) =>
      gamesOnWeekend(state.units, weekend, b) - gamesOnWeekend(state.units, weekend, a) ||
      a.localeCompare(b, "en")
  )
  const total = ordered.reduce((sum, k) => sum + gamesOnWeekend(state.units, weekend, k), 0)

  // The cheapest second building with room: the pool is unordered, so this is
  // a cost question exactly the way filling a block from the pool is.
  let target: PlannerVenue | null = null
  let targetCost = Infinity
  for (const v of orderedVenues(weekend.venues)) {
    if (v.venueId === from || v.capacityGames <= 0) continue
    const cost = v.role === "home" ? 0 : courtDaysNeeded(v, total)
    if (cost < targetCost) {
      target = v
      targetCost = cost
    }
  }
  if (!target) return null

  // Deal cohorts across, largest first, until the source fits its own courts.
  // A source that already fits still splits — the operator asked to — and then
  // the rule is simply "move the largest one".
  const room = source?.capacityGames ?? 0
  const moved: string[] = []
  let stays = total
  let goes = 0
  for (const key of ordered) {
    const games = gamesOnWeekend(state.units, weekend, key)
    if (moved.length > 0 && stays <= room) break
    if (moved.length === ordered.length - 1) break
    if (goes + games > target.capacityGames && moved.length > 0) break
    moved.push(key)
    stays -= games
    goes += games
  }
  if (moved.length === 0) return null

  const nextVenues = { ...venues, [sessionId]: { ...(venues[sessionId] ?? {}) } }
  // Everything staying is now a decision too: without it the packer is free to
  // undo the split on the next pass, which is exactly what it is built to do.
  for (const key of unitKeys) nextVenues[sessionId][key] = from
  for (const key of moved) nextVenues[sessionId][key] = target.venueId
  return { assignment, venues: nextVenues, moved, toVenueId: target.venueId, toSessionId: null }
}

/**
 * BREAK, axis two — ACROSS TWO WEEKENDS (owner ruling 2026-08-04).
 *
 * The lightest other weekend of the same month takes part of the load. A grade
 * plays one weekend a month, so the cohorts that move are moving inside their
 * own window and nothing about that rule bends.
 */
export function splitAcrossWeekends(
  state: PlannerState,
  assignment: Record<string, string[]>,
  venues: Record<string, Record<string, string>>,
  sessionId: string,
  unitKeys: string[]
): SplitResult | null {
  if (unitKeys.length < 2) return null
  const window = state.windows.find((win) => win.weekends.some((w) => w.sessionId === sessionId))
  const weekend = window?.weekends.find((w) => w.sessionId === sessionId)
  if (!window || !weekend) return null

  const target = lightestWeekendIn(state, window, assignment, sessionId)
  if (!target) return null

  const ordered = [...unitKeys].sort(
    (a, b) =>
      gamesOnWeekend(state.units, weekend, b) - gamesOnWeekend(state.units, weekend, a) ||
      a.localeCompare(b, "en")
  )
  const room = Math.max(
    0,
    target.capacityGames - weekendDemand(state.units, target, assignment[target.sessionId] ?? [])
  )
  const here = weekend.capacityGames
  let stays = weekendDemand(state.units, weekend, assignment[sessionId] ?? [])

  const moved: string[] = []
  let goes = 0
  for (const key of ordered) {
    const games = gamesOnWeekend(state.units, weekend, key)
    if (moved.length > 0 && stays <= here) break
    if (moved.length === ordered.length - 1) break
    if (goes + games > room && moved.length > 0) break
    moved.push(key)
    stays -= games
    goes += games
  }
  if (moved.length === 0) return null

  let nextAssignment = assignment
  let nextVenues = venues
  for (const key of moved) {
    nextAssignment = assignmentWithMove(nextAssignment, key, sessionId, target.sessionId)
    nextVenues = venuesWithoutUnit(nextVenues, key, [sessionId, target.sessionId])
  }
  return {
    assignment: nextAssignment,
    venues: nextVenues,
    moved,
    toVenueId: null,
    toSessionId: target.sessionId,
  }
}

/**
 * The emptiest weekend of a month that is not the one we are standing on: where
 * a split sends the half it is giving away, and where the board points when it
 * offers "a different weekend".
 */
export function lightestWeekendIn(
  state: PlannerState,
  window: PlannerWindow,
  assignment: Record<string, string[]>,
  exceptSessionId: string
): PlannerWeekend | null {
  let best: PlannerWeekend | null = null
  let bestLoad = Infinity
  for (const w of window.weekends) {
    if (w.sessionId === exceptSessionId) continue
    if (w.capacityGames <= 0) continue
    const demand = weekendDemand(state.units, w, assignment[w.sessionId] ?? [])
    const load = demand / w.capacityGames
    if (load < bestLoad) {
      best = w
      bestLoad = load
    }
  }
  return best
}
