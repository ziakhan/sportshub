import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { buildPlannerState } from "@/lib/scheduler/planner"
import { currentAssignment, seasonCalendarMonths } from "@/lib/scheduler/planner-core"
import { NO_PLAN_MESSAGE, seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import { notifyPlannedWithoutTeams } from "@/lib/rosters/reminders"

export const dynamic = "force-dynamic"

/**
 * POST /api/seasons/[id]/planner/publish — the season plan goes public
 * (plan wizard step 4, owner-approved mock 2026-08-02).
 *
 * Publishing does two visible things and one quiet one: the living calendar
 * appears on the public league page, the shareable card stops 404ing for
 * everyone without an operator session, and the kept plan becomes the
 * season's baseline. Idempotent by design — republishing after an edit just
 * moves the timestamp, so an operator can fix a weekend and re-announce
 * without anything to undo first.
 *
 * There must be something to publish: an empty board would publish a poster
 * with no weekends on it, which is worse than not publishing at all.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    // The whole wizard is read-only once the season locks (waves 1-3 do the
    // same); publishing is the last step of planning, not of running.
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const state = await buildPlannerState(params.id)
    const months = seasonCalendarMonths(state, currentAssignment(state))
    if (months.length === 0) {
      return NextResponse.json({ error: NO_PLAN_MESSAGE }, { status: 409 })
    }

    const planPublishedAt = new Date()
    await (prisma as any).season.update({
      where: { id: params.id },
      data: { planPublishedAt },
    })

    // Roster-deadline enforcement, the honest half (owner ruling 2026-08-11,
    // QA T-017): teams the draw excluded for an unfinalized roster are told in
    // plain words that the published plan was made without them. Send-once
    // per team per season, best-effort — a failed bell never blocks a publish.
    try {
      await notifyPlannedWithoutTeams(params.id)
    } catch (error) {
      console.error("Planned-without notice failed:", error)
    }

    return NextResponse.json({ success: true, planPublishedAt })
  } catch (error) {
    console.error("Planner publish error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — take it back down. The plan itself is untouched; only the public
 *  calendar and the anonymous card go away. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    await (prisma as any).season.update({
      where: { id: params.id },
      data: { planPublishedAt: null },
    })
    return NextResponse.json({ success: true, planPublishedAt: null })
  } catch (error) {
    console.error("Planner unpublish error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
