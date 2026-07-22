import { prisma } from "@youthbasketballhub/db"
import { recomputeObligationStatus } from "@/lib/payments/obligations"
import { appBaseUrl, escapeHtml, formatMoney, sendEmail } from "@/lib/email"
import { notify } from "@/lib/notifications"

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
    // Installment auto-charge (payments v2 hybrid): the invoice is the truth.
    case "invoice.paid":
      return onInvoicePaid(event.data.object)
    case "invoice.payment_failed":
      return onInvoicePaymentFailed(event.data.object)
    default:
      return { handled: false, detail: `ignored: ${event.type}` }
  }
}

async function onInvoicePaid(invoice: {
  id: string
  charge?: string | null
  payment_intent?: string | null
}): Promise<HandledResult> {
  const payment = await prisma.payment.findUnique({ where: { stripeInvoiceId: invoice.id } })
  if (!payment) return { handled: false, detail: "no matching installment" }
  if (payment.status === "SUCCEEDED") return { handled: true, detail: "already succeeded" }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      stripeChargeId: typeof invoice.charge === "string" ? invoice.charge : payment.stripeChargeId,
      stripePaymentIntentId:
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : payment.stripePaymentIntentId,
    },
  })
  if (payment.obligationId) await recomputeObligationStatus(prisma, payment.obligationId)

  // Receipt to the payer
  if (payment.payerId) {
    const money = formatMoney(Number(payment.amount), payment.currency)
    await notify(prisma, {
      userId: payment.payerId,
      type: "payment_receipt",
      title: "Payment received",
      message: `${payment.description ?? "Installment"} — ${money} paid. Thank you!`,
      link: "/payments",
      referenceId: payment.id,
      referenceType: "Payment",
    }).catch(() => {})
    const user = await prisma.user.findUnique({
      where: { id: payment.payerId },
      select: { email: true },
    })
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `Payment received — ${money}`,
        html: `<p>We received your payment of <strong>${money}</strong>${payment.description ? ` (${payment.description})` : ""}. Thanks!</p><p><a href="${appBaseUrl()}/payments">View your payments</a></p>`,
      }).catch(() => {})
    }
  }
  return { handled: true }
}

async function onInvoicePaymentFailed(invoice: { id: string }): Promise<HandledResult> {
  const payment = await prisma.payment.findUnique({ where: { stripeInvoiceId: invoice.id } })
  if (!payment) return { handled: false, detail: "no matching installment" }
  if (payment.status === "SUCCEEDED") return { handled: true, detail: "already paid" }

  // Stripe Smart Retries will keep trying; we surface the failure and let
  // its dunning drive recovery. Keep the row PENDING so a later retry can
  // still settle it (don't hard-FAIL a retryable invoice).
  if (payment.payerId) {
    const money = formatMoney(Number(payment.amount), payment.currency)
    await notify(prisma, {
      userId: payment.payerId,
      type: "payment_failed",
      title: "Payment didn't go through",
      message: `${payment.description ?? "Installment"} — ${money} couldn't be charged. We'll retry; you can also update your card.`,
      link: "/payments",
      referenceId: payment.id,
      referenceType: "Payment",
    }).catch(() => {})
    const user = await prisma.user.findUnique({
      where: { id: payment.payerId },
      select: { email: true },
    })
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `Payment failed — ${money}`,
        html: `<p>We couldn't charge your card for <strong>${money}</strong>${payment.description ? ` (${payment.description})` : ""}. We'll automatically retry, or you can update your card and pay now: <a href="${appBaseUrl()}/settings/payments">manage cards</a> · <a href="${appBaseUrl()}/payments">my payments</a>.</p>`,
      }).catch(() => {})
    }
  }
  return { handled: true }
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

  // Card declined on a one-off checkout: unlike invoice dunning there is no
  // automatic retry, so tell the payer (owner ask 2026-07-21 — previously
  // this failed silently outside the checkout screen).
  if (payment.payerId) {
    const money = formatMoney(Number(payment.amount), payment.currency)
    await notify(prisma, {
      userId: payment.payerId,
      type: "payment_failed",
      title: "Card declined",
      message: `${payment.description ?? "Payment"} — ${money} didn't go through. Try again or use another card.`,
      link: "/payments",
      referenceId: payment.id,
      referenceType: "Payment",
    }).catch(() => {})
    const user = await prisma.user.findUnique({
      where: { id: payment.payerId },
      select: { email: true },
    })
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `Payment declined — ${money}`,
        html: `<p>Your card was declined for <strong>${money}</strong>${payment.description ? ` (${escapeHtml(payment.description)})` : ""}. No money was taken.</p><p>Try again or use another card: <a href="${appBaseUrl()}/payments">my payments</a> · <a href="${appBaseUrl()}/settings/payments">manage cards</a>.</p>`,
      }).catch(() => {})
    }
  }
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
  const previouslyRefunded = Number(payment.refundAmount ?? 0)
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

  // Payer notice — only when this event actually adds refunded money. The
  // refund route applies the same refund optimistically (and webhooks
  // re-deliver), so an unchanged refundAmount means it was already announced.
  const newlyRefunded = refunded - previouslyRefunded
  if (payment.payerId && newlyRefunded > 0.001) {
    const money = formatMoney(newlyRefunded, payment.currency)
    await notify(prisma, {
      userId: payment.payerId,
      type: "payment_refunded",
      title: "Payment refunded",
      message: `${payment.description ?? "Payment"} — ${money} refunded to your card.`,
      link: "/payments",
      referenceId: payment.id,
      referenceType: "Payment",
    }).catch(() => {})
    const user = await prisma.user.findUnique({
      where: { id: payment.payerId },
      select: { email: true },
    })
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `Refund issued — ${money}`,
        html: `<p>A refund of <strong>${money}</strong>${payment.description ? ` (${escapeHtml(payment.description)})` : ""} has been issued to your original payment method. It can take 5&ndash;10 business days to appear on your statement.</p><p><a href="${appBaseUrl()}/payments">View your payments</a></p>`,
      }).catch(() => {})
    }
  }
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
