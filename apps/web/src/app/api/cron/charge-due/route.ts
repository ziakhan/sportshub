import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { chargeDueInstallments } from "@/lib/payments/scheduled"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/charge-due — daily (Vercel Cron). Finalizes each installment
 * invoice due today; Stripe then charges the saved card and runs Smart
 * Retries + dunning. Secured by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await chargeDueInstallments()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("charge-due cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
