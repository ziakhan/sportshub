import {
  buildSlots,
  generateSchedule,
  type ProposedGame,
  type SchedulerInput,
  type SchedulerResult,
} from "./generate"

/**
 * Venue distribution (owner 2026-08-01: "certain grades only play in
 * certain venues… maximizing all the venues, so they don't have to travel
 * as much"). Assign each DIVISION a home venue for the season — largest
 * demand to largest capacity, ~15% slack so 100% packing never forces
 * back-to-backs — then run the engine ONCE PER VENUE GROUP (a group's
 * input holds only that venue's courts and its assigned divisions) and
 * merge. Groups share no courts, so the runs are independent and the
 * merged schedule can never double-book.
 */

export interface VenueGroupPlan {
  venueIds: string[]
  venueLabel: string
  divisionIds: string[]
  divisionNames: string[]
  demandSlots: number
  capacitySlots: number
}

export interface DistributionPlan {
  groups: VenueGroupPlan[]
  /** divisionId → venueIds it may use (the descriptor for preview/commit). */
  divisionVenueMap: Record<string, string[]>
  summary: string[]
}

const SLACK = 1.15

/** Weekend-share demand of a division across the season, in games. */
function divisionDemand(input: SchedulerInput, divisionId: string): number {
  const division = input.divisions.find((d) => d.id === divisionId)
  if (!division || division.teams.length < 2) return 0
  return Math.ceil((division.teams.length * input.gamesGuaranteed) / 2)
}

/** Court-slot capacity of a venue across the season's sessions. */
function venueCapacity(input: SchedulerInput, venueId: string): number {
  let slots = 0
  for (const slot of buildSlots(input)) {
    if (slot.venueId === venueId) slots++
  }
  return slots
}

export function planVenueDistribution(
  input: SchedulerInput,
  venueNames: Map<string, string>
): DistributionPlan | null {
  const venueIds = [
    ...new Set(
      input.sessions.flatMap((s) =>
        s.days.flatMap((d) => d.dayVenues.map((dv) => dv.venueId))
      )
    ),
  ]
  if (venueIds.length < 2) return null // nothing to distribute

  const venues = venueIds
    .map((id) => ({ id, capacity: venueCapacity(input, id) }))
    .filter((v) => v.capacity > 0)
    .sort((a, b) => b.capacity - a.capacity)
  const divisions = input.divisions
    .map((d) => ({ id: d.id, name: d.name, demand: divisionDemand(input, d.id) }))
    .filter((d) => d.demand > 0)
    .sort((a, b) => b.demand - a.demand)
  if (venues.length < 2 || divisions.length < 2) return null

  // Best-fit by resulting load ratio, capped at capacity/SLACK per venue —
  // plain first-fit packed the big gym to 99% and forced back-to-backs.
  // A division that fits nowhere under the cap joins the venue with the
  // most remaining room (the group run reports honestly).
  const used = new Map(venues.map((v) => [v.id, 0]))
  const assignment = new Map<string, string>() // divisionId → venueId
  for (const d of divisions) {
    const candidates = venues.filter(
      (v) => (used.get(v.id) ?? 0) + d.demand <= v.capacity / SLACK
    )
    const fit =
      candidates.sort(
        (a, b) =>
          ((used.get(a.id) ?? 0) + d.demand) / a.capacity -
          ((used.get(b.id) ?? 0) + d.demand) / b.capacity
      )[0] ??
      venues.reduce((best, v) =>
        v.capacity - (used.get(v.id) ?? 0) > best.capacity - (used.get(best.id) ?? 0) ? v : best
      )
    assignment.set(d.id, fit.id)
    used.set(fit.id, (used.get(fit.id) ?? 0) + d.demand)
  }

  const groups: VenueGroupPlan[] = []
  for (const v of venues) {
    const divs = divisions.filter((d) => assignment.get(d.id) === v.id)
    if (divs.length === 0) continue
    groups.push({
      venueIds: [v.id],
      venueLabel: venueNames.get(v.id) ?? v.id,
      divisionIds: divs.map((d) => d.id),
      divisionNames: divs.map((d) => d.name),
      demandSlots: divs.reduce((s, d) => s + d.demand, 0),
      capacitySlots: v.capacity,
    })
  }
  if (groups.length < 2) return null

  const shortNames = (names: string[]): string => {
    const grades = [
      ...new Set(names.map((n) => n.replace(/ Boys| Girls| ·.*$/g, "").trim())),
    ]
    return grades.slice(0, 4).join(", ") + (grades.length > 4 ? "…" : "")
  }
  const summary = groups.map(
    (g) =>
      `${shortNames(g.divisionNames)} at ${g.venueLabel} (${g.demandSlots} of ${g.capacitySlots} slots)`
  )
  return {
    groups,
    divisionVenueMap: Object.fromEntries(
      [...assignment.entries()].map(([divId, venueId]) => [divId, [venueId]])
    ),
    summary,
  }
}

