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
  teams: number
  source: "approved" | "expected" | "none"
}

export interface PlannerWeekend {
  sessionId: string
  label: string
  dateISO: string
  capacityGames: number
  largestVenueCapacity: number
  venues: Array<{ venueId: string; name: string; capacityGames: number }>
  targetGamesPerTeam: number
  assigned: string[] // unit keys
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

/**
 * Deterministic per-window search. Every unit appears exactly once per
 * window (NPH's real rule: each grade plays one weekend per monthly
 * session). Overflow is forbidden when any overflow-free assignment
 * exists; ties break toward the two largest units on different weekends
 * and single-building weekends. Levers:
 *  - balance: flattest peak utilization
 *  - compact: fewest weekends used, then flattest
 *  - spread: every weekend used, then flattest
 */
export function proposePlan(
  state: PlannerState,
  lever: PlannerLever
): Record<string, string[]> {
  const units = state.units.filter((u) => u.teams > 0)
  const out: Record<string, string[]> = {}
  const giants = [...units].sort((a, b) => b.teams - a.teams).slice(0, 2).map((u) => u.key)

  for (const win of state.windows) {
    const n = win.weekends.length
    if (n === 0) continue
    if (n === 1) {
      out[win.weekends[0].sessionId] = units.map((u) => u.key)
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
      continue
    }
    for (let mask = 0; mask < combos; mask++) {
      let m = mask
      for (let i = 0; i < units.length; i++) {
        assign[i] = m % n
        m = Math.floor(m / n)
      }
      const loads = new Array(n).fill(0)
      for (let i = 0; i < units.length; i++) {
        loads[assign[i]] += Math.ceil(
          (units[i].teams * win.weekends[assign[i]].targetGamesPerTeam) / 2
        )
      }
      let overflow = 0
      let peakGames = 0
      let used = 0
      let multiBuilding = 0
      for (let k = 0; k < n; k++) {
        const cap = win.weekends[k].capacityGames
        if (loads[k] > 0) used++
        if (cap <= 0) {
          if (loads[k] > 0) overflow += loads[k]
          continue
        }
        if (loads[k] > cap) overflow += loads[k] - cap
        peakGames = Math.max(peakGames, loads[k])
        if (loads[k] > win.weekends[k].largestVenueCapacity) multiBuilding++
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
      score += multiBuilding * 150 // NPH runs one building per weekend
      if (score < bestScore) {
        bestScore = score
        best = [...assign]
      }
    }
    win.weekends.forEach((w, k) => {
      out[w.sessionId] = units.filter((_, i) => best![i] === k).map((u) => u.key)
    })
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

