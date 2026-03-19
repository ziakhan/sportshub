import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createLeagueSeasonSchema = z.object({
  leagueId: z.string().optional(), // If updating existing league
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  season: z.string().min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  registrationDeadline: z.string().datetime().optional(),
  ageGroupCutoffDate: z.string().datetime().optional(),
  teamFee: z.number().min(0).optional(),
  gamesGuaranteed: z.number().min(1).optional(),
  gamesPerSession: z.number().min(1).default(1),
  gameSlotMinutes: z.number().min(30).max(180).default(90),
  gameLengthMinutes: z.number().min(10).max(120).default(40),
  gamePeriods: z.enum(["HALVES", "QUARTERS"]).default("HALVES"),
  playoffFormat: z.string().optional(),
  playoffTeams: z.number().optional(),
})

/**
 * POST /api/leagues — Create a new league season
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createLeagueSeasonSchema.parse(body)

    // Verify user is LeagueOwner or PlatformAdmin
    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { role: "LeagueOwner" },
          { role: "LeagueManager" },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const league = await prisma.league.create({
      data: {
        name: data.name,
        description: data.description || null,
        season: data.season,
        ownerId: session.user.id,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
        ageGroupCutoffDate: data.ageGroupCutoffDate ? new Date(data.ageGroupCutoffDate) : null,
        teamFee: data.teamFee ?? null,
        gamesGuaranteed: data.gamesGuaranteed ?? null,
        gamesPerSession: data.gamesPerSession,
        gameSlotMinutes: data.gameSlotMinutes,
        gameLengthMinutes: data.gameLengthMinutes,
        gamePeriods: data.gamePeriods,
        playoffFormat: data.playoffFormat || null,
        playoffTeams: data.playoffTeams ?? null,
        leagueStatus: "DRAFT",
      } as any,
    })

    return NextResponse.json({ success: true, id: league.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/leagues — List leagues
 * ?mine=true — leagues owned/managed by current user
 * ?public=true — published leagues open for registration
 */
export async function GET(request: NextRequest) {
  try {
    const mine = request.nextUrl.searchParams.get("mine") === "true"
    const isPublic = request.nextUrl.searchParams.get("public") === "true"

    if (isPublic) {
      const leagues = await prisma.league.findMany({
        where: {
          leagueStatus: { in: ["REGISTRATION", "IN_PROGRESS"] },
        } as any,
        include: {
          divisions: true,
          _count: { select: { teams: true, games: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({
        leagues: leagues.map((l: any) => ({
          ...l,
          teamFee: l.teamFee ? Number(l.teamFee) : null,
        })),
      })
    }

    if (mine) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const leagues = await prisma.league.findMany({
        where: { ownerId: session.user.id },
        include: {
          divisions: true,
          _count: { select: { teams: true, games: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({
        leagues: leagues.map((l: any) => ({
          ...l,
          teamFee: l.teamFee ? Number(l.teamFee) : null,
        })),
      })
    }

    return NextResponse.json({ error: "mine=true or public=true required" }, { status: 400 })
  } catch (error) {
    console.error("Get leagues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
