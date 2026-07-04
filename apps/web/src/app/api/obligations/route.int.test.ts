import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createParentWithChildren,
  createTryout,
  createUser,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET as listObligations } from "./route"
import { PATCH as obligationAction } from "./[id]/route"
import { POST as recordPayment } from "./[id]/payments/route"
import { PATCH as paymentAction } from "@/app/api/payments/[id]/route"
import { POST as signupPost, DELETE as signupDelete } from "@/app/api/tryouts/[id]/signup/route"
import {
  GET as configGet,
  PATCH as configPatch,
} from "@/app/api/clubs/[id]/payment-config/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — payments phase 1 (docs/payments-design.md): OFFLINE mode end-to-end.
 * A paid tryout signup mints an obligation; the club records cash/e-transfer
 * against it; partial → paid (signup flips PAID), overpay guard, waive,
 * refund, cancel-unpaid; per-club payment config with admin-only allowlist.
 */

let world: BuiltWorld
let tenantId: string
let ownerId: string
let adminId: string
let parentId: string
let playerId: string
let paidTryoutId: string
let freeTryoutId: string

let signupId: string
let obligationId: string
let partialPaymentId: string

const signUp = (tryoutId: string, pId: string) =>
  signupPost(jsonRequest(`/api/tryouts/${tryoutId}/signup`, { playerId: pId }) as any, {
    params: { id: tryoutId },
  })
const record = (id: string, body: unknown) =>
  recordPayment(jsonRequest(`/api/obligations/${id}/payments`, body) as any, { params: { id } })
const act = (id: string, body: unknown) =>
  obligationAction(jsonRequest(`/api/obligations/${id}`, body, "PATCH") as any, { params: { id } })
const refund = (id: string, body: unknown) =>
  paymentAction(jsonRequest(`/api/payments/${id}`, body, "PATCH") as any, { params: { id } })
const list = (query: string) =>
  listObligations(new NextRequest(`http://localhost:3000/api/obligations?${query}`))
const getConfig = (id: string) =>
  configGet(new NextRequest(`http://localhost:3000/api/clubs/${id}/payment-config`), {
    params: { id },
  })
const patchConfig = (id: string, body: unknown) =>
  configPatch(jsonRequest(`/api/clubs/${id}/payment-config`, body, "PATCH") as any, {
    params: { id },
  })

