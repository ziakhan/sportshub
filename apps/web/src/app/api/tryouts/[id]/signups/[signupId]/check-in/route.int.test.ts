import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — tryout-day roll-call: club roles toggle checkedInAt on/off;
 * outsiders and cancelled signups are rejected.
 */

let world: BuiltWorld
let ownerId: string
let outsiderParentId: string
let tryoutId: string
let signupId: string
let cancelledSignupId: string

const checkIn = (sid: string, checkedIn: boolean) =>
  POST(jsonRequest(`/api/tryouts/${tryoutId}/signups/${sid}/check-in`, { checkedIn }), {
    params: { id: tryoutId, signupId: sid },
  })

const checkedInAt = (sid: string) =>
  prisma.tryoutSignup
    .findUniqueOrThrow({ where: { id: sid }, select: { checkedInAt: true } })
    .then((s: { checkedInAt: Date | null }) => s.checkedInAt)

beforeAll(async () => {
  world = await buildWorld({
    seed: 1117,
    clubs: [{ teams: [{}], tryouts: [{ capacity: 20, signups: 3, published: true }] }],
  })
  const club = world.clubs[0]
  ownerId = club.owner.id
  const tryout = club.tryouts[0]
  tryoutId = tryout.id
  signupId = tryout.signups[0].signupId
  // Signup [1]'s parent has no role at the club — the outsider case.
  outsiderParentId = tryout.signups[1].parent.id
  cancelledSignupId = tryout.signups[2].signupId
  await prisma.tryoutSignup.update({
    where: { id: cancelledSignupId },
    data: { status: "CANCELLED" },
  })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("POST /api/tryouts/[id]/signups/[signupId]/check-in (integration)", () => {
  it("club owner checks a player in — checkedInAt is stamped", async () => {
    actAs(ownerId)
    const res = await checkIn(signupId, true)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checkedInAt).toBeTruthy()
    expect(await checkedInAt(signupId)).toBeInstanceOf(Date)
  })

  it("mis-taps undo: checking out clears the stamp", async () => {
    actAs(ownerId)
    const res = await checkIn(signupId, false)
    expect(res.status).toBe(200)
    expect(await checkedInAt(signupId)).toBeNull()
  })

  it("a parent with no club role is forbidden", async () => {
    actAs(outsiderParentId)
    const res = await checkIn(signupId, true)
    expect(res.status).toBe(403)
    expect(await checkedInAt(signupId)).toBeNull()
  })

  it("unauthenticated is rejected", async () => {
    actAs(null)
    const res = await checkIn(signupId, true)
    expect(res.status).toBe(401)
  })

  it("cancelled signups cannot be checked in", async () => {
    actAs(ownerId)
    const res = await checkIn(cancelledSignupId, true)
    expect(res.status).toBe(400)
    expect(await checkedInAt(cancelledSignupId)).toBeNull()
  })

  it("404s when the signup does not belong to the tryout in the URL", async () => {
    actAs(ownerId)
    const res = await POST(
      jsonRequest(`/api/tryouts/${tryoutId}/signups/nonexistent/check-in`, { checkedIn: true }),
      { params: { id: tryoutId, signupId: "nonexistent" } }
    )
    expect(res.status).toBe(404)
  })

  it("400s on a missing/invalid body", async () => {
    actAs(ownerId)
    const res = await POST(
      jsonRequest(`/api/tryouts/${tryoutId}/signups/${signupId}/check-in`, { checkedIn: "yes" }),
      { params: { id: tryoutId, signupId } }
    )
    expect(res.status).toBe(400)
  })
})
