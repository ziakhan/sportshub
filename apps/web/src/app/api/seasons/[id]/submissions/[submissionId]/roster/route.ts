import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notify } from "@/lib/notifications"
import { evaluateRosterEdit } from "@/lib/seasons/roster-policy"
import { resolveRosterSelection } from "@/lib/seasons/roster-selection"
import { isSeasonLocked } from "@/lib/seasons/season-lock"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  playerIds: z.array(z.string()).min(1, "Select at least one player"),
})

async function loadSubmission(seasonId: string, submissionId: string) {
  return prisma.teamSubmission.findFirst({
    where: { id: submissionId, seasonId },
    select: {
      id: true,
      teamId: true,
      team: { select: { name: true, tenantId: true } },
      season: {
        select: {
          id: true,
          label: true,
          status: true,
          rosterChangePolicy: true,
          rosterChangeDeadline: true,
          league: { select: { id: true, name: true, ownerId: true } },
        },
      },
      roster: { select: { id: true, isLocked: true } },
    },
  }) as any
}

async function requireClubAccess(userId: string, isPlatformAdmin: boolean, tenantId: string) {
  if (isPlatformAdmin) return true
  const role = await prisma.userRole.findFirst({
    where: { userId, tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
    select: { id: true },
  })
  return !!role
}

async function isLeagueSide(userId: string, leagueId: string, leagueOwnerId: string) {
  if (userId === leagueOwnerId) return true
  const role = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["LeagueOwner", "LeagueManager"] }, leagueId },
    select: { id: true },
  })
  return !!role
}

