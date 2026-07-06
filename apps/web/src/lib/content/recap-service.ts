// Relative imports (not "@/") so root-level scripts (backfill-recaps) can
// import this service through plain tsx without tsconfig path mapping.
import { format } from "date-fns"
import { prisma } from "@youthbasketballhub/db"
import { publicPlayerName } from "../privacy/names"
import {
  buildTemplateRecap,
  type RecapInput,
  type RecapPlayerLine,
  type RecapScoreEvent,
} from "./recap"
import { buildMatchupCover } from "./matchup-cover"
import { generateRecapWithClaude, RECAP_MODEL } from "./recap-claude"

/**
 * Create or refresh the auto-published RECAP_AI post for a COMPLETED game
 * (plan §6.1 — owner decision: auto-publish; league owners get edit/takedown).
 * Re-finalizing a game regenerates the same post in place. Best-effort by
 * design — callers wrap in try/catch; a recap failure never blocks finalize.
 */

const SCORE_POINTS: Record<string, number> = {
  SCORE_2PT: 2,
  SCORE_3PT: 3,
  SCORE_FT: 1,
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export async function upsertGameRecap(gameId: string): Promise<{ postId: string } | null> {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          tenant: { select: { branding: { select: { primaryColor: true } } } },
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          tenant: { select: { branding: { select: { primaryColor: true } } } },
        },
      },
      season: {
        select: {
          label: true,
          league: { select: { id: true, name: true, periodType: true } },
        },
      },
    },
  })
  if (!game || game.status !== "COMPLETED") return null
  if (game.homeScore == null || game.awayScore == null) return null

  const [events, statRows] = await Promise.all([
    (prisma as any).gameEvent.findMany({
      where: { gameId, voided: false },
      orderBy: { sequence: "asc" },
      select: { eventType: true, teamId: true, playerId: true, made: true, period: true, sequence: true },
    }),
    (prisma as any).playerStat.findMany({
      where: { gameId },
      select: {
        points: true,
        rebounds: true,
        assists: true,
        player: {
          select: { id: true, firstName: true, lastName: true, mediaConsent: true },
        },
      },
    }),
  ])

  // Player → team attribution comes from the event stream (the same stream
  // the stats were folded from), so coverage matches PlayerStat exactly.
  const playerTeam = new Map<string, string>()
  const scoreEvents: RecapScoreEvent[] = []
  for (const e of events) {
    if (e.playerId && e.teamId && !playerTeam.has(e.playerId)) {
      playerTeam.set(e.playerId, e.teamId)
    }
    const pts = SCORE_POINTS[e.eventType]
    if (pts && e.made && e.teamId) {
      scoreEvents.push({ teamId: e.teamId, points: pts, period: e.period, sequence: e.sequence })
    }
  }

  const playerLines: RecapPlayerLine[] = statRows
    .map((row: any): RecapPlayerLine | null => {
      const teamId = playerTeam.get(row.player.id)
      if (!teamId) return null
      return {
        playerId: row.player.id,
        teamId,
        name: publicPlayerName(row.player),
        points: row.points,
        rebounds: row.rebounds,
        assists: row.assists,
      }
    })
    .filter((l: RecapPlayerLine | null): l is RecapPlayerLine => l !== null)

  const input: RecapInput = {
    homeTeam: { id: game.homeTeam.id, name: game.homeTeam.name },
    awayTeam: { id: game.awayTeam.id, name: game.awayTeam.name },
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    leagueName: game.season?.league?.name ?? null,
    seasonLabel: game.season?.label ?? null,
    dateLabel: game.scheduledAt ? format(new Date(game.scheduledAt), "EEEE, MMMM d") : null,
    periodType: game.season?.league?.periodType === "HALVES" ? "HALVES" : "QUARTERS",
    scoreEvents,
    playerLines,
  }

  const claudeRecap = await generateRecapWithClaude(input)
  const recap = claudeRecap ?? buildTemplateRecap(input)
  const aiModel = claudeRecap ? RECAP_MODEL : "template"

  const existing = await (prisma as any).post.findFirst({
    where: { kind: "RECAP_AI", tags: { some: { gameId } } },
    select: { id: true },
  })

  if (existing) {
    await (prisma as any).post.update({
      where: { id: existing.id },
      data: { title: recap.title, body: recap.body, aiModel },
    })
    return { postId: existing.id }
  }

  const slug = `${slugify(`${game.homeTeam.name}-vs-${game.awayTeam.name}`)}-${format(
    new Date(game.scheduledAt),
    "yyyyMMdd"
  )}-${game.id.slice(0, 8)}`

  // Tags ARE distribution (plan §5): game, both teams, both clubs, the league.
  const tags: Array<Record<string, string>> = [{ gameId }]
  tags.push({ teamId: game.homeTeam.id }, { teamId: game.awayTeam.id })
  const tenantIds = new Set(
    [game.homeTeam.tenantId, game.awayTeam.tenantId].filter(Boolean) as string[]
  )
  for (const tenantId of tenantIds) tags.push({ tenantId })
  if (game.season?.league?.id) tags.push({ leagueId: game.season.league.id })

  // Every recap ships with a branded matchup cover (generated SVG) so the
  // news feed never shows imageless stories — replaced by real photos when
  // creators upload them (P2).
  const coverUrl = buildMatchupCover({
    homeName: game.homeTeam.name,
    awayName: game.awayTeam.name,
    homeColor: game.homeTeam.tenant?.branding?.primaryColor,
    awayColor: game.awayTeam.tenant?.branding?.primaryColor,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    label: [game.season?.league?.name, game.season?.label].filter(Boolean).join(" · ") || null,
  })

  const post = await (prisma as any).post.create({
    data: {
      kind: "RECAP_AI",
      title: recap.title,
      slug,
      body: recap.body,
      status: "PUBLISHED",
      publishedAt: new Date(),
      aiModel,
      tags: { create: tags },
      media: { create: [{ type: "IMAGE", url: coverUrl, title: "Matchup" }] },
    },
    select: { id: true },
  })
  return { postId: post.id }
}
