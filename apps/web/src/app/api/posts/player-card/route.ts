import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { checkCardShare, shareCardSchema } from "@/lib/social/share-card"
import { screenCustomPhoto } from "@/lib/social/photo-screen"
import { publicPlayerName } from "@/lib/privacy/names"

export const dynamic = "force-dynamic"

/**
 * POST /api/posts/player-card — share a player's card as a PERMANENT profile
 * post (social-feed-plan P4, Instagram-style). No text input: title/body are
 * generated from game data, like recaps. One post per (player, game, card):
 * re-sharing updates it in place (slug upsert).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const input = shareCardSchema.parse(await request.json())
    const check = await checkCardShare(sessionInfo.userId, input)
    if (!check.ok) {
      return NextResponse.json({ error: check.error, code: check.code }, { status: check.httpStatus })
    }

    const photoScreenState = input.customPhotoUrl
      ? await screenCustomPhoto(input.customPhotoUrl)
      : null
    if (photoScreenState === "REJECTED") {
      return NextResponse.json(
        { error: "That photo can't be used on a card", code: "PHOTO_REJECTED" },
        { status: 400 }
      )
    }

    const [game, stat, player] = await Promise.all([
      (prisma as any).game.findUnique({
        where: { id: input.gameId },
        select: {
          scheduledAt: true,
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      }),
      (prisma as any).playerStat.findUnique({
        where: { gameId_playerId: { gameId: input.gameId, playerId: input.playerId } },
        select: { points: true, rebounds: true, assists: true },
      }),
      (prisma as any).player.findUnique({
        where: { id: input.playerId },
        select: { firstName: true, lastName: true, mediaConsent: true },
      }),
    ])

    // Public-safe name baked at creation, same rule as AI recaps
    const name = publicPlayerName(player)
    const matchup = `${game.homeTeam.name} ${game.homeScore ?? 0}–${game.awayScore ?? 0} ${game.awayTeam.name}`
    const dateLabel = new Date(game.scheduledAt).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    const title =
      input.cardType === "POTG"
        ? `${name}: Player of the Game`
        : `${name}: ${stat?.points ?? 0} points vs ${game.awayTeam.name}`
    const body = `${stat ? `${stat.points} PTS · ${stat.rebounds} REB · ${stat.assists} AST. ` : ""}${matchup}, ${dateLabel}.`
    const slug = `card-${input.cardType.toLowerCase().replace("_", "-")}-${input.gameId.slice(0, 8)}-${input.playerId.slice(0, 8)}`

    const data = {
      kind: input.cardType === "POTG" ? "PLAYER_OF_GAME" : "STAT_CARD",
      title,
      body,
      status: "PUBLISHED",
      publishedAt: new Date(),
      authorId: sessionInfo.userId,
      visibility: check.visibility,
      templateId: input.templateId ?? null,
      customPhotoUrl: input.customPhotoUrl ?? null,
      photoScreenState,
    }
    const post = await (prisma as any).post.upsert({
      where: { slug },
      create: {
        slug,
        ...data,
        tags: { create: [{ playerId: input.playerId }, { gameId: input.gameId }] },
      },
      update: data,
      select: { id: true, slug: true, visibility: true },
    })

    return NextResponse.json({ post })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Player-card post error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
