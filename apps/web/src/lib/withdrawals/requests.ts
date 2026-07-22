import { prisma } from "@youthbasketballhub/db"
import { notifyMany } from "@/lib/notifications"
import { cancelObligationIfUnpaid } from "@/lib/payments/obligations"

/**
 * Withdrawal requests (owner 2026-07-18): installment commitments make
 * unilateral exits wrong, so SELF-withdrawal always needs the other party's
 * sign-off. Clubs request out of a league season → league approves. Parents
 * request a child's release from a roster → club approves. The league/club
 * acting on its own side (league withdrawing a team, club releasing a
 * player) keeps its existing direct routes — this covers the requester who
 * is walking away from a commitment.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string; code: string; status: number }

export async function createWithdrawalRequest(input: {
  userId: string
  type: "CLUB_FROM_LEAGUE" | "PLAYER_FROM_TEAM"
  reason: string
  submissionId?: string
  playerId?: string
  teamId?: string
}): Promise<Result<{ requestId: string }>> {
  if (input.type === "CLUB_FROM_LEAGUE") {
    if (!input.submissionId) {
      return { ok: false, error: "submissionId is required", code: "BAD_INPUT", status: 400 }
    }
    const submission = await (prisma as any).teamSubmission.findUnique({
      where: { id: input.submissionId },
      select: {
        id: true,
        status: true,
        team: { select: { id: true, name: true, tenantId: true } },
        season: {
          select: {
            id: true,
            label: true,
            leagueId: true,
            league: { select: { name: true, ownerId: true } },
          },
        },
      },
    })
    if (!submission) {
      return { ok: false, error: "Submission not found", code: "NOT_FOUND", status: 404 }
    }
    const clubRole = await prisma.userRole.findFirst({
      where: {
        userId: input.userId,
        tenantId: submission.team.tenantId,
        role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
      },
      select: { id: true },
    })
    if (!clubRole) return { ok: false, error: "Forbidden", code: "FORBIDDEN", status: 403 }
    if (submission.status !== "APPROVED") {
      return {
        ok: false,
        error: "Only approved teams need a withdrawal request — pending submissions can be withdrawn directly",
        code: "NOT_APPROVED",
        status: 409,
      }
    }
    const dup = await (prisma as any).withdrawalRequest.findFirst({
      where: { submissionId: submission.id, status: "PENDING" },
      select: { id: true },
    })
    if (dup) {
      return { ok: false, error: "A withdrawal request is already pending", code: "DUPLICATE", status: 409 }
    }

    const created = await (prisma as any).withdrawalRequest.create({
      data: {
        type: "CLUB_FROM_LEAGUE",
        reason: input.reason,
        requestedById: input.userId,
        submissionId: submission.id,
      },
    })
    // The league decides — owner + league managers
    const managers = await prisma.userRole.findMany({
      where: {
        leagueId: submission.season.leagueId,
        role: { in: ["LeagueOwner", "LeagueManager"] },
      },
      select: { userId: true },
      distinct: ["userId"],
    })
    const deciders = [
      ...new Set([submission.season.league.ownerId, ...managers.map((m: any) => m.userId)]),
    ].filter(Boolean) as string[]
    await notifyMany(prisma, deciders, {
      type: "withdrawal_request",
      title: "Withdrawal Request",
      message: `${submission.team.name} has asked to withdraw from ${submission.season.league.name} ${submission.season.label}. Reason: ${input.reason}`,
      link: `/manage/leagues/${submission.season.leagueId}/seasons/${submission.season.id}/manage`,
      referenceId: created.id,
      referenceType: "WithdrawalRequest",
    })
    return { ok: true, requestId: created.id }
  }

  // PLAYER_FROM_TEAM
  if (!input.playerId || !input.teamId) {
    return { ok: false, error: "playerId and teamId are required", code: "BAD_INPUT", status: 400 }
  }
  const teamPlayer = await (prisma as any).teamPlayer.findUnique({
    where: { teamId_playerId: { teamId: input.teamId, playerId: input.playerId } },
    select: {
      id: true,
      status: true,
      player: { select: { firstName: true, lastName: true, parentId: true } },
      team: { select: { id: true, name: true, tenantId: true } },
    },
  })
  if (!teamPlayer || teamPlayer.status !== "ACTIVE") {
    return { ok: false, error: "Player is not on this team's active roster", code: "NOT_FOUND", status: 404 }
  }
  if (teamPlayer.player.parentId !== input.userId) {
    return { ok: false, error: "Forbidden", code: "FORBIDDEN", status: 403 }
  }
  const dup = await (prisma as any).withdrawalRequest.findFirst({
    where: { teamPlayerId: teamPlayer.id, status: "PENDING" },
    select: { id: true },
  })
  if (dup) {
    return { ok: false, error: "A release request is already pending", code: "DUPLICATE", status: 409 }
  }

  const created = await (prisma as any).withdrawalRequest.create({
    data: {
      type: "PLAYER_FROM_TEAM",
      reason: input.reason,
      requestedById: input.userId,
      teamPlayerId: teamPlayer.id,
    },
  })
  const clubManagers = await prisma.userRole.findMany({
    where: {
      tenantId: teamPlayer.team.tenantId,
      role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
    },
    select: { userId: true },
    distinct: ["userId"],
  })
  await notifyMany(
    prisma,
    clubManagers.map((m: any) => m.userId),
    {
      type: "withdrawal_request",
      title: "Release Request",
      message: `${teamPlayer.player.firstName} ${teamPlayer.player.lastName}'s family has asked to leave ${teamPlayer.team.name}. Reason: ${input.reason}`,
      link: `/clubs/${teamPlayer.team.tenantId}/teams/${teamPlayer.team.id}/roster`,
      referenceId: created.id,
      referenceType: "WithdrawalRequest",
    }
  )
  return { ok: true, requestId: created.id }
}

/** Can this user approve/decline this request? (The OTHER party.) */
async function canDecide(userId: string, isPlatformAdmin: boolean, req: any): Promise<boolean> {
  if (isPlatformAdmin) return true
  if (req.type === "CLUB_FROM_LEAGUE") {
    if (req.submission?.season?.league?.ownerId === userId) return true
    const role = await prisma.userRole.findFirst({
      where: {
        userId,
        leagueId: req.submission?.season?.leagueId,
        role: { in: ["LeagueOwner", "LeagueManager"] },
      },
      select: { id: true },
    })
    return !!role
  }
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId: req.teamPlayer?.team?.tenantId,
      role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
    },
    select: { id: true },
  })
  return !!role
}

