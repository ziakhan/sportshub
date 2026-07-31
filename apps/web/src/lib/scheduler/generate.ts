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
  startAt: Date
  endAt: Date
}

export interface SchedulerTeam {
  submissionId: string
  teamId: string
  divisionId: string
  name: string
}

export interface SchedulerUnit {
  key: string // divisionId or groupId
  label: string
  teams: SchedulerTeam[]
}

export interface SchedulerInput {
  gamesGuaranteed: number
  gameSlotMinutes: number
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
   * Optional per-session include list (sessionId → unit keys). A session with
   * an entry only hosts those units; sessions without an entry host any unit.
   * This is how the owner squeezes divisions into the sessions they fit in.
   */
  sessionUnitFilter?: Record<string, string[]>
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

export function buildSlots(input: SchedulerInput): SchedulerSlot[] {
  const slots: SchedulerSlot[] = []
  const fallbackOpen = parseHHMM(input.defaultVenueOpenTime) ?? { h: 9, m: 0 }
  const fallbackClose = parseHHMM(input.defaultVenueCloseTime) ?? { h: 20, m: 0 }

  const restrict = input.restrictToSessionIds?.length
    ? new Set(input.restrictToSessionIds)
    : null
  for (const s of input.sessions) {
    if (s.phase !== "REGULAR") continue
    if (restrict && !restrict.has(s.id)) continue
    for (const d of s.days) {
      for (const dv of d.dayVenues) {
        const open = parseHHMM(dv.startTime) ?? fallbackOpen
        const close = parseHHMM(dv.endTime) ?? fallbackClose
        const dayStart = atTimeOnDate(d.date, open)
        const dayEnd = atTimeOnDate(d.date, close)
        if (dayEnd <= dayStart) continue

        const windowMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000
        const slotsPerCourt = Math.floor(windowMinutes / input.gameSlotMinutes)

        for (const [courtIdx, court] of dv.courts.entries()) {
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
              startAt,
              endAt,
            })
          }
        }
      }
    }
  }
  // Day by day chronologically; within a day the PREFERRED court's whole
  // timeline comes first, so games pack onto court 1 and only overflow to
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

