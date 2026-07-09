import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { StripeNotConfiguredError } from "@/lib/payments/stripe"
import {
  connectChargeParams,
  customerForCharges,
  resolveChargeContext,
} from "@/lib/payments/installments"

export const dynamic = "force-dynamic"

const schema = z.object({
  chosenOptionId: z.string().optional(),
  paymentPlan: z.enum(["FULL", "INSTALLMENTS"]).default("FULL"),
  // A card already on file — pay one-click without re-entering it. When
  // omitted, the client collects a new card via Elements against the secret.
  paymentMethodId: z.string().optional(),
})

/**
 * POST /api/offers/[id]/pay-intent — Stage C. The amount the family must pay
 * to ACCEPT: the full fee (FULL) or the deposit (INSTALLMENTS). Online →
 * returns a PaymentIntent client secret (card saved off_session so the plan
 * can auto-charge later). Offline club → { offline: true } (deposit recorded
 * by the club). The card is only charged when the family confirms; the offer
 * flips ACCEPTED via PATCH /api/offers/[id] once the intent succeeds.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = schema.parse(await request.json().catch(() => ({})))

    const offer = await (prisma as any).offer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        seasonFee: true,
        expiresAt: true,
        player: { select: { parentId: true } },
        team: { select: { name: true, tenantId: true, tenant: { select: { currency: true } } } },
        options: {
          select: {
            id: true,
            seasonFee: true,
            allowFullPay: true,
            allowInstallments: true,
            depositAmount: true,
          },
        },
      },
    })
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    if (offer.player.parentId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (offer.status !== "PENDING") {
      return NextResponse.json({ error: "This offer isn't open" }, { status: 400 })
    }
    // Expiry is enforced lazily (no cron). The accept PATCH already checks it, but
    // this route runs FIRST — without the check a family could complete a deposit
    // charge on a stale offer whose accept then fails, orphaning the payment
    // (docs/editability-audit.md §4). Flip + refuse, same as the accept path.
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      await (prisma as any).offer.update({
        where: { id: offer.id },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "This offer has expired" }, { status: 400 })
    }

    // Resolve the chosen option (or the single one, or the bare offer)
    const option =
      offer.options.find((o: any) => o.id === body.chosenOptionId) ?? offer.options[0] ?? null
    const fee = Number(option?.seasonFee ?? offer.seasonFee)
    if (body.paymentPlan === "INSTALLMENTS" && !(option?.allowInstallments)) {
      return NextResponse.json({ error: "This package has no payment plan" }, { status: 400 })
    }
    const amountDue =
      body.paymentPlan === "INSTALLMENTS" ? Number(option?.depositAmount ?? 0) : fee
    if (amountDue <= 0) {
      // Free (or zero deposit) — nothing to charge; accept can proceed
      return NextResponse.json({ amountDue: 0, noCharge: true })
    }

    const currency = offer.team.tenant.currency
    const ctx = await resolveChargeContext({ tenantId: offer.team.tenantId }, currency).catch(
      () => null
    )
    if (!ctx) {
      // Offline club: the deposit/fee is recorded by the club, not charged here
      return NextResponse.json({ offline: true, amountDue })
    }

    const customerId = await customerForCharges(auth.userId, ctx)
    const { params: connectParams, requestOptions } = connectChargeParams(ctx, amountDue)

    const base: any = {
      amount: Math.round(amountDue * 100),
      currency: currency.toLowerCase(),
      customer: customerId,
      description: `${offer.team.name} — ${body.paymentPlan === "INSTALLMENTS" ? "deposit" : "season fee"}`,
      // Save the card so installments can auto-charge off_session later
      setup_future_usage: "off_session",
      metadata: { offerId: offer.id, kind: "offer-accept" },
      ...(connectParams as any),
    }

    // A card already on file → create + confirm now (user is present). No
    // Elements, no re-entry. 3-D Secure surfaces as requires_action.
    if (body.paymentMethodId) {
      const intent = await ctx.stripe.paymentIntents.create(
        {
          ...base,
          payment_method_types: ["card"], // explicit card, no redirect flows
          payment_method: body.paymentMethodId,
          confirm: true,
          off_session: false,
          error_on_requires_action: false,
        },
        requestOptions as any
      )
      return NextResponse.json({
        status: intent.status, // succeeded | requires_action | …
        clientSecret: intent.client_secret,
        amountDue,
        paymentIntentId: intent.id,
      })
    }

    // No saved card → return a secret the client confirms via Elements
    const intent = await ctx.stripe.paymentIntents.create(
      {
        ...base,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      },
      requestOptions as any
    )
    return NextResponse.json({
      status: intent.status,
      clientSecret: intent.client_secret,
      amountDue,
      paymentIntentId: intent.id,
    })
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ offline: true, code: "STRIPE_DISABLED" })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    console.error("Offer pay-intent error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
