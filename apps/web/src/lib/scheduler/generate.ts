/**
 * Regular-season schedule generator (v1).
 *
 * Pure — takes a serialized season and returns a proposed game list. No DB
 * writes. The API routes call `generateSchedule` and then optionally write
 * the result back as Game rows on commit.
 *
 * Algorithm outline:
 *   1. Build slot inventory from SeasonSessionDayVenueCourt × gameSlotMinutes.
 *   2. For each scheduling unit (division, or SchedulingGroup when
 *      allowCrossDivisionScheduling is true), build a pairing pool sized
 *      roughly to ceil(teamCount × gamesGuaranteed / 2), rotating through
 *      unique pairs with fairness.
 *   3. Walk slots chronologically and greedily assign the best-scoring
 *      unassigned pairing that doesn't violate hard constraints. Soft
 *      scoring follows the philosophy (FAMILY_FRIENDLY vs SPREAD_DAYS).
 */

export type SchedulerPhilosophy = "FAMILY_FRIENDLY" | "SPREAD_DAYS"

export interface SchedulerSlot {
  sessionId: string
  dayId: string
  dayVenueId: string
  courtId: string
  /** Preferred fill order within the day-venue (0 = first choice). */
  courtOrder: number
  venueId: string
  /** Building fill order for the season (0 = the gym that fills first).
   *  Dense 0..n-1; gyms the league never ordered rank after the ordered
   *  ones, in plan order (owner 2026-08-02). */
  venueRank: number
  startAt: Date
  endAt: Date
}

export type WeekendStyle = "SAME_DAY" | "SPLIT_DAYS"

/** A day a team cannot play (owner 2026-08-01: approved blackout requests +
 *  league-entered blackouts). dateKey matches the engine's local date key;
 *  missing time bounds = the whole day. */
export interface ScheduleBlackout {
  dateKey: string
  startMin?: number
  endMin?: number
}

/** An approved best-effort start-time window (owner 2026-08-01): games on the
 *  matching day should START within [earliestMin, latestMin]. */
export interface ScheduleWindow {
  dayOfWeek?: number // 0=Sunday … 6=Saturday
  dateKey?: string
  earliestMin?: number
  latestMin?: number
}

export interface SchedulerTeam {
  submissionId: string
  teamId: string
  divisionId: string
  name: string
  /** Resolved weekend preference: TEAM's own choice wins, else the league
   *  default (owner 2026-08-01). Absent = derive from philosophy. */
  weekendStyle?: WeekendStyle
  /** Hard no-play periods (approved blackout requests + league-entered). */
  blackouts?: ScheduleBlackout[]
  /** Approved best-effort start-time windows. */
  windows?: ScheduleWindow[]
}

export interface SchedulerUnit {
  key: string // divisionId or groupId
  label: string
  teams: SchedulerTeam[]
}

export interface SchedulerInput {
  gamesGuaranteed: number
  gameSlotMinutes: number
  /** The league's Friday-evening window, when it set one (owner 2026-08-07). */
  fridayStartTime?: string | null
  fridayEndTime?: string | null
  /** Analysis-only tap: called once per internal attempt with the candidate
   *  games and the selection key. Never alters behavior. */
  debugAttempt?: (attempt: number, games: ProposedGame[], key: number[]) => void
  gameLengthMinutes: number
  idealGamesPerDayPerTeam: number
  schedulingPhilosophy: SchedulerPhilosophy
  allowCrossDivisionScheduling: boolean
  defaultVenueOpenTime: string
  defaultVenueCloseTime: string
  divisions: Array<{
    id: string
    name: string
    teams: SchedulerTeam[]
  }>
  schedulingGroups: Array<{
    id: string
    name: string
    divisionIds: string[]
  }>
  sessions: Array<{
    id: string
    phase: "REGULAR" | "PLAYOFF"
    label?: string | null
    targetGamesPerTeam?: number | null
    days: Array<{
      id: string
      date: string // ISO date
      dayVenues: Array<{
        id: string
        venueId: string
        startTime: string | null
        endTime: string | null
        courts: Array<{ id: string; order?: number }>
      }>
    }>
  }>
  /**
   * COURTS THE LEAGUE HOLDS BACK (Season.courtBuffer, owner ruling
   * 2026-08-03). Games overrun and teams still arrive in September, so an
   * operator keeps a court empty rather than plan to the last slot. It applies
   * per building per DAY — usable courts = max(0, courts − buffer) — and it
   * applies here, in the one place slots are built, so planning capacity, the
   * rental blocks, the ask sheet and the generator all count the same courts.
   * 0 (the default) plans to the whole building.
   */
  courtBuffer?: number
  /**
   * Optional per-session include list (sessionId → unit keys). A session with
   * an entry only hosts those units; sessions without an entry host any unit.
   * This is how the owner squeezes divisions into the sessions they fit in.
   */
  sessionUnitFilter?: Record<string, string[]>
  /**
   * What each gym IS to the league (SeasonVenue.role, owner ruling
   * 2026-08-03): "home" is the building it owns and the one games pack into
   * first, "pool" is a gym it rents. A gym missing from the map is pool. This
   * REPLACES venueFillOrder, which died with the fill-order model.
   */
  venueRoles?: Record<string, "home" | "pool">
  /**
   * Which BUILDING a grade plays in on a given weekend (SeasonSession
   * .unitVenues, owner 2026-08-02): sessionId → divisionId → venueId. A soft
   * law: games only leave their gym when it has nothing left to give.
   */
  venueAssignments?: Record<string, Record<string, string>>
  /**
   * Session-by-session mode (owner 2026-07-30): only these sessions produce
   * slots, per-team demand scales to their session targets, and
   * `existingGames` seeds matchup/count state so matchups rotate and
   * guarantees accumulate across separately-scheduled sessions.
   */
  restrictToSessionIds?: string[]
  existingGames?: Array<{
    homeTeamId: string
    awayTeamId: string
    scheduledAt?: string
    courtId?: string | null
    sessionId?: string | null
  }>
  /**
   * Stable per-season variety seed (owner 2026-07-31): rotates which
   * matchups repeat when the guarantee exceeds a full round robin, and
   * thereby which teams land in which time slots — WITHOUT randomness, so a
   * previewed schedule commits identically and re-runs reproduce. Different
   * seasons get different rotations.
   */
  varietySeed?: number
  /**
   * Court time already taken by OTHER leagues/seasons at shared venues
   * (owner 2026-07-31): hard bookings the generator schedules around —
   * never a double-booking, never a hard stop.
   */
  busyCourtBookings?: Array<{ courtId: string; start: string; end: string }>
  /**
   * Scenario overrides (owner 2026-08-01: recommendations, not settings).
   * excludeCourtIds removes courts from the grid entirely; dayWindow clamps
   * every day's open hours; compactDays nudges games toward the earliest
   * waves so days finish early.
   */
  excludeCourtIds?: string[]
  dayWindow?: { startTime?: string; endTime?: string }
  compactDays?: boolean
}

export interface ProposedGame {
  sessionId: string
  dayId: string
  dayVenueId: string
  courtId: string
  venueId: string
  homeTeamId: string
  awayTeamId: string
  scheduledAt: string
  duration: number
  unitKey: string
}

export interface SchedulerResult {
  games: ProposedGame[]
  unscheduled: Array<{
    unitKey: string
    homeTeamId: string
    awayTeamId: string
    reason: string
  }>
  warnings: string[]
  /** Things the engine DID to make everything fit — informational, not
   *  errors (owner 2026-08-01: concession warnings read like failures). */
  tradeoffs: string[]
  /** Games placed in a gym other than the one their grade was assigned for
   *  that weekend (owner 2026-08-02). 0 when no gyms were assigned. */
  venueFallbacks: number
  utilization: {
    slotsTotal: number
    slotsUsed: number
    courtMinutesAvailable: number
    courtMinutesUsed: number
    teamGameCounts: Record<string, number>
  }
}

// ---------- helpers ----------

function parseHHMM(hhmm?: string | null): { h: number; m: number } | null {
  if (!hhmm) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!m) return null
  return { h: parseInt(m[1]), m: parseInt(m[2]) }
}

function atTimeOnDate(iso: string, hhmm: { h: number; m: number }): Date {
  const d = new Date(iso)
  d.setHours(hhmm.h, hhmm.m, 0, 0)
  return d
}

function toMinutes(d: Date): number {
  return Math.floor(d.getTime() / 60000)
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

// ---------- slot inventory ----------

/**
 * The order games pack into buildings (owner ruling 2026-08-03, venue model
 * v2): the HOME gym first, because it is owned and costs nothing, then the
 * rented pool biggest first so a weekend that has to rent rents as few
 * buildings as it can. Returns a DENSE rank (0 = packs first) so callers can
 * compare ranks directly and ties never interleave two buildings.
 *
 * The pool tie-breaks on capacity, then on venueId: the engine's input carries
 * no venue NAMES, so the id stands in for the name-ascending rule the planner
 * uses. Either way it is deterministic, which is the point.
 */
export function venueRanks(input: SchedulerInput): Map<string, number> {
  const appearance: string[] = []
  const capacity = new Map<string, number>()
  const fallbackOpen = parseHHMM(input.defaultVenueOpenTime) ?? { h: 9, m: 0 }
  const fallbackClose = parseHHMM(input.defaultVenueCloseTime) ?? { h: 20, m: 0 }
  const windowOpen = parseHHMM(input.dayWindow?.startTime ?? null)
  const windowClose = parseHHMM(input.dayWindow?.endTime ?? null)
  const minutes = (t: { h: number; m: number }) => t.h * 60 + t.m
  for (const s of input.sessions) {
    for (const d of s.days) {
      for (const dv of d.dayVenues) {
        if (!appearance.includes(dv.venueId)) appearance.push(dv.venueId)
        const open = Math.max(
          minutes(parseHHMM(dv.startTime) ?? fallbackOpen),
          windowOpen ? minutes(windowOpen) : 0
        )
        const close = Math.min(
          minutes(parseHHMM(dv.endTime) ?? fallbackClose),
          windowClose ? minutes(windowClose) : 24 * 60
        )
        const perCourt = Math.max(0, Math.floor((close - open) / input.gameSlotMinutes))
        // Ranked on the courts games can actually go on, buffer included, so
        // the ordering agrees with the slots the same input produces.
        capacity.set(
          dv.venueId,
          (capacity.get(dv.venueId) ?? 0) +
            perCourt * usableCourts(dv.courts, input.courtBuffer).length
        )
      }
    }
  }
  const roles = input.venueRoles ?? {}
  const isHome = (venueId: string): boolean => roles[venueId] === "home"
  const ordered = appearance
    .map((venueId, i) => ({ venueId, i }))
    .sort((a, b) => {
      const ha = isHome(a.venueId) ? 0 : 1
      const hb = isHome(b.venueId) ? 0 : 1
      if (ha !== hb) return ha - hb
      const ca = capacity.get(a.venueId) ?? 0
      const cb = capacity.get(b.venueId) ?? 0
      if (ca !== cb) return cb - ca
      return a.venueId < b.venueId ? -1 : a.venueId > b.venueId ? 1 : a.i - b.i
    })
  return new Map(ordered.map((v, rank) => [v.venueId, rank]))
}

/**
 * The courts of one gym on one day that games may actually be put on: the
 * courts wired in, less the ones the league holds back (Season.courtBuffer,
 * owner ruling 2026-08-03). The HELD courts are the last ones in the day's
 * order, so the preferred courts — the ones an operator numbers 1, 2, 3 — keep
 * filling first and the empty court is the far end of the gym.
 *
 * Never negative: a buffer bigger than the building leaves it with no courts,
 * which is honest — that weekend has no room, and every meter says so.
 */
export function usableCourts<T>(courts: T[], buffer: number | undefined): T[] {
  const held = Math.max(0, Math.floor(buffer ?? 0))
  if (held === 0) return courts
  return courts.slice(0, Math.max(0, courts.length - held))
}

export function buildSlots(input: SchedulerInput): SchedulerSlot[] {
  const slots: SchedulerSlot[] = []
  const ranks = venueRanks(input)
  const fallbackOpen = parseHHMM(input.defaultVenueOpenTime) ?? { h: 9, m: 0 }
  const fallbackClose = parseHHMM(input.defaultVenueCloseTime) ?? { h: 20, m: 0 }

  const restrict = input.restrictToSessionIds?.length
    ? new Set(input.restrictToSessionIds)
    : null
  const excluded = input.excludeCourtIds?.length ? new Set(input.excludeCourtIds) : null
  const windowOpen = parseHHMM(input.dayWindow?.startTime ?? null)
  const windowClose = parseHHMM(input.dayWindow?.endTime ?? null)
  const laterOf = (a: { h: number; m: number }, b: { h: number; m: number } | null) =>
    b && b.h * 60 + b.m > a.h * 60 + a.m ? b : a
  const earlierOf = (a: { h: number; m: number }, b: { h: number; m: number } | null) =>
    b && b.h * 60 + b.m < a.h * 60 + a.m ? b : a
  for (const s of input.sessions) {
    if (s.phase !== "REGULAR") continue
    if (restrict && !restrict.has(s.id)) continue
    for (const d of s.days) {
      for (const dv of d.dayVenues) {
        const open = laterOf(parseHHMM(dv.startTime) ?? fallbackOpen, windowOpen)
        const close = earlierOf(parseHHMM(dv.endTime) ?? fallbackClose, windowClose)
        const dayStart = atTimeOnDate(d.date, open)
        const dayEnd = atTimeOnDate(d.date, close)
        if (dayEnd <= dayStart) continue

        const windowMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000
        const slotsPerCourt = Math.floor(windowMinutes / input.gameSlotMinutes)

        // The held-back courts never become slots, so nothing downstream —
        // capacity, packing, the generator — can quietly book one. Held out of
        // what is LEFT after exclusions, and named by id so the loop below
        // keeps every court's own position in the day's order.
        const playable = new Set(
          usableCourts(
            excluded ? dv.courts.filter((c) => !excluded.has(c.id)) : dv.courts,
            input.courtBuffer
          ).map((c) => c.id)
        )
        for (const [courtIdx, court] of dv.courts.entries()) {
          if (!playable.has(court.id)) continue
          if (excluded?.has(court.id)) continue
          for (let i = 0; i < slotsPerCourt; i++) {
            const startAt = new Date(dayStart.getTime() + i * input.gameSlotMinutes * 60000)
            const endAt = new Date(startAt.getTime() + input.gameSlotMinutes * 60000)
            slots.push({
              sessionId: s.id,
              dayId: d.id,
              dayVenueId: dv.id,
              courtId: court.id,
              courtOrder: court.order ?? courtIdx,
              venueId: dv.venueId,
              venueRank: ranks.get(dv.venueId) ?? 0,
              startAt,
              endAt,
            })
          }
        }
      }
    }
  }
  // Day by day chronologically; within a day the HOME GYM's whole inventory
  // comes first (owner ruling 2026-08-03: the building the league owns is free,
  // so it fills before anything is rented), and inside a gym the PREFERRED
  // court's whole timeline, so games pack onto court 1 and only overflow to
  // court 2 when needed (owner 2026-07-30). Same-order courts (legacy rows,
  // order 0 everywhere) degrade to the old pure-time sort.
  const dayKey = (d: Date) => {
    const c = new Date(d)
    c.setHours(0, 0, 0, 0)
    return c.getTime()
  }
  slots.sort(
    (a, b) =>
      dayKey(a.startAt) - dayKey(b.startAt) ||
      a.venueRank - b.venueRank ||
      a.courtOrder - b.courtOrder ||
      a.startAt.getTime() - b.startAt.getTime()
  )
  return slots
}

// ---------- scheduling units ----------

export function buildUnits(input: SchedulerInput): SchedulerUnit[] {
  const divisionsById = new Map(input.divisions.map((d) => [d.id, d]))

  if (input.allowCrossDivisionScheduling && input.schedulingGroups.length > 0) {
    const groupedDivisionIds = new Set<string>()
    const units: SchedulerUnit[] = []
    for (const g of input.schedulingGroups) {
      const groupTeams: SchedulerTeam[] = []
      for (const divId of g.divisionIds) {
        groupedDivisionIds.add(divId)
        const d = divisionsById.get(divId)
        if (d) groupTeams.push(...d.teams)
      }
      if (groupTeams.length >= 2) {
        units.push({ key: `group:${g.id}`, label: g.name, teams: groupTeams })
      }
    }
    // Divisions not in any group still schedule independently
    for (const d of input.divisions) {
      if (groupedDivisionIds.has(d.id)) continue
      if (d.teams.length >= 2) {
        units.push({ key: `division:${d.id}`, label: d.name, teams: d.teams })
      }
    }
    return units
  }

  // Default: each division is its own unit
  return input.divisions
    .filter((d) => d.teams.length >= 2)
    .map((d) => ({ key: `division:${d.id}`, label: d.name, teams: d.teams }))
}

// ---------- pairing pool ----------

interface Pairing {
  unitKey: string
  homeTeamId: string
  awayTeamId: string
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Integer hash for variety seeds. The raw seed reaches every consumer
 * through SMALL moduli (round offset % 7, day rotation % 2), so two
 * different seasons could collapse onto identical schedules whenever the
 * raw values collided in those tiny spaces — hash first so every seed bit
 * matters.
 */
function mixSeed(x: number): number {
  let h = x | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b)
  h ^= h >>> 16
  return h >>> 0
}

function buildPairings(
  unit: SchedulerUnit,
  gamesGuaranteed: number,
  rawSeed = 0
): Pairing[] {
  const varietySeed = mixSeed(rawSeed)
  const n = unit.teams.length
  if (n < 2) return []
  const targetGames = Math.ceil((n * gamesGuaranteed) / 2)

  // Circle-method round-robin rounds: every full round pairs each team
  // exactly once, so consuming rounds in order keeps per-team game counts
  // within one of each other at ANY pool size. (The old uniform-pair
  // sampling could hand one team 11 games and another 7 for the same
  // guarantee.) Odd team counts get a rotating bye via a phantom slot.
  const ids = unit.teams.map((t) => t.teamId)
  const arr: Array<string | null> = [...ids]
  if (arr.length % 2 === 1) arr.push(null) // bye
  const m = arr.length
  const rounds: Array<Array<[string, string]>> = []
  for (let r = 0; r < m - 1; r++) {
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i]
      const b = arr[m - 1 - i]
      if (a === null || b === null) continue
      // Alternate sides round-to-round for home/away balance
      pairs.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    arr.splice(1, 0, arr.pop() as string | null)
  }
  if (rounds.length === 0) return []

  const pool: Pairing[] = []
  let cycle = 0
  while (pool.length < targetGames) {
    // Per-cycle seeded rotation: within each full cycle every round still
    // appears exactly once (per-team counts stay within one of each other),
    // but the PARTIAL last cycle starts from a season-specific offset — so
    // WHICH matchups repeat (8 teams x 10 games = 3 rematches) changes from
    // season to season instead of always being rounds 1-3.
    const fullCycle = Math.floor(cycle / rounds.length)
    const offset = (varietySeed * (fullCycle + 1)) % rounds.length
    const round = rounds[(cycle + offset) % rounds.length]
    // Repeat meetings (second cycle onward) swap home/away
    const flip = Math.floor(cycle / rounds.length) % 2 === 1
    for (const [a, b] of round) {
      if (pool.length >= targetGames) break
      pool.push({
        unitKey: unit.key,
        homeTeamId: flip ? b : a,
        awayTeamId: flip ? a : b,
      })
    }
    cycle++
  }
  return pool
}

// ---------- main generator ----------

/**
 * A SPLIT DAY NEEDS DRIVING TIME (owner ruling 2026-08-07): when a team's
 * two games land at different gyms, the gap between them IS the drive — so
 * it is never a "wait", and it must be at least this many empty slots or
 * the family physically cannot attend both games. At 75-minute slots, 2
 * empty slots ≈ 2.5 hours: enough for any pair of gyms in the pool. Once
 * venue clusters land (plan item C2) this becomes per-pair travel time.
 */
export const TRAVEL_MIN_GAP_SLOTS = 2

/**
 * Auto-retry wrapper (owner 2026-08-01: "better spread over two days than
 * back-to-backs"): whether a weekend can be split one-game-per-day is
 * decided by which matchups share the weekend — an odd matchup-cycle makes
 * a double mathematically unavoidable INSIDE that variation. So when the
 * one-game-per-day model produces doubles, deterministically try a few
 * sibling variations and keep the first clean one. Same input → same
 * output, so previews still commit identically.
 */
