import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

/**
 * DEV ONLY: Switch the current user's role for testing
 * DELETE THIS IN PRODUCTION
 */

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const userId = session.user.id

    const { role } = await req.json()

    const validRoles = [
      "ClubOwner", "ClubManager", "Staff", "TeamManager", "Scorekeeper",
      "LeagueOwner", "LeagueManager", "Parent", "Player", "Referee", "PlatformAdmin",
    ]

    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 })
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { tenant: true } } },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found in database." }, { status: 404 })
    }

    // Find any existing tenant (for club-scoped roles)
    const tenant = await prisma.tenant.findFirst()

    // Delete all existing roles for this user
    await prisma.userRole.deleteMany({
      where: { userId: user.id },
    })

    // Determine if role needs tenant scope
    const needsTenant = ["ClubOwner", "ClubManager", "Staff", "TeamManager", "Scorekeeper"].includes(role)

    // Create new role
    const newRole = await prisma.userRole.create({
      data: {
        userId: user.id,
        role: role,
        tenantId: needsTenant && tenant ? tenant.id : null,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Role switched to ${role}`,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      },
      role: role,
      tenantScoped: needsTenant && tenant ? tenant.name : null,
    })
  } catch (error) {
    console.error("Error switching role:", error)
    return NextResponse.json(
      { error: "Failed to switch role", details: String(error) },
      { status: 500 }
    )
  }
}

// GET: Show current role
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { tenant: true } } },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      },
      roles: user.roles.map((r: any) => ({
        role: r.role,
        tenant: r.tenant?.name || null,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get role", details: String(error) },
      { status: 500 }
    )
  }
}
