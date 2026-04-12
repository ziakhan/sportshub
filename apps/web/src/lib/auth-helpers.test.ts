import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { cookies } from "next/headers"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId, isImpersonating } from "@/lib/auth-helpers"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}))

vi.mock("./auth", () => ({
  authOptions: {},
}))

vi.mock("./permissions", () => ({
  defineAbilitiesFor: vi.fn(),
}))

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    userRole: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe("auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
    } as any)
  })

  it("returns impersonated user id for platform admins", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1" } } as any)
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue({ id: "platform-admin-role" } as any)
    vi.mocked(cookies).mockReturnValue({
      get: vi
        .fn()
        .mockImplementation((name: string) =>
          name === "admin-impersonate-uid" ? { value: "user-99" } : undefined
        ),
    } as any)

    await expect(getSessionUserId()).resolves.toEqual({
      userId: "user-99",
      isPlatformAdmin: true,
    })
  })

  it("returns real user id when no impersonation cookie exists", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(prisma.userRole.findFirst).mockResolvedValue(null)

    await expect(getSessionUserId()).resolves.toEqual({
      userId: "user-1",
      isPlatformAdmin: false,
    })
  })

  it("reports impersonation state from the cookie", () => {
    vi.mocked(cookies).mockReturnValue({
      get: vi
        .fn()
        .mockImplementation((name: string) =>
          name === "admin-impersonate-uid" ? { value: "user-99" } : undefined
        ),
    } as any)

    expect(isImpersonating()).toBe(true)
  })
})
