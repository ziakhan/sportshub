import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { buildPlannerState } from "./planner"
import { currentAssignment, type PlannerState } from "./planner-core"
import type { PlanSettings } from "./plan-documents"

/**
 * Plans as documents (owner 2026-08-02). A season holds MANY named calendars
 * and exactly one of them is active — the one written onto
 * SeasonSession.unitKeys/unitVenues, which is what every downstream surface
 * has always read. The routes live in api/seasons/[id]/plans/**; this module
 * holds everything they share, because a route file may export nothing but
 * HTTP handlers (same reason planner-auth.ts exists).
 */

/** sessionId → unit keys ("age:<ageGroup>"), as the board speaks them. */
export type PlanAssignment = Record<string, string[]>
/** sessionId → (unit key → venueId). */
export type PlanVenues = Record<string, Record<string, string>>

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
  return {
    capturedAt: new Date().toISOString(),
    state: {
      seasonId: state.seasonId,
      units: state.units.map((u) => ({
        key: u.key,
        label: u.label,
        divisionIds: [...u.divisionIds],
        // JSON drops undefined, so an unflagged grade is written as false
        // rather than as a key that quietly disappears.
        alternate: Boolean(u.alternate),
        teams: u.teams,
        approved: u.approved,
        expected: u.expected,
        source: u.source,
      })),
      windows: state.windows.map((win) => ({
        label: win.label,
        weekends: win.weekends.map((w) => ({
          sessionId: w.sessionId,
          label: w.label,
          dateISO: w.dateISO,
          capacityGames: w.capacityGames,
          largestVenueCapacity: w.largestVenueCapacity,
          targetGamesPerTeam: w.targetGamesPerTeam,
          venues: w.venues.map((v) => ({
            venueId: v.venueId,
            name: v.name,
            capacityGames: v.capacityGames,
            // Owned or rented (owner ruling 2026-08-03) — the fact that
            // decides what a weekend costs, so a plan has to remember it.
            role: v.role,
            fillOrder: v.fillOrder,
            courtDays: v.courtDays ?? 0,
            courts: v.courts ?? 0,
            days: v.days ?? 0,
            hoursPerCourtDay: v.hoursPerCourtDay ?? 0,
          })),
        })),
      })),
      gamesPerTeam: state.gamesPerTeam ?? 0,
    },
  }
}

/** The season's world as it stands right now, for a plan about to be written
 *  down. Built server-side on every save so a plan can never claim a world the
 *  client made up. */
export async function currentSettings(seasonId: string): Promise<PlanSettings> {
  return snapshotSettings(await buildPlannerState(seasonId))
}

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
