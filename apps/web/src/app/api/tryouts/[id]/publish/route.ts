import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

/**
 * Publish tryout to marketplace
 * POST /api/tryouts/[id]/publish
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const updated = await prisma.tryout.update({
      where: { id: params.id },
      data: { isPublished: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Publish tryout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
