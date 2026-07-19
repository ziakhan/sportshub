import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { sendSeasonReviewInvites, hasLiveReviewInvite } from "@/lib/reviews/invites"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

// Review POST authenticates via getSessionUserId — drive it directly.
let sessionUserId: string | null = null
vi.mock("@/lib/auth-helpers", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/auth-helpers")>()
  return {
    ...mod,
    getSessionUserId: async () =>
      sessionUserId ? { userId: sessionUserId, isPlatformAdmin: false } : null,
  }
})

// Email is best-effort fire-and-forget — never hit SMTP in tests.
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }))

import { POST as reviewPOST } from "./route"

/**
 * Review lifecycle (owner 2026-07-18): season concludes → participating
 * parents get time-boxed invites → reviews only inside the window → new
 * reviews land PENDING for the admin queue.
 */

let world: BuiltWorld
let seasonId: string
let tenantId: string
let parentId: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1130,
    leagues: [
      {
        seasons: [
          {
            status: "IN_PROGRESS",
            divisions: [{ teams: 1, rosterSize: 2, submissionStatus: "APPROVED" }],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  const sub = season.divisions[0].submissions[0]
  const team = await prisma.team.findUnique({
    where: { id: sub.teamId },
    select: { tenantId: true },
  })
  tenantId = team!.tenantId
  const tp = await prisma.player.findUnique({
    where: { id: sub.playerIds[0] },
    select: { parentId: true },
  })
  parentId = tp!.parentId!
})

afterAll(async () => {
  await prisma.review.deleteMany({ where: { reviewerId: parentId } })
  await (prisma as any).reviewInvite.deleteMany({ where: { seasonId } })
  await destroyWorld(world.ctx)
})

describe("season-conclude review invites", () => {
  it("creates invites for participating parents and reports counts", async () => {
    const res = await sendSeasonReviewInvites(seasonId)
    expect(res.clubs).toBe(1)
    expect(res.invited).toBeGreaterThanOrEqual(1)
    const invite = await (prisma as any).reviewInvite.findFirst({
      where: { seasonId, tenantId, userId: parentId },
    })
    expect(invite).toBeTruthy()
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(await hasLiveReviewInvite(parentId, tenantId)).toBe(true)
  })

  it("is idempotent — re-running creates no duplicate invites", async () => {
    await sendSeasonReviewInvites(seasonId)
    const count = await (prisma as any).reviewInvite.count({
      where: { seasonId, tenantId, userId: parentId },
    })
    expect(count).toBe(1)
  })

  it("review POST inside the window creates a PENDING review", async () => {
    sessionUserId = parentId
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        tenantId,
        rating: 5,
        title: "Great season",
        content: "Coaches were superb.",
      }),
      headers: { "content-type": "application/json" },
    })
    const res = await reviewPOST(req)
    expect(res.status).toBe(201)
    const review = await prisma.review.findFirst({
      where: { reviewerId: parentId, tenantId },
      select: { status: true },
    })
    expect(review?.status).toBe("PENDING")
  })

  it("review POST outside the window is blocked with REVIEW_WINDOW_CLOSED", async () => {
    await (prisma as any).reviewInvite.updateMany({
      where: { seasonId, tenantId, userId: parentId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    await prisma.review.deleteMany({ where: { reviewerId: parentId, tenantId } })
    sessionUserId = parentId
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      body: JSON.stringify({ tenantId, rating: 4 }),
      headers: { "content-type": "application/json" },
    })
    const res = await reviewPOST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe("REVIEW_WINDOW_CLOSED")
  })
})
