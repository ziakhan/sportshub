/**
 * Live test-mode verification of the Stripe backend (one-shot).
 * Requires: dev server on :3000, STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in
 * apps/web/.env.local, `stripe listen --forward-to
 * localhost:3000/api/webhooks/stripe` running, and Connect ENABLED on the
 * platform test account (one-time: https://dashboard.stripe.com/test/connect
 * — without it no connected accounts can be created and every online mode is
 * correctly blocked with ACCOUNT_NOT_READY).
 *
 * Flow (PLATFORM_COLLECT destination charges — instant settlement):
 *   world → paid tryout → parent signs up (obligation) → checkout mints a
 *   destination charge (transfer_data → the club's connected account,
 *   application_fee_amount withheld) → confirm with pm_card_visa → real
 *   webhook drives the obligation to PAID → club-side refund reverses the
 *   transfer AND returns the application fee.
 *
 *   npx tsx scripts/verify-stripe-live.ts
 *   npx tsx scripts/verify-stripe-live.ts --wipe   # cleanup
 */

import Stripe from "stripe"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createParentWithChildren,
  createTryout,
  createWorldContext,
} from "@youthbasketballhub/test-worlds"
import { call, signIn, PASSWORD } from "./lib/test-helpers"

const SEED = 9412

/**
 * Find or create a test-mode connected account able to RECEIVE destination
 * charges (transfers + card_payments for on_behalf_of). Custom accounts can
 * be fully activated via API in test mode with Stripe's magic values.
 */
