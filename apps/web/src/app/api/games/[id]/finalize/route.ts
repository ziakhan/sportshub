import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { canScoreGame } from "@/lib/scoring/authz"
import { foldEvents, totalRebounds, type FoldEvent } from "@/lib/scoring/fold"
import { sendEmail, appBaseUrl } from "@/lib/email"
import { upsertGameRecap } from "@/lib/content/recap-service"
import { notifyMany } from "@/lib/notifications"
import { getGameAudienceUserIds } from "@/lib/game-audience"
import { publishRealtime, rooms as rt } from "@/lib/realtime/publish"

export const dynamic = "force-dynamic"

const finalizeSchema = z.object({
  // Referee approval, three strengths (docs/live-scoring-design.md):
  //  1. PIN — refereeUserId + refereePin, verified against the ASSIGNED
  //     referee's account hash → refereeVerified=true (strongest)
  //  2. Drawn signature (data-URL PNG from the pad) and/or typed name
  //  3. withoutReferee — explicit escape hatch; the sheet is stamped
  //     "finalized without referee approval". Sign-off gates the stamp,
  //     never the game.
  refereeName: z.string().trim().min(2).max(120).optional(),
  refereeSignature: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
    .max(400_000)
    .optional(),
  refereeUserId: z.string().optional(),
  refereePin: z.string().min(4).max(32).optional(),
  withoutReferee: z.boolean().default(false),
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
            leagueId: true,
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
    const { refereeName, refereeSignature, refereeUserId, refereePin, withoutReferee } =
      finalizeSchema.parse(body ?? {})

    // PIN path: verify against the assigned referee's account
    let verifiedRefereeName: string | null = null
    if (refereeUserId && refereePin) {
      const assignment = await prisma.userRole.findFirst({
        where: { gameId: params.id, role: "Referee", userId: refereeUserId },
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              refereeProfile: { select: { signoffPinHash: true } },
            },
          },
        },
      })
      const hash = assignment?.user?.refereeProfile?.signoffPinHash
      if (!assignment || !hash || !(await bcrypt.compare(refereePin, hash))) {
        return NextResponse.json(
          { error: "Referee PIN is incorrect", code: "BAD_REFEREE_PIN" },
          { status: 400 }
        )
      }
      verifiedRefereeName =
        `${assignment.user?.firstName ?? ""} ${assignment.user?.lastName ?? ""}`.trim() ||
        "Referee"
    }

    const hasApproval = !!verifiedRefereeName || !!refereeSignature || !!refereeName
    if (
      game.season?.league?.requireRefereeApproval &&
      !hasApproval &&
      !withoutReferee &&
      game.status !== "COMPLETED"
    ) {
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
          ...(verifiedRefereeName || refereeName || refereeSignature
            ? {
                refereeName: verifiedRefereeName ?? refereeName ?? null,
                refereeSignedAt: new Date(),
                refereeSignature: refereeSignature ?? null,
                refereeVerified: !!verifiedRefereeName,
              }
            : {}),
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

    // Auto-publish the AI game recap (plan §6.1 — owner decision: auto-publish
    // on finalize; re-finalize regenerates in place). Best-effort: a recap
    // failure never blocks the final whistle.
    try {
      await upsertGameRecap(params.id)
    } catch (recapErr) {
      console.error("Recap generation failed:", recapErr)
    }

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
      const baseUrl = appBaseUrl()
      const title = `${game.homeTeam.name} ${folded.homeScore} — ${folded.awayScore} ${game.awayTeam.name}`
      const signedName = verifiedRefereeName ?? refereeName
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
              ${signedName ? `<p>Referee: <strong>${signedName}</strong>${verifiedRefereeName ? " (PIN-verified)" : ""}</p>` : ""}
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

    // Bell the FULL team audience (both clubs' staff + rostered parents) with
    // the final score — before this, finals only reached front offices by
    // email and families never heard the result. First finalize only:
    // `game.status` is the pre-update row, so COMPLETED here means this was a
    // re-finalize correction and every family was already pinged. Bell only,
    // no family email (volume decision). Best-effort — never blocks the whistle.
    if (game.status !== "COMPLETED") {
      try {
        const audienceUserIds = await getGameAudienceUserIds(game.homeTeamId, game.awayTeamId)
        await notifyMany(prisma, audienceUserIds, {
          type: "game_final",
          title: "Final Score",
          message: `Final: ${game.homeTeam.name} ${folded.homeScore} — ${folded.awayScore} ${game.awayTeam.name}`,
          link: `/live/${game.id}`,
          referenceId: game.id,
          referenceType: "Game",
        })
      } catch (bellErr) {
        console.error("Final-score bell fanout failed:", bellErr)
      }
    }

    // Realtime ping — the game page and scoreboards flip to FINAL instantly
    await publishRealtime({
      rooms: [
        rt.game(game.id),
        rt.scores,
        ...(game.season?.leagueId ? [rt.leagueScores(game.season.leagueId)] : []),
      ],
      event: "game.update",
      payload: {
        gameId: game.id,
        status: "COMPLETED",
        homeScore: folded.homeScore,
        awayScore: folded.awayScore,
      },
    })

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
