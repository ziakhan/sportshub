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
      // Census imports are only public once reviewed; merged-away rows never are.
      publishedAt: { not: null },
      mergedIntoId: null,
    }

    // The landing's claim box suggests clubs BEFORE anyone types; those
    // suggestions must be claimABLE (owner 2026-08-18: the seed worlds
    // adopted big listings, so a plain size sort was showcasing clubs that
    // are already taken). Search results still include everything.
    if (request.nextUrl.searchParams.get("unclaimed") === "1") {
      where.status = "UNCLAIMED"
    }

    // Region-aware suggestions (owner 2026-08-19): the landing passes the
    // visitor's likely province (inferred client-side from the timezone) so
    // the three suggested clubs feel local. Additive param; absent = national.
    const province = (request.nextUrl.searchParams.get("province") || "").trim().toUpperCase()
    if (province && /^[A-Z]{2}$/.test(province)) {
      where.state = { equals: province, mode: "insensitive" }
    }

    if (q.length >= 2) {
      where.name = { contains: q, mode: "insensitive" }
    }

    // shuffle=1 (owner 2026-08-19): the claim box was showing the same three
    // biggest unclaimed clubs to every visitor. With shuffle, the API draws a
    // wider pool and samples it, so the suggestions rotate per load.
    const shuffle = request.nextUrl.searchParams.get("shuffle") === "1"

    let clubs = (
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
        // Overfetch before the test-world filter so a capped `limit` doesn't
        // come back short; much wider when shuffling so the sample has range.
        take: shuffle ? Math.max(limit * 20, 60) : limit + 10,
      })
    ).filter((c: any) => !isTestWorldSlug(c.slug))

    // Fisher-Yates on the pool, then cut. Only the suggestion path shuffles;
    // typed searches keep their size ordering.
    if (shuffle) {
      for (let i = clubs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[clubs[i], clubs[j]] = [clubs[j], clubs[i]]
      }
    }
    const picked = clubs.slice(0, limit)

    return NextResponse.json({
      clubs: picked.map((c: any) => ({
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
