import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { applyAssignment, buildPlannerState } from "@/lib/scheduler/planner"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import { findOwnedPlan, type PlanAssignment, type PlanVenues } from "@/lib/scheduler/season-plans"

export const dynamic = "force-dynamic"

/**
 * POST /api/seasons/[id]/plans/[planId]/activate — make this the calendar the
 * season runs on (owner 2026-08-02).
 *
 * Two things happen, in this order and no other: the plan is written onto
 * SeasonSession.unitKeys/unitVenues — the same applyAssignment the board's
 * Apply has always called, so every downstream surface keeps reading the
 * column it always has — and only then does the active flag move. Flipping
 * the flag first would leave a plan claiming to run the season it had not
 * been written into yet if the write failed.
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

    const state = await buildPlannerState(params.id)
    return NextResponse.json({ success: true, updated, state })
  } catch (error) {
    console.error("Season plan activate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
