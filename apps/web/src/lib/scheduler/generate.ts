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
        courts: Array<{ id: string }>
      }>
    }>
  }>
  /**
   * Optional per-session include list (sessionId → unit keys). A session with
   * an entry only hosts those units; sessions without an entry host any unit.
   * This is how the owner squeezes divisions into the sessions they fit in.
   */
  sessionUnitFilter?: Record<string, string[]>
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

  for (const s of input.sessions) {
    if (s.phase !== "REGULAR") continue
    for (const d of s.days) {
      for (const dv of d.dayVenues) {
        const open = parseHHMM(dv.startTime) ?? fallbackOpen
        const close = parseHHMM(dv.endTime) ?? fallbackClose
        const dayStart = atTimeOnDate(d.date, open)
        const dayEnd = atTimeOnDate(d.date, close)
        if (dayEnd <= dayStart) continue

        const windowMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000
        const slotsPerCourt = Math.floor(windowMinutes / input.gameSlotMinutes)

        for (const court of dv.courts) {
          for (let i = 0; i < slotsPerCourt; i++) {
            const startAt = new Date(dayStart.getTime() + i * input.gameSlotMinutes * 60000)
            const endAt = new Date(startAt.getTime() + input.gameSlotMinutes * 60000)
            slots.push({
              sessionId: s.id,
              dayId: d.id,
              dayVenueId: dv.id,
              courtId: court.id,
              venueId: dv.venueId,
              startAt,
              endAt,
            })
          }
        }
      }
    }
  }
  slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
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

function buildPairings(unit: SchedulerUnit, gamesGuaranteed: number): Pairing[] {
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
    const round = rounds[cycle % rounds.length]
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

  // Build all pairings across all units
  const pairingPool: Pairing[] = []
  for (const u of units) {
    if (!unitAllowedSomewhere(u.key)) {
      warnings.push(`${u.label}: not included in any session — no games scheduled.`)
      continue
    }
    pairingPool.push(...buildPairings(u, input.gamesGuaranteed))
  }

  // Scheduling state
  const teamGameCount: Record<string, number> = {}
  const teamBookings: Record<string, Array<{ start: Date; end: Date; dayId: string }>> = {}
  const courtBookings: Record<string, Array<{ start: Date; end: Date }>> = {}
  const playedPairCount: Record<string, number> = {}

  const games: ProposedGame[] = []
  // Remaining pairings: Map from pair key → array (ordered) of Pairing objects
  const remaining: Pairing[] = [...pairingPool]

  const teamIsBooked = (teamId: string, start: Date, end: Date): boolean => {
    const list = teamBookings[teamId] ?? []
    return list.some((b) => overlaps(b.start, b.end, start, end))
  }
  const courtIsBooked = (courtId: string, start: Date, end: Date): boolean => {
    const list = courtBookings[courtId] ?? []
    return list.some((b) => overlaps(b.start, b.end, start, end))
  }
  const teamGamesOnDay = (teamId: string, dayId: string): number => {
    return (teamBookings[teamId] ?? []).filter((b) => b.dayId === dayId).length
  }

  // Clustering state: keep similar games together (soft). Tracks which unit
  // played last on each court (by end time) and how many games each unit has
  // at each day-venue.
  const courtLastUnit: Record<string, { endMs: number; unitKey: string }> = {}
  const dayVenueUnitGames: Record<string, number> = {}

  const scoreCandidate = (
    pairing: Pairing,
    slot: SchedulerSlot
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

    let score = 0

    // Soft: prefer teams still under their gamesGuaranteed
    const homeCount = teamGameCount[homeTeamId] ?? 0
    const awayCount = teamGameCount[awayTeamId] ?? 0
    if (homeCount < input.gamesGuaranteed) score += 10
    if (awayCount < input.gamesGuaranteed) score += 10
    if (homeCount >= input.gamesGuaranteed) score -= 20
    if (awayCount >= input.gamesGuaranteed) score -= 20

    // Soft: respect idealGamesPerDayPerTeam
    const homeDayCount = teamGamesOnDay(homeTeamId, slot.dayId)
    const awayDayCount = teamGamesOnDay(awayTeamId, slot.dayId)
    if (homeDayCount >= input.idealGamesPerDayPerTeam) score -= 5
    if (awayDayCount >= input.idealGamesPerDayPerTeam) score -= 5

    // Soft: opponent diversity
    const pKey = pairKey(homeTeamId, awayTeamId)
    const timesPlayed = playedPairCount[pKey] ?? 0
    score -= timesPlayed * 3

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

  for (const slot of slots) {
    let bestIdx = -1
    let bestScore = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const cand = scoreCandidate(remaining[i], slot)
      if (cand.score > bestScore) {
        bestScore = cand.score
        bestIdx = i
      }
    }
    if (bestIdx === -1 || bestScore === -Infinity) continue

    const pairing = remaining.splice(bestIdx, 1)[0]
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
    const book = { start: slot.startAt, end: slot.endAt, dayId: slot.dayId }
    teamBookings[pairing.homeTeamId] = [...(teamBookings[pairing.homeTeamId] ?? []), book]
    teamBookings[pairing.awayTeamId] = [...(teamBookings[pairing.awayTeamId] ?? []), book]
    courtBookings[slot.courtId] = [
      ...(courtBookings[slot.courtId] ?? []),
      { start: slot.startAt, end: slot.endAt },
    ]
    const pk = pairKey(pairing.homeTeamId, pairing.awayTeamId)
    playedPairCount[pk] = (playedPairCount[pk] ?? 0) + 1
    courtLastUnit[slot.courtId] = { endMs: slot.endAt.getTime(), unitKey: pairing.unitKey }
    const dvKey = `${slot.dayVenueId}|${pairing.unitKey}`
    dayVenueUnitGames[dvKey] = (dayVenueUnitGames[dvKey] ?? 0) + 1
  }

  // Utilization
  const slotMinutes = input.gameSlotMinutes
  const courtMinutesAvailable = slots.length * slotMinutes
  const courtMinutesUsed = games.length * slotMinutes
  const slotsUsed = games.length

  // Warnings: teams under their guarantee
  for (const u of units) {
    for (const t of u.teams) {
      const count = teamGameCount[t.teamId] ?? 0
      if (count < input.gamesGuaranteed) {
        warnings.push(`${u.label}: ${t.name} has ${count} games (target ${input.gamesGuaranteed}).`)
      }
    }
  }

  return {
    games,
    unscheduled: remaining.map((p) => ({
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