export function generateSchedule(input: SchedulerInput): SchedulerResult {
  const attempts = 6
  const philosophyStyle: WeekendStyle =
    input.schedulingPhilosophy === "SPREAD_DAYS" ? "SPLIT_DAYS" : "SAME_DAY"
  const styleByTeam = new Map<string, string>()
  for (const d of input.divisions)
    for (const t of d.teams) styleByTeam.set(t.teamId, t.weekendStyle ?? philosophyStyle)
  const dkOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  // Max first/last-tip unevenness across teams (day edges from the games).
  const edgeSpread = (games: ProposedGame[]): number => {
    // Per UNIT-day: the division block's opening/closing games are the
    // scarce, rotatable edges.
    const firstByDay = new Map<string, number>()
    const lastByDay = new Map<string, number>()
    for (const g of games) {
      const t = new Date(g.scheduledAt).getTime()
      const dk = `${dkOf(new Date(g.scheduledAt))}|${g.unitKey}`
      if (!firstByDay.has(dk) || t < firstByDay.get(dk)!) firstByDay.set(dk, t)
      if (!lastByDay.has(dk) || t > lastByDay.get(dk)!) lastByDay.set(dk, t)
    }
    const firsts: Record<string, number> = {}
    const lasts: Record<string, number> = {}
    const days: Record<string, number> = {}
    const seenDay = new Set<string>()
    const teams = new Set<string>()
    for (const g of games) {
      const t = new Date(g.scheduledAt).getTime()
      const dk = `${dkOf(new Date(g.scheduledAt))}|${g.unitKey}`
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        teams.add(id)
        if (!seenDay.has(`${id}|${dk}`)) {
          seenDay.add(`${id}|${dk}`)
          days[id] = (days[id] ?? 0) + 1
        }
        if (firstByDay.get(dk) === t) firsts[id] = (firsts[id] ?? 0) + 1
        if (lastByDay.get(dk) === t && lastByDay.get(dk) !== firstByDay.get(dk))
          lasts[id] = (lasts[id] ?? 0) + 1
      }
    }
    // Spread of early/late SHARE (percent of each team's playing days) —
    // split-days teams play ~2× the days of one-trip teams, so raw counts
    // aren't comparable.
    let spread = 0
    for (const counts of [firsts, lasts]) {
      const vals = [...teams].map((id) =>
        Math.round((100 * (counts[id] ?? 0)) / Math.max(1, days[id] ?? 1))
      )
      if (vals.length > 0) spread = Math.max(spread, Math.max(...vals) - Math.min(...vals))
    }
    return spread
  }
  // Approved-request compliance for a candidate result (windows + blackouts).
  const requestIssues = (games: ProposedGame[]): number => {
    let viol = 0
    const windowsOf = new Map<string, NonNullable<SchedulerTeam["windows"]>>()
    const blackoutsOf = new Map<string, NonNullable<SchedulerTeam["blackouts"]>>()
    for (const d of input.divisions) {
      for (const t of d.teams) {
        if (t.windows?.length) windowsOf.set(t.teamId, t.windows)
        if (t.blackouts?.length) blackoutsOf.set(t.teamId, t.blackouts)
      }
    }
    if (windowsOf.size === 0 && blackoutsOf.size === 0) return 0
    for (const g of games) {
      const d = new Date(g.scheduledAt)
      const dk = dkOf(d)
      const startMin = d.getHours() * 60 + d.getMinutes()
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        for (const w of windowsOf.get(id) ?? []) {
          const applies =
            (w.dateKey !== undefined && w.dateKey === dk) ||
            (w.dayOfWeek !== undefined && d.getDay() === w.dayOfWeek)
          if (!applies) continue
          if (
            (w.earliestMin !== undefined && startMin < w.earliestMin) ||
            (w.latestMin !== undefined && startMin > w.latestMin)
          )
            viol++
        }
        for (const b of blackoutsOf.get(id) ?? []) {
          if (b.dateKey !== dk) continue
          const from = b.startMin ?? 0
          const to = b.endMin ?? 24 * 60
          if (startMin < to && from < startMin + input.gameSlotMinutes) viol++
        }
      }
    }
    return viol
  }

  /** [back-to-backs, style violations] for a candidate result. A
   *  back-to-back is a SAME-GYM shape; consecutive games at different gyms
   *  are the undriveable-split problem and candidateBurdens counts those —
   *  double-counting them here would let one bad day outvote two. */
  const shapeIssues = (games: ProposedGame[]): [number, number] => {
    const bySessionTeam = new Map<string, Array<{ t: number; v: string }>>()
    for (const g of games) {
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const k = `${g.sessionId}|${id}`
        if (!bySessionTeam.has(k)) bySessionTeam.set(k, [])
        bySessionTeam.get(k)!.push({ t: new Date(g.scheduledAt).getTime(), v: g.venueId })
      }
    }
    let b2b = 0
    let styleViol = 0
    for (const [k, stops] of bySessionTeam) {
      if (stops.length < 2) continue
      const teamId = k.split("|")[1]
      const style = styleByTeam.get(teamId) ?? philosophyStyle
      stops.sort((a, b) => a.t - b.t)
      const dks = stops.map((s) => dkOf(new Date(s.t)))
      const sameDay = new Set(dks).size === 1
      if (sameDay) {
        for (let i = 1; i < stops.length; i++) {
          if (stops[i].v !== stops[i - 1].v) continue
          if ((stops[i].t - stops[i - 1].t) / (input.gameSlotMinutes * 60000) - 1 <= 0) b2b++
        }
      }
      if ((style === "SAME_DAY" && !sameDay) || (style === "SPLIT_DAYS" && sameDay)) styleViol++
    }
    return [b2b, styleViol]
  }
  let best: SchedulerResult | null = null
  /**
   * A CANDIDATE'S DAY-SHAPE BURDENS, for selection (owner ruling 2026-08-07:
   * the judge was blind — a 22-split candidate lost to a 62-split one on
   * back-to-backs alone). Venue-aware: consecutive games at DIFFERENT gyms
   * are a drive, so their gap is never a "wait" — and a gap too short to
   * drive (under 2 slots) is its own count, worse than the split itself,
   * because a family physically cannot attend both games.
   */
  const candidateBurdens = (
    games: ProposedGame[]
  ): { splits: number; tightSplits: number; maxTeamSplits: number; monster: number; mid: number } => {
    const slotMs = (input.gameSlotMinutes || 60) * 60000
    const byTeamDay = new Map<string, Array<{ t: number; v: string }>>()
    for (const g of games) {
      const d = new Date(g.scheduledAt)
      const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const k = `${id}|${dk}`
        if (!byTeamDay.has(k)) byTeamDay.set(k, [])
        byTeamDay.get(k)!.push({ t: d.getTime(), v: g.venueId })
      }
    }
    let splits = 0
    let tightSplits = 0
    let monster = 0
    let mid = 0
    const splitsPerTeam = new Map<string, number>()
    for (const [tk, list] of byTeamDay) {
      list.sort((a, b) => a.t - b.t)
      if (new Set(list.map((x) => x.v)).size > 1) {
        splits++
        const id = tk.split("|")[0]
        splitsPerTeam.set(id, (splitsPerTeam.get(id) ?? 0) + 1)
      }
      for (let i = 1; i < list.length; i++) {
        const gap = (list[i].t - list[i - 1].t) / slotMs - 1
        if (list[i].v !== list[i - 1].v) {
          if (gap < TRAVEL_MIN_GAP_SLOTS) tightSplits++
          continue
        }
        if (gap > 4) monster++
        else if (gap > 2) mid++
      }
    }
    // The owner's even-spread law in one number: the worst-off team's split
    // count. Two candidates with equal totals are told apart by who
    // concentrates them ("everybody gets one or two out of ten, not one
    // team with four").
    const maxTeamSplits = Math.max(0, ...splitsPerTeam.values())
    return { splits, tightSplits, maxTeamSplits, monster, mid }
  }

  const KEY_LEN = 10
  let bestKey: number[] = Array(KEY_LEN).fill(Infinity)
  let attemptCap = attempts
  for (let k = 0; k < attemptCap; k++) {
    const res = generateScheduleOnce({
      ...input,
      varietySeed: (input.varietySeed ?? 0) + k * 7919,
    })
    // A structural capacity shortfall is arithmetic, not luck — more
    // variations can't conjure court-slots. One confirmation attempt only.
    if (res.unscheduled.length >= 3 && k === 0) attemptCap = Math.min(attempts, 2)
    const [b2b, styleViol] = shapeIssues(res.games)
    const bur = candidateBurdens(res.games)
    // THE JUDGE SCORES WHAT THE FAIRNESS TABLE SCORES (owner ruling
    // 2026-08-07, replacing 2026-08-01's b2b-at-all-costs order — the old
    // key was proven blind: a 22-split candidate lost to a 62-split one).
    // Undriveable split days first, then splits, then monster waits, then
    // back-to-backs; requests stay best-effort by contract.
    const key: number[] = [
      res.unscheduled.length,
      // Splits and undriveable splits share one currency — the fairness
      // table's own weights (20 and 20+30) — so the judge never trades six
      // new split days to erase one tight one, or vice versa. Strict
      // lexicographic ranking here was measured doing exactly that.
      bur.splits * 20 + bur.tightSplits * 30,
      bur.maxTeamSplits,
      bur.monster,
      b2b,
      requestIssues(res.games),
      styleViol,
      bur.mid,
      edgeSpread(res.games),
      res.tradeoffs.length,
    ]
    input.debugAttempt?.(k, res.games, key)
    // Edge spread is a RATE (percent of playing days); within ~a-day-in-four
    // is the target, not a defect — treat ≤25 as passing for the early exit.
    // Mid waits are excluded from the exit test the same way: a handful of
    // 3-4 slot gaps is normal texture, and demanding zero would forfeit the
    // early exit on every real-sized world for no selection benefit.
    if (
      key[0] === 0 &&
      key[1] === 0 &&
      key[2] === 0 &&
      key[3] === 0 &&
      key[4] === 0 &&
      key[5] === 0 &&
      key[6] === 0 &&
      key[8] <= 25 &&
      key[9] === 0
    )
      return res
    let better = false
    for (let i = 0; i < KEY_LEN; i++) {
      if (key[i] < bestKey[i]) {
        better = true
        break
      }
      if (key[i] > bestKey[i]) break
    }
    if (better) {
      best = res
      bestKey = key
    }
  }
  return best!
}

