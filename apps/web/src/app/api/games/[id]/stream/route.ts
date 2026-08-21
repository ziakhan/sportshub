import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getGameStreamForViewer } from "@/lib/queries/game-stream"

export const dynamic = "force-dynamic"

/**
 * GET /api/games/[id]/stream — the playback state for THIS viewer.
 *
 * Served from the shared query module (parity law): the web game page, the
 * native player and this endpoint cannot disagree about whether a game is
 * watchable. The response is one of four states and never carries a reason —
 * "none" covers no camera, no league opt-in, a disabled channel and a viewer
 * outside the policy alike, because a viewer who may not watch should not be
 * able to learn that a stream exists.
 *
 * The session is resolved but NOT required: the gate is STREAM_VIEWER_POLICY
 * in the query module, not this handler. Today that policy is SIGNED_IN, so
 * an anonymous caller gets "none" — and note that /api/games is not an
 * anonymous-read namespace in lib/public-paths.ts, so the middleware answers
 * first. Opening playback to the public means changing BOTH: the policy
 * constant and that allowlist.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUserId()
    const state = await getGameStreamForViewer(params.id, {
      userId: session?.userId ?? null,
      isPlatformAdmin: session?.isPlatformAdmin ?? false,
    })
    return NextResponse.json(state)
  } catch (error) {
    console.error("Game stream read error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
