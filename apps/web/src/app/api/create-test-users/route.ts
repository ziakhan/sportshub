import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import bcrypt from "bcryptjs"

/**
 * Create test users with different roles for development/testing
 * DELETE THIS IN PRODUCTION
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    let { clubId } = body

    // If no clubId provided, find the first club owned by the current user
    if (!clubId) {
      const currentDbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: true,
        },
      })

      if (!currentDbUser) {
        return NextResponse.json(
          { error: "Current user not found in database" },
          { status: 404 }
        )
      }

      // Find a club where this user is a ClubOwner
      const ownerRole = currentDbUser.roles.find(
        (r) => r.role === "ClubOwner" && r.tenantId
      )

      if (ownerRole && ownerRole.tenantId) {
        clubId = ownerRole.tenantId
      } else {
        return NextResponse.json(
          {
            error:
              "No club found. Please create a club first or provide a club ID.",
          },
          { status: 400 }
        )
      }
    }

    // Verify the club exists
    const club = await prisma.tenant.findUnique({
      where: { id: clubId },
    })

    if (!club) {
      return NextResponse.json(
        { error: "Club not found with ID: " + clubId },
        { status: 404 }
      )
    }

    // Define test users to create
    const testUsersData = [
      {
        email: "owner@test.com",
        firstName: "Test",
        lastName: "Owner",
        role: "ClubOwner",
        tenantId: clubId,
      },
      {
        email: "manager@test.com",
        firstName: "Test",
        lastName: "Manager",
        role: "ClubManager",
        tenantId: clubId,
      },
      {
        email: "staff.boys@test.com",
        firstName: "Staff",
        lastName: "BoysU14",
        role: "Staff",
        tenantId: clubId,
      },
      {
        email: "staff.girls@test.com",
        firstName: "Staff",
        lastName: "GirlsU16",
        role: "Staff",
        tenantId: clubId,
      },
      {
        email: "parent@test.com",
        firstName: "Test",
        lastName: "Parent",
        role: "Parent",
        tenantId: null, // Parents are not scoped to a specific club
      },
      {
        email: "referee@test.com",
        firstName: "Test",
        lastName: "Referee",
        role: "Referee",
        tenantId: null, // Referees can work across clubs
      },
      {
        email: "scorekeeper@test.com",
        firstName: "Test",
        lastName: "Scorekeeper",
        role: "Scorekeeper",
        tenantId: clubId,
      },
      {
        email: "player@test.com",
        firstName: "Test",
        lastName: "Player",
        role: "Player",
        tenantId: null, // Players belong to teams, not directly to clubs
      },
    ]

    const createdUsers = []

    for (const userData of testUsersData) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      })

      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping`)
        continue
      }

      // Create user
      const passwordHash = await bcrypt.hash("testpassword123", 12)
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          firstName: userData.firstName,
          lastName: userData.lastName,
          status: "ACTIVE",
        },
      })

      // Assign role
      await prisma.userRole.create({
        data: {
          userId: user.id,
          role: userData.role as any,
          tenantId: userData.tenantId,
        },
      })

      createdUsers.push({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: userData.role,
      })

      console.log(`Created test user: ${user.email} with role ${userData.role}`)
    }

    if (createdUsers.length === 0) {
      return NextResponse.json({
        message: "All test users already exist",
        users: [],
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdUsers.length} test user(s) for club: ${club.name}`,
      clubId: clubId,
      clubName: club.name,
      users: createdUsers,
    })
  } catch (error) {
    console.error("Error creating test users:", error)
    return NextResponse.json(
      { error: "Failed to create test users", details: String(error) },
      { status: 500 }
    )
  }
}
