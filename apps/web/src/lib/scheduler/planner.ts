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
  currentAssignment,
  orderedVenues,
  packWeekendVenues,
  planningTeams,
  shiftClock,
  weekendDemand,
  weekendLabel,
  type HoursPreview,
  type HoursPreviewWeekend,
  type PlannerGym,
  type PlannerState,
  type PlannerUnit,
  type PlannerWeekend,
  type PlannerWindow,
  type VenueRole,
} from "./planner-core"
import type { SchedulerInput } from "./generate"

const monthKey = (iso: string): string => {
  const d = new Date(iso)
  return `${d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`
}

/**
 * A day that opens earlier, or closes earlier, than the season has it saved
 * (owner 2026-08-02: "start early / start late / early finish"). Minutes,
 * signed: -60 on `startMinutes` opens the gyms an hour sooner.
 */
export interface HoursShift {
  startMinutes: number
  endMinutes: number
}

/**
 * Move every day-venue window of a loaded input, IN MEMORY ONLY. Nothing here
 * touches the database: this is what lets an operator see what an extra hour
 * would do before deciding to book it.
 *
 * A day-venue with no window of its own inherits the season default first, so
 * a shifted day is a real clock time rather than a shift of nothing.
 */
function shiftInputWindows(input: SchedulerInput, shift: HoursShift): void {
  if (shift.startMinutes === 0 && shift.endMinutes === 0) return
  for (const session of input.sessions) {
    for (const day of session.days) {
      for (const dv of day.dayVenues) {
        const open = dv.startTime ?? input.defaultVenueOpenTime
        const close = dv.endTime ?? input.defaultVenueCloseTime
        dv.startTime = shiftClock(open, shift.startMinutes)
        dv.endTime = shiftClock(close, shift.endMinutes)
      }
    }
  }
}

/**
 * The board's whole world. `hoursShift` rebuilds it on a day window that is
 * not the saved one — a preview, never a write (see shiftInputWindows).
 */
