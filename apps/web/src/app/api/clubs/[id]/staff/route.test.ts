import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { sendStaffInviteEmail } from "@/lib/email"
import { POST } from "@/app/api/clubs/[id]/staff/route"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/email", () => ({
  sendStaffInviteEmail: vi.fn(),
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
    },
    staffInvitation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}))

describe("POST /api/clubs/[id]/staff", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1" } } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      firstName: "Morgan",
      lastName: "Lee",
      roles: [{ role: "ClubOwner" }],
    } as any)
    vi.mocked(prisma.staffInvitation.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ name: "Warriors Club" } as any)
    vi.mocked(prisma.staffInvitation.create).mockResolvedValue({ id: "invite-1" } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: "notification-1" } as any)
  })

  it("normalizes invite email and notifies an existing user", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "staff-1",
      firstName: "Taylor",
      lastName: "Jordan",
    } as any)

    const response = await POST(
      new Request("http://localhost:3000/api/clubs/tenant-1/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "  STAFF@Example.com ",
          role: "Staff",
          message: "Please join us",
        }),
      }) as any,
      { params: { id: "tenant-1" } }
    )

    expect(response.status).toBe(201)
    expect(prisma.staffInvitation.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        invitedEmail: "staff@example.com",
        status: "PENDING",
      },
    })
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: "staff@example.com",
          mode: "insensitive",
        },
      },
      select: { id: true, firstName: true, lastName: true },
    })
    expect(prisma.staffInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        invitedUserId: "staff-1",
        invitedEmail: "staff@example.com",
        role: "Staff",
        message: "Please join us",
      }),
    })
    expect(sendStaffInviteEmail).toHaveBeenCalledWith({
      to: "staff@example.com",
      clubName: "Warriors Club",
      role: "Staff",
      inviterName: "Morgan Lee",
      inviteLink: "http://localhost:3000/notifications",
      message: "Please join us",
    })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "staff-1",
        type: "staff_invite",
        title: "Staff Invitation",
        message: "Warriors Club has invited you to join as Staff.",
        link: "/notifications",
        referenceId: "invite-1",
        referenceType: "StaffInvitation",
      },
    })
  })

  it("returns 409 when a pending invite already exists for the normalized email", async () => {
    vi.mocked(prisma.staffInvitation.findFirst).mockResolvedValue({ id: "existing-invite" } as any)

    const response = await POST(
      new Request("http://localhost:3000/api/clubs/tenant-1/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "STAFF@Example.com",
          role: "Staff",
        }),
      }) as any,
      { params: { id: "tenant-1" } }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "An invitation is already pending for this email",
    })
    expect(prisma.staffInvitation.create).not.toHaveBeenCalled()
  })
})
