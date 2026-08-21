import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as payIntent } from "./[id]/pay-intent/route"
import { PATCH as respondOffer } from "./[id]/route"
import { PATCH as paymentAction } from "@/app/api/payments/[id]/route"
import { PATCH as obligationAction } from "@/app/api/obligations/[id]/route"
import { POST as offlineRecord } from "@/app/api/obligations/[id]/payments/route"
import { POST as checkout } from "@/app/api/obligations/[id]/checkout/route"
import { POST as connectStart } from "@/app/api/clubs/[id]/payment-config/connect/route"
import { chargeDueInstallments } from "@/lib/payments/scheduled"
import { handleStripeEvent } from "@/lib/payments/stripe-webhooks"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — the money-safety audit, locked (world seed 1152). Each scenario is the
 * audit's own words: a real attempt at the exact hole, refused, with the books
 * left honest.
 *
 * The through-line: the offer-accept rail must record money the way the
 * obligation rail does — a PENDING Payment row written when the card is hit,
 * bound to THIS offer at THIS amount, then verified and consumed exactly once.
 * The client's paymentPlan can pick deposit-vs-full; it can never dictate the
 * number, buy a different offer, or vanish a charge.
 */

let intentSeq = 0
let invoiceSeq = 0
const fakeStripe = {
  accounts: { create: vi.fn() },
  accountLinks: { create: vi.fn() },
  paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() },
  customers: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn() },
  paymentMethods: { list: vi.fn() },
  invoiceItems: { create: vi.fn() },
  invoices: {
    create: vi.fn(),
    retrieve: vi.fn(),
    finalizeInvoice: vi.fn(),
    voidInvoice: vi.fn(),
    del: vi.fn(),
  },
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
  }
})

let world: BuiltWorld
let tenantId: string
let ownerId: string
let teamId: string
let currency: string

const DAY = 86_400_000
const pastDue = (days: number) => new Date(Date.now() - days * DAY)

const payIntentReq = (offerId: string, body: unknown) =>
  payIntent(jsonRequest(`/api/offers/${offerId}/pay-intent`, body) as any, {
    params: { id: offerId },
  })
const acceptReq = (offerId: string, body: unknown) =>
  respondOffer(jsonRequest(`/api/offers/${offerId}`, body, "PATCH") as any, {
    params: { id: offerId },
  })
const refundReq = (paymentId: string, body: unknown) =>
  paymentAction(jsonRequest(`/api/payments/${paymentId}`, body, "PATCH") as any, {
    params: { id: paymentId },
  })
const waiveReq = (obId: string, body: unknown) =>
  obligationAction(jsonRequest(`/api/obligations/${obId}`, body, "PATCH") as any, {
    params: { id: obId },
  })
const offlineReq = (obId: string, body: unknown) =>
  offlineRecord(jsonRequest(`/api/obligations/${obId}/payments`, body) as any, {
    params: { id: obId },
  })
const checkoutReq = (obId: string, body: unknown = {}) =>
  checkout(jsonRequest(`/api/obligations/${obId}/checkout`, body) as any, { params: { id: obId } })
const connectReq = (id: string) =>
  connectStart(jsonRequest(`/api/clubs/${id}/payment-config/connect`) as any, { params: { id } })

async function child(age = 12): Promise<{ parentId: string; playerId: string }> {
  const fam = await createParentWithChildren(world.ctx, { children: [{ age }] })
  return { parentId: fam.parent.id, playerId: fam.players[0].id }
}

async function teamOffer(playerId: string, seasonFee: number): Promise<string> {
  const o = await (prisma as any).offer.create({
    data: {
      teamId,
      playerId,
      status: "PENDING",
      seasonFee,
      installments: 1,
      expiresAt: new Date(Date.now() + 7 * DAY),
    },
    select: { id: true },
  })
  return o.id
}

async function planOption(
  offerId: string,
  opts: { seasonFee: number; deposit: number; installments: number; due: Date; label?: string }
): Promise<string> {
  const each = Math.round(((opts.seasonFee - opts.deposit) / opts.installments) * 100) / 100
  const o = await (prisma as any).offerOption.create({
    data: {
      offerId,
      label: opts.label ?? "Plan",
      seasonFee: opts.seasonFee,
      installments: opts.installments + 1,
      sortOrder: 0,
      allowFullPay: true,
      allowInstallments: true,
      depositAmount: opts.deposit,
      installmentTerms: {
        create: Array.from({ length: opts.installments }, (_, i) => ({
          sequence: i + 1,
          amount: each,
          dueDate: opts.due,
        })),
      },
    },
    select: { id: true },
  })
  return o.id
}