/**
 * PATCH /api/seasons/[id]/submissions/[submissionId]/roster { playerIds }
 * Replace the league roster version. Allowed while the roster is unlocked,
 * or under OPEN_UNTIL_DEADLINE before the deadline. An edit made after the
 * season locked (i.e. via an approved change request) re-locks the roster —
 * approval opens a one-shot change window.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; submissionId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const submission = await loadSubmission(params.id, params.submissionId)
    if (!submission?.roster) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    // Commissioner override: the league side may correct any roster at any
    // time — no policy gate, no unlock dance, but ALWAYS an audit trail and
    // a heads-up to the club.
    const leagueOverride = await isLeagueSide(
      auth.userId,
      submission.season.league.id,
      submission.season.league.ownerId
    )
    const clubAccess =
      !leagueOverride &&
      (await requireClubAccess(auth.userId, auth.isPlatformAdmin, submission.team.tenantId))
    if (!leagueOverride && !clubAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!leagueOverride) {
      const editability = evaluateRosterEdit({
        isLocked: submission.roster.isLocked,
        policy: submission.season.rosterChangePolicy,
        deadline: submission.season.rosterChangeDeadline,
      })
      if (!editability.canEdit) {
        return NextResponse.json(
          { error: editability.reason, code: "ROSTER_LOCKED", canRequest: editability.canRequest },
          { status: 409 }
        )
      }
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const selection = await resolveRosterSelection({
      seasonId: params.id,
      teamId: submission.teamId,
      playerIds: parsed.data.playerIds,
    })
    if (!selection.ok) {
      return NextResponse.json(
        { error: selection.error, conflicts: selection.conflicts },
        { status: selection.status }
      )
    }

    // Editing while the season itself is locked = the one-shot window a
    // commissioner opened by approving a request → re-lock on save. League
    // overrides never touch the lock.
    const seasonLocked = isSeasonLocked(submission.season.status)
    const relock = !leagueOverride && seasonLocked && !submission.roster.isLocked

    await prisma.$transaction(async (tx: any) => {
      await tx.seasonRosterPlayer.deleteMany({ where: { rosterId: submission.roster.id } })
      await tx.seasonRosterPlayer.createMany({
        data: selection.players.map((p) => ({
          rosterId: submission.roster.id,
          playerId: p.playerId,
          jerseyNumber: p.jerseyNumber,
          position: p.position,
        })),
      })
      await tx.seasonRoster.update({
        where: { id: submission.roster.id },
        data: relock ? { isLocked: true, lockedAt: new Date() } : {},
      })
      if (leagueOverride) {
        // Tell the club their league roster was touched by the league
        const clubOwner = await tx.userRole.findFirst({
          where: { tenantId: submission.team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          select: { userId: true },
        })
        if (clubOwner) {
          await notify(tx, {
            userId: clubOwner.userId,
            type: "roster_updated",
            title: "League edited your roster",
            message: `${submission.season.league.name} updated ${submission.team.name}'s ${submission.season.label} roster (${selection.players.length} players).`,
            link: `/clubs/${submission.team.tenantId}/teams/${submission.teamId}/league-rosters`,
            referenceId: submission.roster.id,
            referenceType: "SeasonRoster",
          })
        }
      } else if (seasonLocked) {
        await notify(tx, {
          userId: submission.season.league.ownerId,
          type: "roster_updated",
          title: "League roster updated",
          message: `${submission.team.name} updated their ${submission.season.label} roster (${selection.players.length} players).`,
          link: `/manage/leagues/${submission.season.league.id}/seasons/${submission.season.id}/manage`,
          referenceId: submission.roster.id,
          referenceType: "SeasonRoster",
        })
      }
    })

    await auditSafe({
      actorId: auth.realUserId,
      actorRole: leagueOverride ? "LeagueOwner" : auth.isPlatformAdmin ? "PlatformAdmin" : "ClubOwner",
      action: leagueOverride ? "LEAGUE_ROSTER_EDIT" : "ROSTER_VERSION_EDIT",
      resource: "SeasonRoster",
      resourceId: submission.roster.id,
      tenantId: submission.team.tenantId,
      changes: {
        teamName: submission.team.name,
        seasonLabel: submission.season.label,
        playerCount: selection.players.length,
        playerIds: selection.players.map((p) => p.playerId),
      },
      request,
    })

    return NextResponse.json({
      success: true,
      playerCount: selection.players.length,
      relocked: relock,
      leagueOverride,
    })
  } catch (error) {
    console.error("Roster update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const requestSchema = z
  .object({
    message: z.string().trim().max(2000).optional().default(""),
    // Structured changes (2026-07-15): saved on the request, applied by the
    // league's approval — the roster itself doesn't move until then.
    additions: z.array(z.string()).max(30).optional().default([]),
    removals: z.array(z.string()).max(30).optional().default([]),
  })
  .refine((d) => d.additions.length + d.removals.length > 0 || d.message.trim().length >= 5, {
    message: "Pick players to add/remove (or describe the change)",
  })

/**
 * POST /api/seasons/[id]/submissions/[submissionId]/roster — ask the league
 * to reopen a locked roster (policy permitting). One pending ask at a time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; submissionId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const submission = await loadSubmission(params.id, params.submissionId)
    if (!submission?.roster) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }
    if (!(await requireClubAccess(auth.userId, auth.isPlatformAdmin, submission.team.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const editability = evaluateRosterEdit({
      isLocked: submission.roster.isLocked,
      policy: submission.season.rosterChangePolicy,
      deadline: submission.season.rosterChangeDeadline,
    })
    if (editability.canEdit) {
      return NextResponse.json(
        { error: "This roster is editable right now — no request needed." },
        { status: 400 }
      )
    }
    if (!editability.canRequest) {
      return NextResponse.json({ error: editability.reason, code: "POLICY_CLOSED" }, { status: 409 })
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const pending = await prisma.rosterChangeRequest.findFirst({
      where: { rosterId: submission.roster.id, status: "PENDING" },
      select: { id: true },
    })
    if (pending) {
      return NextResponse.json(
        { error: "A change request is already waiting for the league." },
        { status: 409 }
      )
    }

    const additions = [...new Set(parsed.data.additions)]
    const removals = [...new Set(parsed.data.removals)]
    if (additions.length > 0 || removals.length > 0) {
      const [clubActive, onRoster] = await Promise.all([
        prisma.teamPlayer.findMany({
          where: { teamId: submission.team.id, status: "ACTIVE" },
          select: { playerId: true },
        }),
        prisma.seasonRosterPlayer.findMany({
          where: { rosterId: submission.roster.id },
          select: { playerId: true },
        }),
      ])
      const clubIds = new Set(clubActive.map((p: any) => p.playerId))
      const rosterIds = new Set(onRoster.map((p: any) => p.playerId))
      const badAdd = additions.find((id) => !clubIds.has(id) || rosterIds.has(id))
      if (badAdd) {
        return NextResponse.json(
          { error: "Additions must be active club players not already on this league roster" },
          { status: 400 }
        )
      }
      const badRemove = removals.find((id) => !rosterIds.has(id))
      if (badRemove) {
        return NextResponse.json(
          { error: "Removals must be players currently on this league roster" },
          { status: 400 }
        )
      }
    }

    const created = await prisma.$transaction(async (tx: any) => {
      const req = await tx.rosterChangeRequest.create({
        data: {
          rosterId: submission.roster.id,
          requestedById: auth.userId,
          message: parsed.data.message,
          additions: additions.length ? additions : undefined,
          removals: removals.length ? removals : undefined,
        },
        select: { id: true },
      })
      await notify(tx, {
        userId: submission.season.league.ownerId,
        type: "roster_change_requested",
        title: "Roster change requested",
        message:
          additions.length + removals.length > 0
            ? `${submission.team.name} is asking to change their ${submission.season.label} roster: +${additions.length} / -${removals.length} players${parsed.data.message ? ` — "${parsed.data.message.slice(0, 100)}"` : ""}`
            : `${submission.team.name} is asking to change their ${submission.season.label} roster: "${parsed.data.message.slice(0, 120)}"`,
        link: `/manage/leagues/${submission.season.league.id}/seasons/${submission.season.id}/manage`,
        referenceId: req.id,
        referenceType: "RosterChangeRequest",
      })
      return req
    })

    return NextResponse.json({ success: true, requestId: created.id }, { status: 201 })
  } catch (error) {
    console.error("Roster change request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
