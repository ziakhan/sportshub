import type {
  PlanAssignment,
  PlanVenues,
  PlanWorld,
  PlanWorldGym,
  PlanWorldUnit,
  PlanWorldVenue,
  PlanWorldWeekend,
  PlanSettings,
} from "./plan-documents"
import {
  orderedVenues,
  type PlannerGym,
  type PlannerState,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
  type VenueRole,
} from "./planner-core"
// Types only: venue-grid.ts imports prisma, and step 2 is a client component.
import type { VenueGrid, VenueGridCell, VenueGridRow } from "@/lib/seasons/venue-grid"

/**
 * A PLAN OWNS ITS WORLD (owner ruling 2026-08-05, repeated — the architecture).
 *
 * Steps 1, 2 and 3 all read and write ONE thing: the selected plan's document.
 * The grade estimates and which grades are in, the gyms with their roles, the
 * courts, the hours, which weekends the league runs, which gym it has on each
 * of them, and the courts it holds back — all of it is the plan's, not the
 * season's. The season's live rows (Division.expectedTeams, SeasonVenue,
 * SeasonSessionDayVenue) move only when a plan is ACTIVATED, or through the
 * active plan's write-through, because the active plan IS the season.
 *
 * This module is that world's pure half: how to read a plan as a PlannerState
 * so all three steps draw any plan identically, how to edit the world without a
 * round trip, and how capacity follows an edit. It imports no prisma and no
 * React, so the client steps and the server routes share one answer.
 *
 * CAPACITY IS DERIVED, ALWAYS. buildSlots is the season's authority (courts ×
 * days × floor(window ÷ slot), minus the buffer) and every editor here
 * reproduces exactly that arithmetic, so a plan the operator has been editing
 * for an hour holds the same numbers the season would give it.
 */

/* ------------------------------ the arithmetic --------------------------- */

/** A weekend is a Saturday and a Sunday unless a season says otherwise. */
export const DEFAULT_DAY_COUNT = 2
/** One game's slot, when a world was saved before it carried one. */
export const DEFAULT_SLOT_MINUTES = 60
export const DEFAULT_OPEN = "09:00"
export const DEFAULT_CLOSE = "21:00"

/** Minutes past midnight, or null when the clock is not a clock. */
export function clockMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return null
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return minutes >= 0 && minutes <= 24 * 60 ? minutes : null
}

/** How long a gym is open in one day, in minutes. Zero when it is shut, or
 *  when the window closes before it opens (which is the same thing). */
export function windowMinutes(open: string | null, close: string | null): number {
  const from = clockMinutes(open)
  const to = clockMinutes(close)
  if (from === null || to === null) return 0
  return Math.max(0, to - from)
}

/** Games ONE court holds in ONE day: the same floor division buildSlots does,
 *  so a plan's capacity and the engine's slot count can never disagree. */
export function gamesPerCourtDay(
  open: string | null,
  close: string | null,
  slotMinutes = DEFAULT_SLOT_MINUTES
): number {
  const slot = slotMinutes > 0 ? slotMinutes : DEFAULT_SLOT_MINUTES
  return Math.floor(windowMinutes(open, close) / slot)
}

/** Courts the league is really willing to book here: the wired courts less the
 *  ones it holds back on purpose. Mirrors usableCourts in generate.ts. */
export function usableCourtCount(courts: number, courtBuffer: number | undefined): number {
  return Math.max(0, Math.floor(courts) - Math.max(0, Math.floor(courtBuffer ?? 0)))
}

/**
 * ONE gym on ONE weekend, priced in every number the board reads off it. The
 * hours are the gym's own for that weekend (an exception) falling back to its
 * season range, and the courts are what the world says the gym gives less the
 * buffer.
 */