function generateScheduleOnce(input: SchedulerInput): SchedulerResult {
  const warnings: string[] = []
  const tradeoffs: string[] = []
  const slots = buildSlots(input)
  const units = buildUnits(input)

  if (slots.length === 0) warnings.push("No usable slots were generated.")
  if (units.length === 0) warnings.push("No scheduling units with ≥ 2 teams.")

  const filter = input.sessionUnitFilter

  // Session-by-session mode: per-team demand for THIS run is the restricted
  // sessions' share of the season, mirroring the capacity report's math.
  const allRegularSessions = input.sessions.filter((s) => s.phase === "REGULAR")
  /**
   * A WEEKEND WITH NO COURT TIME IS NOT A GAME DESTINATION (owner 2026-08-07,
   * the plan-to-scheduler contract). Post-planning, a season legitimately
   * carries sessions its plan never used: no gyms attached, zero slots. They
   * used to read as open-to-any supply, so the distributor poured whole
   * shares onto them and reported hundreds of games that "can't fit". A
   * zero-slot session contributes no demand and takes no games; its share
   * redistributes to the weekends that really run. If EVERY session is
   * slotless the old arithmetic stands, so the cold-season diagnostics read
   * exactly as before.
   */
  const slotCountBySession = new Map<string, number>()
  for (const sl of slots) {
    slotCountBySession.set(sl.sessionId, (slotCountBySession.get(sl.sessionId) ?? 0) + 1)
  }
  const supplied = allRegularSessions.filter((s) => (slotCountBySession.get(s.id) ?? 0) > 0)
  const regularSessions = supplied.length > 0 ? supplied : allRegularSessions

  // Units the filter excludes from EVERY supplied session can never place a
  // game — skip their pairings entirely and say so, instead of emitting one
  // "unscheduled" row per pairing.
  const unitAllowedSomewhere = (unitKey: string): boolean => {
    if (!filter) return true
    return regularSessions.some((sess) => {
      const allowed = filter[sess.id]
      return !allowed || allowed.includes(unitKey)
    })
  }
  for (const sess of allRegularSessions) {
    if ((slotCountBySession.get(sess.id) ?? 0) > 0) continue
    // A slotless session the plan EXPLICITLY assigned grades to is a
    // contradiction worth hearing about; a merely-unused one is skipped
    // silently, because that is what unused means.
    if ((input.sessionUnitFilter?.[sess.id] ?? []).length > 0) {
      warnings.push(
        `${sess.label ?? sess.id} has grades assigned but no court time at any gym - it was skipped. Attach a gym to it or take the grades off it.`
      )
    }
  }
  const restricted = (input.restrictToSessionIds ?? []).filter((sid) =>
    regularSessions.some((s) => s.id === sid)
  )
  const fallbackPerTeam =
    regularSessions.length > 0
      ? Math.ceil(input.gamesGuaranteed / regularSessions.length)
      : input.gamesGuaranteed
  const sessionTeamCap =
    restricted.length > 0
      ? restricted.reduce((sum, sid) => {
          const s = regularSessions.find((x) => x.id === sid)
          return sum + (s?.targetGamesPerTeam ?? fallbackPerTeam)
        }, 0)
      : null
  // EVERY session caps each team at its share (owner 2026-07-31: a
  // whole-season pass used to pour all 10 of a team's games into weekend 1 —
  // soft penalties never stopped the greedy fill; the seed even worked
  // around it with staged passes). 2/weekend means 2/weekend.
  const perSessionCap = new Map<string, number>(
    regularSessions.map((s) => [s.id, s.targetGamesPerTeam ?? fallbackPerTeam])
  )
  const teamSessionCount: Record<string, number> = {}
  const sessionKey = (sessionId: string, teamId: string) => `${sessionId}|${teamId}`

  // Build all pairings across all units — always the FULL season's pool so
  // matchup rotation stays fair, then subtract games already committed in
  // other sessions (session-by-session mode).
  const pairingPool: Pairing[] = []
  for (const u of units) {
    if (!unitAllowedSomewhere(u.key)) {
      warnings.push(`${u.label}: not included in any session — no games scheduled.`)
      continue
    }
    pairingPool.push(...buildPairings(u, input.gamesGuaranteed, input.varietySeed ?? 0))
  }
  const preplayedByPair: Record<string, number> = {}
  for (const g of input.existingGames ?? []) {
    const pk = pairKey(g.homeTeamId, g.awayTeamId)
    preplayedByPair[pk] = (preplayedByPair[pk] ?? 0) + 1
  }
  if (Object.keys(preplayedByPair).length > 0) {
    const consume = { ...preplayedByPair }
    for (let i = pairingPool.length - 1; i >= 0; i--) {
      const pk = pairKey(pairingPool[i].homeTeamId, pairingPool[i].awayTeamId)
      if ((consume[pk] ?? 0) > 0) {
        consume[pk]! -= 1
        pairingPool.splice(i, 1)
      }
    }
  }

  // Structural capacity check (owner 2026-08-01, demo journey): when the
  // season needs MORE GAMES THAN COURT-SLOTS EXIST, no amount of repair or
  // retries can fix it — those ladders used to grind for MINUTES fighting
  // arithmetic. Detect it up front: place greedily, skip every repair pass,
  // and lead the diagnostics with exactly what's missing.
  let structuralShortfall = Math.max(0, pairingPool.length - slots.length)
  if (structuralShortfall > 0) {
    warnings.push(
      `Court capacity is ${structuralShortfall} game${structuralShortfall === 1 ? "" : "s"} short: ${pairingPool.length} games need scheduling but only ${slots.length} court-slots exist. Add a court, extend hours, or add a session — the schedule below fills what fits.`
    )
  } else {
    // Per-SESSION arithmetic (owner 2026-08-01: with each grade on its own
    // weekends, a single overloaded weekend can be impossible while the
    // season total looks fine — say WHICH weekend and by how much).
    const slotsBySess = new Map<string, number>()
    for (const sl of slots) slotsBySess.set(sl.sessionId, (slotsBySess.get(sl.sessionId) ?? 0) + 1)
    const shortSessions: Array<{ label: string; need: number; have: number }> = []
    let sessionShortTotal = 0
    for (const sess of regularSessions) {
      const share = perSessionCap.get(sess.id) ?? fallbackPerTeam
      let demand = 0
      for (const u of units) {
        const allowed = filter?.[sess.id]
        if (allowed && !allowed.includes(u.key)) continue
        demand += Math.ceil((u.teams.length * share) / 2)
      }
      const have = slotsBySess.get(sess.id) ?? 0
      if (demand > have) {
        sessionShortTotal += demand - have
        shortSessions.push({ label: sess.label ?? sess.id, need: demand, have })
      }
    }
    if (sessionShortTotal > 0) {
      structuralShortfall = sessionShortTotal
      const worst = shortSessions.sort((a, b) => b.need - b.have - (a.need - a.have)).slice(0, 2)
      warnings.push(
        `${sessionShortTotal} game${sessionShortTotal === 1 ? "" : "s"} can't fit the weekends they belong to: ${worst
          .map((w) => `${w.label} needs ${w.need} games but has ${w.have} court-slots`)
          .join("; ")}. Extend hours or add a court on those days — the schedule below fills what fits.`
      )
    }
  }

  // ── Phase 1/Phase 2 split (owner 2026-08-01): "courts are just slots".
  // Placement reasons about TIME ONLY — each (day, start time) is a bucket
  // whose capacity is the number of open courts. Specific courts and venues
  // are assigned AFTERWARDS (venue-major fill, same-gym cohesion, court
  // rotation), so no team is welded to a court by placement order.
  const dateKeyOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const bucketKeyOf = (dayId: string, startMs: number): string => `${dayId}|${startMs}`
  const bucketOfSlot = (slot: SchedulerSlot): string =>
    bucketKeyOf(slot.dayId, slot.startAt.getTime())
  const bucketCourts = new Map<string, SchedulerSlot[]>()
  for (const slot of slots) {
    const bk = bucketOfSlot(slot)
    if (!bucketCourts.has(bk)) bucketCourts.set(bk, [])
    bucketCourts.get(bk)!.push(slot)
  }
  // Courts physically taken at a bucket (other leagues' games + this
  // season's surviving games) — they shrink capacity AND are off-limits in
  // the assignment phase.
  const bucketBusyCourts = new Map<string, Set<string>>()
  const markCourtBusy = (courtId: string, start: Date, end: Date) => {
    for (const [bk, list] of bucketCourts) {
      if (!list.some((cs) => cs.courtId === courtId)) continue
      const bStart = list[0].startAt
      const bEnd = list[0].endAt
      if (!(start < bEnd && bStart < end)) continue
      if (!bucketBusyCourts.has(bk)) bucketBusyCourts.set(bk, new Set())
      bucketBusyCourts.get(bk)!.add(courtId)
    }
  }
  // ── Assigned gyms (owner 2026-08-02) ──
  // The season plan says which BUILDING a grade plays in on a given weekend.
  // Placement reasons about time, so the gym shows up twice: as a gate that
  // keeps a grade waiting for its own gym while that gym still has an open
  // slot this weekend, and as the first tier of the court-assignment phase
  // below (which has the final say on venueId).
  const divisionsOfUnit = new Map<string, string[]>()
  for (const u of units) {
    divisionsOfUnit.set(
      u.key,
      u.key.startsWith("division:")
        ? [u.key.slice("division:".length)]
        : [...new Set(u.teams.map((t) => t.divisionId))]
    )
  }
  const assignedVenueCache = new Map<string, string | null>()
  /** The gym this unit plays in that weekend, or null when the plan is silent
   *  (a group whose divisions were sent to different gyms has no one gym). */
  const assignedVenue = (sessionId: string, unitKey: string): string | null => {
    if (!input.venueAssignments) return null
    const ck = `${sessionId}|${unitKey}`
    const cached = assignedVenueCache.get(ck)
    if (cached !== undefined) return cached
    const perSession = input.venueAssignments[sessionId]
    let out: string | null = null
    for (const divisionId of divisionsOfUnit.get(unitKey) ?? []) {
      const v = perSession?.[divisionId]
      if (!v) continue
      if (out === null) out = v
      else if (out !== v) {
        out = null
        break
      }
    }
    assignedVenueCache.set(ck, out)
    return out
  }
  // Court-slots a gym still has free this weekend — the gate's "is my own
  // gym full yet?" test. Kept in step with placement by
  // applyPlacementState/removeGameState, so relocation rollbacks stay honest.
  const venueKeyOf = (sessionId: string, venueId: string): string => `${sessionId}|${venueId}`
  const venueSlotTotal = new Map<string, number>()
  const venueOfCourt = new Map<string, string>()
  for (const slot of slots) {
    const k = venueKeyOf(slot.sessionId, slot.venueId)
    venueSlotTotal.set(k, (venueSlotTotal.get(k) ?? 0) + 1)
    if (!venueOfCourt.has(slot.courtId)) venueOfCourt.set(slot.courtId, slot.venueId)
  }
  const venueTaken = new Map<string, number>()
  const bumpVenueTaken = (sessionId: string, venueId: string, delta: number): void => {
    const k = venueKeyOf(sessionId, venueId)
    venueTaken.set(k, (venueTaken.get(k) ?? 0) + delta)
  }
  const venueRoomLeft = (sessionId: string, venueId: string): number => {
    const k = venueKeyOf(sessionId, venueId)
    return (venueSlotTotal.get(k) ?? 0) - (venueTaken.get(k) ?? 0)
  }

  const bucketUsed = new Map<string, number>()
  const bucketHasRoom = (slot: SchedulerSlot): boolean => {
    const bk = bucketOfSlot(slot)
    const capacity =
      (bucketCourts.get(bk)?.length ?? 0) - (bucketBusyCourts.get(bk)?.size ?? 0)
    return (bucketUsed.get(bk) ?? 0) < capacity
  }

  // Weekend-style state (owner 2026-08-01): each team's resolved preference
  // (team's own choice already applied in load; fixtures derive from the
  // philosophy), plus per-session day usage so "joins the weekend" vs
  // "splits the weekend" is scoreable.
  const philosophyStyle: WeekendStyle =
    input.schedulingPhilosophy === "SPREAD_DAYS" ? "SPLIT_DAYS" : "SAME_DAY"
  // A one-game-per-day cap makes SAME_DAY unexpressible — everyone is
  // effectively split-days in such leagues, whatever their preference.
  const capForcesSplit = input.idealGamesPerDayPerTeam <= 1
  const styleByTeam = new Map<string, WeekendStyle>()
  const blackoutsByTeam = new Map<string, ScheduleBlackout[]>()
  const windowsByTeam = new Map<string, ScheduleWindow[]>()
  for (const u of units)
    for (const t of u.teams) {
      styleByTeam.set(t.teamId, capForcesSplit ? "SPLIT_DAYS" : t.weekendStyle ?? philosophyStyle)
      if (t.blackouts?.length) blackoutsByTeam.set(t.teamId, t.blackouts)
      if (t.windows?.length) windowsByTeam.set(t.teamId, t.windows)
    }
  const styleOf = (teamId: string): WeekendStyle =>
    capForcesSplit ? "SPLIT_DAYS" : styleByTeam.get(teamId) ?? philosophyStyle
  // `${sessionId}|${teamId}` → Map<dateKey, games>
  const teamSessionDays = new Map<string, Map<string, number>>()
  const bumpSessionDay = (sessionId: string, teamId: string, dateKey: string, delta: number) => {
    const k = `${sessionId}|${teamId}`
    if (!teamSessionDays.has(k)) teamSessionDays.set(k, new Map())
    const m = teamSessionDays.get(k)!
    m.set(dateKey, (m.get(dateKey) ?? 0) + delta)
  }

  // First/last tip-off rotation state (owner 2026-08-01: the same team must
  // not take the day's first tip — or its last game — every week). Hard in
  // strict passes: a team above its division's minimum count is blocked
  // from taking another; the ladder may relax with a trade-off note.
  const dayFirstMs = new Map<string, number>()
  const dayLastMs = new Map<string, number>()
  for (const slot of slots) {
    const dk = dateKeyOf(slot.startAt)
    const t = slot.startAt.getTime()
    if (!dayFirstMs.has(dk) || t < dayFirstMs.get(dk)!) dayFirstMs.set(dk, t)
    if (!dayLastMs.has(dk) || t > dayLastMs.get(dk)!) dayLastMs.set(dk, t)
  }
  const firstTipCount: Record<string, number> = {}
  const lastGameCount: Record<string, number> = {}
  const unitOfTeam = new Map<string, string>()
  for (const u of units) for (const t of u.teams) unitOfTeam.set(t.teamId, u.key)
  const unitEdgeMin = (teamId: string, counts: Record<string, number>): number => {
    const uk = unitOfTeam.get(teamId)
    if (!uk) return 0
    let min = Infinity
    for (const u of units) {
      if (u.key !== uk) continue
      for (const t of u.teams) min = Math.min(min, counts[t.teamId] ?? 0)
    }
    return min === Infinity ? 0 : min
  }
  // Rematch shaping state (owner 2026-08-01): a pair NEVER meets twice in
  // one session (2-team divisions excepted — they only have each other),
  // and rematches are pushed as far from the first meeting as possible.
  const unitSizeByKey = new Map(units.map((u) => [u.key, u.teams.length]))
  const pairSessionCount: Record<string, number> = {}
  const pairMeetTimes: Record<string, number[]> = {}
  const pairLastMet = (pk: string): number | undefined => {
    const t = pairMeetTimes[pk]
    return t && t.length > 0 ? Math.max(...t) : undefined
  }

  // ── Weekend day-anchor pre-plan (owner 2026-08-01). The greedy used to
  // pick every FIRST game's day style-blind, sealing a weekend's fate before
  // the second game existed — repair then fought the placement instead of
  // the plan. So plan days up front, from the pairing pool's own round
  // structure (which is exactly what the play-everyone-first law will admit):
  // each weekend takes the next `cap` games per team from the pool, and that
  // weekend's games are 2-colored by day under parity constraints — a
  // one-trip team's two games get the SAME color, a split-days team's two
  // games get OPPOSITE colors. Components are balanced across the weekend's
  // days. Every preference then has a placement that honors it by
  // construction; repair becomes the exception.
  const anchorByTeamSession = new Map<string, string>()
  const plannedDayByPair = new Map<string, string>() // `${sessionId}|${pairKey}` → dateKey
  const plannedSessionsByPair = new Map<string, string[]>() // pairKey → sessionIds
  {
    const sessionDates = new Map<string, string[]>()
    const dayGameCap = new Map<string, number>() // `${sessionId}|${dateKey}` → court-slots
    for (const slot of slots) {
      const dk = dateKeyOf(slot.startAt)
      const list = sessionDates.get(slot.sessionId) ?? []
      if (!list.includes(dk)) sessionDates.set(slot.sessionId, [...list, dk].sort())
      const key = `${slot.sessionId}|${dk}`
      dayGameCap.set(key, (dayGameCap.get(key) ?? 0) + 1)
    }
    const poolByUnit = new Map<string, Pairing[]>()
    for (const pr of pairingPool) {
      if (!poolByUnit.has(pr.unitKey)) poolByUnit.set(pr.unitKey, [])
      poolByUnit.get(pr.unitKey)!.push(pr)
    }
    const cursorByUnit = new Map<string, number>()
    regularSessions.forEach((sess, sessIdx) => {
      const days = sessionDates.get(sess.id)
      if (!days || days.length === 0) return
      const cap = perSessionCap.get(sess.id) ?? 2
      // One-trip is only plannable when the weekend share fits in one day.
      if (cap > input.idealGamesPerDayPerTeam) return
      const seats = new Map<string, number>(
        days.map((dk) => [dk, 2 * (dayGameCap.get(`${sess.id}|${dk}`) ?? 0)])
      )
      units.forEach((u, unitIdx) => {
        const allowed = filter?.[sess.id]
        if (allowed && !allowed.includes(u.key)) return
        const pool = poolByUnit.get(u.key)
        if (!pool || pool.length === 0) return
        // This weekend's matchups: next games in pool order, ≤ cap per team.
        const perSession = Math.floor((u.teams.length * cap) / 2)
        const cur = cursorByUnit.get(u.key) ?? 0
        if (cur >= pool.length) return
        const count: Record<string, number> = {}
        const picked: Pairing[] = []
        let scan = cur
        while (scan < pool.length && picked.length < perSession) {
          const pr = pool[scan]
          const h = count[pr.homeTeamId] ?? 0
          const a = count[pr.awayTeamId] ?? 0
          if (h < cap && a < cap) {
            picked.push(pr)
            count[pr.homeTeamId] = h + 1
            count[pr.awayTeamId] = a + 1
          }
          scan++
        }
        cursorByUnit.set(u.key, cur + picked.length)
        if (picked.length === 0) return
        // Parity 2-coloring: game graph linked through each team's weekend.
        const gamesOfTeam = new Map<string, number[]>()
        picked.forEach((pr, gi) => {
          for (const id of [pr.homeTeamId, pr.awayTeamId]) {
            if (!gamesOfTeam.has(id)) gamesOfTeam.set(id, [])
            gamesOfTeam.get(id)!.push(gi)
          }
        })
        const adj = new Map<number, Array<[number, number]>>()
        for (const [id, gis] of gamesOfTeam) {
          if (gis.length !== 2) continue
          const par = styleOf(id) === "SPLIT_DAYS" ? 1 : 0
          if (!adj.has(gis[0])) adj.set(gis[0], [])
          if (!adj.has(gis[1])) adj.set(gis[1], [])
          adj.get(gis[0])!.push([gis[1], par])
          adj.get(gis[1])!.push([gis[0], par])
        }
        const color: number[] = new Array(picked.length).fill(-1)
        const comps: number[][] = []
        for (let gi = 0; gi < picked.length; gi++) {
          if (color[gi] !== -1) continue
          const comp = [gi]
          color[gi] = 0
          const queue = [gi]
          while (queue.length > 0) {
            const x = queue.shift()!
            for (const [y, par] of adj.get(x) ?? []) {
              if (color[y] === -1) {
                color[y] = color[x] ^ par
                comp.push(y)
                queue.push(y)
              }
              // Odd-parity conflicts are skipped: that team's preference is
              // structurally unsatisfiable this weekend and is counted by
              // the post-hoc trade-off notes.
            }
          }
          comps.push(comp)
        }
        // Single-day sessions: everything on that day; split preferences are
        // unsatisfiable there and stay unplanned.
        if (days.length === 1) {
          for (const pr of picked) {
            for (const id of [pr.homeTeamId, pr.awayTeamId]) {
              if (styleOf(id) === "SAME_DAY")
                anchorByTeamSession.set(`${sess.id}|${id}`, days[0])
            }
          }
          return
        }
        // Balance components across the weekend's two fullest days; rotate
        // which day leads by session+unit so nobody owns Saturday forever.
        const dayPair = [...days]
          .sort(
            (x, y) =>
              (dayGameCap.get(`${sess.id}|${y}`) ?? 0) - (dayGameCap.get(`${sess.id}|${x}`) ?? 0)
          )
          .slice(0, 2)
          .sort()
        const lead = dayPair[(sessIdx + unitIdx) % 2]
        const other = dayPair[0] === lead ? dayPair[1] : dayPair[0]
        comps.sort((a, b) => b.length - a.length)
        // A team's whole-day blackout forbids its color's day: count the
        // violations of each of the two possible assignments and take the
        // cleaner one (seat balance breaks ties).
        const blackoutHits = (comp: number[], dayForColor0: string, dayForColor1: string): number => {
          let hits = 0
          for (const gi of comp) {
            const pr = picked[gi]
            const dk = color[gi] === 0 ? dayForColor0 : dayForColor1
            for (const id of [pr.homeTeamId, pr.awayTeamId]) {
              for (const b of blackoutsByTeam.get(id) ?? []) {
                if (b.dateKey === dk && b.startMin === undefined) hits++
              }
            }
          }
          return hits
        }
        // Window pressure: anchoring a team on a day where its approved
        // window restricts start times makes its weekend HARD to place —
        // prefer the unconstrained day (a "Saturdays after 2pm" team is
        // cheapest to schedule on Sundays).
        const weekdayOfKey = (dk: string): number => {
          const [y, m, d] = dk.split("-").map(Number)
          return new Date(y, m, d).getDay()
        }
        const windowPressure = (comp: number[], dayForColor0: string, dayForColor1: string): number => {
          let hits = 0
          for (const gi of comp) {
            const pr = picked[gi]
            const dk = color[gi] === 0 ? dayForColor0 : dayForColor1
            const dow = weekdayOfKey(dk)
            for (const id of [pr.homeTeamId, pr.awayTeamId]) {
              for (const w of windowsByTeam.get(id) ?? []) {
                if (
                  (w.dateKey !== undefined && w.dateKey === dk) ||
                  (w.dayOfWeek !== undefined && w.dayOfWeek === dow)
                )
                  hits++
              }
            }
          }
          return hits
        }
        for (const comp of comps) {
          const seats0 = comp.filter((gi) => color[gi] === 0).length * 2
          const seats1 = comp.length * 2 - seats0
          const leadLeft = seats.get(lead) ?? 0
          const otherLeft = seats.get(other) ?? 0
          let day0 = leadLeft - seats0 >= 0 || leadLeft >= otherLeft ? lead : other
          if (blackoutsByTeam.size > 0 || windowsByTeam.size > 0) {
            const alt = day0 === lead ? other : lead
            const asIs = [blackoutHits(comp, day0, alt), windowPressure(comp, day0, alt)]
            const flipped = [blackoutHits(comp, alt, day0), windowPressure(comp, alt, day0)]
            if (
              flipped[0] < asIs[0] ||
              (flipped[0] === asIs[0] && flipped[1] < asIs[1])
            )
              day0 = alt
          }
          const day1 = day0 === lead ? other : lead
          seats.set(day0, (seats.get(day0) ?? 0) - seats0)
          seats.set(day1, (seats.get(day1) ?? 0) - seats1)
          for (const gi of comp) {
            const pr = picked[gi]
            const dk = color[gi] === 0 ? day0 : day1
            const pk = pairKey(pr.homeTeamId, pr.awayTeamId)
            if (!plannedDayByPair.has(`${sess.id}|${pk}`))
              plannedDayByPair.set(`${sess.id}|${pk}`, dk)
            if (!plannedSessionsByPair.has(pk)) plannedSessionsByPair.set(pk, [])
            plannedSessionsByPair.get(pk)!.push(sess.id)
            for (const id of [pr.homeTeamId, pr.awayTeamId]) {
              if (styleOf(id) === "SAME_DAY") anchorByTeamSession.set(`${sess.id}|${id}`, dk)
            }
          }
        }
      })
    })
    // Session-by-session mode: games already committed in THIS session win
    // over the plan — anchor to where the team actually plays.
    for (const g of input.existingGames ?? []) {
      if (!g.sessionId || !g.scheduledAt) continue
      const dk = dateKeyOf(new Date(g.scheduledAt))
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        if (styleOf(id) !== "SAME_DAY") continue
        if (anchorByTeamSession.has(`${g.sessionId}|${id}`))
          anchorByTeamSession.set(`${g.sessionId}|${id}`, dk)
      }
    }
  }

  // Scheduling state
  const teamGameCount: Record<string, number> = {}
  const teamBookings: Record<string, Array<{ start: Date; end: Date; dateKey: string }>> = {}
  // Other leagues' games at shared venues occupy their courts outright.
  for (const b of input.busyCourtBookings ?? []) {
    markCourtBusy(b.courtId, new Date(b.start), new Date(b.end))
  }
  // Surviving games of THIS season (played, live, or PINNED via lock) occupy
  // their teams, courts, day caps and session shares — regeneration
  // schedules around them, never on top of them.
  for (const g of input.existingGames ?? []) {
    if (g.scheduledAt) {
      const start = new Date(g.scheduledAt)
      const end = new Date(start.getTime() + input.gameSlotMinutes * 60000)
      const book = { start, end, dateKey: dateKeyOf(start) }
      teamBookings[g.homeTeamId] = [...(teamBookings[g.homeTeamId] ?? []), book]
      teamBookings[g.awayTeamId] = [...(teamBookings[g.awayTeamId] ?? []), book]
      if (g.courtId) {
        markCourtBusy(g.courtId, start, end)
      }
    }
    if (g.sessionId) {
      // A surviving game holds a court in ITS gym — the assigned-gym gate
      // must see that room as gone.
      const heldVenue = g.courtId ? venueOfCourt.get(g.courtId) : undefined
      if (heldVenue) bumpVenueTaken(g.sessionId, heldVenue, 1)
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const sk = sessionKey(g.sessionId, id)
        teamSessionCount[sk] = (teamSessionCount[sk] ?? 0) + 1
        if (g.scheduledAt) bumpSessionDay(g.sessionId, id, dateKeyOf(new Date(g.scheduledAt)), 1)
      }
      const spk = `${g.sessionId}|${pairKey(g.homeTeamId, g.awayTeamId)}`
      pairSessionCount[spk] = (pairSessionCount[spk] ?? 0) + 1
    }
    if (g.scheduledAt) {
      const pk = pairKey(g.homeTeamId, g.awayTeamId)
      ;(pairMeetTimes[pk] ??= []).push(new Date(g.scheduledAt).getTime())
    }
  }
  {
    const blocked = slots.filter((slot) =>
      (input.busyCourtBookings ?? []).some(
        (b) =>
          b.courtId === slot.courtId &&
          overlaps(new Date(b.start), new Date(b.end), slot.startAt, slot.endAt)
      )
    ).length
    if (blocked > 0) {
      tradeoffs.push(
        `${blocked} slot${blocked === 1 ? " was" : "s were"} already booked by other leagues at shared venues — your games were scheduled around them.`
      )
    }
  }
  // Seed matchup history so opponent-diversity scoring sees prior sessions.
  const playedPairCount: Record<string, number> = { ...preplayedByPair }

  // Time-of-day rotation state (owner 2026-07-31: "not everybody gets a
  // 9 a.m. game all the time"). Each slot gets a ratio 0..1 for WHERE its
  // tip-off sits in its day (0 = first start time, 1 = last); each team
  // accumulates the ratios of its games — historical (existingGames with
  // scheduledAt, ranked within their own day) and placed this run. Scoring
  // then steers early slots toward teams that have been playing late and
  // vice versa. Deterministic — a rotation, not a shuffle.
  const slotRatioByDay = new Map<string, Map<number, number>>()
  for (const slot of slots) {
    if (!slotRatioByDay.has(slot.dayId)) slotRatioByDay.set(slot.dayId, new Map())
  }
  for (const [dayId, m] of slotRatioByDay) {
    const times = [...new Set(slots.filter((s) => s.dayId === dayId).map((s) => s.startAt.getTime()))].sort(
      (a, b) => a - b
    )
    times.forEach((t, i) => m.set(t, times.length > 1 ? i / (times.length - 1) : 0.5))
  }
  const slotTimeRatio = (slot: SchedulerSlot): number =>
    slotRatioByDay.get(slot.dayId)?.get(slot.startAt.getTime()) ?? 0.5
  const timeLoadSum: Record<string, number> = {}
  const timeLoadCount: Record<string, number> = {}
  {
    const byDate = new Map<string, Array<{ homeTeamId: string; awayTeamId: string; ms: number }>>()
    for (const g of input.existingGames ?? []) {
      if (!g.scheduledAt) continue
      const d = new Date(g.scheduledAt)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push({ homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, ms: d.getTime() })
    }
    for (const dayGames of byDate.values()) {
      const times = [...new Set(dayGames.map((g) => g.ms))].sort((a, b) => a - b)
      for (const g of dayGames) {
        const idx = times.indexOf(g.ms)
        const ratio = times.length > 1 ? idx / (times.length - 1) : 0.5
        for (const id of [g.homeTeamId, g.awayTeamId]) {
          timeLoadSum[id] = (timeLoadSum[id] ?? 0) + ratio
          timeLoadCount[id] = (timeLoadCount[id] ?? 0) + 1
        }
      }
    }
  }
  // Seed first/last-tip history from surviving games (per their own days).
  {
    const byDay = new Map<string, Array<{ ms: number; home: string; away: string }>>()
    for (const g of input.existingGames ?? []) {
      if (!g.scheduledAt) continue
      const d = new Date(g.scheduledAt)
      const dk = dateKeyOf(d)
      if (!byDay.has(dk)) byDay.set(dk, [])
      byDay.get(dk)!.push({ ms: d.getTime(), home: g.homeTeamId, away: g.awayTeamId })
    }
    for (const list of byDay.values()) {
      const first = Math.min(...list.map((x) => x.ms))
      const last = Math.max(...list.map((x) => x.ms))
      for (const x of list) {
        if (x.ms === first)
          for (const id of [x.home, x.away]) firstTipCount[id] = (firstTipCount[id] ?? 0) + 1
        if (x.ms === last)
          for (const id of [x.home, x.away]) lastGameCount[id] = (lastGameCount[id] ?? 0) + 1
      }
    }
  }

  // Unit time-clustering (phase 1, court-free): a division keeps rolling in
  // consecutive time buckets instead of interleaving with other divisions.
  const unitLastEnd = new Map<string, number>() // `${dayId}|${unitKey}` → endMs

  const teamTimeAvg = (teamId: string): number =>
    (timeLoadCount[teamId] ?? 0) > 0 ? timeLoadSum[teamId] / timeLoadCount[teamId] : 0.5

  const games: ProposedGame[] = []
  // Remaining pairings: Map from pair key → array (ordered) of Pairing objects
  const remaining: Pairing[] = [...pairingPool]

  // Hard fairness tier (owner rule: play EVERY team before you play anyone
  // again): per unit, the minimum meeting count among still-unplaced
  // pairings. A candidate whose pair has met MORE times than that minimum is
  // blocked — first meetings always beat rematches, engine-level.
  const unitMinMeetings = new Map<string, number>()
  const recomputeUnitMin = (unitKey: string) => {
    let min = Infinity
    for (const p of remaining) {
      if (p.unitKey !== unitKey) continue
      const met = playedPairCount[pairKey(p.homeTeamId, p.awayTeamId)] ?? 0
      if (met < min) min = met
    }
    unitMinMeetings.set(unitKey, min)
  }
  for (const key of new Set(remaining.map((p) => p.unitKey))) recomputeUnitMin(key)

  const teamIsBooked = (teamId: string, start: Date, end: Date): boolean => {
    const list = teamBookings[teamId] ?? []
    return list.some((b) => overlaps(b.start, b.end, start, end))
  }
  const teamGamesOnDay = (teamId: string, day: Date): number => {
    const key = dateKeyOf(day)
    return (teamBookings[teamId] ?? []).filter((b) => b.dateKey === key).length
  }

  // Clustering state: keep similar games together (soft). Tracks which unit
  // played last on each court (by end time) and how many games each unit has
  // at each day-venue.

  const scoreCandidate = (
    pairing: Pairing,
    slot: SchedulerSlot,
    relaxDayCap = false,
    lastResort = false,
    // The repair pass orders candidates fewest-meetings-first itself, so the
    // cycle gate below would only re-create dead ends there (2026-08-01:
    // 87/13). The MAIN passes keep it hard — including the relaxed one
    // (lifting it there let cycle-2 rematches starve a team's unmet
    // first meetings).
    inRepair = false
  ): { score: number; blockReason?: string } => {
    const { homeTeamId, awayTeamId } = pairing
    if (homeTeamId === awayTeamId) return { score: -Infinity, blockReason: "same team" }

    // Hard: session include-filter — the owner decided which units this
    // session hosts (capacity planning); everything else waits its turn.
    if (filter) {
      const allowed = filter[slot.sessionId]
      if (allowed && !allowed.includes(pairing.unitKey)) {
        return { score: -Infinity, blockReason: "unit not included in this session" }
      }
    }

    // Hard: no double-booked team, no double-booked court
    if (teamIsBooked(homeTeamId, slot.startAt, slot.endAt))
      return { score: -Infinity, blockReason: "home team busy" }
    if (teamIsBooked(awayTeamId, slot.startAt, slot.endAt))
      return { score: -Infinity, blockReason: "away team busy" }
    if (!bucketHasRoom(slot))
      return { score: -Infinity, blockReason: "court busy" }

    // Hard (placement passes): the weekend plan gave this grade a BUILDING.
    // While that gym still has an open court-slot this weekend, the game
    // waits for it instead of opening the next building (owner 2026-08-02).
    // The repair ladder skips the gate — a game placed in the wrong gym
    // beats a game not placed — and the court-assignment phase still hands
    // the game back its own gym whenever a court there is free.
    const wantVenue = assignedVenue(slot.sessionId, pairing.unitKey)
    if (
      wantVenue !== null &&
      wantVenue !== slot.venueId &&
      !inRepair &&
      venueRoomLeft(slot.sessionId, wantVenue) > 0
    ) {
      return { score: -Infinity, blockReason: "off the grade's gym for the weekend" }
    }

    // Hard (session-by-session): a team never exceeds this run's session
    // share — the rest of its season schedules with later sessions.
    if (sessionTeamCap !== null) {
      if ((teamGameCount[homeTeamId] ?? 0) >= sessionTeamCap)
        return { score: -Infinity, blockReason: "home team at session target" }
      if ((teamGameCount[awayTeamId] ?? 0) >= sessionTeamCap)
        return { score: -Infinity, blockReason: "away team at session target" }
    }

    // Hard (always, except the repair pass's last resort — one extra game
    // in a weekend beats a team ending the season short): per-session
    // share — spread across the season instead of packing the earliest
    // weekend.
    const capHere = perSessionCap.get(slot.sessionId)
    if (capHere !== undefined && !lastResort) {
      if ((teamSessionCount[sessionKey(slot.sessionId, homeTeamId)] ?? 0) >= capHere)
        return { score: -Infinity, blockReason: "home team at this session's share" }
      if ((teamSessionCount[sessionKey(slot.sessionId, awayTeamId)] ?? 0) >= capHere)
        return { score: -Infinity, blockReason: "away team at this session's share" }
    }

    // Per-day limit. Hard in the first pass (a weekend session with the
    // ideal at 1 = one game Saturday, one Sunday — slots are day-major, so
    // a soft penalty can never stop day 1 from absorbing everything); the
    // relaxed pass lifts it rather than leave games unplaced when a
    // session genuinely can't spread (single-day finals weekend).
    const homeDayCount = teamGamesOnDay(homeTeamId, slot.startAt)
    const awayDayCount = teamGamesOnDay(awayTeamId, slot.startAt)
    if (!relaxDayCap) {
      if (homeDayCount >= input.idealGamesPerDayPerTeam)
        return { score: -Infinity, blockReason: "home team at daily limit" }
      if (awayDayCount >= input.idealGamesPerDayPerTeam)
        return { score: -Infinity, blockReason: "away team at daily limit" }
    }

    let score = 0

    // Soft: the assigned gym, for the paths that choose a SLOT for a game
    // (repair, movers) rather than a game for a slot — they never see the
    // gate above, so the steer has to live in the score.
    if (wantVenue !== null) score += wantVenue === slot.venueId ? 4 : -4

    // Soft: prefer teams still under their gamesGuaranteed
    const homeCount = teamGameCount[homeTeamId] ?? 0
    const awayCount = teamGameCount[awayTeamId] ?? 0
    if (homeCount < input.gamesGuaranteed) score += 10
    if (awayCount < input.gamesGuaranteed) score += 10
    if (homeCount >= input.gamesGuaranteed) score -= 20
    if (awayCount >= input.gamesGuaranteed) score -= 20

    // Soft (relaxed pass only reaches this over-limit): still discourage
    if (homeDayCount >= input.idealGamesPerDayPerTeam) score -= 5
    if (awayDayCount >= input.idealGamesPerDayPerTeam) score -= 5

    // Soft: opponent diversity
    const pKey = pairKey(homeTeamId, awayTeamId)
    const timesPlayed = playedPairCount[pKey] ?? 0
    score -= timesPlayed * 3

    if (timesPlayed > 0) {
      // HARD, every pass (owner 2026-08-01): the same matchup never happens
      // twice within one session. Only a 2-team division is exempt — those
      // teams have nobody else to play.
      if (
        !lastResort &&
        (unitSizeByKey.get(pairing.unitKey) ?? 99) > 2 &&
        (pairSessionCount[`${slot.sessionId}|${pKey}`] ?? 0) > 0
      ) {
        return { score: -Infinity, blockReason: "rematch within the same session" }
      }
      // Soft, strong: spread the two meetings apart — a rematch the very
      // next weekend reads odd. Full penalty fades out over ~5 weeks.
      const lastMet = pairLastMet(pKey)
      if (lastMet !== undefined) {
        const daysApart = Math.abs(slot.startAt.getTime() - lastMet) / 86400000
        score -= Math.max(0, 35 - daysApart) * 0.4
      }
    }

    // Hard (both main passes): never a rematch while a first meeting (or
    // lower-cycle meeting) in the same unit is still waiting to be placed.
    const unitMin = unitMinMeetings.get(pairing.unitKey)
    if (
      !inRepair &&
      unitMin !== undefined &&
      unitMin !== Infinity &&
      timesPlayed > unitMin
    ) {
      return { score: -Infinity, blockReason: "rematch before all first meetings" }
    }

    // Soft: time-of-day rotation — an early slot prefers teams whose games
    // have skewed late (and vice versa), so 9 a.m. rotates through the
    // league instead of hitting the same families every weekend.
    const slotRatio = slotTimeRatio(slot)
    score +=
      3 *
      (teamTimeAvg(homeTeamId) - 0.5 + (teamTimeAvg(awayTeamId) - 0.5)) *
      (0.5 - slotRatio) *
      2


    // Weekend-style scoring (owner 2026-08-01, per-TEAM preference):
    //   SAME_DAY team: second game same day with the GAP CURVE — 2-slot
    //     break ideal (+6), then 1 (+4), then 3 (+3), 4 (+2), wider (+1);
    //     back-to-back −8 (last resort); splitting the weekend −4.
    //   SPLIT_DAYS team: completing the Sat/Sun split +4; a same-day
    //     double −4 (and −10 total when back-to-back).
    const dayKeyHere = dateKeyOf(slot.startAt)
    // Mixed-preference matchups (one team wants one trip, the other wants
    // split days) can make BOTH days a hard violation for someone — the
    // owner's ruling is that the sum of satisfaction decides, so the hard
    // style blocks apply only when the two teams agree.
    const mixedPair = styleOf(homeTeamId) !== styleOf(awayTeamId)
    // Pre-plan steers: this matchup was planned into a specific weekend and
    // day — soft, so repair keeps its freedom, but strong enough that the
    // greedy follows the plan when the plan is followable.
    {
      const pk = pairKey(homeTeamId, awayTeamId)
      const plannedSessions = plannedSessionsByPair.get(pk)
      if (plannedSessions && plannedSessions.length > 0) {
        score += plannedSessions.includes(slot.sessionId) ? 3 : -3
      }
      const plannedDk = plannedDayByPair.get(`${slot.sessionId}|${pk}`)
      if (plannedDk !== undefined) score += plannedDk === dayKeyHere ? 3 : -3
    }
    for (const teamId of [homeTeamId, awayTeamId]) {
      const style = styleOf(teamId)
      // Day-anchor law: a one-trip team plays only on its planned day while
      // the strict pass runs; movers/repair get a soft steer back to it.
      const anchor = anchorByTeamSession.get(`${slot.sessionId}|${teamId}`)
      if (anchor !== undefined && style === "SAME_DAY" && dayKeyHere !== anchor) {
        // Hard for every strict-day-cap caller — including repair movers,
        // whose first-fit slot scans never see soft penalties (receipts
        // showed placement ending at ZERO violations and repair chains
        // creating dozens). Relaxed callers still pay dearly.
        if (!relaxDayCap) {
          return { score: -Infinity, blockReason: "off the team's planned day" }
        }
        score -= 30
      }
      const sameDayBookings = (teamBookings[teamId] ?? []).filter(
        (b) => b.dateKey === dayKeyHere
      )
      const sessionDayMap = teamSessionDays.get(`${slot.sessionId}|${teamId}`)
      let otherDaysInSession = 0
      if (sessionDayMap) {
        for (const [dk, n] of sessionDayMap) if (dk !== dayKeyHere) otherDaysInSession += n
      }
      if (sameDayBookings.length > 0) {
        let minGapSlots = Infinity
        for (const b of sameDayBookings) {
          const gapMs = Math.max(
            b.start.getTime() - slot.endAt.getTime(),
            slot.startAt.getTime() - b.end.getTime()
          )
          minGapSlots = Math.min(minGapSlots, gapMs / (input.gameSlotMinutes * 60000))
        }
        const b2b = minGapSlots <= 0
        // Back-to-backs are avoided AT ALL COSTS (owner 2026-08-01): hard in
        // BOTH placement passes; only the repair ladder may cross, and the
        // dedicated elimination pass afterwards hunts down whatever it made.
        if (b2b && !inRepair) {
          return { score: -Infinity, blockReason: "back-to-back" }
        }
        if (style === "SAME_DAY") {
          if (b2b) score -= 8
          else if (minGapSlots <= 1.01) score += 4
          else if (minGapSlots <= 2.01) score += 6
          else if (minGapSlots <= 3.01) score += 3
          else if (minGapSlots <= 4.01) score += 2
          else score += 1
        } else {
          // A SPLIT_DAYS team doubling a day violates its preference —
          // hard while the strict pass runs, a penalty afterwards. (The
          // day-anchor pre-plan gives every mixed matchup a consistent day,
          // so no mixed-pair exemption is needed here anymore.)
          if (!relaxDayCap && !inRepair) {
            return { score: -Infinity, blockReason: "would double a split-days team's day" }
          }
          score -= b2b ? 10 : 4
        }
      } else if (otherDaysInSession > 0) {
        if (style === "SPLIT_DAYS") {
          score += 4
        } else {
          // A SAME_DAY team's second weekend game on a DIFFERENT day
          // splits the family's one trip — hard in the strict pass.
          if (!relaxDayCap && !inRepair && !mixedPair) {
            return { score: -Infinity, blockReason: "would split a one-trip team's weekend" }
          }
          score -= 4
        }
      }
    }

    // Approved schedule requests (owner 2026-08-01). Blackout = the team is
    // NOT THERE: hard in every pass except the relaxed repair ladder, which
    // may cross it only as the alternative to an unplaced game (counted
    // loudly in the trade-off notes). Window = best effort: strong soft.
    if (blackoutsByTeam.size > 0 || windowsByTeam.size > 0) {
      const slotStartMin = slot.startAt.getHours() * 60 + slot.startAt.getMinutes()
      const slotEndMin = slotStartMin + input.gameSlotMinutes
      for (const teamId of [homeTeamId, awayTeamId]) {
        for (const b of blackoutsByTeam.get(teamId) ?? []) {
          if (b.dateKey !== dayKeyHere) continue
          const from = b.startMin ?? 0
          const to = b.endMin ?? 24 * 60
          if (slotStartMin < to && from < slotEndMin) {
            if (!(relaxDayCap && inRepair)) {
              return { score: -Infinity, blockReason: "team blackout" }
            }
            score -= 40
          }
        }
        for (const w of windowsByTeam.get(teamId) ?? []) {
          const applies =
            (w.dateKey !== undefined && w.dateKey === dayKeyHere) ||
            (w.dayOfWeek !== undefined && slot.startAt.getDay() === w.dayOfWeek)
          if (!applies) continue
          const okEarliest = w.earliestMin === undefined || slotStartMin >= w.earliestMin
          const okLatest = w.latestMin === undefined || slotStartMin <= w.latestMin
          if (okEarliest && okLatest) {
            score += 2
          } else {
            // Hard in BOTH placement passes — a soft penalty can't stop a
            // placement when the pairing is a slot's only candidate (late
            // windows lost to the early-wave fill, then leaked through the
            // relaxed pass). Only the repair ladder may concede, counted in
            // the trade-off notes.
            if (!inRepair) {
              return { score: -Infinity, blockReason: "outside an approved window" }
            }
            score -= 12
          }
        }
      }
    }

    // Compact-day scenario (owner 2026-08-01: a recommendation, never a
    // league setting): pull games toward the day's earliest waves.
    if (input.compactDays) {
      const ratio = slotRatioByDay.get(slot.dayId)?.get(slot.startAt.getTime()) ?? 0.5
      score += (1 - ratio) * 4
    }

    // First/last-tip rotation (owner 2026-08-01): softly steered here; the
    // dedicated edge-rebalance pass afterwards enforces max−min ≤ 1 by
    // swapping game times within days (a hard placement block just pushed
    // games into the law-free relaxed passes on sparse days).
    const slotMs = slot.startAt.getTime()
    const isDayFirst = dayFirstMs.get(dayKeyHere) === slotMs
    const isDayLast = dayLastMs.get(dayKeyHere) === slotMs
    // Soft: unit time-clustering — continue the division's block.
    if (unitLastEnd.get(`${slot.dayId}|${pairing.unitKey}`) === slot.startAt.getTime()) {
      score += 4
    }

    // Soft steer everywhere: prefer teams with fewer edge slots so far.
    if (isDayFirst) {
      score -= 1.5 * ((firstTipCount[homeTeamId] ?? 0) + (firstTipCount[awayTeamId] ?? 0))
    }
    if (isDayLast) {
      score -= 1.5 * ((lastGameCount[homeTeamId] ?? 0) + (lastGameCount[awayTeamId] ?? 0))
    }

    return { score }
  }

  const placeInto = (slot: SchedulerSlot, relaxDayCap: boolean): boolean => {
    let bestIdx = -1
    let bestScore = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const cand = scoreCandidate(remaining[i], slot, relaxDayCap)
      if (cand.score > bestScore) {
        bestScore = cand.score
        bestIdx = i
      }
    }
    if (bestIdx === -1 || bestScore === -Infinity) return false

    const pairing = remaining.splice(bestIdx, 1)[0]
    commitPlacement(slot, pairing)
    return true
  }

  interface PlacementSite {
    sessionId: string
    dayId: string
    dayVenueId: string
    courtId: string
    venueId: string
    startAt: Date
    endAt: Date
  }
  const siteOfGame = (g: ProposedGame): PlacementSite => {
    const startAt = new Date(g.scheduledAt)
    return {
      sessionId: g.sessionId,
      dayId: g.dayId,
      dayVenueId: g.dayVenueId,
      courtId: g.courtId,
      venueId: g.venueId,
      startAt,
      endAt: new Date(startAt.getTime() + input.gameSlotMinutes * 60000),
    }
  }

  const applyPlacementState = (site: PlacementSite, pairing: Pairing): void => {
    teamGameCount[pairing.homeTeamId] = (teamGameCount[pairing.homeTeamId] ?? 0) + 1
    teamGameCount[pairing.awayTeamId] = (teamGameCount[pairing.awayTeamId] ?? 0) + 1
    const book = { start: site.startAt, end: site.endAt, dateKey: dateKeyOf(site.startAt) }
    teamBookings[pairing.homeTeamId] = [...(teamBookings[pairing.homeTeamId] ?? []), book]
    teamBookings[pairing.awayTeamId] = [...(teamBookings[pairing.awayTeamId] ?? []), book]
    const bk = bucketKeyOf(site.dayId, site.startAt.getTime())
    bucketUsed.set(bk, (bucketUsed.get(bk) ?? 0) + 1)
    bumpVenueTaken(site.sessionId, site.venueId, 1)
    const pk = pairKey(pairing.homeTeamId, pairing.awayTeamId)
    playedPairCount[pk] = (playedPairCount[pk] ?? 0) + 1
    const spk = `${site.sessionId}|${pk}`
    pairSessionCount[spk] = (pairSessionCount[spk] ?? 0) + 1
    ;(pairMeetTimes[pk] ??= []).push(site.startAt.getTime())
    const ratio = slotRatioByDay.get(site.dayId)?.get(site.startAt.getTime()) ?? 0.5
    const siteDk = dateKeyOf(site.startAt)
    const siteMs = site.startAt.getTime()
    for (const id of [pairing.homeTeamId, pairing.awayTeamId]) {
      const sk = sessionKey(site.sessionId, id)
      teamSessionCount[sk] = (teamSessionCount[sk] ?? 0) + 1
      timeLoadSum[id] = (timeLoadSum[id] ?? 0) + ratio
      timeLoadCount[id] = (timeLoadCount[id] ?? 0) + 1
      bumpSessionDay(site.sessionId, id, siteDk, 1)
      if (dayFirstMs.get(siteDk) === siteMs) firstTipCount[id] = (firstTipCount[id] ?? 0) + 1
      if (dayLastMs.get(siteDk) === siteMs) lastGameCount[id] = (lastGameCount[id] ?? 0) + 1
    }
    const ukey = `${site.dayId}|${pairing.unitKey}`
    if ((unitLastEnd.get(ukey) ?? 0) < site.endAt.getTime()) {
      unitLastEnd.set(ukey, site.endAt.getTime())
    }
    recomputeUnitMin(pairing.unitKey)
  }

  /** Exact inverse of applyPlacementState for a game placed THIS run. */
  const removeGameState = (gi: number): void => {
    const g = games[gi]
    const site = siteOfGame(g)
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      teamGameCount[id] = (teamGameCount[id] ?? 1) - 1
      const list = teamBookings[id] ?? []
      const bi = list.findIndex((b) => b.start.getTime() === site.startAt.getTime())
      if (bi >= 0) list.splice(bi, 1)
      const sk = sessionKey(g.sessionId, id)
      teamSessionCount[sk] = (teamSessionCount[sk] ?? 1) - 1
      const ratio = slotRatioByDay.get(g.dayId)?.get(site.startAt.getTime()) ?? 0.5
      timeLoadSum[id] = (timeLoadSum[id] ?? ratio) - ratio
      timeLoadCount[id] = (timeLoadCount[id] ?? 1) - 1
      bumpSessionDay(g.sessionId, id, dateKeyOf(site.startAt), -1)
      if (dayFirstMs.get(dateKeyOf(site.startAt)) === site.startAt.getTime())
        firstTipCount[id] = (firstTipCount[id] ?? 1) - 1
      if (dayLastMs.get(dateKeyOf(site.startAt)) === site.startAt.getTime())
        lastGameCount[id] = (lastGameCount[id] ?? 1) - 1
    }
    const bk = bucketKeyOf(g.dayId, site.startAt.getTime())
    bucketUsed.set(bk, (bucketUsed.get(bk) ?? 1) - 1)
    bumpVenueTaken(g.sessionId, g.venueId, -1)
    const pk = pairKey(g.homeTeamId, g.awayTeamId)
    playedPairCount[pk] = (playedPairCount[pk] ?? 1) - 1
    const spk = `${g.sessionId}|${pk}`
    pairSessionCount[spk] = (pairSessionCount[spk] ?? 1) - 1
    const times = pairMeetTimes[pk] ?? []
    const ti = times.indexOf(site.startAt.getTime())
    if (ti >= 0) times.splice(ti, 1)
    recomputeUnitMin(g.unitKey)
  }

  const setGamePlacement = (gi: number, slot: SchedulerSlot): void => {
    const g = games[gi]
    games[gi] = {
      ...g,
      sessionId: slot.sessionId,
      dayId: slot.dayId,
      dayVenueId: slot.dayVenueId,
      courtId: slot.courtId,
      venueId: slot.venueId,
      scheduledAt: slot.startAt.toISOString(),
    }
    applyPlacementState(
      { ...slot },
      { unitKey: g.unitKey, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId }
    )
  }

  const commitPlacement = (slot: SchedulerSlot, pairing: Pairing): void => {
    games.push({
      sessionId: slot.sessionId,
      dayId: slot.dayId,
      dayVenueId: slot.dayVenueId,
      courtId: slot.courtId,
      venueId: slot.venueId,
      homeTeamId: pairing.homeTeamId,
      awayTeamId: pairing.awayTeamId,
      scheduledAt: slot.startAt.toISOString(),
      duration: input.gameLengthMinutes,
      unitKey: pairing.unitKey,
    })
    applyPlacementState(slot, pairing)
  }

  const debugOffAnchor = (label: string): void => {
    if (!process.env.SCHED_DEBUG) return
    let off = 0
    for (const g of games) {
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const a = anchorByTeamSession.get(`${g.sessionId}|${id}`)
        if (!a || styleOf(id) !== "SAME_DAY") continue
        if (dateKeyOf(new Date(g.scheduledAt)) !== a) off++
      }
    }
    console.error(`[anchors] ${label}: games=${games.length} OFF-anchor=${off}`)
  }

  const openSlots: SchedulerSlot[] = []
  for (const slot of slots) {
    if (!placeInto(slot, false)) openSlots.push(slot)
  }
  debugOffAnchor("after strict pass")
  // Relaxed pass: the per-day ideal is honored when the session has room to
  // spread; when it doesn't, filling the game beats leaving it unplaced.
  for (const slot of openSlots) {
    if (remaining.length === 0) break
    placeInto(slot, true)
  }

  // Repair pass (owner 2026-07-31): the pool is consumed pair by pair, so
  // the endgame can strand two under-target teams with no unused pairing
  // between them — every weekend then comes up a game short and the deficit
  // compounds across the season. A human scheduler just books the extra
  // rematch; so do we: synthesize a pairing between under-served teams
  // (fewest prior meetings first, all hard constraints still enforced),
  // strict day-cap first, relaxed only if that strands the game.
  const repairTarget = sessionTeamCap ?? input.gamesGuaranteed
  // Session mode's target is per-RUN; whole-season's is per-SEASON, so
  // surviving games (played/live, passed as existingGames) count toward it.
  const existingTeamGames: Record<string, number> = {}
  for (const g of input.existingGames ?? []) {
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      existingTeamGames[id] = (existingTeamGames[id] ?? 0) + 1
    }
  }
  const repairCount = (teamId: string): number =>
    (teamGameCount[teamId] ?? 0) + (sessionTeamCap === null ? existingTeamGames[teamId] ?? 0 : 0)
  // Three escalating rounds: strict → relaxed day cap → LAST RESORT (a
  // rematch may share a session with the first meeting). The last round
  // exists because a zero-slack season (games = sessions × session share)
  // can make the same-session law unsatisfiable for the final games — a
  // team missing its paid-for game is worse, and the warning says so.
  let sameSessionRematches = 0
  let overShareGames = 0
  let bonusGames = 0
  type RepairMode = "strict" | "relaxDay" | "lastResort" | "overGuarantee"
  const runRepairMode = (mode: RepairMode) => {
    let moved = true
    while (moved) {
      moved = false
      for (const slot of slots) {
        if (!bucketHasRoom(slot)) continue
        let best: Pairing | null = null
        let bestScore = -Infinity
        // Final mode (real-league escape valve): a FULL team may take ONE
        // bonus game (guarantee + 1) so an under-served team never ends the
        // season short — but only pairs with at least one team genuinely
        // under target qualify.
        const partnerCap = repairTarget + (mode === "overGuarantee" ? 1 : 0)
        for (const u of units) {
          for (let i = 0; i < u.teams.length; i++) {
            if (repairCount(u.teams[i].teamId) >= partnerCap) continue
            for (let j = i + 1; j < u.teams.length; j++) {
              if (repairCount(u.teams[j].teamId) >= partnerCap) continue
              if (
                repairCount(u.teams[i].teamId) >= repairTarget &&
                repairCount(u.teams[j].teamId) >= repairTarget
              )
                continue
              const pairing: Pairing = {
                unitKey: u.key,
                homeTeamId: u.teams[i].teamId,
                awayTeamId: u.teams[j].teamId,
              }
              const cand = scoreCandidate(
                pairing,
                slot,
                mode !== "strict",
                mode === "lastResort" || mode === "overGuarantee",
                true
              )
              if (cand.score === -Infinity) continue
              // Fewest prior meetings dominates the slot preferences here.
              const score =
                cand.score - (playedPairCount[pairKey(pairing.homeTeamId, pairing.awayTeamId)] ?? 0) * 100
              if (score > bestScore) {
                bestScore = score
                best = pairing
              }
            }
          }
        }
        if (best) {
          if (mode === "overGuarantee") {
            for (const id of [best.homeTeamId, best.awayTeamId]) {
              if (repairCount(id) >= repairTarget) bonusGames++
            }
          }
          if (mode === "lastResort" || mode === "overGuarantee") {
            if ((pairSessionCount[`${slot.sessionId}|${pairKey(best.homeTeamId, best.awayTeamId)}`] ?? 0) > 0) {
              sameSessionRematches++
            }
            const capHere = perSessionCap.get(slot.sessionId)
            if (
              capHere !== undefined &&
              [best.homeTeamId, best.awayTeamId].some(
                (id) => (teamSessionCount[sessionKey(slot.sessionId, id)] ?? 0) >= capHere
              )
            ) {
              overShareGames++
            }
          }
          commitPlacement(slot, best)
          moved = true
        }
      }
    }
  }

  // Depth-1 relocation (owner 2026-08-01: "96 slots per session and you
  // tell me there's no room — investigate"): the greedy can fill weekend
  // shares ASYMMETRICALLY — one session ends a game short while the pair
  // that needs it has a full share there, with acres of empty court time.
  // Before conceding an extra weekend game or a shared-weekend rematch,
  // MOVE one of this run's games out of the crowded weekend and place the
  // missing game in the room that opens up.
  let relocationBudget = 500_000 // scoreCandidate calls, safety valve
  const RELOC_DBG =
    typeof process !== "undefined" && process.env?.SCHED_DEBUG === "1"
  const RELOC_MAX_DEPTH = 4

  // Relocation reasons about SESSIONS (weekend-share room), not slots — a
  // session has ~100 slots but only one share ledger, so the chain search
  // runs on a 5-node graph and slots only matter when materializing a move.
  const slotsBySession = new Map<string, SchedulerSlot[]>()
  for (const slot of slots) {
    if (!slotsBySession.has(slot.sessionId)) slotsBySession.set(slot.sessionId, [])
    slotsBySession.get(slot.sessionId)!.push(slot)
  }
  const hasShareRoom = (teamId: string, sessionId: string): boolean =>
    (teamSessionCount[sessionKey(sessionId, teamId)] ?? 0) <
    (perSessionCap.get(sessionId) ?? Infinity)
  const pairMetIn = (a: string, b: string, sessionId: string): boolean =>
    (pairSessionCount[`${sessionId}|${pairKey(a, b)}`] ?? 0) > 0

  interface MoveLogEntry {
    gi: number
    prev: ProposedGame
    placed: boolean
  }
  const rollbackTo = (log: MoveLogEntry[], mark: number): void => {
    while (log.length > mark) {
      const e = log.pop()!
      if (e.placed) removeGameState(e.gi)
      games[e.gi] = e.prev
      applyPlacementState(siteOfGame(e.prev), {
        unitKey: e.prev.unitKey,
        homeTeamId: e.prev.homeTeamId,
        awayTeamId: e.prev.awayTeamId,
      })
    }
  }

  /**
   * The relaxed movers take the FIRST legal slot, so scoring penalties can't
   * steer them — these predicates define their tiers. Priority ruling
   * (owner 2026-08-01): back-to-backs at all costs > approved requests >
   * weekend styles, so the tiers are [core+window, core-only, anything] —
   * a mover breaks a window BEFORE it ever creates a back-to-back.
   */
  const coreSafe = (pairing: Pairing, slot: SchedulerSlot): boolean => {
    const dk = dateKeyOf(slot.startAt)
    const slotStartMin = slot.startAt.getHours() * 60 + slot.startAt.getMinutes()
    for (const id of [pairing.homeTeamId, pairing.awayTeamId]) {
      const a = anchorByTeamSession.get(`${slot.sessionId}|${id}`)
      if (a !== undefined && styleOf(id) === "SAME_DAY" && dk !== a) return false
      for (const b of blackoutsByTeam.get(id) ?? []) {
        if (b.dateKey !== dk) continue
        const from = b.startMin ?? 0
        const to = b.endMin ?? 24 * 60
        if (slotStartMin < to && from < slotStartMin + input.gameSlotMinutes) return false
      }
      for (const b of teamBookings[id] ?? []) {
        if (b.dateKey !== dk) continue
        // A split-days team already plays this day — a second game here
        // would double it; and NOBODY takes a back-to-back in this tier.
        if (styleOf(id) === "SPLIT_DAYS") return false
        const gapMs = Math.max(
          b.start.getTime() - slot.endAt.getTime(),
          slot.startAt.getTime() - b.end.getTime()
        )
        if (gapMs <= 0) return false
      }
    }
    return true
  }
  const windowSafe = (pairing: Pairing, slot: SchedulerSlot): boolean => {
    const dk = dateKeyOf(slot.startAt)
    const slotStartMin = slot.startAt.getHours() * 60 + slot.startAt.getMinutes()
    for (const id of [pairing.homeTeamId, pairing.awayTeamId]) {
      for (const w of windowsByTeam.get(id) ?? []) {
        const applies =
          (w.dateKey !== undefined && w.dateKey === dk) ||
          (w.dayOfWeek !== undefined && slot.startAt.getDay() === w.dayOfWeek)
        if (!applies) continue
        if (w.earliestMin !== undefined && slotStartMin < w.earliestMin) return false
        if (w.latestMin !== undefined && slotStartMin > w.latestMin) return false
      }
    }
    return true
  }
  const anchorSafe = (pairing: Pairing, slot: SchedulerSlot): boolean =>
    coreSafe(pairing, slot) && windowSafe(pairing, slot)

  /**
   * Find the BEST legal free slot in the session and commit the pairing
   * there. Repair's endgame goes through here — first-fit used to take the
   * first legal slot and eat avoidable back-to-backs and off-plan days.
   */
  const placeInSession = (pairing: Pairing, sessionId: string): boolean => {
    let bestSlot: SchedulerSlot | null = null
    let bestScore = -Infinity
    for (const slot of slotsBySession.get(sessionId) ?? []) {
      if (relocationBudget <= 0) break
      if (!bucketHasRoom(slot)) continue
      relocationBudget--
      const c = scoreCandidate(pairing, slot, true, false, true)
      if (c.score === -Infinity) continue
      const bonus =
        (coreSafe(pairing, slot) ? 2000 : 0) + (windowSafe(pairing, slot) ? 1000 : 0)
      if (c.score + bonus > bestScore) {
        bestScore = c.score + bonus
        bestSlot = slot
      }
    }
    if (!bestSlot) return false
    commitPlacement(bestSlot, pairing)
    return true
  }

  /** Tx-logged: move games[gi] to any legal free slot of `toSession`. */
  const moveGameToSession = (gi: number, toSession: string, log: MoveLogEntry[]): boolean => {
    const entry: MoveLogEntry = { gi, prev: { ...games[gi] }, placed: false }
    log.push(entry)
    const gPairing: Pairing = {
      unitKey: entry.prev.unitKey,
      homeTeamId: entry.prev.homeTeamId,
      awayTeamId: entry.prev.awayTeamId,
    }
    removeGameState(gi)
    for (const tier of [0, 1, 2]) {
      for (const slot of slotsBySession.get(toSession) ?? []) {
        if (relocationBudget <= 0) break
        if (!bucketHasRoom(slot)) continue
        if (tier === 0 && !anchorSafe(gPairing, slot)) continue
        if (tier === 1 && !coreSafe(gPairing, slot)) continue
        relocationBudget--
        const c = scoreCandidate(gPairing, slot, true, false, true)
        if (c.score !== -Infinity) {
          setGamePlacement(gi, slot)
          entry.placed = true
          return true
        }
      }
    }
    rollbackTo(log, log.length - 1)
    return false
  }

  /**
   * Move games[gi] to ANOTHER session. The game is lifted OUT first — its
   * departure is often precisely what frees room for the rest of the chain
   * (B leaving November is what gives X a home there). When a destination's
   * share is blocked, recursively evict the blocking game. Transactional:
   * false ⇒ own log entries rolled back.
   */
  const tryMoveGameChain = (
    gi: number,
    depth: number,
    log: MoveLogEntry[],
    inChain: Set<number>
  ): boolean => {
    if (relocationBudget <= 0) return false
    const save = log.length
    const entry: MoveLogEntry = { gi, prev: { ...games[gi] }, placed: false }
    log.push(entry)
    const gPairing: Pairing = {
      unitKey: entry.prev.unitKey,
      homeTeamId: entry.prev.homeTeamId,
      awayTeamId: entry.prev.awayTeamId,
    }
    inChain.add(gi)
    removeGameState(gi)
    const materialize = (dest: string): boolean => {
      for (const tier of [0, 1, 2]) {
        for (const slot of slotsBySession.get(dest) ?? []) {
          if (relocationBudget <= 0) return false
          if (!bucketHasRoom(slot)) continue
          if (tier === 0 && !anchorSafe(gPairing, slot)) continue
          if (tier === 1 && !coreSafe(gPairing, slot)) continue
          relocationBudget--
          const c = scoreCandidate(gPairing, slot, true, false, true)
          if (c.score !== -Infinity) {
            setGamePlacement(gi, slot)
            entry.placed = true
            return true
          }
        }
      }
      return false
    }
    for (const dest of slotsBySession.keys()) {
      if (dest === entry.prev.sessionId) continue
      if (pairMetIn(gPairing.homeTeamId, gPairing.awayTeamId, dest)) continue
      const blockers = [gPairing.homeTeamId, gPairing.awayTeamId].filter(
        (t) => !hasShareRoom(t, dest)
      )
      if (blockers.length === 0) {
        if (materialize(dest)) {
          inChain.delete(gi)
          return true
        }
        continue
      }
      if (depth >= RELOC_MAX_DEPTH) continue
      // Evict blocking games one by one (usually a single blocker).
      const branchSave = log.length
      let cleared = true
      for (const bt of blockers) {
        let evicted = false
        for (let gj = 0; gj < games.length; gj++) {
          if (gj === gi || inChain.has(gj)) continue
          const other = games[gj]
          if (other.sessionId !== dest) continue
          if (other.homeTeamId !== bt && other.awayTeamId !== bt) continue
          if (tryMoveGameChain(gj, depth + 1, log, inChain)) {
            evicted = true
            break
          }
        }
        if (!evicted) {
          cleared = false
          break
        }
      }
      if (cleared && materialize(dest)) {
        inChain.delete(gi)
        return true
      }
      rollbackTo(log, branchSave)
    }
    rollbackTo(log, save)
    inChain.delete(gi)
    return false
  }

  /**
   * Place `pairing` somewhere legal, moving up to RELOC_MAX_DEPTH games
   * between sessions to open share room (augmenting chain). Transactional:
   * false ⇒ the log was rolled back to how it was.
   */
  const tryChain = (
    pairing: Pairing,
    depth: number,
    log: MoveLogEntry[],
    movedGis: Set<number>
  ): boolean => {
    if (relocationBudget <= 0) return false
    for (const sessionId of slotsBySession.keys()) {
      if (pairMetIn(pairing.homeTeamId, pairing.awayTeamId, sessionId)) continue
      if (!hasShareRoom(pairing.homeTeamId, sessionId)) continue
      if (!hasShareRoom(pairing.awayTeamId, sessionId)) continue
      if (placeInSession(pairing, sessionId)) return true
    }
    if (depth >= RELOC_MAX_DEPTH) return false
    for (const sessionId of slotsBySession.keys()) {
      if (pairMetIn(pairing.homeTeamId, pairing.awayTeamId, sessionId)) continue
      for (const teamId of [pairing.homeTeamId, pairing.awayTeamId]) {
        if (hasShareRoom(teamId, sessionId)) continue
        for (let gi = 0; gi < games.length; gi++) {
          if (movedGis.has(gi)) continue
          const g = games[gi]
          if (g.sessionId !== sessionId) continue
          if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) continue
          const save = log.length
          if (!tryMoveGameChain(gi, depth, log, new Set(movedGis))) continue
          movedGis.add(gi)
          if (tryChain(pairing, depth + 1, log, movedGis)) return true
          rollbackTo(log, save)
          movedGis.delete(gi)
        }
      }
    }
    return false
  }

  const tryPlaceWithRelocation = (pairing: Pairing): boolean => {
    const log: MoveLogEntry[] = []
    if (tryChain(pairing, 0, log, new Set())) return true
    rollbackTo(log, 0)
    if (RELOC_DBG)
      console.error(
        `[reloc] FAILED ${pairing.homeTeamId.slice(0, 8)} vs ${pairing.awayTeamId.slice(0, 8)} (budget left ${relocationBudget})`
      )
    return false
  }

  const runRelocationPhase = () => {
    let moved = true
    while (moved && relocationBudget > 0) {
      moved = false
      const deficits: Pairing[] = []
      for (const u of units) {
        for (let i = 0; i < u.teams.length; i++) {
          if (repairCount(u.teams[i].teamId) >= repairTarget) continue
          for (let j = i + 1; j < u.teams.length; j++) {
            if (repairCount(u.teams[j].teamId) >= repairTarget) continue
            deficits.push({
              unitKey: u.key,
              homeTeamId: u.teams[i].teamId,
              awayTeamId: u.teams[j].teamId,
            })
          }
        }
      }
      deficits.sort(
        (a, b) =>
          (playedPairCount[pairKey(a.homeTeamId, a.awayTeamId)] ?? 0) -
          (playedPairCount[pairKey(b.homeTeamId, b.awayTeamId)] ?? 0)
      )
      if (RELOC_DBG && deficits.length > 0)
        console.error(`[reloc] phase: ${deficits.length} deficit pair(s)`)
      for (const pairing of deficits) {
        if (
          repairCount(pairing.homeTeamId) >= repairTarget ||
          repairCount(pairing.awayTeamId) >= repairTarget
        )
          continue
        if (tryPlaceWithRelocation(pairing)) moved = true
      }
    }
  }

  debugOffAnchor("after relaxed pass")
  if (structuralShortfall === 0) {
  runRepairMode("strict")
  debugOffAnchor("after repair:strict")
  runRepairMode("relaxDay")
  debugOffAnchor("after repair:relaxDay")
  if (RELOC_DBG) {
    const perS = new Map<string, number>()
    for (const g of games) perS.set(g.sessionId, (perS.get(g.sessionId) ?? 0) + 1)
    console.error(`[reloc] BEFORE phase: ${games.length} games, per-session ${[...perS.values()].join(",")}`)
  }
  runRelocationPhase()
  if (RELOC_DBG) {
    const perS = new Map<string, number>()
    const audit: Record<string, number> = {}
    for (const g of games) {
      perS.set(g.sessionId, (perS.get(g.sessionId) ?? 0) + 1)
      for (const id of [g.homeTeamId, g.awayTeamId])
        audit[`${g.sessionId}|${id}`] = (audit[`${g.sessionId}|${id}`] ?? 0) + 1
    }
    let mism = 0
    for (const [k, v] of Object.entries(audit)) if ((teamSessionCount[k] ?? 0) !== v) mism++
    for (const [k, v] of Object.entries(teamSessionCount)) if (v > 0 && !(k in audit)) mism++
    console.error(
      `[reloc] AFTER phase: ${games.length} games, per-session ${[...perS.values()].join(",")}, state-audit mismatches: ${mism}, budget left ${relocationBudget}`
    )
  }
  runRepairMode("lastResort")
  debugOffAnchor("after repair:lastResort")
  runRepairMode("overGuarantee")
  debugOffAnchor("after repair:overGuarantee")

  // ── De-double pass (owner 2026-08-01: "better to have a game spread
  // over two days than back-to-backs") ──
  // The relaxed passes sometimes give a team both weekend games on one
  // day. Almost always the OTHER day of the same weekend has room — so
  // after everything is placed, every doubled team-day tries to move one
  // of its games to a different day (strict day-cap at the destination, so
  // a fix can never create a new double). Transactional; a stuck double
  // simply stays and shows up in the fairness report.
  const tryMoveGameOffDay = (gi: number): boolean => {
    const log: MoveLogEntry[] = []
    const entry: MoveLogEntry = { gi, prev: { ...games[gi] }, placed: false }
    log.push(entry)
    const gPairing: Pairing = {
      unitKey: entry.prev.unitKey,
      homeTeamId: entry.prev.homeTeamId,
      awayTeamId: entry.prev.awayTeamId,
    }
    const fromDay = dateKeyOf(new Date(entry.prev.scheduledAt))
    removeGameState(gi)
    for (const slot of slots) {
      if (dateKeyOf(slot.startAt) === fromDay) continue
      const c = scoreCandidate(gPairing, slot, false, false, true)
      if (c.score !== -Infinity) {
        setGamePlacement(gi, slot)
        entry.placed = true
        return true
      }
    }
    rollbackTo(log, 0)
    return false
  }
  /** De-double chain (owner: two days beat back-to-backs): move games[gi]
   *  to another DAY; when the target day is blocked by a participant's
   *  existing game there, recursively evict that game first. Everyone else
   *  usually plays both weekend days, so the fix is a short CYCLE of
   *  moves — the freed slots cascade until the chain closes. Strict
   *  one-game-per-day law at every landing; transactional per branch. */
  // Depth generously deep: the fix for a Saturday double is an ALTERNATING
  // Sat/Sun chain that terminates at the complementary double (parity
  // guarantees one exists) — up to ~division-size hops, but branching is
  // ~1 per hop since everyone plays once per day.
  const DEDOUBLE_MAX_DEPTH = 14
  let dedoubleBudget = 200_000
  const allDayKeys = [...new Set(slots.map((sl) => dateKeyOf(sl.startAt)))]
  const tryMoveGameDayChain = (
    gi: number,
    depth: number,
    log: MoveLogEntry[],
    inChain: Set<number>
  ): boolean => {
    if (dedoubleBudget <= 0) return false
    const save = log.length
    const entry: MoveLogEntry = { gi, prev: { ...games[gi] }, placed: false }
    log.push(entry)
    const gPairing: Pairing = {
      unitKey: entry.prev.unitKey,
      homeTeamId: entry.prev.homeTeamId,
      awayTeamId: entry.prev.awayTeamId,
    }
    const fromDay = dateKeyOf(new Date(entry.prev.scheduledAt))
    inChain.add(gi)
    removeGameState(gi)
    const materialize = (day: string): boolean => {
      for (const sl of slots) {
        if (dedoubleBudget-- <= 0) return false
        if (dateKeyOf(sl.startAt) !== day) continue
        const c = scoreCandidate(gPairing, sl, false, false, true)
        if (c.score !== -Infinity) {
          setGamePlacement(gi, sl)
          entry.placed = true
          return true
        }
      }
      return false
    }
    for (const day of allDayKeys) {
      if (day === fromDay) continue
      const blockers = [gPairing.homeTeamId, gPairing.awayTeamId].filter((t) =>
        (teamBookings[t] ?? []).some((b) => b.dateKey === day)
      )
      if (blockers.length === 0) {
        if (materialize(day)) {
          inChain.delete(gi)
          return true
        }
        continue
      }
      if (depth >= DEDOUBLE_MAX_DEPTH) continue
      const branchSave = log.length
      let cleared = true
      for (const bt of blockers) {
        let evicted = false
        for (let gj = 0; gj < games.length; gj++) {
          if (gj === gi || inChain.has(gj)) continue
          const other = games[gj]
          if (dateKeyOf(new Date(other.scheduledAt)) !== day) continue
          if (other.homeTeamId !== bt && other.awayTeamId !== bt) continue
          if (tryMoveGameDayChain(gj, depth + 1, log, inChain)) {
            evicted = true
            break
          }
        }
        if (!evicted) {
          cleared = false
          break
        }
      }
      if (cleared && materialize(day)) {
        inChain.delete(gi)
        return true
      }
      rollbackTo(log, branchSave)
    }
    rollbackTo(log, save)
    inChain.delete(gi)
    return false
  }
  const trySwapDays = (gi: number): boolean => {
    const log: MoveLogEntry[] = []
    if (tryMoveGameDayChain(gi, 0, log, new Set())) return true
    rollbackTo(log, 0)
    return false
  }
  /** Direct move of games[gi] to a SPECIFIC day (strict laws; style scoring
   *  steers timing on arrival). */
  const tryMoveGameToDay = (gi: number, targetDk: string): boolean => {
    const log: MoveLogEntry[] = []
    const entry: MoveLogEntry = { gi, prev: { ...games[gi] }, placed: false }
    log.push(entry)
    const gPairing: Pairing = {
      unitKey: entry.prev.unitKey,
      homeTeamId: entry.prev.homeTeamId,
      awayTeamId: entry.prev.awayTeamId,
    }
    removeGameState(gi)
    let best: SchedulerSlot | null = null
    let bestScore = -Infinity
    for (const sl of slots) {
      if (dateKeyOf(sl.startAt) !== targetDk) continue
      const c = scoreCandidate(gPairing, sl, false, false, true)
      if (c.score > bestScore) {
        bestScore = c.score
        best = sl
      }
    }
    if (best && bestScore !== -Infinity) {
      setGamePlacement(gi, best)
      entry.placed = true
      return true
    }
    rollbackTo(log, 0)
    return false
  }
  /** Re-time games[gi] within its own day to a better-scoring slot (fixes
   *  back-to-backs and bad gaps without changing the day). */
  const tryRetimeWithinDay = (gi: number): boolean => {
    const prev = { ...games[gi] }
    const dk = dateKeyOf(new Date(prev.scheduledAt))
    const gPairing: Pairing = {
      unitKey: prev.unitKey,
      homeTeamId: prev.homeTeamId,
      awayTeamId: prev.awayTeamId,
    }
    removeGameState(gi)
    const currentSlotScore = (() => {
      let sc = -Infinity
      for (const sl of slots) {
        if (sl.startAt.getTime() !== new Date(prev.scheduledAt).getTime()) continue
        if (dateKeyOf(sl.startAt) !== dk) continue
        const c = scoreCandidate(gPairing, sl, false, false, true)
        sc = Math.max(sc, c.score)
        break
      }
      return sc
    })()
    let best: SchedulerSlot | null = null
    let bestScore = currentSlotScore
    for (const sl of slots) {
      if (dateKeyOf(sl.startAt) !== dk) continue
      if (sl.startAt.getTime() === new Date(prev.scheduledAt).getTime()) continue
      const c = scoreCandidate(gPairing, sl, false, false, true)
      if (c.score > bestScore) {
        bestScore = c.score
        best = sl
      }
    }
    if (best) {
      setGamePlacement(gi, best)
      return true
    }
    games[gi] = prev
    applyPlacementState(siteOfGame(prev), gPairing)
    return false
  }

  // ── Shape pass (owner 2026-08-01, per-team preference): every team's
  // weekend should match ITS style — SAME_DAY teams get both games on one
  // day with a comfortable break; SPLIT_DAYS teams get one game per day;
  // nobody plays back-to-back if any alternative exists. Violations are
  // repaired with the transactional movers; leftovers become trade-offs.
  {
    const shapeIssues = (): Array<{ kind: "join" | "separate" | "retime"; gi: number; targetDk?: string }> => {
      const issues: Array<{ kind: "join" | "separate" | "retime"; gi: number; targetDk?: string }> = []
      const bySessionTeam = new Map<string, number[]>()
      for (let gi = 0; gi < games.length; gi++) {
        const g = games[gi]
        for (const id of [g.homeTeamId, g.awayTeamId]) {
          const k = `${g.sessionId}|${id}`
          if (!bySessionTeam.has(k)) bySessionTeam.set(k, [])
          bySessionTeam.get(k)!.push(gi)
        }
      }
      for (const [k, gis] of [...bySessionTeam.entries()].sort()) {
        if (gis.length < 2) continue
        const teamId = k.split("|")[1]
        const style = styleOf(teamId)
        const sorted = [...gis].sort(
          (a, b) => new Date(games[a].scheduledAt).getTime() - new Date(games[b].scheduledAt).getTime()
        )
        const dks = sorted.map((gi) => dateKeyOf(new Date(games[gi].scheduledAt)))
        const sameDay = new Set(dks).size === 1
        if (sameDay) {
          // back-to-back check within the day
          for (let i = 1; i < sorted.length; i++) {
            const gap =
              (new Date(games[sorted[i]].scheduledAt).getTime() -
                new Date(games[sorted[i - 1]].scheduledAt).getTime()) /
                (input.gameSlotMinutes * 60000) -
              1
            if (gap <= 0) issues.push({ kind: "retime", gi: sorted[i] })
          }
          if (style === "SPLIT_DAYS") issues.push({ kind: "separate", gi: sorted[sorted.length - 1] })
        } else if (style === "SAME_DAY") {
          // join: move the later game onto the earlier game's day (or vice versa)
          issues.push({ kind: "join", gi: sorted[sorted.length - 1], targetDk: dks[0] })
          issues.push({ kind: "join", gi: sorted[0], targetDk: dks[dks.length - 1] })
        }
      }
      return issues
    }
    let guard = games.length * 4
    let improved = true
    const kindRank = { separate: 0, join: 1, retime: 2 } as const
    while (improved && guard-- > 0) {
      improved = false
      // Style fixes first (separate/join), THEN back-to-back retimes — the
      // retime churn must never starve a team's actual preference.
      const issues = shapeIssues().sort((a, b) => kindRank[a.kind] - kindRank[b.kind])
      const touched = new Set<number>()
      for (const issue of issues) {
        if (touched.has(issue.gi)) continue
        let ok = false
        if (issue.kind === "retime") ok = tryRetimeWithinDay(issue.gi)
        else if (issue.kind === "join" && issue.targetDk)
          ok = tryMoveGameToDay(issue.gi, issue.targetDk)
        else if (issue.kind === "separate")
          ok = tryMoveGameOffDay(issue.gi) || trySwapDays(issue.gi)
        if (ok) {
          improved = true
          touched.add(issue.gi)
        }
      }
    }
  }

  // ── Edge-rebalance pass (owner 2026-08-01: "the same team should not get
  // the first tip every week"): compute each day's ACTUAL first and last
  // games; while any team is more than one above its division's minimum,
  // swap that edge game's time with a mid-day game whose teams are at the
  // minimum. Swaps are same-day site exchanges — shares, day counts and
  // matchups are untouched by construction; only team time-overlap is
  // re-checked.
  {
    const siteFromGame = (g: ProposedGame) => siteOfGame(g)
    const swapSites = (gi: number, hj: number): boolean => {
      const a = { ...games[gi] }
      const b = { ...games[hj] }
      const aP: Pairing = { unitKey: a.unitKey, homeTeamId: a.homeTeamId, awayTeamId: a.awayTeamId }
      const bP: Pairing = { unitKey: b.unitKey, homeTeamId: b.homeTeamId, awayTeamId: b.awayTeamId }
      removeGameState(gi)
      removeGameState(hj)
      const aOk = (() => {
        for (const sl of slots) {
          if (sl.startAt.getTime() !== new Date(b.scheduledAt).getTime()) continue
          if (sl.dayId !== b.dayId) continue
          return scoreCandidate(aP, sl, true, true, true).score !== -Infinity
        }
        return false
      })()
      const bOk = (() => {
        for (const sl of slots) {
          if (sl.startAt.getTime() !== new Date(a.scheduledAt).getTime()) continue
          if (sl.dayId !== a.dayId) continue
          return scoreCandidate(bP, sl, true, true, true).score !== -Infinity
        }
        return false
      })()
      if (aOk && bOk) {
        games[gi] = { ...a, scheduledAt: b.scheduledAt, dayId: b.dayId, dayVenueId: b.dayVenueId, courtId: b.courtId, venueId: b.venueId, sessionId: b.sessionId }
        games[hj] = { ...b, scheduledAt: a.scheduledAt, dayId: a.dayId, dayVenueId: a.dayVenueId, courtId: a.courtId, venueId: a.venueId, sessionId: a.sessionId }
        applyPlacementState(siteFromGame(games[gi]), aP)
        applyPlacementState(siteFromGame(games[hj]), bP)
        return true
      }
      games[gi] = a
      games[hj] = b
      applyPlacementState(siteFromGame(a), aP)
      applyPlacementState(siteFromGame(b), bP)
      return false
    }


    let guard = games.length * 6
    let improved = true
    while (improved && guard-- > 0) {
      improved = false
      // Actual edge games per UNIT-day (owner's complaint is "the same team
      // opens OUR division every week" — at 8 courts most teams sit in the
      // day's global first wave, so only the division block's opening and
      // closing games are scarce enough to rotate).
      const byDay = new Map<string, number[]>()
      for (let gi = 0; gi < games.length; gi++) {
        const dk = `${dateKeyOf(new Date(games[gi].scheduledAt))}|${games[gi].unitKey}`
        if (!byDay.has(dk)) byDay.set(dk, [])
        byDay.get(dk)!.push(gi)
      }
      const firsts: Record<string, number> = {}
      const lasts: Record<string, number> = {}
      const playDays: Record<string, number> = {}
      {
        const seen = new Set<string>()
        for (const [dk, gis] of byDay) {
          for (const gi of gis) {
            for (const id of [games[gi].homeTeamId, games[gi].awayTeamId]) {
              const k = `${id}|${dk}`
              if (!seen.has(k)) {
                seen.add(k)
                playDays[id] = (playDays[id] ?? 0) + 1
              }
            }
          }
        }
      }
      const dayEdgeMs = new Map<string, [number, number]>() // dk → [firstMs, lastMs]
      const edgeGames: Array<{ gi: number; kind: "first" | "last"; dk: string }> = []
      for (const [dk, gis] of byDay) {
        let fMs = Infinity
        let lMs = 0
        for (const gi of gis) {
          const t = new Date(games[gi].scheduledAt).getTime()
          fMs = Math.min(fMs, t)
          lMs = Math.max(lMs, t)
        }
        dayEdgeMs.set(dk, [fMs, lMs])
        for (const gi of gis) {
          const t = new Date(games[gi].scheduledAt).getTime()
          if (t === fMs) {
            edgeGames.push({ gi, kind: "first", dk })
            for (const id of [games[gi].homeTeamId, games[gi].awayTeamId])
              firsts[id] = (firsts[id] ?? 0) + 1
          }
          if (t === lMs && lMs !== fMs) {
            edgeGames.push({ gi, kind: "last", dk })
            for (const id of [games[gi].homeTeamId, games[gi].awayTeamId])
              lasts[id] = (lasts[id] ?? 0) + 1
          }
        }
      }
      const unitMinOf = (teamId: string, counts: Record<string, number>): number => {
        const uk = unitOfTeam.get(teamId)
        let min = Infinity
        for (const u of units) {
          if (u.key !== uk) continue
          for (const t of u.teams) min = Math.min(min, counts[t.teamId] ?? 0)
        }
        return min === Infinity ? 0 : min
      }
      // Joint metric over BOTH edge kinds: [worst unit spread, teams stuck
      // at an over-served max, total excess]. A swap that keeps the spread
      // but shrinks the over-served set still moves toward within-1 — the
      // old strict-spread-only rule plateaued the moment two teams shared
      // the max.
      // Rates, not raw counts: a split-days team plays ~2× the days of a
      // one-trip team, so raw within-1 across a mixed division is
      // structurally impossible — early-day SHARE is the fair comparison.
      const rateOf = (counts: Record<string, number>, teamId: string): number =>
        Math.round((100 * (counts[teamId] ?? 0)) / Math.max(1, playDays[teamId] ?? 1))
      const RATE_TOL = 25 // one day in four — within "one day" at 4-5 playing days
      const metric = (
        f: Record<string, number>,
        l: Record<string, number>
      ): [number, number, number] => {
        let spread = 0
        let atMax = 0
        let excess = 0
        for (const counts of [f, l]) {
          for (const u of units) {
            let min = Infinity
            let max = 0
            for (const t of u.teams) {
              const c = rateOf(counts, t.teamId)
              min = Math.min(min, c)
              max = Math.max(max, c)
            }
            if (min === Infinity) continue
            spread = Math.max(spread, max - min)
            if (max - min > RATE_TOL) {
              for (const t of u.teams) {
                const c = rateOf(counts, t.teamId)
                if (c === max) {
                  atMax++
                  excess += c - min - RATE_TOL
                }
              }
            }
          }
        }
        return [spread, atMax, excess]
      }
      const lexLess = (a: [number, number, number], b: [number, number, number]): boolean => {
        for (let i = 0; i < 3; i++) {
          if (a[i] < b[i]) return true
          if (a[i] > b[i]) return false
        }
        return false
      }
      // Both games exchange times; recompute both edge-count maps for the
      // four teams involved.
      const simSwap = (
        dk: string,
        g: ProposedGame,
        h: ProposedGame
      ): [Record<string, number>, Record<string, number>] => {
        const [fMs, lMs] = dayEdgeMs.get(dk)!
        const f = { ...firsts }
        const l = { ...lasts }
        const applyMove = (game: ProposedGame, oldT: number, newT: number): void => {
          for (const id of [game.homeTeamId, game.awayTeamId]) {
            if (oldT === fMs) f[id] = (f[id] ?? 1) - 1
            if (oldT === lMs && lMs !== fMs) l[id] = (l[id] ?? 1) - 1
            if (newT === fMs) f[id] = (f[id] ?? 0) + 1
            if (newT === lMs && lMs !== fMs) l[id] = (l[id] ?? 0) + 1
          }
        }
        const gT = new Date(g.scheduledAt).getTime()
        const hT = new Date(h.scheduledAt).getTime()
        applyMove(g, gT, hT)
        applyMove(h, hT, gT)
        return [f, l]
      }
      // Best-improvement search: examine EVERY candidate swap and take the
      // one with the smallest resulting metric (first-improvement greed
      // walked into worse local optima).
      const before = metric(firsts, lasts)
      let bestSwap: { gi: number; hj: number; m: [number, number, number] } | null = null
      for (const e of [...edgeGames].sort((x, y) => x.gi - y.gi)) {
        const counts = e.kind === "first" ? firsts : lasts
        const g = games[e.gi]
        const over = [g.homeTeamId, g.awayTeamId].some((id) => {
          const uk = unitOfTeam.get(id)
          let minRate = Infinity
          for (const u of units) {
            if (u.key !== uk) continue
            for (const t of u.teams) minRate = Math.min(minRate, rateOf(counts, t.teamId))
          }
          return rateOf(counts, id) > (minRate === Infinity ? 0 : minRate) + RATE_TOL
        })
        if (!over) continue
        const dayGis = byDay.get(e.dk)!
        for (const hj of dayGis) {
          if (hj === e.gi) continue
          const h = games[hj]
          const sameSlot =
            new Date(h.scheduledAt).getTime() === new Date(g.scheduledAt).getTime()
          if (sameSlot) continue // swapping identical times changes nothing
          // NEVER trade a back-to-back for tip-off fairness (owner ruling):
          // reject any exchange that would leave either game adjacent to a
          // teammate's other game.
          const wouldAdjoin = (game: ProposedGame, newMs: number): boolean => {
            for (const id of [game.homeTeamId, game.awayTeamId]) {
              for (const other of games) {
                if (other === game) continue
                if (other.homeTeamId !== id && other.awayTeamId !== id) continue
                const oMs = new Date(other.scheduledAt).getTime()
                if (dateKeyOf(new Date(oMs)) !== dateKeyOf(new Date(newMs))) continue
                if (
                  other === (game === g ? h : g) // the swap partner moves too
                ) {
                  continue
                }
                if (Math.abs(oMs - newMs) <= input.gameSlotMinutes * 60000 && oMs !== newMs)
                  return true
              }
            }
            return false
          }
          const gMs = new Date(g.scheduledAt).getTime()
          const hMs = new Date(h.scheduledAt).getTime()
          if (wouldAdjoin(g, hMs) || wouldAdjoin(h, gMs)) continue
          const [simF, simL] = simSwap(e.dk, g, h)
          const m = metric(simF, simL)
          if (!lexLess(m, before)) continue
          if (!bestSwap || lexLess(m, bestSwap.m)) bestSwap = { gi: e.gi, hj, m }
        }
      }
      if (bestSwap && swapSites(bestSwap.gi, bestSwap.hj)) improved = true
    }
  }

    // ── Back-to-back ELIMINATION (owner 2026-08-01: "avoided at all
    // costs"). Runs LAST among the time-movers so nothing recreates what it
    // fixes. Repair can leave adjacent pairs while free waves sit open the
    // same day; hunt each pair down and retime one of its games. Candidate
    // tiers, best first: same day + window-kept, same day, other day of the
    // SAME weekend (breaking a one-trip preference is allowed here — a
    // back-to-back outranks every preference), other day window-broken.
    {
      const adjacencyAfter = (pairing: Pairing, slot: SchedulerSlot): boolean => {
        const dk = dateKeyOf(slot.startAt)
        for (const id of [pairing.homeTeamId, pairing.awayTeamId]) {
          for (const b of teamBookings[id] ?? []) {
            if (b.dateKey !== dk) continue
            const gapMs = Math.max(
              b.start.getTime() - slot.endAt.getTime(),
              slot.startAt.getTime() - b.end.getTime()
            )
            if (gapMs <= 0) return true
          }
        }
        return false
      }
      const retimeAwayFromB2B = (gi: number): boolean => {
        const prev = { ...games[gi] }
        const prevDk = dateKeyOf(new Date(prev.scheduledAt))
        const gPairing: Pairing = {
          unitKey: prev.unitKey,
          homeTeamId: prev.homeTeamId,
          awayTeamId: prev.awayTeamId,
        }
        removeGameState(gi)
        let best: SchedulerSlot | null = null
        let bestRank = -1
        let bestScore = -Infinity
        for (const sl of slots) {
          if (sl.sessionId !== prev.sessionId) continue
          if (
            dateKeyOf(sl.startAt) === prevDk &&
            sl.startAt.getTime() === new Date(prev.scheduledAt).getTime()
          )
            continue
          if (!bucketHasRoom(sl)) continue
          if (adjacencyAfter(gPairing, sl)) continue
          const c = scoreCandidate(gPairing, sl, false, false, true)
          if (c.score === -Infinity) continue
          const sameDay = dateKeyOf(sl.startAt) === prevDk
          const rank = (sameDay ? 2 : 0) + (windowSafe(gPairing, sl) ? 1 : 0)
          if (rank > bestRank || (rank === bestRank && c.score > bestScore)) {
            bestRank = rank
            bestScore = c.score
            best = sl
          }
        }
        if (best) {
          setGamePlacement(gi, best)
          return true
        }
        games[gi] = prev
        applyPlacementState(siteOfGame(prev), gPairing)
        return false
      }
      let sweeps = 8
      let killed = true
      let b2bFixed = 0
      let b2bSeen = 0
      while (killed && sweeps-- > 0) {
        killed = false
        const byTeamDay = new Map<string, Array<{ ms: number; gi: number }>>()
        for (let gi = 0; gi < games.length; gi++) {
          const d = new Date(games[gi].scheduledAt)
          for (const id of [games[gi].homeTeamId, games[gi].awayTeamId]) {
            const k = `${id}|${dateKeyOf(d)}`
            if (!byTeamDay.has(k)) byTeamDay.set(k, [])
            byTeamDay.get(k)!.push({ ms: d.getTime(), gi })
          }
        }
        for (const [, list] of byTeamDay) {
          if (list.length < 2) continue
          list.sort((a, b) => a.ms - b.ms)
          for (let i = 1; i < list.length; i++) {
            if (list[i].ms - list[i - 1].ms > input.gameSlotMinutes * 60000) continue
            b2bSeen++
            if (retimeAwayFromB2B(list[i].gi) || retimeAwayFromB2B(list[i - 1].gi)) {
              b2bFixed++
              killed = true
              break
            }
          }
          if (killed) break
        }
      }
      if (process.env.SCHED_DEBUG) {
        console.error(`[b2b-elim] pairs seen=${b2bSeen} fixed=${b2bFixed}`)
      }
    }

  } // structuralShortfall gate — short worlds skip repair + quality sweeps

  debugOffAnchor("final")

  // Post-hoc honesty: leftover shape violations and uneven edge slots
  // become trade-off notes (the fairness report carries the detail).
  {
    let styleViolations = 0
    let b2bCount = 0
    const bySessionTeam = new Map<string, number[]>()
    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi]
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const k = `${g.sessionId}|${id}`
        if (!bySessionTeam.has(k)) bySessionTeam.set(k, [])
        bySessionTeam.get(k)!.push(gi)
      }
    }
    for (const [k, gis] of bySessionTeam) {
      if (gis.length < 2) continue
      const teamId = k.split("|")[1]
      const style = styleOf(teamId)
      const times = gis
        .map((gi) => new Date(games[gi].scheduledAt).getTime())
        .sort((a, b) => a - b)
      const dks = gis.map((gi) => dateKeyOf(new Date(games[gi].scheduledAt)))
      const sameDay = new Set(dks).size === 1
      if (sameDay) {
        for (let i = 1; i < times.length; i++) {
          if ((times[i] - times[i - 1]) / (input.gameSlotMinutes * 60000) - 1 <= 0) b2bCount++
        }
      }
      if ((style === "SAME_DAY" && !sameDay) || (style === "SPLIT_DAYS" && sameDay)) styleViolations++
    }
    if (b2bCount > 0) {
      tradeoffs.push(
        `${b2bCount} back-to-back${b2bCount === 1 ? "" : "s"} could not be avoided — add court time or a session.`
      )
    }
    if (styleViolations > 0) {
      tradeoffs.push(
        `${styleViolations} team-weekend${styleViolations === 1 ? "" : "s"} couldn't get the team's preferred shape — the fairness report shows which.`
      )
    }
    if (blackoutsByTeam.size > 0 || windowsByTeam.size > 0) {
      let blackoutViol = 0
      let windowViol = 0
      for (const g of games) {
        const start = new Date(g.scheduledAt)
        const dk = dateKeyOf(start)
        const startMin = start.getHours() * 60 + start.getMinutes()
        for (const id of [g.homeTeamId, g.awayTeamId]) {
          for (const b of blackoutsByTeam.get(id) ?? []) {
            if (b.dateKey !== dk) continue
            const from = b.startMin ?? 0
            const to = b.endMin ?? 24 * 60
            if (startMin < to && from < startMin + input.gameSlotMinutes) blackoutViol++
          }
          for (const w of windowsByTeam.get(id) ?? []) {
            const applies =
              (w.dateKey !== undefined && w.dateKey === dk) ||
              (w.dayOfWeek !== undefined && start.getDay() === w.dayOfWeek)
            if (!applies) continue
            if (
              (w.earliestMin !== undefined && startMin < w.earliestMin) ||
              (w.latestMin !== undefined && startMin > w.latestMin)
            )
              windowViol++
          }
        }
      }
      if (blackoutViol > 0) {
        tradeoffs.push(
          `${blackoutViol} game${blackoutViol === 1 ? " sits" : "s sit"} on a team's blackout — nothing else fit; move ${blackoutViol === 1 ? "it" : "them"} by hand or add court time.`
        )
      }
      if (windowViol > 0) {
        tradeoffs.push(
          `${windowViol} approved schedule request${windowViol === 1 ? "" : "s"} couldn't be honored this run — best effort, the fairness report shows which.`
        )
      }
    }
    // Edge fairness is judged as a SHARE of each team's playing days — a
    // split-days team plays ~2× the days of a one-trip team, so raw counts
    // are not comparable across styles.
    const playDayCount: Record<string, number> = {}
    {
      const seen = new Set<string>()
      for (const g of games) {
        const dk = dateKeyOf(new Date(g.scheduledAt))
        for (const id of [g.homeTeamId, g.awayTeamId]) {
          const k = `${id}|${dk}`
          if (!seen.has(k)) {
            seen.add(k)
            playDayCount[id] = (playDayCount[id] ?? 0) + 1
          }
        }
      }
    }
    // Edge counts per UNIT-day: the division block's opening/closing games.
    const unitDayFirst = new Map<string, number>()
    const unitDayLast = new Map<string, number>()
    for (const g of games) {
      const k = `${dateKeyOf(new Date(g.scheduledAt))}|${g.unitKey}`
      const t = new Date(g.scheduledAt).getTime()
      if (!unitDayFirst.has(k) || t < unitDayFirst.get(k)!) unitDayFirst.set(k, t)
      if (!unitDayLast.has(k) || t > unitDayLast.get(k)!) unitDayLast.set(k, t)
    }
    const unitFirstCount: Record<string, number> = {}
    const unitLastCount: Record<string, number> = {}
    const unitEdgeSlots: Record<string, number> = {} // unitKey → edge team-slots
    const unitAllSlots: Record<string, number> = {} // unitKey → all team-slots
    for (const g of games) {
      const k = `${dateKeyOf(new Date(g.scheduledAt))}|${g.unitKey}`
      const t = new Date(g.scheduledAt).getTime()
      unitAllSlots[g.unitKey] = (unitAllSlots[g.unitKey] ?? 0) + 2
      const isEdge =
        unitDayFirst.get(k) === t ||
        (unitDayLast.get(k) === t && unitDayLast.get(k) !== unitDayFirst.get(k))
      if (isEdge) unitEdgeSlots[g.unitKey] = (unitEdgeSlots[g.unitKey] ?? 0) + 2
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        if (unitDayFirst.get(k) === t) unitFirstCount[id] = (unitFirstCount[id] ?? 0) + 1
        if (unitDayLast.get(k) === t && unitDayLast.get(k) !== unitDayFirst.get(k))
          unitLastCount[id] = (unitLastCount[id] ?? 0) + 1
      }
    }
    for (const u of units) {
      // When most of a division's games share the opening/closing wave
      // (many courts running at once), the "edge" isn't scarce — unevenness
      // there is court-density noise, not unfairness worth a warning.
      const edgeShare = (unitEdgeSlots[u.key] ?? 0) / Math.max(1, unitAllSlots[u.key] ?? 0)
      if (edgeShare > 0.4) continue
      for (const [label, counts] of [
        ["first tip-offs", unitFirstCount],
        ["day-ending games", unitLastCount],
      ] as const) {
        let min = Infinity
        let max = 0
        for (const t of u.teams) {
          const rate = (counts[t.teamId] ?? 0) / Math.max(1, playDayCount[t.teamId] ?? 1)
          min = Math.min(min, rate)
          max = Math.max(max, rate)
        }
        // More than ~a day in four apart counts as uneven.
        if (min !== Infinity && max - min > 0.25) {
          tradeoffs.push(
            `${u.label}: ${label} are uneven (${Math.round(min * 100)}%–${Math.round(
              max * 100
            )}% of each team's days) — there was no other room.`
          )
        }
      }
    }
  }

  // ── PHASE 2: court & venue assignment (owner 2026-08-01) ──
  // Games were placed against TIME buckets; now each bucket's games get
  // real courts. Preferences, in rough order: keep a family at ONE gym per
  // day (same-gym cohesion, preferred not absolute) · fill venue 1 before
  // venue 2 (venue-major) · keep a division rolling on the same court
  // (continuity) · rotate courts across the season so no team camps on a
  // favorite (spread + seeded rotation — deterministic, so preview
  // commits identically).
  {
    const dvRank = new Map<string, number>()
    for (const sess of input.sessions)
      for (const d of sess.days) d.dayVenues.forEach((dv, i) => dvRank.set(dv.id, i))
    const courtUse = new Map<string, number>() // `${teamId}|${courtId}`
    for (const g of input.existingGames ?? []) {
      if (!g.courtId) continue
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const k = `${id}|${g.courtId}`
        courtUse.set(k, (courtUse.get(k) ?? 0) + 1)
      }
    }
    // team|dateKey|venueId → games that day at that venue (cohesion)
    const teamDayVenue = new Map<string, number>()
    const seedHash = (a: string, b: string): number => {
      let h = mixSeed(input.varietySeed ?? 0) + 17
      const str = `${a}|${b}`
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 104729
      return h / 104729
    }
    const courtPrevUnit = new Map<string, { endMs: number; unitKey: string }>()

    const gamesByBucket = new Map<string, number[]>()
    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi]
      const bk = bucketKeyOf(g.dayId, new Date(g.scheduledAt).getTime())
      if (!gamesByBucket.has(bk)) gamesByBucket.set(bk, [])
      gamesByBucket.get(bk)!.push(gi)
    }
    const sortedBuckets = [...gamesByBucket.keys()].sort((a, b) => {
      const ta = Number(a.split("|")[1])
      const tb = Number(b.split("|")[1])
      return ta - tb || a.localeCompare(b)
    })
    for (const bk of sortedBuckets) {
      const courtSlots = (bucketCourts.get(bk) ?? []).filter(
        (cs) => !(bucketBusyCourts.get(bk)?.has(cs.courtId) ?? false)
      )
      const free = [...courtSlots]
      // Deterministic game order within the bucket
      // Grades WITH a gym for the weekend choose first, so an unassigned
      // division can never take the last court in someone's building.
      const order = gamesByBucket
        .get(bk)!
        .sort(
          (a, b) =>
            (assignedVenue(games[a].sessionId, games[a].unitKey) ? 0 : 1) -
              (assignedVenue(games[b].sessionId, games[b].unitKey) ? 0 : 1) ||
            games[a].unitKey.localeCompare(games[b].unitKey) ||
            games[a].homeTeamId.localeCompare(games[b].homeTeamId)
        )
      for (const gi of order) {
        const g = games[gi]
        if (free.length === 0) break // capacity accounting should prevent this
        const dk = dateKeyOf(new Date(g.scheduledAt))
        // Buildings before courts (owner 2026-08-02): the grade's own gym
        // when it still has a court free here, otherwise the highest-priority
        // gym that does — the top gym fills before the next one opens. Court
        // preferences below then choose WITHIN that building.
        const want = assignedVenue(g.sessionId, g.unitKey)
        let candidates = want !== null ? free.filter((cs) => cs.venueId === want) : []
        if (candidates.length === 0) {
          /**
           * THE FAMILY'S OWN BUILDINGS BEFORE THE BEST-RANKED ONE (owner
           * ruling 2026-08-07: eliminating same-day gym splits outranks the
           * plan's per-grade gym placement). When the wanted gym has no court
           * left, the next room to try is wherever either team ALREADY plays
           * today — not the highest-priority venue with space, which is how a
           * family got sent across town between games.
           */
          const cohesion = free.filter((cs) =>
            [g.homeTeamId, g.awayTeamId].some(
              (id) => (teamDayVenue.get(`${id}|${dk}|${cs.venueId}`) ?? 0) > 0
            )
          )
          if (cohesion.length > 0) candidates = cohesion
        }
        if (candidates.length === 0) {
          let bestRank = Infinity
          for (const cs of free) bestRank = Math.min(bestRank, cs.venueRank)
          candidates = free.filter((cs) => cs.venueRank === bestRank)
        }
        let best = candidates[0]
        let bestScore = -Infinity
        for (const cs of candidates) {
          let sc = 0
          // Venue-major: earlier venues in the session plan fill first
          sc += (10 - Math.min(9, dvRank.get(cs.dayVenueId) ?? 9)) * 1.5
          // Same-gym cohesion: either family already at this venue today.
          // Weighted to DOMINATE venue-major (owner ruling 2026-08-07): a
          // fuller first venue never justifies splitting a family's day.
          for (const id of [g.homeTeamId, g.awayTeamId]) {
            if ((teamDayVenue.get(`${id}|${dk}|${cs.venueId}`) ?? 0) > 0) sc += 24
          }
          // Division continuity on the court
          const prev = courtPrevUnit.get(cs.courtId)
          if (prev && prev.unitKey === g.unitKey && prev.endMs === cs.startAt.getTime()) sc += 6
          // Court spread: teams rotate away from courts they've used a lot
          for (const id of [g.homeTeamId, g.awayTeamId]) {
            sc -= 2 * (courtUse.get(`${id}|${cs.courtId}`) ?? 0)
          }
          // Seeded rotation so equal choices don't always break the same way
          sc += seedHash(`${g.homeTeamId}${g.awayTeamId}${bk}`, cs.courtId) * 1.2
          if (sc > bestScore) {
            bestScore = sc
            best = cs
          }
        }
        games[gi] = {
          ...g,
          courtId: best.courtId,
          venueId: best.venueId,
          dayVenueId: best.dayVenueId,
        }
        free.splice(free.indexOf(best), 1)
        courtPrevUnit.set(best.courtId, { endMs: best.endAt.getTime(), unitKey: g.unitKey })
        for (const id of [g.homeTeamId, g.awayTeamId]) {
          const k = `${id}|${best.courtId}`
          courtUse.set(k, (courtUse.get(k) ?? 0) + 1)
          const vk = `${id}|${dk}|${best.venueId}`
          teamDayVenue.set(vk, (teamDayVenue.get(vk) ?? 0) + 1)
        }
      }
    }
  }

  // ── Venue-cohesion repair (owner 2026-08-01; hierarchy inverted by owner
  // ruling 2026-08-07). Court assignment is chronological, so a team's FIRST
  // game can't know where its second wants to be — this sweep unifies
  // split-venue team-days afterwards: move the odd game to a free court at
  // the family's venue, or swap courts with a same-time game, accepting only
  // changes that reduce total split team-days.
  //
  // THE OLD FENCE IS GONE: a game at its grade's assigned gym used to be off
  // limits in both roles, which left the sweep powerless the moment the plan
  // assigned every grade a gym (nearly always). The 2026-08-07 ruling is the
  // reverse hierarchy — ELIMINATING a family's split day outranks the plan's
  // per-grade placement — so any game may move or swap when it heals a split;
  // staying at the assigned gym survives only as a preference (off-plan
  // partners are tried before at-plan ones).
  {
    const atAssignedGym = (g: ProposedGame): boolean => {
      const want = assignedVenue(g.sessionId, g.unitKey)
      return want !== null && want === g.venueId
    }
    const bucketOfG = (g: ProposedGame): string =>
      bucketKeyOf(g.dayId, new Date(g.scheduledAt).getTime())
    const startMsOf = (bk2: string): number => Number(bk2.split("|")[1])
    const assignedByBucket = new Map<string, number[]>()
    for (let gi = 0; gi < games.length; gi++) {
      const bk = bucketOfG(games[gi])
      if (!assignedByBucket.has(bk)) assignedByBucket.set(bk, [])
      assignedByBucket.get(bk)!.push(gi)
    }
    const freeSlotsByBucket = new Map<string, SchedulerSlot[]>()
    for (const [bk, courtSlots] of bucketCourts) {
      const usedCourts = new Set(
        (assignedByBucket.get(bk) ?? []).map((gi) => games[gi].courtId)
      )
      const busy = bucketBusyCourts.get(bk)
      freeSlotsByBucket.set(
        bk,
        courtSlots.filter((cs) => !usedCourts.has(cs.courtId) && !(busy?.has(cs.courtId) ?? false))
      )
    }
    const dayVenuesOf = new Map<string, Map<string, number>>() // `${id}|${dk}` → venue→n
    const bumpDV = (id: string, dk: string, venueId: string, delta: number): void => {
      const k = `${id}|${dk}`
      if (!dayVenuesOf.has(k)) dayVenuesOf.set(k, new Map())
      const m = dayVenuesOf.get(k)!
      const next = (m.get(venueId) ?? 0) + delta
      if (next <= 0) m.delete(venueId)
      else m.set(venueId, next)
    }
    for (const g of games) {
      const dk = dateKeyOf(new Date(g.scheduledAt))
      for (const id of [g.homeTeamId, g.awayTeamId]) bumpDV(id, dk, g.venueId, 1)
    }
    const splitOf = (id: string, dk: string): number =>
      (dayVenuesOf.get(`${id}|${dk}`)?.size ?? 0) > 1 ? 1 : 0
    const teamsOf = (g: ProposedGame): string[] => [g.homeTeamId, g.awayTeamId]
    // Court usage, so fixes prefer courts the team has NOT camped on.
    const tcUse = new Map<string, number>()
    for (const g of [...games, ...((input.existingGames ?? []) as ProposedGame[])]) {
      if (!g.courtId) continue
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const k = `${id}|${g.courtId}`
        tcUse.set(k, (tcUse.get(k) ?? 0) + 1)
      }
    }
    const courtUseOf = (g: ProposedGame, courtId: string): number =>
      teamsOf(g).reduce((acc, id) => acc + (tcUse.get(`${id}|${courtId}`) ?? 0), 0)
    const reassign = (gi: number, cs: SchedulerSlot): void => {
      const g = games[gi]
      const dk = dateKeyOf(new Date(g.scheduledAt))
      for (const id of teamsOf(g)) {
        bumpDV(id, dk, g.venueId, -1)
        tcUse.set(`${id}|${g.courtId}`, (tcUse.get(`${id}|${g.courtId}`) ?? 1) - 1)
      }
      games[gi] = { ...g, courtId: cs.courtId, venueId: cs.venueId, dayVenueId: cs.dayVenueId }
      for (const id of teamsOf(games[gi])) {
        bumpDV(id, dk, cs.venueId, 1)
        tcUse.set(`${id}|${cs.courtId}`, (tcUse.get(`${id}|${cs.courtId}`) ?? 0) + 1)
      }
    }
    for (let sweep = 0; sweep < 4; sweep++) {
      let changed = false
      for (let gi = 0; gi < games.length; gi++) {
        const g = games[gi]
        const dk = dateKeyOf(new Date(g.scheduledAt))
        // Which of this game's teams sits split today, and where do their
        // OTHER games live?
        const wantVenues = new Set<string>()
        for (const id of teamsOf(g)) {
          if (!splitOf(id, dk)) continue
          for (const [v, n] of dayVenuesOf.get(`${id}|${dk}`) ?? []) {
            if (v !== g.venueId && n > 0) wantVenues.add(v)
          }
        }
        if (wantVenues.size === 0) continue
        const bk = bucketOfG(g)
        const before = teamsOf(g).reduce((acc, id) => acc + splitOf(id, dk), 0)
        /**
         * A FREE-COURT MOVE MAY NOT STRAND A BOOKING (the spill-test nuance,
         * 2026-08-07). Healing a split by walking a game OFF its assigned gym
         * onto an empty court elsewhere leaves the paid building emptier —
         * the sweep would drain a small rented gym to zero. So a game at its
         * assigned gym leaves only by SWAP, which keeps every venue's usage
         * constant: the family heals and the booking stays used.
         */
        const mayFreeMove = !atAssignedGym(g)
        // Free court at a wanted venue, same time?
        const free = mayFreeMove ? (freeSlotsByBucket.get(bk) ?? []) : []
        let freeIdx = -1
        let freeBest = Infinity
        for (let fi = 0; fi < free.length; fi++) {
          if (!wantVenues.has(free[fi].venueId)) continue
          const u = courtUseOf(g, free[fi].courtId)
          if (u < freeBest) {
            freeBest = u
            freeIdx = fi
          }
        }
        if (freeIdx >= 0) {
          const cs = free[freeIdx]
          const oldSlot = (bucketCourts.get(bk) ?? []).find((x) => x.courtId === g.courtId)
          reassign(gi, cs)
          const after = teamsOf(g).reduce((acc, id) => acc + splitOf(id, dk), 0)
          if (after < before) {
            free.splice(freeIdx, 1)
            if (oldSlot) free.push(oldSlot)
            changed = true
          } else if (oldSlot) {
            reassign(gi, oldSlot) // no gain — put it back
          }
          continue
        }
        // Swap courts with a same-time game already at a wanted venue —
        // least-camped courts first.
        const swapCands = (assignedByBucket.get(bk) ?? [])
          .filter((gj) => gj !== gi && wantVenues.has(games[gj].venueId))
          .sort(
            (a, b) =>
              // Off-plan partners first: conformity to the plan's gym is a
              // preference now, never a fence (owner ruling 2026-08-07).
              (atAssignedGym(games[a]) ? 1 : 0) - (atAssignedGym(games[b]) ? 1 : 0) ||
              courtUseOf(g, games[a].courtId) - courtUseOf(g, games[b].courtId)
          )
        let swapped = false
        for (const gj of swapCands) {
          const other = games[gj]
          const odk = dateKeyOf(new Date(other.scheduledAt))
          const beforeAll =
            before + teamsOf(other).reduce((acc, id) => acc + splitOf(id, odk), 0)
          const gSlot = (bucketCourts.get(bk) ?? []).find((x) => x.courtId === g.courtId)
          const oSlot = (bucketCourts.get(bk) ?? []).find((x) => x.courtId === other.courtId)
          if (!gSlot || !oSlot) continue
          reassign(gi, oSlot)
          reassign(gj, gSlot)
          const afterAll =
            teamsOf(games[gi]).reduce((acc, id) => acc + splitOf(id, dk), 0) +
            teamsOf(games[gj]).reduce((acc, id) => acc + splitOf(id, odk), 0)
          if (afterAll < beforeAll) {
            changed = true
            swapped = true
            break
          }
          reassign(gi, gSlot)
          reassign(gj, oSlot)
        }
        if (swapped) continue
        /**
         * LAST RESORT: A LONGER DAY AT ONE GYM BEATS A SHORTER DAY AT TWO
         * (owner ruling 2026-08-07, second pass). When no same-time court or
         * swap exists at the family's building, the game may move to a
         * DIFFERENT TIME the same day at that building — accepting the longer
         * gap or the back-to-back that creates, because the split is the
         * worse evil ("that makes the day even longer"). Different-DAY moves
         * stay off the table (owner: arguable, not yet). The assigned-gym
         * stranding rule still holds: only an off-plan game moves this way.
         */
        if (!mayFreeMove) continue
        const dayBuckets = [...freeSlotsByBucket.keys()].filter(
          (obk) => obk !== bk && obk.startsWith(`${g.dayId}|`)
        )
        let done = false
        for (const obk of dayBuckets) {
          const startMs = Number(obk.split("|")[1])
          // Neither team may already be on a court at the target time.
          const clash = (assignedByBucket.get(obk) ?? []).some((oj) =>
            teamsOf(games[oj]).some((id) => teamsOf(g).includes(id))
          )
          if (clash) continue
          const slotList = freeSlotsByBucket.get(obk) ?? []
          const si = slotList.findIndex((cs) => wantVenues.has(cs.venueId))
          if (si < 0) continue
          const cs = slotList[si]
          const oldSlot = (bucketCourts.get(bk) ?? []).find((x) => x.courtId === g.courtId)
          const oldBucketGames = assignedByBucket.get(bk) ?? []
          // Move across time: court, venue AND clock move together.
          reassign(gi, cs)
          games[gi] = { ...games[gi], scheduledAt: cs.startAt.toISOString(), dayId: g.dayId }
          const after = teamsOf(games[gi]).reduce((acc, id) => acc + splitOf(id, dk), 0)
          if (after < before) {
            slotList.splice(si, 1)
            if (oldSlot) (freeSlotsByBucket.get(bk) ?? []).push(oldSlot)
            oldBucketGames.splice(oldBucketGames.indexOf(gi), 1)
            if (!assignedByBucket.has(obk)) assignedByBucket.set(obk, [])
            assignedByBucket.get(obk)!.push(gi)
            changed = true
            done = true
            break
          }
          // No gain: put the clock and the court back.
          reassign(gi, oldSlot ?? cs)
          games[gi] = { ...games[gi], scheduledAt: new Date(startMsOf(bk)).toISOString() }
          if (done) break
        }
      }
      if (!changed) break
    }

    /**
     * THE SHAPE OF A FAMILY'S DAY (owner ruling 2026-08-07, third pass):
     * games close together at one gym. Best is a 1-2 slot breather; a 3-4
     * slot wait is tolerable; a back-to-back is a burden to remove where a
     * small gap can exist, but it BEATS a monster wait (more than 4 slots -
     * over five hours at 75-minute games). On a SPLIT day the logic
     * inverts: the cross-gym gap must be wide enough to drive, and a wide
     * gap there is free, not a wait. Nothing here ever touches a venue, so
     * a repaired day can never become a split day. Same-day, same-venue
     * time moves only, accepted when the total day-shape burden of the
     * moved game's two teams strictly drops.
     */
    const B2B = 25
    const HUGE = 40
    const MID = 8
    // A split day with no time to drive between gyms is the worst shape a
    // day can take (owner ruling 2026-08-07: "you cannot have a gym split
    // and the games scheduled back-to-back") — priced above everything so
    // the sweep will trade any wait to buy the family its drive. And on a
    // cross-venue pair the gap IS the drive: long is fine, never a wait.
    const TIGHT_SPLIT = 60
    const dayShape = (id: string, dk2: string): number => {
      const stops: Array<{ t: number; v: string }> = []
      for (const g2 of games) {
        if (dateKeyOf(new Date(g2.scheduledAt)) !== dk2) continue
        if (g2.homeTeamId !== id && g2.awayTeamId !== id) continue
        stops.push({ t: new Date(g2.scheduledAt).getTime(), v: g2.venueId })
      }
      stops.sort((a, b) => a.t - b.t)
      let burden = 0
      const slotMs = (input.gameSlotMinutes || 60) * 60000
      for (let i = 1; i < stops.length; i++) {
        const gapSlots = (stops[i].t - stops[i - 1].t) / slotMs - 1
        if (stops[i].v !== stops[i - 1].v) {
          if (gapSlots < TRAVEL_MIN_GAP_SLOTS) burden += TIGHT_SPLIT
          continue
        }
        if (gapSlots <= 0) burden += B2B
        else if (gapSlots > 4) burden += HUGE
        else if (gapSlots > 2) burden += MID
      }
      return burden
    }
    {
      for (let round = 0; round < 4; round++) {
        let improved = false
        for (let gi = 0; gi < games.length; gi++) {
          const g = games[gi]
          const dk2 = dateKeyOf(new Date(g.scheduledAt))
          const ids = teamsOf(g)
          const before2 = ids.reduce((acc, id) => acc + dayShape(id, dk2), 0)
          if (before2 === 0) continue
          const bk2 = bucketOfG(g)
          // Same DAY, same VENUE, different time, neither team already there.
          const dayBuckets2 = [...freeSlotsByBucket.keys()].filter(
            (obk) => obk !== bk2 && obk.startsWith(`${g.dayId}|`)
          )
          let moved = false
          for (const obk of dayBuckets2) {
            const clash = (assignedByBucket.get(obk) ?? []).some((oj) =>
              teamsOf(games[oj]).some((id) => ids.includes(id))
            )
            if (clash) continue
            const slotList = freeSlotsByBucket.get(obk) ?? []
            const si = slotList.findIndex((cs) => cs.venueId === g.venueId)
            if (si < 0) continue
            const cs = slotList[si]
            const oldSlot = (bucketCourts.get(bk2) ?? []).find((x) => x.courtId === g.courtId)
            const oldStart = g.scheduledAt
            const oldBucketGames = assignedByBucket.get(bk2) ?? []
            reassign(gi, cs)
            games[gi] = { ...games[gi], scheduledAt: cs.startAt.toISOString() }
            const after2 = ids.reduce((acc, id) => acc + dayShape(id, dk2), 0)
            if (after2 < before2) {
              slotList.splice(si, 1)
              if (oldSlot) (freeSlotsByBucket.get(bk2) ?? []).push(oldSlot)
              oldBucketGames.splice(oldBucketGames.indexOf(gi), 1)
              if (!assignedByBucket.has(obk)) assignedByBucket.set(obk, [])
              assignedByBucket.get(obk)!.push(gi)
              improved = true
              moved = true
              break
            }
            reassign(gi, oldSlot ?? cs)
            games[gi] = { ...games[gi], scheduledAt: oldStart }
          }
          if (moved) continue
        }
        if (!improved) break
      }
    }

    /**
     * EVEN OUT WHAT COULD NOT BE ELIMINATED (owner ruling 2026-08-07, goal
     * two): nobody carries four split days while others carry none. A
     * split-total-NEUTRAL same-time swap can still MOVE a split from a team
     * that has many onto teams that have fewer; each accepted trade strictly
     * lowers the worst-off team's count, so the loop terminates. Elimination
     * always ran first, so nothing here undoes goal one.
     */
    const seasonSplitsOf = (id: string): number => {
      let n = 0
      for (const [k, m] of dayVenuesOf) {
        if (k.startsWith(`${id}|`) && m.size > 1) n++
      }
      return n
    }
    for (let round = 0; round < 6; round++) {
      let traded = false
      // Worst-off teams first.
      const loads = new Map<string, number>()
      for (const g of games) for (const id of teamsOf(g)) {
        if (!loads.has(id)) loads.set(id, seasonSplitsOf(id))
      }
      const order = [...Array(games.length).keys()].sort((a, b) => {
        const la = Math.max(...teamsOf(games[a]).map((id) => loads.get(id) ?? 0))
        const lb = Math.max(...teamsOf(games[b]).map((id) => loads.get(id) ?? 0))
        return lb - la
      })
      for (const gi of order) {
        const g = games[gi]
        const dk = dateKeyOf(new Date(g.scheduledAt))
        const splitTeams = teamsOf(g).filter((id) => splitOf(id, dk))
        if (splitTeams.length === 0) continue
        const donorLoad = Math.max(...splitTeams.map((id) => seasonSplitsOf(id)))
        if (donorLoad < 2) continue // one split is inside the fair share
        const wantVenues = new Set<string>()
        for (const id of splitTeams) {
          for (const [v, n] of dayVenuesOf.get(`${id}|${dk}`) ?? []) {
            if (v !== g.venueId && n > 0) wantVenues.add(v)
          }
        }
        const bk = bucketOfG(g)
        for (const gj of assignedByBucket.get(bk) ?? []) {
          if (gj === gi || !wantVenues.has(games[gj].venueId)) continue
          const other = games[gj]
          const odk = dateKeyOf(new Date(other.scheduledAt))
          const totalBefore =
            teamsOf(g).reduce((acc, id) => acc + splitOf(id, dk), 0) +
            teamsOf(other).reduce((acc, id) => acc + splitOf(id, odk), 0)
          const gSlot = (bucketCourts.get(bk) ?? []).find((x) => x.courtId === g.courtId)
          const oSlot = (bucketCourts.get(bk) ?? []).find((x) => x.courtId === other.courtId)
          if (!gSlot || !oSlot) continue
          reassign(gi, oSlot)
          reassign(gj, gSlot)
          const totalAfter =
            teamsOf(games[gi]).reduce((acc, id) => acc + splitOf(id, dk), 0) +
            teamsOf(games[gj]).reduce((acc, id) => acc + splitOf(id, odk), 0)
          const recipientLoad = Math.max(
            0,
            ...teamsOf(games[gj])
              .filter((id) => splitOf(id, odk))
              .map((id) => seasonSplitsOf(id))
          )
          // Accept only a strict hand-down: no more total splits, and the
          // team now holding one is still better off than the donor was.
          if (totalAfter <= totalBefore && recipientLoad < donorLoad) {
            traded = true
            break
          }
          reassign(gi, gSlot)
          reassign(gj, oSlot)
        }
        if (traded) break
        /**
         * CROSS-TIME HAND-DOWN (owner ruling 2026-08-07, fourth pass: "20
         * teams with two gym splits... we definitely need to spread it
         * out"). When no same-time partner exists, trade with a game at a
         * wanted venue at ANOTHER TIME the same day: the two games swap
         * courts AND clocks. Both courts stay booked, so the stranding rule
         * is satisfied the same way same-time swaps satisfy it. Guarded by
         * the venue-aware day-shape burden of all four teams, so a fairness
         * trade can never buy flatness with an undriveable split or a
         * monster wait it did not pay off elsewhere.
         */
        const dayBks = [...(assignedByBucket.keys() as Iterable<string>)].filter(
          (obk2) => obk2 !== bk && obk2.startsWith(`${g.dayId}|`)
        )
        for (const obk of dayBks) {
          if (traded) break
          for (const gj of [...(assignedByBucket.get(obk) ?? [])]) {
            const other = games[gj]
            if (!wantVenues.has(other.venueId)) continue
            const gTeams = teamsOf(g)
            const oTeams = teamsOf(other)
            if (gTeams.some((id) => oTeams.includes(id))) continue
            // Neither pair may land on a time where they already play.
            const clashG = (assignedByBucket.get(obk) ?? []).some(
              (oj) => oj !== gj && teamsOf(games[oj]).some((id) => gTeams.includes(id))
            )
            const clashO = (assignedByBucket.get(bk) ?? []).some(
              (oj) => oj !== gi && teamsOf(games[oj]).some((id) => oTeams.includes(id))
            )
            if (clashG || clashO) continue
            const odk = dateKeyOf(new Date(other.scheduledAt))
            const affected = [...new Set([...gTeams, ...oTeams])]
            const shapeBefore = affected.reduce((acc, id) => acc + dayShape(id, dk), 0)
            const totalBefore =
              gTeams.reduce((acc, id) => acc + splitOf(id, dk), 0) +
              oTeams.reduce((acc, id) => acc + splitOf(id, odk), 0)
            const gSlot = (bucketCourts.get(bk) ?? []).find((x) => x.courtId === g.courtId)
            const oSlot = (bucketCourts.get(obk) ?? []).find((x) => x.courtId === other.courtId)
            if (!gSlot || !oSlot) continue
            const gStart = games[gi].scheduledAt
            const oStart = games[gj].scheduledAt
            reassign(gi, oSlot)
            reassign(gj, gSlot)
            games[gi] = { ...games[gi], scheduledAt: oStart }
            games[gj] = { ...games[gj], scheduledAt: gStart }
            const totalAfter =
              teamsOf(games[gi]).reduce((acc, id) => acc + splitOf(id, dk), 0) +
              teamsOf(games[gj]).reduce((acc, id) => acc + splitOf(id, odk), 0)
            const recipientLoad = Math.max(
              0,
              ...teamsOf(games[gj])
                .filter((id) => splitOf(id, odk))
                .map((id) => seasonSplitsOf(id))
            )
            const shapeAfter = affected.reduce((acc, id) => acc + dayShape(id, dk), 0)
            if (totalAfter <= totalBefore && recipientLoad < donorLoad && shapeAfter <= shapeBefore) {
              const bkList = assignedByBucket.get(bk)!
              const obkList = assignedByBucket.get(obk)!
              bkList.splice(bkList.indexOf(gi), 1)
              obkList.splice(obkList.indexOf(gj), 1)
              bkList.push(gj)
              obkList.push(gi)
              traded = true
              break
            }
            reassign(gi, gSlot)
            reassign(gj, oSlot)
            games[gi] = { ...games[gi], scheduledAt: gStart }
            games[gj] = { ...games[gj], scheduledAt: oStart }
          }
        }
        if (traded) break
      }
      if (!traded) break
    }
  }

  if (bonusGames > 0) {
    tradeoffs.push(
      `To keep every team whole, ${bonusGames} team${bonusGames === 1 ? " plays" : "s play"} one bonus game beyond the guarantee.`
    )
  }
  if (overShareGames > 0) {
    tradeoffs.push(
      `To fit every game in, ${overShareGames} game${overShareGames === 1 ? " gives" : "s give"} a team an extra game in one weekend (three that weekend instead of two). More court time or another session removes the squeeze.`
    )
  }
  if (sameSessionRematches > 0) {
    tradeoffs.push(
      `To fit every game in, ${sameSessionRematches} rematch${sameSessionRematches === 1 ? " lands" : "es land"} in the same weekend as the first meeting. Another session would spread them apart.`
    )
  }

  // Games that had to leave the gym their grade was given for that weekend
  // (owner 2026-08-02). The assignment is a preference, never a reason to
  // drop a game, so this is a number the operator acts on, not a failure.
  let venueFallbacks = 0
  if (input.venueAssignments) {
    for (const g of games) {
      const want = assignedVenue(g.sessionId, g.unitKey)
      if (want !== null && want !== g.venueId) venueFallbacks++
    }
  }
  if (venueFallbacks > 0) {
    warnings.push(
      `${venueFallbacks} game${venueFallbacks === 1 ? "" : "s"} could not fit the gym their grade was given for that weekend and were placed in another gym. Add hours or a court at the assigned gym, or plan the grade into a bigger building.`
    )
  }

  // Utilization
  const slotMinutes = input.gameSlotMinutes
  const courtMinutesAvailable = slots.length * slotMinutes
  const courtMinutesUsed = games.length * slotMinutes
  const slotsUsed = games.length

  // Warnings: teams under their target — the session share in
  // session-by-session mode, the full guarantee otherwise.
  const perTeamTarget = sessionTeamCap ?? input.gamesGuaranteed
  for (const u of units) {
    for (const t of u.teams) {
      const count = teamGameCount[t.teamId] ?? 0
      if (count < perTeamTarget) {
        warnings.push(`${u.label}: ${t.name} has ${count} games (target ${perTeamTarget}).`)
      }
    }
  }

  // Pool leftovers only count as failures while their teams are still under
  // this run's target — in session mode most of the pool intentionally waits
  // for later sessions, and after the repair pass a leftover pairing whose
  // teams both hit target was simply replaced by a make-up rematch.
  const failedToPlace = remaining.filter(
    (p) => repairCount(p.homeTeamId) < repairTarget && repairCount(p.awayTeamId) < repairTarget
  )

  // Diagnose every failure in plain words (owner 2026-08-01: "exactly what
  // to fix, what the issue might be"). Re-score the pairing against every
  // slot and translate the dominant blockers into an operator action.
  const ADVICE: Record<string, string> = {
    "court busy": "every court is booked at those times — add a court to the sessions or extend their hours",
    "home team busy": "a team is already playing at every open time — add court time on other days",
    "away team busy": "a team is already playing at every open time — add court time on other days",
    "home team at this session's share": "the teams already play their full share those weekends — raise a session's games-per-team or add a session",
    "away team at this session's share": "the teams already play their full share those weekends — raise a session's games-per-team or add a session",
    "home team at session target": "the teams already play their full share this session — schedule the remaining sessions or add one",
    "away team at session target": "the teams already play their full share this session — schedule the remaining sessions or add one",
    "home team at daily limit": "the teams are at their games-per-day limit on every open day — raise it in Game format or add another day",
    "away team at daily limit": "the teams are at their games-per-day limit on every open day — raise it in Game format or add another day",
    "rematch within the same session": "these teams already meet in every session that has room — add a session so the rematch lands elsewhere",
    "rematch before all first meetings": "first-time matchups are scheduled ahead of rematches — schedule the remaining sessions first",
    "off the grade's gym for the weekend": "the gym this grade is assigned that weekend has no time they can use. Give the weekend another gym, add hours there, or send the grade to a bigger building",
    "unit not included in this session": "their division is unticked in every session with room — include it in a session's capacity plan",
    "no slots": "the sessions have no open court time at all — add venues, courts, or hours",
  }
  const diagnose = (pairing: Pairing): string => {
    const tally = new Map<string, number>()
    for (const slot of slots) {
      const cand = scoreCandidate(pairing, slot)
      if (cand.score !== -Infinity) return "space exists — a different variation may place it (try Shuffle)"
      tally.set(cand.blockReason ?? "unknown", (tally.get(cand.blockReason ?? "unknown") ?? 0) + 1)
    }
    if (tally.size === 0) return ADVICE["no slots"]
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return ADVICE[top] ?? top
  }
  const failureReasons = failedToPlace.map((p) => diagnose(p))
  if (failedToPlace.length > 0) {
    const topAdvice = [...new Set(failureReasons)].slice(0, 2)
    warnings.push(
      `${failedToPlace.length} game${failedToPlace.length === 1 ? "" : "s"} could not be placed: ${topAdvice.join("; also: ")}`
    )
  }

  return {
    games,
    tradeoffs,
    venueFallbacks,
    unscheduled: failedToPlace.map((p, i) => ({
      unitKey: p.unitKey,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      reason: failureReasons[i],
    })),
    warnings,
    utilization: {
      slotsTotal: slots.length,
      slotsUsed,
      courtMinutesAvailable,
      courtMinutesUsed,
      teamGameCounts: teamGameCount,
    },
  }
}
