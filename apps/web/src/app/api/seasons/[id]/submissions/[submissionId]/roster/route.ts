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

// League edits are REMOVE-ONLY with a reason per player (owner 2026-07-29):
// the league can take players off a roster (rulings, errors) but can never
// add — additions must come from the club via a change request.
const leagueRemovalSchema = z.object({
  removals: z
    .array(
      z.object({
        playerId: z.string(),
        reason: z.string().trim().min(3, "Each removal needs a reason the club will understand"),
      })
    )
    .min(1, "Nothing to remove"),
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

    const rawBody = await request.json().catch(() => null)

    // League side: only the removals shape is accepted — a playerIds set
    // that ADDS anyone is structurally impossible through this door.
    let removalDetails: Array<{ playerId: string; reason: string; name?: string }> = []
    let effectivePlayerIds: string[]
    if (leagueOverride) {
      const parsedRemovals = leagueRemovalSchema.safeParse(rawBody)
      if (!parsedRemovals.success) {
        return NextResponse.json(
          {
            error:
              parsedRemovals.error.errors[0]?.message ??
              "League edits are remove-only: send removals with reasons. Additions come from club change requests.",
          },
          { status: 400 }
        )
      }
      const currentRows = await (prisma as any).seasonRosterPlayer.findMany({
        where: { rosterId: submission.roster.id },
        select: { playerId: true },
      })
      const currentIds = new Set<string>(currentRows.map((r: any) => r.playerId))
      for (const r of parsedRemovals.data.removals) {
        if (!currentIds.has(r.playerId)) {
          return NextResponse.json(
            { error: "One of the removals is not on the current roster" },
            { status: 400 }
          )
        }
      }
      removalDetails = parsedRemovals.data.removals
      const removeSet = new Set(removalDetails.map((r) => r.playerId))
      effectivePlayerIds = [...currentIds].filter((id) => !removeSet.has(id))
      if (effectivePlayerIds.length === 0) {
        return NextResponse.json(
          { error: "A league edit cannot empty the roster — withdraw the team instead" },
          { status: 400 }
        )
      }
      const removedPlayers = await (prisma as any).player.findMany({
        where: { id: { in: removalDetails.map((r) => r.playerId) } },
        select: { id: true, firstName: true, lastName: true },
      })
      const nameById = new Map(
        removedPlayers.map((pl: any) => [pl.id, `${pl.firstName} ${pl.lastName}`])
      )
      removalDetails = removalDetails.map((r) => ({ ...r, name: (nameById.get(r.playerId) as string) ?? "Player" }))
    } else {
      const parsed = patchSchema.safeParse(rawBody)
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0]?.message ?? "Invalid input" },
          { status: 400 }
        )
      }
      effectivePlayerIds = parsed.data.playerIds
    }

    const selection = await resolveRosterSelection({
      seasonId: params.id,
      teamId: submission.teamId,
      playerIds: effectivePlayerIds,
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
        data: {
          ...(relock ? { isLocked: true, lockedAt: new Date() } : {}),
        },
      })
      if (leagueOverride) {
        // Tell the club their league roster was touched by the league
        const clubOwner = await tx.userRole.findFirst({
          where: { tenantId: submission.team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          select: { userId: true },
        })
        if (clubOwner) {
          // The reasons ARE the message (owner 2026-07-29): the club must
          // understand exactly who was removed and why.
          const reasonLines = removalDetails
            .map((r) => `${r.name} — ${r.reason}`)
            .join("; ")
          await notify(tx, {
            userId: clubOwner.userId,
            type: "roster_updated",
            title: `League removed ${removalDetails.length} player${removalDetails.length === 1 ? "" : "s"} from ${submission.team.name}`,
            message: `${submission.season.league.name} (${submission.season.label}): ${reasonLines}`,
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
        ...(removalDetails.length > 0
          ? { removals: removalDetails.map((r) => ({ playerId: r.playerId, name: r.name, reason: r.reason })) }
          : {}),
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
