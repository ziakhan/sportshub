import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { loadSeasonCalendarCard, renderSeasonCalendarCard } from "@/lib/cards/season-calendar-card"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/planner/card — the season calendar as a shareable
 * PNG (1200×630).
 *
 * Two audiences, one image. Once the plan is published the card is public
 * like every other share card: Instagram, Slack and mail clients all fetch
 * it with no session, so it must answer anonymously or it is not shareable.
 * BEFORE publish it is nobody's business but the operator's, so an
 * unpublished season 404s for everyone except the league owner or a platform
 * admin — who need it because the wizard shows them the real card before
 * they commit to it.
 *
 * Caching follows the split: the published card is CDN-cacheable like
 * /api/live/[gameId]/card; the operator's preview is never cached, because
 * they are watching it change as they edit the calendar.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    const isOperator = gate.status === 200
    if (gate.status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!isOperator) {
      const season = await (prisma as any).season.findUnique({
        where: { id: params.id },
        select: { planPublishedAt: true },
      })
      // Unpublished is indistinguishable from non-existent to the public.
      if (!season?.planPublishedAt) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }

    const data = await loadSeasonCalendarCard(params.id)
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const res = renderSeasonCalendarCard(data)
    res.headers.set(
      "Cache-Control",
      isOperator ? "private, no-store" : "public, s-maxage=300, stale-while-revalidate=3600"
    )
    return res
  } catch (error) {
    console.error("Season calendar card render error:", error)
    return NextResponse.json({ error: "Card render failed" }, { status: 500 })
  }
}
