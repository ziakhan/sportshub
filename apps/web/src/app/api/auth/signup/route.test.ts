import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { POST } from "@/app/api/auth/signup/route"

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    // Signup now scans pending staff invitations by email (gap 0.1.1)
    staffInvitation: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      // Pre-launch signup gate checks invited emails (owner 2026-08-17)
      findFirst: vi.fn().mockResolvedValue({ id: "inv-1" }),
    },
    // ...and pending player invitations (gap G3)
    playerInvitation: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    // ...and pending family invitations (family-accounts, 2026-07-24)
    familyInvitation: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    clubClaim: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    tenant: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
}))

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("normalizes email before duplicate check and create", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as any)
    vi.mocked(prisma.staffInvitation.findMany).mockResolvedValue([])
    vi.mocked(prisma.playerInvitation.findMany).mockResolvedValue([])
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never)

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "  PLAYER@Example.com ",
          password: "secret123",
          firstName: "Taylor",
          lastName: "Jordan",
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: "player@example.com",
          mode: "insensitive",
        },
      },
    })
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "player@example.com",
        passwordHash: "hashed-password",
        firstName: "Taylor",
        lastName: "Jordan",
        status: "ACTIVE",
      },
    })
    await expect(response.json()).resolves.toEqual({ success: true, pendingInvitations: 0, pendingPlayerInvitations: 0 })
  })

  it("returns 409 when a case-insensitive duplicate already exists", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "existing-user" } as any)

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "Player@Example.com",
          password: "secret123",
          firstName: "Taylor",
          lastName: "Jordan",
        }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "An account with this email already exists",
    })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  // Pre-launch gate (owner 2026-08-17): with PUBLIC_SIGNUPS=false, only a
  // club-claim token or an invited email may mint an account.
  it("refuses a stranger while signups are closed", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked((prisma as any).staffInvitation.findFirst).mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "stranger@example.com",
          password: "secret123",
          firstName: "Sam",
          lastName: "Nobody",
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it("lets a verified club claimant through on their completion token", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-2" } as any)
    vi.mocked((prisma as any).staffInvitation.findFirst).mockResolvedValue(null)
    vi.mocked((prisma as any).clubClaim.findUnique).mockResolvedValue({ id: "claim-1" })
    vi.mocked(prisma.staffInvitation.findMany).mockResolvedValue([])
    vi.mocked(prisma.playerInvitation.findMany).mockResolvedValue([])
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never)

    const response = await POST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "claimer@example.com",
          password: "secret123",
          firstName: "Casey",
          lastName: "Claimer",
          claimToken: "tok-abc",
        }),
      })
    )

    expect(response.status).toBe(200)
    expect((prisma as any).clubClaim.findUnique).toHaveBeenCalledWith({
      where: { completionToken: "tok-abc" },
      select: { id: true },
    })
  })
})
