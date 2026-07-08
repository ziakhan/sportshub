import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { PATCH } from "./[id]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — deposit-gated accept + installment schedule (payments v2 C/D). With
 * Stripe faked: accepting an INSTALLMENTS offer verifies the deposit intent,
 * records the deposit SUCCEEDED, and pre-creates a Payment + invoice per
 * installment. Live test-mode charge/webhook verification is manual QA.
 */

let invoiceSeq = 0
const fakeStripe = {
  paymentIntents: {
    retrieve: vi.fn(async (id: string) => ({
      id,
      status: "succeeded",
      customer: "cus_test",
      payment_method: "pm_test",
    })),
  },
  customers: { create: vi.fn(async () => ({ id: "cus_test" })), update: vi.fn(async () => ({})) },
  invoiceItems: { create: vi.fn(async () => ({ id: `ii_${++invoiceSeq}` })) },
  invoices: { create: vi.fn(async () => ({ id: `in_${++invoiceSeq}` })) },
}

vi.mock("@/lib/payments/stripe", () => {
  class StripeNotConfiguredError extends Error {}
  return {
    StripeNotConfiguredError,
    stripeConfigured: () => true,
    getStripe: () => fakeStripe,
  }
})

let world: BuiltWorld
let parentId: string
let playerId: string
let offerId: string
let optionId: string

const accept = (body: unknown) =>
  PATCH(jsonRequest(`/api/offers/${offerId}`, body, "PATCH"), { params: { id: offerId } })

beforeAll(async () => {
  world = await buildWorld({ seed: 1129, clubs: [{ teams: [{ headCoach: true }] }] })
  const club = world.clubs[0]
  const teamId = club.teams[0].id

  // Club takes online money via destination charges
  await prisma.paymentConfig.create({
    data: {
      tenantId: club.tenantId,
      onlineMode: "PLATFORM_COLLECT",
      stripeAccountId: "acct_test",
      stripeAccountStatus: "active",
    },
  })

  const fam = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  parentId = fam.parent.id
  playerId = fam.players[0].id

  // A pending offer with a New-Player package on a $3,000 plan: $750 deposit + 3×$750
  const offer = await (prisma as any).offer.create({
    data: {
      teamId,
      playerId,
      status: "PENDING",
      seasonFee: 3000,
      installments: 4,
      includesUniform: true,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
    select: { id: true },
  })
  offerId = offer.id
  const option = await (prisma as any).offerOption.create({
    data: {
      offerId: offer.id,
      label: "New Player",
      seasonFee: 3000,
      installments: 4,
      includesUniform: true,
      sortOrder: 0,
      allowFullPay: true,
      allowInstallments: true,
      depositAmount: 750,
      installmentTerms: {
        create: [
          { sequence: 1, amount: 750, dueDate: new Date(2026, 8, 1) },
          { sequence: 2, amount: 750, dueDate: new Date(2026, 9, 1) },
          { sequence: 3, amount: 750, dueDate: new Date(2026, 10, 1) },
        ],
      },
    },
    select: { id: true },
  })
  optionId = option.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("installment accept (integration)", () => {
  it("accepts with a plan, records the deposit, and schedules the installments", async () => {
    actAs(parentId)
    const res = await accept({
      action: "accept",
      optionId,
      paymentPlan: "INSTALLMENTS",
      depositPaymentIntentId: "pi_deposit_test",
      uniformSize: "AM",
      jerseyPref1: 7,
    })
    expect(res.status).toBe(200)

    const offer = await (prisma as any).offer.findUnique({
      where: { id: offerId },
      select: { status: true, paymentPlan: true, chosenOptionId: true },
    })
    expect(offer.status).toBe("ACCEPTED")
    expect(offer.paymentPlan).toBe("INSTALLMENTS")

    // Kid rostered
    const tp = await prisma.teamPlayer.findFirst({ where: { playerId }, select: { status: true } })
    expect(tp?.status).toBe("ACTIVE")

    // Deposit recorded SUCCEEDED (#1), 3 installments PENDING w/ invoices (#2-4)
    const payments = await (prisma as any).payment.findMany({
      where: { relatedOfferId: offerId },
      orderBy: { installmentNumber: "asc" },
      select: { amount: true, status: true, installmentNumber: true, stripeInvoiceId: true, dueDate: true },
    })
    expect(payments).toHaveLength(4)
    const deposit = payments[0]
    expect(deposit.installmentNumber).toBe(1)
    expect(deposit.status).toBe("SUCCEEDED")
    expect(Number(deposit.amount)).toBe(750)

    const scheduled = payments.slice(1)
    expect(scheduled.every((p: any) => p.status === "PENDING")).toBe(true)
    expect(scheduled.every((p: any) => p.stripeInvoiceId && p.dueDate)).toBe(true)
    expect(scheduled.reduce((s: number, p: any) => s + Number(p.amount), 0)).toBe(2250)

    // The obligation covers the full fee
    const obligation = await prisma.paymentObligation.findFirst({
      where: { referenceType: "Offer", referenceId: offerId },
      select: { amount: true },
    })
    expect(Number(obligation?.amount)).toBe(3000)
  })

  it("rejects accept when the deposit intent didn't succeed", async () => {
    // Fresh pending offer
    const o2 = await (prisma as any).offer.create({
      data: {
        teamId: world.clubs[0].teams[0].id,
        playerId,
        status: "PENDING",
        seasonFee: 3000,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
      select: { id: true },
    })
    fakeStripe.paymentIntents.retrieve.mockResolvedValueOnce({
      id: "pi_x",
      status: "requires_payment_method",
      customer: "cus_test",
      payment_method: null,
    } as any)
    actAs(parentId)
    const res = await PATCH(
      jsonRequest(`/api/offers/${o2.id}`, {
        action: "accept",
        depositPaymentIntentId: "pi_x",
        jerseyPref1: 5,
      }, "PATCH"),
      { params: { id: o2.id } }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("DEPOSIT_NOT_PAID")
  })

  it("online club + a fee → accepting with NO payment is rejected (can't bypass)", async () => {
    const o3 = await (prisma as any).offer.create({
      data: {
        teamId: world.clubs[0].teams[0].id,
        playerId,
        status: "PENDING",
        seasonFee: 3000,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
      select: { id: true },
    })
    actAs(parentId)
    const res = await PATCH(
      jsonRequest(`/api/offers/${o3.id}`, { action: "accept", jerseyPref1: 8 }, "PATCH"),
      { params: { id: o3.id } }
    )
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("PAYMENT_REQUIRED")
  })
})
