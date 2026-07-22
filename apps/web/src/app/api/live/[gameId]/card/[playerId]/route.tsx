import { NextRequest, NextResponse } from "next/server"
import { loadCardData, loadShareOverrides, parseTemplate, renderCard } from "@/lib/cards/game-card"

export const dynamic = "force-dynamic"

/**
 * GET /api/live/[gameId]/card/[playerId] — a player's stat-line card for one
 * game (landscape 1200×630). Public GET like the rest of /api/live; the name
 * is consent-gated (full name only with mediaConsent GRANTED) and the card
 * 404s unless the player actually has a stat line in this completed game.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string; playerId: string } }
) {
  try {
    const data = await loadCardData(params.gameId, params.playerId, "Game Stats")
    if (!data) return NextResponse.json({ error: "Not available" }, { status: 404 })

    const overrides = await loadShareOverrides(request.nextUrl.searchParams.get("src"))
    if (overrides.customPhotoUrl) data.photoUrl = overrides.customPhotoUrl
    const res = renderCard(
      data,
      overrides.templateId ?? parseTemplate(request.nextUrl.searchParams.get("template"))
    )
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600")
    return res
  } catch (error) {
    console.error("Stat card render error:", error)
    return NextResponse.json({ error: "Card render failed" }, { status: 500 })
  }
}
