import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const updateTeamSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  ageGroup: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).nullable().optional(),
  season: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

/**
 * Get single team
 * GET /api/teams/[id]
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

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            players: true,
            homeGames: true,
            awayGames: true,
          },
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Verify user has access to this tenant
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        tenantId: team.tenantId,
      },
    })

    if (!userRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error("Get team error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Update team
 * PATCH /api/teams/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Verify ClubOwner or ClubManager
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        tenantId: team.tenantId,
        role: { in: ["ClubOwner", "ClubManager"] },
      },
    })

    if (!userRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateTeamSchema.parse(body)

    const updated = await prisma.team.update({
      where: { id: params.id },
      data: validatedData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update team error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