export function venueOnWeekend(
  gym: PlanWorldGym,
  weekend: { dayCount?: number; startTime?: string | null; endTime?: string | null },
  world: Pick<PlanWorld, "courtBuffer" | "gameSlotMinutes">
): PlanWorldVenue {
  const days = Math.max(1, weekend.dayCount ?? DEFAULT_DAY_COUNT)
  const open = weekend.startTime ?? gym.openTime ?? DEFAULT_OPEN
  const close = weekend.endTime ?? gym.closeTime ?? DEFAULT_CLOSE
  const wired = Math.max(0, Math.floor(gym.courts ?? 0))
  const courts = usableCourtCount(wired, world.courtBuffer)
  const perCourtDay = gamesPerCourtDay(open, close, world.gameSlotMinutes)
  const courtDays = courts * days
  return {
    venueId: gym.venueId,
    name: gym.name,
    capacityGames: courtDays * perCourtDay,
    role: gym.role,
    // Dead since the 2026-08-03 venue ruling; kept so a world round-trips and
    // the drift sentence can still read an older plan.
    fillOrder: gym.role === "home" ? 0 : 1,
    courts,
    courtsHeld: Math.max(0, wired - courts),
    courtDays,
    days,
    hoursPerCourtDay: perCourtDay * ((world.gameSlotMinutes ?? DEFAULT_SLOT_MINUTES) / 60),
    startTime: weekend.startTime ?? null,
    endTime: weekend.endTime ?? null,
  }
}

/* ---------------------------- reading a world ---------------------------- */

/** The gyms a world knows about, healed: an explicit roster when it has one,
 *  else whatever its weekends mention (a snapshot from before rosters). */
export function worldGyms(world: PlanWorld): PlanWorldGym[] {
  if (world.gyms && world.gyms.length > 0) return world.gyms
  const out = new Map<string, PlanWorldGym>()
  for (const win of world.windows ?? []) {
    for (const w of win.weekends ?? []) {
      for (const v of w.venues ?? []) {
        if (out.has(v.venueId)) continue
        out.set(v.venueId, {
          venueId: v.venueId,
          name: v.name,
          role: v.role ?? (v.fillOrder === 0 ? "home" : "pool"),
          courts: Math.max(1, (v.courts ?? 0) + (v.courtsHeld ?? 0)),
          openTime: null,
          closeTime: null,
        })
      }
    }
  }
  return [...out.values()]
}

/** Every weekend of a world, in one flat chronological list. */
export function worldWeekends(world: PlanWorld): PlanWorldWeekend[] {
  return (world.windows ?? [])
    .flatMap((win) => win.weekends ?? [])
    .sort((a, b) => String(a.dateISO ?? "").localeCompare(String(b.dateISO ?? "")))
}

/**
 * Does this plan RUN this weekend? An explicit answer when the operator gave
 * one; otherwise the honest reading of a snapshot that never had the question:
 * a weekend with a gym on it was a weekend the plan ran.
 */
export function weekendChosen(weekend: PlanWorldWeekend): boolean {
  return weekend.chosen ?? (weekend.venues ?? []).length > 0
}

/** Is this grade in the plan at all? Explicit when said, else "it has a
 *  number", which is what an estimate of zero has always meant. */
export function unitIncluded(unit: PlanWorldUnit): boolean {
  return unit.included ?? unit.teams > 0
}

/**
 * A plan, in the shape the board computes on (owner ruling 2026-08-05: "add a
 * pure planStateFrom(plan) that yields the same PlannerState shape from
 * plan.settings + assignment + venues so all three steps render any plan
 * identically").
 *
 * The world gives the weekends, the gyms and the numbers; the plan's own two
 * columns give the calendar. A grade the plan left OUT is dropped, and a
 * weekend the plan does not run keeps its place in the month (an operator has
 * to be able to see the weekend they did not take) with no gyms and no games.
 */
