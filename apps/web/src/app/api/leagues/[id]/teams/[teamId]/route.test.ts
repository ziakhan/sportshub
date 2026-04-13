import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { PATCH } from "@/app/api/leagues/[id]/teams/[teamId]/route"

vi.mock("@/lib/auth-helpers", () => ({
  getSessionUserId: vi.fn(),
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    leagueTeam: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
}))

describe("PATCH /api/leagues/[id]/teams/[teamId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSessionUserId).mockResolvedValue({
      userId: "league-owner-1",
      isPlatformAdmin: false,
    })
    vi.mocked(prisma.league.findUnique).mockResolvedValue({
      id: "league-1",
      ownerId: "league-owner-1",
      name: "NPH Spring League",
    } as any)
    vi.mocked(prisma.leagueTeam.findFirst).mockResolvedValue({
      id: "league-team-1",
      team: {
        id: "team-1",
        name: "Warriors U12",
        tenantId: "tenant-1",
        tenant: { name: "Warriors Club" },
      },
    } as any)
    vi.mocked(prisma.leagueTeam.update).mockResolvedValue({
      id: "league-team-1",
      status: "APPROVED",
    } as any)
    vi.mocked(prisma.userRole.findMany).mockResolvedValue([{ userId: "club-owner-1" }] as any)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as any)
  })

  it("approves a team submission and notifies club managers", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/leagues/league-1/teams/league-team-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      }) as any,
      { params: { id: "league-1", teamId: "league-team-1" } }
    )

    expect(response.status).toBe(200)
    expect(prisma.leagueTeam.update).toHaveBeenCalledWith({
      where: { id: "league-team-1" },
      data: { status: "APPROVED" },
    })
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "club-owner-1",
          type: "league_registration_status",
          title: "League Registration Approved",
          message: "Warriors U12 was approved for NPH Spring League.",
          link: "/leagues/league-1/manage",
          referenceId: "league-team-1",
          referenceType: "LeagueTeam",
        },
      ],
    })
  })

  it("returns 403 when user is not league owner, manager, or platform admin", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue({ userId: "club-user-1", isPlatformAdmin: false })
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue(null)

    const response = await PATCH(
      new Request("http://localhost:3000/api/leagues/league-1/teams/league-team-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      }) as any,
      { params: { id: "league-1", teamId: "league-team-1" } }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })
})
