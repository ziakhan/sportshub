import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { resolveGuestScorer } from "@/lib/scoring/guest"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canScoreGame } from "@/lib/scoring/authz"
import { publishRealtime, rooms as rt } from "@/lib/realtime/publish"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/**
 * The append-only scoring stream (docs/live-scoring-design.md).
 * POST  — append a batch of events. Idempotent via clientEventId (offline
 *         queues retry safely); sequence is assigned server-side in one
 *         transaction. A PERIOD_START on a SCHEDULED game flips it LIVE.
 * PATCH — void / unvoid events by clientEventId (undo + corrections).
 * Nothing here ever edits or deletes an event row's content.
 */

const EVENT_TYPES = [
  "SCORE_2PT",
  "SCORE_3PT",
  "SCORE_FT",
  "REBOUND",
  "ASSIST",
  "STEAL",
  "BLOCK",
  "TURNOVER",
  "FOUL",
  "TIMEOUT",
  "SUBSTITUTION",
  "LINEUP",
  "ATTENDANCE",
  "PERIOD_START",
  "PERIOD_END",
  "CLOCK_START",
  "CLOCK_STOP",
] as const

const appendSchema = z.object({
  sessionId: z.string().min(8),
  events: z
    .array(
      z.object({
        clientEventId: z.string().min(8),
        eventType: z.enum(EVENT_TYPES),
        teamId: z.string().nullish(),
        playerId: z.string().nullish(),
        made: z.boolean().nullish(),
        period: z.number().int().min(1).max(10).nullish(),
        clockSeconds: z.number().int().min(0).nullish(),
        timestampMs: z.number().optional(),
        metadata: z.record(z.any()).nullish(),
      })
    )
    .min(1)
    .max(200),
})

const voidSchema = z.object({
  sessionId: z.string().min(8),
  clientEventIds: z.array(z.string()).min(1).max(50),
  voided: z.boolean(),
})

/**
 * Realtime ping after the scoring stream changes (M1): current score to the
 * game room + public scoreboard rooms. Score is recomputed from unvoided
 * events so voids/unvoids stay correct. Clients treat this as "fetch now".
 */
async function publishGameUpdate(
  game: {
    id: string
    homeTeamId: string | null
    awayTeamId: string | null
    status: string
    season: { leagueId: string } | null
  },
  extra: { status?: string; maxSequence?: number } = {}
) {
  const sums = await (prisma as any).gameEvent.groupBy({
    by: ["teamId"],
    where: { gameId: game.id, voided: false, points: { not: null } },
    _sum: { points: true },
  })
  const scoreFor = (teamId: string | null) =>
    sums.find((s: any) => s.teamId === teamId)?._sum?.points ?? 0
  await publishRealtime({
    rooms: [
      rt.game(game.id),
      rt.scores,
      ...(game.season?.leagueId ? [rt.leagueScores(game.season.leagueId)] : []),
    ],
    event: "game.update",
    payload: {
      gameId: game.id,
      status: extra.status ?? game.status,
      homeScore: scoreFor(game.homeTeamId),
      awayScore: scoreFor(game.awayTeamId),
      ...(extra.maxSequence !== undefined ? { maxSequence: extra.maxSequence } : {}),
    },
  })
}

