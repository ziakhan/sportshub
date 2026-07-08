import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { sendDueReminders } from "@/lib/payments/scheduled"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/payment-reminders — daily (Vercel Cron). Sends our branded
 * pre-due reminder (bell + email) for installments coming up within each
 * club's reminderLeadDays. Secured by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await sendDueReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("payment-reminders cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
