import { prisma } from "@youthbasketballhub/db"
import { getStripe } from "./stripe"
import { getPaymentConfig, platformFeeFor, type ResolvedPaymentConfig } from "./config"
import { getOrCreateStripeCustomer } from "./customer"

/**
 * Installment engine (payments v2 hybrid). We own the SCHEDULE; Stripe owns
 * the vault + charging + Smart Retries + dunning. On accept we record a
 * Payment row per installment and pre-create a draft auto-collect Invoice for
 * each; a daily cron finalizes each invoice on its due date, and Stripe takes
 * over charging/recovery. The deposit is charged on-session at accept.
 *
 * DESTINATION (PLATFORM_COLLECT) is the fully-live default: invoices on the
 * platform customer with application_fee + transfer_data. DIRECT charges use
 * the same functions with a connected-account customer + `{ stripeAccount }`.
 */

export interface PlanTerm {
  sequence: number
  amount: number
  dueDate: Date
  label?: string
}
export interface DefaultPlan {
  depositAmount: number
  terms: PlanTerm[]
}

/**
 * Default plan (owner spec): deposit = 25% due on accept, then 3 equal
 * installments on the 1st of the next 3 months. Rounds to cents and pushes
 * any rounding remainder into the deposit so the parts sum to the fee.
 */
export function computeDefaultPlan(
  seasonFee: number,
  opts: { depositFraction?: number; count?: number; firstOfMonthFrom?: Date } = {}
): DefaultPlan {
  const depositFraction = opts.depositFraction ?? 0.25
  const count = opts.count ?? 3
  const per = Math.round((seasonFee / (count + 1)) * 100) / 100
  const from = opts.firstOfMonthFrom ?? new Date()
  const terms: PlanTerm[] = []
  for (let i = 1; i <= count; i++) {
    const d = new Date(from)
    d.setMonth(d.getMonth() + i, 1)
    d.setHours(9, 0, 0, 0)
    terms.push({ sequence: i, amount: per, dueDate: d, label: `Installment ${i}` })
  }
  const depositByFraction = Math.round(seasonFee * depositFraction * 100) / 100
  const installmentsTotal = per * count
  // Deposit absorbs the remainder so deposit + installments === seasonFee
  const deposit = Math.round((seasonFee - installmentsTotal) * 100) / 100
  return { depositAmount: deposit > 0 ? deposit : depositByFraction, terms }
}

export interface ChargeContext {
  stripe: ReturnType<typeof getStripe>
  config: ResolvedPaymentConfig
  direct: boolean
  account: string // connected account id
  currency: string
  feeFor: (amount: number) => number
}

/** Resolve the club/league's online charge context, or null if offline. */
export async function resolveChargeContext(
  merchant: { tenantId: string } | { leagueId: string },
  currency = "CAD"
): Promise<ChargeContext | null> {
  const config = await getPaymentConfig(merchant)
  if (!config || config.onlineMode === "NONE") return null
  if (!config.stripeAccountId || config.stripeAccountStatus !== "active") return null
  return {
    stripe: getStripe(),
    config,
    direct: config.onlineMode === "CONNECT_DIRECT",
    account: config.stripeAccountId,
    currency,
    feeFor: (amount: number) => platformFeeFor(config, amount),
  }
}

/**
 * The customer whose saved card backs this offer's charges. Destination =
 * the platform customer (Stage A). Direct = a customer on the connected
 * account (created lazily; the card is saved there at accept via a
 * connected-account SetupIntent — see pay-intent route).
 */
export async function customerForCharges(
  userId: string,
  ctx: ChargeContext
): Promise<string> {
  if (!ctx.direct) return getOrCreateStripeCustomer(userId)
  // Direct: reuse/create a customer on the connected account
  const existing = await (prisma as any).connectedCustomer.findUnique({
    where: { userId_accountId: { userId, accountId: ctx.account } },
  })
  if (existing?.customerId) return existing.customerId
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  })
  const customer = await ctx.stripe.customers.create(
    {
      email: user?.email,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
      metadata: { userId },
    },
    { stripeAccount: ctx.account }
  )
  await (prisma as any).connectedCustomer.create({
    data: { userId, accountId: ctx.account, customerId: customer.id },
  })
  return customer.id
}

/**
 * Cards already on file for THIS merchant. Destination → the platform
 * customer (Stage A). Direct → the connected-account customer, if one exists
 * (read-only; never creates one). Display fields only.
 */
