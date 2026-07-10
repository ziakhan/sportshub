import { prisma } from "@youthbasketballhub/db"
import { appBaseUrl, formatMoney, sendEmail } from "@/lib/email"
import { notify } from "@/lib/notifications"
import { resolveChargeContext } from "./installments"

/**
 * Scheduled payment jobs (payments v2 Stages E–F), run by Vercel Cron.
 * chargeDueInstallments — finalize each due invoice so Stripe charges the
 *   saved card and runs Smart Retries + dunning.
 * sendDueReminders — our branded pre-due nudge (email + bell), per club's
 *   reminderLeadDays.
 */

const DAY = 86_400_000

/** Finalize invoices for installments due today → Stripe charges + retries. */
export async function chargeDueInstallments(now = new Date()): Promise<{
  attempted: number
  finalized: number
  failed: number
}> {
  const due = await (prisma as any).payment.findMany({
    where: {
      method: "STRIPE",
      status: "PENDING",
      stripeInvoiceId: { not: null },
      dueDate: { lte: now },
    },
    select: { id: true, stripeInvoiceId: true, tenantId: true, currency: true },
    take: 500,
  })

  let finalized = 0
  let failed = 0
  for (const p of due) {
    try {
      if (!p.tenantId) continue
      const ctx = await resolveChargeContext({ tenantId: p.tenantId }, p.currency)
      if (!ctx) continue
      const opts = ctx.direct ? ({ stripeAccount: ctx.account } as any) : undefined
      const invoice = await ctx.stripe.invoices.retrieve(p.stripeInvoiceId, opts)
      if (invoice.status === "draft") {
        await ctx.stripe.invoices.finalizeInvoice(p.stripeInvoiceId, { auto_advance: true }, opts)
      }
      // Charging is async; the invoice.paid / payment_failed webhook settles
      // our Payment row. Mark PROCESSING so we don't re-finalize.
      await (prisma as any).payment.update({
        where: { id: p.id },
        data: { status: "PROCESSING" },
      })
      finalized++
    } catch (e) {
      failed++
      console.error("chargeDueInstallments finalize failed:", p.id, e)
    }
  }
  return { attempted: due.length, finalized, failed }
}

/** Pre-due reminders: bell + email each payer whose installment is coming up. */
export async function sendDueReminders(now = new Date()): Promise<{ reminded: number }> {
  // Widest possible window; per-club leadDays filters below.
  const horizon = new Date(now.getTime() + 30 * DAY)
  const upcoming = await (prisma as any).payment.findMany({
    where: {
      status: "PENDING",
      dueDate: { gte: now, lte: horizon },
      installmentNumber: { gt: 1 }, // deposit (1) is paid at accept
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      dueDate: true,
      description: true,
      tenantId: true,
      payerId: true,
      relatedOfferId: true,
    },
    take: 1000,
  })

  let reminded = 0
  for (const p of upcoming) {
    if (!p.tenantId || !p.payerId) continue
    // Already reminded for this installment? (notification is the dedupe)
    const already = await prisma.notification.findFirst({
      where: { userId: p.payerId, type: "payment_reminder", referenceId: p.id },
      select: { id: true },
    })
    if (already) continue

    const cfgRow = await prisma.paymentConfig.findUnique({
      where: { tenantId: p.tenantId },
      select: { reminderLeadDays: true, reminderEmail: true },
    })
    const leadDays = cfgRow?.reminderLeadDays ?? 3
    const daysOut = Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / DAY)
    if (daysOut > leadDays) continue // not in the window yet

    const money = formatMoney(Number(p.amount), p.currency)
    const when = new Date(p.dueDate).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    })
    const title = "Payment coming up"
    const message = `${p.description ?? "Installment"} — ${money} due ${when}.`

    await notify(prisma, {
      userId: p.payerId,
      type: "payment_reminder",
      title,
      message,
      link: "/payments",
      referenceId: p.id,
      referenceType: "Payment",
    })

    if (cfgRow?.reminderEmail !== false) {
      const user = await prisma.user.findUnique({
        where: { id: p.payerId },
        select: { email: true },
      })
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `Payment reminder — ${money} due ${when}`,
          html: `<p>${message}</p><p>It will be charged automatically to your card on file. See your schedule: <a href="${appBaseUrl()}/payments">My payments</a>.</p>`,
        }).catch(() => {})
      }
    }
    reminded++
  }
  return { reminded }
}
