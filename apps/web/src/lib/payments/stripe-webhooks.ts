import { prisma } from "@youthbasketballhub/db"
import { recomputeObligationStatus } from "@/lib/payments/obligations"

/**
 * Stripe event processing — kept separate from the HTTP route so tests can
 * feed events directly. Every handler is idempotent: webhooks retry, events
 * arrive out of order, and the same event can be delivered twice.
 *
 * Payment truth flows one way: Stripe event → Payment row → obligation
 * recompute (the same engine the cash flow uses).
 */

export interface HandledResult {
  handled: boolean
  detail?: string
}

export async function handleStripeEvent(event: {
  type: string
  account?: string
  data: { object: any }
}): Promise<HandledResult> {
  switch (event.type) {
    case "payment_intent.succeeded":
      return onPaymentIntentSucceeded(event.data.object)
    case "payment_intent.payment_failed":
      return onPaymentIntentFailed(event.data.object)
    case "charge.refunded":
      return onChargeRefunded(event.data.object)
    case "account.updated":
      return onAccountUpdated(event.data.object)
    default:
      return { handled: false, detail: `ignored: ${event.type}` }
  }
}

async function onPaymentIntentSucceeded(intent: {
  id: string
  latest_charge?: string | null
}): Promise<HandledResult> {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: intent.id },
  })
  if (!payment) return { handled: false, detail: "no matching payment" }
  if (payment.status === "SUCCEEDED") return { handled: true, detail: "already succeeded" }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      stripeChargeId:
        typeof intent.latest_charge === "string" ? intent.latest_charge : payment.stripeChargeId,
    },
  })
  if (payment.obligationId) await recomputeObligationStatus(prisma, payment.obligationId)
  return { handled: true }
}

async function onPaymentIntentFailed(intent: { id: string }): Promise<HandledResult> {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: intent.id },
  })
  if (!payment) return { handled: false, detail: "no matching payment" }
  // Never regress a success (out-of-order delivery)
  if (payment.status !== "PENDING" && payment.status !== "PROCESSING") {
    return { handled: true, detail: `left as ${payment.status}` }
  }
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } })
  return { handled: true }
}

async function onChargeRefunded(charge: {
  id: string
  payment_intent?: string | null
  amount: number
  amount_refunded: number
}): Promise<HandledResult> {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { stripeChargeId: charge.id },
        ...(charge.payment_intent ? [{ stripePaymentIntentId: charge.payment_intent }] : []),
      ],
    },
  })
  if (!payment) return { handled: false, detail: "no matching payment" }

  const refunded = charge.amount_refunded / 100
  const fully = charge.amount_refunded >= charge.amount
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundAmount: refunded,
      refundedAt: payment.refundedAt ?? new Date(),
      // Partial refunds stay SUCCEEDED (net amount still counts toward the
      // obligation); full refunds flip to REFUNDED.
      status: fully ? "REFUNDED" : payment.status,
    },
  })
  if (payment.obligationId) await recomputeObligationStatus(prisma, payment.obligationId)
  return { handled: true }
}

async function onAccountUpdated(account: {
  id: string
  charges_enabled?: boolean
  details_submitted?: boolean
}): Promise<HandledResult> {
  const active = !!account.charges_enabled && !!account.details_submitted
  const result = await prisma.paymentConfig.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeAccountStatus: active ? "active" : "pending" },
  })
  return result.count > 0
    ? { handled: true }
    : { handled: false, detail: "no matching payment config" }
}