export async function listContextCards(
  userId: string,
  ctx: ChargeContext
): Promise<Array<{ id: string; brand: string; last4: string; isDefault: boolean }>> {
  let customerId: string | null = null
  let requestOptions: any = undefined
  if (!ctx.direct) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })
    customerId = user?.stripeCustomerId ?? null
  } else {
    const cc = await (prisma as any).connectedCustomer.findUnique({
      where: { userId_accountId: { userId, accountId: ctx.account } },
    })
    customerId = cc?.customerId ?? null
    requestOptions = { stripeAccount: ctx.account }
  }
  if (!customerId) return []

  const [methods, customer] = await Promise.all([
    ctx.stripe.paymentMethods.list({ customer: customerId, type: "card" }, requestOptions),
    ctx.stripe.customers.retrieve(customerId, requestOptions),
  ])
  const defaultId =
    !("deleted" in customer) &&
    (customer.invoice_settings?.default_payment_method as string | null | undefined)
  return methods.data.map((m) => ({
    id: m.id,
    brand: m.card?.brand ?? "card",
    last4: m.card?.last4 ?? "••••",
    isDefault: m.id === defaultId,
  }))
}

/** Build the Connect params common to a deposit PaymentIntent / invoice. */
export function connectChargeParams(ctx: ChargeContext, amount: number) {
  const feeCents = Math.round(ctx.feeFor(amount) * 100)
  if (ctx.direct) {
    return {
      params: feeCents > 0 ? { application_fee_amount: feeCents } : {},
      requestOptions: { stripeAccount: ctx.account } as const,
      feeCents,
    }
  }
  return {
    params: {
      ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
      transfer_data: { destination: ctx.account },
      on_behalf_of: ctx.account,
    },
    requestOptions: undefined,
    feeCents,
  }
}

/**
 * Create ONE draft auto-collect invoice for a scheduled installment and
 * return its id. Left as a draft (auto_advance:false); the cron finalizes it
 * on the due date, at which point Stripe charges the customer's default card
 * and runs Smart Retries + dunning if it fails.
 */
export async function createInstallmentInvoice(
  ctx: ChargeContext,
  opts: { customerId: string; amount: number; description: string; dueDate: Date; paymentId: string }
): Promise<string> {
  const cents = Math.round(opts.amount * 100)
  const { params, requestOptions } = connectChargeParams(ctx, opts.amount)

  await ctx.stripe.invoiceItems.create(
    {
      customer: opts.customerId,
      amount: cents,
      currency: ctx.currency.toLowerCase(),
      description: opts.description,
    },
    requestOptions as any
  )
  // NB: `charge_automatically` invoices must NOT set due_date (Stripe rejects
  // it — that's a `send_invoice` field). OUR Payment.dueDate drives WHEN the
  // cron finalizes this invoice; Stripe charges on finalize.
  const invoice = await ctx.stripe.invoices.create(
    {
      customer: opts.customerId,
      collection_method: "charge_automatically",
      auto_advance: false,
      description: opts.description,
      metadata: { paymentId: opts.paymentId, dueDate: opts.dueDate.toISOString() },
      ...(params as any),
    },
    requestOptions as any
  )
  return invoice.id
}

/**
 * On accept with an INSTALLMENTS plan: write a Payment row per installment
 * (PENDING, dated) and pre-create its invoice. Deposit is a separate,
 * already-charged Payment (see accept route). Called inside the accept txn's
 * follow-up (invoices are external, so done after the DB commit).
 */
export async function scheduleInstallments(opts: {
  offerId: string
  payerUserId: string
  merchant: { tenantId: string } | { leagueId: string }
  tenantId: string | null
  obligationId: string
  currency: string
  teamName: string
  terms: Array<{ sequence: number; amount: number; dueDate: Date; label?: string | null }>
}): Promise<{ scheduled: number; invoiced: number }> {
  const ctx = await resolveChargeContext(opts.merchant, opts.currency).catch(() => null)
  const customerId = ctx ? await customerForCharges(opts.payerUserId, ctx).catch(() => null) : null

  let invoiced = 0
  for (const term of opts.terms) {
    const description = `${opts.teamName} — ${term.label || `installment ${term.sequence}`}`
    const payment = await (prisma as any).payment.create({
      data: {
        obligationId: opts.obligationId,
        payerId: opts.payerUserId,
        tenantId: opts.tenantId,
        amount: term.amount,
        currency: opts.currency,
        status: "PENDING",
        method: ctx ? "STRIPE" : "OTHER",
        dueDate: term.dueDate,
        installmentNumber: term.sequence + 1, // deposit is #1
        relatedOfferId: opts.offerId,
        paymentType: "SEASON_FEE",
        description,
      },
      select: { id: true },
    })
    // Online: pre-create the invoice so the cron just finalizes it on the date
    if (ctx && customerId) {
      try {
        const invoiceId = await createInstallmentInvoice(ctx, {
          customerId,
          amount: term.amount,
          description,
          dueDate: term.dueDate,
          paymentId: payment.id,
        })
        await (prisma as any).payment.update({
          where: { id: payment.id },
          data: { stripeInvoiceId: invoiceId },
        })
        invoiced++
      } catch (e) {
        // Leave as a PENDING row with no invoice → falls to reminder-to-pay
        console.error("Installment invoice create failed:", e)
      }
    }
  }
  return { scheduled: opts.terms.length, invoiced }
}
