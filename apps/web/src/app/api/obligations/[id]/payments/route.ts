import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { ObligationError, recordOfflinePayment } from "@/lib/payments/obligations"
import { merchantAccess } from "@/lib/payments/authz"
import { getPaymentConfig, offlineAvailable } from "@/lib/payments/config"
import { assertPaymentsEnabled, PaymentsDisabledError } from "@/lib/payments/kill-switch"
import { auditSafe } from "@/lib/audit"
import { actorRoleAtTenant } from "@/lib/authz/team-scope"

export const dynamic = "force-dynamic"

const recordSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "ETRANSFER", "CHEQUE", "OTHER"]),
  note: z.string().max(500).optional(),
})

/**
 * Record an offline payment against an obligation — "they paid at the door".
 * POST /api/obligations/[id]/payments  { amount, method, note? }
 * Merchant-side only (payee club roles / platform admin).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    // Universal kill switch (owner 2026-08-21): the switch is universal, so
    // while payments are paused even offline cash bookkeeping is refused —
    // remove this one line to let clubs keep recording already-owed cash.
    await assertPaymentsEnabled()

    const obligation = await prisma.paymentObligation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        payeeTenantId: true,
        payeeLeagueId: true,
        payeeLeague: { select: { ownerId: true } },
      },
    })
    if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 })

    if (!(await merchantAccess(userId, obligation))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = recordSchema.parse(await request.json())

    // Policy gate: the platform (or the club itself) may have turned offline
    // collection off — then every payment must go through the online rail.
    const config = obligation.payeeTenantId
      ? await getPaymentConfig({ tenantId: obligation.payeeTenantId })
      : obligation.payeeLeagueId
        ? await getPaymentConfig({ leagueId: obligation.payeeLeagueId })
        : null
    if (config && !offlineAvailable(config)) {
      return NextResponse.json(
        {
          error: "Offline payments are turned off for this organization — payments must be made online",
          code: "OFFLINE_NOT_AVAILABLE",
        },
        { status: 400 }
      )
    }
    if (config && !config.offlineMethods.includes(data.method)) {
      return NextResponse.json(
        { error: `${data.method} is not an accepted payment method here`, code: "METHOD_NOT_ALLOWED" },
        { status: 400 }
      )
    }

    const payment = await prisma.$transaction((tx: any) =>
      recordOfflinePayment(tx, {
        obligationId: params.id,
        amount: data.amount,
        method: data.method,
        recordedById: userId,
        note: data.note,
      })
    )

    // Audit the money movement (M1): who recorded what cash, when.
    await auditSafe({
      actorId: userId,
      actorRole: sessionInfo.isPlatformAdmin
        ? "PlatformAdmin"
        : obligation.payeeTenantId
          ? await actorRoleAtTenant(userId, obligation.payeeTenantId)
          : "LeagueManager",
      action: "OFFLINE_PAYMENT_RECORD",
      resource: "Payment",
      resourceId: payment.id,
      tenantId: obligation.payeeTenantId,
      metadata: { amount: data.amount, method: data.method, obligationId: params.id },
      request,
    })

    return NextResponse.json(
      { success: true, id: payment.id, status: payment.status },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof PaymentsDisabledError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error instanceof ObligationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("Record offline payment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