export async function decideWithdrawalRequest(input: {
  requestId: string
  userId: string
  isPlatformAdmin: boolean
  action: "approve" | "decline" | "cancel"
  note?: string
}): Promise<Result<{ status: string; cancelledGames?: number }>> {
  const req = await (prisma as any).withdrawalRequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      type: true,
      status: true,
      reason: true,
      requestedById: true,
      submission: {
        select: {
          id: true,
          status: true,
          team: { select: { id: true, name: true, tenantId: true } },
          season: {
            select: {
              id: true,
              label: true,
              leagueId: true,
              league: { select: { name: true, ownerId: true } },
            },
          },
        },
      },
      teamPlayer: {
        select: {
          id: true,
          status: true,
          player: { select: { id: true, firstName: true, lastName: true, parentId: true } },
          team: { select: { id: true, name: true, tenantId: true } },
        },
      },
    },
  })
  if (!req) return { ok: false, error: "Request not found", code: "NOT_FOUND", status: 404 }
  if (req.status !== "PENDING") {
    return {
      ok: false,
      error: `This request is already ${req.status.toLowerCase()}`,
      code: "ALREADY_DECIDED",
      status: 409,
    }
  }

  if (input.action === "cancel") {
    if (req.requestedById !== input.userId) {
      return { ok: false, error: "Only the requester can cancel", code: "FORBIDDEN", status: 403 }
    }
    await (prisma as any).withdrawalRequest.update({
      where: { id: req.id },
      data: { status: "CANCELLED", decidedAt: new Date() },
    })
    return { ok: true, status: "CANCELLED" }
  }

  if (!(await canDecide(input.userId, input.isPlatformAdmin, req))) {
    return { ok: false, error: "Forbidden", code: "FORBIDDEN", status: 403 }
  }

  const decision = {
    status: input.action === "approve" ? "APPROVED" : "DECLINED",
    decidedById: input.userId,
    decidedAt: new Date(),
    decisionNote: input.note ?? null,
  }

  if (input.action === "decline") {
    await (prisma as any).withdrawalRequest.update({ where: { id: req.id }, data: decision })
    await notifyMany(prisma, [req.requestedById], {
      type: "withdrawal_decision",
      title: "Withdrawal Request Declined",
      message:
        req.type === "CLUB_FROM_LEAGUE"
          ? `Your request to withdraw ${req.submission.team.name} from ${req.submission.season.league.name} was declined.${input.note ? ` Note: ${input.note}` : ""}`
          : `The release request for ${req.teamPlayer.player.firstName} ${req.teamPlayer.player.lastName} was declined by ${req.teamPlayer.team.name}.${input.note ? ` Note: ${input.note}` : ""}`,
      referenceId: req.id,
      referenceType: "WithdrawalRequest",
    })
    return { ok: true, status: "DECLINED" }
  }

  // APPROVE — execute the withdrawal
  if (req.type === "CLUB_FROM_LEAGUE") {
    const sub = req.submission
    let cancelledGames: { id: string; homeTeamId: string; awayTeamId: string }[] = []
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.withdrawalRequest.update({ where: { id: req.id }, data: decision })
      await tx.teamSubmission.update({ where: { id: sub.id }, data: { status: "WITHDRAWN" } })
      // Same cascade as the league's direct withdraw (seasons/[id]/teams/[teamId]):
      // unpaid fees die with the submission; future games cancel atomically.
      await cancelObligationIfUnpaid(tx, "TeamSubmission", sub.id)
      cancelledGames = await tx.game.findMany({
        where: {
          seasonId: sub.season.id,
          status: { in: ["SCHEDULED", "POSTPONED"] },
          scheduledAt: { gt: new Date() },
          OR: [{ homeTeamId: sub.team.id }, { awayTeamId: sub.team.id }],
        },
        select: { id: true, homeTeamId: true, awayTeamId: true },
      })
      if (cancelledGames.length > 0) {
        await tx.game.updateMany({
          where: { id: { in: cancelledGames.map((g) => g.id) } },
          data: { status: "CANCELLED" },
        })
      }
    })

    await notifyMany(prisma, [req.requestedById], {
      type: "withdrawal_decision",
      title: "Withdrawal Approved",
      message: `${sub.team.name} has been withdrawn from ${sub.season.league.name} ${sub.season.label}.`,
      referenceId: req.id,
      referenceType: "WithdrawalRequest",
    })
    if (cancelledGames.length > 0) {
      const opponentTeamIds = [
        ...new Set(
          cancelledGames.map((g) => (g.homeTeamId === sub.team.id ? g.awayTeamId : g.homeTeamId))
        ),
      ]
      const opponentTeams = await prisma.team.findMany({
        where: { id: { in: opponentTeamIds } },
        select: { tenantId: true },
      })
      const opponentManagers = await prisma.userRole.findMany({
        where: {
          tenantId: { in: [...new Set(opponentTeams.map((t) => t.tenantId))] },
          role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any },
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
          message: `${sub.team.name} has withdrawn from ${sub.season.league.name}. ${cancelledGames.length} upcoming game(s) against them have been cancelled.`,
          link: `/browse-leagues/${sub.season.id}`,
          referenceId: sub.id,
          referenceType: "TeamSubmission",
        }
      )
    }
    return { ok: true, status: "APPROVED", cancelledGames: cancelledGames.length }
  }

  // PLAYER_FROM_TEAM — release semantics match the club's direct release
  // (teams/[id]/players/[playerId]: INACTIVE + leftAt keeps history)
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.withdrawalRequest.update({ where: { id: req.id }, data: decision })
    await tx.teamPlayer.update({
      where: { id: req.teamPlayer.id },
      data: { status: "INACTIVE", leftAt: new Date() },
    })
  })
  await notifyMany(prisma, [req.requestedById], {
    type: "withdrawal_decision",
    title: "Release Approved",
    message: `${req.teamPlayer.player.firstName} ${req.teamPlayer.player.lastName} has been released from ${req.teamPlayer.team.name}.`,
    referenceId: req.id,
    referenceType: "WithdrawalRequest",
  })
  return { ok: true, status: "APPROVED" }
}

