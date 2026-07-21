import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { merchantAccess } from "@/lib/payments/authz"
import { isClubAdmin } from "@/lib/authz/team-scope"

export const dynamic = "force-dynamic"

/**
 * List payment obligations.
 * GET /api/obligations?tenantId=x [&status=PENDING] — club side (what's owed to us)
 * GET /api/obligations?leagueId=x [&status=…]       — league side (team fees owed to us)
 * GET /api/obligations?mine=true                    — payer side (what I owe)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get("tenantId")
    const leagueId = searchParams.get("leagueId")
    const mine = searchParams.get("mine") === "true"
    const status = searchParams.get("status")

    if (tenantId) {
      // Security fix 2026-07-20: club money is admin-only. This returns EVERY
      // family's amounts owed, payer identities, and payment history across
      // all teams — Staff (coaches) previously read the whole club here.
      if (!(await isClubAdmin(userId, tenantId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const obligations = await prisma.paymentObligation.findMany({
        where: { payeeTenantId: tenantId, ...(status ? { status: status as any } : {}) },
        include: {
          payerUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          payments: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ obligations: obligations.map(simplify) })
    }

    if (leagueId) {
      const league = await prisma.league.findUnique({
        where: { id: leagueId },
        select: { ownerId: true },
      })
      if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 })
      const ok = await merchantAccess(userId, {
        payeeTenantId: null,
        payeeLeagueId: leagueId,
        payeeLeague: league,
      })
      if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      const obligations = await prisma.paymentObligation.findMany({
        where: { payeeLeagueId: leagueId, ...(status ? { status: status as any } : {}) },
        include: {
          payerTenant: { select: { id: true, name: true } },
          payments: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ obligations: obligations.map(simplify) })
    }

    if (mine) {
      const obligations = await prisma.paymentObligation.findMany({
        where: { payerUserId: userId, ...(status ? { status: status as any } : {}) },
        include: {
          payeeTenant: { select: { id: true, name: true } },
          payeeLeague: { select: { id: true, name: true } },
          payments: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ obligations: obligations.map(simplify) })
    }

    return NextResponse.json(
      { error: "Either tenantId, leagueId, or mine=true parameter is required" },
      { status: 400 }
    )
  } catch (error) {
    console.error("List obligations error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Decimal → number everywhere money reaches JSON
function simplify(o: any) {
  return {
    ...o,
    amount: Number(o.amount),
    payments: (o.payments ?? []).map((p: any) => ({
      ...p,
      amount: Number(p.amount),
      platformFee: p.platformFee === null ? null : Number(p.platformFee),
      refundAmount: p.refundAmount === null ? null : Number(p.refundAmount),
    })),
  }
}
