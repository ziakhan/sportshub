import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/expire-offers — daily (Vercel Cron). Flips stale PENDING
 * offers past their expiresAt to EXPIRED.
 *
 * Expiry was previously only enforced lazily (when the family touched the
 * offer, or in bulk at team finalize), so rows sat PENDING indefinitely and
 * club dashboards under-counted expired offers (editability audit §2b/§4).
 * The lazy checks stay as belt-and-braces; this cron is the actual enforcer.
 * Secured by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await (prisma as any).offer.updateMany({
      where: { status: "PENDING", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    })
    return NextResponse.json({ ok: true, expired: result.count })
  } catch (error) {
    console.error("expire-offers cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
