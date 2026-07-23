import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getSocialFeed } from "@/lib/queries/feed"

export const dynamic = "force-dynamic"

/**
 * GET /api/feed — the personalized social feed as JSON (native-parity-v2
 * P1: the app renders the SAME items the web /feed page gets, from the same
 * query function, so the two can never disagree). Bearer or session auth.
 */
export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const items = await getSocialFeed(session.userId)
  return NextResponse.json({ items })
}