export async function buildPlannerState(
  seasonId: string,
  hoursShift?: HoursShift
): Promise<PlannerState> {
  const { input, errors } = await loadSchedulerInput(seasonId)
  if (!input) return { seasonId, units: [], windows: [], errors }
  if (hoursShift) shiftInputWindows(input, hoursShift)

  const [divisions, sessions, seasonVenues] = await Promise.all([
    (prisma as any).division.findMany({
      where: { seasonId },
      select: {
        id: true,
        name: true,
        ageGroup: true,
        expectedTeams: true,
        alternateVenues: true,
      },
      orderBy: { id: "asc" },
    }),
    (prisma as any).seasonSession.findMany({
      where: { seasonId },
      select: {
        id: true,
        unitKeys: true,
        unitVenues: true,
        targetGamesPerTeam: true,
        round: { select: { ordinal: true, label: true } },
      },
      orderBy: { id: "asc" },
    }),
    // What each gym IS to the league (owner ruling 2026-08-03): the home
    // building it owns, or one of the pool it rents. fillOrder rides along
    // dead, only so a plan snapshot keeps round-tripping.
    //
    // The whole roster, not just the attached gyms (owner ruling 2026-08-05): a
    // plan's world starts from the gyms the league HAS, and a gym nobody has
    // phoned about any Saturday is still one of them.
    (prisma as any).seasonVenue.findMany({
      where: { seasonId },
      select: {
        id: true,
        venueId: true,
        role: true,
        fillOrder: true,
        courtsAvailable: true,
        // courtList is the real court set; Venue.courts is a legacy count.
        venue: { select: { name: true, city: true, _count: { select: { courtList: true } } } },
        hours: { select: { dayOfWeek: true, openTime: true, closeTime: true } },
      },
      orderBy: [{ venueId: "asc" }],
    }),
  ])

  const roleOf = new Map<string, VenueRole>()
  const fillOrderOf = new Map<string, number>()
  seasonVenues.forEach((sv: any, i: number) => {
    roleOf.set(sv.venueId, sv.role === "home" ? "home" : "pool")
    fillOrderOf.set(sv.venueId, sv.fillOrder ?? 1000 + i)
  })

  /**
   * THE SEASON'S GYM ROSTER, with the two facts capacity is made of: how many
   * courts and when. Hours are the weekend range this season runs at that gym
   * (Saturday's, falling back to Sunday's, then the season default) — the same
   * one-range-per-gym model step 2 edits. A plan copies this and then owns it.
   */
  const gyms: PlannerGym[] = seasonVenues.map((sv: any) => {
    const byDow = new Map<number, any>((sv.hours ?? []).map((h: any) => [h.dayOfWeek, h]))
    const weekend = byDow.get(6) ?? byDow.get(0) ?? null
    return {
      venueId: sv.venueId,
      name: sv.venue?.name ?? sv.venueId,
      city: sv.venue?.city ?? null,
      role: roleOf.get(sv.venueId) ?? "pool",
      courts: sv.courtsAvailable ?? sv.venue?._count?.courtList ?? 0,
      openTime: weekend?.openTime ?? input.defaultVenueOpenTime ?? null,
      closeTime: weekend?.closeTime ?? input.defaultVenueCloseTime ?? null,
      seasonVenueId: sv.id,
    }
  })

  // Grade clusters: divisions sharing ageGroup act as one draggable unit.
  const byAge = new Map<
    string,
    { divisionIds: string[]; approved: number; expected: number; estimated: boolean; alternate: boolean }
  >()
  for (const d of divisions) {
    const c = byAge.get(d.ageGroup) ?? {
      divisionIds: [],
      approved: 0,
      expected: 0,
      estimated: false,
      alternate: false,
    }
    c.divisionIds.push(d.id)
    c.expected += d.expectedTeams ?? 0
    // Null is "never estimated"; a saved zero is an ANSWER ("this grade runs
    // no teams"). Losing that distinction is how a deliberate 0 on step 1
    // bounced back to the registration count.
    c.estimated = c.estimated || d.expectedTeams !== null
    // The cluster is one draggable thing, so one division asking to move
    // buildings makes the whole grade alternate.
    c.alternate = c.alternate || Boolean(d.alternateVenues)
    const engineDiv = input.divisions.find((x) => x.id === d.id)
    c.approved += engineDiv?.teams.length ?? 0
    byAge.set(d.ageGroup, c)
  }
  const units: PlannerUnit[] = [...byAge.entries()]
    .map(([ageGroup, c]) => ({
      key: `age:${ageGroup}`,
      label: ageGroup,
      divisionIds: c.divisionIds,
      alternate: c.alternate,
      // The plan runs on the operator's estimate alone (owner ruling
      // 2026-08-02): planning does not look at the real teams until real
      // scheduling. Registration below the estimate is fine; over it is a
      // warning on screen, not a bigger plan.
      teams: planningTeams(c.approved, c.expected),
      // Both halves ride along so the watch screen can draw registration
      // against the estimate without a second query. `teams` keeps its one
      // meaning: the number everything else plans on.
      approved: c.approved,
      expected: c.expected,
      // "expected" the moment any division holds a saved number, zero included.
      source: (c.estimated ? "expected" : "none") as "expected" | "none",
    }))
    // Natural order (Grade 7 … Grade 12, then named groups) so the strip
    // reads the way an operator thinks.
    .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }))

  // Capacity per session from the same slot builder the engine uses.
  const slots = buildSlots(input)
  const bySession = new Map<string, Map<string, number>>()
  // How many (day × court) pairs stand behind that capacity, so a capacity
  // change can be read back as games per court per day — and, since the
  // 2026-08-03 venue ruling, so a rental can be quoted in the two numbers a
  // gym actually asks for: how many COURTS, for how many DAYS.
  const courtDaysBySession = new Map<string, Map<string, Set<string>>>()
  const courtsBySession = new Map<string, Map<string, Set<string>>>()
  const daysBySession = new Map<string, Map<string, Set<string>>>()
  const track = (
    into: Map<string, Map<string, Set<string>>>,
    sessionId: string,
    venueId: string,
    value: string
  ) => {
    const per = into.get(sessionId) ?? new Map<string, Set<string>>()
    const seen = per.get(venueId) ?? new Set<string>()
    seen.add(value)
    per.set(venueId, seen)
    into.set(sessionId, per)
  }
  for (const s of slots) {
    const v = bySession.get(s.sessionId) ?? new Map<string, number>()
    v.set(s.venueId, (v.get(s.venueId) ?? 0) + 1)
    bySession.set(s.sessionId, v)
    track(courtDaysBySession, s.sessionId, s.venueId, `${s.dayId}|${s.courtId}`)
    track(courtsBySession, s.sessionId, s.venueId, s.courtId)
    track(daysBySession, s.sessionId, s.venueId, s.dayId)
  }
  // Courts WIRED at each gym each weekend, before the buffer holds any back.
  // The difference between this and the courts behind the slots is the number
  // the meters name out loud: "1 court held back".
  const wiredBySession = new Map<string, Map<string, Set<string>>>()
  for (const s of input.sessions) {
    for (const d of s.days) {
      for (const dv of d.dayVenues) {
        for (const c of dv.courts) track(wiredBySession, s.id, dv.venueId, c.id)
      }
    }
  }
  const venueIds = [...new Set(slots.map((s) => s.venueId))]
  const venueRows = venueIds.length
    ? await (prisma as any).venue.findMany({
        where: { id: { in: venueIds } },
        select: { id: true, name: true },
      })
    : []
  const venueName = new Map<string, string>(venueRows.map((v: any) => [v.id, v.name]))

  const sessionMeta = new Map<
    string,
    {
      unitKeys: string[]
      unitVenues: Record<string, string>
      target: number | null
      roundName: string | null
    }
  >(
    sessions.map((s: any) => [
      s.id,
      {
        // The ROUND this weekend materializes, in the words the league uses
        // (owner 2026-08-07): its label, else the derived "Session N".
        roundName: s.round ? (s.round.label ?? `Session ${s.round.ordinal}`) : null,
        unitKeys: s.unitKeys ?? [],
        unitVenues:
          s.unitVenues && typeof s.unitVenues === "object" && !Array.isArray(s.unitVenues)
            ? (s.unitVenues as Record<string, string>)
            : {},
        target: s.targetGamesPerTeam,
      },
    ])
  )
  const divisionAge = new Map<string, string>(divisions.map((d: any) => [d.id, d.ageGroup]))

  const weekends: PlannerWeekend[] = input.sessions
    .filter((s) => s.phase === "REGULAR" && s.days.length > 0)
    .map((s) => {
      const venueSlots = bySession.get(s.id) ?? new Map<string, number>()
      const courtDaysHere = courtDaysBySession.get(s.id)
      const courtsHere = courtsBySession.get(s.id)
      const daysHere = daysBySession.get(s.id)
      const wiredHere = wiredBySession.get(s.id)
      const venues = orderedVenues(
        [...venueSlots.entries()].map(([venueId, capacityGames]) => {
          const courtDays = courtDaysHere?.get(venueId)?.size ?? 0
          const courts = courtsHere?.get(venueId)?.size ?? 0
          return {
            venueId,
            name: venueName.get(venueId) ?? venueId,
            capacityGames,
            role: roleOf.get(venueId) ?? "pool",
            fillOrder: fillOrderOf.get(venueId) ?? 1000,
            courtDays,
            courts,
            // What the buffer is holding here, so the caption can say it.
            courtsHeld: Math.max(0, (wiredHere?.get(venueId)?.size ?? courts) - courts),
            days: daysHere?.get(venueId)?.size ?? 0,
            // What one court is open for, per day, in hours: the games it
            // holds times the slot length. This is what turns a court-day
            // into the number a gym manager quotes on.
            hoursPerCourtDay:
              courtDays > 0 ? (capacityGames / courtDays) * (input.gameSlotMinutes / 60) : 0,
          }
        })
      )
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
      // Same fold for the saved buildings. Divisions of one grade should all
      // name the same gym (that is how the planner writes them); if they ever
      // disagree, the first key wins rather than the board showing two gyms
      // for one chip.
      const assignedVenues: Record<string, string> = {}
      const savedVenues = Object.entries(meta?.unitVenues ?? {}).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
      )
      for (const [key, venueId] of savedVenues) {
        if (!key.startsWith("division:") || typeof venueId !== "string") continue
        const age = divisionAge.get(key.slice(9))
        if (!age) continue
        const unitKey = `age:${age}`
        if (assignedVenues[unitKey] === undefined) assignedVenues[unitKey] = venueId
      }
      return {
        sessionId: s.id,
        label: weekendLabel(s.days.map((d) => d.date)),
        dateISO: s.days[0].date,
        dayCount: s.days.length,
        // Every weekend the SEASON has is a weekend it runs. Choosing weekends
        // is a plan's decision (planStateFrom), never the season's own state.
        chosen: true,
        capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
        largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
        venues,
        targetGamesPerTeam: meta?.target ?? s.targetGamesPerTeam ?? 2,
        ...(meta?.roundName ? { roundName: meta.roundName } : {}),
        assigned,
        assignedVenues,
      }
    })
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())

  const windowMap = new Map<string, PlannerWeekend[]>()
  for (const w of weekends) {
    const k = monthKey(w.dateISO)
    windowMap.set(k, [...(windowMap.get(k) ?? []), w])
  }
  const windows: PlannerWindow[] = [...windowMap.entries()].map(([label, wks]) => {
    // When every weekend of the month materializes ONE round, the column can
    // wear the round's announced name instead of a derived ordinal.
    const names = [...new Set(wks.map((w) => w.roundName).filter(Boolean))]
    return {
      label,
      weekends: wks,
      ...(names.length === 1 && wks.every((w) => w.roundName) ? { roundName: names[0] as string } : {}),
    }
  })

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

  return {
    seasonId,
    units,
    windows,
    errors,
    gamesPerTeam,
    // The two numbers capacity is derived from, so a plan's own world can move
    // its gyms and its hours without asking the season to rebuild anything.
    courtBuffer: input.courtBuffer ?? 0,
    gameSlotMinutes: input.gameSlotMinutes,
    fridayStart: input.fridayStartTime ?? undefined,
    fridayEnd: input.fridayEndTime ?? undefined,
    gyms,
  }
}

