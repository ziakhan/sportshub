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
  IMPORTED_PLAN_READONLY_MESSAGE,
  venuesSchema,
  type PlanAssignment,
  type PlanVenues,
} from "@/lib/scheduler/season-plans"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  assignment: assignmentSchema.optional(),
  venues: venuesSchema.optional(),
})

/** GET — the whole document, assignment and gyms included, for loading a plan
 *  onto the board. `settings` rides along: the world the plan was saved in, so
 *  the board can draw it under its own numbers and name the drift. Null on
 *  rows written before plans remembered one. */
export async function GET(_request: NextRequest, { params }: { params: { id: string; planId: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
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
    const { name, assignment, venues } = parsed.data
    if (name === undefined && assignment === undefined && venues === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const rewritesContent = assignment !== undefined || venues !== undefined
    if (rewritesContent && plan.source === "imported") {
      return NextResponse.json({ error: IMPORTED_PLAN_READONLY_MESSAGE }, { status: 409 })
    }

    // A rewritten calendar was drawn in the world the operator is standing in
    // now, so the plan's memory of that world moves with it. A rename changes
    // nothing about the season, so it leaves the snapshot alone.
    const settings = rewritesContent ? await currentSettings(params.id) : undefined

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
    if (rewritesContent && updated.isActive) {
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

/** DELETE — throw a plan away. Never the active one: the season would keep
 *  running its calendar with nothing left to name it. */
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

    await (prisma as any).seasonPlan.delete({ where: { id: plan.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Season plan delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
