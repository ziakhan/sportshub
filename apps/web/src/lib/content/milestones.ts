/**
 * Player MILESTONE cards (business-model-v2.md §12/§16 S1): season-high
 * points, first 20+ point game, first career double-double, 100th career
 * point, scored-in-N-straight streaks. Detected server-side right after
 * finalize folds PlayerStat rows — no cron, no human effort.
 *
 * Split like scoring/fold and standings/compute: a pure detector (easy to
 * unit test) plus a thin orchestration function that fetches Prisma rows and
 * writes Post/PostTag. Idempotent by slug so a re-finalize (corrections)
 * never double-posts; a milestone that no longer qualifies after a
 * correction is taken down rather than left stale.
 *
 * Scope calls (owner ask left these open — picked pragmatically, documented
 * here rather than left ambiguous):
 *  - "Season-high" is season-scoped and only fires once a player has a
 *    PRIOR game in the same season to beat (game #1 isn't a "new high").
 *  - "First 20+ game" and "first double-double" are CAREER-scoped (true
 *    firsts), matching "100th CAREER point" — all three are the truly
 *    special never-happened-before milestones.
 *  - The scoring streak is SEASON-scoped (a fresh streak each season) and
 *    re-fires every STREAK_STEP games (5, 10, 15, ...) so it stays a live
 *    signal instead of a one-time badge.
 *  - Card render: PLAIN TEXT v1 (no satori image) — reuses the existing
 *    text-card path (ANNOUNCEMENT-style rendering already in FeedCard); a
 *    bespoke satori "Milestone" template is future work, not tonight's
 *    scope. The feed chip alone (🏅 Milestone) carries the distinction.
 */

import { prisma } from "@youthbasketballhub/db"
import { publicPlayerName, type MediaConsentValue } from "../privacy/names"

export type MilestoneType =
  | "SEASON_HIGH"
  | "FIRST_20"
  | "FIRST_DOUBLE_DOUBLE"
  | "CAREER_100"
  | "SCORE_STREAK"

export const FIRST_20_THRESHOLD = 20
export const DOUBLE_DOUBLE_THRESHOLD = 10
export const CAREER_POINT_MILESTONE = 100
export const STREAK_MIN = 5
export const STREAK_STEP = 5

export interface StatLine {
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
}

/** One PRIOR game's line, chronologically ordered ascending by the caller. */
export interface PriorLine extends StatLine {
  gameId: string
}

export interface MilestoneCandidate {
  type: MilestoneType
  playerId: string
  /** points / career total / streak length, depending on type — feeds the copy */
  value: number
}

export function isDoubleDouble(l: StatLine): boolean {
  const categories = [l.points, l.rebounds, l.assists, l.steals, l.blocks].filter(
    (v) => v >= DOUBLE_DOUBLE_THRESHOLD
  ).length
  return categories >= 2
}

export interface PlayerMilestoneInput {
  playerId: string
  thisGame: StatLine
  /** This season's COMPLETED games for the player, before this one, ascending by date. */
  priorSeasonGames: PriorLine[]
  /** ALL prior COMPLETED games for the player (career), ascending by date. */
  priorCareerGames: PriorLine[]
}

/** Pure detector — no I/O. Mirrors standings/compute.ts and scoring/fold.ts style. */
export function detectPlayerMilestones(input: PlayerMilestoneInput): MilestoneCandidate[] {
  const { playerId, thisGame, priorSeasonGames, priorCareerGames } = input
  const out: MilestoneCandidate[] = []

  if (priorSeasonGames.length > 0) {
    const priorMax = Math.max(...priorSeasonGames.map((g) => g.points))
    if (thisGame.points > priorMax) {
      out.push({ type: "SEASON_HIGH", playerId, value: thisGame.points })
    }
  }

  if (
    thisGame.points >= FIRST_20_THRESHOLD &&
    !priorCareerGames.some((g) => g.points >= FIRST_20_THRESHOLD)
  ) {
    out.push({ type: "FIRST_20", playerId, value: thisGame.points })
  }

  if (isDoubleDouble(thisGame) && !priorCareerGames.some(isDoubleDouble)) {
    out.push({ type: "FIRST_DOUBLE_DOUBLE", playerId, value: thisGame.points })
  }

  const priorCareerPoints = priorCareerGames.reduce((s, g) => s + g.points, 0)
  const newCareerPoints = priorCareerPoints + thisGame.points
  if (priorCareerPoints < CAREER_POINT_MILESTONE && newCareerPoints >= CAREER_POINT_MILESTONE) {
    out.push({ type: "CAREER_100", playerId, value: newCareerPoints })
  }

  if (thisGame.points > 0) {
    let streak = 1
    for (let i = priorSeasonGames.length - 1; i >= 0; i--) {
      if (priorSeasonGames[i].points > 0) streak++
      else break
    }
    if (streak >= STREAK_MIN && streak % STREAK_STEP === 0) {
      out.push({ type: "SCORE_STREAK", playerId, value: streak })
    }
  }

  return out
}

