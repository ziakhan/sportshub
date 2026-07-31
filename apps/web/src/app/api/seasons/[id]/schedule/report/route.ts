import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { computeFairnessReport } from "@/lib/scheduler/report"
import { effectiveSeasonConfig } from "@/lib/org/season-defaults"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/schedule/report — the fairness report (owner
 * 2026-08-01): back-to-backs, same-day venue splits, court distribution and
 * early tip-off share, per team. League-owner view (drafts included).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      include: {
        league: {
          select: { ownerId: true, organization: { select: { seasonDefaults: true } } },
        },
      },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { values: cfg } = effectiveSeasonConfig(season, season.league?.organization?.seasonDefaults)

    const games = await (prisma as any).game.findMany({
      where: { seasonId: params.id, phase: "REGULAR" },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        scheduledAt: true,
        status: true,
        venueId: true,
        courtId: true,
        venue: { select: { name: true } },
        court: { select: { name: true } },
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    })
    const teamNames = new Map<string, string>()
    for (const g of games) {
      teamNames.set(g.homeTeamId, g.homeTeam?.name ?? g.homeTeamId)
      teamNames.set(g.awayTeamId, g.awayTeam?.name ?? g.awayTeamId)
    }
    const report = computeFairnessReport(
      games.map((g: any) => ({
        id: g.id,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        scheduledAt: g.scheduledAt,
        status: g.status,
        venueId: g.venueId,
        venueName: g.venue?.name ?? null,
        courtId: g.courtId,
        courtName: g.court?.name ?? null,
      })),
      teamNames,
      (cfg.gameSlotMinutes as number) ?? 90
    )
    return NextResponse.json(report)
  } catch (error) {
    console.error("Schedule report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
