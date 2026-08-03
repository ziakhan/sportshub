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
import { venueShortName } from "@/lib/seasons/venue-strip"

/**
 * How a weekend is named everywhere an operator sees one: "Oct 24–25", or
 * "Oct 31–Nov 1" when it straddles months. Lives in the pure core because
 * the planner board, the gyms-and-weekends grid, and the published calendar
 * card must all spell the same weekend the same way.
 */
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

export interface PlannerVenue {
  venueId: string
  name: string
  capacityGames: number
  /** Which gym the league fills FIRST (0 = first choice). A weekend's venue
   *  array always arrives sorted by this then by name, and the packer walks
   *  it in that order without re-sorting. */
  fillOrder: number
  /** Court-days behind `capacityGames` this weekend: how many (day × court)
   *  pairs the gym opens. Set by buildPlannerState; absent in hand-built
   *  states. It is what turns a capacity change into the number an operator
   *  thinks in — games per court per day — when the hours move. */
  courtDays?: number
}

export interface PlannerWeekend {
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
}

export interface PlannerWindow {
  label: string
  weekends: PlannerWeekend[]
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
  /** What taking the move fixes. */
  resolves: "shortage" | "two-building" | "idle-weekend"
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
export const TIGHT_RATIO = 0.85

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

/* ------------------------- which gym a grade plays in -------------------- */

/**
 * WHY a grade ended up in the building it did (owner 2026-08-02: "why you kept
 * the grades — their home gym, that's where they play most of their games").
 * The board writes it in words, the strip says it in the cell's label, and
 * neither has to guess whether a gym was picked, kept, or forced.
 *
 *  - "decided":  somebody chose this gym. The saved plan, or a hand switch.
 *  - "resident": the grade went back to the gym it has been playing.
 *  - "fill":     the gyms filled in order and this is where it landed.
 *  - "bumped":   its own gym could not hold it, so it moved. For a grade that
 *                alternates buildings the same word means the mirror miss: it
 *                had to repeat the building it just played.
 *  - "avoided":  an alternating grade steered off the building it just played.
 *  - "overflow": no gym on the weekend can hold it whole.
 */
export type PlacementReason =
  | "decided"
  | "resident"
  | "fill"
  | "bumped"
  | "avoided"
  | "overflow"

export interface WeekendVenuePacking {
  /** The one gym each grade plays in this weekend: unit key → venueId. */
  byUnit: Record<string, string>
  /** Why each grade is where it is: unit key → reason. Same keys as `byUnit`,
   *  plus any grade the weekend stranded with no gym at all. */
  reasonByUnit: Record<string, PlacementReason>
  /** Gyms that took at least one grade, in fill order. One entry is the
   *  goal; two means the league opened a second building that weekend. */
  opened: string[]
  /** Games no gym could hold. */
  overflow: number
  /** Placements that broke a gym promise: a grade bumped out of the building
   *  it usually plays, or an alternating grade sent back to the building it
   *  just played. Not fatal — a cost the search tries to avoid. */
  violations: number
}

/** Games one grade asks for on one weekend. */
function unitGames(unit: PlannerUnit, targetGamesPerTeam: number): number {
  return Math.ceil((unit.teams * targetGamesPerTeam) / 2)
}

/**
 * One weekend's grades sorted into buildings (owner ruling 2026-08-02).
 *
 * Three rules, in this order:
 *  1. A grade plays ONE gym per weekend. Never split across buildings — the
 *     whole point is that a family drives to one address.
 *  2. A grade keeps the SAME gym all season. `prior` is where each grade
 *     usually plays; it gets that gym back whenever the whole grade still
 *     fits, and being bumped counts as a violation rather than a silent move.
 *     For a grade flagged `alternate`, `prior` inverts: it is the building to
 *     AVOID this weekend, and using it anyway is the violation.
 *  3. Gyms fill in order. The top gym takes everything it can hold before the
 *     next one opens, so a light weekend rents one building, not two halves.
 *
 * `weekend.venues` must already be in fill order (buildPlannerState sorts
 * them); this walks that order and never re-sorts, because the exact search
 * calls it hundreds of thousands of times.
 *
 * `decided` names the grades somebody already chose a gym for, so the packing
 * can say "your pick" instead of guessing at a reason. It changes no
 * placement: a decided gym reaches the packer as that grade's `prior`, which
 * is what makes it win.
 */
export function packWeekendVenues(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues">,
  prior: Record<string, string>,
  decided?: ReadonlySet<string>
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
    let stranded = 0
    for (const u of units) {
      const games = Math.max(0, unitGames(u, target))
      stranded += games
      if (games > 0) reasonByUnit[u.key] = "overflow"
    }
    return { byUnit, reasonByUnit, opened: [], overflow: stranded, violations: 0 }
  }

