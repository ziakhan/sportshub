/**
 * Live test-mode verification of the stage-3 Stripe backend (one-shot).
 * Requires: dev server on :3000, STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in
 * apps/web/.env.local, and `stripe listen --forward-to
 * localhost:3000/api/webhooks/stripe` running.
 *
 * Flow (PLATFORM_COLLECT — no connected-account onboarding needed):
 *   world → paid tryout → parent signs up (obligation) → checkout →
 *   confirm PaymentIntent with the pm_card_visa test card →
 *   real Stripe webhook drives the obligation to PAID → tryout signup flips.
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

  // Platform-collect mode with a 2.5% + $0.30 platform fee
  await prisma.paymentConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      platformCollectAllowed: true,
      onlineMode: "PLATFORM_COLLECT",
      platformFeeBps: 250,
      platformFeeFlat: 0.3,
    },
    update: {
      platformCollectAllowed: true,
      onlineMode: "PLATFORM_COLLECT",
      platformFeeBps: 250,
      platformFeeFlat: 0.3,
    },
  })

  console.log("2) Parent signs up for the $25 tryout (real HTTP)…")
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

  console.log("3) Checkout (real HTTP → real Stripe PaymentIntent)…")
  const checkout = await call(`/api/obligations/${obligation.id}/checkout`, {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  if (checkout.status !== 200) throw new Error(`checkout failed: ${JSON.stringify(checkout.body)}`)
  const intentId = String(checkout.body.clientSecret).split("_secret")[0]
  console.log(`   intent ${intentId} created for $${checkout.body.amount}`)

  console.log("4) Confirming with test card pm_card_visa…")
  const confirmed = await stripe.paymentIntents.confirm(intentId, {
    payment_method: "pm_card_visa",
  })
  console.log(`   stripe says: ${confirmed.status}`)

  console.log("5) Waiting for the webhook to drive the obligation…")
  let final = obligation.status as string
  let signupStatus = ""
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const row = await prisma.paymentObligation.findUniqueOrThrow({
      where: { id: obligation.id },
    })
    final = row.status
    if (final === "PAID") break
  }
  signupStatus = (
    await prisma.tryoutSignup.findUniqueOrThrow({ where: { id: signup.body.id } })
  ).status

  const payment = await prisma.payment.findFirstOrThrow({
    where: { obligationId: obligation.id, method: "STRIPE" },
  })

  console.log("")
  console.log(`RESULT: obligation=${final} payment=${payment.status} platformFee=$${payment.platformFee} signup=${signupStatus}`)
  if (final === "PAID" && payment.status === "SUCCEEDED" && signupStatus === "PAID") {
    console.log("✅ LIVE TEST-MODE VERIFICATION PASSED")
    console.log(`   See it in the dashboard: https://dashboard.stripe.com/test/payments/${intentId}`)
  } else {
    console.log("❌ VERIFICATION INCOMPLETE — check `stripe listen` is running and STRIPE_WEBHOOK_SECRET matches")
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
