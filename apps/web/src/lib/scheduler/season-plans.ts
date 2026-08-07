import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { buildPlannerState } from "./planner"
import { currentAssignment, expectedTeamUpdates, type PlannerState } from "./planner-core"
import type {
  PlanAssignment,
  PlanSettings,
  PlanVenues,
  PlanWorld,
  PlanWorldGym,
} from "./plan-documents"
import {
  DEFAULT_SLOT_MINUTES,
  freshWorld,
  settingsOf,
  unitIncluded,
  weekendChosen,
  worldFromState,
  worldGyms,
  worldWeekends,
} from "./plan-world"
import {
  applyVenueCourtsToSessionDays,
  applyVenueHoursToSessionDays,
  attachVenueToSession,
  defaultCourtIdsForVenue,
  detachVenueFromSession,
} from "@/lib/seasons/venue-propagation"

/**
 * Plans as documents (owner 2026-08-02). A season holds MANY named calendars
 * and exactly one of them is active — the one written onto
 * SeasonSession.unitKeys/unitVenues, which is what every downstream surface
 * has always read. The routes live in api/seasons/[id]/plans/**; this module
 * holds everything they share, because a route file may export nothing but
 * HTTP handlers (same reason planner-auth.ts exists).
 */

/** The calendar shapes live in plan-documents.ts (pure), because the client
 *  steps speak them too. Re-exported here so every server caller keeps its
 *  existing import. */
export type { PlanAssignment, PlanVenues } from "./plan-documents"

/** The season's own published calendar, snapshotted the first time an
 *  operator opens the plan list. NPH's schedule is where this season came
 *  from, so it is the name the operator recognises. */
export const IMPORTED_PLAN_NAME = "NPH plan"

/** The imported calendar is a REFERENCE: it is what the league actually
 *  published, so editing it in place would destroy the only thing the
 *  operator can compare their own plans against. Renaming is fine. */
export const IMPORTED_PLAN_READONLY_MESSAGE =
  "This is the imported reference plan. Save your changes as a new plan."

/** Deleting the active plan would leave the season's sessions holding a
 *  calendar no document describes. */
export const ACTIVE_PLAN_DELETE_MESSAGE =
  "This plan is active. Activate another one first, then delete this."

/** The imported reference is the only record of what the league published, so
 *  it is the one plan that cannot be thrown away (owner ruling 2026-08-05). */
export const IMPORTED_PLAN_DELETE_MESSAGE =
  "This is the imported reference plan, the record of what the league published. It cannot be deleted."

/** Shapes shared with POST /planner/apply: seeds use non-UUID ids, so plain
 *  strings only — never .uuid(). */
export const assignmentSchema = z.record(z.string(), z.array(z.string()).max(50))
export const venuesSchema = z.record(z.string(), z.record(z.string(), z.string()))

/** What a plan is written onto the wire as. Only "proposed" (straight off the
 *  solver) and "manual" (the operator's own edit) may be asked for —
 *  "imported" is reserved for the snapshot below, so nobody can mint a second
 *  read-only reference. */
export const planSourceSchema = z.enum(["proposed", "manual"])

/** The list row: enough for the dropdown, never the whole document. */
export const PLAN_LIST_SELECT = {
  id: true,
  name: true,
  source: true,
  isActive: true,
  updatedAt: true,
} as const

/**
 * The WORLD a plan is being saved in (owner 2026-08-02: "a new plan also could
 * have different venues. It could have different settings, so how are you
 * going to save it and how do you remember? It could be a different team
 * combination").
 *
 * The planner's own state IS the world — it is already the pure, serializable
 * input every number on the board is computed from: the estimate per grade,
 * the gyms each weekend with their capacity and fill order, the games each
 * team is promised. Snapshotting anything else would be a second description
 * of the season to drift from the one the board runs on.
 *
 * The per-weekend calendar is stripped out: `assigned` and `assignedVenues`
 * are what the plan's OWN assignment and venues columns hold, and a plan must
 * never carry two answers to where a grade plays.
 */
export function snapshotSettings(state: PlannerState): PlanSettings {
  return settingsOf(worldFromState(state))
}

/** The season's world as it stands right now, for a plan about to be written
 *  down — and, since the 2026-08-05 rulings, for the ACTIVE plan on every read,
 *  because the active plan IS the season and two answers would be one too many. */
export async function currentSettings(seasonId: string): Promise<PlanSettings> {
  return snapshotSettings(await buildPlannerState(seasonId))
}