/* ------------------------- what an hour would do ------------------------- */

/** The grades a weekend holds, deduped, in the order given. */
function weekendUnits(units: PlannerUnit[], assigned: string[]): PlannerUnit[] {
  const seen = new Set<string>()
  const out: PlannerUnit[] = []
  for (const key of assigned) {
    if (seen.has(key)) continue
    seen.add(key)
    const u = units.find((x) => x.key === key)
    if (u) out.push(u)
  }
  return out
}

/** Games one court holds per day at a gym this weekend, as a plain average
 *  over its court-days. Null when the weekend never opened that gym. */
function perCourtDay(venue: { capacityGames: number; courtDays?: number } | undefined): number | null {
  if (!venue || !venue.courtDays) return null
  return venue.capacityGames / venue.courtDays
}

/**
 * What moving the day window would do to THIS plan, before anybody books it
 * (owner 2026-08-02: "start early / start late / early finish"). Reads the
 * season twice — once as saved, once on the shifted window — and reports the
 * same two facts the board paints in: does a weekend run short, and does it
 * need a second building.
 *
 * NOTHING IS WRITTEN. The shift lives in memory for the length of the request;
 * the hours only change if the operator presses Apply, which goes through the
 * ordinary season-venue hours route.
 *
 * `assignment` is the calendar on screen, which may be an unsaved proposal.
 * Left out, the saved calendar is what gets measured.
 */
