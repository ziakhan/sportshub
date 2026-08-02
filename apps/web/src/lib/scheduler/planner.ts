import { prisma } from "@youthbasketballhub/db"
import { buildSlots } from "./generate"
import { loadSchedulerInput } from "./load"

/**
 * Season planner (owner 2026-08-02: "build it — drag and drop, spread or
 * compact, suggestions for better"). Deterministic by ruling: the grade→
 * weekend problem is a small exact search (per month, a few thousand
 * assignments); no model call belongs in the solve path. Validated against
 * NPH's official 2026-27 calendar in scripts/analysis/validate-nph-calendar.ts.
 *
 * Units are GRADE clusters (divisions sharing ageGroup) because that's the
 * operator's mental object; applying a plan expands clusters back to the
 * engine's "division:<id>" keys on SeasonSession.unitKeys — the same column
 * the scheduler already reads. A weekend with no chips keeps unitKeys empty,
 * which the engine treats as open-to-any (existing semantic, unchanged).
 */

export * from "./planner-core"
import {
  planningSource,
  planningTeams,
  weekendDemand,
  weekendLabel,
  type PlannerState,
  type PlannerUnit,
  type PlannerWeekend,
  type PlannerWindow,
} from "./planner-core"

const monthKey = (iso: string): string => {
  const d = new Date(iso)
  return `${d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`
}

export async function buildPlannerState(seasonId: string): Promise<PlannerState> {
  const { input, errors } = await loadSchedulerInput(seasonId)
  if (!input) return { seasonId, units: [], windows: [], errors }

  const [divisions, sessions] = await Promise.all([
    (prisma as any).division.findMany({
      where: { seasonId },
      select: { id: true, name: true, ageGroup: true, expectedTeams: true },
      orderBy: { id: "asc" },
    }),
    (prisma as any).seasonSession.findMany({
      where: { seasonId },
      select: { id: true, unitKeys: true, targetGamesPerTeam: true },
      orderBy: { id: "asc" },
    }),
  ])

  // Grade clusters: divisions sharing ageGroup act as one draggable unit.
  const byAge = new Map<string, { divisionIds: string[]; approved: number; expected: number }>()
  for (const d of divisions) {
    const c = byAge.get(d.ageGroup) ?? { divisionIds: [], approved: 0, expected: 0 }
    c.divisionIds.push(d.id)
    c.expected += d.expectedTeams ?? 0
    const engineDiv = input.divisions.find((x) => x.id === d.id)
    c.approved += engineDiv?.teams.length ?? 0
    byAge.set(d.ageGroup, c)
  }
  const units: PlannerUnit[] = [...byAge.entries()]
    .map(([ageGroup, c]) => ({
      key: `age:${ageGroup}`,
      label: ageGroup,
      divisionIds: c.divisionIds,
      // The operator's number leads, and never plans for fewer teams than
      // have already registered (owner ruling 2026-08-02).
      teams: planningTeams(c.approved, c.expected),
      // Both halves ride along so the watch screen can draw registration
      // against the estimate without a second query. `teams` keeps its one
      // meaning: the number everything else plans on.
      approved: c.approved,
      expected: c.expected,
      source: planningSource(c.approved, c.expected),
    }))
    // Natural order (Grade 7 … Grade 12, then named groups) so the strip
    // reads the way an operator thinks.
    .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }))

  // Capacity per session from the same slot builder the engine uses.
  const slots = buildSlots(input)
  const bySession = new Map<string, Map<string, number>>()
  for (const s of slots) {
    const v = bySession.get(s.sessionId) ?? new Map<string, number>()
    v.set(s.venueId, (v.get(s.venueId) ?? 0) + 1)
    bySession.set(s.sessionId, v)
  }
  const venueIds = [...new Set(slots.map((s) => s.venueId))]
  const venueRows = venueIds.length
    ? await (prisma as any).venue.findMany({
        where: { id: { in: venueIds } },
        select: { id: true, name: true },
      })
    : []
  const venueName = new Map<string, string>(venueRows.map((v: any) => [v.id, v.name]))

  const sessionMeta = new Map<string, { unitKeys: string[]; target: number | null }>(
    sessions.map((s: any) => [s.id, { unitKeys: s.unitKeys ?? [], target: s.targetGamesPerTeam }])
  )
  const divisionAge = new Map<string, string>(divisions.map((d: any) => [d.id, d.ageGroup]))

  const weekends: PlannerWeekend[] = input.sessions
    .filter((s) => s.phase === "REGULAR" && s.days.length > 0)
    .map((s) => {
      const venueSlots = bySession.get(s.id) ?? new Map<string, number>()
      const venues = [...venueSlots.entries()].map(([venueId, capacityGames]) => ({
        venueId,
        name: venueName.get(venueId) ?? venueId,
        capacityGames,
      }))
      const meta = sessionMeta.get(s.id)
      // unitKeys hold "division:<id>" — fold back to grade clusters.
      const assigned = [
        ...new Set(
          (meta?.unitKeys ?? [])
            .map((k) => (k.startsWith("division:") ? divisionAge.get(k.slice(9)) : null))
            .filter(Boolean)
            .map((age) => `age:${age}`)
        ),
      ]
      return {
        sessionId: s.id,
        label: weekendLabel(s.days.map((d) => d.date)),
        dateISO: s.days[0].date,
        capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
        largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
        venues,
        targetGamesPerTeam: meta?.target ?? s.targetGamesPerTeam ?? 2,
        assigned,
      }
    })
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())

  const windowMap = new Map<string, PlannerWeekend[]>()
  for (const w of weekends) {
    const k = monthKey(w.dateISO)
    windowMap.set(k, [...(windowMap.get(k) ?? []), w])
  }
  const windows: PlannerWindow[] = [...windowMap.entries()].map(([label, wks]) => ({
    label,
    weekends: wks,
  }))

  // Games each team is promised for the SEASON. Not the sum of every
  // weekend's target: a grade plays one weekend per window, so that sum
  // counts weekends the grade never appears on. The league's guarantee is
  // the number; failing that, one appearance per window.
  const gamesPerTeam =
    input.gamesGuaranteed ||
    windows.reduce(
      (sum, w) => sum + Math.max(0, ...w.weekends.map((x) => x.targetGamesPerTeam)),
      0
    )

  return { seasonId, units, windows, errors, gamesPerTeam }
}

/** Persist an assignment: expand grade clusters to division keys on
 *  SeasonSession.unitKeys. Only sessions present in the payload change. */
export async function applyAssignment(
  seasonId: string,
  assignment: Record<string, string[]>
): Promise<{ updated: number }> {
  const divisions = await (prisma as any).division.findMany({
    where: { seasonId },
    select: { id: true, ageGroup: true },
  })
  const byAge = new Map<string, string[]>()
  for (const d of divisions) byAge.set(d.ageGroup, [...(byAge.get(d.ageGroup) ?? []), d.id])

  const sessions = await (prisma as any).seasonSession.findMany({
    where: { seasonId },
    select: { id: true },
  })
  const valid = new Set(sessions.map((s: any) => s.id))

  let updated = 0
  for (const [sessionId, unitKeys] of Object.entries(assignment)) {
    if (!valid.has(sessionId)) continue
    const divisionKeys = unitKeys.flatMap((k) =>
      k.startsWith("age:") ? (byAge.get(k.slice(4)) ?? []).map((id) => `division:${id}`) : [k]
    )
    await (prisma as any).seasonSession.update({
      where: { id: sessionId },
      data: { unitKeys: divisionKeys },
    })
    updated++
  }
  return { updated }
}
