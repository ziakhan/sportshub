import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { sendRsvpReminders } from "@/lib/rsvp"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/rsvp-reminders — daily (Vercel Cron). Nudges families who
 * haven't answered Going/Not going for a practice, game, or team event in
 * the next 3 days (bell + push; one reminder per parent per item).
 * Secured by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await sendRsvpReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("rsvp-reminders cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
