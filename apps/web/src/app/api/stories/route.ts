import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { checkCardShare, shareCardSchema } from "@/lib/social/share-card"
import { screenCustomPhoto } from "@/lib/social/photo-screen"

export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * POST /api/stories — share a player's card to their 24h story
 * (social-feed-plan P4). One story per (player, game, cardType): re-sharing
 * refreshes the clock and settings instead of duplicating. Rows are kept
 * after expiry for the family Moments archive.
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

    const data = {
      visibility: check.visibility,
      templateId: input.templateId ?? null,
      customPhotoUrl: input.customPhotoUrl ?? null,
      photoScreenState,
      createdByUserId: sessionInfo.userId,
      expiresAt: new Date(Date.now() + DAY_MS),
    }
    const story = await (prisma as any).story.upsert({
      where: {
        playerId_gameId_cardType: {
          playerId: input.playerId,
          gameId: input.gameId,
          cardType: input.cardType,
        },
      },
      create: {
        playerId: input.playerId,
        gameId: input.gameId,
        cardType: input.cardType,
        ...data,
      },
      update: { ...data, createdAt: new Date() },
      select: { id: true, visibility: true, expiresAt: true },
    })

    return NextResponse.json({ story })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Story create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
