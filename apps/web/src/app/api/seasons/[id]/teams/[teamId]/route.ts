import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notifyMany } from "@/lib/notifications"
import { isSeasonLocked } from "@/lib/seasons/season-lock"
import { cancelObligationIfUnpaid, ensureObligation } from "@/lib/payments/obligations"

export const dynamic = "force-dynamic"

const updateTeamSubmissionSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED", "WITHDRAWN"]).optional(),
    paymentStatus: z.enum(["UNPAID", "PAID_MANUAL", "PAID_STRIPE", "WAIVED"]).optional(),
  })
  .refine((d) => d.status !== undefined || d.paymentStatus !== undefined, {
    message: "Provide status or paymentStatus",
  })

/**
 * PATCH /api/seasons/[id]/teams/[teamId]
 * League owner/manager approves, rejects, or withdraws a submitted team, and/or updates its payment status.
 * A ClubOwner/ClubManager of the submitting club may also call this — but ONLY to set status WITHDRAWN
 * (self-withdrawal); any other status or payment change from the club side is rejected.
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
        status: true,
        teamFee: true,
        label: true,
        league: { select: { ownerId: true, name: true, currency: true } },
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
    const isLeagueSide = isOwner || sessionInfo.isPlatformAdmin || !!hasLeagueManagerAccess

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

    // Second authz path: the submitting club may withdraw its own team — and
    // do nothing else. League-side callers keep full rights (checked above).
    if (!isLeagueSide) {
      const hasClubManagerAccess = await prisma.userRole.findFirst({
        where: {
          userId: sessionInfo.userId,
          tenantId: submission.team.tenantId,
          role: { in: ["ClubOwner", "ClubManager"] },
        },
      })
      if (!hasClubManagerAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (data.status !== "WITHDRAWN" || data.paymentStatus !== undefined) {
        return NextResponse.json(
          { error: "Clubs can only withdraw their own team from a season" },
          { status: 403 }
        )
      }
    }

    // G4/H19 lock guard: once the season structure is locked, approving or
    // rejecting teams would desync the committed schedule. Withdrawing stays
    // allowed — teams do quit mid-season — and cascades below.
    if (
      isSeasonLocked(season.status) &&
      data.status !== undefined &&
      data.status !== "WITHDRAWN"
    ) {
      return NextResponse.json(
        {
          error: "Season is finalized — team submissions can only be withdrawn now.",
          code: "SEASON_LOCKED",
        },
        { status: 409 }
      )
    }

    const updateData: Record<string, any> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus

    // G4 cascade: withdrawing a team cancels its FUTURE games atomically with
    // the status flip. Played/past games stay for standings.
    const withdrawing = data.status === "WITHDRAWN" && submission.status !== "WITHDRAWN"
    const approving = data.status === "APPROVED" && submission.status !== "APPROVED"
    let cancelledGames: { id: string; homeTeamId: string; awayTeamId: string; scheduledAt: Date }[] = []

    const updated = await prisma.$transaction(async (tx: any) => {
      const row = await tx.teamSubmission.update({
        where: { id: submission.id },
        data: updateData,
      })
      // Approval is what creates the club→league team-fee debt (B1 in
      // docs/payments-design.md) — the league is the merchant here.
      if (approving && season.teamFee !== null) {
        await ensureObligation(tx, {
          payerTenantId: submission.team.tenantId,
          payeeLeagueId: season.leagueId,
          referenceType: "TeamSubmission",
          referenceId: submission.id,
          description: `Team fee — ${season.league.name} ${season.label} (${submission.team.name})`,
          amount: Number(season.teamFee),
          currency: season.league.currency,
        })
      }
      // A withdrawing team's unpaid fee dies with the submission; paid fees
      // stay for the league to refund explicitly.
      if (withdrawing) {
        await cancelObligationIfUnpaid(tx, "TeamSubmission", submission.id)
      }
      if (withdrawing) {
        cancelledGames = await tx.game.findMany({
          where: {
            seasonId: params.id,
            status: { in: ["SCHEDULED", "POSTPONED"] },
            scheduledAt: { gt: new Date() },
            OR: [{ homeTeamId: submission.team.id }, { awayTeamId: submission.team.id }],
          },
          select: { id: true, homeTeamId: true, awayTeamId: true, scheduledAt: true },
        })
        if (cancelledGames.length > 0) {
          await tx.game.updateMany({
            where: { id: { in: cancelledGames.map((g) => g.id) } },
            data: { status: "CANCELLED" },
          })
        }
      }
      return row
    })

    // Notify the opposing club of every cancelled game
    if (cancelledGames.length > 0) {
      const opponentTeamIds = Array.from(
        new Set(
          cancelledGames.map((g) =>
            g.homeTeamId === submission.team.id ? g.awayTeamId : g.homeTeamId
          )
        )
      )
      const opponentTeams = await prisma.team.findMany({
        where: { id: { in: opponentTeamIds } },
        select: { tenantId: true },
      })
      const opponentManagers = await prisma.userRole.findMany({
        where: {
          tenantId: { in: Array.from(new Set(opponentTeams.map((t) => t.tenantId))) },
          role: { in: ["ClubOwner", "ClubManager"] },
        },
        select: { userId: true },
        distinct: ["userId"],
      })
      await notifyMany(
        prisma,
        opponentManagers.map((m: any) => m.userId),
        {
          type: "game_cancelled",
          title: "Games Cancelled — Opponent Withdrew",
          message: `${submission.team.name} has withdrawn from ${season.league.name}. ${cancelledGames.length} upcoming game(s) against them have been cancelled.`,
          link: `/browse-leagues/${params.id}`,
          referenceId: submission.id,
          referenceType: "TeamSubmission",
        }
      )
    }

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

        await notifyMany(
          prisma,
          clubManagers.map((manager: any) => manager.userId),
          {
            type: "league_registration_status",
            title,
            message,
            link: `/browse-leagues/${params.id}`,
            referenceId: submission.id,
            referenceType: "TeamSubmission",
          }
        )
      }
    }

    return NextResponse.json({
      success: true,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      cancelledGames: cancelledGames.length,
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