export function planStateFrom(
  seasonId: string,
  plan: {
    assignment?: PlanAssignment | null
    venues?: PlanVenues | null
    settings?: PlanSettings | null
  }
): PlannerState | null {
  const world = plan.settings?.state
  if (!world) return null
  const assignment = plan.assignment ?? {}
  const venues = plan.venues ?? {}
  const gyms = worldGyms(world)
  const included = (world.units ?? []).filter(unitIncluded)
  const liveKeys = new Set(included.map((u) => u.key))

  const units: PlannerUnit[] = included.map((u) => ({
    key: u.key,
    label: u.label,
    divisionIds: u.divisionIds ?? [],
    alternate: Boolean(u.alternate),
    teams: u.teams,
    approved: u.approved ?? 0,
    expected: u.expected ?? u.teams,
    source: u.source ?? (u.teams > 0 ? "expected" : "none"),
  }))

  return {
    seasonId,
    units,
    windows: (world.windows ?? []).map((win) => ({
      label: win.label,
      weekends: (win.weekends ?? []).map((w) => {
        const on = weekendChosen(w)
        const venueRows: PlannerVenue[] = on
          ? orderedVenues(
              (w.venues ?? []).map((v) => {
                const gym = gyms.find((g) => g.venueId === v.venueId)
                return {
                  venueId: v.venueId,
                  name: v.name ?? gym?.name ?? v.venueId,
                  capacityGames: v.capacityGames ?? 0,
                  role: v.role ?? gym?.role ?? (v.fillOrder === 0 ? "home" : "pool"),
                  fillOrder: v.fillOrder ?? 1,
                  courts: v.courts,
                  courtsHeld: v.courtsHeld,
                  courtDays: v.courtDays,
                  days: v.days,
                  hoursPerCourtDay: v.hoursPerCourtDay,
                }
              })
            )
          : []
        // The plan's calendar, filtered to the grades the plan still holds: a
        // grade taken out on step 1 must not keep asking for games on step 3.
        const assigned = [...new Set<string>(assignment[w.sessionId] ?? [])].filter((k) =>
          liveKeys.has(k)
        )
        const assignedVenues: Record<string, string> = {}
        const decided: Record<string, string> = venues[w.sessionId] ?? {}
        for (const [key, venueId] of Object.entries(decided)) {
          if (!liveKeys.has(key) || typeof venueId !== "string") continue
          assignedVenues[key] = venueId
        }
        return {
          sessionId: w.sessionId,
          label: w.label,
          dateISO: w.dateISO ?? "",
          dayCount: w.dayCount ?? DEFAULT_DAY_COUNT,
          chosen: on,
          capacityGames: venueRows.reduce((sum, v) => sum + v.capacityGames, 0),
          largestVenueCapacity: Math.max(0, ...venueRows.map((v) => v.capacityGames)),
          venues: venueRows,
          targetGamesPerTeam: w.targetGamesPerTeam ?? 2,
          assigned,
          assignedVenues,
        }
      }),
    })),
    errors: [],
    gamesPerTeam: world.gamesPerTeam || undefined,
    courtBuffer: world.courtBuffer ?? 0,
    gameSlotMinutes: world.gameSlotMinutes ?? DEFAULT_SLOT_MINUTES,
    gyms: gyms.map((g) => ({ ...g })),
  }
}

/**
 * THE WEEKENDS THE SOLVER IS ALLOWED TO FILL (owner ruling 2026-08-05, #1: "the
 * planner fills your chosen weekends from your gyms").
 *
 * A plan's world deliberately keeps the weekends it did NOT take, because an
 * operator has to be able to see the Saturday they left out. The solver must
 * not see them: handed a weekend with no gym behind it, it would place a whole
 * month there and hand back overflow, so a plan that runs one weekend in October
 * would come back with games in all five months and a board full of red.
 *
 * So the state a solve runs on holds only the weekends this plan runs that have
 * gym time on them, and a month with none of those is dropped whole: a month the
 * plan does not run has no games, which is the truth rather than a failure. A
 * world where every weekend runs comes back as the very same object, so the
 * season's own board pays nothing for this.
 */
export function solvableState(state: PlannerState): PlannerState {
  const runs = (w: PlannerWeekend) => w.chosen !== false && w.capacityGames > 0
  if (state.windows.every((win) => win.weekends.every(runs))) return state
  return {
    ...state,
    windows: state.windows
      .map((win) => ({ ...win, weekends: win.weekends.filter(runs) }))
      .filter((win) => win.weekends.length > 0),
  }
}

/* ---------------------------- writing a world ---------------------------- */

/** Every editor goes through here: the weekends keep their own gyms, the
 *  weekend totals follow, and nothing else in the world is touched. */
