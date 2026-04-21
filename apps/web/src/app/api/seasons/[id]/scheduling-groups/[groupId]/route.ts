import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const patchGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  divisionIds: z.array(z.string()).optional(),
})

async function assertSeasonOwner(seasonId: string, userId: string, isAdmin: boolean) {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { league: { select: { ownerId: true } } },
  })
  if (!season) return "notfound"
  if (season.league.ownerId !== userId && !isAdmin) return "forbidden"
  return null
}

/**
 * PATCH /api/seasons/[id]/scheduling-groups/[groupId] — Rename group and/or replace its division set
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; groupId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const err = await assertSeasonOwner(params.id, sessionInfo.userId, sessionInfo.isPlatformAdmin)
    if (err === "notfound") return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (err === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const group = await (prisma as any).schedulingGroup.findUnique({
      where: { id: params.groupId },
      select: { seasonId: true },
    })
    if (!group || group.seasonId !== params.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = patchGroupSchema.parse(body)

    await (prisma as any).$transaction(async (tx: any) => {
      if (data.name !== undefined) {
        await tx.schedulingGroup.update({
          where: { id: params.groupId },
          data: { name: data.name },
        })
      }
      if (data.divisionIds !== undefined) {
        await tx.schedulingGroupDivision.deleteMany({
          where: { schedulingGroupId: params.groupId },
        })
        if (data.divisionIds.length > 0) {
          await tx.schedulingGroupDivision.createMany({
            data: data.divisionIds.map((divisionId) => ({
              schedulingGroupId: params.groupId,
              divisionId,
            })),
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update scheduling group error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/seasons/[id]/scheduling-groups/[groupId] — Remove a scheduling group
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; groupId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const err = await assertSeasonOwner(params.id, sessionInfo.userId, sessionInfo.isPlatformAdmin)
    if (err === "notfound") return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (err === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const group = await (prisma as any).schedulingGroup.findUnique({
      where: { id: params.groupId },
      select: { seasonId: true },
    })
    if (!group || group.seasonId !== params.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await (prisma as any).schedulingGroup.delete({ where: { id: params.groupId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete scheduling group error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
