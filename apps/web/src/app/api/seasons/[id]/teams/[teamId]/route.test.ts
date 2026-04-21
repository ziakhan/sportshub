import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { PATCH } from "@/app/api/seasons/[id]/teams/[teamId]/route"

vi.mock("@/lib/auth-helpers", () => ({
  getSessionUserId: vi.fn(),
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    season: {
      findUnique: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    teamSubmission: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
}))

describe("PATCH /api/seasons/[id]/teams/[teamId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSessionUserId).mockResolvedValue({
      userId: "league-owner-1",
      isPlatformAdmin: false,
    })
    vi.mocked(prisma.season.findUnique).mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      league: { ownerId: "league-owner-1", name: "NPH Spring League" },
    } as any)
    vi.mocked(prisma.teamSubmission.findFirst).mockResolvedValue({
      id: "submission-1",
      team: {
        id: "team-1",
        name: "Warriors U12",
        tenantId: "tenant-1",
        tenant: { name: "Warriors Club" },
      },
    } as any)
    vi.mocked(prisma.teamSubmission.update).mockResolvedValue({
      id: "submission-1",
      status: "APPROVED",
      paymentStatus: "UNPAID",
    } as any)
    vi.mocked(prisma.userRole.findMany).mockResolvedValue([{ userId: "club-owner-1" }] as any)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as any)
  })

  it("approves a team submission and notifies club managers", async () => {
    const response = await PATCH(
      new Request("http://localhost:3000/api/seasons/season-1/teams/submission-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      }) as any,
      { params: { id: "season-1", teamId: "submission-1" } }
    )

    expect(response.status).toBe(200)
    expect(prisma.teamSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-1" },
      data: { status: "APPROVED" },
    })
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "club-owner-1",
          type: "league_registration_status",
          title: "League Registration Approved",
          message: "Warriors U12 was approved for NPH Spring League.",
          link: "/browse-leagues/season-1",
          referenceId: "submission-1",
          referenceType: "TeamSubmission",
        },
      ],
    })
  })

  it("returns 403 when user is not league owner, manager, or platform admin", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue({ userId: "club-user-1", isPlatformAdmin: false })
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue(null)

    const response = await PATCH(
      new Request("http://localhost:3000/api/seasons/season-1/teams/submission-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      }) as any,
      { params: { id: "season-1", teamId: "submission-1" } }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("accepts paymentStatus-only updates without touching notifications", async () => {
    vi.mocked(prisma.teamSubmission.update).mockResolvedValue({
      id: "submission-1",
      status: "APPROVED",
      paymentStatus: "PAID_MANUAL",
    } as any)

    const response = await PATCH(
      new Request("http://localhost:3000/api/seasons/season-1/teams/submission-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentStatus: "PAID_MANUAL" }),
      }) as any,
      { params: { id: "season-1", teamId: "submission-1" } }
    )

    expect(response.status).toBe(200)
    expect(prisma.teamSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-1" },
      data: { paymentStatus: "PAID_MANUAL" },
    })
    expect(prisma.notification.createMany).not.toHaveBeenCalled()
  })
})
