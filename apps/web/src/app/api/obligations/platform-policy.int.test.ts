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
import { POST as recordPayment } from "./[id]/payments/route"
import { PATCH as paymentAction } from "@/app/api/payments/[id]/route"
import {
  GET as configGet,
  PATCH as configPatch,
} from "@/app/api/clubs/[id]/payment-config/route"
import { handleStripeEvent } from "@/lib/payments/stripe-webhooks"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — configurable payment policy (docs/payments-design.md):
 * PlatformSettings.pay* defaults → per-club nullable overrides → effective
 * config, PLATFORM_COLLECT as instant-settlement destination charges, and
 * the offline-collection policy gate. Stripe SDK boundary mocked.
 * Seed registry: 1113.
 */

const fakeStripe = {
  accounts: { create: vi.fn() },
  accountLinks: { create: vi.fn() },
  paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() },
  refunds: { create: vi.fn() },
}

vi.mock("@/lib/payments/stripe", () => {
  class StripeNotConfiguredError extends Error {
    code = "STRIPE_NOT_CONFIGURED" as const
  }
  return {
    StripeNotConfiguredError,
    stripeConfigured: () => true,
    getStripe: () => fakeStripe,
    constructWebhookEvent: (rawBody: string) => JSON.parse(rawBody),
  }
})

let world: BuiltWorld
let tenantId: string
let ownerId: string
let parentId: string
let obligationId: string
let intentSeq = 0

const ACCOUNT = "acct_policy_1"

const startCheckout = (id: string, body: unknown = {}) =>
  checkout(jsonRequest(`/api/obligations/${id}/checkout`, body) as any, { params: { id } })
const recordOffline = (id: string, body: unknown) =>
  recordPayment(jsonRequest(`/api/obligations/${id}/payments`, body) as any, { params: { id } })
const patchConfig = (body: unknown) =>
  configPatch(jsonRequest(`/api/clubs/${tenantId}/payment-config`, body, "PATCH") as any, {
    params: { id: tenantId },
  })

async function setPolicy(data: Record<string, unknown>) {
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabledCountries: ["CA"], ...data },
    update: data,
  })
}

const POLICY_DEFAULTS = {
  payOfflineAllowed: true,
  payConnectAllowed: true,
  payPlatformCollectAllowed: false,
  payDefaultOnlineMode: "NONE" as const,
  payPlatformFeeBps: 0,
  payPlatformFeeFlat: 0,
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1113, clubs: [{ teams: [{}] }] })
  tenantId = world.clubs[0].tenantId
  ownerId = world.clubs[0].owner.id
  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  parentId = family.parent.id

  const tryout = await createTryout(world.ctx, { tenantId, fee: 100 })
  const signup = await prisma.tryoutSignup.create({
    data: {
      tryoutId: tryout.id,
      userId: parentId,
      playerId: family.players[0].id,
      playerName: "Policy Test Player",
      playerAge: 12,
      playerGender: "MALE",
      status: "CONFIRMED",
    },
  })
  const obligation = await prisma.paymentObligation.create({
    data: {
      payerUserId: parentId,
      payeeTenantId: tenantId,
      referenceType: "TryoutSignup",
      referenceId: signup.id,
      description: "Tryout fee",
      amount: 100,
      currency: "CAD",
    },
  })
  obligationId = obligation.id

  // The club has finished Connect onboarding but has configured nothing —
  // every policy field on its row is null, so the platform defaults rule.
  await prisma.paymentConfig.create({
    data: { tenantId, stripeAccountId: ACCOUNT, stripeAccountStatus: "active" },
  })
})

beforeEach(async () => {
  fakeStripe.paymentIntents.create.mockReset().mockImplementation(async (args: any) => ({
    id: `pi_policy_${++intentSeq}`,
    client_secret: `pi_policy_${intentSeq}_secret`,
    amount: args.amount,
    status: "requires_payment_method",
  }))
  fakeStripe.paymentIntents.retrieve.mockReset().mockRejectedValue(new Error("not found"))
  fakeStripe.paymentIntents.cancel.mockReset().mockResolvedValue({})
  fakeStripe.refunds.create.mockReset().mockResolvedValue({ id: "re_policy", status: "succeeded" })
})

afterAll(async () => {
  await setPolicy(POLICY_DEFAULTS)
  if (world) await destroyWorld(world.ctx)
})

