import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getNavShape } from "@/lib/queries/nav-shape"
import { getMyContexts } from "@/lib/queries/my-contexts"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/home — one round trip powering the native app's Home tab
 * and tab bar (N3-v2 parity): the light nav shape (which tabs exist for this
 * role) plus the personal band (getMyContexts — same resolver as the web
 * home, so the two surfaces can never disagree). Bearer or session auth.
 */
export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [shape, contexts] = await Promise.all([
    getNavShape(session.userId),
    getMyContexts(session.userId),
  ])
  return NextResponse.json({ shape, contexts })
}
