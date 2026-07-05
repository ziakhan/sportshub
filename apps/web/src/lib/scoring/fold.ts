/**
 * Live-scoring fold engine (docs/live-scoring-design.md).
 *
 * Pure: fold an append-only GameEvent stream into everything the console and
 * the public live page display — score, box score, on-floor fives, team
 * fouls, foul-outs, period/clock state. Voided events are skipped, so undo
 * and corrections are recompute-by-construction. The server folds the same
 * stream on finalize to write Game scores + PlayerStat rows; the client and
 * the spectator page fold it locally.
 */

export type FoldEventType =
  | "SCORE_2PT"
  | "SCORE_3PT"
  | "SCORE_FT"
  | "REBOUND"
  | "ASSIST"
  | "STEAL"
  | "BLOCK"
  | "TURNOVER"
  | "FOUL"
  | "TIMEOUT"
  | "SUBSTITUTION"
  | "LINEUP"
  | "ATTENDANCE"
  | "PERIOD_START"
  | "PERIOD_END"
  | "CLOCK_START"
  | "CLOCK_STOP"

export interface FoldEvent {
  eventType: FoldEventType
  teamId?: string | null
  playerId?: string | null
  made?: boolean | null
  period?: number | null
  clockSeconds?: number | null
  voided?: boolean
  sequence: number
  /** Wall-clock ms — used for elapsed time while the clock runs. */
  timestampMs?: number
  metadata?: {
    inPlayerId?: string
    outPlayerId?: string
    playerIds?: string[]
    presentIds?: string[]
    absentIds?: string[]
    offensive?: boolean
    technical?: boolean
  } | null
}

export interface PlayerLine {
  playerId: string
  teamId: string
  points: number
  fgMade2: number
  fgMiss2: number
  fgMade3: number
  fgMiss3: number
  ftMade: number
  ftMiss: number
  offRebounds: number
  defRebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fouls: number
  technicalFouls: number
  secondsPlayed: number
  periodsPlayed: number
  onFloor: boolean
  fouledOut: boolean
}

export interface FoldResult {
  homeScore: number
  awayScore: number
  period: number
  periodOpen: boolean
  clockRunning: boolean
  /** Seconds remaining in the period at the last clock event (display base). */
  clockSecondsAtLastEvent: number | null
  onFloor: { home: string[]; away: string[] }
  /** Pre-game roll call per team — feeds DNP/absent on the sheet and season games-played. */
  attendance: Record<string, { present: string[]; absent: string[] }>
  teamFouls: Record<string, Record<number, number>> // teamId → period → fouls
  players: Record<string, PlayerLine>
  /** Non-voided events, in fold order (play-by-play). */
  playByPlay: FoldEvent[]
}

export const FOUL_LIMIT = 5

const SHOT_POINTS: Record<string, number> = {
  SCORE_2PT: 2,
  SCORE_3PT: 3,
  SCORE_FT: 1,
}