describe("platform default → PLATFORM_COLLECT destination charges", () => {
  let paymentId: string
  let intentId: string

  it("with no per-club choice, checkout follows the platform default mode as a destination charge", async () => {
    await setPolicy({
      payPlatformCollectAllowed: true,
      payDefaultOnlineMode: "PLATFORM_COLLECT",
      payPlatformFeeBps: 250,
      payPlatformFeeFlat: 0.3,
    })

    actAs(parentId)
    const res = await startCheckout(obligationId, { amount: 40 })
    expect(res.status).toBe(200)
    paymentId = (await res.json()).paymentId

    // Intent on the PLATFORM account (no stripeAccount option), fee withheld,
    // club's share transferring to their connected account at charge time.
    const call = fakeStripe.paymentIntents.create.mock.calls[0]
    expect(call[0].amount).toBe(4000)
    expect(call[0].application_fee_amount).toBe(130) // 2.5% of $40 + $0.30
    expect(call[0].transfer_data).toEqual({ destination: ACCOUNT })
    expect(call[0].on_behalf_of).toBe(ACCOUNT)
    expect(call[1]).toBeUndefined()

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    intentId = payment!.stripePaymentIntentId!
    expect(payment!.stripeAccountId).toBeNull()
    expect(payment!.stripeDestinationAccountId).toBe(ACCOUNT)
    expect(Number(payment!.platformFee)).toBe(1.3)
  })

  it("success webhook drives the same obligation engine", async () => {
    await handleStripeEvent({
      type: "payment_intent.succeeded",
      data: { object: { id: intentId, latest_charge: "ch_policy_1" } },
    })
    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PARTIALLY_PAID")
  })

  it("refunds reverse the transfer and return the platform fee", async () => {
    actAs(ownerId)
    const res = await paymentAction(
      jsonRequest(`/api/payments/${paymentId}`, { action: "refund" }, "PATCH") as any,
      { params: { id: paymentId } }
    )
    expect(res.status).toBe(200)

    const call = fakeStripe.refunds.create.mock.calls[0]
    expect(call[0]).toEqual({
      payment_intent: intentId,
      amount: 4000,
      reverse_transfer: true,
      refund_application_fee: true,
    })
    expect(call[1]).toBeUndefined() // platform account, not the connected one

    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PENDING")
  })

  it("platform-collect checkout needs a ready connected account to receive the transfer", async () => {
    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { stripeAccountStatus: "pending" },
    })
    actAs(parentId)
    expect((await (await startCheckout(obligationId)).json()).code).toBe("ACCOUNT_NOT_READY")
    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { stripeAccountStatus: "active" },
    })
  })

  it("a mode the allowlist has revoked clamps to the allowed one", async () => {
    // Club explicitly chose their own Stripe account, then the platform
    // forced them through platform-collect.
    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { onlineMode: "CONNECT_DIRECT", connectAllowed: false },
    })
    actAs(parentId)
    const res = await startCheckout(obligationId, { amount: 10 })
    expect(res.status).toBe(200)
    const call = fakeStripe.paymentIntents.create.mock.calls[0]
    expect(call[0].transfer_data).toEqual({ destination: ACCOUNT })

    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { onlineMode: null, connectAllowed: null },
    })
  })
})

describe("offline collection policy", () => {
  it("a platform-wide offline ban blocks recording cash", async () => {
    await setPolicy({ payOfflineAllowed: false })
    actAs(ownerId)
    const res = await recordOffline(obligationId, { amount: 10, method: "CASH" })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("OFFLINE_NOT_AVAILABLE")
  })

  it("a per-club override restores offline for that club only", async () => {
    await prisma.paymentConfig.update({ where: { tenantId }, data: { offlineAllowed: true } })
    actAs(ownerId)
    const res = await recordOffline(obligationId, { amount: 10, method: "CASH" })
    expect(res.status).toBe(201)
    await prisma.paymentConfig.update({ where: { tenantId }, data: { offlineAllowed: null } })
    await setPolicy({ payOfflineAllowed: true })
  })

  it("a method outside the club's accepted list is rejected", async () => {
    await prisma.paymentConfig.update({ where: { tenantId }, data: { offlineMethods: ["CASH"] } })
    actAs(ownerId)
    const res = await recordOffline(obligationId, { amount: 5, method: "ETRANSFER" })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("METHOD_NOT_ALLOWED")
    await prisma.paymentConfig.update({
      where: { tenantId },
      data: { offlineMethods: ["CASH", "ETRANSFER"] },
    })
  })
})

describe("per-club override API (tri-state)", () => {
  it("club owners cannot touch admin fields", async () => {
    actAs(ownerId)
    const res = await patchConfig({ connectAllowed: false })
    expect(res.status).toBe(403)
  })

  it("platform admin overrides a field, then null returns it to inheritance", async () => {
    await prisma.userRole.create({ data: { userId: ownerId, role: "PlatformAdmin" } })
    actAs(ownerId)

    let res = await patchConfig({ connectAllowed: false })
    expect(res.status).toBe(200)
    expect((await res.json()).config.connectAllowed).toBe(false)

    res = await patchConfig({ connectAllowed: null })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.connectAllowed).toBe(true) // back to the platform default
    expect(body.overrides.connectAllowed).toBeNull()

    await prisma.userRole.deleteMany({ where: { userId: ownerId, role: "PlatformAdmin" } })
  })

  it("a club cannot choose a mode the effective allowlist bans", async () => {
    await setPolicy({ payPlatformCollectAllowed: false })
    actAs(ownerId)
    const res = await patchConfig({ onlineMode: "PLATFORM_COLLECT" })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("MODE_NOT_ALLOWED")
  })

  it("GET exposes resolved config, raw overrides, and the platform policy", async () => {
    actAs(ownerId)
    const res = await configGet(
      jsonRequest(`/api/clubs/${tenantId}/payment-config`, undefined, "GET") as any,
      { params: { id: tenantId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.onlineMode).toBeDefined()
    expect(body.policy.payOfflineAllowed).toBe(true)
    expect(body.overrides).not.toBeUndefined()
  })
})
