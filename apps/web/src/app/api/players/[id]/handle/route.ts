import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { normalizeHandle, validateHandle } from "@/lib/handles"

export const dynamic = "force-dynamic"

const schema = z.object({ handle: z.string().min(1).max(40) })

/**
 * POST /api/players/[id]/handle — claim (or change) a player's handle.
 * The parent owns the claim (a 13+ self-registered player IS their own
 * parent); platform admins can fix squatting. First-come-first-served on
 * the unique column (docs/roadmap/player-handles-plan.md P0).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const player = await prisma.player.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, parentId: true },
    })
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })
    if (player.parentId !== auth.userId && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "Only the player's family can claim their handle" }, { status: 403 })
    }

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid handle" }, { status: 400 })
    }
    const handle = normalizeHandle(parsed.data.handle)
    const problem = validateHandle(handle)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    try {
      const updated = await (prisma as any).player.update({
        where: { id: params.id },
        data: { handle },
        select: { id: true, handle: true },
      })
      return NextResponse.json({ handle: updated.handle, url: `/p/${updated.handle}` })
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json({ error: "That handle is already taken" }, { status: 409 })
      }
      throw e
    }
  } catch (error) {
    console.error("Handle claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
