import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { handleStripeEvent } from "./stripe-webhooks"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — installment invoice webhooks (payments v2 Stage G). invoice.paid
 * settles the Payment SUCCEEDED + receipt; invoice.payment_failed leaves it
 * PENDING (Stripe's Smart Retries keep trying) + a failure notice. The live
 * happy-path (real charge → webhook → SUCCEEDED) is verified in the manual
 * test-mode QA; this locks the handler logic deterministically.
 */

let world: BuiltWorld
let parentId: string
let tenantId: string
let obligationId: string

async function installment(invoiceId: string) {
  const p = await (prisma as any).payment.create({
    data: {
      obligationId,
      payerId: parentId,
      tenantId,
      amount: 375,
      currency: "USD",
      status: "PROCESSING",
      method: "STRIPE",
      stripeInvoiceId: invoiceId,
      installmentNumber: 2,
      paymentType: "SEASON_FEE",
      description: "Installment 1",
    },
    select: { id: true },
  })
  return p.id
}

const receipts = (type: string, paymentId: string) =>
  prisma.notification.count({ where: { type, referenceId: paymentId } })

beforeAll(async () => {
  world = await buildWorld({ seed: 1130, clubs: [{ teams: [] }] })
  const fam = await createParentWithChildren(world.ctx, { children: [] })
  parentId = fam.parent.id
  tenantId = world.clubs[0].tenantId
  const ob = await prisma.paymentObligation.create({
    data: {
      payerUserId: parentId,
      payeeTenantId: tenantId,
      referenceType: "OfferQA",
      referenceId: `qa-${Date.now()}`,
      description: "QA",
      amount: 1000,
      currency: "USD",
    },
    select: { id: true },
  })
  obligationId = ob.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("installment invoice webhooks (integration)", () => {
  it("invoice.paid → Payment SUCCEEDED + receipt to the payer", async () => {
    const id = await installment("in_paid_qa")
    const res = await handleStripeEvent({
      type: "invoice.paid",
      data: { object: { id: "in_paid_qa", charge: "ch_qa", payment_intent: "pi_qa" } },
    })
    expect(res.handled).toBe(true)
    const p = await prisma.payment.findUnique({ where: { id }, select: { status: true } })
    expect(p?.status).toBe("SUCCEEDED")
    expect(await receipts("payment_receipt", id)).toBe(1)
  })

  it("invoice.payment_failed → stays PENDING (retryable) + failure notice", async () => {
    const id = await installment("in_fail_qa")
    const res = await handleStripeEvent({
      type: "invoice.payment_failed",
      data: { object: { id: "in_fail_qa" } },
    })
    expect(res.handled).toBe(true)
    const p = await prisma.payment.findUnique({ where: { id }, select: { status: true } })
    expect(p?.status).toBe("PROCESSING") // not hard-failed — Stripe retries
    expect(await receipts("payment_failed", id)).toBe(1)
  })

  it("invoice.paid is idempotent (redelivery doesn't double-receipt)", async () => {
    const id = await installment("in_dup_qa")
    await handleStripeEvent({ type: "invoice.paid", data: { object: { id: "in_dup_qa" } } })
    await handleStripeEvent({ type: "invoice.paid", data: { object: { id: "in_dup_qa" } } })
    expect(await receipts("payment_receipt", id)).toBe(1)
  })
})
