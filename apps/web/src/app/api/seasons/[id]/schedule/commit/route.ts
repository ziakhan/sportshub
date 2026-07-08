import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { generateSchedule } from "@/lib/scheduler/generate"
import { loadSchedulerInput } from "@/lib/scheduler/load"
import { canCommitSchedule, COMMIT_NOT_READY_MESSAGE } from "@/lib/seasons/season-lock"
import { notifyMany } from "@/lib/notifications"
import { notifyTeam } from "@/lib/teams/practices"

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

    // Fan the news out (owner storyline 2026-07-07): one club-level bell for
    // owners/managers, then bell + EMAIL to every team's full circle —
    // coaches, team managers, parents, self-registered players — pointing at
    // the team calendar where the games (and the phone iCal feed) now live.
    const submissions = await (prisma as any).teamSubmission.findMany({
      where: { seasonId: params.id, status: "APPROVED" },
      select: { teamId: true, team: { select: { name: true, tenantId: true } } },
    })
    const tenantIds: string[] = Array.from(
      new Set(submissions.map((s: any) => s.team.tenantId as string))
    )
    let clubNotified = new Set<string>()
    if (tenantIds.length > 0) {
      const managers = await prisma.userRole.findMany({
        where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
        select: { userId: true },
      })
      clubNotified = new Set(managers.map((m: { userId: string }) => m.userId))
      await notifyMany(prisma, [...clubNotified], {
        type: "schedule_published",
        title: "Season Schedule Published",
        message: "The game schedule for your league season has been published.",
        link: `/browse-leagues/${params.id}`,
        referenceId: params.id,
        referenceType: "Season",
      })
    }

    const seasonMeta = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { label: true, league: { select: { name: true } } },
    })
    const seasonName = [seasonMeta?.league?.name, seasonMeta?.label].filter(Boolean).join(" ")
    // One pass over the committed games → per-team counts (no N count queries)
    const committedGames = await (prisma as any).game.findMany({
      where: { seasonId: params.id, status: "SCHEDULED" },
      select: { homeTeamId: true, awayTeamId: true },
    })
    const gamesByTeam = new Map<string, number>()
    for (const g of committedGames) {
      gamesByTeam.set(g.homeTeamId, (gamesByTeam.get(g.homeTeamId) ?? 0) + 1)
      gamesByTeam.set(g.awayTeamId, (gamesByTeam.get(g.awayTeamId) ?? 0) + 1)
    }
    const appUrl = process.env.NEXTAUTH_URL || ""
    for (const sub of submissions) {
      const gameCount = gamesByTeam.get(sub.teamId) ?? 0
      if (gameCount === 0) continue
      await notifyTeam({
        teamId: sub.teamId,
        tenantId: sub.team.tenantId,
        excludeUserIds: [...clubNotified],
        type: "schedule_published",
        title: "Game schedule published",
        message: `${sub.team.name}: ${gameCount} games scheduled in ${seasonName}. See them on your team calendar.`,
        link: `/teams/${sub.teamId}/calendar`,
        referenceId: params.id,
        emailSubject: `${sub.team.name} game schedule is out — ${seasonName}`,
        emailHtml: `<p>The game schedule for <strong>${sub.team.name}</strong> in <strong>${seasonName}</strong> has been published: <strong>${gameCount} games</strong>.</p><p>See dates and venues, get changes live, and add the schedule to your phone's calendar: <a href="${appUrl}/teams/${sub.teamId}/calendar">team calendar</a></p>`,
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
