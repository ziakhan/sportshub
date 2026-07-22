import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { guardianUserIds } from "@/lib/authz/player-scope"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// Seed data uses non-UUID ids — plain strings by project convention
const targetSchema = z
  .object({
    teamId: z.string().optional(),
    tenantId: z.string().optional(),
    leagueId: z.string().optional(),
    playerId: z.string().optional(),
  })
  .refine((d) => [d.teamId, d.tenantId, d.leagueId, d.playerId].filter(Boolean).length === 1, {
    message: "Provide exactly one of teamId, tenantId, leagueId, playerId",
  })

/** GET /api/follows — the viewer's explicit follows */
export async function GET() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const follows = await (prisma as any).follow.findMany({
    where: { userId: sessionInfo.userId },
    select: {
      id: true,
      teamId: true,
      tenantId: true,
      leagueId: true,
      playerId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ follows })
}

/**
 * POST /api/follows — follow a team/club/league (instant) or a player
 * (social-feed-plan P3: instant when the player is PUBLIC, a PENDING request
 * the parent/13+ player approves when PRIVATE). Idempotent.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const target = targetSchema.parse(body)

    const existing = await (prisma as any).follow.findFirst({
      where: { userId: sessionInfo.userId, ...target },
      select: { id: true, status: true },
    })
    if (existing) {
      return NextResponse.json({ following: existing.status === "ACTIVE", status: existing.status })
    }

    let status: "ACTIVE" | "PENDING" = "ACTIVE"
    if (target.playerId) {
      const player = await (prisma as any).player.findUnique({
        where: { id: target.playerId },
        select: { socialVisibility: true, deletedAt: true, parentId: true },
      })
      if (!player || player.deletedAt) {
        return NextResponse.json({ error: "Target not found" }, { status: 404 })
      }
      // Your own player is always ACTIVE (family is never "pending")
      if (player.parentId !== sessionInfo.userId && player.socialVisibility === "PRIVATE") {
        status = "PENDING"
      }
    }

    try {
      await (prisma as any).follow.create({
        data: { userId: sessionInfo.userId, ...target, status },
      })
    } catch (err: any) {
      if (err?.code === "P2003") {
        return NextResponse.json({ error: "Target not found" }, { status: 404 })
      }
      if (err?.code !== "P2002") throw err // P2002 = raced duplicate — fine
    }

    // Bell the guardian on a new request — they approve from the player page
    if (target.playerId && status === "PENDING") {
      try {
        const follower = await prisma.user.findUnique({
          where: { id: sessionInfo.userId },
          select: { firstName: true, lastName: true, email: true },
        })
        const who =
          `${follower?.firstName ?? ""} ${follower?.lastName ?? ""}`.trim() ||
          follower?.email ||
          "Someone"
        await notifyMany(prisma, await guardianUserIds(target.playerId), {
          type: "follow_request",
          title: "New follow request",
          message: `${who} asked to follow your player.`,
          link: `/players/${target.playerId}/edit`,
          referenceId: target.playerId,
          referenceType: "Player",
        })
      } catch (bellErr) {
        console.error("Follow-request bell failed:", bellErr)
      }
    }

    return NextResponse.json({ following: status === "ACTIVE", status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Follow error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/follows — unfollow (also cancels a pending request) */
export async function DELETE(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const target = targetSchema.parse(body)

    await (prisma as any).follow.deleteMany({
      where: { userId: sessionInfo.userId, ...target },
    })
    return NextResponse.json({ following: false })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Unfollow error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
