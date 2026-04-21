import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const updateTeamSubmissionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "WITHDRAWN"]).optional(),
  paymentStatus: z.enum(["UNPAID", "PAID_MANUAL", "PAID_STRIPE", "WAIVED"]).optional(),
}).refine((d) => d.status !== undefined || d.paymentStatus !== undefined, {
  message: "Provide status or paymentStatus",
})

/**
 * PATCH /api/leagues/[id]/teams/[teamId]
 * League owner/manager approves, rejects, or withdraws a submitted team, and/or updates its payment status.
 * (Phase 0: [id] is a Season.id.)
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
    const data = updateTeamSubmissionSchema.parse(body)

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        leagueId: true,
        league: { select: { ownerId: true, name: true } },
      },
    })
    if (!season) {
      return NextResponse.json({ error: "League not found" }, { status: 404 })
    }

    const hasLeagueManagerAccess = await prisma.userRole.findFirst({
      where: {
        userId: sessionInfo.userId,
        OR: [
          { leagueId: season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })

    const isOwner = season.league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin && !hasLeagueManagerAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const submission = await prisma.teamSubmission.findFirst({
      where: { id: params.teamId, seasonId: params.id },
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

    if (!submission) {
      return NextResponse.json({ error: "Team submission not found" }, { status: 404 })
    }

    const updateData: Record<string, any> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus

    const updated = await prisma.teamSubmission.update({
      where: { id: submission.id },
      data: updateData,
    })

    if (data.status !== undefined) {
      const clubManagers = await prisma.userRole.findMany({
        where: {
          tenantId: submission.team.tenantId,
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
            ? `${submission.team.name} was approved for ${season.league.name}.`
            : data.status === "REJECTED"
              ? `${submission.team.name} was not approved for ${season.league.name}.`
              : `${submission.team.name} registration status was updated for ${season.league.name}.`

        await prisma.notification.createMany({
          data: clubManagers.map((manager: any) => ({
            userId: manager.userId,
            type: "league_registration_status",
            title,
            message,
            link: `/leagues/${params.id}/manage`,
            referenceId: submission.id,
            referenceType: "TeamSubmission",
          })),
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update team submission error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
