import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifySafe } from "@/lib/notifications"
import { canManageTeamRoster } from "@/lib/teams/roster-access"

export const dynamic = "force-dynamic"

/**
 * Club-side roster FINALIZE (owner ruling 2026-08-11, QA T-017).
 *
 * Finalizing is the club or team staff declaring "this roster is final" — a
 * DIFFERENT act from submitting (the existing league submit flow is
 * untouched) and from the league's lock. It is what the roster-deadline
 * reminders chase and what the planning draw checks: a team not finalized by
 * the deadline is planned around.
 *
 * The player-count rules are the owner's, verbatim: under 5 the button is
 * blocked (below the legal minimum), 5-7 needs an explicit confirm (a thin
 * bench is a forfeit risk), 8 or more goes straight through.
 */

const finalizeSchema = z.object({
  // The client sends true after the "Are you sure?" dialog for a 5-7 player
  // roster. Enforced server-side too, so an API-only caller meets the same
  // question.
  confirmShort: z.boolean().optional().default(false),
})

const MIN_PLAYERS = 5
const COMFORTABLE_PLAYERS = 8

async function loadSubmission(seasonId: string, submissionId: string) {
  return (await prisma.teamSubmission.findFirst({
    where: { id: submissionId, seasonId },
    select: {
      id: true,
      teamId: true,
      status: true,
      team: { select: { id: true, name: true, tenantId: true } },
      season: {
        select: {
          id: true,
          label: true,
          status: true,
          league: { select: { id: true, name: true, ownerId: true } },
        },
      },
      roster: {
        select: {
          id: true,
          isLocked: true,
          finalizedAt: true,
          _count: { select: { players: true } },
        },
      },
    },
  })) as any
}

/** POST — finalize the roster. */
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
    // Team staff OR club leadership — the same circle that manages the roster.
    const allowed = await canManageTeamRoster(auth.userId, auth.isPlatformAdmin, {
      id: submission.team.id,
      tenantId: submission.team.tenantId,
    })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (submission.status === "WITHDRAWN" || submission.status === "REJECTED") {
      return NextResponse.json(
        { error: "This team is not active in the season, so there is nothing to finalize." },
        { status: 400 }
      )
    }
    if (submission.roster.isLocked) {
      return NextResponse.json(
        { error: "The league has locked this roster, so it is already final." },
        { status: 409 }
      )
    }
    if (submission.roster.finalizedAt) {
      return NextResponse.json({ error: "This roster is already finalized." }, { status: 409 })
    }

    const parsed = finalizeSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const playerCount = submission.roster._count?.players ?? 0
    if (playerCount < MIN_PLAYERS) {
      return NextResponse.json(
        {
          error: `A roster needs at least ${MIN_PLAYERS} players to finalize — ${submission.team.name} has ${playerCount}. Add players first.`,
          code: "BELOW_MINIMUM",
          playerCount,
        },
        { status: 400 }
      )
    }
    if (playerCount < COMFORTABLE_PLAYERS && !parsed.data.confirmShort) {
      return NextResponse.json(
        {
          error: `${playerCount} players meets the legal minimum, but one sick or injured player away from ${MIN_PLAYERS} means forfeits. Confirm to finalize anyway.`,
          code: "CONFIRM_SHORT",
          playerCount,
        },
        { status: 409 }
      )
    }

    const finalizedAt = new Date()
    await (prisma as any).seasonRoster.update({
      where: { id: submission.roster.id },
      data: { finalizedAt, finalizedById: auth.userId },
    })

    // One quiet bell to the league operator: compliance rolling in is the
    // other half of the digest ("N teams still un-rostered").
    await notifySafe({
      userId: submission.season.league.ownerId,
      type: "roster_updated",
      title: "Roster finalized",
      message: `${submission.team.name} finalized their ${submission.season.label} roster (${playerCount} players).`,
      link: `/manage/leagues/${submission.season.league.id}/seasons/${submission.season.id}/manage`,
      referenceId: submission.roster.id,
      referenceType: "SeasonRoster",
    })

    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "ClubOwner",
      action: "ROSTER_FINALIZED",
      resource: "SeasonRoster",
      resourceId: submission.roster.id,
      tenantId: submission.team.tenantId,
      changes: {
        teamName: submission.team.name,
        seasonLabel: submission.season.label,
        playerCount,
        confirmShort: parsed.data.confirmShort,
      },
      request,
    })

    return NextResponse.json({
      success: true,
      finalizedAt: finalizedAt.toISOString(),
      playerCount,
    })
  } catch (error) {
    console.error("Roster finalize error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — undo the finalize while the league has not locked the roster.
 *  The undo half of the affordance: finalizing is a declaration, and a club
 *  that declared too early can take it back until the league locks. */
export async function DELETE(
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
    const allowed = await canManageTeamRoster(auth.userId, auth.isPlatformAdmin, {
      id: submission.team.id,
      tenantId: submission.team.tenantId,
    })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (!submission.roster.finalizedAt) {
      return NextResponse.json({ error: "This roster is not finalized." }, { status: 409 })
    }
    if (submission.roster.isLocked) {
      return NextResponse.json(
        { error: "The league has locked this roster — ask the league for changes instead." },
        { status: 409 }
      )
    }

    await (prisma as any).seasonRoster.update({
      where: { id: submission.roster.id },
      data: { finalizedAt: null, finalizedById: null },
    })

    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "ClubOwner",
      action: "ROSTER_UNFINALIZED",
      resource: "SeasonRoster",
      resourceId: submission.roster.id,
      tenantId: submission.team.tenantId,
      changes: { teamName: submission.team.name, seasonLabel: submission.season.label },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Roster unfinalize error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