/** Pay a plan deposit through pay-intent, then accept it — the real two calls. */
async function acceptInstallmentPlan(offerId: string, parentId: string, optionId: string) {
  actAs(parentId)
  const pi = await (await payIntentReq(offerId, { paymentPlan: "INSTALLMENTS", chosenOptionId: optionId })).json()
  const res = await acceptReq(offerId, {
    action: "accept",
    paymentPlan: "INSTALLMENTS",
    optionId,
    depositPaymentIntentId: pi.paymentIntentId,
    jerseyPref1: 7,
  })
  return { res, paymentIntentId: pi.paymentIntentId }
}

const obligationFor = (offerId: string) =>
  prisma.paymentObligation.findFirst({
    where: { referenceType: "Offer", referenceId: offerId },
    include: { payments: true },
  })

async function setPayments(enabled: boolean) {
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabledCountries: [], paymentsEnabled: enabled },
    update: { paymentsEnabled: enabled },
  })
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1152, clubs: [{ teams: [{ headCoach: true }] }] })
  tenantId = world.clubs[0].tenantId
  ownerId = world.clubs[0].owner.id
  teamId = world.clubs[0].teams[0].id
  currency = (
    await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currency: true } })
  ).currency

  // The club takes online money via destination charges (PLATFORM_COLLECT).
  await prisma.paymentConfig.create({
    data: {
      tenantId,
      onlineMode: "PLATFORM_COLLECT",
      stripeAccountId: "acct_scn",
      stripeAccountStatus: "active",
    },
  })
  await setPayments(true)
})

beforeEach(async () => {
  await setPayments(true)
  fakeStripe.accounts.create.mockReset().mockResolvedValue({ id: "acct_scn" })
  fakeStripe.accountLinks.create
    .mockReset()
    .mockResolvedValue({ url: "https://connect.stripe.com/setup/scn" })
  fakeStripe.paymentIntents.create
    .mockReset()
    .mockImplementation(async (args: any) => ({
      id: `pi_${++intentSeq}`,
      client_secret: `pi_${intentSeq}_secret`,
      amount: args.amount,
      status: args.confirm ? "succeeded" : "requires_payment_method",
    }))
  fakeStripe.paymentIntents.retrieve
    .mockReset()
    .mockImplementation(async (id: string) => ({
      id,
      status: "succeeded",
      customer: "cus_scn",
      payment_method: "pm_scn",
    }))
  fakeStripe.paymentIntents.cancel.mockReset().mockResolvedValue({})
  fakeStripe.customers.create.mockReset().mockResolvedValue({ id: "cus_scn" })
  fakeStripe.customers.update.mockReset().mockResolvedValue({})
  fakeStripe.customers.retrieve.mockReset().mockResolvedValue({ id: "cus_scn", invoice_settings: {} })
  fakeStripe.paymentMethods.list.mockReset().mockResolvedValue({ data: [] })
  fakeStripe.invoiceItems.create.mockReset().mockImplementation(async () => ({ id: `ii_${++invoiceSeq}` }))
  fakeStripe.invoices.create.mockReset().mockImplementation(async () => ({ id: `in_${++invoiceSeq}` }))
  // Freshly scheduled installments are drafts (auto_advance:false, not yet due).
  fakeStripe.invoices.retrieve.mockReset().mockImplementation(async (id: string) => ({ id, status: "draft" }))
  fakeStripe.invoices.finalizeInvoice.mockReset().mockResolvedValue({})
  fakeStripe.invoices.voidInvoice.mockReset().mockResolvedValue({})
  fakeStripe.invoices.del.mockReset().mockResolvedValue({})
  fakeStripe.refunds.create.mockReset().mockResolvedValue({ id: "re_scn", status: "succeeded" })
})

afterAll(async () => {
  await setPayments(true) // never leave the switch off for the next suite
  if (world) await destroyWorld(world.ctx)
})

