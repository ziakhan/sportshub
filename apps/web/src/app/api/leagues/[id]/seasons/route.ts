import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createSeasonSchema = z.object({
  label: z.string().min(1).max(100),
  type: z.enum(["FALL_WINTER", "SPRING_SUMMER"]).default("FALL_WINTER"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  registrationDeadline: z.string().datetime().optional(),
  ageGroupCutoffDate: z.string().datetime().optional(),
  teamFee: z.number().min(0).optional(),
  gamesGuaranteed: z.number().min(1).optional(),
  targetGamesPerSession: z.number().min(1).default(1),
  gameSlotMinutes: z.number().min(30).max(180).default(90),
  gameLengthMinutes: z.number().min(10).max(120).default(40),
  gamePeriods: z.enum(["HALVES", "QUARTERS"]).default("HALVES"),
})

/**
 * GET /api/leagues/[id]/seasons — List seasons under a league
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const seasons = await (prisma as any).season.findMany({
      where: { leagueId: params.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { teamSubmissions: true, games: true, divisions: true } } },
    })
    return NextResponse.json({
      seasons: seasons.map((s: any) => ({
        ...s,
        teamFee: s.teamFee ? Number(s.teamFee) : null,
      })),
    })
  } catch (error) {
    console.error("List seasons error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/leagues/[id]/seasons — Create a new season under a league
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const league = await (prisma as any).league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = createSeasonSchema.parse(body)

    const season = await (prisma as any).season.create({
      data: {
        leagueId: params.id,
        label: data.label,
        type: data.type,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
        ageGroupCutoffDate: data.ageGroupCutoffDate ? new Date(data.ageGroupCutoffDate) : null,
        teamFee: data.teamFee ?? null,
        gamesGuaranteed: data.gamesGuaranteed ?? null,
        targetGamesPerSession: data.targetGamesPerSession,
        gameSlotMinutes: data.gameSlotMinutes,
        gameLengthMinutes: data.gameLengthMinutes,
        gamePeriods: data.gamePeriods,
        status: "DRAFT",
      },
    })

    return NextResponse.json({ success: true, id: season.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
