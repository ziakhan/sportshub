import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { PATCH } from "@/app/api/teams/[id]/route"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe("PATCH /api/teams/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1" } } as any)
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      tenantId: "tenant-1",
      name: "U12 Warriors",
    } as any)
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue({ id: "role-1" } as any)
  })

  it("normalizes invite emails during staff additions", async () => {
    const tx = {
      team: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "team-1" }),
      },
      userRole: {
        deleteMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: "staff-1" }),
      },
      staffInvitation: {
        create: vi.fn().mockResolvedValue({ id: "invite-1" }),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ name: "Warriors Club" }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: "notification-1" }),
      },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const response = await PATCH(
      new Request("http://localhost:3000/api/teams/team-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          staffToAdd: [
            {
              type: "invite",
              email: "  MANAGER@Example.com ",
              role: "TeamManager",
            },
          ],
        }),
      }) as any,
      { params: { id: "team-1" } }
    )

    expect(response.status).toBe(200)
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: "manager@example.com",
          mode: "insensitive",
        },
      },
      select: { id: true },
    })
    expect(tx.staffInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: "team-1",
        invitedEmail: "manager@example.com",
        role: "TeamManager",
      }),
    })
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "staff-1",
        type: "staff_invite",
        title: "Team Staff Invitation",
        message: 'Warriors Club has invited you to join team "U12 Warriors" as Team Manager.',
        link: "/notifications",
        referenceId: "invite-1",
        referenceType: "StaffInvitation",
      },
    })
  })
})
