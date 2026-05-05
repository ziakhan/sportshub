import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"

export const dynamic = "force-dynamic"

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  divisionIds: z.array(z.string()).default([]),
})

async function assertSeasonOwner(seasonId: string, userId: string, isAdmin: boolean) {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { status: true, league: { select: { ownerId: true } } },
  })
  if (!season) return { kind: "notfound" as const }
  if (season.league.ownerId !== userId && !isAdmin) return { kind: "forbidden" as const }
  if (isSeasonLocked(season.status)) return { kind: "locked" as const, status: season.status }
  return null
}

/**
 * GET /api/seasons/[id]/scheduling-groups — List scheduling groups with assigned divisions
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const groups = await (prisma as any).schedulingGroup.findMany({
      where: { seasonId: params.id },
      include: {
        divisions: {
          include: { division: { select: { id: true, name: true, ageGroup: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json({ groups })
  } catch (error) {
    console.error("List scheduling groups error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/seasons/[id]/scheduling-groups — Create a scheduling group and assign divisions
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const err = await assertSeasonOwner(params.id, sessionInfo.userId, sessionInfo.isPlatformAdmin)
    if (err?.kind === "notfound") return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (err?.kind === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (err?.kind === "locked") return NextResponse.json({ error: SEASON_LOCKED_MESSAGE, status: err.status }, { status: 409 })

    const body = await request.json()
    const data = createGroupSchema.parse(body)

    const group = await (prisma as any).schedulingGroup.create({
      data: {
        seasonId: params.id,
        name: data.name,
        divisions: {
          create: data.divisionIds.map((divisionId) => ({ divisionId })),
        },
      },
    })

    return NextResponse.json({ success: true, id: group.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create scheduling group error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
