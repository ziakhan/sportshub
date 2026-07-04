import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { ObligationError, refundOfflinePayment } from "@/lib/payments/obligations"

export const dynamic = "force-dynamic"

const actionSchema = z.object({
  action: z.literal("refund"),
  amount: z.number().positive().optional(), // defaults to the full payment
})

/**
 * Refund a recorded offline payment (bookkeeping of money handed back).
 * PATCH /api/payments/[id]  { action: "refund", amount? }
 * Stripe payments refund through Stripe in stage 2 — this rejects them.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true },
    })
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [
          ...(payment.tenantId
            ? [{ tenantId: payment.tenantId, role: { in: ["ClubOwner", "ClubManager"] as any } }]
            : []),
          { role: "PlatformAdmin" as any },
        ],
      },
    })
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const data = actionSchema.parse(await request.json())

    const updated = await prisma.$transaction((tx: any) =>
      refundOfflinePayment(tx, {
        paymentId: params.id,
        amount: data.amount,
        recordedById: userId,
      })
    )

    return NextResponse.json({
      status: updated.status,
      refundAmount: Number(updated.refundAmount),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error instanceof ObligationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("Refund payment error:", error)
    return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 })
  }
}
