import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { PATCH } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — G7: unpublishing a tryout notifies every non-cancelled signup's
 * parent (it used to be silent). Cancelled signups and unrelated edits
 * stay quiet.
 */

let world: BuiltWorld
let ownerId: string
let tryoutId: string
let activeParentIds: string[]
let cancelledParentId: string

const patchTryout = (body: unknown) =>
  PATCH(jsonRequest(`/api/tryouts/${tryoutId}`, body, "PATCH"), { params: { id: tryoutId } })

const unpublishNotifications = () =>
  prisma.notification.findMany({
    where: { type: "tryout_unpublished", referenceId: tryoutId },
    select: { userId: true },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1104,
    clubs: [{ teams: [{}], tryouts: [{ capacity: 20, signups: 3, published: true }] }],
  })
  const club = world.clubs[0]
  ownerId = club.owner.id
  const tryout = club.tryouts[0]
  tryoutId = tryout.id
  // One family cancels — they must not be notified.
  cancelledParentId = tryout.signups[2].parent.id
  activeParentIds = tryout.signups.slice(0, 2).map((s) => s.parent.id)
  await prisma.tryoutSignup.update({
    where: { id: tryout.signups[2].signupId },
    data: { status: "CANCELLED" },
  })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("PATCH /api/tryouts/[id] (integration)", () => {
  it("editing without unpublishing notifies nobody", async () => {
    actAs(ownerId)
    const res = await patchTryout({ title: "Renamed Tryout Session" })
    expect(res.status).toBe(200)
    expect(await unpublishNotifications()).toEqual([])
  })

  it("G7 — unpublishing notifies each non-cancelled signup's parent exactly once", async () => {
    actAs(ownerId)
    const res = await patchTryout({ isPublished: false })
    expect(res.status).toBe(200)

    const notified = (await unpublishNotifications()).map((n) => n.userId).sort()
    expect(notified).toEqual([...activeParentIds].sort())
    expect(notified).not.toContain(cancelledParentId)
  })

  it("unpublishing an already-unpublished tryout does not re-notify", async () => {
    actAs(ownerId)
    const res = await patchTryout({ isPublished: false })
    expect(res.status).toBe(200)
    expect(await unpublishNotifications()).toHaveLength(activeParentIds.length)
  })
})
