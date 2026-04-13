import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { sendOfferEmail } from "@/lib/email"
import { POST } from "@/app/api/offers/route"

vi.mock("@/lib/auth-helpers", () => ({
  getSessionUserId: vi.fn(),
}))

vi.mock("@/lib/email", () => ({
  sendOfferEmail: vi.fn(),
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    offer: {
      findFirst: vi.fn(),
    },
    offerTemplate: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe("POST /api/offers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSessionUserId).mockResolvedValue({ userId: "club-user-1", isPlatformAdmin: false })
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      tenantId: "tenant-1",
      name: "Warriors U12",
      tenant: { name: "Warriors Club" },
    } as any)
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: "club-user-1", roles: [{ role: "ClubOwner" }] } as any)
      .mockResolvedValueOnce({ email: "parent@example.com", firstName: "Pat" } as any)
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: "player-1",
      parentId: "parent-1",
      firstName: "Jordan",
      lastName: "Lee",
    } as any)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null)
  })

  it("creates an offer, updates signup status, creates a notification, and sends email", async () => {
    const tx = {
      offer: {
        create: vi.fn().mockResolvedValue({ id: "offer-1" }),
      },
      tryoutSignup: {
        update: vi.fn().mockResolvedValue({ id: "signup-1", status: "OFFERED" }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: "notification-1" }),
      },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const response = await POST(
      new Request("http://localhost:3000/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: "team-1",
          playerId: "player-1",
          tryoutSignupId: "signup-1",
          seasonFee: 450,
          installments: 3,
          practiceSessions: 12,
          includesUniform: true,
          includesBall: true,
          expiresAt: "2026-05-01T00:00:00.000Z",
        }),
      }) as any
    )

    expect(response.status).toBe(201)
    expect(tx.offer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: "team-1",
        playerId: "player-1",
        tryoutSignupId: "signup-1",
        seasonFee: 450,
        installments: 3,
        practiceSessions: 12,
        includesUniform: true,
        includesBall: true,
      }),
    })
    expect(tx.tryoutSignup.update).toHaveBeenCalledWith({
      where: { id: "signup-1" },
      data: { status: "OFFERED" },
    })
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "parent-1",
        type: "offer_received",
        title: "New Team Offer",
        message: "Warriors Club has sent an offer for Jordan Lee to join Warriors U12.",
        link: "/offers",
        referenceId: "offer-1",
        referenceType: "Offer",
      },
    })
    expect(sendOfferEmail).toHaveBeenCalledWith({
      to: "parent@example.com",
      parentName: "Pat",
      playerName: "Jordan Lee",
      clubName: "Warriors Club",
      teamName: "Warriors U12",
      seasonFee: 450,
      message: undefined,
      offerLink: "http://localhost:3000/offers",
    })
  })

  it("rejects creating a duplicate pending offer for the same player and team", async () => {
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: "offer-existing" } as any)

    const response = await POST(
      new Request("http://localhost:3000/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: "team-1",
          playerId: "player-1",
          expiresAt: "2026-05-01T00:00:00.000Z",
        }),
      }) as any
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "A pending offer already exists for this player on this team",
    })
  })
})
