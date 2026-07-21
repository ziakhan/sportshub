import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { sendWaiverReminders } from "@/lib/waivers/reminders"

export const dynamic = "force-dynamic"

/**
 * Daily: bell + push + email signing links to parents whose players still have
 * unsigned required league waivers, 7 days and 24 hours before the season
 * starts (owner 2026-07-20).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await sendWaiverReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("waiver-reminders cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
