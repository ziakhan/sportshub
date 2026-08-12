import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { sendRosterReminders } from "@/lib/rosters/reminders"

export const dynamic = "force-dynamic"

/**
 * Daily: chase league rosters toward the season's roster deadline (owner
 * ruling 2026-08-11, QA T-017) — T-30 email, T-14 +bell, T-7 +push and the
 * league operator's digest, T-24h urgent, day-after overdue with the club
 * leadership added. Self-healing and send-once (RosterReminder ledger).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await sendRosterReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("roster-reminders cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
