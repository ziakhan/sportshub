import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getPaymentConfig, platformFeeFor } from "@/lib/payments/config"
import { referenceToPaymentType, remainingAmount } from "@/lib/payments/obligations"
import { getStripe, StripeNotConfiguredError } from "@/lib/payments/stripe"

export const dynamic = "force-dynamic"

const checkoutSchema = z.object({
  /** Defaults to everything still owed; smaller = manual installment. */
  amount: z.number().positive().optional(),
})

/**
 * Start an online payment for an obligation (docs/payments-design.md).
 * POST /api/obligations/[id]/checkout  { amount? }
 *
 * CONNECT_DIRECT — PaymentIntent on the club's connected account (direct
 * charge); money settles to the club, our application fee is skimmed.
 * PLATFORM_COLLECT — PaymentIntent on the platform account; our fee is
 * recorded on the Payment row and withheld at settlement.
 *
 * Returns { clientSecret } for Stripe Elements/confirmCardPayment.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    const obligation = await prisma.paymentObligation.findUnique({
      where: { id: params.id },
      include: { payments: true },
    })
    if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 })

    // Payer side: the person who owes, or (club→league fees) the club's staff
    const isPersonPayer = obligation.payerUserId === userId
    const isOrgPayer =
      !!obligation.payerTenantId &&
      !!(await prisma.userRole.findFirst({
        where: {
          userId,
          tenantId: obligation.payerTenantId,
          role: { in: ["ClubOwner", "ClubManager"] },
        },
      }))
    if (!isPersonPayer && !isOrgPayer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!["PENDING", "PARTIALLY_PAID"].includes(obligation.status)) {
      return NextResponse.json(
        { error: "This obligation is not open for payment", code: "OBLIGATION_CLOSED" },
        { status: 400 }
      )
    }

    const remaining = remainingAmount(obligation)
    const body = await request.json().catch(() => ({}))
    const data = checkoutSchema.parse(body ?? {})
    const amount = data.amount ?? remaining
    if (amount <= 0 || amount > remaining + 0.001) {
      return NextResponse.json(
        { error: `Amount must be between 0 and the ${remaining.toFixed(2)} remaining`, code: "INVALID_AMOUNT" },
        { status: 400 }
      )
    }

    // Merchant online configuration
    const config = obligation.payeeTenantId
      ? await getPaymentConfig({ tenantId: obligation.payeeTenantId })
      : obligation.payeeLeagueId
        ? await getPaymentConfig({ leagueId: obligation.payeeLeagueId })
        : null
    if (!config || config.onlineMode === "NONE") {
      return NextResponse.json(
        { error: "This organization does not accept online payments", code: "ONLINE_NOT_AVAILABLE" },
        { status: 400 }
      )
    }
    const direct = config.onlineMode === "CONNECT_DIRECT"
    if (direct && (!config.stripeAccountId || config.stripeAccountStatus !== "active")) {
      return NextResponse.json(
        { error: "This organization's payment account is not ready yet", code: "ACCOUNT_NOT_READY" },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const cents = Math.round(amount * 100)
    const feeCents = Math.round(platformFeeFor(config, amount) * 100)
    const stripeAccount = direct ? config.stripeAccountId! : null
    const requestOptions = stripeAccount ? { stripeAccount } : undefined

    // Reuse a still-confirmable intent for the same amount (double-click,
    // abandoned checkout); otherwise cancel it and mint a fresh one.
    const openPayment = obligation.payments.find(
      (p: any) => p.method === "STRIPE" && p.status === "PENDING" && p.stripePaymentIntentId
    )
    if (openPayment) {
      try {
        const existing = await stripe.paymentIntents.retrieve(
          openPayment.stripePaymentIntentId!,
          requestOptions as any
        )
        if (
          existing.amount === cents &&
          ["requires_payment_method", "requires_confirmation", "requires_action"].includes(
            existing.status
          )
        ) {
          return NextResponse.json({
            clientSecret: existing.client_secret,
            paymentId: openPayment.id,
            amount,
          })
        }
        if (!["succeeded", "canceled"].includes(existing.status)) {
          await stripe.paymentIntents.cancel(existing.id, requestOptions as any).catch(() => {})
        }
      } catch {
        // unretrievable — fall through to a fresh intent
      }
      await prisma.payment.update({
        where: { id: openPayment.id },
        data: { status: "FAILED", note: "superseded by a new checkout" },
      })
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: cents,
        currency: obligation.currency.toLowerCase(),
        description: obligation.description,
        metadata: { obligationId: obligation.id },
        ...(direct && feeCents > 0 ? { application_fee_amount: feeCents } : {}),
      },
      requestOptions as any
    )

    const payment = await prisma.payment.create({
      data: {
        obligationId: obligation.id,
        payerId: obligation.payerUserId,
        tenantId: obligation.payeeTenantId,
        amount,
        currency: obligation.currency,
        status: "PENDING",
        method: "STRIPE",
        stripePaymentIntentId: intent.id,
        stripeAccountId: stripeAccount,
        platformFee: feeCents > 0 ? feeCents / 100 : null,
        paymentType: referenceToPaymentType(obligation.referenceType) as any,
        description: obligation.description,
      },
    })

    return NextResponse.json({ clientSecret: intent.client_secret, paymentId: payment.id, amount })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error("Checkout error:", error)
    return NextResponse.json({ error: "Failed to start payment" }, { status: 500 })
  }
}
