import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { POST } from "@/app/api/onboarding/route"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userRole: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    player: {
      create: vi.fn(),
    },
    refereeProfile: {
      create: vi.fn(),
    },
    league: {
      create: vi.fn(),
    },
    season: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      firstName: "Taylor",
      lastName: "Jordan",
      roles: [],
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "user-1" } as any)
    vi.mocked(prisma.userRole.createMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.userRole.updateMany).mockResolvedValue({ count: 1 } as any)
  })

  it("creates missing club owner role and returns club creation next step", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roles: ["ClubOwner"],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(prisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", role: "ClubOwner" }],
      skipDuplicates: true,
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ onboardedAt: expect.any(Date) }),
    })
    await expect(response.json()).resolves.toEqual({
      success: true,
      roles: ["ClubOwner"],
      nextStep: "/clubs/create",
    })
  })

  it("creates and scopes a league owner profile (league + first season)", async () => {
    const tx = {
      league: { create: vi.fn().mockResolvedValue({ id: "league-1" }) },
      season: { create: vi.fn().mockResolvedValue({ id: "season-1" }) },
    }
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx))

    const response = await POST(
      new Request("http://localhost:3000/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roles: ["LeagueOwner"],
          profileData: {
            type: "LeagueOwner",
            name: "Ontario Elite League",
            season: "2026",
            description: "Competitive league",
          },
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(tx.league.create).toHaveBeenCalledWith({
      data: {
        name: "Ontario Elite League",
        description: "Competitive league",
        ownerId: "user-1",
      },
    })
    expect(tx.season.create).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        label: "2026",
        status: "DRAFT",
      },
    })
    expect(prisma.userRole.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        role: "LeagueOwner",
        leagueId: null,
      },
      data: { leagueId: "league-1" },
    })
    await expect(response.json()).resolves.toEqual({
      success: true,
      roles: ["LeagueOwner"],
      nextStep: "/dashboard",
    })
  })
})