/** Requests visible to this user: ones they made + ones they can decide. */
export async function listWithdrawalRequests(userId: string, isPlatformAdmin: boolean) {
  const include = {
    submission: {
      select: {
        id: true,
        team: { select: { id: true, name: true, tenantId: true } },
        season: {
          select: {
            id: true,
            label: true,
            leagueId: true,
            league: { select: { name: true, ownerId: true } },
          },
        },
      },
    },
    teamPlayer: {
      select: {
        id: true,
        player: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true, tenantId: true } },
      },
    },
    requestedBy: { select: { firstName: true, lastName: true } },
  }

  const made = await (prisma as any).withdrawalRequest.findMany({
    where: { requestedById: userId },
    include,
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const roles = await prisma.userRole.findMany({
    where: { userId, role: { in: ["ClubOwner", "ClubManager", "LeagueOwner", "LeagueManager"] } },
    select: { role: true, tenantId: true, leagueId: true },
  })
  const tenantIds = [...new Set(roles.map((r) => r.tenantId).filter(Boolean))] as string[]
  const leagueIds = [...new Set(roles.map((r) => r.leagueId).filter(Boolean))] as string[]

  const toDecide = await (prisma as any).withdrawalRequest.findMany({
    where: {
      status: "PENDING",
      requestedById: { not: userId },
      OR: [
        ...(isPlatformAdmin ? [{}] : []),
        { submission: { season: { league: { ownerId: userId } } } },
        ...(leagueIds.length > 0 ? [{ submission: { season: { leagueId: { in: leagueIds } } } }] : []),
        ...(tenantIds.length > 0 ? [{ teamPlayer: { team: { tenantId: { in: tenantIds } } } }] : []),
      ],
    },
    include,
    orderBy: { createdAt: "asc" },
    take: 50,
  })

  return { made, toDecide }
}