function rebuild(world: PlanWorld): PlanWorld {
  const gyms = worldGyms(world)
  const byId = new Map(gyms.map((g) => [g.venueId, g]))
  return {
    ...world,
    gyms: gyms.map((g) => ({ ...g })),
    windows: (world.windows ?? []).map((win) => ({
      ...win,
      weekends: (win.weekends ?? []).map((w) => {
        const on = weekendChosen(w)
        const venues = on
          ? (w.venues ?? [])
              .filter((v) => byId.has(v.venueId))
              .map((v) =>
                venueOnWeekend(byId.get(v.venueId) as PlanWorldGym, {
                  dayCount: w.dayCount,
                  startTime: v.startTime ?? null,
                  endTime: v.endTime ?? null,
                }, world)
              )
          : []
        return {
          ...w,
          chosen: on,
          venues,
          capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
          largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
        }
      }),
    })),
  }
}

/** The grade estimate this plan runs on. */
export function withUnitTeams(world: PlanWorld, key: string, teams: number): PlanWorld {
  const next = Math.max(0, Math.min(200, Math.floor(teams)))
  return {
    ...world,
    units: (world.units ?? []).map((u) =>
      u.key === key ? { ...u, teams: next, expected: next, included: next > 0 || u.included } : u
    ),
  }
}

/** In or out of THIS plan. A grade taken out keeps its number, so putting it
 *  back does not make the operator type it again. */
export function withUnitIncluded(world: PlanWorld, key: string, included: boolean): PlanWorld {
  return {
    ...world,
    units: (world.units ?? []).map((u) => (u.key === key ? { ...u, included } : u)),
  }
}

/** Courts held back at every gym, every day. Every capacity moves with it. */
export function withCourtBuffer(world: PlanWorld, courtBuffer: number): PlanWorld {
  return rebuild({ ...world, courtBuffer: Math.max(0, Math.min(10, Math.floor(courtBuffer))) })
}

/** What a gym IS to this plan. Home is exclusive: naming one sends the other
 *  into the pool, in the same edit, because a league owns one building. */
export function withGymRole(world: PlanWorld, venueId: string, role: VenueRole): PlanWorld {
  const gyms = worldGyms(world).map((g) =>
    g.venueId === venueId
      ? { ...g, role }
      : role === "home" && g.role === "home"
        ? { ...g, role: "pool" as VenueRole }
        : g
  )
  return rebuild({ ...world, gyms })
}

/** How many courts this gym gives this plan. */
export function withGymCourts(world: PlanWorld, venueId: string, courts: number): PlanWorld {
  const gyms = worldGyms(world).map((g) =>
    g.venueId === venueId ? { ...g, courts: Math.max(0, Math.min(30, Math.floor(courts))) } : g
  )
  return rebuild({ ...world, gyms })
}

/** The one range this gym runs, every weekend of this plan. */
export function withGymHours(
  world: PlanWorld,
  venueId: string,
  openTime: string | null,
  closeTime: string | null
): PlanWorld {
  const gyms = worldGyms(world).map((g) =>
    g.venueId === venueId ? { ...g, openTime, closeTime } : g
  )
  return rebuild({ ...world, gyms })
}

/** A gym this plan has never heard of, with no availability at all: exactly
 *  what a gym added to the season after the plan was made deserves. */
export function withGym(world: PlanWorld, gym: PlanWorldGym): PlanWorld {
  const gyms = worldGyms(world)
  if (gyms.some((g) => g.venueId === gym.venueId)) return world
  return rebuild({ ...world, gyms: [...gyms, gym] })
}

/** One weekend, one gym, on or off. */
export function withGymOnWeekend(
  world: PlanWorld,
  sessionId: string,
  venueId: string,
  on: boolean
): PlanWorld {
  const gym = worldGyms(world).find((g) => g.venueId === venueId)
  if (!gym) return world
  return rebuild({
    ...world,
    windows: (world.windows ?? []).map((win) => ({
      ...win,
      weekends: (win.weekends ?? []).map((w) => {
        if (w.sessionId !== sessionId) return w
        const without = (w.venues ?? []).filter((v) => v.venueId !== venueId)
        if (!on) return { ...w, venues: without }
        // Turning a gym on turns the weekend on: a weekend with a gym is a
        // weekend this plan runs, and saying otherwise would be two answers.
        return {
          ...w,
          chosen: true,
          venues: [...without, venueOnWeekend(gym, { dayCount: w.dayCount }, world)],
        }
      }),
    })),
  })
}