  const remaining = venues.map((v) => v.capacityGames)
  const used = venues.map(() => false)
  const indexOf = new Map<string, number>()
  venues.forEach((v, k) => indexOf.set(v.venueId, k))
  let overflow = 0
  let violations = 0
  /** Grades whose own gym could not hold them this weekend. They go back in
   *  the pool, and wherever they land, the reason is the bump. */
  const bumped = new Set<string>()

  // Residents first, in key order — a deterministic answer to "which of two
  // grades that both live here gets bumped".
  const pool: PlannerUnit[] = []
  const byKey = [...units].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  for (const u of byKey) {
    const demand = unitGames(u, target)
    if (demand <= 0) continue // a grade with no teams claims no gym
    if (u.alternate) {
      pool.push(u)
      continue
    }
    const home = prior[u.key]
    const k = home == null ? undefined : indexOf.get(home)
    // No home yet, or the home gym is not open this weekend: it is simply a
    // grade looking for a room, not a broken promise.
    if (k === undefined) {
      pool.push(u)
      continue
    }
    if (remaining[k] >= demand) {
      byUnit[u.key] = venues[k].venueId
      mark(u.key, "resident")
      used[k] = true
      remaining[k] -= demand
    } else {
      violations++
      bumped.add(u.key)
      pool.push(u)
    }
  }

  // Then the rest, biggest grade first: a big grade placed late is the one
  // that opens a second building nobody needed.
  pool.sort((a, b) => b.teams - a.teams || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  for (const u of pool) {
    const demand = unitGames(u, target)
    const avoid = u.alternate ? prior[u.key] : undefined
    // Steering only counts as steering when the gym to dodge is actually open
    // this weekend; otherwise the grade is simply filling in order.
    const steered = avoid != null && indexOf.has(avoid)
    let pick = -1
    for (let k = 0; k < venues.length; k++) {
      if (remaining[k] >= demand && venues[k].venueId !== avoid) {
        pick = k
        break
      }
    }
    if (pick < 0 && avoid != null) {
      // Only the gym this grade just played still has room. Playing it twice
      // beats splitting the grade across two buildings — but it is a cost.
      for (let k = 0; k < venues.length; k++) {
        if (remaining[k] >= demand) {
          pick = k
          violations++
          bumped.add(u.key)
          break
        }
      }
    }
    if (pick < 0) {
      // Fits nowhere whole: the roomiest gym takes it and the games that do
      // not fit are the weekend's overflow.
      let big = 0
      for (let k = 1; k < venues.length; k++) if (remaining[k] > remaining[big]) big = k
      overflow += demand - Math.max(0, remaining[big])
      remaining[big] = 0
      if (avoid != null && venues[big].venueId === avoid) violations++
      byUnit[u.key] = venues[big].venueId
      mark(u.key, "overflow")
      used[big] = true
      continue
    }
    byUnit[u.key] = venues[pick].venueId
    mark(
      u.key,
      bumped.has(u.key)
        ? "bumped"
        : steered && venues[pick].venueId !== avoid
          ? "avoided"
          : "fill"
    )
    used[pick] = true
    remaining[pick] -= demand
  }

  const opened: string[] = []
  for (let k = 0; k < venues.length; k++) if (used[k]) opened.push(venues[k].venueId)
  return { byUnit, reasonByUnit, opened, overflow, violations }
}

export interface WeekendGymSection {
  venueId: string
  name: string
  /** Grades playing here, in the order the caller listed them. */
  unitKeys: string[]
  /** Games these grades ask for. */
  games: number
  capacityGames: number
  /** Games past what this gym holds (0 on a gym that fits its grades). */
  over: number
}

export interface WeekendGyms {
  /** unit key → venueId: the decided gym where there is one, the packed gym
   *  everywhere else. A grade the weekend has no building for is absent. */
  byUnit: Record<string, string>
  /** unit key → why it is in that building. Every grade the weekend holds has
   *  one, so a caption or a chip can always say what happened. */
  reasonByUnit: Record<string, PlacementReason>
  /** One section per gym that takes a grade, in the weekend's fill order. */
  sections: WeekendGymSection[]
  /** Grades with no building at all, because the weekend has no gym. */
  unplaced: string[]
  /** Games no gym on this weekend can hold. */
  overflow: number
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
  const fallback = weekend.venues[0]?.venueId
  const byUnit: Record<string, string> = {}
  const reasonByUnit: Record<string, PlacementReason> = {}
  const unplaced: string[] = []
  for (const u of here) {
    const venueId = kept[u.key] ?? packed.byUnit[u.key] ?? fallback
    if (venueId) byUnit[u.key] = venueId
    else unplaced.push(u.key)
    reasonByUnit[u.key] =
      given?.[u.key] ?? packed.reasonByUnit[u.key] ?? (venueId ? "fill" : "overflow")
  }

