import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { applyAssignment, buildPlannerState } from "@/lib/scheduler/planner"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  applyPlanWorld,
  currentSettings,
  findOwnedPlan,
  type PlanAssignment,
  type PlanVenues,
} from "@/lib/scheduler/season-plans"
import type { PlanSettings } from "@/lib/scheduler/plan-documents"

export const dynamic = "force-dynamic"

/**
 * POST /api/seasons/[id]/plans/[planId]/activate — make this the calendar AND
 * the gym setup the season runs on (owner 2026-08-02, extended by the
 * 2026-08-05 world rulings).
 *
 * A plan owns its world, so activating it has to hand that world over or "use
 * this plan for the season" would be a half-truth. The order is deliberate and
 * is not an accident of convenience:
 *
 *  1. THE WORLD FIRST (applyPlanWorld): the grade estimates, the courts held
 *     back, each gym's role, courts and hours, and which gym is on which
 *     weekend. Capacity has to be right before a calendar is written against it.
 *  2. THEN THE CALENDAR (applyAssignment): the same write the board's Apply has
 *     always made, onto SeasonSession.unitKeys/unitVenues, so every downstream
 *     surface keeps reading the column it always has.
 *  3. THEN THE FLAG, in one transaction. Flipping it first would leave a plan
 *     claiming to run a season it had not been written into if a write failed.
 *  4. THEN ITS OWN SNAPSHOT, re-read from the season it just wrote — so the
 *     plan and the season agree, and its drift line is empty because there
 *     really is no drift.
 *
 * A gym a GAME is already on is never released; that is reported in `world` so
 * the operator is told rather than lied to.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string; planId: string } }) {
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

    // A plan from before plans remembered a world has none to apply, and
    // inventing one would be worse than leaving the season's alone.
    const settings = (plan.settings ?? null) as PlanSettings | null
    const world = settings?.state ? await applyPlanWorld(params.id, settings.state) : null

    const { updated } = await applyAssignment(
      params.id,
      (plan.assignment ?? {}) as PlanAssignment,
      (plan.venues ?? {}) as PlanVenues
    )

    // Exactly one active plan per season, set in one transaction so no reader
    // can catch the season with two calendars claiming to drive it.
    await (prisma as any).$transaction([
      (prisma as any).seasonPlan.updateMany({
        where: { seasonId: params.id, id: { not: plan.id } },
        data: { isActive: false },
      }),
      (prisma as any).seasonPlan.update({
        where: { id: plan.id },
        data: { isActive: true },
      }),
    ])

    // The season is what this plan says now, so the plan's memory of its world
    // is the season's own. Read back rather than assumed: a gym a game blocked
    // is a real difference, and the snapshot has to show it.
    if (world) {
      await (prisma as any).seasonPlan.update({
        where: { id: plan.id },
        data: { settings: await currentSettings(params.id) },
      })
    }

    const state = await buildPlannerState(params.id)
    return NextResponse.json({ success: true, updated, world, state })
  } catch (error) {
    console.error("Season plan activate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
