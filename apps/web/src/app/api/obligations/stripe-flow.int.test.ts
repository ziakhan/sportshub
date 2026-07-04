import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createParentWithChildren,
  createTryout,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as checkout } from "./[id]/checkout/route"
import { PATCH as paymentAction } from "@/app/api/payments/[id]/route"
import { POST as connectStart } from "@/app/api/clubs/[id]/payment-config/connect/route"
import { POST as webhook } from "@/app/api/webhooks/stripe/route"
import { POST as signupPost } from "@/app/api/tryouts/[id]/signup/route"
import { handleStripeEvent } from "@/lib/payments/stripe-webhooks"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — stage 3 Stripe layer against the REAL database with the Stripe SDK
 * boundary mocked (lib/payments/stripe). Live test-mode verification happens
 * once the owner provides sk_test keys; these tests pin OUR half: config
 * gates, Payment rows, webhook idempotency, obligation truth.
 */

const fakeStripe = {
  accounts: { create: vi.fn() },
  accountLinks: { create: vi.fn() },
  paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() },
  refunds: { create: vi.fn() },
}

// The webhook route verifies signatures through this boundary too: signature
// "good" parses the body, anything else throws like the SDK would.
vi.mock("@/lib/payments/stripe", () => {
  class StripeNotConfiguredError extends Error {
    code = "STRIPE_NOT_CONFIGURED" as const
  }
  return {
    StripeNotConfiguredError,
    stripeConfigured: () => true,
    getStripe: () => fakeStripe,
    constructWebhookEvent: (rawBody: string, signature: string) => {
      if (signature !== "good") throw new Error("Invalid signature")
      return JSON.parse(rawBody)
    },
  }
})

let world: BuiltWorld
let tenantId: string
let ownerId: string
let parentId: string
let playerId: string
let obligationId: string
let intentSeq = 0

const startCheckout = (id: string, body: unknown = {}) =>
  checkout(jsonRequest(`/api/obligations/${id}/checkout`, body) as any, { params: { id } })
const sendWebhook = (event: unknown, signature = "good") =>
  webhook(
    new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: JSON.stringify(event),
    }) as any
  )

beforeAll(async () => {
  world = await buildWorld({ seed: 1112, clubs: [{ teams: [{}] }] })
  tenantId = world.clubs[0].tenantId
  ownerId = world.clubs[0].owner.id
  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  parentId = family.parent.id
  playerId = family.players[0].id

  // A $100 obligation via a real paid-tryout signup
  const tryout = await createTryout(world.ctx, { tenantId, fee: 100 })
  actAs(parentId)
  const signup = await (
    await signupPost(jsonRequest(`/api/tryouts/${tryout.id}/signup`, { playerId }) as any, {
      params: { id: tryout.id },
    })
  ).json()
  obligationId = (
    await prisma.paymentObligation.findUniqueOrThrow({
      where: {
        referenceType_referenceId: { referenceType: "TryoutSignup", referenceId: signup.id },
      },
    })
  ).id
})

