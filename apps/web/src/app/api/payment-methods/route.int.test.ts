import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET, POST } from "./route"
import { PATCH, DELETE } from "./[id]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — card-on-file (payments v2 Stage A) with the Stripe boundary faked.
 * A per-customer in-memory card store proves: SetupIntent creation, listing,
 * make-default, detach, and — the security bit — a card is only visible/
 * mutable by the customer it belongs to. Live test-mode charge verification
 * is the manual QA pass.
 */

// customerId -> { pmId -> {brand,last4,...} }, plus default per customer
const store = new Map<string, { cards: Map<string, any>; def: string | null }>()
let custSeq = 0
let pmSeq = 0

const fakeStripe = {
  customers: {
    create: vi.fn(async () => {
      const id = `cus_test_${++custSeq}`
      store.set(id, { cards: new Map(), def: null })
      return { id }
    }),
    retrieve: vi.fn(async (id: string) => ({
      id,
      invoice_settings: { default_payment_method: store.get(id)?.def ?? null },
    })),
    update: vi.fn(async (id: string, args: any) => {
      const c = store.get(id)!
      c.def = args.invoice_settings.default_payment_method
      return { id }
    }),
  },
  setupIntents: {
    create: vi.fn(async () => ({ client_secret: `seti_test_${++pmSeq}_secret` })),
  },
  paymentMethods: {
    list: vi.fn(async ({ customer }: any) => ({
      data: [...(store.get(customer)?.cards.values() ?? [])],
    })),
    retrieve: vi.fn(async (pmId: string) => {
      for (const [cust, c] of store) if (c.cards.has(pmId)) return { id: pmId, customer: cust }
      return { id: pmId, customer: null }
    }),
    detach: vi.fn(async (pmId: string) => {
      for (const c of store.values()) c.cards.delete(pmId)
      return { id: pmId }
    }),
  },
}

vi.mock("@/lib/payments/stripe", () => {
  class StripeNotConfiguredError extends Error {
    code = "STRIPE_NOT_CONFIGURED" as const
  }
  return { StripeNotConfiguredError, stripeConfigured: () => true, getStripe: () => fakeStripe }
})

/** Test helper: drop a card straight into the fake store for a customer. */
function seedCard(customerId: string, brand: string, last4: string) {
  const id = `pm_test_${++pmSeq}`
  store.get(customerId)!.cards.set(id, {
    id,
    card: { brand, last4, exp_month: 12, exp_year: 2030 },
  })
  return id
}

let world: BuiltWorld
let parentAId: string
let parentBId: string

const list = () => GET()
const startAdd = () => POST(jsonRequest("/api/payment-methods", {}))
const makeDefault = (id: string) =>
  PATCH(jsonRequest(`/api/payment-methods/${id}`, { action: "makeDefault" }, "PATCH"), {
    params: { id },
  })
const remove = (id: string) =>
  DELETE(jsonRequest(`/api/payment-methods/${id}`, undefined, "DELETE"), { params: { id } })

beforeAll(async () => {
  world = await buildWorld({ seed: 1128, clubs: [{ teams: [] }] })
  const a = await createParentWithChildren(world.ctx, { children: [] })
  const b = await createParentWithChildren(world.ctx, { children: [] })
  parentAId = a.parent.id
  parentBId = b.parent.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("payment methods (integration)", () => {
  it("rejects the unauthenticated", async () => {
    actAs(null)
    expect((await list()).status).toBe(401)
    expect((await startAdd()).status).toBe(401)
  })

  it("starting add creates a Stripe customer + SetupIntent, stored on the user", async () => {
    actAs(parentAId)
    const res = await startAdd()
    expect(res.status).toBe(200)
    expect((await res.json()).clientSecret).toMatch(/^seti_/)
    const user = await prisma.user.findUnique({
      where: { id: parentAId },
      select: { stripeCustomerId: true },
    })
    expect(user?.stripeCustomerId).toMatch(/^cus_/)
  })

  it("lists saved cards and flips the default", async () => {
    const user = await prisma.user.findUnique({
      where: { id: parentAId },
      select: { stripeCustomerId: true },
    })
    const cust = user!.stripeCustomerId!
    const visa = seedCard(cust, "visa", "4242")
    const mc = seedCard(cust, "mastercard", "4444")

    actAs(parentAId)
    let cards = (await (await list()).json()).cards
    expect(cards).toHaveLength(2)
    expect(cards.every((c: any) => !c.isDefault)).toBe(true)

    expect((await makeDefault(visa)).status).toBe(200)
    cards = (await (await list()).json()).cards
    expect(cards.find((c: any) => c.id === visa).isDefault).toBe(true)
    expect(cards.find((c: any) => c.id === mc).isDefault).toBe(false)
  })

  it("a different user cannot see, default, or detach your card", async () => {
    const a = await prisma.user.findUnique({
      where: { id: parentAId },
      select: { stripeCustomerId: true },
    })
    const someCard = [...store.get(a!.stripeCustomerId!)!.cards.keys()][0]

    actAs(parentBId)
    // B has no customer yet → empty list, and can't touch A's card
    expect((await (await list()).json()).cards).toEqual([])
    expect((await makeDefault(someCard)).status).toBe(404)
    expect((await remove(someCard)).status).toBe(404)
  })

  it("owner detaches a card", async () => {
    const a = await prisma.user.findUnique({
      where: { id: parentAId },
      select: { stripeCustomerId: true },
    })
    const cust = a!.stripeCustomerId!
    const before = (await (async () => {
      actAs(parentAId)
      return (await (await list()).json()).cards
    })()).length
    const victim = [...store.get(cust)!.cards.keys()][0]

    actAs(parentAId)
    expect((await remove(victim)).status).toBe(200)
    expect((await (await list()).json()).cards).toHaveLength(before - 1)
  })
})
