import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const updateCourtSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  displayOrder: z.number().int().optional(),
})

/**
 * PATCH /api/venues/[id]/courts/[courtId] — Rename or reorder a court
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; courtId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const data = updateCourtSchema.parse(body)

    const updated = await (prisma as any).court.update({
      where: { id: params.courtId },
      data,
    })

    return NextResponse.json({ success: true, ...updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update court error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/venues/[id]/courts/[courtId] — Remove a court
 * Fails if the court is referenced by any games (to prevent orphaning scheduled matches).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; courtId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const gameCount = await (prisma as any).game.count({ where: { courtId: params.courtId } })
    if (gameCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${gameCount} game(s) reference this court` },
        { status: 409 }
      )
    }

    await (prisma as any).court.delete({ where: { id: params.courtId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete court error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