beforeEach(() => {
  fakeStripe.accounts.create.mockReset().mockResolvedValue({ id: "acct_test_1" })
  fakeStripe.accountLinks.create
    .mockReset()
    .mockResolvedValue({ url: "https://connect.stripe.com/setup/test" })
  fakeStripe.paymentIntents.create.mockReset().mockImplementation(async (args: any) => ({
    id: `pi_test_${++intentSeq}`,
    client_secret: `pi_test_${intentSeq}_secret`,
    amount: args.amount,
    status: "requires_payment_method",
  }))
  fakeStripe.paymentIntents.retrieve.mockReset()
  fakeStripe.paymentIntents.cancel.mockReset().mockResolvedValue({})
  fakeStripe.refunds.create.mockReset().mockResolvedValue({ id: "re_test_1", status: "succeeded" })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("Connect onboarding", () => {
  it("creates the Express account, stores it on the config, and returns the onboarding link", async () => {
    actAs(ownerId)
    const res = await connectStart(
      jsonRequest(`/api/clubs/${tenantId}/payment-config/connect`) as any,
      { params: { id: tenantId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain("connect.stripe.com")
    expect(body.accountId).toBe("acct_test_1")

    const config = await prisma.paymentConfig.findUnique({ where: { tenantId } })
    expect(config!.stripeAccountId).toBe("acct_test_1")
    expect(config!.stripeAccountStatus).toBe("pending")
  })

  it("account.updated webhook flips the status to active once charges are enabled", async () => {
    const res = await sendWebhook({
      type: "account.updated",
      data: { object: { id: "acct_test_1", charges_enabled: true, details_submitted: true } },
    })
    expect(res.status).toBe(200)
    const config = await prisma.paymentConfig.findUnique({ where: { tenantId } })
    expect(config!.stripeAccountStatus).toBe("active")
  })

  it("rejects onboarding for non-managers", async () => {
    actAs(parentId)
    const res = await connectStart(
      jsonRequest(`/api/clubs/${tenantId}/payment-config/connect`) as any,
      { params: { id: tenantId } }
    )
    expect(res.status).toBe(403)
  })
})

describe("checkout gates", () => {
  it("400s while the merchant has no online mode", async () => {
    await prisma.paymentConfig.update({ where: { tenantId }, data: { onlineMode: "NONE" } })
    actAs(parentId)
    const res = await startCheckout(obligationId)
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("ONLINE_NOT_AVAILABLE")
  })

  it("400s in CONNECT_DIRECT until the connected account is active", async () => {
    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { onlineMode: "CONNECT_DIRECT", stripeAccountStatus: "pending" },
    })
    actAs(parentId)
    expect((await (await startCheckout(obligationId)).json()).code).toBe("ACCOUNT_NOT_READY")
    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { stripeAccountStatus: "active" },
    })
  })

  it("only the payer can start checkout; amounts above the remaining are rejected", async () => {
    actAs(ownerId)
    expect((await startCheckout(obligationId)).status).toBe(403)
    actAs(parentId)
    expect((await (await startCheckout(obligationId, { amount: 500 })).json()).code).toBe(
      "INVALID_AMOUNT"
    )
  })
})

describe("direct charge lifecycle", () => {
  let paymentId: string
  let intentId: string

  it("creates the PaymentIntent on the connected account with our application fee", async () => {
    // 2.5% + $0.30 platform fee on $40
    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { platformFeeBps: 250, platformFeeFlat: 0.3 },
    })
    actAs(parentId)
    const res = await startCheckout(obligationId, { amount: 40 })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toContain("_secret")
    paymentId = body.paymentId

    const call = fakeStripe.paymentIntents.create.mock.calls[0]
    expect(call[0].amount).toBe(4000)
    expect(call[0].application_fee_amount).toBe(130) // 2.5% of 40 = 1.00, + 0.30
    expect(call[1]).toEqual({ stripeAccount: "acct_test_1" })

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    intentId = payment!.stripePaymentIntentId!
    expect(payment!.status).toBe("PENDING")
    expect(payment!.method).toBe("STRIPE")
    expect(Number(payment!.platformFee)).toBe(1.3)
    expect(payment!.stripeAccountId).toBe("acct_test_1")
  })

  it("payment_intent.succeeded marks the payment and moves the obligation — idempotently", async () => {
    const event = {
      type: "payment_intent.succeeded",
      data: { object: { id: intentId, latest_charge: "ch_test_1" } },
    }
    expect((await sendWebhook(event)).status).toBe(200)
    expect((await sendWebhook(event)).status).toBe(200) // duplicate delivery

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment!.status).toBe("SUCCEEDED")
    expect(payment!.stripeChargeId).toBe("ch_test_1")

    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PARTIALLY_PAID") // 40 of 100
  })

  it("a failed intent never regresses a success; a fresh pending one fails cleanly", async () => {
    // late out-of-order failure for the SAME intent → ignored
    await handleStripeEvent({
      type: "payment_intent.payment_failed",
      data: { object: { id: intentId } },
    })
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment!.status).toBe("SUCCEEDED")

    // a new checkout whose intent fails → FAILED, obligation unchanged
    actAs(parentId)
    const res = await startCheckout(obligationId, { amount: 10 })
    const { paymentId: p2 } = await res.json()
    const intent2 = (await prisma.payment.findUnique({ where: { id: p2 } }))!
      .stripePaymentIntentId!
    await handleStripeEvent({
      type: "payment_intent.payment_failed",
      data: { object: { id: intent2 } },
    })
    expect((await prisma.payment.findUnique({ where: { id: p2 } }))!.status).toBe("FAILED")
    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PARTIALLY_PAID")
  })

  it("merchant-initiated online refund goes through Stripe on the connected account", async () => {
    actAs(ownerId)
    const res = await paymentAction(
      jsonRequest(`/api/payments/${paymentId}`, { action: "refund" }, "PATCH") as any,
      { params: { id: paymentId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("REFUNDED")
    expect(body.refundAmount).toBe(40)

    const call = fakeStripe.refunds.create.mock.calls[0]
    expect(call[0]).toEqual({ payment_intent: intentId, amount: 4000 })
    expect(call[1]).toEqual({ stripeAccount: "acct_test_1" })

    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PENDING") // the 40 came back off the books
  })

  it("charge.refunded webhook is idempotent against the optimistic local refund", async () => {
    const res = await sendWebhook({
      type: "charge.refunded",
      data: {
        object: { id: "ch_test_1", payment_intent: intentId, amount: 4000, amount_refunded: 4000 },
      },
    })
    expect(res.status).toBe(200)
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment!.status).toBe("REFUNDED")
    expect(Number(payment!.refundAmount)).toBe(40)
  })
})

describe("webhook endpoint hardening", () => {
  it("rejects bad signatures and missing headers", async () => {
    expect((await sendWebhook({ type: "payment_intent.succeeded" }, "bad")).status).toBe(400)
    const noHeader = await webhook(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      }) as any
    )
    expect(noHeader.status).toBe(400)
  })

  it("acknowledges unknown event types without touching anything", async () => {
    const res = await sendWebhook({ type: "customer.created", data: { object: {} } })
    expect(res.status).toBe(200)
    expect((await res.json()).handled).toBe(false)
  })
})
