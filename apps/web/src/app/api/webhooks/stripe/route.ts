import { NextRequest, NextResponse } from "next/server"
import { constructWebhookEvent, StripeNotConfiguredError } from "@/lib/payments/stripe"
import { handleStripeEvent } from "@/lib/payments/stripe-webhooks"

export const dynamic = "force-dynamic"

/**
 * Stripe webhook endpoint. Authenticates via the signature header (the path
 * is exempt from session auth in public-paths.ts). Locally:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event
  try {
    const rawBody = await request.text()
    event = constructWebhookEvent(rawBody, signature)
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    const result = await handleStripeEvent(event as any)
    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    // Non-2xx makes Stripe retry — correct for transient DB failures.
    console.error(`Stripe webhook ${event.type} failed:`, error)
    return NextResponse.json({ error: "Event processing failed" }, { status: 500 })
  }
}
