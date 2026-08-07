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
  buildingCapacityAt,
  courtCapKey,
  courtsWiredAt,
  orderedVenues,
  type PlannerGym,
  type PlannerState,
  type PlannerUnit,
  type PlannerVenue,
  type PlannerWeekend,
  type PlannerWindow,
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
/** The Friday evening a session may take: one block, at a gym the session is
 *  already using (owner ruling 2026-08-06). The 18:00-22:00 pair is the
 *  DEFAULT, not the law: a league sets its own on the season (owner
 *  2026-08-07, the NJC/NSC Fri-Sun constraint) and every number and every
 *  sentence below reads the window the state carries. */
export const FRIDAY_START = "18:00"
export const FRIDAY_END = "22:00"

type FridayWindowSource = Pick<PlanWorld, "fridayStart" | "fridayEnd">

/** The Friday window this world runs: its own, else the default. */
export function fridayWindow(world: FridayWindowSource): { start: string; end: string } {
  return { start: world.fridayStart ?? FRIDAY_START, end: world.fridayEnd ?? FRIDAY_END }
}

/** "6-10 PM", read off the actual window rather than hardcoded. */
export function fridayWindowLabel(world: FridayWindowSource): string {
  const { start, end } = fridayWindow(world)
  const say = (t: string) => {
    const m = clockMinutes(t) ?? 0
    const h = Math.floor(m / 60)
    const mins = m % 60
    const hour12 = ((h + 11) % 12) + 1
    return `${hour12}${mins > 0 ? `:${String(mins).padStart(2, "0")}` : ""}`
  }
  const endM = clockMinutes(end) ?? 0
  return `${say(start)}-${say(end)} ${endM >= 12 * 60 ? "PM" : "AM"}`
}

/** Games ONE court holds on a Friday evening at this plan's slot length and
 *  this league's window. */
export function fridayGamesPerCourt(slotMinutes?: number, window?: FridayWindowSource): number {
  const w = fridayWindow(window ?? {})
  return gamesPerCourtDay(w.start, w.end, slotMinutes)
}

