import { NextRequest, NextResponse } from "next/server"
import { loadTryoutEventCard, renderTryoutEventCard } from "@/lib/cards/tryout-event-card"

export const dynamic = "force-dynamic"

/**
 * GET /api/tryout-events/[eventId]/card — the tryout event as a 1080×1350
 * Instagram announcement PNG.
 *
 * Anonymous by design: Instagram, mail clients and every share sheet fetch it
 * with no session, so it must answer without one or it is not shareable. What
 * keeps that safe is the source — loadTryoutEventCard() reads only
 * getTryoutEventPublic(), the same module the public page reads, which returns
 * published events of publicly visible clubs and nothing operational. An
 * unpublished event is simply not found, exactly as it is on the web page.
 *
 * Cached like the other public share cards.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const event = await loadTryoutEventCard(params.eventId)
    if (!event || event.sessions.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const res = renderTryoutEventCard(event)
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600")
    return res
  } catch (error) {
    console.error("Tryout event card render error:", error)
    return NextResponse.json({ error: "Card render failed" }, { status: 500 })
  }
}
