import { prisma } from "@youthbasketballhub/db"

/**
 * Roster-version selection for league submissions. A club's live roster can
 * carry 15 players while only 12 go into a given league — the selection is
 * validated against the ACTIVE club roster and checked for cross-club
 * eligibility conflicts (a player already on another club's submitted
 * roster in the SAME season can't be submitted twice).
 */

export interface RosterConflict {
  playerId: string
  playerName: string
  teamName: string
  clubName: string
}

export interface SelectedRosterPlayer {
  playerId: string
  jerseyNumber: number | null
  position: string | null
}

export type RosterSelectionResult =
  | { ok: true; players: SelectedRosterPlayer[] }
  | { ok: false; status: number; error: string; conflicts?: RosterConflict[] }

export async function findSeasonConflicts(
  seasonId: string,
  teamId: string,
  playerIds: string[]
): Promise<RosterConflict[]> {
  if (playerIds.length === 0) return []
  const rows = await prisma.seasonRosterPlayer.findMany({
    where: {
      playerId: { in: playerIds },
      roster: {
        seasonId,
        teamSubmission: {
          teamId: { not: teamId },
          status: { in: ["PENDING", "APPROVED"] },
        },
      },
    },
    select: {
      playerId: true,
      player: { select: { firstName: true, lastName: true } },
      roster: {
        select: {
          teamSubmission: {
            select: { team: { select: { name: true, tenant: { select: { name: true } } } } },
          },
        },
      },
    },
  })
  return rows.map((r: any) => ({
    playerId: r.playerId,
    playerName: `${r.player.firstName} ${r.player.lastName}`,
    teamName: r.roster.teamSubmission.team.name,
    clubName: r.roster.teamSubmission.team.tenant.name,
  }))
}

export async function resolveRosterSelection(opts: {
  seasonId: string
  teamId: string
  /** undefined → the whole ACTIVE club roster (legacy behavior) */
  playerIds?: string[]
}): Promise<RosterSelectionResult> {
  const teamPlayers = await prisma.teamPlayer.findMany({
    where: { teamId: opts.teamId, status: "ACTIVE" },
    select: {
      playerId: true,
      jerseyNumber: true,
      player: { select: { position: true } },
    },
  })
  const byId = new Map(teamPlayers.map((tp: any) => [tp.playerId, tp]))

  let selectedIds: string[]
  if (opts.playerIds) {
    const unknown = opts.playerIds.filter((id) => !byId.has(id))
    if (unknown.length > 0) {
      return {
        ok: false,
        status: 400,
        error: "Some selected players are not on this team's active roster.",
      }
    }
    if (opts.playerIds.length === 0) {
      return { ok: false, status: 400, error: "Select at least one player for the league roster." }
    }
    selectedIds = [...new Set(opts.playerIds)]
  } else {
    selectedIds = teamPlayers.map((tp: any) => tp.playerId)
  }

  const conflicts = await findSeasonConflicts(opts.seasonId, opts.teamId, selectedIds)
  if (conflicts.length > 0) {
    return {
      ok: false,
      status: 409,
      error: `${conflicts.length} selected player${conflicts.length !== 1 ? "s are" : " is"} already rostered in this season with another club: ${conflicts
        .map((c) => `${c.playerName} (${c.clubName})`)
        .join(", ")}. Deselect them to continue.`,
      conflicts,
    }
  }

  return {
    ok: true,
    players: selectedIds.map((playerId) => {
      const tp: any = byId.get(playerId)
      return {
        playerId,
        jerseyNumber: tp.jerseyNumber ?? null,
        position: tp.player?.position ?? null,
      }
    }),
  }
}
