import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createSeasonSchema = z.object({
  seasonId: z.string().optional(), // If updating an existing season
  name: z.string().min(3).max(200), // League name
  description: z.string().optional(),
  season: z.string().min(1), // Season label, e.g. "Fall 2026"
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
 * POST /api/leagues — Create a new league + first season (v2: League is persistent, Season owns scheduling/pricing)
 * Returns the Season id so existing /leagues/[id]/... URLs keep working until Phase 1.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const data = createSeasonSchema.parse(body)

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
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

    const season = await prisma.$transaction(async (tx: any) => {
      const league = await tx.league.create({
        data: {
          name: data.name,
          description: data.description || null,
          ownerId: userId,
        },
      })
      return tx.season.create({
        data: {
          leagueId: league.id,
          label: data.season,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
          ageGroupCutoffDate: data.ageGroupCutoffDate ? new Date(data.ageGroupCutoffDate) : null,
          teamFee: data.teamFee ?? null,
          gamesGuaranteed: data.gamesGuaranteed ?? null,
          targetGamesPerSession: data.gamesPerSession,
          gameSlotMinutes: data.gameSlotMinutes,
          gameLengthMinutes: data.gameLengthMinutes,
          gamePeriods: data.gamePeriods,
          playoffFormat: data.playoffFormat || null,
          playoffTeams: data.playoffTeams ?? null,
          status: "DRAFT",
        },
      })
    })

    return NextResponse.json({ success: true, id: season.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/leagues — List seasons (Phase 0: still keyed by Season.id for UI continuity)
 * ?mine=true — seasons under leagues owned by current user
 * ?public=true — seasons accepting registration or in progress
 */
export async function GET(request: NextRequest) {
  try {
    const mine = request.nextUrl.searchParams.get("mine") === "true"
    const isPublic = request.nextUrl.searchParams.get("public") === "true"

    if (isPublic) {
      const seasons = await prisma.season.findMany({
        where: {
          status: { in: ["REGISTRATION", "IN_PROGRESS"] },
        } as any,
        include: {
          league: { select: { id: true, name: true, description: true, ownerId: true } },
          divisions: true,
          _count: { select: { teamSubmissions: true, games: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({
        leagues: seasons.map(serializeSeasonAsLeague),
      })
    }

    if (mine) {
      const sessionInfo = await getSessionUserId()
      if (!sessionInfo) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const where = sessionInfo.isPlatformAdmin
        ? {}
        : { league: { ownerId: sessionInfo.userId } }

      const seasons = await prisma.season.findMany({
        where,
        include: {
          league: { select: { id: true, name: true, description: true, ownerId: true } },
          divisions: true,
          _count: { select: { teamSubmissions: true, games: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      let ownerMap: Record<string, { firstName: string | null; lastName: string | null; email: string }> = {}
      if (sessionInfo.isPlatformAdmin) {
        const ownerIds = [...new Set(seasons.map((s: any) => s.league.ownerId as string))] as string[]
        const owners = await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
        ownerMap = Object.fromEntries(owners.map((o: any) => [o.id, o]))
      }
      return NextResponse.json({
        leagues: seasons.map((s: any) => {
          const owner = ownerMap[s.league.ownerId]
          return {
            ...serializeSeasonAsLeague(s),
            owner: owner ? {
              name: [owner.firstName, owner.lastName].filter(Boolean).join(" ") || "Unknown",
              email: owner.email,
            } : undefined,
          }
        }),
      })
    }

    return NextResponse.json({ error: "mine=true or public=true required" }, { status: 400 })
  } catch (error) {
    console.error("Get leagues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Collapses a Season + its League back into the shape the UI still expects
// (flat "league" object with name/description from League + everything else from Season).
// Phase 1 will replace this with proper League+Season-shaped responses.
function serializeSeasonAsLeague(s: any) {
  const { league, _count, ...rest } = s
  return {
    ...rest,
    id: s.id,
    name: league?.name,
    description: league?.description,
    ownerId: league?.ownerId,
    leagueId: league?.id,
    season: s.label,
    leagueStatus: s.status,
    teamFee: s.teamFee ? Number(s.teamFee) : null,
    _count: _count ? { teams: _count.teamSubmissions, games: _count.games } : undefined,
  }
}
