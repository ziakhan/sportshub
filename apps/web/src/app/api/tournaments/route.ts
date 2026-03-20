import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createTournamentSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  tenantId: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().default("CA"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  registrationDeadline: z.string().datetime().optional(),
  teamFee: z.number().min(0),
  currency: z.string().default("CAD"),
  gamesGuaranteed: z.number().min(1).default(3),
  gameSlotMinutes: z.number().min(30).max(180).default(60),
  gameLengthMinutes: z.number().min(10).max(120).default(40),
  gamePeriods: z.enum(["HALVES", "QUARTERS"]).default("HALVES"),
  playoffFormat: z.string().optional(),
})

/**
 * POST /api/tournaments — Create a new tournament
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const data = createTournamentSchema.parse(body)

    // Verify user has an appropriate role
    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [
          { role: "ClubOwner" },
          { role: "ClubManager" },
          { role: "LeagueOwner" },
          { role: "LeagueManager" },
          { role: "PlatformAdmin" },
        ],
      } as any,
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tournament = await (prisma as any).tournament.create({
      data: {
        name: data.name,
        description: data.description || null,
        ownerId: userId,
        tenantId: data.tenantId || null,
        city: data.city,
        state: data.state || null,
        country: data.country,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
        teamFee: data.teamFee,
        currency: data.currency,
        gamesGuaranteed: data.gamesGuaranteed,
        gameSlotMinutes: data.gameSlotMinutes,
        gameLengthMinutes: data.gameLengthMinutes,
        gamePeriods: data.gamePeriods,
        playoffFormat: data.playoffFormat || null,
        status: "DRAFT",
      },
    })

    return NextResponse.json({ success: true, id: tournament.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create tournament error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/tournaments — List tournaments
 * ?mine=true — tournaments owned by current user (or all if PlatformAdmin)
 * ?public=true — tournaments with status REGISTRATION or IN_PROGRESS, startDate >= now
 */
export async function GET(request: NextRequest) {
  try {
    const mine = request.nextUrl.searchParams.get("mine") === "true"
    const isPublic = request.nextUrl.searchParams.get("public") === "true"

    if (isPublic) {
      const tournaments = await (prisma as any).tournament.findMany({
        where: {
          status: { in: ["REGISTRATION", "IN_PROGRESS"] },
          startDate: { gte: new Date() },
        },
        include: {
          divisions: true,
          _count: { select: { teams: true } },
        },
        orderBy: { startDate: "asc" },
      })
      return NextResponse.json({
        tournaments: tournaments.map((t: any) => ({
          ...t,
          teamFee: t.teamFee ? Number(t.teamFee) : null,
        })),
      })
    }

    if (mine) {
      const sessionInfo = await getSessionUserId()
      if (!sessionInfo) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // PlatformAdmin sees all tournaments
      const where = sessionInfo.isPlatformAdmin ? {} : { ownerId: sessionInfo.userId }

      const tournaments = await (prisma as any).tournament.findMany({
        where,
        include: {
          divisions: true,
          _count: { select: { teams: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      // Fetch owner info if admin
      let ownerMap: Record<string, { firstName: string | null; lastName: string | null; email: string }> = {}
      if (sessionInfo.isPlatformAdmin) {
        const ownerIds = [...new Set(tournaments.map((t: any) => t.ownerId))]
        const owners = await prisma.user.findMany({
          where: { id: { in: ownerIds as string[] } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
        ownerMap = Object.fromEntries(owners.map((o: any) => [o.id, o]))
      }

      return NextResponse.json({
        tournaments: tournaments.map((t: any) => {
          const owner = ownerMap[t.ownerId]
          return {
            ...t,
            teamFee: t.teamFee ? Number(t.teamFee) : null,
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
    console.error("Get tournaments error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
