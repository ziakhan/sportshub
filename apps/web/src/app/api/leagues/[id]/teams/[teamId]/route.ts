import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const updateLeagueTeamStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "WITHDRAWN"]),
})

/**
 * PATCH /api/leagues/[id]/teams/[teamId]
 * League owner/manager approves, rejects, or withdraws a submitted team.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; teamId: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = updateLeagueTeamStatusSchema.parse(body)

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, name: true },
    })
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 })
    }

    const hasLeagueManagerAccess = await prisma.userRole.findFirst({
      where: {
        userId: sessionInfo.userId,
        OR: [
          { leagueId: params.id, role: { in: ["LeagueOwner", "LeagueManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })

    const isOwner = league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin && !hasLeagueManagerAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const leagueTeam = await prisma.leagueTeam.findFirst({
      where: { id: params.teamId, leagueId: params.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            tenant: { select: { name: true } },
          },
        },
      },
    })

    if (!leagueTeam) {
      return NextResponse.json({ error: "League team submission not found" }, { status: 404 })
    }

    const updated = await prisma.leagueTeam.update({
      where: { id: leagueTeam.id },
      data: { status: data.status },
    })

    const clubManagers = await prisma.userRole.findMany({
      where: {
        tenantId: leagueTeam.team.tenantId,
        role: { in: ["ClubOwner", "ClubManager"] },
      },
      select: { userId: true },
      distinct: ["userId"],
    })

    if (clubManagers.length > 0) {
      const title =
        data.status === "APPROVED"
          ? "League Registration Approved"
          : data.status === "REJECTED"
            ? "League Registration Rejected"
            : "League Registration Updated"

      const message =
        data.status === "APPROVED"
          ? `${leagueTeam.team.name} was approved for ${league.name}.`
          : data.status === "REJECTED"
            ? `${leagueTeam.team.name} was not approved for ${league.name}.`
            : `${leagueTeam.team.name} registration status was updated for ${league.name}.`

      await prisma.notification.createMany({
        data: clubManagers.map((manager: any) => ({
          userId: manager.userId,
          type: "league_registration_status",
          title,
          message,
          link: `/leagues/${params.id}/manage`,
          referenceId: leagueTeam.id,
          referenceType: "LeagueTeam",
        })),
      })
    }

    return NextResponse.json({ success: true, status: updated.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update league team status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