/**
 * A NEW PLAN'S WORLD (owner ruling 2026-08-05): the season's grades with their
 * numbers, and NO gym time assumed at all. Built here rather than on the client
 * so "fresh" means one thing everywhere.
 */
export async function freshSettings(seasonId: string): Promise<PlanSettings> {
  return settingsOf(freshWorld(await buildPlannerState(seasonId)))
}

/* -------------------- a world the client sent, checked ------------------- */

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const gymSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1).max(200),
  city: z.string().max(200).nullish(),
  role: z.enum(["home", "pool"]),
  courts: z.number().int().min(0).max(30),
  openTime: clock.nullish(),
  closeTime: clock.nullish(),
  seasonVenueId: z.string().nullish(),
})

const worldVenueSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1).max(200),
  capacityGames: z.number().min(0).max(100000),
  role: z.enum(["home", "pool"]).optional(),
  fillOrder: z.number().min(0).max(10000),
  courts: z.number().min(0).max(1000).optional(),
  courtsHeld: z.number().min(0).max(1000).optional(),
  courtDays: z.number().min(0).max(100000).optional(),
  days: z.number().min(0).max(14).optional(),
  hoursPerCourtDay: z.number().min(0).max(24).optional(),
  startTime: clock.nullish(),
  endTime: clock.nullish(),
  fridayCourts: z.number().int().min(0).max(30).optional(),
})

const worldWeekendSchema = z.object({
  sessionId: z.string().min(1),
  label: z.string().max(200),
  dateISO: z.string().max(40).optional(),
  dayCount: z.number().int().min(1).max(14).optional(),
  chosen: z.boolean().optional(),
  capacityGames: z.number().min(0).max(100000),
  largestVenueCapacity: z.number().min(0).max(100000).optional(),
  targetGamesPerTeam: z.number().min(0).max(20),
  roundName: z.string().max(60).optional(),
  venues: z.array(worldVenueSchema).max(40),
})

const worldUnitSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1).max(80),
  teams: z.number().int().min(0).max(200),
  divisionIds: z.array(z.string()).max(60).optional(),
  alternate: z.boolean().optional(),
  approved: z.number().int().min(0).max(2000).optional(),
  expected: z.number().int().min(0).max(2000).optional(),
  source: z.enum(["approved", "expected", "none"]).optional(),
  included: z.boolean().optional(),
})

/** What a client may send as a plan's world. Shapes and ranges only: WHICH ids
 *  are real is checked against the season in sanitizePlanWorld below, because
 *  zod cannot know what this season holds. */
export const planWorldSchema = z.object({
  seasonId: z.string().optional(),
  units: z.array(worldUnitSchema).max(60),
  windows: z
    .array(z.object({ label: z.string().max(60), weekends: z.array(worldWeekendSchema).max(40) }))
    .max(24),
  gamesPerTeam: z.number().min(0).max(200).optional(),
  gyms: z.array(gymSchema).max(40).optional(),
  courtBuffer: z.number().int().min(0).max(10).optional(),
  /** Team-exclude (owner ruling 8, 2026-08-07): specific team submissions
   *  this plan leaves out of its own calendar. Ids only — sanitizePlanWorld
   *  below clamps them to real submissions of this season, same as every
   *  other id this schema accepts. */
  excludedTeamIds: z.array(z.string()).max(500).optional(),
  gameSlotMinutes: z.number().int().min(10).max(240).optional(),
  fridayStart: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  fridayEnd: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
})

export const planSettingsSchema = z.object({
  capturedAt: z.string().max(40).optional(),
  state: planWorldSchema,
})

/** Team-exclude (owner ruling 8, 2026-08-07) widens PlanWorld with the one
 *  field this ruling adds. Declared locally rather than in plan-documents.ts —
 *  that file is the client's own, in flight the same day — so this module
 *  stays self-contained; a zod-parsed world structurally satisfies it either
 *  way. */
export type PlanWorldWithExclusions = PlanWorld & { excludedTeamIds?: string[] }

/**
 * A world the operator edited, clamped to things this season actually has
 * (owner's original stance on plan settings: "a plan can never claim a world
 * the season was not in"). The NUMBERS are the operator's — that is the whole
 * point of a plan — but the IDS have to be real, or a plan could name a gym
 * from another league and the board would draw it.
 *
 * Unknown sessions, gyms and grades are dropped rather than 400ing: the honest
 * outcome of "the season deleted that weekend" is a plan without it.
 */
