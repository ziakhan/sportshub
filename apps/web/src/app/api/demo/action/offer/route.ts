import { NextResponse } from "next/server"
import { readDemoView } from "@/lib/demo/persona-session"
import { acceptOfferOverlay } from "@/lib/demo/session-overlay"

export const dynamic = "force-dynamic"

/**
 * Whitelisted demo action: accept the staged offer. Session-scoped — the
 * visitor sees their kid "on the roster" and a welcome message; nothing
 * touches the real offer row.
 */
export async function POST(req: Request) {
  const view = readDemoView()
  if (!view) return NextResponse.json({ error: "Not in the demo." }, { status: 401 })

  const body = await req.json().catch(() => null)
  const targetId = typeof body?.targetId === "string" ? body.targetId : null
  if (!targetId) return NextResponse.json({ error: "targetId is required." }, { status: 400 })

  const result = await acceptOfferOverlay(view.s, targetId)
  return NextResponse.json(result)
}
