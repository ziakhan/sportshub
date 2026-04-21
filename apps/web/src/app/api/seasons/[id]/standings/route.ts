import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import {
  computeStandings,
  type StandingsGame,
  type TiebreakerKey,
} from "@/lib/standings/compute"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/standings — compute standings on read.
 * Public (no auth) so league landing pages can embed the table.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const season = (await (prisma as any).season.findUnique({
      where: { id: params.id },
      include: {
        divisions: {
          include: {
            teamSubmissions: {
              where: { status: "APPROVED" },
              include: { team: { select: { id: true, name: true } } },
            },
          },
        },
      },
    })) as any
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const games = (await (prisma as any).game.findMany({
      where: { seasonId: params.id },
      select: {
        id: true,
        status: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        defaultedBy: true,
      },
    })) as StandingsGame[]

    const teamsByDivision = (season.divisions ?? []).map((d: any) => ({
      divisionId: d.id,
      divisionName: d.name,
      teams: (d.teamSubmissions ?? []).map((ts: any) => ({
        teamId: ts.teamId,
        name: ts.team?.name ?? ts.teamId,
        divisionId: d.id,
      })),
    }))

    const tiebreakerOrder: TiebreakerKey[] = Array.isArray(season.tiebreakerOrder)
      ? (season.tiebreakerOrder as TiebreakerKey[])
      : []

    const standings = computeStandings({
      tiebreakerOrder,
      teamsByDivision,
      games,
    })

    return NextResponse.json({
      seasonId: params.id,
      seasonLabel: season.label,
      tiebreakerOrder,
      divisions: standings,
    })
  } catch (error) {
    console.error("Standings error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
