import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { authorizeCredentials } from "@/lib/auth-credentials"

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}))

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("normalizes email before looking up the user", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-1",
      email: "player@example.com",
      firstName: "Taylor",
      lastName: "Jordan",
      passwordHash: "hashed-password",
      status: "ACTIVE",
    } as any)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials({
      email: "  PLAYER@Example.com ",
      password: "secret123",
    })

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: "player@example.com",
          mode: "insensitive",
        },
      },
    })
    expect(bcrypt.compare).toHaveBeenCalledWith("secret123", "hashed-password")
    expect(result).toEqual({
      id: "user-1",
      email: "player@example.com",
      name: "Taylor Jordan",
    })
  })

  it("rejects inactive users before password comparison", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-2",
      email: "inactive@example.com",
      firstName: "Casey",
      lastName: "Smith",
      passwordHash: "hashed-password",
      status: "PENDING",
    } as any)

    const result = await authorizeCredentials({
      email: "inactive@example.com",
      password: "secret123",
    })

    expect(result).toBeNull()
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })
})
