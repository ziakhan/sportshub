import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { withAuth, requirePlatformAdmin, apiError } from "@/lib/api/handler"

export const dynamic = "force-dynamic"

/**
 * Platform-admin review moderation ("Gate + moderate", H4).
 *
 * GET  /api/admin/reviews?status=FLAGGED|REMOVED|PUBLISHED  (default FLAGGED)
 * PATCH /api/admin/reviews { id, action: "restore" | "remove", notes? }
 *   - restore → PUBLISHED (clears nothing else; moderatedAt stamped)
 *   - remove  → REMOVED   (moderatedAt stamped, notes recorded)
 */

const STATUSES = ["FLAGGED", "REMOVED", "PUBLISHED"] as const

export const GET = withAuth<NextRequest>(async (request, _context, session) => {
  requirePlatformAdmin(session)

  const raw = request.nextUrl.searchParams.get("status") || "PENDING"
  if (!STATUSES.includes(raw as (typeof STATUSES)[number])) {
    return apiError(400, "Invalid status filter", "VALIDATION")
  }

  const reviews = await prisma.review.findMany({
    where: { status: raw as any },
    select: {
      id: true,
      rating: true,
      title: true,
      content: true,
      status: true,
      flaggedAt: true,
      moderatedAt: true,
      moderatorNotes: true,
      createdAt: true,
      reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      tenant: { select: { id: true, name: true, slug: true } },
      league: { select: { id: true, name: true } },
      reviewee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ flaggedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  })

  return NextResponse.json({ reviews })
})

const moderateSchema = z.object({
  id: z.string(),
  action: z.enum(["approve", "restore", "remove"]),
  notes: z.string().max(500).optional(),
})

export const PATCH = withAuth<NextRequest>(async (request, _context, session) => {
  requirePlatformAdmin(session)

  const body = await request.json()
  const data = moderateSchema.parse(body)

  const review = await prisma.review.findUnique({
    where: { id: data.id },
    select: { id: true, status: true },
  })
  if (!review) {
    return apiError(404, "Review not found", "NOT_FOUND")
  }

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      status: data.action === "remove" ? "REMOVED" : "PUBLISHED",
      moderatedAt: new Date(),
      // Record the moderator's note when given; otherwise keep the flag reason
      // so the history stays legible.
      ...(data.notes ? { moderatorNotes: data.notes } : {}),
    },
    select: { id: true, status: true, moderatedAt: true, moderatorNotes: true },
  })

  return NextResponse.json({ success: true, review: updated })
})