async function authorize(userId: string, isAdmin: boolean, gameId: string) {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      seasonId: true,
      homeTeamId: true,
      awayTeamId: true,
      status: true,
      scoringSessionId: true,
      season: { select: { leagueId: true } },
    },
  })
  if (!game) return { game: null, error: "Game not found", status: 404 }
  if (!(await canScoreGame(userId, isAdmin, game))) {
    return { game: null, error: "Forbidden", status: 403 }
  }
  if (["CANCELLED", "COMPLETED"].includes(game.status)) {
    return { game: null, error: "Game is not open for scoring", status: 400 }
  }
  return { game, error: null, status: 200 }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let sessionInfo = await getSessionUserId()
    let guestScorer: { name: string; actorUserId: string } | null = null
    if (!sessionInfo) {
      // Guest scorekeeper: game-scoped one-time token (2026-07-15); acts
      // under the delegating operator's identity
      guestScorer = await resolveGuestScorer(request, params.id)
      if (guestScorer) {
        sessionInfo = {
          userId: guestScorer.actorUserId,
          realUserId: guestScorer.actorUserId,
          isPlatformAdmin: false,
        }
      }
    }
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { game, error, status } = await authorize(
      sessionInfo.userId,
      !!sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!game) return NextResponse.json({ error }, { status })

    const data = appendSchema.parse(await request.json())
    if (game.scoringSessionId && game.scoringSessionId !== data.sessionId) {
      return NextResponse.json(
        { error: "Another device holds the scoring lock", code: "LOCK_HELD" },
        { status: 409 }
      )
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const last = await tx.gameEvent.findFirst({
        where: { gameId: params.id },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      })
      let seq = last?.sequence ?? 0

      // Idempotency: skip events already persisted (offline retry)
      const existing = await tx.gameEvent.findMany({
        where: { clientEventId: { in: data.events.map((e) => e.clientEventId) } },
        select: { clientEventId: true },
      })
      const seen = new Set(existing.map((e: any) => e.clientEventId))
      const fresh = data.events.filter((e) => !seen.has(e.clientEventId))

      if (fresh.length > 0) {
        await tx.gameEvent.createMany({
          data: fresh.map((e) => ({
            gameId: params.id,
            eventType: e.eventType,
            teamId: e.teamId ?? null,
            playerId: e.playerId ?? null,
            made: e.made ?? null,
            points:
              e.eventType === "SCORE_2PT" && e.made !== false
                ? 2
                : e.eventType === "SCORE_3PT" && e.made !== false
                  ? 3
                  : e.eventType === "SCORE_FT" && e.made !== false
                    ? 1
                    : null,
            period: e.period ?? null,
            clockSeconds: e.clockSeconds ?? null,
            timestamp: e.timestampMs ? new Date(e.timestampMs) : new Date(),
            sequence: ++seq,
            clientEventId: e.clientEventId,
            recordedById: sessionInfo.userId,
            metadata: e.metadata ?? undefined,
          })),
        })
      }

      let wentLive = false
      if (game.status === "SCHEDULED" && fresh.some((e) => e.eventType === "PERIOD_START")) {
        await tx.game.update({ where: { id: params.id }, data: { status: "LIVE" } })
        wentLive = true
      }

      return { appended: fresh.length, skipped: seen.size, maxSequence: seq, wentLive }
    })

    if (result.appended > 0) {
      await publishGameUpdate(game, {
        status: result.wentLive ? "LIVE" : game.status,
        maxSequence: result.maxSequence,
      })
    }

    // Live-push activation (M3): tip-off bells + pushes followers of either
    // team, once, when the game first flips LIVE. Best-effort — scoring
    // must never fail on fan-out.
    if (result.wentLive) {
      try {
        const teamIds = [game.homeTeamId, game.awayTeamId].filter(Boolean) as string[]
        const [follows, teams] = await Promise.all([
          (prisma as any).follow.findMany({
            where: { teamId: { in: teamIds } },
            select: { userId: true },
          }),
          (prisma as any).team.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true },
          }),
        ])
        const followerIds = [...new Set(follows.map((f: any) => f.userId as string))] as string[]
        if (followerIds.length > 0) {
          const nameOf = (id: string | null) =>
            teams.find((t: any) => t.id === id)?.name ?? "TBD"
          await notifyMany(prisma, followerIds, {
            type: "game_live",
            title: "Tip-off! 🏀",
            message: `${nameOf(game.homeTeamId)} vs ${nameOf(game.awayTeamId)} is live — follow along.`,
            link: `/live/${game.id}`,
            referenceId: game.id,
            referenceType: "Game",
          })
        }
      } catch (fanoutErr) {
        console.error("game_live fan-out failed:", fanoutErr)
      }
    }

    return NextResponse.json(
      { appended: result.appended, skipped: result.skipped, maxSequence: result.maxSequence },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Append events error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let sessionInfo = await getSessionUserId()
    let guestScorer: { name: string; actorUserId: string } | null = null
    if (!sessionInfo) {
      // Guest scorekeeper: game-scoped one-time token (2026-07-15); acts
      // under the delegating operator's identity
      guestScorer = await resolveGuestScorer(request, params.id)
      if (guestScorer) {
        sessionInfo = {
          userId: guestScorer.actorUserId,
          realUserId: guestScorer.actorUserId,
          isPlatformAdmin: false,
        }
      }
    }
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { game, error, status } = await authorize(
      sessionInfo.userId,
      !!sessionInfo.isPlatformAdmin,
      params.id
    )
    if (!game) return NextResponse.json({ error }, { status })

    const data = voidSchema.parse(await request.json())
    if (game.scoringSessionId && game.scoringSessionId !== data.sessionId) {
      return NextResponse.json(
        { error: "Another device holds the scoring lock", code: "LOCK_HELD" },
        { status: 409 }
      )
    }

    const result = await (prisma as any).gameEvent.updateMany({
      where: { gameId: params.id, clientEventId: { in: data.clientEventIds } },
      data: { voided: data.voided },
    })

    // Voiding a made basket changes the score — ping the scoreboards
    if (result.count > 0) await publishGameUpdate(game)

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Void events error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
