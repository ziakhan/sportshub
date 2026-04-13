import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { POST } from "@/app/api/leagues/[id]/submit/route"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
    },
    leagueDivision: {
      findFirst: vi.fn(),
    },
    leagueTeam: {
      findUnique: vi.fn(),
    },
    teamPlayer: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe("POST /api/leagues/[id]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "club-owner-1" } } as any)
    vi.mocked(prisma.league.findUnique).mockResolvedValue({
      id: "league-1",
      leagueStatus: "REGISTRATION",
      registrationDeadline: new Date("2100-01-01T00:00:00.000Z"),
      teamFee: 3500,
    } as any)
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      name: "Warriors U14",
      tenantId: "tenant-1",
    } as any)
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue({ id: "role-1" } as any)
    vi.mocked(prisma.leagueTeam.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.teamPlayer.findMany).mockResolvedValue([] as any)
  })

  it("rejects submission when division capacity is full", async () => {
    vi.mocked(prisma.leagueDivision.findFirst).mockResolvedValue({
      id: "division-1",
      maxTeams: 2,
      _count: {
        teams: 2,
      },
    } as any)

    const response = await POST(
      new Request("http://localhost:3000/api/leagues/league-1/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId: "team-1", divisionId: "division-1" }),
      }) as any,
      { params: { id: "league-1" } }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Division capacity reached (2 teams).",
    })
  })

  it("submits successfully when division has available spots", async () => {
    vi.mocked(prisma.leagueDivision.findFirst).mockResolvedValue({
      id: "division-1",
      maxTeams: 4,
      _count: {
        teams: 1,
      },
    } as any)

    const tx = {
      leagueTeam: {
        create: vi.fn().mockResolvedValue({ id: "league-team-1" }),
      },
      leagueRoster: {
        create: vi.fn().mockResolvedValue({ id: "roster-1" }),
      },
      leagueRosterPlayer: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const response = await POST(
      new Request("http://localhost:3000/api/leagues/league-1/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId: "team-1", divisionId: "division-1" }),
      }) as any,
      { params: { id: "league-1" } }
    )

    expect(response.status).toBe(201)
    expect(tx.leagueTeam.create).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        teamId: "team-1",
        divisionId: "division-1",
        status: "PENDING",
        registrationFee: 3500,
      },
    })
  })
})