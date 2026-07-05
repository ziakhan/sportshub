import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

// Seed data uses non-UUID ids — plain strings by project convention
const targetSchema = z
  .object({
    teamId: z.string().optional(),
    tenantId: z.string().optional(),
    leagueId: z.string().optional(),
  })
  .refine((d) => [d.teamId, d.tenantId, d.leagueId].filter(Boolean).length === 1, {
    message: "Provide exactly one of teamId, tenantId, leagueId",
  })

/** GET /api/follows — the viewer's explicit follows */
export async function GET() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const follows = await (prisma as any).follow.findMany({
    where: { userId: sessionInfo.userId },
    select: { id: true, teamId: true, tenantId: true, leagueId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ follows })
}

/** POST /api/follows — follow a team/club/league (idempotent) */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const target = targetSchema.parse(body)

    const existing = await (prisma as any).follow.findFirst({
      where: { userId: sessionInfo.userId, ...target },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ following: true })

    try {
      await (prisma as any).follow.create({
        data: { userId: sessionInfo.userId, ...target },
      })
    } catch (err: any) {
      if (err?.code === "P2003") {
        return NextResponse.json({ error: "Target not found" }, { status: 404 })
      }
      if (err?.code !== "P2002") throw err // P2002 = raced duplicate — fine
    }
    return NextResponse.json({ following: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Follow error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/follows — unfollow */
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
