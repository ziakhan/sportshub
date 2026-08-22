import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { ensureSessionForEvent } from "@/lib/evaluation/session"

export const dynamic = "force-dynamic"

/**
 * Turning evaluation on for a tryout event. Default OFF, so nothing changes
 * for a club that only ever wanted attendance, which is all that existed
 * before (owner 2026-08-21).
 */
const bodySchema = z.object({ eventId: z.string() })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isClubAdmin(auth.userId, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "eventId required" }, { status: 400 })

  const session = await ensureSessionForEvent(parsed.data.eventId)
  if (!session) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  return NextResponse.json({ sessionId: session.id, status: session.status })
}
