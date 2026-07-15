import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/clubs/[slug] — a club's public profile for the
 * native club screen: identity + branding, active teams, upcoming programs,
 * published-review aggregate + latest reviews. Anonymous; the essentials of
 * the public /club/[slug] page without its block-layout machinery.
 */
export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const club = await prisma.tenant.findFirst({
      where: { slug: params.slug, status: { in: ["ACTIVE", "UNCLAIMED"] } },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        city: true,
        state: true,
        country: true,
        website: true,
        status: true,
        branding: { select: { primaryColor: true, logoUrl: true } },
        teams: {
          where: { archivedAt: null },
          select: { id: true, name: true, ageGroup: true, gender: true },
          orderBy: { name: "asc" },
        },
      },
    })
    if (!club) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = new Date()
    const [tryouts, camps, houseLeagues, reviewAgg, reviews] = await Promise.all([
      prisma.tryout.findMany({
        where: { tenantId: club.id, isPublished: true, isPublic: true, scheduledAt: { gte: now } },
        select: { id: true, title: true, ageGroup: true, scheduledAt: true, location: true, fee: true },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
      prisma.camp.findMany({
        where: { tenantId: club.id, isPublished: true, endDate: { gte: now } },
        select: { id: true, name: true, ageGroup: true, startDate: true, location: true, weeklyFee: true },
        orderBy: { startDate: "asc" },
        take: 10,
      }),
      prisma.houseLeague.findMany({
        where: { tenantId: club.id, isPublished: true, endDate: { gte: now } },
        select: { id: true, name: true, ageGroups: true, startDate: true, location: true, fee: true },
        orderBy: { startDate: "asc" },
        take: 10,
      }),
      prisma.review.aggregate({
        where: { tenantId: club.id, status: "PUBLISHED" },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.review.findMany({
        where: { tenantId: club.id, status: "PUBLISHED" },
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          createdAt: true,
          reviewer: { select: { firstName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    return NextResponse.json({
      club: {
        id: club.id,
        slug: club.slug,
        name: club.name,
        description: club.description,
        city: club.city,
        state: club.state,
        country: club.country,
        website: club.website,
        status: club.status,
        primaryColor: club.branding?.primaryColor ?? null,
        logoUrl: club.branding?.logoUrl ?? null,
        teams: club.teams,
      },
      programs: [
        ...tryouts.map((t: any) => ({
          id: t.id,
          type: "tryout" as const,
          name: t.title,
          ageGroup: t.ageGroup,
          startDate: t.scheduledAt,
          location: t.location,
          fee: Number(t.fee),
        })),
        ...camps.map((c: any) => ({
          id: c.id,
          type: "camp" as const,
          name: c.name,
          ageGroup: c.ageGroup,
          startDate: c.startDate,
          location: c.location,
          fee: Number(c.weeklyFee),
        })),
        ...houseLeagues.map((h: any) => ({
          id: h.id,
          type: "house-league" as const,
          name: h.name,
          ageGroup: (h.ageGroups || "").split(",").join(", "),
          startDate: h.startDate,
          location: h.location,
          fee: Number(h.fee),
        })),
      ].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
      rating: {
        average: reviewAgg._avg.rating,
        count: reviewAgg._count,
      },
      reviews: reviews.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        content: r.content,
        createdAt: r.createdAt,
        reviewer: r.reviewer?.firstName ?? "Parent",
      })),
    })
  } catch (error) {
    console.error("Mobile club profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