describe("payments security audit (integration)", () => {
  it("1 — deposit tries to buy the whole season → DEPOSIT_AMOUNT_MISMATCH, nothing recorded", async () => {
    const { parentId, playerId } = await child()
    const offerId = await teamOffer(playerId, 1000)
    const optionId = await planOption(offerId, {
      seasonFee: 1000,
      deposit: 250,
      installments: 3,
      due: new Date(Date.now() + 30 * DAY),
    })

    // Charge the $250 deposit for real...
    actAs(parentId)
    const pi = await (
      await payIntentReq(offerId, { paymentPlan: "INSTALLMENTS", chosenOptionId: optionId })
    ).json()
    expect(pi.amountDue).toBe(250)

    // ...then try to accept as if the WHOLE $1000 were paid.
    const res = await acceptReq(offerId, {
      action: "accept",
      paymentPlan: "FULL",
      optionId,
      depositPaymentIntentId: pi.paymentIntentId,
      jerseyPref1: 7,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("DEPOSIT_AMOUNT_MISMATCH")

    // The offer never flipped, no debt was written, no roster spot was formed —
    // and no money was recorded AGAINST an obligation ("no Payment").
    const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { status: true } })
    expect(offer!.status).toBe("PENDING")
    expect(await obligationFor(offerId)).toBeNull()
    expect(await prisma.teamPlayer.count({ where: { teamId, playerId } })).toBe(0)
    // The $250 that WAS charged is still a recoverable, unconsumed row (H1).
    const deposit = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: pi.paymentIntentId },
      select: { amount: true, obligationId: true, relatedOfferId: true },
    })
    expect(Number(deposit!.amount)).toBe(250)
    expect(deposit!.obligationId).toBeNull()
    expect(deposit!.relatedOfferId).toBe(offerId)
  })

  it("2 — one family, two children, one payment → cross-offer reuse and cheap-for-expensive both refused", async () => {
    const fam = await createParentWithChildren(world.ctx, { children: [{ age: 12 }, { age: 12 }] })
    const parentId = fam.parent.id

    // Variant B: pay child A's $300 offer, try to accept child B's $900 offer
    // with the same intent → the row is bound to offer A (relatedOfferId /
    // metadata.offerId), so offer B refuses it.
    const offerA = await teamOffer(fam.players[0].id, 300)
    const offerB = await teamOffer(fam.players[1].id, 900)
    actAs(parentId)
    const piA = await (await payIntentReq(offerA, { paymentPlan: "FULL" })).json()
    const resB = await acceptReq(offerB, {
      action: "accept",
      paymentPlan: "FULL",
      depositPaymentIntentId: piA.paymentIntentId,
      jerseyPref1: 5,
    })
    expect(resB.status).toBe(400)
    expect((await resB.json()).code).toBe("WRONG_OFFER")
    expect((await prisma.offer.findUnique({ where: { id: offerB } }))!.status).toBe("PENDING")

    // Variant C: pay the CHEAP package, accept choosing the EXPENSIVE one → the
    // recorded amount no longer matches the plan being accepted.
    const cc = await child()
    const offerC = await teamOffer(cc.playerId, 300)
    const cheap = await (prisma as any).offerOption.create({
      data: { offerId: offerC, label: "Rec", seasonFee: 300, installments: 1, sortOrder: 0, allowFullPay: true },
      select: { id: true },
    })
    const dear = await (prisma as any).offerOption.create({
      data: { offerId: offerC, label: "Rep", seasonFee: 900, installments: 1, sortOrder: 1, allowFullPay: true },
      select: { id: true },
    })
    actAs(cc.parentId)
    const piC = await (await payIntentReq(offerC, { paymentPlan: "FULL", chosenOptionId: cheap.id })).json()
    expect(piC.amountDue).toBe(300)
    const resC = await acceptReq(offerC, {
      action: "accept",
      paymentPlan: "FULL",
      optionId: dear.id,
      depositPaymentIntentId: piC.paymentIntentId,
      jerseyPref1: 9,
    })
    expect(resC.status).toBe(400)
    expect((await resC.json()).code).toBe("DEPOSIT_AMOUNT_MISMATCH")
    expect(await obligationFor(offerC)).toBeNull()
  })

  it("3 — the fee the club forgave → waive voids invoices + cancels rows; cron finalizes zero", async () => {
    // A plan whose 3 installments are already due, so the cron would otherwise
    // charge them.
    const { parentId, playerId } = await child()
    const offerW = await teamOffer(playerId, 1000)
    const optW = await planOption(offerW, { seasonFee: 1000, deposit: 250, installments: 3, due: pastDue(2) })
    expect((await acceptInstallmentPlan(offerW, parentId, optW)).res.status).toBe(200)

    const obW = (await obligationFor(offerW))!
    const scheduledW = await prisma.payment.findMany({
      where: { obligationId: obW.id, status: "PENDING", installmentNumber: { gt: 1 } },
      select: { id: true, stripeInvoiceId: true },
    })
    expect(scheduledW).toHaveLength(3)

    // A SEPARATE, live plan the club did NOT forgive — the cron must still
    // charge this one (the guard is selective, not a blanket off-switch).
    const live = await child()
    const offerX = await teamOffer(live.playerId, 500)
    const optX = await planOption(offerX, { seasonFee: 500, deposit: 200, installments: 1, due: pastDue(2) })
    expect((await acceptInstallmentPlan(offerX, live.parentId, optX)).res.status).toBe(200)
    const obX = (await obligationFor(offerX))!
    const scheduledX = await prisma.payment.findFirst({
      where: { obligationId: obX.id, status: "PENDING", installmentNumber: { gt: 1 } },
      select: { id: true },
    })

    // The club waives offer W.
    actAs(ownerId)
    const waive = await waiveReq(obW.id, { action: "waive", reason: "financial aid" })
    expect(waive.status).toBe(200)
    expect((await waive.json()).status).toBe("WAIVED")

    // Its installment rows are CANCELLED and their draft invoices deleted.
    const cancelled = await prisma.payment.findMany({
      where: { id: { in: scheduledW.map((p) => p.id) } },
      select: { status: true },
    })
    expect(cancelled.every((p) => p.status === "CANCELLED")).toBe(true)
    expect(fakeStripe.invoices.del).toHaveBeenCalledTimes(3)

    // The cron now runs. It finalizes offer X's live installment and does NOT
    // touch offer W's cancelled ones.
    const run = await chargeDueInstallments(new Date())
    expect(run.finalized).toBeGreaterThanOrEqual(1)
    expect(
      (await prisma.payment.findUnique({ where: { id: scheduledX!.id }, select: { status: true } }))!
        .status
    ).toBe("PROCESSING")
    const afterCron = await prisma.payment.findMany({
      where: { id: { in: scheduledW.map((p) => p.id) } },
      select: { status: true },
    })
    expect(afterCron.every((p) => p.status === "CANCELLED")).toBe(true)

    // Early full payment reaches the same end: pay the balance so the
    // obligation settles, and the cron skips its still-PENDING installments.
    const early = await child()
    const offerY = await teamOffer(early.playerId, 800)
    const optY = await planOption(offerY, { seasonFee: 800, deposit: 200, installments: 3, due: pastDue(2) })
    expect((await acceptInstallmentPlan(offerY, early.parentId, optY)).res.status).toBe(200)
    const obY = (await obligationFor(offerY))!
    actAs(ownerId)
    // $200 deposit paid; record the remaining $600 → obligation PAID.
    expect((await offlineReq(obY.id, { amount: 600, method: "CASH" })).status).toBe(201)
    expect((await prisma.paymentObligation.findUnique({ where: { id: obY.id } }))!.status).toBe("PAID")
    const scheduledY = await prisma.payment.findMany({
      where: { obligationId: obY.id, installmentNumber: { gt: 1 } },
      select: { id: true, status: true },
    })
    await chargeDueInstallments(new Date())
    const afterY = await prisma.payment.findMany({
      where: { id: { in: scheduledY.map((p) => p.id) } },
      select: { status: true },
    })
    // Settled obligation → its installments are never finalized (stay PENDING).
    expect(afterY.every((p) => p.status === "PENDING")).toBe(true)
  })

  it("4 — parent walked away from the sheet → the charge is a recoverable, refundable row", async () => {
    const { parentId, playerId } = await child()
    const offerId = await teamOffer(playerId, 500)
    actAs(parentId)
    const pi = await (await payIntentReq(offerId, { paymentPlan: "FULL" })).json()
    expect(pi.paymentId).toBeTruthy()

    // The family never accepts. The charge exists as a PENDING row bound to the
    // offer, on the payer's ledger, tied to no obligation yet.
    const row = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: pi.paymentIntentId },
      select: { id: true, payerId: true, amount: true, status: true, obligationId: true, relatedOfferId: true, tenantId: true },
    })
    expect(row).not.toBeNull()
    expect(row!.payerId).toBe(parentId)
    expect(Number(row!.amount)).toBe(500)
    expect(row!.obligationId).toBeNull()
    expect(row!.relatedOfferId).toBe(offerId)
    // It shows up on the payer's /payments list (payerId scoped).
    const onLedger = await prisma.payment.count({
      where: { payerId: parentId, relatedOfferId: offerId },
    })
    expect(onLedger).toBe(1)

    // The card actually cleared (webhook) → the row settles, still standalone.
    await handleStripeEvent({
      type: "payment_intent.succeeded",
      data: { object: { id: pi.paymentIntentId, latest_charge: "ch_h1" } },
    })
    expect(
      (await prisma.payment.findUnique({ where: { id: row!.id }, select: { status: true } }))!.status
    ).toBe("SUCCEEDED")

    // And it is refundable — the money can be handed back through the product.
    actAs(ownerId)
    const refund = await refundReq(row!.id, { action: "refund" })
    expect(refund.status).toBe(200)
    expect((await refund.json()).status).toBe("REFUNDED")
    expect(fakeStripe.refunds.create).toHaveBeenCalledTimes(1)
  })

  it("5 — the U13 program with no team → teamless online pay works; minor routes to guardian, never 500", async () => {
    // Adult parent pays a TEAMLESS age-group offer (tryout-pool shape).
    const { parentId, playerId } = await child()
    const offer = await (prisma as any).offer.create({
      data: {
        teamId: null,
        tenantId,
        ageGroup: "U13",
        playerId,
        status: "PENDING",
        seasonFee: 450,
        installments: 1,
        expiresAt: new Date(Date.now() + 7 * DAY),
      },
      select: { id: true },
    })
    actAs(parentId)
    const piRes = await payIntentReq(offer.id, { paymentPlan: "FULL" })
    expect(piRes.status).toBe(200) // never a 500 for a teamless offer (H2)
    const pi = await piRes.json()
    expect(pi.amountDue).toBe(450)
    expect(
      (await prisma.payment.findUnique({ where: { stripePaymentIntentId: pi.paymentIntentId }, select: { tenantId: true } }))!
        .tenantId
    ).toBe(tenantId)

    const accept = await acceptReq(offer.id, {
      action: "accept",
      paymentPlan: "FULL",
      depositPaymentIntentId: pi.paymentIntentId,
    })
    expect(accept.status).toBe(200)
    const ob = (await obligationFor(offer.id))!
    expect(ob.payeeTenantId).toBe(tenantId) // right club on a teamless obligation
    expect(ob.status).toBe("PAID")

    // A 13-17 self-owned player never reaches a charge on a teamless offer: the
    // ask routes to their guardian (202), not a 500.
    const guardian = await createParentWithChildren(world.ctx, { children: [] })
    const kidUser = await prisma.user.create({
      data: { email: world.ctx.email("kid-u15"), passwordHash: "x", status: "ACTIVE", onboardedAt: new Date() },
    })
    const minor = await prisma.player.create({
      data: {
        firstName: "Teen",
        lastName: "Player",
        dateOfBirth: new Date("2011-05-01T12:00:00Z"), // ~15 by birth year
        gender: "MALE",
        parentId: guardian.parent.id,
        userId: kidUser.id,
        canLogin: true,
      },
    })
    const minorOffer = await (prisma as any).offer.create({
      data: {
        teamId: null,
        tenantId,
        ageGroup: "U16",
        playerId: minor.id,
        status: "PENDING",
        seasonFee: 300,
        installments: 1,
        expiresAt: new Date(Date.now() + 7 * DAY),
      },
      select: { id: true },
    })
    actAs(kidUser.id)
    const minorRes = await payIntentReq(minorOffer.id, { paymentPlan: "FULL" })
    expect(minorRes.status).toBe(202)
    expect((await minorRes.json()).routedToParent).toBe(true)
  })

  it("6 — treasurer double-clicked refund → exactly one Stripe refund; overpayment is refused", async () => {
    // A real settled Stripe charge (full offer accept links a SUCCEEDED row).
    const { parentId, playerId } = await child()
    const offerId = await teamOffer(playerId, 400)
    actAs(parentId)
    const pi = await (await payIntentReq(offerId, { paymentPlan: "FULL" })).json()
    expect(
      (await acceptReq(offerId, {
        action: "accept",
        paymentPlan: "FULL",
        depositPaymentIntentId: pi.paymentIntentId,
        jerseyPref1: 4,
      })).status
    ).toBe(200)
    const payment = await prisma.payment.findFirstOrThrow({
      where: { relatedOfferId: offerId, obligationId: { not: null }, status: "SUCCEEDED" },
      select: { id: true },
    })

    // Two clicks land at once.
    actAs(ownerId)
    const [a, b] = await Promise.all([
      refundReq(payment.id, { action: "refund" }),
      refundReq(payment.id, { action: "refund" }),
    ])
    const codes = [a.status, b.status].sort()
    expect(codes).toEqual([200, 400])
    expect(fakeStripe.refunds.create).toHaveBeenCalledTimes(1) // one refund, not two
    const after = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: { status: true, refundAmount: true },
    })
    expect(after!.status).toBe("REFUNDED")
    expect(Number(after!.refundAmount)).toBe(400)

    // Companion: an offline obligation is paid in full, then an extra payment is
    // attempted — the money guard refuses to record past what is owed.
    const ob = await prisma.paymentObligation.create({
      data: {
        payerUserId: parentId,
        payeeTenantId: tenantId,
        referenceType: "TryoutSignup",
        referenceId: `scn6-${Date.now()}`,
        description: "Camp fee",
        amount: 100,
        currency,
        status: "PENDING",
      },
    })
    expect((await offlineReq(ob.id, { amount: 100, method: "CASH" })).status).toBe(201)
    const over = await offlineReq(ob.id, { amount: 100, method: "CASH" })
    expect(over.status).toBe(400)
    expect((await over.json()).code).toBe("OVERPAYMENT")
  })

  it("7 — the kill switch → all new-money routes 503 while off, and resume when on", async () => {
    const { parentId, playerId } = await child()
    const offerId = await teamOffer(playerId, 600)
    // A standing obligation + a live SUCCEEDED payment to test checkout + refund.
    const ob = await prisma.paymentObligation.create({
      data: {
        payerUserId: parentId,
        payeeTenantId: tenantId,
        referenceType: "TryoutSignup",
        referenceId: `scn7-${Date.now()}`,
        description: "Registration",
        amount: 100,
        currency,
        status: "PENDING",
      },
    })
    const paid = await prisma.payment.create({
      data: {
        obligationId: ob.id,
        payerId: parentId,
        tenantId,
        amount: 50,
        currency,
        status: "SUCCEEDED",
        method: "STRIPE",
        stripePaymentIntentId: `pi_scn7_${Date.now()}`,
        paymentType: "TRYOUT_FEE",
        description: "Registration",
      },
      select: { id: true },
    })

    await setPayments(false)
    actAs(parentId)
    expect((await payIntentReq(offerId, { paymentPlan: "FULL" })).status).toBe(503)
    expect((await checkoutReq(ob.id, { amount: 10 })).status).toBe(503)
    actAs(ownerId)
    expect((await refundReq(paid.id, { action: "refund" })).status).toBe(503)
    expect((await connectReq(tenantId)).status).toBe(503)
    expect((await offlineReq(ob.id, { amount: 10, method: "CASH" })).status).toBe(503)
    // The cron skips its whole run — no invoice is finalized.
    const run = await chargeDueInstallments(new Date())
    expect(run.skipped).toBe(true)
    expect(run.finalized).toBe(0)
    expect(fakeStripe.invoices.finalizeInvoice).not.toHaveBeenCalled()

    // Flip it back on and money moves again.
    await setPayments(true)
    actAs(parentId)
    const resume = await payIntentReq(offerId, { paymentPlan: "FULL" })
    expect(resume.status).toBe(200)
    actAs(ownerId)
    expect((await connectReq(tenantId)).status).toBe(200)
  })
})
