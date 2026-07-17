import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getPlayerSeasonData } from "@/lib/queries/season-stats"
import { getViewerScope, isParticipant } from "@/lib/privacy/participants"
import { playerDisplayName } from "@/lib/privacy/names"
import { hasFamilyPass } from "@/lib/entitlements"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/player/[id] — the public player page, pre-folded
 * for the native app (THE parity pattern: same resolvers as
 * (public)/player/[id], so the two surfaces can never disagree). Public —
 * anonymous browsing allowed; the viewer only changes the privacy fold
 * (display name) and the Family-Pass game-log depth.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const data = await getPlayerSeasonData(params.id)
  if (!data) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  const session = await getSessionUserId().catch(() => null)
  const viewerId = session?.userId ?? null
  const scope = await getViewerScope(viewerId)
  const participant =
    scope.playerIds.has(data.player.id) ||
    data.rosterTeamIds.some((teamId: string) => isParticipant(scope, { teamId })) ||
    data.leagueIds.some((leagueId: string) => isParticipant(scope, { leagueId })) ||
    data.player.teams.some((tp: any) => isParticipant(scope, { tenantId: tp.team.tenantId }))

  const name = playerDisplayName(data.player, participant)
  const primary = data.player.teams[0] ?? null
  const showFullLog = await hasFamilyPass(viewerId)
  const gameLog = showFullLog ? data.gameLog : data.gameLog.slice(0, 3)
  const a = data.aggregate

  return NextResponse.json({
    id: data.player.id,
    name,
    position: data.player.position ?? null,
    jerseyNumber: primary?.jerseyNumber ?? null,
    primaryColor: primary?.team?.tenant?.branding?.primaryColor ?? null,
    team: primary
      ? {
          id: primary.team.id,
          name: primary.team.name,
          ageGroup: primary.team.ageGroup ?? null,
          clubName: primary.team.tenant?.name ?? null,
          clubSlug: primary.team.tenant?.slug ?? null,
        }
      : null,
    stats: a
      ? {
          gamesPlayed: a.gamesPlayed,
          ppg: a.ppg,
          rpg: a.rpg,
          apg: a.apg,
          spg: a.spg,
          bpg: a.bpg,
        }
      : null,
    gameLog,
    logCapped: !showFullLog && data.gameLog.length > gameLog.length,
  })
}
