import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { findValidInvite } from "@/lib/scoring/guest"

export const dynamic = "force-dynamic"

/** GET /api/score-invites/[token] — public: what game does this link score? */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const invite = await findValidInvite(params.token)
    if (!invite) {
      return NextResponse.json({ error: "This link is no longer valid" }, { status: 404 })
    }
    const game = await prisma.game.findUnique({
      where: { id: invite.gameId },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        venue: { select: { name: true } },
      },
    })
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
    return NextResponse.json({
      game: {
        id: game.id,
        scheduledAt: game.scheduledAt,
        status: game.status,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        venue: game.venue?.name ?? null,
      },
      claimed: !!invite.claimedAt,
      claimedName: invite.claimedName,
    })
  } catch (error) {
    console.error("Score invite info error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const claimSchema = z.object({ name: z.string().trim().min(2).max(80) })

/**
 * POST /api/score-invites/[token] { name } — the volunteer claims the link;
 * their name is stamped on the invite (audit trail). Re-claiming with the
 * same token just updates the name (same phone re-opening the link).
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const invite = await findValidInvite(params.token)
    if (!invite) {
      return NextResponse.json({ error: "This link is no longer valid" }, { status: 404 })
    }
    const parsed = claimSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Tell us your name (2+ characters)" }, { status: 400 })
    }
    await (prisma as any).gameScoreInvite.update({
      where: { id: invite.id },
      data: { claimedAt: invite.claimedAt ?? new Date(), claimedName: parsed.data.name },
    })
    return NextResponse.json({ success: true, gameId: invite.gameId })
  } catch (error) {
    console.error("Score invite claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
