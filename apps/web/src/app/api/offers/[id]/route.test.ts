import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { PATCH } from "@/app/api/offers/[id]/route"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    offer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe("PATCH /api/offers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "parent-1" } } as any)
  })

  it("accepts an offer, creates or updates the team roster entry, and notifies the club", async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: "offer-1",
      status: "PENDING",
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
      includesUniform: true,
      includesShoes: false,
      includesTracksuit: false,
      teamId: "team-1",
      playerId: "player-1",
      player: {
        id: "player-1",
        parentId: "parent-1",
        firstName: "Jordan",
        lastName: "Lee",
      },
      team: {
        id: "team-1",
        name: "Warriors U12",
        tenantId: "tenant-1",
        tenant: { name: "Warriors Club" },
      },
    } as any)

    const tx = {
      offer: {
        update: vi.fn().mockResolvedValue({ id: "offer-1", status: "ACCEPTED" }),
      },
      teamPlayer: {
        upsert: vi.fn().mockResolvedValue({ id: "team-player-1" }),
      },
      userRole: {
        findFirst: vi.fn().mockResolvedValue({ userId: "club-owner-1" }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: "notification-1" }),
      },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const response = await PATCH(
      new Request("http://localhost:3000/api/offers/offer-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          uniformSize: "YM",
          jerseyPref1: 12,
          jerseyPref2: 23,
          jerseyPref3: 34,
        }),
      }) as any,
      { params: { id: "offer-1" } }
    )

    expect(response.status).toBe(200)
    expect(tx.offer.update).toHaveBeenCalledWith({
      where: { id: "offer-1" },
      data: expect.objectContaining({
        status: "ACCEPTED",
        uniformSize: "YM",
        jerseyPref1: 12,
        jerseyPref2: 23,
        jerseyPref3: 34,
        respondedAt: expect.any(Date),
      }),
    })
    expect(tx.teamPlayer.upsert).toHaveBeenCalledWith({
      where: {
        teamId_playerId: {
          teamId: "team-1",
          playerId: "player-1",
        },
      },
      create: {
        teamId: "team-1",
        playerId: "player-1",
        uniformSize: "YM",
        shoeSize: null,
        tracksuitSize: null,
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
        uniformSize: "YM",
        shoeSize: null,
        tracksuitSize: null,
      },
    })
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "club-owner-1",
        type: "offer_accepted",
        title: "Offer Accepted",
        message: "Jordan Lee has accepted the offer to join Warriors U12.",
        link: "/clubs/tenant-1/offers",
        referenceId: "offer-1",
        referenceType: "Offer",
      },
    })
  })

  it("marks an expired offer as expired and rejects the response", async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: "offer-expired",
      status: "PENDING",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      includesUniform: false,
      includesShoes: false,
      includesTracksuit: false,
      player: {
        id: "player-1",
        parentId: "parent-1",
        firstName: "Jordan",
        lastName: "Lee",
      },
      team: {
        id: "team-1",
        name: "Warriors U12",
        tenantId: "tenant-1",
        tenant: { name: "Warriors Club" },
      },
    } as any)
    vi.mocked(prisma.offer.update).mockResolvedValue({
      id: "offer-expired",
      status: "EXPIRED",
    } as any)

    const response = await PATCH(
      new Request("http://localhost:3000/api/offers/offer-expired", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      }) as any,
      { params: { id: "offer-expired" } }
    )

    expect(response.status).toBe(400)
    expect(prisma.offer.update).toHaveBeenCalledWith({
      where: { id: "offer-expired" },
      data: { status: "EXPIRED" },
    })
    await expect(response.json()).resolves.toEqual({ error: "This offer has expired" })
  })
})
