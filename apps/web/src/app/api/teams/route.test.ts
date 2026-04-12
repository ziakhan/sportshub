import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { POST } from "@/app/api/teams/route"

vi.mock("@/lib/auth-helpers", () => ({
  getSessionUserId: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe("POST /api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSessionUserId).mockResolvedValue({ userId: "admin-1", isPlatformAdmin: false })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      roles: [{ role: "ClubOwner" }],
    } as any)
  })

  it("normalizes invite emails inside team creation transaction", async () => {
    const tx = {
      team: {
        create: vi.fn().mockResolvedValue({ id: "team-1", name: "U12 Warriors" }),
      },
      userRole: {
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

    const response = await POST(
      new Request("http://localhost:3000/api/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "U12 Warriors",
          ageGroup: "U12",
          tenantId: "11111111-1111-1111-1111-111111111111",
          staff: [
            {
              type: "invite",
              email: "  COACH@Example.com ",
              role: "Staff",
              designation: "HeadCoach",
            },
          ],
        }),
      }) as any
    )

    expect(response.status).toBe(201)
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: "coach@example.com",
          mode: "insensitive",
        },
      },
      select: { id: true },
    })
    expect(tx.staffInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invitedEmail: "coach@example.com",
        invitedUserId: "staff-1",
        designation: "HeadCoach",
      }),
    })
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "staff-1",
        type: "staff_invite",
        title: "Team Staff Invitation",
        message: 'Warriors Club has invited you to join team "U12 Warriors" as Head Coach.',
        link: "/notifications",
        referenceId: "invite-1",
        referenceType: "StaffInvitation",
      },
    })
  })
})
