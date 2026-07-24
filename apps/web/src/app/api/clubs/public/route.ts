import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { isTestWorldSlug } from "@/lib/demo-data"

export const dynamic = "force-dynamic"

/**
 * Public club search/discovery — no auth required
 * GET /api/clubs/public?q=toronto&limit=12
 *
 * Feeds the web /club directory's autocomplete box only (native uses
 * /api/mobile/browse/clubs, which shares getClubsDirectory() with the
 * directory page itself — 2026-07-24). Kept here as a light, limit-capped
 * search; still excludes test-world/simulator tenants so autocomplete never
 * suggests a club the directory page itself would hide.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || ""
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "12"), 50)

    const where: any = {
      status: { in: ["ACTIVE", "UNCLAIMED"] },
    }

    if (q.length >= 2) {
      where.name = { contains: q, mode: "insensitive" }
    }

    const clubs = (
      await prisma.tenant.findMany({
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
        // Overfetch a little before the test-world filter so a capped
        // `limit` doesn't come back short.
        take: limit + 10,
      })
    ).filter((c: any) => !isTestWorldSlug(c.slug)).slice(0, limit)

    return NextResponse.json({
      clubs: clubs.map((c: any) => ({
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
