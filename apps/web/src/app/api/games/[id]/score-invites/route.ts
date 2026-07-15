import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canScoreGame } from "@/lib/scoring/authz"
import { hashScoreToken, newScoreToken } from "@/lib/scoring/guest"

export const dynamic = "force-dynamic"

async function authorize(gameId: string) {
  const auth = await getSessionUserId()
  if (!auth) return { error: "Unauthorized", status: 401 as const }
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, homeTeamId: true, awayTeamId: true, seasonId: true, scheduledAt: true, duration: true },
  })
  if (!game) return { error: "Game not found", status: 404 as const }
  if (!(await canScoreGame(auth.userId, !!auth.isPlatformAdmin, game))) {
    return { error: "Forbidden", status: 403 as const }
  }
  return { auth, game }
}

/**
 * POST /api/games/[id]/score-invites — mint a fresh guest-scorekeeper link
 * (revokes any previous active invite: regenerate = old link dies). Anyone
 * who can score the game can hand it off. Expires 4h after the scheduled
 * game end.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authz = await authorize(params.id)
    if ("error" in authz) return NextResponse.json({ error: authz.error }, { status: authz.status })
    const { auth, game } = authz

    await (prisma as any).gameScoreInvite.updateMany({
      where: { gameId: game.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    const raw = newScoreToken()
    const gameEnd = new Date(game.scheduledAt).getTime() + (game.duration ?? 90) * 60_000
    const expiresAt = new Date(Math.max(gameEnd + 4 * 3600_000, Date.now() + 4 * 3600_000))
    await (prisma as any).gameScoreInvite.create({
      data: {
        gameId: game.id,
        tokenHash: hashScoreToken(raw),
        createdById: auth.userId,
        expiresAt,
      },
    })

    return NextResponse.json(
      { token: raw, path: `/score-guest/${raw}`, expiresAt },
      { status: 201 }
    )
  } catch (error) {
    console.error("Score invite create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/games/[id]/score-invites — revoke the active invite. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authz = await authorize(params.id)
    if ("error" in authz) return NextResponse.json({ error: authz.error }, { status: authz.status })
    await (prisma as any).gameScoreInvite.updateMany({
      where: { gameId: params.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Score invite revoke error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** GET /api/games/[id]/score-invites — active invite status (no token). */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authz = await authorize(params.id)
    if ("error" in authz) return NextResponse.json({ error: authz.error }, { status: authz.status })
    const invite = await (prisma as any).gameScoreInvite.findFirst({
      where: { gameId: params.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true, claimedAt: true, claimedName: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ invite })
  } catch (error) {
    console.error("Score invite status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
