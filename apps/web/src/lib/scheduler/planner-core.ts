/**
 * Season planner — PURE core (no DB imports): types, demand math, the
 * deterministic per-window search, and the suggestion rail. The client
 * board imports THIS module; planner.ts adds the prisma-backed load/apply.
 * Deterministic by owner ruling (2026-08-02): no model call in the solve
 * path — validated against NPH's official 2026-27 calendar
 * (scripts/analysis/validate-nph-calendar.ts).
 */

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

export interface PlannerUnit {
  key: string // "age:<ageGroup>"
  label: string
  divisionIds: string[]
  /** This grade should ALTERNATE buildings across weekends rather than keep
   *  one gym all season (travel fairness, owner 2026-08-02). For an
   *  alternating grade the carried gym is the one to AVOID next, not a home. */
  alternate?: boolean
  /** What the board plans on: the operator's step-1 number, never below the
   *  teams already registered — `planningTeams(approved, expected)`.
   *  Everything that computes capacity reads THIS number. */
  teams: number
  /** Teams actually registered (approved submissions). */
  approved: number
  /** What step 1 said to expect. Zero when nobody ever estimated this grade. */
  expected: number
  /** Which of the two numbers is driving `teams`. */
  source: "approved" | "expected" | "none"
}

/**
 * The number a grade plans on (owner ruling 2026-08-02: "I need to be able to
 * edit every team count for the planning mode even if teams are registered").
 * Planning is the operator's call, so their estimate leads — but a plan never
 * makes room for fewer teams than have already registered, because those
 * teams are coming whatever the estimate says.
 */
export function planningTeams(approved: number, expected: number): number {
  return Math.max(approved, expected)
}

/** Which number is driving `planningTeams`: the estimate when it leads,
 *  registration when it does, "none" when the grade has neither yet. */
export function planningSource(
  approved: number,
  expected: number
): "approved" | "expected" | "none" {
  if (expected > approved) return "expected"
  return approved > 0 ? "approved" : "none"
}