  const sections: WeekendGymSection[] = []
  let overflow = 0
  for (const venue of weekend.venues) {
    const unitKeys = here.filter((u) => byUnit[u.key] === venue.venueId).map((u) => u.key)
    if (unitKeys.length === 0) continue
    const games = unitKeys.reduce(
      (sum, key) => sum + unitGames(here.find((u) => u.key === key) as PlannerUnit, weekend.targetGamesPerTeam),
      0
    )
    const over = Math.max(0, games - venue.capacityGames)
    overflow += over
    sections.push({
      venueId: venue.venueId,
      name: venue.name,
      unitKeys,
      games,
      capacityGames: venue.capacityGames,
      over,
    })
  }
  for (const key of unplaced) {
    const u = here.find((x) => x.key === key)
    if (u) overflow += unitGames(u, weekend.targetGamesPerTeam)
  }

  return { byUnit, reasonByUnit, sections, unplaced, overflow }
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
    case "resident":
      return "home gym"
    case "bumped":
      return "moved, home gym full"
    case "avoided":
      return "not the gym it just played"
    case "overflow":
      return "no room, short of courts"
    default:
      return null
  }
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
  const [first, ...spill] = gyms.sections

  // 1. Short of courts, which outranks everything else the weekend can say.
  for (const s of gyms.sections) {
    if (s.over > 0) {
      parts.push(
        `${venueShortName(s.name)} over by ${s.over} (${s.games} of ${s.capacityGames})`
      )
    }
  }
  if (gyms.unplaced.length > 0) {
    parts.push(`no gym for ${nameList(gyms.unplaced.map(labelOf))}`)
  }

  // 2. The buildings: what filled, what spilled, and by how much. A grade
  //    named here carries its own reason, so nothing is said twice.
  const named = new Set<string>()
  if (first && spill.length > 0) {
    const room = Math.max(0, first.capacityGames - first.games)
    const all = spill.flatMap((s) => s.unitKeys).filter((k) => gamesOf(k) > 0)
    const forced = all.some((k) => gamesOf(k) > room)
    parts.push(
      `${venueShortName(first.name)} ${forced ? "full at " : ""}${first.games} of ${
        first.capacityGames
      }`
    )
    for (const s of spill) {
      const movers = s.unitKeys.filter((k) => gamesOf(k) > 0)
      const numbers = `${s.games} of ${s.capacityGames}`
      if (movers.length === 0) {
        parts.push(`also open: ${venueShortName(s.name)} (${numbers})`)
        continue
      }
      const reasons = new Set(movers.map((k) => gyms.reasonByUnit[k]))
      const only = reasons.size === 1 ? [...reasons][0] : null
      const kept = !forced && (only === "resident" || only === "decided")
      // Two grades spill, one grade spills: the sentence has to agree with
      // however many of them there are.
      const many = movers.length > 1
      const verb = forced
        ? many
          ? "spill to"
          : "spills to"
        : kept
          ? many
            ? "stay in"
            : "stays in"
          : many
            ? "also run in"
            : "also runs in"
      const tag = kept ? (only === "resident" ? ", home gym" : ", your pick") : ""
      for (const k of movers) named.add(k)
      parts.push(
        `${nameList(movers.map((k) => `${labelOf(k)} (${gamesWord(gamesOf(k))})`))} ${verb} ${venueShortName(
          s.name
        )} (${numbers}${tag})`
      )
    }
  } else if (first && weekend.venues.length > 1) {
    parts.push(
      `fits in ${venueShortName(first.name)} alone, ${first.games} of ${first.capacityGames}`
    )
  }

