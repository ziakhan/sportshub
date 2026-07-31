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

  // Scheduling state
  const teamGameCount: Record<string, number> = {}
  const teamBookings: Record<string, Array<{ start: Date; end: Date; dateKey: string }>> = {}
  const dateKeyOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const courtBookings: Record<string, Array<{ start: Date; end: Date }>> = {}
  // Other leagues' games at shared venues occupy their courts outright.
  for (const b of input.busyCourtBookings ?? []) {
    courtBookings[b.courtId] = [
      ...(courtBookings[b.courtId] ?? []),
      { start: new Date(b.start), end: new Date(b.end) },
    ]
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
        courtBookings[g.courtId] = [...(courtBookings[g.courtId] ?? []), { start, end }]
      }
    }
    if (g.sessionId) {
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        const sk = sessionKey(g.sessionId, id)
        teamSessionCount[sk] = (teamSessionCount[sk] ?? 0) + 1
      }
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
      warnings.push(
        `${blocked} slot${blocked === 1 ? " is" : "s are"} already booked by other leagues at shared venues — scheduled around them.`
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
  const courtIsBooked = (courtId: string, start: Date, end: Date): boolean => {
    const list = courtBookings[courtId] ?? []
    return list.some((b) => overlaps(b.start, b.end, start, end))
  }
  const teamGamesOnDay = (teamId: string, day: Date): number => {
    const key = dateKeyOf(day)
    return (teamBookings[teamId] ?? []).filter((b) => b.dateKey === key).length
  }

  // Clustering state: keep similar games together (soft). Tracks which unit
  // played last on each court (by end time) and how many games each unit has
  // at each day-venue.
  const courtLastUnit: Record<string, { endMs: number; unitKey: string }> = {}
  const dayVenueUnitGames: Record<string, number> = {}

  const scoreCandidate = (
    pairing: Pairing,
    slot: SchedulerSlot,
    relaxDayCap = false
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
    if (courtIsBooked(slot.courtId, slot.startAt, slot.endAt))
      return { score: -Infinity, blockReason: "court busy" }

    // Hard (session-by-session): a team never exceeds this run's session
    // share — the rest of its season schedules with later sessions.
    if (sessionTeamCap !== null) {
      if ((teamGameCount[homeTeamId] ?? 0) >= sessionTeamCap)
        return { score: -Infinity, blockReason: "home team at session target" }
      if ((teamGameCount[awayTeamId] ?? 0) >= sessionTeamCap)
        return { score: -Infinity, blockReason: "away team at session target" }
    }

    // Hard (always): per-session share — spread across the season instead
    // of packing the earliest weekend.
    const capHere = perSessionCap.get(slot.sessionId)
    if (capHere !== undefined) {
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

    // Hard: never a rematch while a first meeting (or lower-cycle meeting)
    // in the same unit is still waiting to be placed.
    const unitMin = unitMinMeetings.get(pairing.unitKey)
    if (unitMin !== undefined && unitMin !== Infinity && timesPlayed > unitMin) {
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

    // Soft: cluster similar games — same unit back-to-back on a court, and
    // same unit gathered at the same venue that day. Preference only.
    const last = courtLastUnit[slot.courtId]
    if (last && last.endMs === slot.startAt.getTime() && last.unitKey === pairing.unitKey) {
      score += 4
    }
    if ((dayVenueUnitGames[`${slot.dayVenueId}|${pairing.unitKey}`] ?? 0) > 0) {
      score += 2
    }

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

    teamGameCount[pairing.homeTeamId] = (teamGameCount[pairing.homeTeamId] ?? 0) + 1
    teamGameCount[pairing.awayTeamId] = (teamGameCount[pairing.awayTeamId] ?? 0) + 1
    const book = { start: slot.startAt, end: slot.endAt, dateKey: dateKeyOf(slot.startAt) }
    teamBookings[pairing.homeTeamId] = [...(teamBookings[pairing.homeTeamId] ?? []), book]
    teamBookings[pairing.awayTeamId] = [...(teamBookings[pairing.awayTeamId] ?? []), book]
    courtBookings[slot.courtId] = [
      ...(courtBookings[slot.courtId] ?? []),
      { start: slot.startAt, end: slot.endAt },
    ]
    const pk = pairKey(pairing.homeTeamId, pairing.awayTeamId)
    playedPairCount[pk] = (playedPairCount[pk] ?? 0) + 1
    for (const id of [pairing.homeTeamId, pairing.awayTeamId]) {
      const sk = sessionKey(slot.sessionId, id)
      teamSessionCount[sk] = (teamSessionCount[sk] ?? 0) + 1
      timeLoadSum[id] = (timeLoadSum[id] ?? 0) + slotTimeRatio(slot)
      timeLoadCount[id] = (timeLoadCount[id] ?? 0) + 1
    }
    courtLastUnit[slot.courtId] = { endMs: slot.endAt.getTime(), unitKey: pairing.unitKey }
    const dvKey = `${slot.dayVenueId}|${pairing.unitKey}`
    dayVenueUnitGames[dvKey] = (dayVenueUnitGames[dvKey] ?? 0) + 1
    recomputeUnitMin(pairing.unitKey)
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
  for (const relax of [false, true]) {
    let moved = true
    while (moved) {
      moved = false
      for (const slot of slots) {
        if (courtIsBooked(slot.courtId, slot.startAt, slot.endAt)) continue
        let best: Pairing | null = null
        let bestScore = -Infinity
        for (const u of units) {
          for (let i = 0; i < u.teams.length; i++) {
            if (repairCount(u.teams[i].teamId) >= repairTarget) continue
            for (let j = i + 1; j < u.teams.length; j++) {
              if (repairCount(u.teams[j].teamId) >= repairTarget) continue
              const pairing: Pairing = {
                unitKey: u.key,
                homeTeamId: u.teams[i].teamId,
                awayTeamId: u.teams[j].teamId,
              }
              const cand = scoreCandidate(pairing, slot, relax)
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
          commitPlacement(slot, best)
          moved = true
        }
      }
    }
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

  return {
    games,
    unscheduled: failedToPlace.map((p) => ({
      unitKey: p.unitKey,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      reason: "no remaining slot satisfies hard constraints",
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