export async function sanitizePlanWorld(
  seasonId: string,
  world: PlanWorldWithExclusions
): Promise<PlanWorldWithExclusions> {
  const [sessions, seasonVenues, divisions, teamSubmissions] = await Promise.all([
    (prisma as any).seasonSession.findMany({ where: { seasonId }, select: { id: true } }),
    (prisma as any).seasonVenue.findMany({
      where: { seasonId },
      select: { id: true, venueId: true },
    }),
    (prisma as any).division.findMany({ where: { seasonId }, select: { id: true, ageGroup: true } }),
    // Ruling 8's clamp set: the season's own team submissions, id only, no
    // status filter — mirrors validSessions/validGrades below, which clamp
    // to "belongs to this season", not to any particular status.
    (prisma as any).teamSubmission.findMany({ where: { seasonId }, select: { id: true } }),
  ])
  const validSessions = new Set<string>(sessions.map((s: any) => s.id))
  const seasonVenueOf = new Map<string, string>(
    seasonVenues.map((sv: any) => [sv.venueId, sv.id])
  )
  const validGrades = new Set<string>(divisions.map((d: any) => `age:${d.ageGroup}`))
  const divisionsOf = new Map<string, string[]>()
  for (const d of divisions) {
    const key = `age:${d.ageGroup}`
    divisionsOf.set(key, [...(divisionsOf.get(key) ?? []), d.id])
  }
  const validTeamSubmissions = new Set<string>(teamSubmissions.map((ts: any) => ts.id))

  const gyms = (world.gyms ?? [])
    .filter((g) => seasonVenueOf.has(g.venueId))
    .map((g) => ({ ...g, seasonVenueId: seasonVenueOf.get(g.venueId) ?? null }))
  // Home is exclusive, whatever the client sent.
  const firstHome = gyms.find((g) => g.role === "home")?.venueId ?? null
  const roster: PlanWorldGym[] = gyms.map((g) => ({
    ...g,
    role: g.venueId === firstHome ? "home" : "pool",
  }))
  const rosterIds = new Set(roster.map((g) => g.venueId))

  return {
    ...world,
    seasonId,
    gyms: roster,
    units: (world.units ?? [])
      .filter((u) => validGrades.has(u.key))
      // divisionIds are the season's, never the client's: they are what an
      // activation writes estimates onto.
      .map((u) => ({ ...u, divisionIds: divisionsOf.get(u.key) ?? [] })),
    windows: (world.windows ?? []).map((win) => ({
      ...win,
      weekends: (win.weekends ?? [])
        .filter((w) => validSessions.has(w.sessionId))
        .map((w) => ({ ...w, venues: (w.venues ?? []).filter((v) => rosterIds.has(v.venueId)) })),
    })),
    // Ruling 8: only ids that are real team submissions of this season
    // survive. Absent stays absent — a plan that never named an exclusion
    // list keeps not having one.
    excludedTeamIds: world.excludedTeamIds?.filter((id) => validTeamSubmissions.has(id)),
  }
}

/* --------------------- activation: the world moves too ------------------- */

export interface WorldApplyResult {
  /** Grades whose estimate the season took from the plan. */
  gradesUpdated: number
  /** Gyms whose role, courts or hours moved. */
  gymsUpdated: number
  /** Weekend-gym attachments created, and released. */
  attached: number
  released: number
  /** Weekends where a gym could not be released because a game is on it. */
  blocked: number
  courtBuffer: number
}

/**
 * ACTIVATION APPLIES THE PLAN'S WORLD, not only its calendar (owner ruling
 * 2026-08-05, #5). Until now the season kept its own gyms, hours and estimates
 * and the confirmation had to say so; a plan that owns its world has to be able
 * to become the season, or "use this plan" would be a half-truth.
 *
 * The order matters and is deliberate:
 *   1. the grade estimates, because capacity is measured against them;
 *   2. the buffer, then each gym's role, courts and hours, because every
 *      attachment inherits from those;
 *   3. the per-weekend attachments: attach what the plan has, release what it
 *      does not. A gym a GAME is already on is never released — the same guard
 *      detachVenueFromSession has always had — and that is reported, not hidden.
 *
 * Not one transaction: attaching a gym to a weekend is itself several writes
 * across four tables through helpers that own that logic, and wrapping the whole
 * thing would hold a transaction open across dozens of statements. Each step is
 * individually idempotent and the caller re-reads the season afterwards, so a
 * failure leaves a season that is describable rather than half-written.
 */
