import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getStripe, StripeNotConfiguredError } from "@/lib/payments/stripe"
import { getOrCreateStripeCustomer, listSavedCards } from "@/lib/payments/customer"

export const dynamic = "force-dynamic"

/**
 * Saved cards (payments v2 Stage A — card-on-file).
 * GET  — list the user's saved cards (display fields only).
 * POST — start adding a card: returns a SetupIntent client secret for
 *        Stripe Elements to confirm. usage:off_session so the card can later
 *        auto-charge installments.
 */
export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ cards: await listSavedCards(auth.userId) })
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ cards: [], stripeDisabled: true })
    }
    console.error("List cards error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const customerId = await getOrCreateStripeCustomer(auth.userId)
    const stripe = getStripe()
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { userId: auth.userId },
    })
    return NextResponse.json({ clientSecret: intent.client_secret })
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "STRIPE_DISABLED" }, { status: 503 })
    }
    console.error("SetupIntent error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
