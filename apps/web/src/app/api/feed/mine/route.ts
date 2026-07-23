import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getMyPosts } from "@/lib/queries/feed"

export const dynamic = "force-dynamic"

/** GET /api/feed/mine — the user's own posts + reposts (native My posts). */
export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const items = await getMyPosts(session.userId)
  return NextResponse.json({ items })
}