function buildPairings(
  unit: SchedulerUnit,
  gamesGuaranteed: number,
  varietySeed = 0
): Pairing[] {
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

export function generateSchedule(input: SchedulerInput): SchedulerResult {
  const warnings: string[] = []
  const tradeoffs: string[] = []
  const slots = buildSlots(input)
  const units = buildUnits(input)

  if (slots.length === 0) warnings.push("No usable slots were generated.")
  if (units.length === 0) warnings.push("No scheduling units with ≥ 2 teams.")

  // Units the filter excludes from EVERY session can never place a game —
  // skip their pairings entirely and say so, instead of emitting one
  // "unscheduled" row per pairing.
  const filter = input.sessionUnitFilter
  const sessionIds = input.sessions.filter((s) => s.phase === "REGULAR").map((s) => s.id)
  const unitAllowedSomewhere = (unitKey: string): boolean => {
    if (!filter) return true
    return sessionIds.some((sid) => {
      const allowed = filter[sid]
      return !allowed || allowed.includes(unitKey)
    })
  }

  // Session-by-session mode: per-team demand for THIS run is the restricted
  // sessions' share of the season, mirroring the capacity report's math.
  const regularSessions = input.sessions.filter((s) => s.phase === "REGULAR")
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

  // ── Phase 1/Phase 2 split (owner 2026-08-01): "courts are just slots".
  // Placement reasons about TIME ONLY — each (day, start time) is a bucket
  // whose capacity is the number of open courts. Specific courts and venues
  // are assigned AFTERWARDS (venue-major fill, same-gym cohesion, court
  // rotation), so no team is welded to a court by placement order.
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
  const bucketUsed = new Map<string, number>()
  const bucketHasRoom = (slot: SchedulerSlot): boolean => {
    const bk = bucketOfSlot(slot)
    const capacity =
      (bucketCourts.get(bk)?.length ?? 0) - (bucketBusyCourts.get(bk)?.size ?? 0)
    return (bucketUsed.get(bk) ?? 0) < capacity
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

  // Scheduling state
  const teamGameCount: Record<string, number> = {}
  const teamBookings: Record<string, Array<{ start: Date; end: Date; dateKey: string }>> = {}
  const dateKeyOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
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
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const sk = sessionKey(g.sessionId, id)
        teamSessionCount[sk] = (teamSessionCount[sk] ?? 0) + 1
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


    // Philosophy
    if (input.schedulingPhilosophy === "FAMILY_FRIENDLY") {
      // Prefer slots where one team already has a game today (cluster)
      if (homeDayCount > 0) score += 3
      if (awayDayCount > 0) score += 3
    } else {
      // SPREAD_DAYS: penalize same-day games
      if (homeDayCount > 0) score -= 6
      if (awayDayCount > 0) score -= 6
    }

    // Same-day GAP shaping (owner 2026-08-01): when a team plays twice in a
    // day, the games should sit close but never back-to-back — roughly a
    // two-slot break is ideal; a 9:30 + 7:00pm split is almost as bad as
    // none. Back-to-back stays merely a last resort, not forbidden.
    const dayKeyHere = dateKeyOf(slot.startAt)
    for (const teamId of [homeTeamId, awayTeamId]) {
      for (const b of teamBookings[teamId] ?? []) {
        if (b.dateKey !== dayKeyHere) continue
        const gapMs = Math.max(
          b.start.getTime() - slot.endAt.getTime(),
          slot.startAt.getTime() - b.end.getTime()
        )
        const gapSlots = gapMs / (input.gameSlotMinutes * 60000)
        if (gapSlots <= 0) score -= 8
        else if (gapSlots <= 2.01) score += 4
        else score -= Math.min(8, 2 * (gapSlots - 2))
      }
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
    const pk = pairKey(pairing.homeTeamId, pairing.awayTeamId)
    playedPairCount[pk] = (playedPairCount[pk] ?? 0) + 1
    const spk = `${site.sessionId}|${pk}`
    pairSessionCount[spk] = (pairSessionCount[spk] ?? 0) + 1
    ;(pairMeetTimes[pk] ??= []).push(site.startAt.getTime())
    const ratio = slotRatioByDay.get(site.dayId)?.get(site.startAt.getTime()) ?? 0.5
    for (const id of [pairing.homeTeamId, pairing.awayTeamId]) {
      const sk = sessionKey(site.sessionId, id)
      teamSessionCount[sk] = (teamSessionCount[sk] ?? 0) + 1
      timeLoadSum[id] = (timeLoadSum[id] ?? 0) + ratio
      timeLoadCount[id] = (timeLoadCount[id] ?? 0) + 1
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
    }
    const bk = bucketKeyOf(g.dayId, site.startAt.getTime())
    bucketUsed.set(bk, (bucketUsed.get(bk) ?? 1) - 1)
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

  const openSlots: SchedulerSlot[] = []
  for (const slot of slots) {
    if (!placeInto(slot, false)) openSlots.push(slot)
  }
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

  /** Find a legal free slot in the session and commit the pairing there. */
  const placeInSession = (pairing: Pairing, sessionId: string): boolean => {
    for (const slot of slotsBySession.get(sessionId) ?? []) {
      if (relocationBudget <= 0) return false
      if (!bucketHasRoom(slot)) continue
      relocationBudget--
      const c = scoreCandidate(pairing, slot, true, false, true)
      if (c.score !== -Infinity) {
        commitPlacement(slot, pairing)
        return true
      }
    }
    return false
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
    for (const slot of slotsBySession.get(toSession) ?? []) {
      if (relocationBudget <= 0) break
      if (!bucketHasRoom(slot)) continue
      relocationBudget--
      const c = scoreCandidate(gPairing, slot, true, false, true)
      if (c.score !== -Infinity) {
        setGamePlacement(gi, slot)
        entry.placed = true
        return true
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
      for (const slot of slotsBySession.get(dest) ?? []) {
        if (relocationBudget <= 0) return false
        if (!bucketHasRoom(slot)) continue
        relocationBudget--
        const c = scoreCandidate(gPairing, slot, true, false, true)
        if (c.score !== -Infinity) {
          setGamePlacement(gi, slot)
          entry.placed = true
          return true
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

  runRepairMode("strict")
  runRepairMode("relaxDay")
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
  runRepairMode("overGuarantee")

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
      let h = (input.varietySeed ?? 0) + 17
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
      const order = gamesByBucket
        .get(bk)!
        .sort(
          (a, b) =>
            games[a].unitKey.localeCompare(games[b].unitKey) ||
            games[a].homeTeamId.localeCompare(games[b].homeTeamId)
        )
      for (const gi of order) {
        const g = games[gi]
        if (free.length === 0) break // capacity accounting should prevent this
        const dk = dateKeyOf(new Date(g.scheduledAt))
        let best = free[0]
        let bestScore = -Infinity
        for (const cs of free) {
          let sc = 0
          // Venue-major: earlier venues in the session plan fill first
          sc += (10 - Math.min(9, dvRank.get(cs.dayVenueId) ?? 9)) * 1.5
          // Same-gym cohesion: either family already at this venue today
          for (const id of [g.homeTeamId, g.awayTeamId]) {
            if ((teamDayVenue.get(`${id}|${dk}|${cs.venueId}`) ?? 0) > 0) sc += 6
          }
          // Division continuity on the court
          const prev = courtPrevUnit.get(cs.courtId)
          if (prev && prev.unitKey === g.unitKey && prev.endMs === cs.startAt.getTime()) sc += 3
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
