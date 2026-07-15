import { prisma } from "@youthbasketballhub/db"
import { canSubmitTeams, SUBMIT_CLOSED_MESSAGE } from "@/lib/seasons/season-lock"
import { resolveRosterSelection } from "@/lib/seasons/roster-selection"
import { notifyMany } from "@/lib/notifications"

/**
 * The one true "put this team into this season" implementation (2026-07-15):
 * shared by the operator's direct submit (POST /api/seasons/[id]/submit) and
 * the club-approval path (approving a coach's TeamSubmissionRequest), so the
 * two can never diverge on validation, roster snapshotting or notifications.
 */

export type SubmitTeamResult =
  | {
      ok: true
      submissionId: string
      rosterId: string
      playerCount: number
      teamName: string
    }
  | { ok: false; status: number; error: string; code?: string; conflicts?: unknown }

export async function submitTeamToSeason(input: {
  seasonId: string
  teamId: string
  divisionId: string
  playerIds?: string[]
}): Promise<SubmitTeamResult> {
  const season = (await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: {
      id: true,
      status: true,
      registrationDeadline: true,
      teamFee: true,
      label: true,
      league: { select: { id: true, name: true, ownerId: true } },
    } as any,
  })) as any
  if (!season) return { ok: false, status: 404, error: "League not found" }

  if (!canSubmitTeams(season.status)) {
    return { ok: false, status: 400, error: SUBMIT_CLOSED_MESSAGE, code: "SEASON_NOT_OPEN" }
  }
  if (season.registrationDeadline && new Date(season.registrationDeadline) < new Date()) {
    return { ok: false, status: 400, error: "Registration deadline has passed" }
  }

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } },
  })
  if (!team) return { ok: false, status: 404, error: "Team not found" }

  const division = await prisma.division.findFirst({
    where: { id: input.divisionId, seasonId: input.seasonId },
    include: {
      _count: {
        select: { teamSubmissions: { where: { status: { in: ["PENDING", "APPROVED"] } } } },
      },
    },
  })
  if (!division) return { ok: false, status: 404, error: "Division not found" }
  if (division.maxTeams !== null && division.maxTeams !== undefined) {
    const activeTeams = division._count?.teamSubmissions ?? 0
    if (activeTeams >= division.maxTeams) {
      return { ok: false, status: 409, error: `Division capacity reached (${division.maxTeams} teams).` }
    }
  }

  const existing = await prisma.teamSubmission.findUnique({
    where: { seasonId_teamId: { seasonId: input.seasonId, teamId: input.teamId } },
  })
  if (existing) {
    return { ok: false, status: 409, error: "This team is already submitted to this league" }
  }

  const selection = await resolveRosterSelection({
    seasonId: input.seasonId,
    teamId: input.teamId,
    playerIds: input.playerIds,
  })
  if (!selection.ok) {
    return { ok: false, status: selection.status, error: selection.error, conflicts: selection.conflicts }
  }
  const teamPlayers = selection.players

  const result = await prisma.$transaction(async (tx: any) => {
    const submission = await tx.teamSubmission.create({
      data: {
        seasonId: input.seasonId,
        teamId: input.teamId,
        divisionId: input.divisionId,
        status: "PENDING",
        registrationFee: season.teamFee ? Number(season.teamFee) : null,
      },
    })
    const roster = await tx.seasonRoster.create({
      data: {
        seasonId: input.seasonId,
        teamSubmissionId: submission.id,
        isLocked: false,
        submittedAt: new Date(),
      },
    })
    if (teamPlayers.length > 0) {
      await tx.seasonRosterPlayer.createMany({
        data: teamPlayers.map((tp) => ({
          rosterId: roster.id,
          playerId: tp.playerId,
          jerseyNumber: tp.jerseyNumber,
          position: tp.position,
        })),
      })
    }
    return { submissionId: submission.id, rosterId: roster.id }
  })

  // Bell the league's operators (best-effort)
  try {
    const leagueId: string | undefined = season.league?.id
    if (leagueId) {
      const leagueRoles = await prisma.userRole.findMany({
        where: { leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
        select: { userId: true },
      })
      const recipientIds = Array.from(
        new Set(
          [season.league?.ownerId, ...leagueRoles.map((r) => r.userId)].filter(
            (id): id is string => !!id
          )
        )
      )
      await notifyMany(prisma, recipientIds, {
        type: "team_submitted",
        title: "New Team Registration",
        message: `${team.tenant?.name ?? "A club"} registered ${team.name} for ${season.label ?? "the season"}`,
        link: `/manage/leagues/${leagueId}/seasons/${input.seasonId}/manage`,
        referenceId: result.submissionId,
        referenceType: "TeamSubmission",
      })
    }
  } catch (notifyErr) {
    console.error("Team-submitted bell failed:", notifyErr)
  }

  return {
    ok: true,
    submissionId: result.submissionId,
    rosterId: result.rosterId,
    playerCount: teamPlayers.length,
    teamName: team.name,
  }
}
