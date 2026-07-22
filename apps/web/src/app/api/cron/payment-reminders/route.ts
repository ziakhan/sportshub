import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { sendDueReminders, sendOverdueReminders } from "@/lib/payments/scheduled"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/payment-reminders — daily (Vercel Cron / box cron.d).
 * Sends our branded pre-due reminder (bell + email) for installments coming
 * up within each club's reminderLeadDays, PLUS overdue nagging every
 * OVERDUE_NAG_DAYS for anything unpaid past its due date. CRON_SECRET-gated.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const upcoming = await sendDueReminders()
    const overdue = await sendOverdueReminders()
    return NextResponse.json({ ok: true, ...upcoming, ...overdue })
  } catch (error) {
    console.error("payment-reminders cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