function slugFor(type: MilestoneType, playerId: string, gameId: string): string {
  return `milestone-${type.toLowerCase().replace(/_/g, "-")}-${playerId}-${gameId}`
}

function copyFor(
  type: MilestoneType,
  name: string,
  value: number
): { title: string; body: string } {
  switch (type) {
    case "SEASON_HIGH":
      return {
        title: `New season high: ${value} points for ${name}`,
        body: `${name} set a new season high with ${value} points.`,
      }
    case "FIRST_20":
      return {
        title: `${name}'s first 20-point game`,
        body: `${name} scored ${value} points, their first 20-point game.`,
      }
    case "FIRST_DOUBLE_DOUBLE":
      return {
        title: `${name}'s first double-double`,
        body: `${name} recorded their first career double-double.`,
      }
    case "CAREER_100":
      return {
        title: `${name} hits 100 career points`,
        body: `${name} crossed 100 career points.`,
      }
    case "SCORE_STREAK":
      return {
        title: `${name} has scored in ${value} straight games`,
        body: `${name} has now scored in ${value} consecutive games this season.`,
      }
  }
}

const toLine = (s: {
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  game: { id: string; scheduledAt: Date; seasonId: string | null }
}): PriorLine & { seasonId: string | null } => ({
  gameId: s.game.id,
  points: s.points,
  rebounds: s.rebounds,
  assists: s.assists,
  steals: s.steals,
  blocks: s.blocks,
  seasonId: s.game.seasonId,
})

/**
 * Detect + publish milestone Posts for every player in a just-finalized
 * game. Best-effort by the caller's convention (finalize wraps this in
 * try/catch) — a detector bug must never block the final whistle.
 */
export async function detectAndPublishMilestones(gameId: string): Promise<{ created: number }> {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: { id: true, seasonId: true },
  })
  if (!game) return { created: 0 }

  const lines = await (prisma as any).playerStat.findMany({
    where: { gameId },
    select: { playerId: true, points: true, rebounds: true, assists: true, steals: true, blocks: true },
  })
  if (lines.length === 0) return { created: 0 }

  const playerIds = lines.map((l: any) => l.playerId)
  const [players, priorStatsRaw] = await Promise.all([
    (prisma as any).player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, firstName: true, lastName: true, mediaConsent: true, socialVisibility: true },
    }),
    (prisma as any).playerStat.findMany({
      where: { playerId: { in: playerIds }, gameId: { not: gameId }, game: { status: "COMPLETED" } },
      select: {
        playerId: true,
        points: true,
        rebounds: true,
        assists: true,
        steals: true,
        blocks: true,
        game: { select: { id: true, scheduledAt: true, seasonId: true } },
      },
    }),
  ])

  const playerById = new Map(players.map((p: any) => [p.id, p]))

  let created = 0
  for (const line of lines) {
    const player = playerById.get(line.playerId) as
      | { id: string; firstName: string; lastName: string; mediaConsent: MediaConsentValue; socialVisibility: string }
      | undefined
    if (!player) continue

    // Chronologically ascending — the streak walk reads backwards from the
    // most recent prior game.
    const priorSorted = (priorStatsRaw as any[])
      .filter((s) => s.playerId === line.playerId)
      .sort((a, b) => new Date(a.game.scheduledAt).getTime() - new Date(b.game.scheduledAt).getTime())
      .map(toLine)

    const priorSeasonGames = game.seasonId
      ? priorSorted.filter((g) => g.seasonId === game.seasonId)
      : []
    const priorCareerGames = priorSorted

    const candidates = detectPlayerMilestones({
      playerId: line.playerId,
      thisGame: line,
      priorSeasonGames,
      priorCareerGames,
    })

    // Revoke milestones from a prior finalize of THIS game that no longer
    // qualify after a correction (points edited down, etc).
    const existing = await (prisma as any).post.findMany({
      where: { kind: "MILESTONE", tags: { some: { playerId: line.playerId, gameId } } },
      select: { id: true, slug: true, status: true },
    })
    const candidateSlugs = new Set(candidates.map((c) => slugFor(c.type, line.playerId, gameId)))
    for (const post of existing) {
      if (!candidateSlugs.has(post.slug) && post.status === "PUBLISHED") {
        await (prisma as any).post.update({ where: { id: post.id }, data: { status: "TAKEN_DOWN" } })
      }
    }

    for (const c of candidates) {
      const name = publicPlayerName(player)
      const { title, body } = copyFor(c.type, name, c.value)
      const slug = slugFor(c.type, line.playerId, gameId)
      const visibility = player.socialVisibility === "PUBLIC" ? "PUBLIC" : "FOLLOWERS"
      await (prisma as any).post.upsert({
        where: { slug },
        create: {
          kind: "MILESTONE",
          title,
          slug,
          body,
          status: "PUBLISHED",
          publishedAt: new Date(),
          visibility,
          tags: { create: [{ gameId }, { playerId: line.playerId }] },
        },
        update: { title, body, status: "PUBLISHED", visibility },
      })
      created++
    }
  }

  return { created }
}