export interface PlannerVenue {
  venueId: string
  name: string
  capacityGames: number
  /** Which gym the league fills FIRST (0 = first choice). A weekend's venue
   *  array always arrives sorted by this then by name, and the packer walks
   *  it in that order without re-sorting. */
  fillOrder: number
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

export type PlannerLever = "balance" | "compact" | "spread"

export interface PlannerSuggestion {
  kind: "overflow" | "extend-hours" | "move-unit" | "idle-weekend" | "two-building"
  sessionId: string
  text: string
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
  /** The weekend spills past its biggest gym and a second one is attached. */
  twoBuildings: boolean
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
  weekend: Pick<
    PlannerWeekend,
    "targetGamesPerTeam" | "capacityGames" | "largestVenueCapacity" | "venues"
  >,
  assigned: string[]
): WeekendLoad {
  const demand = weekendDemand(units, weekend, assigned)
  const capacity = weekend.capacityGames
  const ratio = capacity > 0 ? demand / capacity : demand > 0 ? Infinity : 0
  const twoBuildings = demand > weekend.largestVenueCapacity && weekend.venues.length > 1
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
 * It reads the units' `teams`, the planning number, which never sits below
 * the teams that have registered — that is the whole point of watching in
 * October.
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

export interface WeekendVenuePacking {
  /** The one gym each grade plays in this weekend: unit key → venueId. */
  byUnit: Record<string, string>
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
 */
export function packWeekendVenues(
  units: PlannerUnit[],
  weekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues">,
  prior: Record<string, string>
): WeekendVenuePacking {
  const byUnit: Record<string, string> = {}
  const venues = weekend.venues
  const target = weekend.targetGamesPerTeam

  if (units.length === 0 || venues.length === 0) {
    let stranded = 0
    for (const u of units) stranded += Math.max(0, unitGames(u, target))
    return { byUnit, opened: [], overflow: stranded, violations: 0 }
  }

  const remaining = venues.map((v) => v.capacityGames)
  const used = venues.map(() => false)
  const indexOf = new Map<string, number>()
  venues.forEach((v, k) => indexOf.set(v.venueId, k))
  let overflow = 0
  let violations = 0

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
      used[k] = true
      remaining[k] -= demand
    } else {
      violations++
      pool.push(u)
    }
  }

  // Then the rest, biggest grade first: a big grade placed late is the one
  // that opens a second building nobody needed.
  pool.sort((a, b) => b.teams - a.teams || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  for (const u of pool) {
    const demand = unitGames(u, target)
    const avoid = u.alternate ? prior[u.key] : undefined
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
      used[big] = true
      continue
    }
    byUnit[u.key] = venues[pick].venueId
    used[pick] = true
    remaining[pick] -= demand
  }

  const opened: string[] = []
  for (let k = 0; k < venues.length; k++) if (used[k]) opened.push(venues[k].venueId)
  return { byUnit, opened, overflow, violations }
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
    const seen = new Set<string>()
    const units: PlannerUnit[] = []
    for (const key of assignment[w.sessionId] ?? []) {
      if (seen.has(key)) continue
      seen.add(key)
      const u = unitByKey.get(key)
      if (u) units.push(u)
    }
    const packed = packWeekendVenues(units, w, resident)
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

/** What opening a second building, and breaking a gym promise, cost the
 *  search. One number so the scoring line below stays readable. */
const SECOND_BUILDING_COST = 150
const GYM_VIOLATION_COST = 60

/**
 * Deterministic per-window search. Every unit appears exactly once per
 * window (NPH's real rule: each grade plays one weekend per monthly
 * session). Overflow is forbidden when any overflow-free assignment
 * exists; ties break toward the two largest units on different weekends
 * and single-building weekends. Levers:
 *  - balance: flattest peak utilization
 *  - compact: fewest weekends used, then flattest
 *  - spread: every weekend used, then flattest
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
            Math.max(0, packed.opened.length - 1) * SECOND_BUILDING_COST +
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

/** Plain-language observations about an assignment — the suggestion rail. */
export function suggestFor(
  state: PlannerState,
  assignment: Record<string, string[]>
): PlannerSuggestion[] {
  const suggestions: PlannerSuggestion[] = []
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const assigned = assignment[w.sessionId] ?? []
      const demand = weekendDemand(state.units, w, assigned)
      if (demand > w.capacityGames) {
        const short = demand - w.capacityGames
        suggestions.push({
          kind: "overflow",
          sessionId: w.sessionId,
          text: `${w.label} needs ${demand} games but has ${w.capacityGames} slots (${short} short). Extend hours, add a court, or drag a grade to a lighter weekend.`,
        })
        const smallest = assigned
          .map((k) => state.units.find((u) => u.key === k))
          .filter(Boolean)
          .sort((a, b) => a!.teams - b!.teams)[0]
        const roomier = win.weekends.find(
          (o) =>
            o.sessionId !== w.sessionId &&
            weekendDemand(state.units, o, assignment[o.sessionId] ?? []) +
              Math.ceil((smallest!.teams * o.targetGamesPerTeam) / 2) <=
              o.capacityGames
        )
        if (smallest && roomier) {
          suggestions.push({
            kind: "move-unit",
            sessionId: w.sessionId,
            text: `Moving ${smallest.label} to ${roomier.label} clears the shortage.`,
          })
        }
      } else if (demand > w.largestVenueCapacity && w.venues.length > 1) {
        suggestions.push({
          kind: "two-building",
          sessionId: w.sessionId,
          text: `${w.label} spills past ${
            w.venues.reduce((a, b) => (a.capacityGames >= b.capacityGames ? a : b)).name
          } into a second gym (${demand} games).`,
        })
      }
      if (assigned.length === 0 && w.capacityGames > 0) {
        suggestions.push({
          kind: "idle-weekend",
          sessionId: w.sessionId,
          text: `${w.label} has ${w.capacityGames} open slots and no grades assigned: spare capacity, or another league's weekend.`,
        })
      }
    }
  }
  return suggestions
}

