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
 * sendOverdueReminders — past-due nagging (owner ask 2026-07-21): first
 *   notice the day after the due date, then every OVERDUE_NAG_DAYS until
 *   paid/waived. Covers installment Payments AND dated obligations.
 */

const DAY = 86_400_000

/** Re-nag cadence for overdue payments (days between reminders). */
export const OVERDUE_NAG_DAYS = 4
/** Stop nagging after this long overdue — the club should intervene by then. */
const OVERDUE_MAX_DAYS = 90

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

/**
 * Overdue nagging: bell + email every OVERDUE_NAG_DAYS while an installment
 * (or a dated obligation) stays unpaid past its due date. Dedupe = the last
 * payment_overdue notification for the same reference must be older than the
 * nag interval. Respects the club's reminderEmail opt-out for the email leg.
 */
export async function sendOverdueReminders(now = new Date()): Promise<{ nagged: number }> {
  const floor = new Date(now.getTime() - OVERDUE_MAX_DAYS * DAY)
  const nagCutoff = new Date(now.getTime() - OVERDUE_NAG_DAYS * DAY)

  const [payments, obligations] = await Promise.all([
    // Unpaid installments past due (PROCESSING = charge attempted, may be in
    // Stripe retry dunning — still worth surfacing to the family).
    (prisma as any).payment.findMany({
      where: {
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
        dueDate: { lt: now, gte: floor },
        installmentNumber: { gt: 1 },
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        dueDate: true,
        description: true,
        tenantId: true,
        payerId: true,
      },
      take: 1000,
    }),
    // Dated obligations still owed (fees where the club set a due date)
    (prisma as any).paymentObligation.findMany({
      where: {
        status: { in: ["PENDING", "PARTIALLY_PAID"] },
        dueDate: { lt: now, gte: floor },
        payerUserId: { not: null },
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        dueDate: true,
        description: true,
        payeeTenantId: true,
        payerUserId: true,
      },
      take: 1000,
    }),
  ])

  const targets = [
    ...payments.map((p: any) => ({
      refId: p.id as string,
      refType: "Payment",
      payerId: p.payerId as string | null,
      tenantId: p.tenantId as string | null,
      amount: Number(p.amount),
      currency: p.currency as string,
      dueDate: new Date(p.dueDate),
      description: (p.description ?? "Installment") as string,
    })),
    ...obligations.map((o: any) => ({
      refId: o.id as string,
      refType: "PaymentObligation",
      payerId: o.payerUserId as string | null,
      tenantId: o.payeeTenantId as string | null,
      amount: Number(o.amount),
      currency: o.currency as string,
      dueDate: new Date(o.dueDate),
      description: (o.description ?? "Payment") as string,
    })),
  ]

  let nagged = 0
  for (const t of targets) {
    if (!t.payerId) continue

    // Nag at most every OVERDUE_NAG_DAYS per reference
    const recent = await prisma.notification.findFirst({
      where: {
        userId: t.payerId,
        type: "payment_overdue",
        referenceId: t.refId,
        createdAt: { gt: nagCutoff },
      },
      select: { id: true },
    })
    if (recent) continue

    const daysLate = Math.max(1, Math.floor((now.getTime() - t.dueDate.getTime()) / DAY))
    const money = formatMoney(t.amount, t.currency)
    const message = `${t.description} — ${money} was due ${daysLate} day${daysLate === 1 ? "" : "s"} ago.`

    await notify(prisma, {
      userId: t.payerId,
      type: "payment_overdue",
      title: "Payment overdue",
      message,
      link: "/payments",
      referenceId: t.refId,
      referenceType: t.refType,
    })

    const cfgRow = t.tenantId
      ? await prisma.paymentConfig.findUnique({
          where: { tenantId: t.tenantId },
          select: { reminderEmail: true },
        })
      : null
    if (cfgRow?.reminderEmail !== false) {
      const user = await prisma.user.findUnique({
        where: { id: t.payerId },
        select: { email: true },
      })
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `Payment overdue — ${money}`,
          html: `<p>${message}</p><p>Please settle it (or update your card if a charge failed): <a href="${appBaseUrl()}/payments">My payments</a>. Already paid the club directly? They'll record it and this reminder stops.</p>`,
        }).catch(() => {})
      }
    }
    nagged++
  }

  // ── Club-owed obligations (payerTenantId — league team fees, tournament
  // entries). Payment audit 2026-07-23: these previously got NO reminder at
  // all, so an overdue club→league fee could sit unnagged forever. Nag every
  // ClubOwner/ClubManager on the payer club, same cadence per reference.
  const clubObligations = await (prisma as any).paymentObligation.findMany({
    where: {
      status: { in: ["PENDING", "PARTIALLY_PAID"] },
      dueDate: { lt: now, gte: floor },
      payerTenantId: { not: null },
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      dueDate: true,
      description: true,
      payerTenantId: true,
    },
    take: 1000,
  })

  for (const o of clubObligations) {
    const admins = await prisma.userRole.findMany({
      where: { tenantId: o.payerTenantId, role: { in: ["ClubOwner", "ClubManager"] as any } },
      select: { userId: true },
      distinct: ["userId"],
    })
    if (admins.length === 0) continue

    const daysLate = Math.max(1, Math.floor((now.getTime() - new Date(o.dueDate).getTime()) / DAY))
    const money = formatMoney(Number(o.amount), o.currency)
    const message = `${o.description ?? "Club fee"} — ${money} was due ${daysLate} day${daysLate === 1 ? "" : "s"} ago.`

    for (const admin of admins) {
      const recent = await prisma.notification.findFirst({
        where: {
          userId: admin.userId,
          type: "payment_overdue",
          referenceId: o.id,
          createdAt: { gt: nagCutoff },
        },
        select: { id: true },
      })
      if (recent) continue

      await notify(prisma, {
        userId: admin.userId,
        type: "payment_overdue",
        title: "Club payment overdue",
        message,
        link: `/clubs/${o.payerTenantId}/payments`,
        referenceId: o.id,
        referenceType: "PaymentObligation",
      })

      const user = await prisma.user.findUnique({
        where: { id: admin.userId },
        select: { email: true },
      })
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `Club payment overdue — ${money}`,
          html: `<p>${message}</p><p>Settle it from your club payments page: <a href="${appBaseUrl()}/clubs/${o.payerTenantId}/payments">Club payments</a>.</p>`,
        }).catch(() => {})
      }
      nagged++
    }
  }

  return { nagged }
}