/** One weekend at one gym, on hours of its own. `null` puts it back on the
 *  gym's usual range. */
export function withWeekendGymHours(
  world: PlanWorld,
  sessionId: string,
  venueId: string,
  hours: { startTime: string; endTime: string } | null
): PlanWorld {
  return rebuild({
    ...world,
    windows: (world.windows ?? []).map((win) => ({
      ...win,
      weekends: (win.weekends ?? []).map((w) =>
        w.sessionId !== sessionId
          ? w
          : {
              ...w,
              venues: (w.venues ?? []).map((v) =>
                v.venueId !== venueId
                  ? v
                  : {
                      ...v,
                      startTime: hours?.startTime ?? null,
                      endTime: hours?.endTime ?? null,
                    }
              ),
            }
      ),
    })),
  })
}

/**
 * DOES THIS PLAN RUN THIS WEEKEND (owner ruling 2026-08-05, #3 — the league
 * chooses its weekends once, per plan). Turning one ON attaches the HOME gym,
 * because that is the building the league already has and does not have to ask
 * anybody for; the pool is deliberately left alone, since nobody has phoned
 * those gyms about that Saturday. Turning one OFF takes every gym off it.
 */
export function withWeekendChosen(
  world: PlanWorld,
  sessionId: string,
  chosen: boolean
): PlanWorld {
  const home = worldGyms(world).find((g) => g.role === "home") ?? null
  return rebuild({
    ...world,
    windows: (world.windows ?? []).map((win) => ({
      ...win,
      weekends: (win.weekends ?? []).map((w) => {
        if (w.sessionId !== sessionId) return w
        if (!chosen) return { ...w, chosen: false, venues: [] }
        const had = (w.venues ?? []).length > 0
        const venues =
          had || !home
            ? (w.venues ?? [])
            : [venueOnWeekend(home, { dayCount: w.dayCount }, world)]
        return { ...w, chosen: true, venues }
      }),
    })),
  })
}

/** A gym on, or off, for every weekend this plan runs. Turning it on never
 *  invents a weekend: a weekend the plan does not run stays not run. */
export function withGymEveryWeekend(world: PlanWorld, venueId: string, on: boolean): PlanWorld {
  let next = world
  for (const w of worldWeekends(world)) {
    if (on && !weekendChosen(w)) continue
    next = withGymOnWeekend(next, w.sessionId, venueId, on)
  }
  return next
}

/** A weekend the season has just grown (step 2 created the session), taking
 *  its place in the right month. Chosen, because the operator asked for it. */
export function withWeekend(
  world: PlanWorld,
  windowLabel: string,
  weekend: PlanWorldWeekend
): PlanWorld {
  if (worldWeekends(world).some((w) => w.sessionId === weekend.sessionId)) return world
  const windows = [...(world.windows ?? [])]
  const at = windows.findIndex((win) => win.label === windowLabel)
  if (at < 0) {
    windows.push({ label: windowLabel, weekends: [weekend] })
  } else {
    windows[at] = {
      ...windows[at],
      weekends: [...(windows[at].weekends ?? []), weekend].sort((a, b) =>
        String(a.dateISO ?? "").localeCompare(String(b.dateISO ?? ""))
      ),
    }
  }
  return rebuild({ ...world, windows })
}

/* --------------------------- the world moved on -------------------------- */

/**
 * A PLACEMENT WHOSE GYM IS GONE (owner ruling 2026-08-05, #4). The operator
 * went back to step 2 and took a gym off a weekend the calendar was already
 * using, or turned the weekend off outright. The board must not quietly keep
 * drawing games in a building this plan no longer has.
 *
 * So the stale decision is DROPPED — which sends those games into the dashed
 * "needs a building" block the packer already draws — and it is reported, so
 * the chip, the section and the rail can all say the same true thing.
 */
export interface StrandedPlacement {
  sessionId: string
  weekendLabel: string
  unitKey: string
  /** The gym the plan no longer has there. Null when the whole weekend went. */
  venueId: string | null
  venueName: string | null
  /** True when the weekend itself is no longer one this plan runs. */
  weekendGone: boolean
}

