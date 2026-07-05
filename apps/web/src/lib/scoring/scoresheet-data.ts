import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds, type FoldEvent, type FoldResult, type PlayerLine } from "./fold"

/**
 * Assemble everything a scoresheet rendering (HTML or PDF) needs for one
 * game: header facts, fold, full rosters with DNP/ABSENT status, scorebook
 * marks per player per period, and the period line score.
 */

export interface SheetMark {
  kind: "fg" | "ft"
  digit?: 2 | 3
  made: boolean
}

export interface SheetPlayer {
  playerId: string
  name: string
  jersey: string
  status: "played" | "dnp" | "absent"
  line: PlayerLine
  marks: Map<number, SheetMark[]>
}

export interface ScoresheetData {
  game: {
    id: string
    status: string
    scheduledAt: Date
    final: boolean
    homeScore: number
    awayScore: number
    homeTeamId: string
    awayTeamId: string
    homeTeamName: string
    awayTeamName: string
    venueName: string | null
    courtName: string | null
    leagueName: string | null
    seasonLabel: string | null
    periodType: "QUARTERS" | "HALVES"
    requireRefereeApproval: boolean
    refereeName: string | null
    refereeSignedAt: Date | null
    finalizedAt: Date | null
  }
  fold: FoldResult
  periods: number[]
  teams: { home: SheetPlayer[]; away: SheetPlayer[] }
  lineScore: (teamId: string) => number[]
  periodLabel: (p: number) => string
}

export async function loadScoresheetData(gameId: string): Promise<ScoresheetData | null> {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      seasonId: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
      refereeName: true,
      refereeSignedAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      venue: { select: { name: true } },
      court: { select: { name: true } },
      season: {
        select: {
          label: true,
          league: { select: { name: true, periodType: true, requireRefereeApproval: true } },
        },
      },
    },
  })
  if (!game) return null

  const [rows, submissions] = await Promise.all([
    (prisma as any).gameEvent.findMany({ where: { gameId }, orderBy: { sequence: "asc" } }),
    (prisma as any).teamSubmission.findMany({
      where: {
        seasonId: game.seasonId ?? undefined,
        teamId: { in: [game.homeTeamId, game.awayTeamId] },
        status: "APPROVED",
      },
      select: {
        teamId: true,
        roster: {
          select: {
            players: {
              select: {
                playerId: true,
                jerseyNumber: true,
                player: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
  ])

  const events: FoldEvent[] = rows.map((e: any) => ({
    eventType: e.eventType,
    teamId: e.teamId,
    playerId: e.playerId,
    made: e.made,
    period: e.period,
    voided: e.voided,
    sequence: e.sequence,
    metadata: e.metadata ?? null,
  }))
  const fold = foldEvents(events, { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId })

  const nameById = new Map<string, { name: string; jersey: string }>()
  const rosterByTeam = new Map<string, string[]>()
  for (const s of submissions) {
    const ids: string[] = []
    for (const p of s.roster?.players ?? []) {
      nameById.set(p.playerId, {
        name: `${p.player.firstName} ${p.player.lastName}`.trim(),
        jersey: p.jerseyNumber != null ? String(p.jerseyNumber) : "?",
      })
      ids.push(p.playerId)
    }
    rosterByTeam.set(s.teamId, ids)
  }

  const periods = Array.from(
    new Set(fold.playByPlay.filter((e) => e.period).map((e) => e.period as number))
  ).sort((a, b) => a - b)

  const marksByPlayer = new Map<string, Map<number, SheetMark[]>>()
  for (const e of fold.playByPlay) {
    if (!e.playerId || !["SCORE_2PT", "SCORE_3PT", "SCORE_FT"].includes(e.eventType)) continue
    const period = e.period ?? 1
    const byPeriod = marksByPlayer.get(e.playerId) ?? new Map<number, SheetMark[]>()
    const list = byPeriod.get(period) ?? []
    list.push(
      e.eventType === "SCORE_FT"
        ? { kind: "ft", made: e.made !== false }
        : { kind: "fg", digit: e.eventType === "SCORE_2PT" ? 2 : 3, made: e.made !== false }
    )
    byPeriod.set(period, list)
    marksByPlayer.set(e.playerId, byPeriod)
  }

  const emptyLine = (playerId: string, teamId: string): PlayerLine => ({
    playerId,
    teamId,
    points: 0,
    fgMade2: 0,
    fgMiss2: 0,
    fgMade3: 0,
    fgMiss3: 0,
    ftMade: 0,
    ftMiss: 0,
    offRebounds: 0,
    defRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    technicalFouls: 0,
    secondsPlayed: 0,
    periodsPlayed: 0,
    onFloor: false,
    fouledOut: false,
  })

  const buildTeam = (teamId: string): SheetPlayer[] => {
    const attendance = fold.attendance[teamId]
    const rosterIds = rosterByTeam.get(teamId) ?? []
    const foldIds = Object.values(fold.players)
      .filter((l) => l.teamId === teamId)
      .map((l) => l.playerId)
    const allIds = Array.from(new Set([...rosterIds, ...foldIds])).sort(
      (a, b) => Number(nameById.get(a)?.jersey ?? 999) - Number(nameById.get(b)?.jersey ?? 999)
    )
    return allIds.map((id) => {
      const line = fold.players[id] ?? emptyLine(id, teamId)
      const status: SheetPlayer["status"] = attendance?.absent.includes(id)
        ? "absent"
        : !fold.players[id] ||
            (line.periodsPlayed === 0 && line.points === 0 && line.fouls === 0)
          ? "dnp"
          : "played"
      return {
        playerId: id,
        name: nameById.get(id)?.name ?? id.slice(0, 8),
        jersey: nameById.get(id)?.jersey ?? "?",
        status,
        line,
        marks: marksByPlayer.get(id) ?? new Map(),
      }
    })
  }

  const periodType = (game.season?.league?.periodType ?? "QUARTERS") as "QUARTERS" | "HALVES"
  const final = game.status === "COMPLETED"

  return {
    game: {
      id: game.id,
      status: game.status,
      scheduledAt: game.scheduledAt,
      final,
      homeScore: final && game.homeScore != null ? game.homeScore : fold.homeScore,
      awayScore: final && game.awayScore != null ? game.awayScore : fold.awayScore,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeTeamName: game.homeTeam.name,
      awayTeamName: game.awayTeam.name,
      venueName: game.venue?.name ?? null,
      courtName: game.court?.name ?? null,
      leagueName: game.season?.league?.name ?? null,
      seasonLabel: game.season?.label ?? null,
      periodType,
      requireRefereeApproval: !!game.season?.league?.requireRefereeApproval,
      refereeName: game.refereeName ?? null,
      refereeSignedAt: game.refereeSignedAt ?? null,
      finalizedAt: game.finalizedAt ?? null,
    },
    fold,
    periods,
    teams: { home: buildTeam(game.homeTeamId), away: buildTeam(game.awayTeamId) },
    lineScore: (teamId: string) =>
      periods.map((p) =>
        fold.playByPlay
          .filter(
            (e) =>
              e.teamId === teamId &&
              e.period === p &&
              e.made !== false &&
              ["SCORE_2PT", "SCORE_3PT", "SCORE_FT"].includes(e.eventType)
          )
          .reduce(
            (s, e) =>
              s + (e.eventType === "SCORE_2PT" ? 2 : e.eventType === "SCORE_3PT" ? 3 : 1),
            0
          )
      ),
    periodLabel: (p: number) =>
      periodType === "HALVES" ? `H${p}` : p <= 4 ? `Q${p}` : `OT${p - 4}`,
  }
}

export { totalRebounds }
