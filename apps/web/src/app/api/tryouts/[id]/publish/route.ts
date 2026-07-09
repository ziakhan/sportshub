import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

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

    // Verify permissions (ClubOwner, ClubManager, or PlatformAdmin)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: {
            OR: [
              { tenantId: tryout.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
              { role: "PlatformAdmin" },
            ],
          },
        },
      },
    })

    if (!user || user.roles.length === 0) {
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