export function foldEvents(
  events: FoldEvent[],
  ctx: { homeTeamId: string; awayTeamId: string }
): FoldResult {
  const ordered = [...events]
    .filter((e) => !e.voided)
    .sort((a, b) => a.sequence - b.sequence)

  const players: Record<string, PlayerLine> = {}
  const onFloor: Record<string, Set<string>> = {
    [ctx.homeTeamId]: new Set(),
    [ctx.awayTeamId]: new Set(),
  }
  const teamFouls: Record<string, Record<number, number>> = {
    [ctx.homeTeamId]: {},
    [ctx.awayTeamId]: {},
  }
  const attendance: Record<string, { present: string[]; absent: string[] }> = {}
  const periodsSeen: Record<string, Set<number>> = {}

  let homeScore = 0
  let awayScore = 0
  let period = 1
  let periodOpen = false
  let clockRunning = false
  let clockSecondsAtLastEvent: number | null = null
  let clockRunSinceMs: number | null = null

  const line = (playerId: string, teamId: string): PlayerLine => {
    if (!players[playerId]) {
      players[playerId] = {
        playerId,
        teamId,
        points: 0,
        fgMade2: 0,
        fgMiss2: 0,
        fgMade3: 0,
        fgMiss3: 0,
        ftMade: 0,
        ftMiss: 0,
        offRebounds: 0,
        defRebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        technicalFouls: 0,
        secondsPlayed: 0,
        periodsPlayed: 0,
        onFloor: false,
        fouledOut: false,
      }
    }
    return players[playerId]
  }

  const creditFloorTime = (untilMs: number | undefined) => {
    if (clockRunSinceMs == null || untilMs == null) return
    const elapsed = Math.max(0, Math.round((untilMs - clockRunSinceMs) / 1000))
    if (elapsed === 0) return
    for (const teamId of [ctx.homeTeamId, ctx.awayTeamId]) {
      for (const pid of onFloor[teamId]) line(pid, teamId).secondsPlayed += elapsed
    }
    clockRunSinceMs = untilMs
  }

  const markPeriodPlayed = (playerId: string, teamId: string) => {
    const set = (periodsSeen[playerId] ??= new Set())
    if (!set.has(period)) {
      set.add(period)
      line(playerId, teamId).periodsPlayed += 1
    }
  }

  for (const e of ordered) {
    const teamId = e.teamId ?? null

    switch (e.eventType) {
      case "PERIOD_START": {
        period = e.period ?? period
        periodOpen = true
        // Everyone currently on the floor is playing this period
        for (const tid of [ctx.homeTeamId, ctx.awayTeamId]) {
          for (const pid of onFloor[tid]) markPeriodPlayed(pid, tid)
        }
        break
      }
      case "PERIOD_END": {
        creditFloorTime(e.timestampMs)
        clockRunning = false
        clockRunSinceMs = null
        periodOpen = false
        clockSecondsAtLastEvent = null
        break
      }
      case "CLOCK_START": {
        clockRunning = true
        clockRunSinceMs = e.timestampMs ?? null
        clockSecondsAtLastEvent = e.clockSeconds ?? clockSecondsAtLastEvent
        break
      }
      case "CLOCK_STOP": {
        creditFloorTime(e.timestampMs)
        clockRunning = false
        clockRunSinceMs = null
        clockSecondsAtLastEvent = e.clockSeconds ?? clockSecondsAtLastEvent
        break
      }
      case "ATTENDANCE": {
        if (!teamId) break
        attendance[teamId] = {
          present: e.metadata?.presentIds ?? [],
          absent: e.metadata?.absentIds ?? [],
        }
        break
      }
      case "LINEUP": {
        if (!teamId || !onFloor[teamId]) break
        creditFloorTime(e.timestampMs)
        onFloor[teamId] = new Set(e.metadata?.playerIds ?? [])
        for (const pid of onFloor[teamId]) {
          const l = line(pid, teamId)
          l.onFloor = true
          if (periodOpen) markPeriodPlayed(pid, teamId)
        }
        for (const l of Object.values(players)) {
          if (l.teamId === teamId) l.onFloor = onFloor[teamId].has(l.playerId)
        }
        break
      }
      case "SUBSTITUTION": {
        if (!teamId || !onFloor[teamId]) break
        creditFloorTime(e.timestampMs)
        const inId = e.metadata?.inPlayerId
        const outId = e.metadata?.outPlayerId
        if (outId) {
          onFloor[teamId].delete(outId)
          line(outId, teamId).onFloor = false
        }
        if (inId) {
          onFloor[teamId].add(inId)
          const l = line(inId, teamId)
          l.onFloor = true
          if (periodOpen) markPeriodPlayed(inId, teamId)
        }
        break
      }
      case "SCORE_2PT":
      case "SCORE_3PT":
      case "SCORE_FT": {
        if (!teamId) break
        const made = e.made !== false // default made for legacy events
        const pts = SHOT_POINTS[e.eventType]
        if (e.playerId) {
          const l = line(e.playerId, teamId)
          markPeriodPlayed(e.playerId, teamId)
          if (e.eventType === "SCORE_2PT") made ? l.fgMade2++ : l.fgMiss2++
          if (e.eventType === "SCORE_3PT") made ? l.fgMade3++ : l.fgMiss3++
          if (e.eventType === "SCORE_FT") made ? l.ftMade++ : l.ftMiss++
          if (made) l.points += pts
        }
        if (made) {
          if (teamId === ctx.homeTeamId) homeScore += pts
          if (teamId === ctx.awayTeamId) awayScore += pts
        }
        break
      }
      case "REBOUND": {
        if (!teamId || !e.playerId) break
        const l = line(e.playerId, teamId)
        markPeriodPlayed(e.playerId, teamId)
        e.metadata?.offensive ? l.offRebounds++ : l.defRebounds++
        break
      }
      case "ASSIST":
      case "STEAL":
      case "BLOCK":
      case "TURNOVER": {
        if (!teamId || !e.playerId) break
        const l = line(e.playerId, teamId)
        markPeriodPlayed(e.playerId, teamId)
        if (e.eventType === "ASSIST") l.assists++
        if (e.eventType === "STEAL") l.steals++
        if (e.eventType === "BLOCK") l.blocks++
        if (e.eventType === "TURNOVER") l.turnovers++
        break
      }
      case "FOUL": {
        if (!teamId) break
        teamFouls[teamId] ??= {}
        teamFouls[teamId][period] = (teamFouls[teamId][period] ?? 0) + 1
        if (e.playerId) {
          const l = line(e.playerId, teamId)
          markPeriodPlayed(e.playerId, teamId)
          // Technicals count toward the personal total (FIBA/youth style)
          // AND are tracked separately for display and two-tech ejections.
          l.fouls++
          if (e.metadata?.technical) l.technicalFouls++
          if (l.fouls >= FOUL_LIMIT || l.technicalFouls >= 2) l.fouledOut = true
        }
        break
      }
      case "TIMEOUT":
        break
    }
  }

  return {
    homeScore,
    awayScore,
    period,
    periodOpen,
    clockRunning,
    clockSecondsAtLastEvent,
    onFloor: {
      home: Array.from(onFloor[ctx.homeTeamId] ?? []),
      away: Array.from(onFloor[ctx.awayTeamId] ?? []),
    },
    attendance,
    teamFouls,
    players,
    playByPlay: ordered,
  }
}

/** Total rebounds helper for box-score rendering / PlayerStat rows. */
export function totalRebounds(l: PlayerLine): number {
  return l.offRebounds + l.defRebounds
}
