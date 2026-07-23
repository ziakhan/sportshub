/**
 * Obligation engine — the offline-first core of the payments design
 * (docs/payments-design.md). An obligation is WHAT IS OWED (one per product
 * row: tryout signup, offer, camp signup…); Payment rows — cash, e-transfer,
 * or Stripe alike — are recorded AGAINST it. Status is always derived from
 * the recorded payments, so a cash-paying club and a Stripe club produce
 * identical reporting shapes.
 *
 * Pass the transaction client where the product action is transactional.
 */

import { prisma } from "@youthbasketballhub/db"
import { notify } from "@/lib/notifications"
import { appBaseUrl, escapeHtml, formatMoney, sendEmail, transactionalFooter } from "@/lib/email"

export class ObligationError extends Error {
  constructor(
    message: string,
    public code:
      | "OBLIGATION_CLOSED"
      | "OVERPAYMENT"
      | "INVALID_AMOUNT"
      | "NOT_REFUNDABLE"
      | "ALREADY_REFUNDED"
  ) {
    super(message)
  }
}

export interface EnsureObligationInput {
  payerUserId?: string | null
  payerTenantId?: string | null
  payeeTenantId?: string | null
  payeeLeagueId?: string | null
  referenceType: string
  referenceId: string
  description: string
  amount: number
  currency?: string
  dueDate?: Date | null
  paymentType?: string
}

/**
 * Create the obligation for a product row if it doesn't exist yet (unique on
 * referenceType+referenceId makes this idempotent). Zero/negative amounts
 * create nothing — free offerings never produce obligations.
 */
