import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { isClubAdmin, canActOnTeam } from "@/lib/authz/team-scope"

export const dynamic = "force-dynamic"

/**
 * Publish/unpublish tryout to marketplace
 * POST /api/tryouts/[id]/publish
 * Body: { isPublished?: boolean } — defaults to true (publish) for backward compat.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
    })

    if (!tryout) {
      return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
    }

    // Security fix 2026-07-20: admins publish any tryout; a coach publishes
    // their OWN team's tryout (so they can run it end to end). Club-wide
    // tryouts with no team stay admin-only.
    const allowed = tryout.teamId
      ? await canActOnTeam(userId, tryout.tenantId, tryout.teamId)
      : await isClubAdmin(userId, tryout.tenantId)
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Was hard-coded to `true`, which made every "Unpublish" button a silent
    // no-op (docs/editability-audit.md §4). Default stays publish.
    let isPublished = true
    try {
      const body = await request.json()
      if (typeof body?.isPublished === "boolean") isPublished = body.isPublished
    } catch {
      // No/invalid JSON body — treat as a plain publish.
    }

    const updated = await prisma.tryout.update({
      where: { id: params.id },
      data: { isPublished },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Publish tryout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
