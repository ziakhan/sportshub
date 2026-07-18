import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { hasLiveReviewInvite } from "@/lib/reviews/invites"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

/**
 * Public visibility policy (owner decision, "Gate + moderate"):
 * - PUBLISHED and FLAGGED reviews stay publicly visible — a flag is a request
 *   for moderation, not a takedown. Only an admin "remove" hides a review.
 * - REMOVED reviews are hidden everywhere except the admin moderation queue.
 * Keep in sync with getReviewsData in (public)/club/[slug]/page.tsx.
 */
const PUBLIC_REVIEW_STATUSES = ["PUBLISHED", "FLAGGED"] as const

const createReviewSchema = z
  .object({
    tenantId: z.string().optional(),
    leagueId: z.string().optional(),
    revieweeId: z.string().optional(),
    rating: z.number().int().min(1).max(5),
    title: z.string().max(100).optional(),
    content: z.string().max(2000).optional(),
  })
  .refine((data) => data.tenantId || data.leagueId || data.revieweeId, {
    message: "Must review a club, league, or individual",
  })

/**
 * Relationship gate for club reviews: the reviewer must have actually
 * engaged with the club. Any of:
 * - a UserRole at the tenant (owner/manager/staff/team-scoped staff),
 * - a tryout/camp/house-league signup they created for the club's programs,
 * - an offer for one of their players at the club's teams,
 * - a player of theirs on a roster of the club's teams.
 */
async function hasClubRelationship(userId: string, tenantId: string): Promise<boolean> {
  const [role, tryoutSignup, campSignup, houseLeagueSignup, offer, rosterSpot] = await Promise.all([
    prisma.userRole.findFirst({
      where: { userId, OR: [{ tenantId }, { team: { tenantId } }] },
      select: { id: true },
    }),
    prisma.tryoutSignup.findFirst({
      where: { userId, tryout: { tenantId } },
      select: { id: true },
    }),
    (prisma as any).campSignup.findFirst({
      where: { userId, camp: { tenantId } },
      select: { id: true },
    }),
    (prisma as any).houseLeagueSignup.findFirst({
      where: { userId, houseLeague: { tenantId } },
      select: { id: true },
    }),
    prisma.offer.findFirst({
      where: { player: { parentId: userId }, team: { tenantId } },
      select: { id: true },
    }),
    prisma.teamPlayer.findFirst({
      where: { player: { parentId: userId }, team: { tenantId } },
      select: { id: true },
    }),
  ])
  return !!(role || tryoutSignup || campSignup || houseLeagueSignup || offer || rosterSpot)
}

/**
 * Relationship gate for league reviews (analogous, kept cheap): the reviewer
 * must be a league staffer/referee (league-scoped UserRole), a member of a
 * club that submitted a team into one of the league's seasons, or a parent
 * whose player is on a season roster in the league.
 */
async function hasLeagueRelationship(userId: string, leagueId: string): Promise<boolean> {
  const [leagueRole, ownsLeague, clubMemberSubmission, rosteredChild] = await Promise.all([
    prisma.userRole.findFirst({ where: { userId, leagueId }, select: { id: true } }),
    prisma.league.findFirst({ where: { id: leagueId, ownerId: userId }, select: { id: true } }),
    (prisma as any).teamSubmission.findFirst({
      where: {
        season: { leagueId },
        team: { tenant: { staff: { some: { userId } } } },
      },
      select: { id: true },
    }),
    (prisma as any).seasonRosterPlayer.findFirst({
      where: { player: { parentId: userId }, roster: { season: { leagueId } } },
      select: { id: true },
    }),
  ])
  return !!(leagueRole || ownsLeague || clubMemberSubmission || rosteredChild)
}

/**
 * Create a review (auth required)
 * POST /api/reviews
 *
 * Relationship gate ("Gate + moderate", H4):
 * - Club (tenantId) targets: must pass hasClubRelationship.
 * - League (leagueId) targets: must pass hasLeagueRelationship.
 * - Person (revieweeId) targets: NO relationship gate (coach/referee
 *   interactions aren't reliably queryable) — the self-review block below and
 *   flag/moderation path cover abuse.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createReviewSchema.parse(body)

    // Can't review yourself
    if (data.revieweeId === sessionInfo.userId) {
      return NextResponse.json({ error: "Cannot review yourself" }, { status: 400 })
    }

    // Relationship gate — participation required to review a club or league.
    if (data.tenantId && !(await hasClubRelationship(sessionInfo.userId, data.tenantId))) {
      return NextResponse.json(
        {
          error: "Only families and members who've participated with this club can review it.",
          code: "REVIEW_GATE",
        },
        { status: 403 }
      )
    }
    // Window gate (owner 2026-07-18): club reviews open only in the
    // post-season invite window — season concludes → invite → 30 days.
    if (data.tenantId && !(await hasLiveReviewInvite(sessionInfo.userId, data.tenantId))) {
      return NextResponse.json(
        {
          error:
            "Reviews open when a season you participated in concludes — watch for the invitation.",
          code: "REVIEW_WINDOW_CLOSED",
        },
        { status: 403 }
      )
    }
    if (data.leagueId && !(await hasLeagueRelationship(sessionInfo.userId, data.leagueId))) {
      return NextResponse.json(
        {
          error: "Only clubs and families who have participated in this league can review it.",
          code: "REVIEW_GATE",
        },
        { status: 403 }
      )
    }

    // Check for existing review (one per user per target)
    const existing = await prisma.review.findFirst({
      where: {
        reviewerId: sessionInfo.userId,
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
        reviewerId: sessionInfo.userId,
        tenantId: data.tenantId || null,
        leagueId: data.leagueId || null,
        revieweeId: data.revieweeId || null,
        rating: data.rating,
        title: data.title || null,
        content: data.content || null,
        status: "PENDING",
      },
    })

    return NextResponse.json({ success: true, id: review.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: "tenantId, leagueId, or revieweeId is required" },
        { status: 400 }
      )
    }

    // FLAGGED stays visible until an admin moderates; REMOVED is hidden.
    const where: any = { status: { in: [...PUBLIC_REVIEW_STATUSES] } }
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
          status: true,
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
          name: [r.reviewer.firstName, r.reviewer.lastName?.[0] ? `${r.reviewer.lastName[0]}.` : ""]
            .filter(Boolean)
            .join(" "),
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
