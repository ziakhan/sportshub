import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getFeedExtras, getFeedTargets, getSocialFeed } from "@/lib/queries/feed"

export const dynamic = "force-dynamic"

/**
 * GET /api/feed — the personalized social feed as JSON (native-parity-v2
 * P1: the app renders the SAME items the web /feed page gets, from the same
 * query function, so the two can never disagree). Bearer or session auth.
 *
 * `extras` (business-model-v2 §16 S1: digest/preview virtual cards) is a
 * SEPARATE, purely-additive field — old clients that only read `items`
 * never see it, so a not-yet-updated bundle degrades gracefully instead of
 * crashing on a Post-shaped assumption a virtual card can't satisfy.
 */
export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const targets = await getFeedTargets(session.userId)
  const [items, extras] = await Promise.all([
    getSocialFeed(session.userId, 30, targets),
    getFeedExtras(session.userId, targets),
  ])
  return NextResponse.json({ items, extras })
}
