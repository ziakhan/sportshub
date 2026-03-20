import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import bcrypt from "bcryptjs"

/**
 * DEV ONLY: Create test users with different roles
 * DELETE THIS IN PRODUCTION
 */

const TEST_PASSWORD = "testpassword123"

const TEST_USERS = [
  {
    email: "clubowner@test.com",
    firstName: "Marcus",
    lastName: "Johnson",
    role: "ClubOwner" as const,
  },
  {
    email: "clubmanager@test.com",
    firstName: "Sarah",
    lastName: "Williams",
    role: "ClubManager" as const,
  },
  {
    email: "staff@test.com",
    firstName: "David",
    lastName: "Thompson",
    role: "Staff" as const,
  },
  {
    email: "parent@test.com",
    firstName: "Lisa",
    lastName: "Garcia",
    role: "Parent" as const,
  },
  {
    email: "player@test.com",
    firstName: "James",
    lastName: "Davis",
    role: "Player" as const,
  },
  {
    email: "referee@test.com",
    firstName: "Michael",
    lastName: "Brown",
    role: "Referee" as const,
  },
  {
    email: "leagueowner@test.com",
    firstName: "Jennifer",
    lastName: "Martinez",
    role: "LeagueOwner" as const,
  },
  {
    email: "admin@test.com",
    firstName: "Robert",
    lastName: "Wilson",
    role: "PlatformAdmin" as const,
  },
]

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const tenantId = body.tenantId || null

    let tenant = null
    if (tenantId) {
      tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    } else {
      tenant = await prisma.tenant.findFirst()
    }

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12)
    const createdUsers = []
    const skippedUsers = []

    for (const testUser of TEST_USERS) {
      const existing = await prisma.user.findUnique({
        where: { email: testUser.email },
      })

      if (existing) {
        skippedUsers.push({ email: testUser.email, role: testUser.role, reason: "already exists" })
        continue
      }

      const user = await prisma.user.create({
        data: {
          email: testUser.email,
          passwordHash,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          status: "ACTIVE",
        },
      })

      const needsTenant = ["ClubOwner", "ClubManager", "Staff", "TeamManager", "Scorekeeper"].includes(testUser.role)

      await prisma.userRole.create({
        data: {
          userId: user.id,
          role: testUser.role,
          tenantId: needsTenant && tenant ? tenant.id : null,
        },
      })

      createdUsers.push({
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: testUser.role,
        tenantScoped: needsTenant && tenant ? tenant.name : null,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdUsers.length} test users, skipped ${skippedUsers.length}`,
      note: `All test users have password: ${TEST_PASSWORD}`,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
      created: createdUsers,
      skipped: skippedUsers,
    })
  } catch (error) {
    console.error("Error creating test users:", error)
    return NextResponse.json(
      { error: "Failed to create test users", details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const testEmails = TEST_USERS.map((u) => u.email)
    const testUsers = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      include: {
        roles: {
          include: { tenant: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      count: testUsers.length,
      users: testUsers.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        roles: u.roles.map((r: any) => ({
          role: r.role,
          tenant: r.tenant?.name || null,
        })),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to list test users", details: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const testEmails = TEST_USERS.map((u) => u.email)
    const result = await prisma.user.deleteMany({
      where: { email: { in: testEmails } },
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} test users`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete test users", details: String(error) },
      { status: 500 }
    )
  }
}