/** Restrict an input to one venue group: only its venues' day-courts and
 *  only its divisions (other divisions' games belong to other groups). */
export function groupInput(
  input: SchedulerInput,
  venueIds: string[],
  divisionIds: string[]
): SchedulerInput {
  const venueSet = new Set(venueIds)
  const divSet = new Set(divisionIds)
  return {
    ...input,
    divisions: input.divisions.filter((d) => divSet.has(d.id)),
    schedulingGroups: input.schedulingGroups.filter((g) =>
      g.divisionIds.some((id) => divSet.has(id))
    ),
    sessions: input.sessions.map((s) => ({
      ...s,
      days: s.days.map((d) => ({
        ...d,
        dayVenues: d.dayVenues.filter((dv) => venueSet.has(dv.venueId)),
      })),
    })),
  }
}

export interface DistributedResult {
  games: ProposedGame[]
  unscheduled: SchedulerResult["unscheduled"]
  warnings: string[]
  tradeoffs: string[]
}

/** Apply a division→venues map: run the engine per venue group and merge. */
export function runDistributed(
  input: SchedulerInput,
  divisionVenueMap: Record<string, string[]>
): DistributedResult {
  // Group divisions that share the same venue set.
  const byKey = new Map<string, { venueIds: string[]; divisionIds: string[] }>()
  for (const [divId, venueIds] of Object.entries(divisionVenueMap)) {
    const key = [...venueIds].sort().join("|")
    if (!byKey.has(key)) byKey.set(key, { venueIds, divisionIds: [] })
    byKey.get(key)!.divisionIds.push(divId)
  }
  // Divisions absent from the map keep every venue NOT claimed exclusively.
  const mapped = new Set(Object.keys(divisionVenueMap))
  const unmappedDivs = input.divisions.filter((d) => !mapped.has(d.id)).map((d) => d.id)
  if (unmappedDivs.length > 0) {
    const claimed = new Set(Object.values(divisionVenueMap).flat())
    const allVenues = [
      ...new Set(
        input.sessions.flatMap((s) => s.days.flatMap((d) => d.dayVenues.map((dv) => dv.venueId)))
      ),
    ]
    const free = allVenues.filter((v) => !claimed.has(v))
    byKey.set("__rest__", {
      venueIds: free.length > 0 ? free : allVenues,
      divisionIds: unmappedDivs,
    })
  }

  const merged: DistributedResult = { games: [], unscheduled: [], warnings: [], tradeoffs: [] }
  for (const { venueIds, divisionIds } of byKey.values()) {
    const sub = groupInput(input, venueIds, divisionIds)
    if (sub.divisions.length === 0) continue
    const r = generateSchedule(sub)
    merged.games.push(...r.games)
    merged.unscheduled.push(...r.unscheduled)
    merged.warnings.push(...r.warnings)
    merged.tradeoffs.push(...r.tradeoffs)
  }
  return merged
}
