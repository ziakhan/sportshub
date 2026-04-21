import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createLeagueSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
})

/**
 * POST /api/leagues — Create a persistent league (no season; seasons are created separately)
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [{ role: "LeagueOwner" }, { role: "LeagueManager" }, { role: "PlatformAdmin" }],
      },
    })
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const data = createLeagueSchema.parse(await request.json())

    const league = await (prisma as any).league.create({
      data: {
        name: data.name,
        description: data.description || null,
        ownerId: userId,
      },
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
 * ?mine=true   — leagues owned by the current user (or all leagues for platform admin)
 * ?public=true — leagues that have at least one season accepting registration or in progress
 */
export async function GET(request: NextRequest) {
  try {
    const mine = request.nextUrl.searchParams.get("mine") === "true"
    const isPublic = request.nextUrl.searchParams.get("public") === "true"

    if (isPublic) {
      const leagues = await (prisma as any).league.findMany({
        where: {
          seasons: { some: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } } },
        },
        include: {
          seasons: {
            where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { teamSubmissions: true, divisions: true } } },
          },
          _count: { select: { seasons: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({
        leagues: leagues.map((l: any) => ({
          ...l,
          seasons: l.seasons.map((s: any) => ({
            ...s,
            teamFee: s.teamFee ? Number(s.teamFee) : null,
          })),
        })),
      })
    }

    if (mine) {
      const sessionInfo = await getSessionUserId()
      if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

      const where = sessionInfo.isPlatformAdmin ? {} : { ownerId: sessionInfo.userId }

      const leagues = await (prisma as any).league.findMany({
        where,
        include: {
          seasons: {
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { teamSubmissions: true, games: true, divisions: true } } },
          },
          _count: { select: { seasons: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      let ownerMap: Record<string, { firstName: string | null; lastName: string | null; email: string }> = {}
      if (sessionInfo.isPlatformAdmin) {
        const ownerIds = Array.from(new Set(leagues.map((l: any) => l.ownerId as string))) as string[]
        const owners = await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
        ownerMap = Object.fromEntries(owners.map((o: any) => [o.id, o]))
      }

      return NextResponse.json({
        leagues: leagues.map((l: any) => {
          const owner = ownerMap[l.ownerId]
          return {
            ...l,
            seasons: l.seasons.map((s: any) => ({
              ...s,
              teamFee: s.teamFee ? Number(s.teamFee) : null,
            })),
            owner: owner
              ? {
                  name: [owner.firstName, owner.lastName].filter(Boolean).join(" ") || "Unknown",
                  email: owner.email,
                }
              : undefined,
          }
        }),
      })
    }

    return NextResponse.json({ error: "mine=true or public=true required" }, { status: 400 })
  } catch (error) {
    console.error("List leagues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
