import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { generateSchedule } from "@/lib/scheduler/generate"
import { loadSchedulerInput } from "@/lib/scheduler/load"
import { canCommitSchedule, COMMIT_NOT_READY_MESSAGE } from "@/lib/seasons/season-lock"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const commitSchema = z.object({
  // If true, wipe existing REGULAR games for this season first.
  replaceExisting: z.boolean().default(true),
  // sessionId → unit keys that session hosts (must match the previewed plan).
  sessionUnits: z.record(z.array(z.string())).optional(),
})

/**
 * POST /api/seasons/[id]/schedule/commit
 * Re-runs the scheduler and persists proposed games as Game rows in a
 * transaction. Requires season to be FINALIZED or IN_PROGRESS.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!canCommitSchedule(season.status)) {
      return NextResponse.json(
        { error: COMMIT_NOT_READY_MESSAGE, code: "SEASON_NOT_READY" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { replaceExisting, sessionUnits } = commitSchema.parse(body)

    const { input, errors } = await loadSchedulerInput(params.id)
    if (!input || errors.length > 0) {
      return NextResponse.json({ error: "Cannot commit", errors }, { status: 422 })
    }
    if (sessionUnits) input.sessionUnitFilter = sessionUnits

    const result = generateSchedule(input)

    const writeCounts = await (prisma as any).$transaction(async (tx: any) => {
      let removed = 0
      if (replaceExisting) {
        // Only wipe games that haven't started or transitioned beyond SCHEDULED
        const del = await tx.game.deleteMany({
          where: {
            seasonId: params.id,
            phase: "REGULAR",
            status: "SCHEDULED",
          },
        })
        removed = del.count
      }

      const created = await tx.game.createMany({
        data: result.games.map((g) => ({
          seasonId: params.id,
          phase: "REGULAR",
          sessionId: g.sessionId,
          dayId: g.dayId,
          dayVenueId: g.dayVenueId,
          courtId: g.courtId,
          venueId: g.venueId,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          scheduledAt: new Date(g.scheduledAt),
          duration: g.duration,
          status: "SCHEDULED",
          isLocked: true,
        })),
      })
      return { removed, created: created.count }
    })

    // Notify every approved club that the schedule is live (gap: silent before).
    const submissions = await (prisma as any).teamSubmission.findMany({
      where: { seasonId: params.id, status: "APPROVED" },
      select: { team: { select: { tenantId: true } } },
    })
    const tenantIds: string[] = Array.from(
      new Set(submissions.map((s: any) => s.team.tenantId as string))
    )
    if (tenantIds.length > 0) {
      const managers = await prisma.userRole.findMany({
        where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
        select: { userId: true },
      })
      await notifyMany(prisma, Array.from(new Set(managers.map((m) => m.userId))), {
        type: "schedule_published",
        title: "Season Schedule Published",
        message: "The game schedule for your league season has been published.",
        link: `/browse-leagues/${params.id}`,
        referenceId: params.id,
        referenceType: "Season",
      })
    }

    return NextResponse.json({
      success: true,
      removed: writeCounts.removed,
      created: writeCounts.created,
      unscheduledCount: result.unscheduled.length,
      warnings: result.warnings,
      utilization: result.utilization,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Schedule commit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
