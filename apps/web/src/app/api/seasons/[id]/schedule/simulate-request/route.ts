import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { runSeasonSchedule } from "@/lib/scheduler/run"

export const dynamic = "force-dynamic"

const bodySchema = z.object({ requestId: z.string().min(1) })

/**
 * POST /api/seasons/[id]/schedule/simulate-request { requestId }
 * (owner 2026-08-01): before approving a schedule request, show its COST —
 * the schedule is generated twice (with and without the pending request,
 * same variety seed) and the fairness totals are diffed. Nothing is saved.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "requestId required" }, { status: 400 })

    const req = await (prisma as any).teamScheduleRequest.findUnique({
      where: { id: parsed.data.requestId },
      select: {
        id: true,
        status: true,
        submission: {
          select: {
            teamId: true,
            seasonId: true,
            team: { select: { name: true } },
            season: { select: { leagueId: true, league: { select: { ownerId: true } } } },
          },
        },
      },
    })
    if (!req || req.submission.seasonId !== params.id) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    const isOwner = req.submission.season.league.ownerId === auth.userId
    const managerRole = isOwner
      ? null
      : await prisma.userRole.findFirst({
          where: {
            userId: auth.userId,
            leagueId: req.submission.season.leagueId,
            role: { in: ["LeagueOwner", "LeagueManager"] },
          },
          select: { id: true },
        })
    if (!isOwner && !auth.isPlatformAdmin && !managerRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (req.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending requests can be simulated", code: "ALREADY_DECIDED" },
        { status: 409 }
      )
    }

    const baseline = await runSeasonSchedule(params.id)
    if (!baseline.run) {
      return NextResponse.json({ error: "Cannot simulate", errors: baseline.errors }, { status: 422 })
    }
    const withRequest = await runSeasonSchedule(params.id, {
      includePendingRequestId: req.id,
    })
    if (!withRequest.run) {
      return NextResponse.json(
        { error: "Cannot simulate", errors: withRequest.errors },
        { status: 422 }
      )
    }

    const b = baseline.run.report.totals
    const w = withRequest.run.report.totals
    const diff = {
      backToBackTeamDays: w.backToBackTeamDays - b.backToBackTeamDays,
      bigGapTeamDays: w.bigGapTeamDays - b.bigGapTeamDays,
      splitVenueTeamDays: w.splitVenueTeamDays - b.splitVenueTeamDays,
      preferenceViolations: w.preferenceViolations - b.preferenceViolations,
      requestViolations: w.requestViolations - b.requestViolations,
      unscheduled:
        withRequest.run.result.unscheduled.length - baseline.run.result.unscheduled.length,
      maxTopCourtShare: Number((w.maxTopCourtShare - b.maxTopCourtShare).toFixed(2)),
    }
    const teamId = req.submission.teamId
    const requestingTeam = {
      teamId,
      name: req.submission.team?.name ?? teamId,
      after: withRequest.run.report.teams.find((t) => t.teamId === teamId)?.requestsHonored ?? null,
    }
    return NextResponse.json({
      baseline: { totals: b, unscheduled: baseline.run.result.unscheduled.length },
      withRequest: {
        totals: w,
        unscheduled: withRequest.run.result.unscheduled.length,
        tradeoffs: withRequest.run.result.tradeoffs,
      },
      diff,
      requestingTeam,
    })
  } catch (error) {
    console.error("Simulate schedule request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
