import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getStripe, StripeNotConfiguredError } from "@/lib/payments/stripe"
import { getOrCreateStripeCustomer, listSavedCards } from "@/lib/payments/customer"
import { getFamilyAccountContext } from "@/lib/family/account-context"

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

    // A card-on-file form is still a payment form (owner 2026-08-12): a
    // 13-17 self-owned account never sees one. No routing to the parent
    // here — there is nothing to approve, the parent's own cards live on
    // their own account.
    const ctx = await getFamilyAccountContext(auth.userId)
    if (ctx.player && ctx.isMinor) {
      return NextResponse.json(
        {
          error:
            "Payments run through your parent or guardian until you turn 18, so there is no card to add here.",
          code: "MINOR_NO_PAYMENT_METHODS",
        },
        { status: 403 }
      )
    }

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
