import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { renderMatchupCover } from "@/lib/cards/game-card"

export const dynamic = "force-dynamic"

/**
 * GET /api/live/[gameId]/cover — the news/editorial matchup cover as PNG
 * (owner 2026-07-25: news must show the WEB's cover art, not the share
 * card; RN can't draw the SVG original, so this is its satori twin).
 */
export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const cover = await renderMatchupCover(params.gameId)
    if (!cover) return NextResponse.json({ error: "Not available" }, { status: 404 })
    cover.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600")
    return cover
  } catch (error) {
    console.error("Cover render error:", error)
    return NextResponse.json({ error: "Cover render failed" }, { status: 500 })
  }
}
