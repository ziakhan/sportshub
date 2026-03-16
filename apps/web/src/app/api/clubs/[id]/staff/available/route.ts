import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

/**
 * Get staff members available for team assignment
 * GET /api/clubs/[id]/staff/available
 *
 * Returns users who have Staff or TeamManager roles for this club,
 * along with their current team assignments.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify caller has access to this club
    const callerRole = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        tenantId: params.id,
        role: { in: ["ClubOwner", "ClubManager"] },
      },
    })

    if (!callerRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Find all users who have Staff or TeamManager roles for this tenant
    const staffRoles = await prisma.userRole.findMany({
      where: {
        tenantId: params.id,
        role: { in: ["Staff", "TeamManager"] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Group roles by user
    const staffMap = new Map<string, {
      userId: string
      firstName: string | null
      lastName: string | null
      email: string
      roles: Array<{
        role: string
        teamId: string | null
        teamName: string | null
        designation: string | null
      }>
    }>()

    for (const sr of staffRoles) {
      if (!staffMap.has(sr.userId)) {
        staffMap.set(sr.userId, {
          userId: sr.user.id,
          firstName: sr.user.firstName,
          lastName: sr.user.lastName,
          email: sr.user.email,
          roles: [],
        })
      }
      staffMap.get(sr.userId)!.roles.push({
        role: sr.role,
        teamId: sr.teamId,
        teamName: sr.team?.name || null,
        designation: sr.designation,
      })
    }

    return NextResponse.json({ staff: Array.from(staffMap.values()) })
  } catch (error) {
    console.error("Available staff error:", error)
    return NextResponse.json(
      { error: "Failed to fetch available staff" },
      { status: 500 }
    )
  }
}
