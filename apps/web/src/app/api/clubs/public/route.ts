import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * Public club search/discovery — no auth required
 * GET /api/clubs/public?q=toronto&limit=12
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || ""
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "12"), 50)

    const where: any = {
      status: { in: ["ACTIVE", "UNCLAIMED"] },
    }

    if (q.length >= 2) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ]
    }

    const clubs = await prisma.tenant.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        state: true,
        country: true,
        description: true,
        status: true,
        branding: { select: { primaryColor: true, logoUrl: true } },
        _count: { select: { teams: true, tryouts: true } },
      },
      orderBy: { teams: { _count: "desc" } },
      take: limit,
    })

    return NextResponse.json({
      clubs: clubs.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        city: c.city,
        state: c.state,
        description: c.description,
        status: c.status,
        teamCount: c._count.teams,
        tryoutCount: c._count.tryouts,
        primaryColor: c.branding?.primaryColor || "#1a73e8",
        logoUrl: c.branding?.logoUrl || null,
      })),
    })
  } catch (error) {
    console.error("Public clubs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
