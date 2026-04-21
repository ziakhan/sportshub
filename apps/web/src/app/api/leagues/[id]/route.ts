import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

/**
 * GET /api/leagues/[id] — Get persistent league + its seasons
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const league = await (prisma as any).league.findUnique({
      where: { id: params.id },
      include: {
        seasons: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { teamSubmissions: true, games: true, divisions: true } },
          },
        },
      },
    })

    if (!league) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...league,
      seasons: league.seasons.map((s: any) => ({
        ...s,
        teamFee: s.teamFee ? Number(s.teamFee) : null,
      })),
    })
  } catch (error) {
    console.error("Get league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const updateLeagueSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
})

/**
 * PATCH /api/leagues/[id] — Update persistent league metadata
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const league = await (prisma as any).league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = updateLeagueSchema.parse(await request.json())
    const updated = await (prisma as any).league.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ success: true, ...updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Update league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/leagues/[id] — Delete league (only if no seasons)
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const league = await (prisma as any).league.findUnique({
      where: { id: params.id },
      select: { ownerId: true, _count: { select: { seasons: true } } },
    })
    if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (league._count.seasons > 0) {
      return NextResponse.json(
        { error: "Delete all seasons before deleting the league" },
        { status: 409 }
      )
    }

    await (prisma as any).league.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete league error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
