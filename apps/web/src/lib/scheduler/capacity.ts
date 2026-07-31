import {
  buildSlots,
  buildUnits,
  type SchedulerInput,
  type SchedulerUnit,
} from "./generate"

/**
 * Session capacity report — the owner-facing "what can be squeezed in"
 * math, pure and cheap (no generator run). The session is the granularity:
 * whatever mix of days it contains (Fri evenings, Sat+Sun, weeknights) pools
 * into one slot supply, compared against the games each division/group needs.
 *
 * Demand per unit per session:
 *   gamesPerTeam = session.targetGamesPerTeam
 *                  ?? ceil(gamesGuaranteed / #REGULAR sessions)
 *   gamesNeeded  = ceil(teams × gamesPerTeam / 2)
 */

export interface UnitDemand {
  unitKey: string
  label: string
  teams: number
  gamesNeeded: number
}

export interface SessionCapacityReport {
  sessionId: string
  label: string | null
  days: number
  courts: number
  slotsTotal: number
  /** Slots lost to OTHER leagues' games at shared venues (already excluded
   *  from slotsTotal) — surfaced so the operator knows why supply shrank. */
  blockedByOthers: number
  gamesPerTeam: number
  units: UnitDemand[]
  /** Total demand if EVERY unit is scheduled in this session. */
  gamesNeededAll: number
  /** slotsTotal − gamesNeededAll: positive = spare room, negative = shortfall. */
  surplusSlots: number
  /** How many teams this session's supply could carry at gamesPerTeam each. */
  maxTeamsSupportable: number
}

export function computeSessionCapacity(input: SchedulerInput): SessionCapacityReport[] {
  const slots = buildSlots(input)
  const units = buildUnits(input)
  const regular = input.sessions.filter((s) => s.phase === "REGULAR")
  const fallbackPerTeam =
    regular.length > 0 ? Math.ceil(input.gamesGuaranteed / regular.length) : input.gamesGuaranteed

  const busy = (input.busyCourtBookings ?? []).map((b) => ({
    courtId: b.courtId,
    start: new Date(b.start),
    end: new Date(b.end),
  }))
  const isBlocked = (slot: { courtId: string; startAt: Date; endAt: Date }) =>
    busy.some(
      (b) => b.courtId === slot.courtId && b.start < slot.endAt && slot.startAt < b.end
    )

  return regular.map((s) => {
    const allSessionSlots = slots.filter((slot) => slot.sessionId === s.id)
    const sessionSlots = allSessionSlots.filter((slot) => !isBlocked(slot))
    const blockedByOthers = allSessionSlots.length - sessionSlots.length
    const gamesPerTeam = s.targetGamesPerTeam ?? fallbackPerTeam
    const unitDemands: UnitDemand[] = units.map((u: SchedulerUnit) => ({
      unitKey: u.key,
      label: u.label,
      teams: u.teams.length,
      gamesNeeded: Math.ceil((u.teams.length * gamesPerTeam) / 2),
    }))
    const gamesNeededAll = unitDemands.reduce((sum, u) => sum + u.gamesNeeded, 0)
    const courtIds = new Set(sessionSlots.map((slot) => slot.courtId))

    return {
      sessionId: s.id,
      label: s.label ?? null,
      days: s.days.length,
      courts: courtIds.size,
      slotsTotal: sessionSlots.length,
      blockedByOthers,
      gamesPerTeam,
      units: unitDemands,
      gamesNeededAll,
      surplusSlots: sessionSlots.length - gamesNeededAll,
      maxTeamsSupportable:
        gamesPerTeam > 0 ? Math.floor((sessionSlots.length * 2) / gamesPerTeam) : 0,
    }
  })
}
