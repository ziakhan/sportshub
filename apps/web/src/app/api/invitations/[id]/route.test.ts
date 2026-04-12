import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { PATCH } from "@/app/api/invitations/[id]/route"

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
    },
    staffInvitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}))

describe("PATCH /api/invitations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      firstName: "Taylor",
      lastName: "Jordan",
      email: "taylor@example.com",
    } as any)
    vi.mocked(prisma.staffInvitation.update).mockResolvedValue({ id: "invite-1" } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: "notification-1" } as any)
  })

  it("accepts a team invitation by creating tenant and team roles when needed", async () => {
    vi.mocked(prisma.staffInvitation.findUnique).mockResolvedValue({
      id: "invite-1",
      status: "PENDING",
      type: "INVITE",
      role: "Staff",
      tenantId: "tenant-1",
      teamId: "team-1",
      designation: "HeadCoach",
      invitedById: "owner-1",
      invitedUserId: "user-1",
      tenant: { name: "Warriors Club" },
    } as any)
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.userRole.create)
      .mockResolvedValueOnce({ id: "tenant-role" } as any)
      .mockResolvedValueOnce({ id: "team-role" } as any)

    const response = await PATCH(
      new Request("http://localhost:3000/api/invitations/invite-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }) as any,
      { params: { id: "invite-1" } }
    )

    expect(response.status).toBe(200)
    expect(prisma.userRole.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        tenantId: "tenant-1",
        role: "Staff",
        teamId: null,
      },
    })
    expect(prisma.userRole.create).toHaveBeenNthCalledWith(1, {
      data: {
        userId: "user-1",
        role: "Staff",
        tenantId: "tenant-1",
        teamId: null,
        designation: null,
      },
    })
    expect(prisma.userRole.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: "user-1",
        role: "Staff",
        tenantId: "tenant-1",
        teamId: "team-1",
        designation: "HeadCoach",
      },
    })
    expect(prisma.staffInvitation.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: expect.objectContaining({ status: "ACCEPTED" }),
    })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "owner-1",
        type: "invite_accepted",
        title: "Invitation Accepted",
        message: "Taylor Jordan has accepted your invitation to join Warriors Club as Staff.",
        link: "/clubs/tenant-1/staff",
        referenceId: "invite-1",
        referenceType: "StaffInvitation",
      },
    })
  })

  it("accepts a request using the provided role override", async () => {
    vi.mocked(prisma.staffInvitation.findUnique).mockResolvedValue({
      id: "invite-2",
      status: "PENDING",
      type: "REQUEST",
      role: "Staff",
      tenantId: "tenant-1",
      teamId: null,
      designation: null,
      invitedById: "user-2",
      invitedUserId: "user-2",
      tenant: { name: "Warriors Club" },
    } as any)
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue({ id: "access-role" } as any)
    vi.mocked(prisma.userRole.create).mockResolvedValue({ id: "created-role" } as any)

    const response = await PATCH(
      new Request("http://localhost:3000/api/invitations/invite-2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept", role: "TeamManager" }),
      }) as any,
      { params: { id: "invite-2" } }
    )

    expect(response.status).toBe(200)
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        role: "TeamManager",
        tenantId: "tenant-1",
        teamId: null,
        designation: null,
      },
    })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        type: "request_accepted",
        title: "Request Accepted",
        message:
          "Your request to join Warriors Club has been accepted! You've been assigned the TeamManager role.",
        link: "/dashboard",
        referenceId: "invite-2",
        referenceType: "StaffInvitation",
      },
    })
  })

  it("declines an invitation and notifies the inviter", async () => {
    vi.mocked(prisma.staffInvitation.findUnique).mockResolvedValue({
      id: "invite-3",
      status: "PENDING",
      type: "INVITE",
      role: "Staff",
      tenantId: "tenant-1",
      teamId: null,
      designation: null,
      invitedById: "owner-1",
      invitedUserId: "user-1",
      tenant: { name: "Warriors Club" },
    } as any)

    const response = await PATCH(
      new Request("http://localhost:3000/api/invitations/invite-3", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      }) as any,
      { params: { id: "invite-3" } }
    )

    expect(response.status).toBe(200)
    expect(prisma.staffInvitation.update).toHaveBeenCalledWith({
      where: { id: "invite-3" },
      data: expect.objectContaining({ status: "DECLINED" }),
    })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "owner-1",
        type: "invite_declined",
        title: "Invitation Declined",
        message: "Taylor Jordan has declined your invitation to join Warriors Club.",
        link: "/clubs/tenant-1/staff",
        referenceId: "invite-3",
        referenceType: "StaffInvitation",
      },
    })
  })
})
