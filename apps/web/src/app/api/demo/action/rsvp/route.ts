import { NextResponse } from "next/server"
import { readDemoView } from "@/lib/demo/persona-session"
import { recordDemoAction, rsvpOverlay } from "@/lib/demo/session-overlay"

export const dynamic = "force-dynamic"

const STATUSES = ["GOING", "MAYBE", "DECLINED"] as const

/** Whitelisted demo action: RSVP to a demo event, session-scoped. */
export async function POST(req: Request) {
  const view = readDemoView()
  if (!view) return NextResponse.json({ error: "Not in the demo." }, { status: 401 })

  const body = await req.json().catch(() => null)
  const targetId = typeof body?.targetId === "string" ? body.targetId : null
  const status = STATUSES.includes(body?.status) ? body.status : null
  if (!targetId || !status) {
    return NextResponse.json({ error: "targetId and a valid status are required." }, { status: 400 })
  }

  await recordDemoAction(view.s, "RSVP", targetId, { status })
  return NextResponse.json({ ok: true, status })
}

export async function GET(req: Request) {
  const view = readDemoView()
  if (!view) return NextResponse.json({ error: "Not in the demo." }, { status: 401 })

  const targetId = new URL(req.url).searchParams.get("targetId")
  if (!targetId) return NextResponse.json({ error: "targetId is required." }, { status: 400 })

  const row = await rsvpOverlay(view.s, targetId)
  return NextResponse.json({ status: (row?.payload as any)?.status ?? null })
}
