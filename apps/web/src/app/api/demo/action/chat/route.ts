import { NextResponse } from "next/server"
import { readDemoView } from "@/lib/demo/persona-session"
import { chatOverlay, recordDemoAction } from "@/lib/demo/session-overlay"

export const dynamic = "force-dynamic"

/**
 * Whitelisted demo action: send a message in a demo team chat. Writes go
 * to the session overlay only; the ghost coach replies on the next fetch.
 */
export async function POST(req: Request) {
  const view = readDemoView()
  if (!view) return NextResponse.json({ error: "Not in the demo." }, { status: 401 })

  const body = await req.json().catch(() => null)
  const targetId = typeof body?.targetId === "string" ? body.targetId : null
  const text = typeof body?.text === "string" ? body.text.slice(0, 500).trim() : ""
  if (!targetId || !text) {
    return NextResponse.json({ error: "targetId and text are required." }, { status: 400 })
  }

  const action = await recordDemoAction(view.s, "CHAT_MESSAGE", targetId, { text })
  return NextResponse.json({ ok: true, id: action.id })
}

/** The visitor's overlay for one chat thread (messages + ghost replies). */
export async function GET(req: Request) {
  const view = readDemoView()
  if (!view) return NextResponse.json({ error: "Not in the demo." }, { status: 401 })

  const targetId = new URL(req.url).searchParams.get("targetId")
  if (!targetId) return NextResponse.json({ error: "targetId is required." }, { status: 400 })

  const rows = await chatOverlay(view.s, targetId)
  return NextResponse.json({
    messages: rows.map((r: any) => ({
      id: r.id,
      kind: r.type === "GHOST_REPLY" ? "coach" : "you",
      text: (r.payload as any)?.text ?? "",
      at: r.createdAt,
    })),
  })
}