export async function applyPlanWorld(
  seasonId: string,
  world: PlanWorld
): Promise<WorldApplyResult> {
  const out: WorldApplyResult = {
    gradesUpdated: 0,
    gymsUpdated: 0,
    attached: 0,
    released: 0,
    blocked: 0,
    courtBuffer: world.courtBuffer ?? 0,
  }

  /* 1. What each grade plans on. A grade the plan left OUT asks for nothing,
        which is an estimate of zero — the season's own way of saying it. */
  const divisions = await (prisma as any).division.findMany({
    where: { seasonId },
    select: { id: true, ageGroup: true },
  })
  const ownedDivisions = new Set<string>(divisions.map((d: any) => d.id))
  const byGrade = new Map<string, string[]>()
  for (const d of divisions) {
    byGrade.set(d.ageGroup, [...(byGrade.get(d.ageGroup) ?? []), d.id])
  }
  for (const unit of world.units ?? []) {
    const grade = unit.key.startsWith("age:") ? unit.key.slice(4) : null
    const ids = grade ? (byGrade.get(grade) ?? []) : []
    if (ids.length === 0) continue
    const total = unitIncluded(unit) ? unit.teams : 0
    for (const update of expectedTeamUpdates(ids, total)) {
      if (!ownedDivisions.has(update.divisionId)) continue
      await (prisma as any).division.update({
        where: { id: update.divisionId },
        data: { expectedTeams: update.expectedTeams },
      })
      out.gradesUpdated++
    }
  }

  /* 2. The courts the league holds back, then every gym's own three facts. */
  await (prisma as any).season.update({
    where: { id: seasonId },
    data: { courtBuffer: out.courtBuffer },
  })

  const seasonVenues = await (prisma as any).seasonVenue.findMany({
    where: { seasonId },
    select: { id: true, venueId: true, role: true, courtsAvailable: true },
  })
  const linkOf = new Map<string, any>(seasonVenues.map((sv: any) => [sv.venueId, sv]))
  const roster = worldGyms(world)
  const home = roster.find((g) => g.role === "home") ?? null

  for (const gym of roster) {
    const link = linkOf.get(gym.venueId)
    if (!link) continue
    const role = home && gym.venueId === home.venueId ? "home" : "pool"
    const courts = Math.max(0, Math.floor(gym.courts ?? 0))
    if (link.role !== role || (courts > 0 && link.courtsAvailable !== courts)) {
      await (prisma as any).seasonVenue.update({
        where: { id: link.id },
        data: { role, ...(courts > 0 ? { courtsAvailable: courts } : {}) },
      })
      out.gymsUpdated++
    }
    if (courts > 0) {
      // The courts have to reach the rows the SCHEDULER reads, or capacity
      // would still be yesterday's (the 2026-08-02 bug this helper exists for).
      const courtIds = await defaultCourtIdsForVenue(gym.venueId, courts)
      if (courtIds.length > 0) {
        await applyVenueCourtsToSessionDays(seasonId, gym.venueId, courtIds)
      }
    }
    if (gym.openTime && gym.closeTime) {
      const hours = [6, 0].map((dayOfWeek) => ({
        dayOfWeek,
        openTime: gym.openTime as string,
        closeTime: gym.closeTime as string,
      }))
      await (prisma as any).$transaction(
        hours.map((h) =>
          (prisma as any).seasonVenueHours.upsert({
            where: { seasonVenueId_dayOfWeek: { seasonVenueId: link.id, dayOfWeek: h.dayOfWeek } },
            create: {
              seasonVenueId: link.id,
              dayOfWeek: h.dayOfWeek,
              openTime: h.openTime,
              closeTime: h.closeTime,
            },
            update: { openTime: h.openTime, closeTime: h.closeTime },
          })
        )
      )
      await applyVenueHoursToSessionDays(seasonId, gym.venueId, hours)
    }
  }

  /* 3. Which gym is on which weekend. */
  const sessions = await (prisma as any).seasonSession.findMany({
    where: { seasonId, phase: "REGULAR" },
    select: {
      id: true,
      days: { select: { dayVenues: { select: { venueId: true } } } },
    },
  })
  const wanted = new Map<string, Set<string>>()
  for (const w of worldWeekends(world)) {
    wanted.set(
      w.sessionId,
      new Set(weekendChosen(w) ? (w.venues ?? []).map((v) => v.venueId) : [])
    )
  }

  for (const session of sessions) {
    // A weekend the plan says nothing about is left exactly as the season has
    // it: silence is not an instruction to empty a weekend.
    const want = wanted.get(session.id)
    if (!want) continue
    const has = new Set<string>(
      session.days.flatMap((d: any) => d.dayVenues.map((dv: any) => dv.venueId))
    )
    for (const venueId of want) {
      if (has.has(venueId)) continue
      const gym = roster.find((g) => g.venueId === venueId)
      const courtIds = await defaultCourtIdsForVenue(
        venueId,
        gym?.courts && gym.courts > 0 ? gym.courts : null
      )
      if (courtIds.length === 0) continue
      const result = await attachVenueToSession(
        seasonId,
        session.id,
        venueId,
        courtIds,
        gym?.openTime && gym?.closeTime
          ? { startTime: gym.openTime, endTime: gym.closeTime }
          : undefined,
        // The plan asserted this gym, so the season records it as the operator's
        // claim rather than the solver's guess.
        "confirmed"
      )
      if (result.daysAttached > 0) out.attached++
    }
    for (const venueId of has) {
      if (want.has(venueId)) continue
      const released = await detachVenueFromSession(seasonId, session.id, venueId)
      if (released.gamesBlocking > 0) out.blocked++
      else if (released.daysReleased > 0) out.released++
    }
  }

  return out
}

