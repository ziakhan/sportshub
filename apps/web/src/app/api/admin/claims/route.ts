import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/claims
 * List all club claims for admin review
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: "PlatformAdmin" },
    })
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const claims = await prisma.clubClaim.findMany({
      include: {
        tenant: { select: { id: true, name: true, city: true, contactEmail: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    })

    return NextResponse.json({ claims })
  } catch (error) {
    console.error("Get claims error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
