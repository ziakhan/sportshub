import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { generateSchedule } from "@/lib/scheduler/generate"
import { loadSchedulerInput } from "@/lib/scheduler/load"

export const dynamic = "force-dynamic"

const commitSchema = z.object({
  // If true, wipe existing REGULAR games for this season first.
  replaceExisting: z.boolean().default(true),
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
    if (
      season.league.ownerId !== sessionInfo.userId &&
      !sessionInfo.isPlatformAdmin
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!["FINALIZED", "IN_PROGRESS"].includes(season.status)) {
      return NextResponse.json(
        { error: "Season must be FINALIZED before committing a schedule" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { replaceExisting } = commitSchema.parse(body)

    const { input, errors } = await loadSchedulerInput(params.id)
    if (!input || errors.length > 0) {
      return NextResponse.json({ error: "Cannot commit", errors }, { status: 422 })
    }

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