async function ensureConnectedAccount(stripe: Stripe): Promise<string> {
  const existing = await stripe.accounts.list({ limit: 20 })
  const usable = existing.data.find(
    (a) => a.charges_enabled && a.capabilities?.transfers === "active"
  )
  if (usable) {
    console.log(`   reusing connected account ${usable.id}`)
    return usable.id
  }

  try {
    const account = await stripe.accounts.create({
      type: "custom",
      country: "CA",
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      individual: {
        first_name: "Verify",
        last_name: "Club",
        dob: { day: 1, month: 1, year: 1901 }, // test-mode magic DOB
        address: {
          line1: "address_full_match",
          city: "Toronto",
          state: "ON",
          postal_code: "M5V 2T6",
          country: "CA",
        },
        email: "verify-club@sportshub.test",
        phone: "0000000000",
        id_number: "000000000",
      },
      business_profile: {
        mcc: "8299",
        url: "https://sportshub.test",
        product_description: "Youth basketball club fees",
      },
      external_account: {
        object: "bank_account",
        country: "CA",
        currency: "cad",
        routing_number: "11000-000",
        account_number: "000123456789",
      } as any,
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
    })
    // Poll briefly — test-mode verification is usually instant
    for (let i = 0; i < 10; i++) {
      const a = await stripe.accounts.retrieve(account.id)
      if (a.charges_enabled && a.capabilities?.transfers === "active") {
        console.log(`   created + activated connected account ${a.id}`)
        return a.id
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error(
      `connected account ${account.id} created but not active — check its requirements in the dashboard`
    )
  } catch (err: any) {
    if (String(err?.message).includes("signed up for Connect")) {
      throw new Error(
        "Stripe Connect is NOT enabled on this test account. One-time owner step:\n" +
          "  open https://dashboard.stripe.com/test/connect and enable Connect (platform profile),\n" +
          "  then re-run: npx tsx scripts/verify-stripe-live.ts"
      )
    }
    throw err
  }
}

async function main() {
  const ctx = createWorldContext(SEED)
  if (process.argv.includes("--wipe")) {
    await destroyWorld(ctx)
    console.log("wiped")
    return
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey?.startsWith("sk_test_")) throw new Error("STRIPE_SECRET_KEY (test) not loaded")
  const stripe = new Stripe(secretKey, { apiVersion: "2023-10-16" })

  console.log("1) Building world…")
  const world = await buildWorld({ seed: SEED, clubs: [{ teams: [{}] }] })
  const tenantId = world.clubs[0].tenantId
  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  const tryout = await createTryout(world.ctx, { tenantId, fee: 25 })

  console.log("2) Ensuring a connected account (destination for the club's share)…")
  const accountId = await ensureConnectedAccount(stripe)

  // Platform-collect mode with a 2.5% + $0.30 platform fee; the connected
  // account is the destination the club's share transfers into at charge time.
  const configData = {
    platformCollectAllowed: true,
    onlineMode: "PLATFORM_COLLECT" as const,
    platformFeeBps: 250,
    platformFeeFlat: 0.3,
    stripeAccountId: accountId,
    stripeAccountStatus: "active",
  }
  await prisma.paymentConfig.upsert({
    where: { tenantId },
    create: { tenantId, ...configData },
    update: configData,
  })

  console.log("3) Parent signs up for the $25 tryout (real HTTP)…")
  const jar = await signIn(family.parent.email, PASSWORD)
  if (!jar) throw new Error("sign-in failed — is the dev server running on :3000?")
  const signup = await call(`/api/tryouts/${tryout.id}/signup`, {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: family.players[0].id }),
  })
  if (signup.status !== 201) throw new Error(`signup failed: ${JSON.stringify(signup.body)}`)

  const obligation = await prisma.paymentObligation.findUniqueOrThrow({
    where: {
      referenceType_referenceId: { referenceType: "TryoutSignup", referenceId: signup.body.id },
    },
  })
  console.log(`   obligation ${obligation.id.slice(0, 8)}… $${obligation.amount} ${obligation.status}`)

  console.log("4) Checkout (real HTTP → real Stripe destination charge)…")
  const checkout = await call(`/api/obligations/${obligation.id}/checkout`, {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  if (checkout.status !== 200) throw new Error(`checkout failed: ${JSON.stringify(checkout.body)}`)
  const intentId = String(checkout.body.clientSecret).split("_secret")[0]

  // The intent must be a destination charge with our fee withheld
  const intent = await stripe.paymentIntents.retrieve(intentId)
  const destination =
    typeof intent.transfer_data?.destination === "string"
      ? intent.transfer_data?.destination
      : intent.transfer_data?.destination?.id
  console.log(
    `   intent ${intentId}: $${intent.amount / 100} → destination ${destination}, app fee $${(intent.application_fee_amount ?? 0) / 100}`
  )
  if (destination !== accountId) throw new Error("intent is NOT a destination charge to the club")
  if (intent.application_fee_amount !== 93) {
    // 2.5% of $25 = $0.63 (rounded) + $0.30 = $0.93
    throw new Error(`unexpected application fee: ${intent.application_fee_amount}`)
  }

  console.log("5) Confirming with test card pm_card_visa…")
  const confirmed = await stripe.paymentIntents.confirm(intentId, {
    payment_method: "pm_card_visa",
  })
  console.log(`   stripe says: ${confirmed.status}`)

  console.log("6) Waiting for the webhook to drive the obligation…")
  let final = obligation.status as string
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const row = await prisma.paymentObligation.findUniqueOrThrow({ where: { id: obligation.id } })
    final = row.status
    if (final === "PAID") break
  }
  const signupStatus = (
    await prisma.tryoutSignup.findUniqueOrThrow({ where: { id: signup.body.id } })
  ).status
  const payment = await prisma.payment.findFirstOrThrow({
    where: { obligationId: obligation.id, method: "STRIPE" },
  })

  console.log("")
  console.log(
    `PAYMENT RESULT: obligation=${final} payment=${payment.status} platformFee=$${payment.platformFee} destination=${payment.stripeDestinationAccountId} signup=${signupStatus}`
  )
  if (!(final === "PAID" && payment.status === "SUCCEEDED" && signupStatus === "PAID")) {
    console.log(
      "❌ VERIFICATION INCOMPLETE — check `stripe listen` is running and STRIPE_WEBHOOK_SECRET matches"
    )
    process.exitCode = 1
    return
  }

  console.log("7) Club-side refund (must reverse the transfer + return the app fee)…")
  const ownerJar = await signIn(world.clubs[0].owner.email, PASSWORD)
  if (!ownerJar) throw new Error("owner sign-in failed")
  const refundRes = await call(`/api/payments/${payment.id}`, {
    method: "PATCH",
    jar: ownerJar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refund" }),
  })
  if (refundRes.status !== 200) throw new Error(`refund failed: ${JSON.stringify(refundRes.body)}`)

  const refunds = await stripe.refunds.list({ payment_intent: intentId, limit: 1 })
  const refund = refunds.data[0]
  const reversal = refund?.transfer_reversal
  console.log(
    `   refund ${refund?.id}: $${(refund?.amount ?? 0) / 100} transfer_reversal=${
      typeof reversal === "string" ? reversal : reversal?.id
    }`
  )

  const obligationAfter = await prisma.paymentObligation.findUniqueOrThrow({
    where: { id: obligation.id },
  })

  if (refund && reversal && obligationAfter.status === "PENDING") {
    console.log("")
    console.log("✅ LIVE DESTINATION-CHARGE VERIFICATION PASSED (charge + fee + webhook + reversing refund)")
    console.log(`   Dashboard: https://dashboard.stripe.com/test/payments/${intentId}`)
  } else {
    console.log("❌ refund did not reverse the transfer / reopen the obligation")
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
