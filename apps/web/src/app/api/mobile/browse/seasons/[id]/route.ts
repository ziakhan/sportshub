import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicSeason } from "@/lib/queries/season"
import { getSeasonStandings } from "@/lib/queries/standings"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/seasons/[id] — one league season for the native
 * league screen: info + standings + recent/upcoming games. Anonymous; the
 * same resolvers as the public /league/[id] page.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [season, standings] = await Promise.all([
      getPublicSeason(params.id),
      getSeasonStandings(params.id),
    ])
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = new Date()
    const gameSelect = {
      id: true,
      scheduledAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      venue: { select: { name: true } },
    } as const
    const [upcoming, recent] = await Promise.all([
      prisma.game.findMany({
        where: { seasonId: params.id, scheduledAt: { gte: now }, status: { not: "CANCELLED" } },
        select: gameSelect,
        orderBy: { scheduledAt: "asc" },
        take: 15,
      }),
      prisma.game.findMany({
        where: { seasonId: params.id, scheduledAt: { lt: now } },
        select: gameSelect,
        orderBy: { scheduledAt: "desc" },
        take: 15,
      }),
    ])

    return NextResponse.json({
      season: {
        id: season.id,
        name: season.label,
        status: season.status,
        startDate: season.startDate,
        endDate: season.endDate,
        league: season.league ? { id: season.league.id, name: season.league.name } : null,
        divisions: (season.divisions ?? []).map((d: any) => ({
          id: d.id,
          name: d.name ?? d.ageGroup,
          ageGroup: d.ageGroup,
        })),
      },
      standings,
      upcoming,
      recent,
    })
  } catch (error) {
    console.error("Mobile season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