export { DEFAULT_SLOT_MINUTES }

/**
 * Rows written before plans remembered their world. Only the ACTIVE imported
 * plan can be healed late without inventing anything: its calendar is what the
 * sessions run right now, so the season's live world IS its world. Any other
 * null-settings plan keeps its quiet "saved before" line — pretending to know
 * the world it was drawn in would be a lie.
 */
async function healImportedSettings(seasonId: string): Promise<void> {
  const plan = await (prisma as any).seasonPlan.findFirst({
    where: { seasonId, source: "imported", isActive: true },
  })
  if (!plan || plan.settings != null) return
  await (prisma as any).seasonPlan.update({
    where: { id: plan.id },
    data: { settings: await currentSettings(seasonId) },
  })
}

/**
 * Read the season's saved calendar back out as a plan document. The board
 * already folds division keys up into grade clusters and gyms into unit
 * keys, so buildPlannerState IS the reader — no second interpretation of the
 * columns to drift from the one the wizard shows.
 */
export async function snapshotSavedCalendar(seasonId: string): Promise<{
  assignment: PlanAssignment
  venues: PlanVenues
  placements: number
  settings: PlanSettings
}> {
  const state = await buildPlannerState(seasonId)
  const assignment = currentAssignment(state)
  const venues: PlanVenues = {}
  let placements = 0
  for (const window of state.windows) {
    for (const weekend of window.weekends) {
      placements += weekend.assigned.length
      if (Object.keys(weekend.assignedVenues ?? {}).length > 0) {
        venues[weekend.sessionId] = { ...weekend.assignedVenues }
      }
    }
  }
  // The same state the calendar was read out of, so the imported plan's world
  // is exactly the one its calendar was published in.
  return { assignment, venues, placements, settings: snapshotSettings(state) }
}

/**
 * The lazy snapshot: the first time anyone asks a season for its plans, the
 * calendar already sitting on its sessions becomes plan #1 — named, imported,
 * and active. Seasons planned before plans-as-documents existed therefore
 * arrive with their history intact instead of an empty dropdown.
 *
 * Runs at most once per season by construction: it only fires on zero rows,
 * and only when the sessions actually hold a calendar (an untouched season
 * has nothing worth naming). The count is re-checked inside the transaction
 * so two tabs opening at once cannot both win, and a loser that slips through
 * anyway is swallowed — a duplicate reference plan is not worth 500ing a list.
 */
export async function ensureImportedPlan(seasonId: string): Promise<void> {
  const existing = await (prisma as any).seasonPlan.count({ where: { seasonId } })
  if (existing > 0) {
    await healImportedSettings(seasonId)
    return
  }

  const { assignment, venues, placements, settings } = await snapshotSavedCalendar(seasonId)
  if (placements === 0) return

  try {
    await (prisma as any).$transaction(async (tx: any) => {
      if ((await tx.seasonPlan.count({ where: { seasonId } })) > 0) return
      await tx.seasonPlan.create({
        data: {
          seasonId,
          name: IMPORTED_PLAN_NAME,
          source: "imported",
          assignment,
          venues,
          settings,
          isActive: true,
        },
      })
    })
  } catch (error) {
    // Losing the race is the expected failure here; the caller re-reads the
    // list either way and sees the winner's row.
    console.error("Season plan snapshot race:", error)
  }
}

/**
 * A plan, only if it belongs to THIS season. A planId from another season is
 * a 404 rather than a 403: the caller passed a season they can already
 * administer, so the honest answer is that no such plan exists here.
 */
export async function findOwnedPlan(seasonId: string, planId: string) {
  const plan = await (prisma as any).seasonPlan.findUnique({ where: { id: planId } })
  if (!plan || plan.seasonId !== seasonId) return null
  return plan
}