beforeAll(async () => {
  world = await buildWorld({ seed: 1110, clubs: [{ teams: [{}] }] })
  tenantId = world.clubs[0].tenantId
  ownerId = world.clubs[0].owner.id

  adminId = (await createUser(world.ctx, { roles: [{ role: "PlatformAdmin" }] })).id

  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  parentId = family.parent.id
  playerId = family.players[0].id

  paidTryoutId = (await createTryout(world.ctx, { tenantId, fee: 25 })).id
  freeTryoutId = (await createTryout(world.ctx, { tenantId, fee: 0 })).id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("obligation creation (tryout exemplar)", () => {
  it("a paid tryout signup mints a PENDING obligation for the fee", async () => {
    actAs(parentId)
    const res = await signUp(paidTryoutId, playerId)
    expect(res.status).toBe(201)
    const body = await res.json()
    signupId = body.id
    expect(body.status).toBe("PENDING") // paid tryout → pending until paid

    const obligation = await prisma.paymentObligation.findUnique({
      where: { referenceType_referenceId: { referenceType: "TryoutSignup", referenceId: signupId } },
    })
    expect(obligation).not.toBeNull()
    obligationId = obligation!.id
    expect(Number(obligation!.amount)).toBe(25)
    expect(obligation!.status).toBe("PENDING")
    expect(obligation!.payerUserId).toBe(parentId)
    expect(obligation!.payeeTenantId).toBe(tenantId)
  })

  it("a free tryout signup creates no obligation", async () => {
    actAs(parentId)
    const res = await signUp(freeTryoutId, playerId)
    expect(res.status).toBe(201)
    const { id } = await res.json()
    const obligation = await prisma.paymentObligation.findUnique({
      where: { referenceType_referenceId: { referenceType: "TryoutSignup", referenceId: id } },
    })
    expect(obligation).toBeNull()
  })

  it("lists: payer sees it via mine=true, club via tenantId, stranger forbidden", async () => {
    actAs(parentId)
    const mine = await (await list("mine=true")).json()
    expect(mine.obligations.map((o: any) => o.id)).toContain(obligationId)
    expect(typeof mine.obligations[0].amount).toBe("number")

    actAs(ownerId)
    const club = await (await list(`tenantId=${tenantId}`)).json()
    expect(club.obligations.map((o: any) => o.id)).toContain(obligationId)

    actAs(parentId)
    expect((await list(`tenantId=${tenantId}`)).status).toBe(403)
  })
})

describe("offline payment lifecycle", () => {
  it("the payer cannot record payments — merchant side only", async () => {
    actAs(parentId)
    expect((await record(obligationId, { amount: 25, method: "CASH" })).status).toBe(403)
  })

  it("partial cash payment moves the obligation to PARTIALLY_PAID", async () => {
    actAs(ownerId)
    const res = await record(obligationId, { amount: 10, method: "CASH", note: "at the door" })
    expect(res.status).toBe(201)
    partialPaymentId = (await res.json()).id

    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PARTIALLY_PAID")
  })

  it("overpayment is rejected", async () => {
    actAs(ownerId)
    const res = await record(obligationId, { amount: 20, method: "CASH" })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("OVERPAYMENT")
  })

  it("paying the remainder completes the obligation AND flips the signup to PAID", async () => {
    actAs(ownerId)
    const res = await record(obligationId, { amount: 15, method: "ETRANSFER" })
    expect(res.status).toBe(201)

    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PAID")

    const signup = await prisma.tryoutSignup.findUnique({ where: { id: signupId } })
    expect(signup!.status).toBe("PAID")

    // fully paid → nothing more can be recorded
    expect((await record(obligationId, { amount: 1, method: "CASH" })).status).toBe(400)
  })

  it("refunding the partial payment reopens the obligation", async () => {
    actAs(ownerId)
    const res = await refund(partialPaymentId, { action: "refund" })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("REFUNDED")
    expect(body.refundAmount).toBe(10)

    const obligation = await prisma.paymentObligation.findUnique({ where: { id: obligationId } })
    expect(obligation!.status).toBe("PARTIALLY_PAID") // 15 of 25 remains paid

    // a refunded payment can't be refunded twice
    expect((await refund(partialPaymentId, { action: "refund" })).status).toBe(400)
  })

  it("waive closes what remains; nothing can be recorded afterward", async () => {
    actAs(ownerId)
    const res = await act(obligationId, { action: "waive", reason: "financial aid" })
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe("WAIVED")

    const blocked = await record(obligationId, { amount: 10, method: "CASH" })
    expect(blocked.status).toBe(400)
    expect((await blocked.json()).code).toBe("OBLIGATION_CLOSED")
  })

  it("cancelling an unpaid signup cancels its obligation", async () => {
    const family = await createParentWithChildren(world.ctx, { children: [{ age: 13 }] })
    actAs(family.parent.id)
    const signup = await (await signUp(paidTryoutId, family.players[0].id)).json()

    const del = await signupDelete(
      new NextRequest(
        `http://localhost:3000/api/tryouts/${paidTryoutId}/signup?signupId=${signup.id}`,
        { method: "DELETE" }
      ),
      { params: { id: paidTryoutId } }
    )
    expect(del.status).toBe(200)

    const obligation = await prisma.paymentObligation.findUnique({
      where: {
        referenceType_referenceId: { referenceType: "TryoutSignup", referenceId: signup.id },
      },
    })
    expect(obligation!.status).toBe("CANCELLED")
  })
})

describe("payment config", () => {
  it("returns defaults before any row exists; payer role is forbidden", async () => {
    actAs(ownerId)
    const res = await getConfig(tenantId)
    expect(res.status).toBe(200)
    const { config } = await res.json()
    expect(config.id).toBeNull()
    expect(config.offlineEnabled).toBe(true)
    expect(config.onlineMode).toBe("NONE")

    actAs(parentId)
    expect((await getConfig(tenantId)).status).toBe(403)
  })

  it("club can set its own choices within the allowlist", async () => {
    actAs(ownerId)
    const res = await patchConfig(tenantId, {
      offlineEnabled: true,
      offlineMethods: ["CASH", "ETRANSFER", "CHEQUE"],
      onlineMode: "CONNECT_DIRECT", // connectAllowed defaults true
    })
    expect(res.status).toBe(200)
    const { config } = await res.json()
    expect(config.offlineMethods).toEqual(["CASH", "ETRANSFER", "CHEQUE"])
    expect(config.onlineMode).toBe("CONNECT_DIRECT")
  })

  it("club cannot pick a mode outside the allowlist nor touch admin fields", async () => {
    actAs(ownerId)
    const modeRes = await patchConfig(tenantId, { onlineMode: "PLATFORM_COLLECT" })
    expect(modeRes.status).toBe(400)
    expect((await modeRes.json()).code).toBe("MODE_NOT_ALLOWED")

    expect((await patchConfig(tenantId, { platformFeeBps: 0 })).status).toBe(403)
    expect((await patchConfig(tenantId, { platformCollectAllowed: true })).status).toBe(403)
  })

  it("platform admin opens the allowlist and sets fees; club can then choose the mode", async () => {
    actAs(adminId)
    const adminRes = await patchConfig(tenantId, {
      platformCollectAllowed: true,
      platformFeeBps: 250,
      platformFeeFlat: 0.3,
    })
    expect(adminRes.status).toBe(200)
    const { config } = await adminRes.json()
    expect(config.platformFeeBps).toBe(250)

    actAs(ownerId)
    const res = await patchConfig(tenantId, { onlineMode: "PLATFORM_COLLECT" })
    expect(res.status).toBe(200)
    expect((await res.json()).config.onlineMode).toBe("PLATFORM_COLLECT")
  })
})
