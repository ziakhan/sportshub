import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/leagues — every league with an active (registration
 * or in-progress) season, for the native Browse → Leagues screen. Anonymous;
 * same filter as GET /api/leagues?public=true, trimmed to what the list
 * renders.
 */
export async function GET() {
  try {
    const leagues = await (prisma as any).league.findMany({
      where: { seasons: { some: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } } } },
      select: {
        id: true,
        name: true,
        description: true,
        seasons: {
          where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            label: true,
            status: true,
            startDate: true,
            endDate: true,
            _count: { select: { teamSubmissions: true, divisions: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      leagues: leagues.map((l: any) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        seasons: l.seasons.map((s: any) => ({
          id: s.id,
          name: s.label,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          teamCount: s._count.teamSubmissions,
          divisionCount: s._count.divisions,
        })),
      })),
    })
  } catch (error) {
    console.error("Mobile leagues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
