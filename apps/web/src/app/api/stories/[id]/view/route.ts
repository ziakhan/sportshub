import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/** POST /api/stories/[id]/view — record that the viewer opened this story
 *  (unique per user; powers the family's view counts). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      await (prisma as any).storyView.create({
        data: { storyId: params.id, userId: sessionInfo.userId },
      })
    } catch (err: any) {
      if (err?.code === "P2003") {
        return NextResponse.json({ error: "Story not found" }, { status: 404 })
      }
      if (err?.code !== "P2002") throw err // already viewed — fine
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Story view error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
