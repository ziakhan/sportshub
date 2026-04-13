import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

const ALLOWED_TENANT_STATUSES = new Set(["ACTIVE", "UNCLAIMED", "SUSPENDED"])

function toPositivePage(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

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
  try {
    const adminId = await requireAdmin()
    if (!adminId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const search = (request.nextUrl.searchParams.get("search") || "").trim()
    const status = (request.nextUrl.searchParams.get("status") || "").trim()
    const page = toPositivePage(request.nextUrl.searchParams.get("page"))
    const limit = 20

    if (status && !ALLOWED_TENANT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 })
    }

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
      clubs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts: { active: activeCount, unclaimed: unclaimedCount, suspended: suspendedCount },
    })
  } catch (error) {
    console.error("Admin clubs list error:", error)
    return NextResponse.json({ error: "Failed to load clubs" }, { status: 500 })
  }
}