export async function ensureObligation(db: any, input: EnsureObligationInput) {
  if (input.amount <= 0) return null
  const existing = await db.paymentObligation.findUnique({
    where: {
      referenceType_referenceId: {
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    },
  })
  if (existing) return existing
  return db.paymentObligation.create({
    data: {
      payerUserId: input.payerUserId ?? null,
      payerTenantId: input.payerTenantId ?? null,
      payeeTenantId: input.payeeTenantId ?? null,
      payeeLeagueId: input.payeeLeagueId ?? null,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      description: input.description,
      amount: input.amount,
      currency: input.currency ?? "CAD",
      dueDate: input.dueDate ?? null,
    },
  })
}

/**
 * Revived registration (a CANCELLED signup re-registered in place): make the
 * obligation live again at the current fee. Paid/waived rows are left alone;
 * missing ones are created.
 */
export async function reviveObligation(db: any, input: EnsureObligationInput) {
  const existing = await ensureObligation(db, input)
  if (existing && existing.status === "CANCELLED") {
    return db.paymentObligation.update({
      where: { id: existing.id },
      data: { status: "PENDING", amount: input.amount, description: input.description },
    })
  }
  return existing
}

/** Sum of successful payments minus refunds, as a number. */
function paidTotal(payments: Array<{ status: string; amount: any; refundAmount: any }>): number {
  return payments
    .filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")
    .reduce((sum, p) => sum + Number(p.amount) - Number(p.refundAmount ?? 0), 0)
}

/** What's still owed on an obligation (needs its payments loaded). */
export function remainingAmount(obligation: {
  amount: any
  payments: Array<{ status: string; amount: any; refundAmount: any }>
}): number {
  return Number(obligation.amount) - paidTotal(obligation.payments)
}

/** Recompute and persist the obligation's status from its payments. */
export async function recomputeObligationStatus(db: any, obligationId: string) {
  const obligation = await db.paymentObligation.findUniqueOrThrow({
    where: { id: obligationId },
    include: { payments: true },
  })
  // Terminal-by-decision states are not recomputed away
  if (["WAIVED", "CANCELLED"].includes(obligation.status)) return obligation

  const paid = paidTotal(obligation.payments)

  // Status reflects paid-vs-owed only: refunds REOPEN the debt (the fee is
  // still owed unless the club waives/cancels it). The REFUNDED status is
  // reserved for explicit product flows, never derived here.
  let status: string
  if (paid >= Number(obligation.amount)) status = "PAID"
  else if (paid > 0) status = "PARTIALLY_PAID"
  else status = "PENDING"

  if (status === obligation.status) return obligation
  const updated = await db.paymentObligation.update({
    where: { id: obligationId },
    data: { status },
  })
  await syncReferenceStatus(db, updated)
  return updated
}

/**
 * Product-side status glue: some product rows carry their own paid/pending
 * state that the UI already renders. Keep them in step with the obligation.
 */
async function syncReferenceStatus(db: any, obligation: { referenceType: string; referenceId: string; status: string }) {
  if (obligation.referenceType === "TryoutSignup" && obligation.status === "PAID") {
    await db.tryoutSignup.updateMany({
      where: { id: obligation.referenceId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "PAID" },
    })
  }
  if (obligation.referenceType === "TeamSubmission") {
    // Legacy per-product tracker predates the engine; keep it truthful.
    // Stage 2 (Stripe) refines PAID_MANUAL vs PAID_STRIPE by method.
    if (obligation.status === "PAID") {
      await db.teamSubmission.updateMany({
        where: { id: obligation.referenceId },
        data: { paymentStatus: "PAID_MANUAL" },
      })
    } else if (obligation.status === "WAIVED") {
      await db.teamSubmission.updateMany({
        where: { id: obligation.referenceId },
        data: { paymentStatus: "WAIVED" },
      })
    }
  }
}

const OFFLINE_METHOD_LABELS: Record<string, string> = {
  CASH: "cash",
  ETRANSFER: "e-transfer",
  CHEQUE: "cheque",
  OTHER: "offline",
}

/**
 * Best-effort payer notice (bell + email) for money events — offline receipts,
 * refunds, waives. The bell is written with the caller's client so it commits
 * atomically with the money action; the email (and its user/tenant lookups)
 * runs fire-and-forget on the global client because recordOfflinePayment /
 * refundOfflinePayment execute inside route transactions and an SMTP stall
 * must never hold a money transaction open. Never throws.
 */
async function notifyPayer(
  db: any,
  input: {
    payerUserId: string | null | undefined
    payeeTenantId: string | null | undefined
    type: "payment_receipt" | "payment_refunded" | "fee_waived"
    title: string
    message: string
    referenceId: string
    referenceType: string
    emailSubject: string
    /** Already-escaped HTML paragraph(s); payments link + footer are appended. */
    emailBodyHtml: string
  }
): Promise<void> {
  if (!input.payerUserId) return
  const payerUserId = input.payerUserId
  try {
    await notify(db, {
      userId: payerUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: "/payments",
      referenceId: input.referenceId,
      referenceType: input.referenceType,
    })
  } catch (error) {
    console.error("payer notification failed:", input.type, error)
  }
  void (async () => {
    const [user, tenant] = await Promise.all([
      prisma.user.findUnique({ where: { id: payerUserId }, select: { email: true } }),
      input.payeeTenantId
        ? prisma.tenant.findUnique({ where: { id: input.payeeTenantId }, select: { name: true } })
        : Promise.resolve(null),
    ])
    if (!user?.email) return
    await sendEmail({
      to: user.email,
      subject: input.emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${input.emailBodyHtml}
          <p><a href="${appBaseUrl()}/payments">View your payments</a></p>
          ${transactionalFooter(tenant?.name)}
        </div>`,
    })
  })().catch((error) => console.error("payer email failed:", input.type, error))
}

export interface RecordOfflinePaymentInput {
  obligationId: string
  amount: number
  method: "CASH" | "ETRANSFER" | "CHEQUE" | "OTHER"
  recordedById: string
  note?: string | null
}

/**
 * Club-side bookkeeping: "they paid at the door / sent an e-transfer".
 * Creates a SUCCEEDED offline Payment and re-derives the obligation status.
 * Rejects payments that would exceed the amount owed.
 */
export async function recordOfflinePayment(db: any, input: RecordOfflinePaymentInput) {
  if (input.amount <= 0) {
    throw new ObligationError("Payment amount must be positive", "INVALID_AMOUNT")
  }
  const obligation = await db.paymentObligation.findUniqueOrThrow({
    where: { id: input.obligationId },
    include: { payments: true },
  })
  if (["WAIVED", "CANCELLED"].includes(obligation.status)) {
    throw new ObligationError(
      `Obligation is ${obligation.status.toLowerCase()} — payments can no longer be recorded`,
      "OBLIGATION_CLOSED"
    )
  }
  const remaining = Number(obligation.amount) - paidTotal(obligation.payments)
  if (input.amount > remaining + 0.001) {
    throw new ObligationError(
      `Payment of ${input.amount} exceeds the ${remaining.toFixed(2)} remaining`,
      "OVERPAYMENT"
    )
  }

  const payment = await db.payment.create({
    data: {
      obligationId: obligation.id,
      payerId: obligation.payerUserId,
      tenantId: obligation.payeeTenantId,
      amount: input.amount,
      currency: obligation.currency,
      status: "SUCCEEDED",
      method: input.method,
      recordedById: input.recordedById,
      note: input.note ?? null,
      paymentType: referenceToPaymentType(obligation.referenceType),
      description: obligation.description,
    },
  })
  await recomputeObligationStatus(db, obligation.id)

  // Receipt to the payer — offline money moved silently before this.
  const money = formatMoney(input.amount, obligation.currency)
  const methodLabel = OFFLINE_METHOD_LABELS[input.method] ?? "offline"
  await notifyPayer(db, {
    payerUserId: obligation.payerUserId,
    payeeTenantId: obligation.payeeTenantId,
    type: "payment_receipt",
    title: "Payment received",
    message: `${obligation.description} — ${money} received (${methodLabel}). Thank you!`,
    referenceId: payment.id,
    referenceType: "Payment",
    emailSubject: `Payment received — ${money}`,
    emailBodyHtml: `<p>We received your ${methodLabel} payment of <strong>${money}</strong> for ${escapeHtml(obligation.description)}. Thank you!</p>`,
  })

  return payment
}

/** Waive what remains owed (financial aid, comp, goodwill). Paid amounts stay. */
export async function waiveObligation(
  db: any,
  input: { obligationId: string; reason?: string | null }
) {
  const obligation = await db.paymentObligation.findUniqueOrThrow({
    where: { id: input.obligationId },
  })
  if (["PAID", "WAIVED", "CANCELLED"].includes(obligation.status)) {
    throw new ObligationError(
      `Obligation is already ${obligation.status.toLowerCase()}`,
      "OBLIGATION_CLOSED"
    )
  }
  const updated = await db.paymentObligation.update({
    where: { id: input.obligationId },
    data: { status: "WAIVED", waivedAt: new Date(), waivedReason: input.reason ?? null },
  })
  await syncReferenceStatus(db, updated)

  // Tell the payer — a waived fee is good news that used to arrive silently.
  await notifyPayer(db, {
    payerUserId: obligation.payerUserId,
    payeeTenantId: obligation.payeeTenantId,
    type: "fee_waived",
    title: "Fee waived",
    message: `${obligation.description} — this fee was waived. No further payment is due.`,
    referenceId: obligation.id,
    referenceType: "PaymentObligation",
    emailSubject: "Your fee was waived",
    emailBodyHtml: `<p><strong>${escapeHtml(obligation.description)}</strong> — this fee was waived. No further payment is due.</p>`,
  })

  return updated
}

/**
 * Cancel an unpaid obligation (its product row was cancelled). Obligations
 * with money against them are left alone — refund first, then cancel.
 */
export async function cancelObligationIfUnpaid(db: any, referenceType: string, referenceId: string) {
  const obligation = await db.paymentObligation.findUnique({
    where: { referenceType_referenceId: { referenceType, referenceId } },
    include: { payments: true },
  })
  if (!obligation) return null
  if (obligation.status !== "PENDING" || paidTotal(obligation.payments) > 0) return obligation
  return db.paymentObligation.update({
    where: { id: obligation.id },
    data: { status: "CANCELLED" },
  })
}

/**
 * Record a refund of an offline payment (money handed back outside the
 * platform — this is bookkeeping, like recording the payment was).
 */
export async function refundOfflinePayment(
  db: any,
  input: { paymentId: string; amount?: number; recordedById: string }
) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: input.paymentId } })
  if (payment.method === "STRIPE") {
    throw new ObligationError("Stripe payments are refunded through Stripe", "NOT_REFUNDABLE")
  }
  if (payment.status !== "SUCCEEDED" || payment.refundedAt) {
    throw new ObligationError("Payment is not refundable", "ALREADY_REFUNDED")
  }
  const amount = input.amount ?? Number(payment.amount)
  if (amount <= 0 || amount > Number(payment.amount)) {
    throw new ObligationError("Refund amount out of range", "INVALID_AMOUNT")
  }
  const updated = await db.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: amount },
  })
  if (payment.obligationId) await recomputeObligationStatus(db, payment.obligationId)

  // Tell the payer their money came back (recorded, handed back off-platform).
  const money = formatMoney(amount, payment.currency)
  await notifyPayer(db, {
    payerUserId: payment.payerId,
    payeeTenantId: payment.tenantId,
    type: "payment_refunded",
    title: "Payment refunded",
    message: `${payment.description ?? "Payment"} — ${money} refunded.`,
    referenceId: payment.id,
    referenceType: "Payment",
    emailSubject: `Refund recorded — ${money}`,
    emailBodyHtml: `<p>A refund of <strong>${money}</strong>${payment.description ? ` for ${escapeHtml(payment.description)}` : ""} was recorded. This amount was returned to you outside the platform (e.g. cash or e-transfer).</p>`,
  })

  return updated
}

export function referenceToPaymentType(referenceType: string): string {
  switch (referenceType) {
    case "TryoutSignup":
      return "TRYOUT_FEE"
    case "Offer":
      return "SEASON_FEE"
    case "TeamSubmission":
      return "LEAGUE_FEE"
    case "TournamentEntry":
      return "TOURNAMENT_FEE"
    default:
      return "OTHER"
  }
}
