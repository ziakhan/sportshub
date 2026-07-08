import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getStripe, StripeNotConfiguredError } from "@/lib/payments/stripe"
import { ownsPaymentMethod } from "@/lib/payments/customer"

export const dynamic = "force-dynamic"

const patchSchema = z.object({ action: z.literal("makeDefault") })

/**
 * PATCH — set this card as the customer's default (auto-charge target).
 * DELETE — detach (remove) the card. Both verify the card belongs to the
 * caller's Stripe customer first.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 })

    const customerId = await ownsPaymentMethod(auth.userId, params.id)
    if (!customerId) return NextResponse.json({ error: "Card not found" }, { status: 404 })

    const stripe = getStripe()
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: params.id },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "STRIPE_DISABLED" }, { status: 503 })
    }
    console.error("Set default card error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const customerId = await ownsPaymentMethod(auth.userId, params.id)
    if (!customerId) return NextResponse.json({ error: "Card not found" }, { status: 404 })

    const stripe = getStripe()
    await stripe.paymentMethods.detach(params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "STRIPE_DISABLED" }, { status: 503 })
    }
    console.error("Detach card error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
