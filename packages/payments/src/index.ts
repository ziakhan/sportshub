import Stripe from "stripe"

// Initialize Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
})

// Helper to create payment intent for tryout fee
export async function createTryoutPaymentIntent(params: {
  amount: number // in cents
  clubStripeAccountId: string
  tryoutSignupId: string
  tenantId: string
  platformFeePercent?: number
}) {
  const { amount, clubStripeAccountId, tryoutSignupId, tenantId, platformFeePercent = 5 } = params

  const applicationFee = Math.round(amount * (platformFeePercent / 100))

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    application_fee_amount: applicationFee,
    transfer_data: {
      destination: clubStripeAccountId,
    },
    metadata: {
      tryoutSignupId,
      tenantId,
      type: "TRYOUT_FEE",
    },
  })

  return paymentIntent
}

// Helper to create Connect account
export async function createConnectAccount(params: {
  email: string
  type?: "express" | "standard"
  tenantId: string
}) {
  const { email, type = "express", tenantId } = params

  const account = await stripe.accounts.create({
    type,
    country: "US",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: {
      tenantId,
    },
  })

  return account
}

// Helper to create account link for onboarding
export async function createAccountLink(params: {
  accountId: string
  refreshUrl: string
  returnUrl: string
}) {
  const { accountId, refreshUrl, returnUrl } = params

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  })

  return accountLink
}

// Helper to verify webhook signature
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}

export { Stripe }
export type { Stripe as StripeType }