export async function planHoursPreview(
  seasonId: string,
  shift: HoursShift,
  assignment?: Record<string, string[]>
): Promise<HoursPreview> {
  const [before, after] = await Promise.all([
    buildPlannerState(seasonId),
    buildPlannerState(seasonId, shift),
  ])
  const plan = assignment ?? currentAssignment(before)

  const afterWeekends = new Map<string, PlannerWeekend>()
  for (const win of after.windows) for (const w of win.weekends) afterWeekends.set(w.sessionId, w)

  const weekends: HoursPreviewWeekend[] = []
  const cleared: string[] = []
  const broke: string[] = []
  const oneGymNow: string[] = []
  const twoGymNow: string[] = []
  const totals = {
    capacityBefore: 0,
    capacityAfter: 0,
    overflowBefore: 0,
    overflowAfter: 0,
    twoBuildingBefore: 0,
    twoBuildingAfter: 0,
  }
  /** Every distinct games-per-court-per-day move the season makes. One entry
   *  means the whole season moved the same way, which is the sentence. */
  const courtDayMoves = new Set<number>()

  for (const win of before.windows) {
    for (const w of win.weekends) {
      const next = afterWeekends.get(w.sessionId)
      const assigned = plan[w.sessionId] ?? []
      const here = weekendUnits(before.units, assigned)
      const emptyWeekend: Pick<PlannerWeekend, "targetGamesPerTeam" | "venues"> = {
        targetGamesPerTeam: w.targetGamesPerTeam,
        venues: [],
      }
      const packBefore = packWeekendVenues(here, w, w.assignedVenues ?? {})
      const packAfter = packWeekendVenues(here, next ?? emptyWeekend, w.assignedVenues ?? {})

      const row: HoursPreviewWeekend = {
        sessionId: w.sessionId,
        label: w.label,
        capacityBefore: w.capacityGames,
        capacityAfter: next?.capacityGames ?? 0,
        demand: weekendDemand(before.units, w, assigned),
        overflowBefore: packBefore.overflow,
        overflowAfter: packAfter.overflow,
        buildingsBefore: packBefore.opened.length,
        buildingsAfter: packAfter.opened.length,
      }
      weekends.push(row)

      totals.capacityBefore += row.capacityBefore
      totals.capacityAfter += row.capacityAfter
      totals.overflowBefore += row.overflowBefore
      totals.overflowAfter += row.overflowAfter
      if (row.buildingsBefore > 1) totals.twoBuildingBefore++
      if (row.buildingsAfter > 1) totals.twoBuildingAfter++
      if (row.overflowBefore > 0 && row.overflowAfter === 0) cleared.push(w.label)
      if (row.overflowBefore === 0 && row.overflowAfter > 0) broke.push(w.label)
      if (row.buildingsBefore > 1 && row.buildingsAfter === 1) oneGymNow.push(w.label)
      if (row.buildingsBefore === 1 && row.buildingsAfter > 1) twoGymNow.push(w.label)

      for (const venue of w.venues) {
        const was = perCourtDay(venue)
        const now = perCourtDay(next?.venues.find((v) => v.venueId === venue.venueId))
        if (was === null) continue
        courtDayMoves.add((now ?? 0) - was)
      }
    }
  }

  const moves = [...courtDayMoves]
  const perCourtDayDelta =
    moves.length === 1 && Number.isInteger(moves[0]) ? moves[0] : moves.length === 0 ? 0 : null

  return {
    deltaStartMinutes: shift.startMinutes,
    deltaEndMinutes: shift.endMinutes,
    perCourtDayDelta,
    weekends,
    totals,
    cleared,
    broke,
    oneGymNow,
    twoGymNow,
  }
}

