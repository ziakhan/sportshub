import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { withAuth, apiError, type SessionInfo } from "@/lib/api/handler"

export const dynamic = "force-dynamic"

/**
 * Single-review operations ("Gate + moderate", H4):
 *
 * PATCH /api/reviews/[id]
 *   - Author edit: { rating?, title?, content? } — allowed ONLY while the
 *     review is PUBLISHED. A FLAGGED review cannot be edited (editing never
 *     clears a flag — moderation owns that transition), and REMOVED reviews
 *     are frozen.
 *   - Flag: { action: "flag", reason? } — from a ClubOwner/ClubManager of the
 *     reviewed tenant, a LeagueOwner/LeagueManager (or owner) of the reviewed
 *     league, the reviewed person themself, or a PlatformAdmin. Sets
 *     status=FLAGGED + flaggedAt + moderatorNotes=reason. The review STAYS
 *     publicly visible until an admin moderates (flag is not a takedown).
 *
 * DELETE /api/reviews/[id]
 *   - Author hard-deletes their own review (any status); PlatformAdmin may
 *     also delete.
 */

const flagSchema = z.object({
  action: z.literal("flag"),
  reason: z.string().max(500).optional(),
})

const editSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(100).nullable().optional(),
  content: z.string().max(2000).nullable().optional(),
})

type ReviewForAuthz = {
  id: string
  reviewerId: string
  tenantId: string | null
  leagueId: string | null
  revieweeId: string | null
  status: string
  league: { ownerId: string } | null
}

async function getReview(id: string): Promise<ReviewForAuthz | null> {
  return prisma.review.findUnique({
    where: { id },
    select: {
      id: true,
      reviewerId: true,
      tenantId: true,
      leagueId: true,
      revieweeId: true,
      status: true,
      league: { select: { ownerId: true } },
    },
  }) as Promise<ReviewForAuthz | null>
}

/** May this caller flag the review? (Managers of the reviewed target.) */
async function canFlag(session: SessionInfo, review: ReviewForAuthz): Promise<boolean> {
  if (session.isPlatformAdmin) return true
  // The reviewed person can flag reviews about themself.
  if (review.revieweeId && review.revieweeId === session.userId) return true
  if (review.tenantId) {
    const role = await prisma.userRole.findFirst({
      where: {
        userId: session.userId,
        tenantId: review.tenantId,
        role: { in: ["ClubOwner", "ClubManager"] },
      },
      select: { id: true },
    })
    if (role) return true
  }
  if (review.leagueId) {
    if (review.league?.ownerId === session.userId) return true
    const role = await prisma.userRole.findFirst({
      where: {
        userId: session.userId,
        leagueId: review.leagueId,
        role: { in: ["LeagueOwner", "LeagueManager"] },
      },
      select: { id: true },
    })
    if (role) return true
  }
  return false
}

export const PATCH = withAuth<NextRequest, { params: { id: string } }>(
  async (request, { params }, session) => {
    const review = await getReview(params.id)
    if (!review) {
      return apiError(404, "Review not found", "NOT_FOUND")
    }

    const body = await request.json()

    // ── Flag path ──────────────────────────────────────────────────────────
    if (body?.action === "flag") {
      const data = flagSchema.parse(body)
      if (!(await canFlag(session, review))) {
        return apiError(403, "Forbidden", "FORBIDDEN")
      }
      if (review.status === "REMOVED") {
        return apiError(400, "This review has already been removed", "ALREADY_REMOVED")
      }
      await prisma.review.update({
        where: { id: review.id },
        data: {
          status: "FLAGGED",
          flaggedAt: new Date(),
          // Keep any earlier reason if the new flag doesn't supply one.
          ...(data.reason ? { moderatorNotes: data.reason } : {}),
        },
      })
      return NextResponse.json({ success: true, status: "FLAGGED" })
    }

    // ── Author edit path ───────────────────────────────────────────────────
    if (review.reviewerId !== session.userId) {
      return apiError(403, "Forbidden", "FORBIDDEN")
    }
    if (review.status !== "PUBLISHED") {
      // FLAGGED: locked for moderation (author edits never clear a flag).
      // REMOVED: frozen.
      return apiError(
        409,
        review.status === "FLAGGED"
          ? "This review is under moderation and can't be edited right now."
          : "This review was removed and can't be edited.",
        "NOT_EDITABLE"
      )
    }

    const data = editSchema.parse(body)
    if (data.rating === undefined && data.title === undefined && data.content === undefined) {
      return apiError(400, "Nothing to update", "VALIDATION")
    }

    const updated = await prisma.review.update({
      where: { id: review.id },
      data: {
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.title !== undefined ? { title: data.title || null } : {}),
        ...(data.content !== undefined ? { content: data.content || null } : {}),
      },
      select: { id: true, rating: true, title: true, content: true, status: true },
    })

    return NextResponse.json({ success: true, review: updated })
  }
)

export const DELETE = withAuth<NextRequest, { params: { id: string } }>(
  async (_request, { params }, session) => {
    const review = await getReview(params.id)
    if (!review) {
      return apiError(404, "Review not found", "NOT_FOUND")
    }
    if (review.reviewerId !== session.userId && !session.isPlatformAdmin) {
      return apiError(403, "Forbidden", "FORBIDDEN")
    }
    await prisma.review.delete({ where: { id: review.id } })
    return NextResponse.json({ success: true })
  }
)