export interface StrandedResult {
  /** The decided-gym map with every gone gym taken out of it. */
  venues: PlanVenues
  /** The calendar with grades on weekends the plan no longer runs taken off. */
  assignment: PlanAssignment
  stranded: StrandedPlacement[]
}

export function strandedPlacements(
  state: PlannerState,
  assignment: PlanAssignment,
  venues: PlanVenues
): StrandedResult {
  const weekends = new Map<string, PlannerWeekend>()
  for (const win of state.windows) for (const w of win.weekends) weekends.set(w.sessionId, w)
  const nameOf = (venueId: string) =>
    state.gyms?.find((g) => g.venueId === venueId)?.name ??
    [...weekends.values()]
      .flatMap((w) => w.venues)
      .find((v) => v.venueId === venueId)?.name ??
    null

  const stranded: StrandedPlacement[] = []
  const nextVenues: PlanVenues = {}
  const nextAssignment: PlanAssignment = {}

  for (const [sessionId, unitKeys] of Object.entries(assignment)) {
    const keys: string[] = unitKeys ?? []
    const weekend = weekends.get(sessionId)
    const runs = Boolean(weekend) && (weekend?.venues.length ?? 0) > 0
    if (!runs) {
      // The weekend is not one this plan runs any more, so nothing plays on it.
      for (const unitKey of keys) {
        stranded.push({
          sessionId,
          weekendLabel: weekend?.label ?? "a weekend this plan dropped",
          unitKey,
          venueId: venues[sessionId]?.[unitKey] ?? null,
          venueName: null,
          weekendGone: true,
        })
      }
      continue
    }
    nextAssignment[sessionId] = keys
  }

  for (const [sessionId, byUnit] of Object.entries(venues)) {
    const weekend = weekends.get(sessionId)
    if (!weekend || !nextAssignment[sessionId]) continue
    const here: Record<string, string> = {}
    const decided: Record<string, string> = byUnit ?? {}
    for (const [unitKey, venueId] of Object.entries(decided)) {
      if (weekend.venues.some((v) => v.venueId === venueId)) {
        here[unitKey] = venueId
        continue
      }
      // The gym is not on this weekend in this plan's world any more.
      if (!(nextAssignment[sessionId] ?? []).includes(unitKey)) continue
      stranded.push({
        sessionId,
        weekendLabel: weekend.label,
        unitKey,
        venueId,
        venueName: nameOf(venueId),
        weekendGone: false,
      })
    }
    if (Object.keys(here).length > 0) nextVenues[sessionId] = here
  }

  return { venues: nextVenues, assignment: nextAssignment, stranded }
}

/** The sentence a stranded set deserves, in the operator's words. Never a
 *  count on its own: they have to know which gym to go and look at. */
export function strandedSentence(stranded: StrandedPlacement[]): string | null {
  if (stranded.length === 0) return null
  const gymNames = [...new Set(stranded.filter((s) => !s.weekendGone).map((s) => s.venueName))]
    .filter((n): n is string => Boolean(n))
  const weekends = [...new Set(stranded.filter((s) => s.weekendGone).map((s) => s.weekendLabel))]
  const parts: string[] = []
  if (gymNames.length === 1) {
    parts.push(`${gymNames[0]} is not on those weekends in this plan any more`)
  } else if (gymNames.length > 1) {
    parts.push(`${gymNames.slice(0, 2).join(" and ")} are not on those weekends in this plan any more`)
  }
  if (weekends.length === 1) {
    parts.push(`${weekends[0]} is not a weekend this plan runs`)
  } else if (weekends.length > 1) {
    parts.push(`${weekends.length} weekends this calendar used are not weekends this plan runs`)
  }
  const games = stranded.length
  return `${parts.join(", and ")}. ${games === 1 ? "One placement needs" : `${games} placements need`} a building.`
}

/* --------------------------- building a world ---------------------------- */

/** The season's own gyms, as a plan's roster. */
function gymsFromState(state: PlannerState): PlanWorldGym[] {
  if (state.gyms && state.gyms.length > 0) return state.gyms.map((g) => ({ ...g }))
  const out = new Map<string, PlanWorldGym>()
  for (const win of state.windows) {
    for (const w of win.weekends) {
      for (const v of w.venues) {
        if (out.has(v.venueId)) continue
        out.set(v.venueId, {
          venueId: v.venueId,
          name: v.name,
          role: v.role,
          courts: Math.max(1, (v.courts ?? 0) + (v.courtsHeld ?? 0)),
          openTime: null,
          closeTime: null,
        })
      }
    }
  }
  return [...out.values()]
}

