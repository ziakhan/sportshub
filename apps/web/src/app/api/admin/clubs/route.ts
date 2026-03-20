import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const role = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: "PlatformAdmin" },
  })
  return role ? session.user.id : null
}

/**
 * GET /api/admin/clubs — List all clubs
 */
export async function GET(request: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const search = request.nextUrl.searchParams.get("search") || ""
  const status = request.nextUrl.searchParams.get("status") || ""
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1")
  const limit = 20

  const where: any = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ]
  }
  if (status) {
    where.status = status
  }

  const [clubs, total, activeCount, unclaimedCount, suspendedCount] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        _count: { select: { teams: true, tryouts: true, staff: true } },
        staff: {
          where: { role: "ClubOwner" },
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tenant.count({ where }),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "UNCLAIMED" } }),
    prisma.tenant.count({ where: { status: "SUSPENDED" } }),
  ])

  return NextResponse.json({
    clubs, total, page, totalPages: Math.ceil(total / limit),
    statusCounts: { active: activeCount, unclaimed: unclaimedCount, suspended: suspendedCount },
  })
}
