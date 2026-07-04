import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import {
  ObligationError,
  recomputeObligationStatus,
  refundOfflinePayment,
} from "@/lib/payments/obligations"
import { merchantAccess } from "@/lib/payments/authz"
import { getStripe, StripeNotConfiguredError } from "@/lib/payments/stripe"

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
      select: {
        id: true,
        tenantId: true,
        method: true,
        status: true,
        amount: true,
        refundedAt: true,
        obligationId: true,
        stripePaymentIntentId: true,
        stripeAccountId: true,
        obligation: {
          select: {
            payeeTenantId: true,
            payeeLeagueId: true,
            payeeLeague: { select: { ownerId: true } },
          },
        },
      },
    })
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    const scope = payment.obligation ?? {
      payeeTenantId: payment.tenantId,
      payeeLeagueId: null,
      payeeLeague: null,
    }
    if (!(await merchantAccess(userId, scope, { tenantRoles: ["ClubOwner", "ClubManager"] }))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = actionSchema.parse(await request.json())

    // Online payments refund through Stripe; the webhook confirms, but we
    // also apply the result optimistically so dev without a webhook works.
    if (payment.method === "STRIPE") {
      if (payment.status !== "SUCCEEDED" || payment.refundedAt) {
        return NextResponse.json(
          { error: "Payment is not refundable", code: "ALREADY_REFUNDED" },
          { status: 400 }
        )
      }
      const amount = data.amount ?? Number(payment.amount)
      if (amount <= 0 || amount > Number(payment.amount)) {
        return NextResponse.json(
          { error: "Refund amount out of range", code: "INVALID_AMOUNT" },
          { status: 400 }
        )
      }
      const stripe = getStripe()
      await stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId!,
          amount: Math.round(amount * 100),
        },
        payment.stripeAccountId ? ({ stripeAccount: payment.stripeAccountId } as any) : undefined
      )
      const fully = amount >= Number(payment.amount)
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundAmount: amount,
          refundedAt: new Date(),
          status: fully ? "REFUNDED" : "SUCCEEDED",
        },
      })
      if (payment.obligationId) await recomputeObligationStatus(prisma, payment.obligationId)
      return NextResponse.json({
        status: updated.status,
        refundAmount: Number(updated.refundAmount),
      })
    }

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
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error("Refund payment error:", error)
    return NextResponse.json({ error: "Failed to refund payment" }, { status: 500 })
  }
}
