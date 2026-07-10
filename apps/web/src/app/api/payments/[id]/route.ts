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
import { notify } from "@/lib/notifications"
import { appBaseUrl, escapeHtml, formatMoney, sendEmail, transactionalFooter } from "@/lib/email"

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
        currency: true,
        description: true,
        payerId: true,
        refundedAt: true,
        obligationId: true,
        stripePaymentIntentId: true,
        stripeAccountId: true,
        stripeDestinationAccountId: true,
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
          // Destination charges (PLATFORM_COLLECT): pull the club's share
          // back from their account and return our fee, proportionally —
          // otherwise the platform balance eats the whole refund.
          ...(payment.stripeDestinationAccountId
            ? { reverse_transfer: true, refund_application_fee: true }
            : {}),
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

      // Payer notice — best-effort, the refund already succeeded. The
      // charge.refunded webhook skips its own notice when refundAmount is
      // already recorded, so this doesn't double-send.
      if (payment.payerId) {
        const money = formatMoney(amount, payment.currency)
        try {
          await notify(prisma, {
            userId: payment.payerId,
            type: "payment_refunded",
            title: "Payment refunded",
            message: `${payment.description ?? "Payment"} — ${money} refunded to your card.`,
            link: "/payments",
            referenceId: payment.id,
            referenceType: "Payment",
          })
        } catch (e) {
          console.error("refund bell notification failed:", e)
        }
        try {
          const orgId = payment.tenantId ?? payment.obligation?.payeeTenantId ?? null
          const [payer, tenant] = await Promise.all([
            prisma.user.findUnique({
              where: { id: payment.payerId },
              select: { email: true },
            }),
            orgId
              ? prisma.tenant.findUnique({ where: { id: orgId }, select: { name: true } })
              : Promise.resolve(null),
          ])
          if (payer?.email) {
            await sendEmail({
              to: payer.email,
              subject: `Refund issued — ${money}${tenant?.name ? ` from ${tenant.name}` : ""}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Refund issued</h2>
                  <p>${tenant?.name ? `<strong>${escapeHtml(tenant.name)}</strong>` : "The organization"} refunded <strong>${money}</strong>${payment.description ? ` for ${escapeHtml(payment.description)}` : ""} to your original payment method. It can take 5&ndash;10 business days to appear on your statement.</p>
                  <p><a href="${appBaseUrl()}/payments">View your payments</a></p>
                  ${transactionalFooter(tenant?.name)}
                </div>`,
            })
          }
        } catch (e) {
          console.error("refund email failed:", e)
        }
      }

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
