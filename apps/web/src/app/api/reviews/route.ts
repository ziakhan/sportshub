import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createReviewSchema = z.object({
  tenantId: z.string().optional(),
  leagueId: z.string().optional(),
  revieweeId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  content: z.string().max(2000).optional(),
}).refine(
  (data) => data.tenantId || data.leagueId || data.revieweeId,
  { message: "Must review a club, league, or individual" }
)

/**
 * Create a review (auth required)
 * POST /api/reviews
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createReviewSchema.parse(body)

    // Can't review yourself
    if (data.revieweeId === session.user.id) {
      return NextResponse.json({ error: "Cannot review yourself" }, { status: 400 })
    }

    // Check for existing review (one per user per target)
    const existing = await prisma.review.findFirst({
      where: {
        reviewerId: session.user.id,
        tenantId: data.tenantId || null,
        leagueId: data.leagueId || null,
        revieweeId: data.revieweeId || null,
      },
    })
    if (existing) {
      return NextResponse.json({ error: "You have already reviewed this" }, { status: 409 })
    }

    const review = await prisma.review.create({
      data: {
        reviewerId: session.user.id,
        tenantId: data.tenantId || null,
        leagueId: data.leagueId || null,
        revieweeId: data.revieweeId || null,
        rating: data.rating,
        title: data.title || null,
        content: data.content || null,
      },
    })

    return NextResponse.json({ success: true, id: review.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create review error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * List reviews (public)
 * GET /api/reviews?tenantId=xxx or ?leagueId=xxx or ?revieweeId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId")
    const leagueId = request.nextUrl.searchParams.get("leagueId")
    const revieweeId = request.nextUrl.searchParams.get("revieweeId")

    if (!tenantId && !leagueId && !revieweeId) {
      return NextResponse.json({ error: "tenantId, leagueId, or revieweeId is required" }, { status: 400 })
    }

    const where: any = { status: "PUBLISHED" }
    if (tenantId) where.tenantId = tenantId
    if (leagueId) where.leagueId = leagueId
    if (revieweeId) where.revieweeId = revieweeId

    const [reviews, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          createdAt: true,
          reviewer: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ])

    return NextResponse.json({
      reviews: reviews.map((r: any) => ({
        ...r,
        reviewer: {
          name: [r.reviewer.firstName, r.reviewer.lastName?.[0] ? `${r.reviewer.lastName[0]}.` : ""].filter(Boolean).join(" "),
        },
      })),
      averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : null,
      totalReviews: aggregate._count.rating,
    })
  } catch (error) {
    console.error("Get reviews error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
