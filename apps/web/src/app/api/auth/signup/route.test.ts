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
  },
}))

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("normalizes email before duplicate check and create", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as any)
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
    await expect(response.json()).resolves.toEqual({ success: true })
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
})
