import Stripe from "stripe"

/**
 * Stripe client — the single boundary the rest of the codebase talks to.
 * Env-gated: without STRIPE_SECRET_KEY every online-payment route responds
 * 503 STRIPE_NOT_CONFIGURED instead of crashing, so offline mode (and the
 * whole app) works with no Stripe account at all.
 *
 * Integration tests mock THIS module, never the SDK internals.
 */

export class StripeNotConfiguredError extends Error {
  code = "STRIPE_NOT_CONFIGURED" as const
  constructor() {
    super("Online payments are not configured (missing STRIPE_SECRET_KEY)")
  }
}

let client: Stripe | null = null

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError()
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      appInfo: { name: "YouthBasketballHub" },
    })
  }
  return client
}

/**
 * Verify + parse a webhook payload. Kept here so tests can fake the whole
 * boundary; throws on bad signature exactly like the SDK.
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new StripeNotConfiguredError()
  return getStripe().webhooks.constructEvent(rawBody, signature, secret)
}