/**
 * Persist an assignment: expand grade clusters to division keys on
 * SeasonSession.unitKeys. Only sessions present in the payload change.
 *
 * `venues` carries the building each grade plays in that weekend (from
 * packPlanVenues). A session in the assignment with nothing in `venues` has
 * its unitVenues cleared: re-applying a plan that says nothing about gyms
 * must not leave last plan's gym claims standing.
 */
export async function applyAssignment(
  seasonId: string,
  assignment: Record<string, string[]>,
  venues?: Record<string, Record<string, string>>
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

  const expand = (key: string): string[] =>
    key.startsWith("age:") ? (byAge.get(key.slice(4)) ?? []).map((id) => `division:${id}`) : [key]

  let updated = 0
  for (const [sessionId, unitKeys] of Object.entries(assignment)) {
    if (!valid.has(sessionId)) continue
    const divisionKeys = unitKeys.flatMap(expand)
    const playing = new Set(divisionKeys)

    // Grades expand the same way here as above, so a gym claim always lands
    // on a division key the weekend actually plays. Anything else is stale.
    const unitVenues: Record<string, string> = {}
    for (const [key, venueId] of Object.entries(venues?.[sessionId] ?? {})) {
      if (typeof venueId !== "string" || venueId.length === 0) continue
      for (const divisionKey of expand(key)) {
        if (playing.has(divisionKey)) unitVenues[divisionKey] = venueId
      }
    }

    await (prisma as any).seasonSession.update({
      where: { id: sessionId },
      data: {
        unitKeys: divisionKeys,
        // Empty reads the same as null everywhere ("no gym decided"), and
        // null keeps the column honest about it.
        unitVenues: Object.keys(unitVenues).length > 0 ? unitVenues : null,
      },
    })
    updated++
  }
  return { updated }
}