/**
 * The world a state IS, written down. This is the snapshot every save takes,
 * moved here so the server and the client build the identical object.
 *
 * The per-weekend calendar is stripped out: `assigned` and `assignedVenues` are
 * what a plan's OWN two columns hold, and a plan must never carry two answers
 * to where a grade plays.
 */
export function worldFromState(state: PlannerState): PlanWorld {
  return {
    seasonId: state.seasonId,
    units: state.units.map((u) => ({
      key: u.key,
      label: u.label,
      divisionIds: [...u.divisionIds],
      // JSON drops undefined, so an unflagged grade is written as false rather
      // than as a key that quietly disappears.
      alternate: Boolean(u.alternate),
      teams: u.teams,
      approved: u.approved,
      expected: u.expected,
      source: u.source,
      included: u.teams > 0,
    })),
    windows: state.windows.map((win) => ({
      label: win.label,
      weekends: win.weekends.map((w) => ({
        sessionId: w.sessionId,
        label: w.label,
        dateISO: w.dateISO,
        dayCount: w.dayCount ?? DEFAULT_DAY_COUNT,
        chosen: w.venues.length > 0,
        capacityGames: w.capacityGames,
        largestVenueCapacity: w.largestVenueCapacity,
        targetGamesPerTeam: w.targetGamesPerTeam,
        venues: w.venues.map((v) => ({
          venueId: v.venueId,
          name: v.name,
          capacityGames: v.capacityGames,
          role: v.role,
          fillOrder: v.fillOrder,
          courtDays: v.courtDays ?? 0,
          courts: v.courts ?? 0,
          courtsHeld: v.courtsHeld ?? 0,
          days: v.days ?? 0,
          hoursPerCourtDay: v.hoursPerCourtDay ?? 0,
        })),
      })),
    })),
    gamesPerTeam: state.gamesPerTeam ?? 0,
    gyms: gymsFromState(state),
    courtBuffer: state.courtBuffer ?? 0,
    gameSlotMinutes: state.gameSlotMinutes ?? DEFAULT_SLOT_MINUTES,
  }
}

/**
 * A NEW PLAN STARTS FRESH (owner ruling 2026-08-05). Teams are prefilled from
 * what the season knows — the operator's estimates, or the teams already
 * registered where there is no estimate — because re-typing twenty grades is
 * not a decision. Everything about GYM TIME starts blank:
 *
 *  - no weekend is chosen. The season's weekends are all there to pick from,
 *    and the operator picks the ones this plan runs.
 *  - the home gym is KNOWN (the league owns it) but it is attached to nothing,
 *    because nobody has said which weekends this plan plays yet.
 *  - the pool gyms are listed by name with zero availability: the league has
 *    them, and it has not phoned any of them about any Saturday.
 *
 * Anything else would be the plan asserting gym time the league never asked
 * for, which is exactly the thing the operator cannot check.
 */
export function freshWorld(live: PlannerState): PlanWorld {
  const base = worldFromState(live)
  return {
    ...base,
    units: base.units.map((u) => {
      const from = live.units.find((x) => x.key === u.key)
      const teams = u.teams > 0 ? u.teams : (from?.approved ?? 0)
      return { ...u, teams, expected: teams, included: teams > 0 }
    }),
    windows: base.windows.map((win) => ({
      ...win,
      weekends: win.weekends.map((w) => ({
        ...w,
        chosen: false,
        venues: [],
        capacityGames: 0,
        largestVenueCapacity: 0,
      })),
    })),
  }
}

/** A world with a `capturedAt` on it: what SeasonPlan.settings holds. */
export function settingsOf(world: PlanWorld): PlanSettings {
  return { capturedAt: new Date().toISOString(), state: world }
}

/** The gyms a plan really uses, for the activation write and the drive checks:
 *  sessionId → the venueIds attached there. */
export function worldAttachments(world: PlanWorld): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const w of worldWeekends(world)) {
    if (!weekendChosen(w)) continue
    out.set(w.sessionId, (w.venues ?? []).map((v) => v.venueId))
  }
  return out
}

