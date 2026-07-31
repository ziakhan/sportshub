import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { notifyMany } from "@/lib/notifications"
import { notifyTeam } from "@/lib/teams/practices"
import { appBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * POST /api/seasons/[id]/schedule/publish
 * Stamps every draft game (publishedAt null) in the season and fans the news
 * out ONCE — club bell + team-circle bell/email pointing at the team
 * calendar. Committing creates drafts; this is the moment families hear.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { label: true, league: { select: { ownerId: true, name: true } } },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const stamped = await (prisma as any).game.updateMany({
      where: { seasonId: params.id, publishedAt: null },
      data: { publishedAt: new Date() },
    })
    if (stamped.count === 0) {
      return NextResponse.json({ error: "Nothing to publish — no draft games." }, { status: 400 })
    }

    // Fan the news out (moved here from commit — owner 2026-07-31: committing
    // saves a draft; publishing is the step families hear about): one
    // club-level bell for owners/managers, then bell + EMAIL to every team's
    // full circle pointing at the team calendar.
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

    const seasonName = [season.league?.name, season.label].filter(Boolean).join(" ")
    // One pass over the published upcoming games → per-team counts
    const publishedGames = await (prisma as any).game.findMany({
      where: { seasonId: params.id, status: "SCHEDULED", publishedAt: { not: null } },
      select: { homeTeamId: true, awayTeamId: true },
    })
    const gamesByTeam = new Map<string, number>()
    for (const g of publishedGames) {
      gamesByTeam.set(g.homeTeamId, (gamesByTeam.get(g.homeTeamId) ?? 0) + 1)
      gamesByTeam.set(g.awayTeamId, (gamesByTeam.get(g.awayTeamId) ?? 0) + 1)
    }
    const appUrl = appBaseUrl()
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

    return NextResponse.json({ success: true, published: stamped.count })
  } catch (error) {
    console.error("Schedule publish error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
