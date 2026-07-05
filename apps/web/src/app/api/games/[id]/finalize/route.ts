import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canScoreGame } from "@/lib/scoring/authz"
import { foldEvents, totalRebounds, type FoldEvent } from "@/lib/scoring/fold"
import { sendEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

const finalizeSchema = z.object({
  // Referee signature (typed name at the table) — required when the league
  // demands sign-off, like signing the paper sheet.
  refereeName: z.string().trim().min(2).max(120).optional(),
})

/**
 * POST /api/games/[id]/finalize — fold the event stream server-side, write
 * the final score + PlayerStat rows, and mark the game COMPLETED (which is
 * what the standings engine consumes). Re-finalizing a COMPLETED game (the
 * corrections path: void/add events, then re-run) is restricted to the
 * league owner or a platform admin.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await (prisma as any).game.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        seasonId: true,
        homeTeamId: true,
        awayTeamId: true,
        status: true,
        scheduledAt: true,
        homeTeam: { select: { name: true, tenantId: true } },
        awayTeam: { select: { name: true, tenantId: true } },
        season: {
          select: {
            label: true,
            league: {
              select: { ownerId: true, name: true, requireRefereeApproval: true },
            },
          },
        },
      },
    })
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
    if (!(await canScoreGame(sessionInfo.userId, !!sessionInfo.isPlatformAdmin, game))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (["CANCELLED", "POSTPONED", "DEFAULTED"].includes(game.status)) {
      return NextResponse.json(
        { error: `A ${game.status} game cannot be finalized`, code: "NOT_FINALIZABLE" },
        { status: 400 }
      )
    }
    if (game.status === "COMPLETED") {
      const isLeagueOwner = game.season?.league?.ownerId === sessionInfo.userId
      if (!isLeagueOwner && !sessionInfo.isPlatformAdmin) {
        return NextResponse.json(
          { error: "Only the league owner can re-finalize a completed game", code: "ALREADY_FINAL" },
          { status: 403 }
        )
      }
    }

    const body = await request.json().catch(() => ({}))
    const { refereeName } = finalizeSchema.parse(body ?? {})
    if (game.season?.league?.requireRefereeApproval && !refereeName && game.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "This league requires the referee to sign off before finalizing",
          code: "REFEREE_REQUIRED",
        },
        { status: 400 }
      )
    }

    const rows = await (prisma as any).gameEvent.findMany({
      where: { gameId: params.id },
      orderBy: { sequence: "asc" },
    })
    const events: FoldEvent[] = rows.map((e: any) => ({
      eventType: e.eventType,
      teamId: e.teamId,
      playerId: e.playerId,
      made: e.made,
      period: e.period,
      clockSeconds: e.clockSeconds,
      voided: e.voided,
      sequence: e.sequence,
      timestampMs: new Date(e.timestamp).getTime(),
      metadata: e.metadata ?? null,
    }))
    if (events.filter((e) => !e.voided).length === 0) {
      return NextResponse.json(
        { error: "No events recorded — nothing to finalize", code: "NO_EVENTS" },
        { status: 400 }
      )
    }

    const folded = foldEvents(events, {
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
    })

    const lines = Object.values(folded.players)
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.game.update({
        where: { id: params.id },
        data: {
          homeScore: folded.homeScore,
          awayScore: folded.awayScore,
          status: "COMPLETED",
          finalizedAt: new Date(),
          scoringSessionId: null,
          scoringSessionUser: null,
          scoringSessionAt: null,
          ...(refereeName ? { refereeName, refereeSignedAt: new Date() } : {}),
        },
      })
      // Recompute-from-scratch semantics: stats rows mirror the fold exactly
      await tx.playerStat.deleteMany({ where: { gameId: params.id } })
      if (lines.length > 0) {
        await tx.playerStat.createMany({
          data: lines.map((l) => ({
            gameId: params.id,
            playerId: l.playerId,
            points: l.points,
            rebounds: totalRebounds(l),
            assists: l.assists,
            steals: l.steals,
            blocks: l.blocks,
            turnovers: l.turnovers,
            fouls: l.fouls,
            minutesPlayed: l.secondsPlayed > 0 ? Math.round(l.secondsPlayed / 60) : null,
          })),
        })
      }
    })

    // Distribute the scoresheet — club managers of BOTH teams + the league
    // owner. Best-effort: a mail hiccup never blocks the final whistle.
    try {
      const tenantIds = [game.homeTeam.tenantId, game.awayTeam.tenantId].filter(Boolean)
      const [managers, leagueOwner] = await Promise.all([
        prisma.userRole.findMany({
          where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
          select: { user: { select: { email: true } } },
        }),
        game.season?.league?.ownerId
          ? prisma.user.findUnique({
              where: { id: game.season.league.ownerId },
              select: { email: true },
            })
          : null,
      ])
      const recipients = Array.from(
        new Set(
          [...managers.map((m: any) => m.user?.email), leagueOwner?.email].filter(
            (e): e is string => !!e
          )
        )
      )
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
      const title = `${game.homeTeam.name} ${folded.homeScore} — ${folded.awayScore} ${game.awayTeam.name}`
      await Promise.allSettled(
        recipients.map((to) =>
          sendEmail({
            to,
            subject: `Final: ${title}`,
            html: `
              <h2>Final: ${title}</h2>
              <p>${game.season?.league?.name ?? ""} ${game.season?.label ?? ""} · ${new Date(
                game.scheduledAt
              ).toLocaleDateString()}</p>
              ${refereeName ? `<p>Referee: <strong>${refereeName}</strong></p>` : ""}
              <p><a href="${baseUrl}/scoresheet/${game.id}">View / print the official scoresheet</a></p>
              <p><a href="${baseUrl}/live/${game.id}">Box score &amp; play-by-play</a></p>
            `,
            text: `Final: ${title}\nScoresheet: ${baseUrl}/scoresheet/${game.id}`,
          })
        )
      )
    } catch (mailErr) {
      console.error("Scoresheet email failed:", mailErr)
    }

    return NextResponse.json({
      success: true,
      homeScore: folded.homeScore,
      awayScore: folded.awayScore,
      playerLines: lines.length,
    })
  } catch (error) {
    console.error("Finalize game error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