  // 3. ONE per-grade why, for a grade the buildings clause did not already
  //    explain: a grade moved out of its gym first, then a grade that stayed
  //    in its own gym where fill order would have moved it.
  const chipCaptions: Record<string, string> = {}
  let moved: string | null = null
  let stayed: string | null = null
  for (const key of Object.keys(gyms.reasonByUnit)) {
    const reason = gyms.reasonByUnit[key]
    const at = gyms.byUnit[key]
    const home = homes[key]
    const homeSection = home ? sectionOf.get(home) : undefined
    // A grade the buildings clause already named has had its say.
    const told = named.has(key)
    if (reason === "decided") {
      chipCaptions[key] = "your pick"
    } else if (reason === "bumped") {
      const homeShort = home ? gymName(home) : null
      chipCaptions[key] = homeShort ? `moved, ${homeShort} full` : "moved, home gym full"
      if (!told && moved === null) {
        moved = homeSection
          ? `${labelOf(key)} moved to ${gymName(at)} (${homeShort} full, ${
              homeSection.games
            } of ${homeSection.capacityGames})`
          : homeShort
            ? `${labelOf(key)} moved to ${gymName(at)} (${homeShort} could not hold ${gamesWord(
                gamesOf(key)
              )})`
            : `${labelOf(key)} moved to ${gymName(at)}, its own gym was full`
      }
    } else if (reason === "resident" && first && at !== first.venueId) {
      // Fill order would have put it in the first gym; it is here because it
      // has been here all season, and that is worth saying out loud.
      chipCaptions[key] = "home gym"
      if (!told && stayed === null) stayed = `${labelOf(key)} stays at ${gymName(at)} (home gym)`
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
function unitsFor(
  unitByKey: Map<string, PlannerUnit>,
  keys: string[] | undefined
): PlannerUnit[] {
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
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues">,
  resident: Record<string, string>,
  decided: Record<string, string>
): { byUnit: Record<string, string>; reasonByUnit: Record<string, PlacementReason> } {
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
    new Set(Object.keys(picked))
  )
  const fallback = weekend.venues[0]?.venueId
  const byUnit: Record<string, string> = {}
  const reasonByUnit: Record<string, PlacementReason> = {}
  for (const u of units) {
    // For a grade that alternates, the gym it carries is the one to AVOID, so
    // it is no fallback: that grade takes the gym that fills first instead.
    const home = u.alternate ? undefined : resident[u.key]
    const homeIsOpen = Boolean(home && open.has(home))
    const venueId = picked[u.key] ?? packed.byUnit[u.key] ?? (homeIsOpen ? home : fallback)
    if (!venueId) continue
    byUnit[u.key] = venueId
    reasonByUnit[u.key] =
      picked[u.key] != null
        ? "decided"
        : // A grade the packer seated has its own reason; one it skipped (no
          // teams, so no games to place) is simply riding along in the gym it
          // already plays, or in the one that fills first.
          (packed.reasonByUnit[u.key] ?? (homeIsOpen ? "resident" : "fill"))
  }
  return { byUnit, reasonByUnit }
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
}

/**
 * The same chronological walk as packShownVenues, with the two things a
 * sentence needs on top of the buildings: why each grade is where it is, and
 * which gym it was in before that weekend.
 */
export function packShownPlacements(
  state: PlannerState,
  shown: Record<string, string[]>,
  decided: Record<string, Record<string, string>> = {}
): ShownPlacements {
  const unitByKey = new Map(state.units.map((u) => [u.key, u]))
  const resident: Record<string, string> = {}
  const out: ShownPlacements = { venues: {}, reasons: {}, homes: {} }
  for (const w of chronologicalWeekends(state)) {
    const units = unitsFor(unitByKey, shown[w.sessionId])
    if (units.length === 0) continue
    const home: Record<string, string> = {}
    for (const u of units) if (resident[u.key]) home[u.key] = resident[u.key]
    const packed = packWeekendShown(units, w, resident, decided[w.sessionId] ?? {})
    if (Object.keys(packed.byUnit).length === 0) continue
    for (const key of Object.keys(packed.byUnit)) resident[key] = packed.byUnit[key]
    out.venues[w.sessionId] = packed.byUnit
    out.reasons[w.sessionId] = packed.reasonByUnit
    out.homes[w.sessionId] = home
  }
  return out
}

/** What opening a second building cost the search. One number so the scoring
 *  line below stays readable. */
const SECOND_BUILDING_COST = 150

/**
 * What breaking a gym promise costs, priced above every other lever the search
 * has (owner rule 2026-08-02): "a grade keeps the SAME gym all season and is
 * moved out of it only when capacity genuinely forces it."
 *
 * It used to be 60 — less than one game of peak, which is 100 — so the search
 * would bump a grade out of its home gym to flatten a weekend by a game or
 * two. That is exactly the trade the rule forbids. At 25,000 a violation
 * outranks BOTH peak (a whole month's peak runs to about 170 games, so 17,000)
 * and the one-gym lever's second building (1,500), so the solver now opens
 * another building rather than move a resident — the same order of preference
 * packWeekendVenues already applies inside a single weekend.
 *
 * It does NOT outrank feasibility. Overflow is 1,000,000 a game, and a window
 * can only break as many promises as it has grades × weekends (under 40 at any
 * size the exact search runs, since the greedy path takes over past 300k
 * candidates), so one stranded game still costs more than every broken promise
 * of that month put together.
 */
const GYM_VIOLATION_COST = 25_000

/**
 * How much harder "one-gym" leans on buildings than "balance" does (owner
 * 2026-08-02: "pack one gym" is one of the options an operator gets). Ten
 * times the normal price of a second building, so 1,500 a weekend: past the
 * point where a flatter peak can buy one, since peak games cost 100 each. It
 * buys buildings with peak, never with overflow — that term is a million and
 * stays untouched.
 */
const ONE_GYM_BUILDING_WEIGHT = 10

/**
 * Deterministic per-window search. Every unit appears exactly once per
 * window (NPH's real rule: each grade plays one weekend per monthly
 * session). Overflow is forbidden when any overflow-free assignment
 * exists; ties break toward the two largest units on different weekends
 * and single-building weekends. Levers:
 *  - balance: flattest peak utilization
 *  - compact: fewest weekends used, then flattest
 *  - spread: every weekend used, then flattest
 *  - one-gym: balance, with a second building priced ten times higher, so a
 *    heavier weekend inside one building beats a flatter weekend across two
 *
 * Buildings are part of the score, not an afterthought: every candidate is
 * really packed into gyms (packWeekendVenues), and a month pays for each
 * second building it opens and each gym promise it breaks. Months are decided
 * in calendar order, so October's answer shapes November's residency and
 * never the other way round.
 */
export function proposePlan(
  state: PlannerState,
  lever: PlannerLever
): Record<string, string[]> {
  const units = state.units.filter((u) => u.teams > 0)
  const out: Record<string, string[]> = {}
  // The only thing "one-gym" changes: what a second building costs.
  const buildingCost =
    lever === "one-gym" ? SECOND_BUILDING_COST * ONE_GYM_BUILDING_WEIGHT : SECOND_BUILDING_COST
  const giants = [...units].sort((a, b) => b.teams - a.teams).slice(0, 2).map((u) => u.key)
  const unitByKey = new Map(units.map((u) => [u.key, u]))
  // Where each grade has been playing, as decided by the months already
  // settled. A window scores against THIS snapshot: no weekend of a month
  // feeds residency back into another weekend of the same month.
  const resident: Record<string, string> = {}

  for (const win of state.windows) {
    const n = win.weekends.length
    if (n === 0) continue
    if (n === 1) {
      out[win.weekends[0].sessionId] = units.map((u) => u.key)
      carryResidency(unitByKey, win.weekends, out, resident)
      continue
    }
    let best: number[] | null = null
    let bestScore = Infinity
    const assign = new Array(units.length).fill(0)
    const combos = Math.pow(n, units.length)
    if (combos > 300_000) {
      // Too many units for exact search: largest-first greedy onto the
      // weekend with most remaining capacity (utilization-aware).
      const loads = new Array(n).fill(0)
      const greedy = new Array(units.length).fill(0)
      const order = units
        .map((u, i) => ({ i, teams: u.teams }))
        .sort((a, b) => b.teams - a.teams)
      for (const { i } of order) {
        let pick = 0
        let pickUtil = Infinity
        for (let k = 0; k < n; k++) {
          const cap = win.weekends[k].capacityGames || 1
          const add = Math.ceil((units[i].teams * win.weekends[k].targetGamesPerTeam) / 2)
          const util = (loads[k] + add) / cap
          if (util < pickUtil) {
            pickUtil = util
            pick = k
          }
        }
        greedy[i] = pick
        loads[pick] += Math.ceil(
          (units[i].teams * win.weekends[pick].targetGamesPerTeam) / 2
        )
      }
      win.weekends.forEach((w, k) => {
        out[w.sessionId] = units.filter((_, i) => greedy[i] === k).map((u) => u.key)
      })
      carryResidency(unitByKey, win.weekends, out, resident)
      continue
    }
    // Packing every candidate is only worth it when buildings can actually
    // differ: one gym a weekend, nobody alternating and nobody with a gym to
    // keep means the venue terms are zero for every candidate alike.
    const venueAware =
      win.weekends.some((w) => w.venues.length > 1) ||
      units.some((u) => u.alternate || resident[u.key] != null)
    const loads = new Array(n).fill(0)
    const buckets: PlannerUnit[][] = Array.from({ length: n }, () => [])
    for (let mask = 0; mask < combos; mask++) {
      let m = mask
      for (let i = 0; i < units.length; i++) {
        assign[i] = m % n
        m = Math.floor(m / n)
      }
      loads.fill(0)
      for (let k = 0; k < n; k++) buckets[k].length = 0
      for (let i = 0; i < units.length; i++) {
        loads[assign[i]] += Math.ceil(
          (units[i].teams * win.weekends[assign[i]].targetGamesPerTeam) / 2
        )
        buckets[assign[i]].push(units[i])
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
      // What this month costs in buildings: every extra gym opened on a
      // weekend, and every grade moved out of the gym it should have kept.
      let venueCost = 0
      if (venueAware) {
        for (let k = 0; k < n; k++) {
          if (buckets[k].length === 0) continue
          const packed = packWeekendVenues(buckets[k], win.weekends[k], resident)
          venueCost +=
            Math.max(0, packed.opened.length - 1) * buildingCost +
            packed.violations * GYM_VIOLATION_COST
        }
      }
      // Courts are the cost: rank by ABSOLUTE peak games (a flat 42% of a
      // huge weekend still rents more courts than a flat 74-game one).
      // Availability stays hard via overflow.
      let score = overflow * 1_000_000 + peakGames * 100
      if (lever === "compact") score += used * 50_000
      if (lever === "spread") score += (n - used) * 50_000
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
  }
  return out
}

/** Read the current assignment as sessionId → unit keys (for diffs/UI). */
export function currentAssignment(state: PlannerState): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const win of state.windows)
    for (const w of win.weekends) out[w.sessionId] = w.assigned
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
  const known = (keys: string[] | undefined) =>
    (keys ?? []).filter((k) => order.has(k))
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
  const { there, packed, landed } = packLanding(
    unit,
    to,
    keysThere,
    unitByKey,
    homes,
    decidedThere
  )
  if (!landed || landed === home) return ""
  const shortOf = (venueId: string) => venueShortName(open.get(venueId)?.name ?? "")
  const holders = there.filter(
    (u) => u.key !== unit.key && packed.byUnit[u.key] === home
  )
  const held = holders.reduce((sum, u) => sum + unitGames(u, to.targetGamesPerTeam), 0)
  const capacity = open.get(home)?.capacityGames ?? 0
  const lands = `Lands at ${shortOf(landed) || "another gym"}`
  if (holders.length === 0) return `${lands} (${shortOf(home)} has no room, ${capacity} slots).`
  return `${lands} (${shortOf(home)} holds ${nameList(
    holders.map((u) => u.label)
  )}, ${held} of ${capacity}).`
}

/**
 * A grade's HOME gym, the one rule, in one place: the building it plays most
 * across the season (owner rule 2026-08-02 — one grade keeps one gym all
 * season). Ties go to the gym it plays first, so the answer is stable and a
 * grade that splits its season evenly still has a home to be sent back to.
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

/** Every grade's home gym across the calendar on screen, in one pass over the
 *  buildings the board is already drawing. */
function homeGyms(state: PlannerState, placement: ShownPlacements): Map<string, string> {
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
  /** Where each grade lives across this calendar, so a tidy-up move can be
   *  measured against the promise it would break. */
  const homeGym = homeGyms(state, placement)
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
        for (const unit of candidates) {
          if (demand - gamesOn(unit, w) > w.capacityGames) continue
          const to = roomFor(unit)[0]
          if (!to) continue
          // Feasibility outranks residency: a shortage move ships even when it
          // takes the grade off its own gym, and `lands` is what says so.
          const { move, text } = moveFor(unit, to, "shortage", "Clears the shortage.")
          suggestions.push({ kind: "move-unit", sessionId: w.sessionId, text, move })
          break
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
        if (gyms.sections.length > 1) {
          const [first, ...spill] = gyms.sections
          const opens = nameList(
            spill.map((s) => `${venueShortName(s.name)} (${s.games} of ${s.capacityGames})`)
          )
          let text = `${w.label} fills ${venueShortName(first.name)} (${first.games} of ${
            first.capacityGames
          }) and opens ${opens}, ${gamesWord(demand)} in all.`
          // The one grade whose leaving would close the second building.
          let move: SuggestionMove | undefined
          const spillUnits = spill
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
            if (without.opened.length > 1 || without.overflow > 0) continue
            const to = roomFor(unit)[0]
            if (!to) continue
            // Residency outranks one building a weekend (owner rule
            // 2026-08-02): a grade keeps one gym all season, and tidying a
            // weekend is not worth breaking that. Sending the grade back to its
            // own gym is the case worth a button; parking it anywhere else ships
            // as the recap alone, with nothing to press.
            const home = homeGym.get(unit.key)
            const { landed } = packLanding(
              unit,
              to,
              assignment[to.sessionId] ?? [],
              unitByKey,
              homesArriving(to, unit, w.sessionId),
              decidedAll[to.sessionId] ?? {}
            )
            if (home && landed && landed !== home) continue
            const built = moveFor(unit, to, "two-building", `Keeps ${w.label} in one building.`)
            move = built.move
            text = `${text} ${built.text}`
            break
          }
          suggestions.push({ kind: "two-building", sessionId: w.sessionId, text, move })
        }
      }

      if (assigned.length === 0 && w.capacityGames > 0) {
        let text = `${w.label} has ${w.capacityGames} open slots and no grades on it. Spare capacity, or another league's weekend.`
        let move: SuggestionMove | undefined
        // The busiest weekend of the month is the one with something to give.
        const busiest = [...win.weekends]
          .filter((o) => o.sessionId !== w.sessionId && (assignment[o.sessionId] ?? []).length > 1)
          .sort((a, b) => demandOn(b) - demandOn(a))[0]
        if (busiest) {
          const giver = unitsOn(state.units, assignment[busiest.sessionId] ?? [])
            .filter((u) => u.teams > 0)
            .sort((a, b) => b.teams - a.teams)
            .find((u) => gamesOn(u, w) <= w.capacityGames)
          if (giver) {
            const from = demandOn(busiest)
            const games = gamesOn(giver, busiest)
            const landed = gamesOn(giver, w)
            const lands = landingClause(
              giver,
              w,
              assigned,
              unitByKey,
              homesArriving(w, giver, busiest.sessionId),
              decidedAll[w.sessionId] ?? {}
            )
            move = {
              unitKey: giver.key,
              unitLabel: giver.label,
              games,
              fromSessionId: busiest.sessionId,
              fromLabel: busiest.label,
              toSessionId: w.sessionId,
              toLabel: w.label,
              fromBefore: { demand: from, capacity: busiest.capacityGames },
              toAfter: { demand: landed, capacity: w.capacityGames },
              resolves: "idle-weekend",
              lands,
            }
            text = `${text} Move ${giver.label} (${gamesWord(games)}) from ${busiest.label} (${from} of ${
              busiest.capacityGames
            }) to ${w.label} (${landed} of ${w.capacityGames} after). Puts the empty weekend to work.${
              lands ? ` ${lands}` : ""
            }`
          }
        }
        suggestions.push({ kind: "idle-weekend", sessionId: w.sessionId, text, move })
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
 * A grade's home gym read off its own season in cells: the building it plays
 * most. The same rule the suggestions are vetoed by (one grade, one gym), so
 * the row that draws a move and the core that offers it agree on which
 * building the grade would be giving up.
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