/* ------------------------- step 2, drawn from a plan --------------------- */

/**
 * THE PLAN'S GYMS-AND-WEEKENDS GRID (owner ruling 2026-08-05, #3: "step 2
 * renders the SELECTED plan's world").
 *
 * The COLUMNS stay the season's: every Saturday across its span, month by
 * month, because which dates exist is a fact about the season's shape and not
 * an opinion a plan gets to hold. Everything INSIDE a cell is the plan's: which
 * gym it has that weekend, on what hours, with how many courts, and which
 * building it owns.
 *
 * Returned in the season grid's own shape so step 2 draws one table either way.
 * A gym the season has and this plan has never heard of is folded into the
 * roster with no availability at all, which is the honest thing to show: the
 * league has that gym, and this plan has not asked it for anything.
 */
export function planGridFrom(seasonGrid: VenueGrid, world: PlanWorld): VenueGrid {
  const byId = new Map(seasonGrid.venues.map((v) => [v.venueId, v]))
  const weekends = new Map(worldWeekends(world).map((w) => [w.sessionId, w]))
  const roster = worldGyms(world)
  // Gyms the season grew after this plan was made, listed with nothing on them.
  const extra: PlanWorldGym[] = seasonGrid.venues
    .filter((v) => !roster.some((g) => g.venueId === v.venueId))
    .map((v) => ({
      venueId: v.venueId,
      name: v.name,
      city: v.city,
      role: "pool",
      courts: v.courtsAvailable ?? v.courtCount ?? 0,
      openTime: v.simpleOpen,
      closeTime: v.simpleClose,
      seasonVenueId: v.seasonVenueId,
    }))

  const rows: VenueGridRow[] = [...roster, ...extra]
    .filter((gym) => byId.has(gym.venueId))
    .sort(
      (a, b) =>
        (a.role === "home" ? 0 : 1) - (b.role === "home" ? 0 : 1) ||
        a.name.localeCompare(b.name, "en")
    )
    .map((gym) => {
      const base = byId.get(gym.venueId) as VenueGridRow
      const cells: VenueGridCell[] = seasonGrid.weekends.map((column, i) => {
        const baseCell = base.cells[i]
        const weekend = column.sessionId ? weekends.get(column.sessionId) : undefined
        const on = weekend && weekendChosen(weekend)
        const venue = on ? (weekend.venues ?? []).find((v) => v.venueId === gym.venueId) : undefined
        if (!venue) {
          return {
            ...baseCell,
            // A gym the season marked unavailable still says so: that is a fact
            // about the gym's own calendar, not about this plan.
            state: baseCell?.state === "taken" ? "taken" : "off",
            daysOn: 0,
            bookingStatus: null,
            startTime: null,
            endTime: null,
            hoursLabel: null,
          }
        }
        const custom = Boolean(venue.startTime && venue.endTime)
        return {
          ...baseCell,
          state: custom ? "custom" : "on",
          daysOn: weekend?.dayCount ?? DEFAULT_DAY_COUNT,
          dayCount: weekend?.dayCount ?? baseCell?.dayCount ?? DEFAULT_DAY_COUNT,
          courts: (venue.courts ?? 0) + (venue.courtsHeld ?? 0),
          startTime: venue.startTime ?? gym.openTime ?? null,
          endTime: venue.endTime ?? gym.closeTime ?? null,
          // A plan holds no bookings: where a booking stands is a fact about the
          // season's own attachment, and this plan has not made one.
          bookingStatus: null,
          hoursLabel: custom ? `${venue.startTime}–${venue.endTime}` : null,
        }
      })
      return {
        ...base,
        role: gym.role,
        courtsAvailable: gym.courts,
        simpleOpen: gym.openTime ?? null,
        simpleClose: gym.closeTime ?? null,
        // One range per gym is the plan's whole hours model, so there is nothing
        // for Saturday and Sunday to disagree about.
        hoursVary: false,
        cells,
      }
    })

  return { ...seasonGrid, courtBuffer: world.courtBuffer ?? 0, venues: rows }
}

/** Re-export for callers that only want the gym shape. */
export type { PlannerGym }
