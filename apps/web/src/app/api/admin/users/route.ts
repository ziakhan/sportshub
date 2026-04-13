import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

const ALLOWED_USER_STATUSES = new Set(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"])

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
 * GET /api/admin/users — List all users with roles
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

    if (status && !ALLOWED_USER_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 })
    }

    const where: any = {}
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ]
    }
    if (status) {
      where.status = status
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          onboardedAt: true,
          roles: {
            select: {
              id: true,
              role: true,
              designation: true,
              tenant: { select: { id: true, name: true } },
              team: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("Admin users list error:", error)
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
  }
}
