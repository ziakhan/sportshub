import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { applyAssignment } from "@/lib/scheduler/planner"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  ACTIVE_PLAN_DELETE_MESSAGE,
  assignmentSchema,
  currentSettings,
  findOwnedPlan,
  IMPORTED_PLAN_DELETE_MESSAGE,
  IMPORTED_PLAN_READONLY_MESSAGE,
  planSettingsSchema,
  sanitizePlanWorld,
  venuesSchema,
  type PlanAssignment,
  type PlanVenues,
} from "@/lib/scheduler/season-plans"
import { settingsOf } from "@/lib/scheduler/plan-world"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  assignment: assignmentSchema.optional(),
  venues: venuesSchema.optional(),
  /**
   * THE PLAN'S OWN WORLD (owner ruling 2026-08-05). Steps 1 and 2 edit THIS on
   * a plan the season does not run: the grade estimates and which grades are in,
   * the gyms with their roles, courts and hours, which weekends the plan runs
   * and which gym it has on each. The season's rows do not move until the plan
   * is activated.
   */
  settings: planSettingsSchema.optional(),
})

/** GET — the whole document, assignment and gyms included, for loading a plan
 *  onto the board. `settings` rides along: the world the plan was saved in, so
 *  the board can draw it under its own numbers and name the drift.
 *
 *  THE ACTIVE PLAN IS THE SEASON, so its world is read LIVE rather than out of
 *  the column (owner ruling 2026-08-05, "one truth"): steps 1 and 2 write
 *  through to the season on the active plan, and a stored snapshot would start
 *  disagreeing with the rows it just wrote. That also makes its drift empty by
 *  construction, which is the truth. */
export async function GET(_request: NextRequest, { params }: { params: { id: string; planId: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (plan.isActive) {
      return NextResponse.json({ plan: { ...plan, settings: await currentSettings(params.id) } })
    }
    return NextResponse.json({ plan })
  } catch (error) {
    console.error("Season plan read error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH {name?, assignment?, venues?} — rename a plan, or rewrite what it
 * says. Renaming is always allowed, including on the imported reference;
 * rewriting its CONTENT is not, because that reference is the only record of
 * what the league actually published.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; planId: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    const { name, assignment, venues, settings: sent } = parsed.data
    if (name === undefined && assignment === undefined && venues === undefined && sent === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    // Its world is its content too: the reference plan is the only record of
    // what the league published, including the gyms and estimates it was
    // published under.
    const rewritesContent = assignment !== undefined || venues !== undefined || sent !== undefined
    if (rewritesContent && plan.source === "imported") {
      return NextResponse.json({ error: IMPORTED_PLAN_READONLY_MESSAGE }, { status: 409 })
    }

    /**
     * WHOSE WORLD THE PLAN KEEPS (owner ruling 2026-08-05). Three cases:
     *
     *  - the operator SENT a world (steps 1 and 2 on a plan the season does not
     *    run): that is the plan's world now, clamped to ids this season has.
     *  - the plan is ACTIVE, or it predates worlds entirely: the season's world
     *    IS its world, so it is re-snapshotted.
     *  - anything else: LEFT ALONE. A plan that owns its world must not have it
     *    quietly replaced by this month's season just because its calendar was
     *    saved — that was the bug the whole ruling is about.
     */
    const settings =
      sent !== undefined
        ? settingsOf(await sanitizePlanWorld(params.id, sent.state))
        : rewritesContent && (plan.isActive || plan.settings == null)
          ? await currentSettings(params.id)
          : undefined

    const updated = await (prisma as any).seasonPlan.update({
      where: { id: plan.id },
      data: {
        ...(name === undefined ? {} : { name }),
        ...(assignment === undefined ? {} : { assignment }),
        ...(venues === undefined ? {} : { venues }),
        ...(settings === undefined ? {} : { settings }),
      },
    })

    // The active plan IS the season's sessions (owner's ruling). Editing it
    // without writing through would leave the season running a calendar no
    // document describes, so the write-through happens here too — the same
    // applyAssignment the activate route makes.
    if ((assignment !== undefined || venues !== undefined) && updated.isActive) {
      await applyAssignment(
        params.id,
        updated.assignment as PlanAssignment,
        updated.venues as PlanVenues
      )
    }

    return NextResponse.json({ plan: updated })
  } catch (error) {
    console.error("Season plan update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — throw a plan away (owner ruling 2026-08-05, #2: delete lives in the
 *  picker). Two refusals, each with the reason on it: never the active one, or
 *  the season would keep running a calendar with nothing left to name it, and
 *  never the imported reference, which is the only record of what the league
 *  actually published. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; planId: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (plan.isActive) {
      return NextResponse.json({ error: ACTIVE_PLAN_DELETE_MESSAGE }, { status: 409 })
    }
    if (plan.source === "imported") {
      return NextResponse.json({ error: IMPORTED_PLAN_DELETE_MESSAGE }, { status: 409 })
    }

    await (prisma as any).seasonPlan.delete({ where: { id: plan.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Season plan delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
