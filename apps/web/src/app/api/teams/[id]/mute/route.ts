import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

const schema = z.object({ muted: z.boolean() })

/**
 * POST /api/teams/[id]/mute { muted } — per-user chat mute (2026-07-15):
 * no bell/push for this team's chat; unread badges still count.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "muted (boolean) is required" }, { status: 400 })
    }

    if (parsed.data.muted) {
      await (prisma as any).chatMute.upsert({
        where: { userId_teamId: { userId: auth.userId, teamId: params.id } },
        update: {},
        create: { userId: auth.userId, teamId: params.id },
      })
    } else {
      await (prisma as any).chatMute.deleteMany({
        where: { userId: auth.userId, teamId: params.id },
      })
    }
    return NextResponse.json({ muted: parsed.data.muted })
  } catch (error) {
    console.error("Chat mute error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