export function venueOnWeekend(
  gym: PlanWorldGym,
  weekend: {
    dayCount?: number
    startTime?: string | null
    endTime?: string | null
    fridayCourts?: number
  },
  world: Pick<PlanWorld, "courtBuffer" | "gameSlotMinutes" | "fridayStart" | "fridayEnd">
): PlanWorldVenue {
  const days = Math.max(1, weekend.dayCount ?? DEFAULT_DAY_COUNT)
  const open = weekend.startTime ?? gym.openTime ?? DEFAULT_OPEN
  const close = weekend.endTime ?? gym.closeTime ?? DEFAULT_CLOSE
  const wired = Math.max(0, Math.floor(gym.courts ?? 0))
  const courts = usableCourtCount(wired, world.courtBuffer)
  const perCourtDay = gamesPerCourtDay(open, close, world.gameSlotMinutes)
  const courtDays = courts * days
  /**
   * THE FRIDAY IS EXTRA, NOT INSTEAD (owner ruling 2026-08-06). It rides on top
   * of the weekend's own days at its own short window, so a session that took
   * one holds what it always held plus the Friday evening.
   */
  const fridayCourts = Math.max(0, Math.min(courts, Math.floor(weekend.fridayCourts ?? 0)))
  const fridayGames = fridayCourts * fridayGamesPerCourt(world.gameSlotMinutes, world)
  return {
    venueId: gym.venueId,
    name: gym.name,
    ...(fridayCourts > 0 ? { fridayCourts } : {}),
    capacityGames: courtDays * perCourtDay + fridayGames,
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

/**
 * THE LEAGUE'S OWN ORDER, off the roster (owner ruling 2026-08-06: "select the
 * home, then the next one, and the following one").
 *
 * The ARRAY ORDER is the order. Nothing new is stored: the home gym is always
 * first, and the pool follows in the order the operator arranged on step 2, so a
 * world written before any of this existed keeps whatever order it was saved in
 * and behaves exactly as it did.
 *
 * It is a preference and never a gate. Occupancy is the only gate.
 */
export function gymRanks(gyms: Array<Pick<PlanWorldGym, "venueId" | "role">>): Map<string, number> {
  const home = gyms.filter((g) => g.role === "home").map((g) => g.venueId)
  const pool = gyms.filter((g) => g.role !== "home").map((g) => g.venueId)
  return new Map([...home, ...pool].map((venueId, i) => [venueId, i]))
}

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
  const ranks = gymRanks(gyms)
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
    // A month a saved world fenced as playoffs is DROPPED WHOLE (owner's
    // 2026-08-06 analysis, C1): playoff dates are a season setting now and
    // planning never draws them — no ghost columns, no bands. Old documents
    // that carry the fence read as if those dates were never planning supply,
    // which is what the fence always meant.
    windows: (world.windows ?? []).filter((win) => !windowFenced(win)).map((win) => ({
      label: win.label,
      phase: win.phase,
      weekends: (win.weekends ?? []).map((w) => {
        const on = weekendChosen(w)
        const venueRows: PlannerVenue[] = on
          ? orderedVenues(
              (w.venues ?? []).map((v) => {
                const gym = gyms.find((g) => g.venueId === v.venueId)
                return {
                  venueId: v.venueId,
                  name: v.name ?? gym?.name ?? v.venueId,
                  // The league's own order travels with the row, so the solver
                  // and every list read the same one (owner ruling 2026-08-06).
                  rank: ranks.get(v.venueId),
                  // A gym the PLAN really holds on this weekend is a booking the
                  // league has made: declared on step 2, or placed by hand. The
                  // objective treats leaving it empty as waste (owner ruling
                  // 2026-08-06, confirmed bookings are obligations).
                  booked: true,
                  capacityGames: v.capacityGames ?? 0,
                  role: v.role ?? gym?.role ?? (v.fillOrder === 0 ? "home" : "pool"),
                  fillOrder: v.fillOrder ?? 1,
                  courts: v.courts,
                  courtsHeld: v.courtsHeld,
                  courtDays: v.courtDays,
                  days: v.days,
                  hoursPerCourtDay: v.hoursPerCourtDay,
                  // The hours this gym runs on THIS weekend, where the plan gave
                  // it an exception (owner ruling 2026-08-06, #5). Carried so the
                  // per-date editor opens on what is really booked.
                  startTime: v.startTime ?? gym?.openTime ?? null,
                  endTime: v.endTime ?? gym?.closeTime ?? null,
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
    fridayStart: world.fridayStart,
    fridayEnd: world.fridayEnd,
    gyms: gyms.map((g) => ({ ...g })),
  }
}

/**
 * THE BUILDING THE LEAGUE OWNS, off the plan's own roster. Null when the plan
 * has no home gym at all, which is a thing step 2 has to fix.
 */
export function homeGymOf(state: Pick<PlannerState, "gyms">): PlanWorldGym | null {
  return (state.gyms ?? []).find((g) => g.role === "home") ?? null
}

/** Games the home gym could hold on one ordinary weekend of this plan: the
 *  courts it gives less the buffer, over the hours it runs. Zero when the plan
 *  has no home gym, when every court is held back, or when it never opens. */
export function homeGymCapacity(state: PlannerState, dayCount = DEFAULT_DAY_COUNT): number {
  const home = homeGymOf(state)
  return home ? plannerVenueOn(home, { dayCount }, state).capacityGames : 0
}

/**
 * A WEEKEND THE DRAW IS ALLOWED TO FILL (owner ruling 2026-08-06: "the draw
 * fills your chosen weekends from your gyms").
 *
 * One this plan CHOSE, whether or not it carries gym time yet, or one that
 * already really runs. The second half is the season's own board and the older
 * worlds, where `chosen` was never written down and a weekend with capacity on
 * it was the only weekend there was.
 *
 * What it is NOT is the structural leftover: a Saturday the season has a session
 * for, that this plan did not take, with nothing behind it. Handed one of those
 * the solver would put a whole month on it and hand back overflow.
 */
export function weekendSolvable(w: PlannerWeekend): boolean {
  return w.chosen === true || (w.chosen !== false && w.capacityGames > 0)
}

/**
 * A MONTH THIS PLAN HAS FENCED AS PLAYOFFS (owner ruling 2026-08-06).
 *
 * The last month of a league season is usually not league games at all. Playoffs
 * are drawn from standings that do not exist until the regular season ends, so
 * there is nothing for the solver to place there and nothing for the league to
 * owe: no games, no grade sessions, no rentals in the ask.
 *
 * Absent means regular, so every world written before the fence existed reads
 * exactly as it always did.
 */
export function windowFenced(window: Pick<PlannerWindow, "phase">): boolean {
  return window.phase === "playoffs"
}

/**
 * WHAT THE DRAW MAY BOOK ON EACH CHOSEN WEEKEND (owner ruling 2026-08-06, the
 * overriding one): every gym in the roster it does not already have there.
 *
 * It used to be the home gym and nothing else, so a league whose own building
 * could not hold a weekend came back overflowing while three pool gyms it has
 * phone numbers for sat unused. Availability is not a restriction: the solver may
 * book any of them, and the booking is ASSUMED until somebody confirms it.
 *
 * Nothing here decides WHICH gyms get used — the objective does, and it already
 * prices the home gym at nothing, a confirmed weekend at what it costs, and each
 * new building-weekend at 25,000. This only puts them on the table.
 *
 * A fenced month is skipped whole: booking a building for playoffs nobody has
 * drawn yet is a rental for games that do not exist.
 */
function drawableGyms(state: PlannerState): Record<string, string[]> {
  const roster = state.gyms ?? []
  if (roster.length === 0) return {}
  // THE LEAGUE'S OWN ORDER (owner ruling 2026-08-06): the building it owns, then
  // the pool as the operator arranged it on step 2. It was by NAME, which is how
  // a draw came back having booked Haber over Six Park for no reason.
  const ranks = gymRanks(roster)
  const order = [...roster].sort(
    (a, b) => (ranks.get(a.venueId) ?? 0) - (ranks.get(b.venueId) ?? 0)
  )
  const out: Record<string, string[]> = {}
  for (const win of state.windows) {
    if (windowFenced(win)) continue
    for (const w of win.weekends) {
      if (w.chosen !== true) continue
      const have = new Set(w.venues.map((v) => v.venueId))
      const add = order.filter((g) => !have.has(g.venueId)).map((g) => g.venueId)
      if (add.length > 0) out[w.sessionId] = add
    }
  }
  return out
}

/**
 * THE WEEKENDS THE SOLVER IS ALLOWED TO FILL, AND WHAT THEY HOLD (owner ruling
 * 2026-08-06: "the draw fills your chosen weekends from your gyms").
 *
 * Two things at once, because they are the same sentence read twice.
 *
 * WHICH WEEKENDS. A plan's world deliberately keeps the Saturdays it did NOT
 * take, so an operator can see the one they left out. The solver must not see
 * them: handed a weekend with nothing behind it, it would place a whole month
 * there and hand back overflow, so a plan running one weekend in October used to
 * come back with games in all five months and a board full of red. A month with
 * no chosen weekend is dropped WHOLE, because a month the plan does not run has
 * no games, and that is the truth rather than a failure.
 *
 * WHAT THEY HOLD. Choosing a weekend on step 2 attaches no gym (the 2026-08-06
 * ruling: buildings are placed on the board, not painted on a grid), so a chosen
 * weekend usually arrives BARE. It is still a weekend this league runs, and what
 * it runs on is the building the league owns: the home gym goes on it at its
 * usable capacity, exactly the arithmetic step 2 would have given it. That is
 * what lets the solve fill the weekends the operator asked for instead of
 * quietly falling back onto the ones they did not.
 *
 * A MONTH FENCED AS PLAYOFFS is dropped whole and unconditionally (owner ruling
 * 2026-08-06), whatever gym time it has on it: playoffs are drawn from standings
 * that do not exist yet, so no grade is owed a session there and no rental is
 * asked for it. It stays on the BOARD as its own quiet band, because the league
 * still plays that month; it is simply not this solve's business.
 *
 * A world where every weekend already runs comes back as the very same object,
 * so the season's own board pays nothing for any of this.
 */
export function solvableState(state: PlannerState): PlannerState {
  // The rooms the draw MAY book are candidates, not bookings: passing false is
  // what keeps "already booked" and "could be booked" apart in the objective
  // (owner ruling 2026-08-06, confirmed bookings are obligations).
  const filled = withAssertedGyms(state, drawableGyms(state), false)
  const runs = (w: PlannerWeekend) => w.chosen !== false && w.capacityGames > 0
  if (filled.windows.every((win) => !windowFenced(win) && win.weekends.every(runs))) return filled
  return {
    ...filled,
    windows: filled.windows
      .filter((win) => !windowFenced(win))
      .map((win) => ({ ...win, weekends: win.weekends.filter(runs) }))
      .filter((win) => win.weekends.length > 0),
  }
}

/**
 * THE GYMS THE DRAW PUT ON A WEEKEND (owner rulings 2026-08-06, #3 and the
 * overriding availability one).
 *
 * The solve fills a chosen weekend from the building the league owns and, where
 * that is not enough, from any pool gym in the roster. The board then has to SHOW
 * that: real sections, real meters, real rental blocks. So a draw records the
 * same assertion a hand-placed gym makes, for every building a grade actually
 * landed in, and one Undo takes the whole draw back with it.
 *
 * The rented ones come back marked ASSUMED, because nobody has phoned them yet.
 * Weekends the draw left empty get nothing: a building on a date nobody plays on
 * is a booking the league never made.
 */
/**
 * WHERE A BOOKING CAME FROM, AND THEREFORE WHAT IT IS (owner ruling 2026-08-06,
 * the status inversion).
 *
 * Two sources, two answers, and they are opposites on purpose:
 *
 *  - THE DRAW put it down, so nobody has phoned that gym: ASSUMED. It wears the
 *    gold chip and the ask sheet asks about it, because it is a promise the
 *    league has not made yet and the operator has to go and make it.
 *  - THE OPERATOR put it down — a drag, a tap, a tick on step 2 — so by his
 *    standing rule they checked: CONFIRMED. It is silent. Marking it gold would
 *    be the board asking them to confirm the thing they just told it.
 *
 * ONE KEYING SCHEME for all of it: "<sessionId>|<venueId>", which is what
 * courtCapKey builds and what blockKey builds. They are the same string by
 * construction — one gym, one weekend — so the court corrections, the hours
 * exceptions and the booking statuses are all looked up the same way and can
 * never drift into two vocabularies.
 */
export type BookingSource = "draw" | "operator"

export function bookingStatusFor(source: BookingSource): "assumed" | "confirmed" {
  return source === "draw" ? "assumed" : "confirmed"
}

export interface DrawnGyms {
  /** sessionId → the venueIds the draw put there, for the board's assertion
   *  mechanism, so the sections, meters and blocks are real. */
  added: Record<string, string[]>
  /**
   * The rentals the draw SPENT rather than invented: gym time the league had
   * already booked and the calendar actually used (owner ruling 2026-08-06,
   * confirmed bookings are obligations). Nothing to assert and nothing to phone
   * about — it is here so the notice can say the operator's own bookings were
   * filled before anything was assumed beyond them.
   */
  booked: Array<{ sessionId: string; venueId: string }>
  /**
   * The ones the league has NOT booked: every rented building the solver put
   * down itself. They land assumed (owner ruling 2026-08-06), which is what the
   * gold chip and the ask sheet's "Booked it / I do not have this" are for. The
   * building the league OWNS is never in here: nobody phones their own gym.
   */
  assumed: Array<{ sessionId: string; venueId: string }>
}

export function drawnGyms(
  state: PlannerState,
  assignment: PlanAssignment,
  /** Where the draw actually put each grade: sessionId → (unit key → venueId). */
  venues: PlanVenues
): DrawnGyms {
  const drawable = drawableGyms(state)
  const roleOf = new Map((state.gyms ?? []).map((g) => [g.venueId, g.role]))
  const added: Record<string, string[]> = {}
  const assumed: Array<{ sessionId: string; venueId: string }> = []
  const booked: Array<{ sessionId: string; venueId: string }> = []
  // The rentals the league had already made and this calendar really used.
  for (const win of state.windows) {
    for (const w of win.weekends) {
      const used = new Set(Object.values(venues[w.sessionId] ?? {}))
      for (const v of w.venues) {
        if (v.role === "pool" && used.has(v.venueId)) {
          booked.push({ sessionId: w.sessionId, venueId: v.venueId })
        }
      }
    }
  }
  for (const [sessionId, mayBook] of Object.entries(drawable)) {
    if ((assignment[sessionId] ?? []).length === 0) continue
    // Only the buildings a grade really landed in. A gym the solve was offered
    // and did not need is not a booking anybody made.
    const used = new Set(Object.values(venues[sessionId] ?? {}))
    const here = mayBook.filter((venueId) => used.has(venueId))
    if (here.length === 0) continue
    added[sessionId] = here
    for (const venueId of here) {
      if (roleOf.get(venueId) !== "home") assumed.push({ sessionId, venueId })
    }
  }
  return { added, assumed, booked }
}

/**
 * IS THERE A WORLD TO DRAW IN (owner ruling 2026-08-06, replacing the 2026-08-05
 * reading)?
 *
 * It used to be "a chosen weekend with gym time already on it", which was true
 * right up until choosing a weekend stopped attaching a gym. After that the
 * operator could pick every weekend they wanted, come to step 3, and be sent
 * back to step 2 to do a thing step 2 no longer has a control for.
 *
 * Two facts now, and the hero names whichever is missing:
 *  - the league has a GYM with courts, which is what a bare weekend gets filled
 *    from. Since the 2026-08-06 availability ruling any roster gym will do: the
 *    home gym is preferred and the rest are booked as assumed, so a league that
 *    owns no building can still draw a calendar;
 *  - at least one weekend is CHOSEN (or already runs, on the season's own
 *    board).
 *
 * `usable` is read off the solve itself rather than off the two facts, so the
 * button can never be offered for a draw that would come back empty.
 */
export type WorldGap = "weekends" | "gym" | "both"

export interface WorldReadiness {
  /** There is at least one weekend the draw could really fill. */
  usable: boolean
  /** What the operator has to go and do, or null when nothing is missing. */
  gap: WorldGap | null
}

export function worldReadiness(state: PlannerState | null): WorldReadiness {
  if (!state) return { usable: false, gap: "both" }
  // A month fenced as playoffs is not a month with weekends to offer: a plan
  // whose only chosen Saturdays are in March has still chosen nothing to solve.
  const chosenAny = state.windows.some(
    (win) => !windowFenced(win) && win.weekends.some(weekendSolvable)
  )
  // ANY gym with courts, not only the home one: the draw books the rest as
  // assumed (owner ruling 2026-08-06).
  const gymOk = (state.gyms ?? []).some(
    (g) => usableCourtCount(g.courts, state.courtBuffer ?? 0) > 0
  )
  const usable = solvableState(state).windows.some((win) => win.weekends.length > 0)
  if (usable) return { usable: true, gap: null }
  return { usable: false, gap: !chosenAny ? (gymOk ? "weekends" : "both") : "gym" }
}

/* --------------------------- the Friday evening -------------------------- */

/**
 * WHICH SIDE OF THE LEAGUE A GRADE IS ON (owner ruling 2026-08-06, THE GENDER
 * LAW). Boys and girls divisions do not pool: a Friday evening justified by a
 * boys cohort has to absorb a boys group, and a suggestion that reaches its
 * numbers by adding a girls division to a boys one is not an answer, it is a
 * scheduling error with a sentence around it.
 *
 * Read off the words the league uses, because that is where it lives: a plain
 * grade carries no marker and is its own bucket, which groups only with itself.
 * Unknown never merges with known, so the law fails SAFE.
 */
export type UnitGender = "girls" | "boys" | "unspecified"

export function unitGender(unit: Pick<PlannerUnit, "key" | "label">): UnitGender {
  const words = `${unit.label} ${unit.key}`.toLowerCase()
  if (/\b(girls?|women|womens|female|f)\b/.test(words)) return "girls"
  if (/\b(boys?|men|mens|male|m)\b/.test(words)) return "boys"
  return "unspecified"
}

/** One gender across a whole group, or null when it is mixed. Null is a refusal:
 *  the Friday is never suggested for a group that spans the league. */
export function sharedGender(units: PlannerUnit[]): UnitGender | null {
  if (units.length === 0) return null
  const first = unitGender(units[0])
  return units.every((u) => unitGender(u) === first) ? first : null
}

/**
 * A FRIDAY EVENING THAT WOULD FIX THIS WEEKEND (owner ruling 2026-08-06).
 *
 * Suggested, NEVER taken: the solver does not add Fridays, because a Friday is a
 * phone call and an evening of somebody's life, and the operator is the one who
 * decides that. It only fires when it is unambiguously the cheap answer:
 *
 *  1. the session is in trouble — it overflows, or the packer had to open a
 *     whole extra building for one small cohort;
 *  2. a right-sized Friday block at a gym the session is ALREADY USING absorbs
 *     all of it, so nothing new is rented and nobody makes a new call;
 *  3. the grades it is justified by share a gender (the law above).
 *
 * Any of those failing means silence. A suggestion that needs a new gym is not
 * this suggestion, and the rail says nothing rather than something nearly true.
 */
export interface FridayFit {
  sessionId: string
  venueId: string
  venueName: string
  /** Courts the Friday block needs: right-sized, never the whole building. */
  courts: number
  /** Courts the host building has, so the sentence can say "2 of 6". */
  hostCourts: number
  startTime: string
  endTime: string
  /** Games it takes off the rest of the weekend. */
  games: number
  /** The grades that justify it, all of one gender. */
  unitKeys: string[]
  gender: UnitGender
  /** Why it fired, for the sentence the rail reads out. */
  because: "overflow" | "extra-building"
}

export function fridayFit(
  state: PlannerState,
  weekend: PlannerWeekend,
  /** The grades on this weekend, and the building each one plays in. */
  assigned: string[],
  playsIn: Record<string, string>
): FridayFit | null {
  if (assigned.length === 0) return null
  const unitBy = new Map(state.units.map((u) => [u.key, u]))
  const games = (keys: string[]) =>
    keys.reduce((sum, key) => {
      const u = unitBy.get(key)
      return sum + (u ? Math.ceil((u.teams * weekend.targetGamesPerTeam) / 2) : 0)
    }, 0)

  const demand = games(assigned)
  const over = demand - weekend.capacityGames
  /**
   * A WHOLE BUILDING OPENED FOR ONE SMALL COHORT. The other half of the trigger:
   * the weekend fits, but only because the packer rented a second address for a
   * single grade that a Friday at the first one would have held.
   */
  const byVenue = new Map<string, string[]>()
  for (const key of assigned) {
    const venueId = playsIn[key]
    if (!venueId) continue
    byVenue.set(venueId, [...(byVenue.get(venueId) ?? []), key])
  }
  const lonely = [...byVenue.entries()]
    .filter(([venueId, keys]) => keys.length === 1 && weekend.venues.some((v) => v.venueId === venueId && v.role === "pool"))
    .sort((a, b) => games(a[1]) - games(b[1]))[0]

  const because: FridayFit["because"] | null =
    over > 0 ? "overflow" : lonely && byVenue.size > 1 ? "extra-building" : null
  if (!because) return null

  // What the Friday has to absorb, and who justifies it.
  const unitKeys = because === "overflow" ? assigned : lonely[1]
  const need = because === "overflow" ? over : games(lonely[1])
  if (need <= 0) return null

  // THE GENDER LAW. A mixed justification is not a justification.
  const gender = sharedGender(unitKeys.map((k) => unitBy.get(k)).filter(Boolean) as PlannerUnit[])
  if (!gender) return null

  /**
   * NO NEW GYM, AND NO MIXED GYM-DAY (owner rulings 2026-08-06, the gender law
   * hardened).
   *
   * The Friday goes at a building this session is ALREADY using — a gym nobody
   * is using this weekend would be a new booking, which is the thing this
   * suggestion exists to avoid. But "already using" is exactly what makes the
   * second rule bite: the absorbed group joins whoever is ALREADY in that
   * building, so the host's own grades have to be the same side of the league.
   *
   * A boys cohort moved into a gym holding girls produces a mixed gym-day, which
   * is not a scheduling detail to sort out later: it is the thing the league does
   * not do. If the only building big enough would mix them, the answer is
   * silence, not a suggestion with a problem inside it.
   */
  const perCourt = fridayGamesPerCourt(state.gameSlotMinutes, state)
  if (perCourt <= 0) return null
  const courts = Math.ceil(need / perCourt)
  /** The building the absorbed group is in now. Folding it into ITSELF removes
   *  no gym, so on the extra-building trigger that one cannot be the host: the
   *  whole point is that the rental goes away. */
  const from = because === "extra-building" ? playsIn[unitKeys[0]] : null
  const hosts = weekend.venues
    .filter((v) => byVenue.has(v.venueId) && v.venueId !== from)
    // It has to fit in a building we already have. Anything more is a new gym.
    .filter((v) => courts <= courtsWiredAt(v))
    .filter((v) => {
      // Everyone already in that gym that weekend, plus the group moving in.
      const theirs = (byVenue.get(v.venueId) ?? []).filter((k) => !unitKeys.includes(k))
      const together = [...theirs, ...unitKeys]
        .map((k) => unitBy.get(k))
        .filter(Boolean) as PlannerUnit[]
      return sharedGender(together) === gender
    })
    .sort((a, b) => courtsWiredAt(b) - courtsWiredAt(a))
  const host = hosts[0]
  if (!host) return null

  return {
    sessionId: weekend.sessionId,
    venueId: host.venueId,
    venueName: host.name,
    courts,
    hostCourts: courtsWiredAt(host),
    startTime: fridayWindow(state).start,
    endTime: fridayWindow(state).end,
    games: need,
    unitKeys,
    gender,
    because,
  }
}

/**
 * THE FRIDAY SUGGESTION, IN THE OPERATOR'S OWN WORDS (owner ruling 2026-08-06,
 * the copy fix).
 *
 * It used to read "fits everything in one session", which describes the wrong
 * thing: the cohort is ALREADY in this session — nobody is being moved between
 * weekends. What the Friday does is fit them into a gym the league is ALREADY
 * booking, by adding evening capacity there, so a third building never has to be
 * rented. The sentence says that, and names who it is about.
 */
export function fridaySentence(fit: FridayFit, unitLabels: string[] = []): string {
  const who = unitLabels.length > 0 ? nameThem(unitLabels) : "Those grades"
  const wired = `${fit.courts} of ${fit.hostCourts} courts`
  const when = fridayWindowLabel({ fridayStart: fit.startTime, fridayEnd: fit.endTime })
  return `${who} already play this weekend. Add Friday evening (${wired}, ${when}) at ${venueShortLabel(fit.venueName)} to fit them into the gym you already book - no third gym.`
}

/** "Grade 9 Girls", or "Grade 9 Girls and Grade 10 Girls". */
function nameThem(labels: string[]): string {
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`
}

/** A gym in the words a rail row has room for. */
function venueShortLabel(name: string): string {
  return name.split(/\s+/).slice(0, 2).join(" ")
}

/**
 * EVERY FRIDAY THE BOARD IS HOLDING, applied to the state it draws (owner ruling
 * 2026-08-06). The working-copy twin of withFridayBlock, keyed the way the
 * courts and the hours are keyed, so the capacity moves the instant the operator
 * accepts and one Undo takes it back.
 */
export function withFridayBlocks(
  state: PlannerState,
  fridays: Record<string, number>
): PlannerState {
  if (Object.keys(fridays).length === 0) return state
  const perCourt = fridayGamesPerCourt(state.gameSlotMinutes, state)
  let touchedAny = false
  const windows = state.windows.map((win) => {
    let touchedWindow = false
    const weekends = win.weekends.map((w) => {
      let touched = false
      const venues = w.venues.map((v) => {
        const courts = fridays[courtCapKey(w.sessionId, v.venueId)]
        if (courts == null) return v
        const held = Math.max(0, Math.min(v.courts ?? courtsWiredAt(v), Math.floor(courts)))
        touched = true
        // The Friday rides ON TOP of the weekend's own days: take off whatever
        // block this row already carried and put the new one on.
        return {
          ...v,
          fridayCourts: held,
          capacityGames: v.capacityGames + (held - (v.fridayCourts ?? 0)) * perCourt,
        }
      })
      if (!touched) return w
      touchedWindow = true
      touchedAny = true
      return {
        ...w,
        venues,
        capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
        largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
      }
    })
    return touchedWindow ? { ...win, weekends } : win
  })
  return touchedAny ? { ...state, windows } : state
}

/** Every Friday the board holds, written into the plan's own world on save. */
export function withFridayBlocksInWorld(
  world: PlanWorld,
  fridays: Record<string, number>
): PlanWorld {
  let next = world
  for (const [key, courts] of Object.entries(fridays)) {
    const [sessionId, venueId] = key.split("|")
    if (!sessionId || !venueId) continue
    next = withFridayBlock(next, sessionId, venueId, courts)
  }
  return next
}

/** One weekend at one gym, with a Friday evening block on it. */
export function withFridayBlock(
  world: PlanWorld,
  sessionId: string,
  venueId: string,
  courts: number
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
                  : { ...v, fridayCourts: Math.max(0, Math.floor(courts)) }
              ),
            }
      ),
    })),
  })
}

/* ------------------- where a grade could actually go --------------------- */

/**
 * ONE BUILDING, ON ONE WEEKEND, as a destination (owner rulings 2026-08-05, #1
 * and #2). Everything a move has to check before it is offered, in one row.
 */
/** A gym of the plan's roster, priced as a venue on one weekend in the shape the
 *  board computes on. Same arithmetic venueOnWeekend gives step 2, so an
 *  asserted gym reads exactly as it will once it is saved. */
function plannerVenueOn(
  gym: PlanWorldGym,
  weekend: { dayCount?: number },
  world: Pick<PlanWorld, "courtBuffer" | "gameSlotMinutes" | "fridayStart" | "fridayEnd"> & { gyms?: PlanWorldGym[] }
): PlannerVenue {
  const venue = venueOnWeekend(gym, weekend, world)
  return {
    ...venue,
    role: venue.role ?? gym.role,
    rank: world.gyms ? gymRanks(world.gyms).get(gym.venueId) : undefined,
  }
}

export interface BuildingRoom {
  venueId: string
  name: string
  role: VenueRole
  /** Courts this building could give here: its own wiring less the buffer,
   *  never past a court correction somebody made for this weekend. */
  courts: number
  /** Games the WHOLE building could hold on this weekend at those courts. */
  capacityGames: number
  /** Games already sitting in it on the board. */
  usedGames: number
  /** capacityGames − usedGames, never below zero. */
  freeGames: number
  /** This plan has no gym time here on this weekend at all (owner ruling
   *  2026-08-05, #1: the Haber case). It is still a legitimate destination —
   *  taking it IS the operator asserting they have it — and a caller has to be
   *  able to say so out loud before it acts. */
  backup: boolean
}

/**
 * WHERE A GRADE COULD GO ON THIS WEEKEND (owner ruling 2026-08-06, the
 * overriding one: AVAILABILITY IS NO LONGER A RESTRICTION ANYWHERE).
 *
 * The only thing that can stop a placement is the games already in that building
 * that weekend. Nothing else: not whether the plan attached the gym, not whether
 * anybody phoned it, not what hours step 2 happens to hold for it. Placing or
 * moving something IS the availability claim, and it claims the whole day and
 * every court — confirmed when the operator does it by hand, assumed when the
 * solver does it.
 *
 * So every gym in the plan's roster is a room on every weekend, priced the same
 * way: its WIRED courts less the buffer, over its full day, minus the games
 * already sitting in it. An attached gym is not measured against the slice of
 * itself this calendar happens to rent, and a gym nobody has asked about is not
 * measured against zero — both are the same building with the same floor.
 *
 * TWO THINGS STILL BITE, and neither is availability:
 *  - games already placed there. That is the one honest refusal, and it is the
 *    only one any caller may print;
 *  - a court correction ("Haber only gave us three that Saturday"), because the
 *    operator typed that number about that date on purpose. It is a ceiling they
 *    asserted, not a booking they failed to make.
 */
export function weekendRooms(
  state: PlannerState,
  weekend: PlannerWeekend,
  /** Games each building already holds on this weekend, by venueId. */
  used: Record<string, number> = {},
  /** "<sessionId>|<venueId>" → courts that gym can really give that weekend. */
  courtCaps: Record<string, number> = {}
): BuildingRoom[] {
  const buffer = state.courtBuffer ?? 0
  const roster = state.gyms ?? []
  const capFor = (venueId: string) => courtCaps[courtCapKey(weekend.sessionId, venueId)]
  const rows: BuildingRoom[] = []

  const row = (
    venue: PlannerVenue,
    courts: number,
    capacityGames: number,
    backup: boolean
  ): BuildingRoom => {
    const usedGames = Math.max(0, used[venue.venueId] ?? 0)
    return {
      venueId: venue.venueId,
      name: venue.name,
      role: venue.role,
      courts,
      capacityGames,
      usedGames,
      freeGames: Math.max(0, capacityGames - usedGames),
      backup,
    }
  }

  /**
   * THE WHOLE BUILDING, FULL DAY, EVERY COURT. One price for every gym in the
   * roster, whether this weekend has it attached or has never heard of it: what
   * the building could hold if the league took all of it, which since the
   * 2026-08-06 ruling is exactly what placing something there claims.
   *
   * A gym the weekend already rents is measured against the SAME number, not
   * against the slice it happens to rent, because renting more of it is what the
   * move does. The only thing that shrinks it is a court correction, which the
   * operator typed about that date on purpose.
   */
  const roomFor = (gym: PlanWorldGym, attached: PlannerVenue | null): BuildingRoom => {
    /**
     * A GYM WITH NO USABLE RANGE STILL RUNS A DAY (owner ruling 2026-08-06).
     * Hours are availability, and availability stopped being a refusal: a gym
     * somebody left shut, or never gave hours to, is priced at the ordinary day
     * the plan assumes everywhere else. Placing games there claims that day.
     */
    const opens =
      gamesPerCourtDay(
        gym.openTime ?? DEFAULT_OPEN,
        gym.closeTime ?? DEFAULT_CLOSE,
        state.gameSlotMinutes
      ) > 0
    const full = plannerVenueOn(
      opens ? gym : { ...gym, openTime: null, closeTime: null },
      { dayCount: weekend.dayCount },
      state
    )
    const cap = capFor(gym.venueId)
    // The roster is the authority on the floor; a weekend already using more
    // courts than the roster claims keeps them, because that is real too.
    const wired = Math.max(usableCourtCount(gym.courts, buffer), attached ? courtsWiredAt(attached) : 0)
    const courts = Math.min(wired, cap ?? Number.POSITIVE_INFINITY)
    // Priced at the building's OWN full day, and never below what the weekend is
    // already holding it at: an hours exception on this date is a fact about
    // this calendar, not a ceiling on the building.
    const capacityGames = Math.max(
      buildingCapacityAt(full, courts),
      attached ? buildingCapacityAt(attached, courts) : 0
    )
    return row(
      { ...full, name: attached?.name ?? full.name, role: attached?.role ?? full.role },
      courts,
      capacityGames,
      attached === null
    )
  }

  const attachedBy = new Map(weekend.venues.map((v) => [v.venueId, v]))
  // Attached first, in the board's own order, so the sections and the ⋯ menu
  // walk them the same way twice.
  for (const venue of orderedVenues(weekend.venues)) {
    const gym = roster.find((g) => g.venueId === venue.venueId)
    if (gym) rows.push(roomFor(gym, venue))
    // A weekend carrying a gym the roster dropped is still holding real games,
    // so it keeps its row at what the attachment says.
    else {
      const cap = capFor(venue.venueId)
      const courts = Math.min(courtsWiredAt(venue), cap ?? Number.POSITIVE_INFINITY)
      rows.push(row(venue, courts, buildingCapacityAt(venue, courts), false))
    }
  }

  /**
   * And every OTHER gym the plan has, in name order. None of them is skipped any
   * more: a gym with no hours recorded still runs a default day, and "we have not
   * phoned them" was never a reason the operator could not put games there. Only
   * a gym with no courts at all, or one a court correction has closed outright,
   * genuinely holds nothing.
   */
  const ranks = gymRanks(roster)
  const others = roster
    .filter((g) => !attachedBy.has(g.venueId))
    .sort((a, b) => (ranks.get(a.venueId) ?? 0) - (ranks.get(b.venueId) ?? 0))
  for (const gym of others) {
    const room = roomFor(gym, null)
    if (room.capacityGames <= 0) continue
    rows.push(room)
  }
  return rows
}

/**
 * A GYM THE OPERATOR ASSERTED, in the working copy (owner ruling 2026-08-05,
 * #1). They dragged a backup gym onto a weekend, and by his standing rule a drag
 * means they checked: the board now computes as though that gym is available
 * there, so the placement becomes an ordinary rented block instead of a refusal.
 *
 * It lands on the STATE the board draws, so every number downstream follows at
 * once — the sections, the fraction, the blocks, the ask sheet and the rail —
 * and nothing has to know an assertion happened. Saving is what writes it into
 * the plan's own world (withAssertedGymsInWorld) or, on the plan the season
 * runs, onto the season's attachment.
 */
export function withAssertedGyms(
  state: PlannerState,
  asserted: Record<string, string[]>,
  /**
   * Is this a booking the league HAS, or a room the solver may book? A gym the
   * operator dropped by hand is theirs by his standing rule (a drag means they
   * checked), so it defaults to a booking. solvableState passes false: the rooms
   * it puts on the table are candidates, and the draw books them as assumed.
   */
  booked = true
): PlannerState {
  const rows = Object.entries(asserted).filter(([, venueIds]) => (venueIds ?? []).length > 0)
  if (rows.length === 0) return state
  const wanted = new Map(rows.map(([sessionId, venueIds]) => [sessionId, venueIds]))
  const roster = state.gyms ?? []
  let touchedAny = false
  const windows = state.windows.map((win) => {
    let touchedWindow = false
    const weekends = win.weekends.map((w) => {
      const venueIds = wanted.get(w.sessionId)
      if (!venueIds) return w
      const add: PlannerVenue[] = []
      for (const venueId of venueIds) {
        if (w.venues.some((v) => v.venueId === venueId)) continue
        const gym = roster.find((g) => g.venueId === venueId)
        if (!gym) continue
        add.push({ ...plannerVenueOn(gym, { dayCount: w.dayCount }, state), booked })
      }
      if (add.length === 0) return w
      touchedWindow = true
      touchedAny = true
      const venues = orderedVenues([...w.venues, ...add])
      return {
        ...w,
        // A weekend with a gym on it is a weekend this plan runs, which is the
        // same rule withGymOnWeekend keeps in the world itself.
        chosen: true,
        venues,
        capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
        largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
      }
    })
    return touchedWindow ? { ...win, weekends } : win
  })
  return touchedAny ? { ...state, windows } : state
}

/**
 * THIS GYM, THIS DATE, THESE HOURS (owner ruling 2026-08-06, #5).
 *
 * The per-weekend hours editor, in the shape the BOARD computes on. withWeekend-
 * GymHours does the same thing to a plan's world, and both have to exist: the
 * world is what a save writes down, and this is what the operator sees move the
 * instant they press it, without a round trip.
 *
 * The arithmetic is buildSlots', the same one every capacity on this screen is
 * derived from: courts × days × floor(window ÷ slot). Nothing downstream has to
 * know an exception happened — the section meter, the weekend fraction, the
 * blocks, the ask sheet and the solver all read the capacity that comes out.
 *
 * Keyed by courtCapKey ("<sessionId>|<venueId>"), so the two working-copy
 * overrides on this board are keyed the same way. A gym nobody gave hours to
 * comes back as the very same object.
 */
export function withWeekendHours(
  state: PlannerState,
  hours: Record<string, { startTime: string; endTime: string }>
): PlannerState {
  if (Object.keys(hours).length === 0) return state
  const slot = state.gameSlotMinutes ?? DEFAULT_SLOT_MINUTES
  let touchedAny = false
  const windows = state.windows.map((win) => {
    let touchedWindow = false
    const weekends = win.weekends.map((w) => {
      let touched = false
      const venues = w.venues.map((v) => {
        const want = hours[courtCapKey(w.sessionId, v.venueId)]
        if (!want) return v
        const perCourtDay = gamesPerCourtDay(want.startTime, want.endTime, slot)
        const courts = Math.max(0, v.courts ?? courtsWiredAt(v))
        const days = Math.max(1, v.days ?? w.dayCount ?? DEFAULT_DAY_COUNT)
        touched = true
        return {
          ...v,
          startTime: want.startTime,
          endTime: want.endTime,
          courts,
          days,
          courtDays: courts * days,
          hoursPerCourtDay: perCourtDay * (slot / 60),
          capacityGames: courts * days * perCourtDay,
        }
      })
      if (!touched) return w
      touchedWindow = true
      touchedAny = true
      return {
        ...w,
        venues,
        capacityGames: venues.reduce((sum, v) => sum + v.capacityGames, 0),
        largestVenueCapacity: Math.max(0, ...venues.map((v) => v.capacityGames)),
      }
    })
    return touchedWindow ? { ...win, weekends } : win
  })
  return touchedAny ? { ...state, windows } : state
}

/**
 * The hours a gym runs on one weekend as the board has them: the exception where
 * there is one, else the gym's own range, else the default day. What the per-date
 * editor opens on.
 */
export function weekendGymHours(
  state: PlannerState,
  weekend: PlannerWeekend,
  venueId: string
): { startTime: string; endTime: string } {
  const venue = weekend.venues.find((v) => v.venueId === venueId)
  const gym = (state.gyms ?? []).find((g) => g.venueId === venueId)
  return {
    startTime: venue?.startTime ?? gym?.openTime ?? DEFAULT_OPEN,
    endTime: venue?.endTime ?? gym?.closeTime ?? DEFAULT_CLOSE,
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
                  fridayCourts: v.fridayCourts,
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
      u.key === key
        ? {
            ...u,
            teams: next,
            expected: next,
            included: next > 0 || u.included,
            // The operator WROTE this number, zero included. It is what keeps a
            // deliberate 0 from reading as "never estimated" and reseeding off
            // the registration count on step 1.
            source: "expected",
          }
        : u
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

/**
 * THE ORDER THE LEAGUE RENTS IN (owner ruling 2026-08-06: "select the home, then
 * the next one, and the following one").
 *
 * The roster ARRAY is the order, so this is a move within it and nothing new is
 * stored. The home gym is not in the ordering at all — it is always first,
 * because the league owns it — so moving a pool gym walks it past the other pool
 * gyms only.
 *
 * It is a preference, never a gate. Occupancy is the only gate: this decides
 * which building the draw reaches for when two of them cost the same, and the
 * order every list on the screen is drawn in.
 */
export function withGymOrder(
  world: PlanWorld,
  venueId: string,
  /** One step either way, or an absolute seat among the pool gyms. */
  to: "up" | "down" | number
): PlanWorld {
  const gyms = worldGyms(world)
  const home = gyms.filter((g) => g.role === "home")
  const pool = gyms.filter((g) => g.role !== "home")
  const at = pool.findIndex((g) => g.venueId === venueId)
  if (at < 0) return world
  const want = to === "up" ? at - 1 : to === "down" ? at + 1 : Math.floor(to)
  const seat = Math.max(0, Math.min(pool.length - 1, want))
  if (seat === at) return world
  const next = [...pool]
  const [moved] = next.splice(at, 1)
  next.splice(seat, 0, moved)
  return rebuild({ ...world, gyms: [...home, ...next] })
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

/**
 * EVERY ASSERTION THE BOARD MADE, written into the plan's own world (owner
 * ruling 2026-08-05, #1). The board lets an operator drop a backup gym onto a
 * weekend and computes on it immediately; this is the other half of that
 * promise, run when the plan document is saved, so reopening the plan finds the
 * gym really on that weekend rather than the placement stranded again.
 */
export function withAssertedGymsInWorld(
  world: PlanWorld,
  asserted: Record<string, string[]>
): PlanWorld {
  let next = world
  for (const [sessionId, venueIds] of Object.entries(asserted)) {
    for (const venueId of venueIds ?? []) next = withGymOnWeekend(next, sessionId, venueId, true)
  }
  return next
}

/**
 * EVERY PER-DATE HOURS EXCEPTION THE BOARD MADE, written into the plan's own
 * world (owner ruling 2026-08-06, #5). The board applies them to the state it
 * draws the instant they are pressed (withWeekendHours); this is the other half
 * of that promise, run when the plan document is saved, so reopening the plan
 * finds the gym really running those hours on that date.
 *
 * Keyed by courtCapKey, the way the working copy holds them.
 */
export function withWeekendHoursInWorld(
  world: PlanWorld,
  hours: Record<string, { startTime: string; endTime: string }>
): PlanWorld {
  let next = world
  for (const [key, window] of Object.entries(hours)) {
    const [sessionId, venueId] = key.split("|")
    if (!sessionId || !venueId) continue
    next = withWeekendGymHours(next, sessionId, venueId, window)
  }
  return next
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
 * WHEN WOULD THE LEAGUE LIKE TO RUN (owner ruling 2026-08-05 #3, revised
 * 2026-08-06). A chosen weekend is a PREFERENCE and nothing else: the draw
 * fills these dates first. Choosing one attaches NO gym, not even the home
 * gym — buildings and games are placed on the board, on any date, and step 2
 * is only the league saying which weekends it would rather use.
 *
 * Turning one OFF still takes every gym off it, because a weekend the plan does
 * not run holds nothing.
 */
export function withWeekendChosen(
  world: PlanWorld,
  sessionId: string,
  chosen: boolean
): PlanWorld {
  return rebuild({
    ...world,
    windows: (world.windows ?? []).map((win) => ({
      ...win,
      weekends: (win.weekends ?? []).map((w) =>
        w.sessionId !== sessionId
          ? w
          : chosen
            ? { ...w, chosen: true }
            : { ...w, chosen: false, venues: [] }
      ),
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

/* ----------------------- the board's whole season ------------------------ */

/**
 * THE BOARD SHOWS THE WHOLE SEASON (owner ruling 2026-08-06, slice B2).
 *
 * A month column used to draw only the weekends this plan had already taken,
 * with the Saturdays it had not hidden behind an "Add a weekend" disclosure at
 * the foot of the column. So "there is no room in November" and "we never put
 * the 21st on this plan" looked identical, and the dates a plan could still
 * grow into were the one thing an operator had to go and find.
 *
 * Every Saturday of the season's span is on the board now. A date with anything
 * on it is a full card; a date the plan is not using is a GHOST: one thin
 * dashed row, the date, and the words "not planned". A ghost is a real drop
 * target under the board's one capacity rule, and the first drop turns it into
 * a card.
 */

/** A date this plan is not using: thin, dashed, and droppable. */
export interface GhostDate {
  /** Stable key for React and for a drive: the session, else the Saturday. */
  key: string
  /** The Saturday this weekend starts on. */
  dateISO: string
  label: string
  /**
   * The session behind it, or NULL when the season has no weekend on this
   * Saturday at all. A drop onto one of those creates the session first (see
   * dropOnGhost in board-verbs): the drop itself is the intent, so nothing is
   * asked, and a weekend EXISTING is season shape rather than a booking.
   */
  sessionId: string | null
  /** Days the weekend runs, for the room arithmetic a drop is measured against. */
  dayCount: number
}

/** One row of a month column: a weekend with something on it, or a ghost. */
export type BoardDate =
  | { kind: "weekend"; key: string; dateISO: string; weekend: PlannerWeekend }
  | { kind: "ghost"; key: string; dateISO: string; ghost: GhostDate }

export interface BoardColumn {
  label: string
  /** The round every weekend of this month shares, when they share one: the
   *  name the column header wears (owner 2026-08-07). */
  roundName?: string
  /** The weekends this month really has, for the bench and the month's own
   *  games rate. Ghost dates are deliberately not in here: nothing plays on
   *  them, so nothing may be counted off them. */
  weekends: PlannerWeekend[]
  /** Every date of the month, in order, cards and ghosts together. */
  dates: BoardDate[]
}

/** The day part of an ISO date, which is the only part two sources agree on. */
const dayKey = (iso: string | null | undefined): string => String(iso ?? "").slice(0, 10)

/**
 * The month column a date belongs in, spelled exactly the way buildPlannerState
 * spells a window ("Oct 2026"). A Saturday whose month has no session at all
 * still needs a column, and it has to be the same column the month would have
 * had if the season had one.
 */
export function monthColumnLabel(dateISO: string): string {
  const d = new Date(dateISO)
  return `${d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`
}

/**
 * IS THIS DATE A GHOST? A weekend this plan did not choose, with no gym time on
 * it and nothing on the board. A weekend the operator DID choose keeps its card
 * even while it is empty: they said this plan runs it, and a card is what says
 * so back.
 */
export function isGhostWeekend(
  weekend: Pick<PlannerWeekend, "sessionId" | "chosen" | "venues" | "assigned">,
  /** Whether the working copy has anything on it: grades, or a gym somebody
   *  placed by hand. The saved calendar alone is not enough to answer. */
  hasContent: (sessionId: string) => boolean = () => false
): boolean {
  // The module's one reading of "does this plan run this weekend"
  // (weekendChosen), so a ghost and a chosen weekend can never both be true.
  const chosen = weekend.chosen ?? weekend.venues.length > 0
  return (
    !chosen &&
    weekend.venues.length === 0 &&
    (weekend.assigned ?? []).length === 0 &&
    !hasContent(weekend.sessionId)
  )
}

/**
 * EVERY SATURDAY OF THE SEASON, IN ITS MONTH COLUMN. The plan's own weekends
 * give the cards and most of the ghosts; step 2's grid gives the Saturdays the
 * season never created a session for, which is the other half of "the whole
 * season" and the half that used to be invisible.
 *
 * A month with nothing but ghosts still gets a column, in its chronological
 * place, because a month you have not planned is a fact about the season and
 * not an absence.
 */
export function boardColumns(
  state: PlannerState,
  /** Every Saturday the season spans, from step 2's grid. */
  saturdays: Array<{
    satDateISO: string | null
    sessionId: string | null
    label: string
    dayCount?: number
  }>,
  hasContent: (sessionId: string) => boolean = () => false
): BoardColumn[] {
  const ghostOf = (weekend: PlannerWeekend): BoardDate => ({
    kind: "ghost",
    key: weekend.sessionId,
    dateISO: weekend.dateISO,
    ghost: {
      key: weekend.sessionId,
      dateISO: weekend.dateISO,
      label: weekend.label,
      sessionId: weekend.sessionId,
      dayCount: weekend.dayCount ?? DEFAULT_DAY_COUNT,
    },
  })

  const columns: BoardColumn[] = state.windows.map((win) => ({
    label: win.label,
    ...(win.roundName ? { roundName: win.roundName } : {}),
    weekends: win.weekends,
    dates: win.weekends.map((w) =>
      isGhostWeekend(w, hasContent)
        ? ghostOf(w)
        : { kind: "weekend" as const, key: w.sessionId, dateISO: w.dateISO, weekend: w }
    ),
  }))

  const seen = new Set(
    state.windows.flatMap((win) => win.weekends.map((w) => dayKey(w.dateISO)))
  )
  /**
   * THE COLUMN A CALENDAR MONTH IS ALREADY IN. A window is named after the month
   * it STARTS in, and a season is free to hang a first-of-November weekend under
   * October; a Saturday of that month belongs beside it either way. Only a month
   * no column holds at all gets a column of its own.
   */
  const byMonth = new Map<string, BoardColumn>()
  for (const column of columns) {
    for (const w of column.weekends) {
      const month = dayKey(w.dateISO).slice(0, 7)
      if (month && !byMonth.has(month)) byMonth.set(month, column)
    }
  }
  /** The day a column starts on, for putting a new month in its place. */
  const startsOn = (column: BoardColumn) =>
    column.dates.map((d) => dayKey(d.dateISO)).filter(Boolean).sort()[0] ?? ""

  for (const sat of saturdays) {
    if (!sat.satDateISO) continue
    const day = dayKey(sat.satDateISO)
    if (!day || seen.has(day)) continue
    seen.add(day)
    let column = byMonth.get(day.slice(0, 7))
    if (!column) {
      column = { label: monthColumnLabel(sat.satDateISO), weekends: [], dates: [] }
      byMonth.set(day.slice(0, 7), column)
      // In its own place in the season, not appended to the end of it.
      const at = columns.findIndex((c) => {
        const start = startsOn(c)
        return start !== "" && start > day
      })
      columns.splice(at < 0 ? columns.length : at, 0, column)
    }
    column.dates.push({
      kind: "ghost",
      key: day,
      dateISO: sat.satDateISO,
      ghost: {
        key: day,
        dateISO: sat.satDateISO,
        label: sat.label,
        sessionId: sat.sessionId,
        dayCount: sat.dayCount ?? DEFAULT_DAY_COUNT,
      },
    })
  }

  for (const column of columns) {
    column.dates.sort((a, b) => dayKey(a.dateISO).localeCompare(dayKey(b.dateISO)))
  }
  return columns
}

/**
 * A DATE WITH NOTHING ON IT, in the shape the room arithmetic reads. What a
 * ghost is measured against: no gyms attached, so weekendRooms answers with the
 * whole roster as backups — which is exactly the board's one capacity rule
 * (owner ruling 2026-08-06, #3), where what a drop MAY assert is what counts.
 */
export function bareWeekend(sessionId: string, dayCount = DEFAULT_DAY_COUNT): PlannerWeekend {
  return {
    sessionId,
    label: "",
    dateISO: "",
    dayCount,
    chosen: false,
    capacityGames: 0,
    largestVenueCapacity: 0,
    venues: [],
    targetGamesPerTeam: 2,
    assigned: [],
    assignedVenues: {},
  }
}

/**
 * A WEEKEND THE SEASON HAS JUST GROWN, in the state the board computes on
 * (owner ruling 2026-08-06, slice B2). The season-level twin of `withWeekend`,
 * which does the same to a plan's saved world.
 *
 * It lands with no gyms and unchosen, because that is the truth of it: the date
 * exists now, and nobody has claimed a building on it. The drop that created it
 * asserts its gym a moment later through the ordinary assertion path, and the
 * ghost becomes a card the instant it does.
 */
export function withWeekendInState(
  state: PlannerState,
  windowLabel: string,
  weekend: { sessionId: string; label: string; dateISO: string; dayCount?: number }
): PlannerState {
  if (state.windows.some((win) => win.weekends.some((w) => w.sessionId === weekend.sessionId))) {
    return state
  }
  const window = state.windows.find((win) => win.label === windowLabel)
  const row: PlannerWeekend = {
    sessionId: weekend.sessionId,
    label: weekend.label,
    dateISO: weekend.dateISO,
    dayCount: weekend.dayCount ?? DEFAULT_DAY_COUNT,
    chosen: false,
    capacityGames: 0,
    largestVenueCapacity: 0,
    venues: [],
    // The month's own rate, so a grade dropped here brings the same games it
    // would bring to any other weekend of that month.
    targetGamesPerTeam:
      window?.weekends[0]?.targetGamesPerTeam ??
      state.windows.flatMap((win) => win.weekends)[0]?.targetGamesPerTeam ??
      2,
    assigned: [],
    assignedVenues: {},
  }
  if (!window) {
    const at = state.windows.findIndex(
      (win) => (win.weekends[0]?.dateISO ?? "") > weekend.dateISO
    )
    const windows = [...state.windows]
    windows.splice(at < 0 ? windows.length : at, 0, { label: windowLabel, weekends: [row] })
    return { ...state, windows }
  }
  return {
    ...state,
    windows: state.windows.map((win) =>
      win.label !== windowLabel
        ? win
        : {
            ...win,
            weekends: [...win.weekends, row].sort((a, b) =>
              dayKey(a.dateISO).localeCompare(dayKey(b.dateISO))
            ),
          }
    ),
  }
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
      phase: win.phase,
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
    ...(state.fridayStart ? { fridayStart: state.fridayStart } : {}),
    ...(state.fridayEnd ? { fridayEnd: state.fridayEnd } : {}),
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

/**
 * A PLAN SAVED BEFORE PLANS HAD A ROSTER (owner ruling 2026-08-06).
 *
 * `gyms` arrived after the first plans did, so an older document either has none
 * at all or only the buildings its weekends happened to mention. Every control
 * that ranks, books or reorders a gym reads that roster, so those plans opened
 * onto a step 2 with half its controls missing — no rank arrows, no bookings
 * picker — and nothing on screen said why.
 *
 * They are healed on open, the same way grades are: the season's own buildings
 * are folded in, keeping whatever the plan already knew about the ones it had
 * (its courts, its hours, its role, its place in the order), and appending the
 * rest at the back. Nothing the operator chose is overwritten, and the healed
 * roster is saved forward so it only ever happens once.
 */
export function withHealedGyms(world: PlanWorld, seasonGyms: PlanWorldGym[]): PlanWorld {
  const known = worldGyms(world)
  const have = new Map(known.map((g) => [g.venueId, g]))
  const missing = seasonGyms.filter((g) => !have.has(g.venueId))
  if (missing.length === 0 && (world.gyms ?? []).length === known.length) return world
  // A plan that already named a home gym keeps it: the season's opinion about
  // which building it owns must not overwrite the operator's.
  const hasHome = known.some((g) => g.role === "home")
  return rebuild({
    ...world,
    gyms: [
      ...known.map((g) => ({ ...g })),
      ...missing.map((g) => ({ ...g, role: hasHome ? ("pool" as VenueRole) : g.role })),
    ],
  })
}

/** True when this world predates rosters, so opening it should heal one in. */
export function needsGymHealing(world: PlanWorld, seasonGyms: PlanWorldGym[]): boolean {
  return withHealedGyms(world, seasonGyms) !== world
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

  // THE LEAGUE'S OWN ORDER (owner ruling 2026-08-06): the building it owns, then
  // the pool as the operator arranged it. Gyms the season grew after this plan
  // was made have no seat yet, so they land after the ones that do.
  const ranks = gymRanks(roster)
  const rows: VenueGridRow[] = [...roster, ...extra]
    .filter((gym) => byId.has(gym.venueId))
    .sort(
      (a, b) =>
        (a.role === "home" ? 0 : 1) - (b.role === "home" ? 0 : 1) ||
        (ranks.get(a.venueId) ?? Number.MAX_SAFE_INTEGER) -
          (ranks.get(b.venueId) ?? Number.MAX_SAFE_INTEGER) ||
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

/**
 * REMOVE FROM THIS PLAN, ENTIRELY (owner ruling 2026-08-07, #8 first half:
 * removal, two levels). Stronger than withUnitIncluded: that keeps the row,
 * out, with its number intact for one tap to restore. This drops the unit
 * object outright, so the grade falls back to the season's own fold-in row —
 * "Not in this plan yet" — with no leftover estimate to explain, and the
 * add-a-grade stepper is the restore path. The season's division is
 * untouched; only this plan forgets it ever had a number for that grade.
 */
export function withUnitRemoved(world: PlanWorld, key: string): PlanWorld {
  return {
    ...world,
    units: (world.units ?? []).filter((u) => u.key !== key),
  }
}
