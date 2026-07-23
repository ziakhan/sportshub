import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { loadCardData, loadShareOverrides, parseTemplate, renderCard, renderScoreCard } from "@/lib/cards/game-card"

export const dynamic = "force-dynamic"

/**
 * GET /api/live/[gameId]/card — the Player of the Game card (landscape
 * 1200×630). Public like the rest of /api/live (OG scrapers and share
 * targets fetch anonymously); names/photos are consent-gated inside
 * loadCardData. 404 until the game is COMPLETED with a POTG awarded.
 */
export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    // ?variant=score → the score-only card (no POTG required)
    if (request.nextUrl.searchParams.get("variant") === "score") {
      const score = await renderScoreCard(
        params.gameId,
        parseTemplate(request.nextUrl.searchParams.get("template")),
        request.nextUrl.searchParams.get("aspect") === "portrait"
      )
      if (!score) return NextResponse.json({ error: "Not available" }, { status: 404 })
      score.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600")
      return score
    }

    const game = await (prisma as any).game.findUnique({
      where: { id: params.gameId },
      select: { potgPlayerId: true },
    })
    if (!game?.potgPlayerId) {
      return NextResponse.json({ error: "No Player of the Game" }, { status: 404 })
    }
    const data = await loadCardData(params.gameId, game.potgPlayerId, "Player of the Game")
    if (!data) return NextResponse.json({ error: "Not available" }, { status: 404 })

    const overrides = await loadShareOverrides(request.nextUrl.searchParams.get("src"))
    if (overrides.customPhotoUrl) data.photoUrl = overrides.customPhotoUrl
    const res = renderCard(
      data,
      overrides.templateId ?? parseTemplate(request.nextUrl.searchParams.get("template")),
      request.nextUrl.searchParams.get("aspect") === "portrait"
    )
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600")
    return res
  } catch (error) {
    console.error("POTG card render error:", error)
    return NextResponse.json({ error: "Card render failed" }, { status: 500 })
  }
}
